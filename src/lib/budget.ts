// Context budgeting and cost estimation.
//
// A real data room will not fit in any context window. Rather than silently
// truncating away the documents that matter, the pipeline selects what each
// seat sees, and reports what it left out.

import { modelById, type ModelSpec } from "./catalog";
import type { SourceDoc } from "./verify";

/**
 * Token estimate. Deliberately provider-agnostic: ~3.6 characters per token is
 * a reasonable average across English prose and the tabular text that
 * spreadsheet extraction produces, which is denser than prose.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.6);
}

export interface DocSelection {
  included: SourceDoc[];
  /** Documents that did not fit, so the prompt can say so honestly. */
  omitted: { name: string; tokens: number }[];
  usedTokens: number;
  budgetTokens: number;
}

/**
 * Choose documents that fit a seat's share of a model's context window.
 *
 * `priority` names documents the seat cares about most (its own workstream's
 * folder); those are considered first, then everything else by size ascending
 * so that many small documents beat one enormous one.
 */
export function selectDocuments(
  docs: SourceDoc[],
  model: ModelSpec,
  opts: { reservedForOutput?: number; priority?: string[]; shareOfWindow?: number } = {},
): DocSelection {
  const { reservedForOutput = 16000, priority = [], shareOfWindow = 0.6 } = opts;
  const budget = Math.max(4000, Math.floor(model.contextTokens * shareOfWindow) - reservedForOutput);

  const scored = docs.map((d) => ({ doc: d, tokens: estimateTokens(d.content) }));
  const isPriority = (n: string) => priority.some((p) => n.toLowerCase().includes(p.toLowerCase()));
  const ordered = [
    ...scored.filter((s) => isPriority(s.doc.name)).sort((a, b) => a.tokens - b.tokens),
    ...scored.filter((s) => !isPriority(s.doc.name)).sort((a, b) => a.tokens - b.tokens),
  ];

  const included: SourceDoc[] = [];
  const omitted: { name: string; tokens: number }[] = [];
  let used = 0;
  for (const s of ordered) {
    if (used + s.tokens <= budget) {
      included.push(s.doc);
      used += s.tokens;
    } else {
      omitted.push({ name: s.doc.name, tokens: s.tokens });
    }
  }

  // A data room can consist of one document larger than the whole budget.
  // Returning nothing would hand the analyst an empty room; include the
  // best candidate and let the caller clamp it instead.
  if (included.length === 0 && ordered.length > 0) {
    const first = ordered[0];
    included.push(first.doc);
    used = budget;
    const i = omitted.findIndex((o) => o.name === first.doc.name);
    if (i >= 0) omitted.splice(i, 1);
  }

  return { included, omitted, usedTokens: used, budgetTokens: budget };
}

/** Trim one document to a token allowance, keeping head and tail. */
export function clampDocument(content: string, maxTokens: number): string {
  const maxChars = maxTokens * 3.6;
  if (content.length <= maxChars) return content;
  // Keep the opening (definitions, parties, headline figures) and the closing
  // (signatures, schedules, covenants) — the middle is usually the most
  // repetitive part of a long agreement or ledger.
  const head = Math.floor(maxChars * 0.7);
  const tail = Math.floor(maxChars * 0.2);
  return `${content.slice(0, head)}\n\n… [${Math.round(
    (content.length - head - tail) / 3.6,
  )} tokens omitted from the middle of this document] …\n\n${content.slice(-tail)}`;
}

export interface CostEstimate {
  low: number;
  high: number;
  calls: number;
  inputTokens: number;
}

/**
 * Pre-flight cost estimate. Deliberately a range: output length is the
 * uncertain term, so we bound it rather than pretend to a point estimate.
 */
export function estimateRunCost(args: {
  workstreams: number;
  debateRounds: number;
  redTeam: boolean;
  dataRoomTokens: number;
  modelIds: string[];
}): CostEstimate {
  const { workstreams, debateRounds, redTeam, dataRoomTokens, modelIds } = args;

  // Nodes: 1 index + N analysts + N×(challenge+rebuttal) + redteam + verify
  //        + adjudicate + committee + memo
  const calls =
    1 + workstreams + workstreams * debateRounds * 2 + (redTeam ? 1 : 0) + 1 + 1 + 1;

  // Each analyst-class call carries roughly the data room plus the ledger.
  const perCallInput = Math.min(dataRoomTokens * 1.3, 180_000);
  const inputTokens = Math.round(calls * perCallInput);

  const specs = modelIds.map(modelById).filter((m): m is ModelSpec => Boolean(m));
  if (specs.length === 0) return { low: 0, high: 0, calls, inputTokens: 0 };
  const avgIn = specs.reduce((s, m) => s + m.inputCost, 0) / specs.length;
  const avgOut = specs.reduce((s, m) => s + m.outputCost, 0) / specs.length;

  const inputCost = (inputTokens / 1e6) * avgIn;
  // Output per call: ~1.5k tokens at the low end, ~6k at the high end.
  const low = inputCost + ((calls * 1500) / 1e6) * avgOut;
  const high = inputCost + ((calls * 6000) / 1e6) * avgOut;
  return { low, high, calls, inputTokens };
}
