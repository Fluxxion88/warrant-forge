// The Concord diligence pipeline.
//
// Seven levels, each feeding the next. The design principle throughout: a model
// is a weak critic of its own reasoning, so every challenge is issued by a
// different provider than the one being challenged. Disagreement is preserved
// up the stack rather than averaged away, and nothing reaches the memo without
// passing a citation check.
//
//   L1 Index      one long-context model builds a fact ledger from the data room
//   L2 Analysis   workstream analysts work in parallel, each on a suited model
//   L3 Debate     cross-provider challenge and rebuttal, N rounds
//   L4 Red Team   an independent model attacks the thesis itself
//   L5 Verify     citations checked programmatically, then adjudicated
//   L6 Committee  disputes resolved, risk register prioritised
//   L7 Memo       apex model writes the IC recommendation

import {
  ANTI_FABRICATION,
  DEAL_TEAM_CONTEXT,
  EVIDENCE_STANDARD,
  MEMO_STANDARD,
  SEVERITY_RUBRIC,
  STAGE_GUIDANCE,
} from "./knowledge/method";
import { WORKSTREAMS, type Workstream } from "./knowledge/workstreams";
import { costOf, selectModel, type ModelSpec } from "./catalog";
import { clampDocument, selectDocuments } from "./budget";
import { Limiter, type LimiterOptions } from "./limiter";
import { fenceDocument, scanDataRoom, UNTRUSTED_CONTENT_RULE, type InjectionHit } from "./safety";
import {
  summarise,
  verifyFinding,
  type Citation,
  type SourceDoc,
  type VerifiedFinding,
} from "./verify";

export interface Msg {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Injected so the pipeline is testable without network access. */
export type CompleteFn = (args: {
  providerId: string;
  model: string;
  messages: Msg[];
  temperature?: number;
  maxTokens?: number;
}) => Promise<{ text: string; inputTokens: number; outputTokens: number }>;

export interface DealContext {
  codeName: string;
  target: string;
  sector: string;
  geography: string;
  dealType: string;
  consideration: string;
  stage: string;
  thesis: string;
}

/** A model that is actually usable: catalogued spec plus a configured provider. */
export interface AvailableModel {
  spec: ModelSpec;
  providerId: string;
}

export interface PipelineConfig {
  /** Workstream ids to staff. */
  workstreams: string[];
  /** Proposer/challenger exchanges per workstream. */
  debateRounds: number;
  redTeam: boolean;
  /** 0 = quality at any cost, 1 = strongly prefer cheaper models. */
  budgetBias: number;
  /** Firm's own standards and precedent, injected into every analyst. */
  playbook: string;
  /** Hard spend ceiling in USD; the run aborts rather than exceeding it. */
  budgetUsd: number;
  /** Simultaneous requests per provider. */
  concurrency: number;
}

export const DEFAULT_CONFIG: PipelineConfig = {
  workstreams: ["financial", "legal", "commercial", "operational", "tax", "technology", "integration"],
  debateRounds: 1,
  redTeam: true,
  budgetBias: 0.3,
  playbook: "",
  budgetUsd: 25,
  concurrency: 3,
};

/**
 * Node outputs already produced by an earlier attempt. A run that dies at
 * level 6 should not re-pay for levels 1–5, so completed nodes are replayed
 * from the checkpoint instead of re-issued to the provider.
 */
export type Checkpoint = Record<string, string>;

export type NodeState = "running" | "done" | "error" | "restored";

export interface NodeEvent {
  key: string;
  level: number;
  levelName: string;
  label: string;
  /** Which model produced this, for the audit trail. */
  model?: string;
  state: NodeState;
  output?: string;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
}

/** Completed node outputs from a run, for resuming a later attempt. */
export function checkpointOf(transcript: NodeEvent[]): Checkpoint {
  const cp: Checkpoint = {};
  for (const n of transcript) {
    if ((n.state === "done" || n.state === "restored") && n.output !== undefined) {
      cp[n.key] = n.output;
    }
  }
  return cp;
}

export interface PipelineResult {
  memo: string;
  findings: VerifiedFinding[];
  transcript: NodeEvent[];
  totals: { inputTokens: number; outputTokens: number; costUsd: number; retries: number };
  integrity: ReturnType<typeof summarise>;
  /** Instruction-shaped text found in counterparty documents. */
  injectionHits: InjectionHit[];
  /** Documents that did not fit the context budget, reported not hidden. */
  omittedDocuments: { name: string; tokens: number }[];
}

export const LEVELS = [
  "Indexing",
  "Workstream analysis",
  "Cross-examination",
  "Red team",
  "Verification",
  "Risk committee",
  "Investment committee",
] as const;

// ---------------------------------------------------------------- prompts

function houseRules(deal: DealContext, playbook: string): string {
  const stage = STAGE_GUIDANCE[deal.stage] ?? "";
  return [
    DEAL_TEAM_CONTEXT,
    SEVERITY_RUBRIC,
    EVIDENCE_STANDARD,
    ANTI_FABRICATION,
    UNTRUSTED_CONTENT_RULE,
    stage ? `STAGE — ${deal.stage}: ${stage}` : "",
    playbook.trim() ? `FIRM STANDARDS AND PRECEDENT (authoritative where it conflicts with general practice):\n${playbook.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function dealHeader(deal: DealContext): string {
  return [
    `PROJECT ${deal.codeName.toUpperCase()}`,
    `Target: ${deal.target}`,
    `Sector: ${deal.sector || "—"}`,
    `Geography: ${deal.geography || "—"}`,
    `Structure: ${deal.dealType || "—"}`,
    `Consideration: ${deal.consideration || "—"}`,
    `Stage: ${deal.stage}`,
    `Investment thesis: ${deal.thesis || "—"}`,
  ].join("\n");
}

/** The finding format every analyst must emit — machine-parseable, citation-bearing. */
const FINDING_FORMAT = `
OUTPUT FORMAT — emit each material issue as a block in exactly this form:

<<<FINDING
SEVERITY: CRITICAL | HIGH | MEDIUM | LOW
TITLE: one line, specific and factual
DETAIL: two to five sentences — what it is, why it matters, quantified where possible, and the proposed treatment (price adjustment / indemnity / condition / accept)
CITE: <exact document name> :: "<verbatim quote of 10-40 words from that document>"
CITE: <optional additional citation in the same form>
FINDING>>>

Emit as many FINDING blocks as the evidence supports. After the blocks, add a short
section headed ASSESSMENT with your overall read of this workstream, and a section headed
REQUESTS listing what you need that the data room does not contain.`;

/**
 * Render documents for a prompt: budget-selected for the target model, each
 * clamped to a per-document allowance and fenced as untrusted content. Any
 * document that did not fit is named, so the model knows its view is partial
 * rather than assuming the data room is complete.
 */
function docsBlock(docs: SourceDoc[], model: ModelSpec, shareOfWindow: number, priority: string[] = []): string {
  if (docs.length === 0) return "(The data room is empty.)";
  const sel = selectDocuments(docs, model, { shareOfWindow, priority });
  const perDocTokens = Math.max(1500, Math.floor(sel.budgetTokens / Math.max(1, sel.included.length)));
  const body = sel.included
    .map((d) => fenceDocument(d.name, clampDocument(d.content, perDocTokens)))
    .join("\n\n");
  if (sel.omitted.length === 0) return body;
  return (
    `${body}\n\nNOT INCLUDED IN THIS VIEW (exceeded the context budget — request them if your ` +
    `workstream needs them): ${sel.omitted.map((o) => o.name).join(", ")}`
  );
}

// ---------------------------------------------------------------- parsing

export function parseFindings(text: string, workstream: string): Omit<VerifiedFinding, "verification" | "verificationNotes" | "locations">[] {
  const out: Omit<VerifiedFinding, "verification" | "verificationNotes" | "locations">[] = [];
  const blocks = text.matchAll(/<<<FINDING([\s\S]*?)FINDING>>>/g);
  let n = 0;
  for (const b of blocks) {
    const body = b[1];
    const sev = /SEVERITY:\s*(CRITICAL|HIGH|MEDIUM|LOW)/i.exec(body)?.[1]?.toUpperCase();
    const title = /TITLE:\s*(.+)/.exec(body)?.[1]?.trim();
    const detail = /DETAIL:\s*([\s\S]*?)(?=\nCITE:|\n?$)/.exec(body)?.[1]?.trim() ?? "";
    if (!sev || !title) continue;
    const citations: Citation[] = [];
    for (const c of body.matchAll(/CITE:\s*(.+?)\s*::\s*"([\s\S]*?)"/g)) {
      citations.push({ document: c[1].trim(), quote: c[2].trim() });
    }
    out.push({
      id: `${workstream}-${n++}`,
      workstream,
      severity: sev,
      title,
      detail,
      citations,
    });
  }
  return out;
}

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export function sortFindings(findings: VerifiedFinding[]): VerifiedFinding[] {
  return [...findings].sort((a, b) => {
    const s = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
    if (s !== 0) return s;
    // Verified findings outrank unverified ones of the same severity.
    const rank = (v: string) => (v === "verified" ? 0 : v === "loose" ? 1 : 2);
    return rank(a.verification) - rank(b.verification);
  });
}

function renderFindings(findings: VerifiedFinding[], includeVerification = false): string {
  if (findings.length === 0) return "(no findings)";
  return findings
    .map((f) => {
      const cites = f.citations
        .map((c) => `    cite: ${c.document} :: "${c.quote}"`)
        .join("\n");
      const v = includeVerification ? ` [${f.verification}]` : "";
      return `- [${f.severity}]${v} (${f.workstream}) ${f.title}\n    ${f.detail}\n${cites}`;
    })
    .join("\n");
}

// ---------------------------------------------------------------- engine

export async function runPipeline(
  deal: DealContext,
  docs: SourceDoc[],
  models: AvailableModel[],
  cfg: PipelineConfig,
  complete: CompleteFn,
  emit: (e: NodeEvent) => void,
  isCancelled: () => boolean = () => false,
  limiterOpts: LimiterOptions = {},
  checkpoint: Checkpoint = {},
): Promise<PipelineResult> {
  if (models.length === 0) throw new Error("No cloud providers are configured.");

  const specs = models.map((m) => m.spec);
  const providerOf = (spec: ModelSpec) =>
    models.find((m) => m.spec.id === spec.id)!.providerId;
  const totals = { inputTokens: 0, outputTokens: 0, costUsd: 0, retries: 0 };
  const transcript: NodeEvent[] = [];
  const limiter = new Limiter({
    concurrency: cfg.concurrency,
    budgetUsd: cfg.budgetUsd,
    ...limiterOpts,
  });

  // Screen counterparty documents before any of them reach a model.
  const injectionHits = scanDataRoom(docs);
  if (injectionHits.length > 0) {
    emit({
      key: "l0:screen",
      level: 1,
      levelName: LEVELS[0],
      label: "Document screening",
      state: "done",
      output:
        `${injectionHits.length} instance(s) of instruction-shaped text found in counterparty documents. ` +
        `These are fenced as untrusted content and reported as findings rather than obeyed.\n\n` +
        injectionHits
          .map((h) => `[${h.pattern}] ${h.document}:${h.line}\n  "${h.excerpt}"`)
          .join("\n"),
    });
  }

  const record = (e: NodeEvent) => {
    transcript.push(e);
    emit(e);
  };

  /** One agent turn: emits running/done events, tracks spend, never throws. */
  async function turn(args: {
    key: string;
    level: number;
    label: string;
    model: ModelSpec;
    system: string;
    user: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    const { key, level, label, model } = args;
    const levelName = LEVELS[level - 1];
    const providerId = providerOf(model);

    // Replay a completed node from an earlier attempt rather than paying twice.
    const saved = checkpoint[key];
    if (saved !== undefined) {
      record({ key, level, levelName, label, model: model.label, state: "restored", output: saved });
      return saved;
    }

    record({ key, level, levelName, label, model: model.label, state: "running" });
    try {
      const res = await limiter.run(providerId, () =>
        complete({
          providerId,
          model: model.id,
          messages: [
            { role: "system", content: args.system },
            { role: "user", content: args.user },
          ],
          temperature: args.temperature ?? 0.2,
          maxTokens: args.maxTokens ?? 8000,
        }),
      );
      const cost = costOf(model.id, res.inputTokens, res.outputTokens);
      totals.inputTokens += res.inputTokens;
      totals.outputTokens += res.outputTokens;
      totals.costUsd += cost;
      limiter.charge(cost);
      record({
        key,
        level,
        levelName,
        label,
        model: model.label,
        state: "done",
        output: res.text,
        inputTokens: res.inputTokens,
        outputTokens: res.outputTokens,
        costUsd: cost,
      });
      return res.text;
    } catch (e) {
      const error = String(e);
      record({ key, level, levelName, label, model: model.label, state: "error", error });
      // A breached budget must stop the whole run, not degrade one node.
      if (e instanceof Error && e.name === "BudgetExceededError") throw e;
      return `[${label} unavailable: ${error}]`;
    }
  }

  const rules = houseRules(deal, cfg.playbook);
  const header = dealHeader(deal);
  const staffed: Workstream[] = cfg.workstreams
    .map((id) => WORKSTREAMS.find((w) => w.id === id))
    .filter((w): w is Workstream => Boolean(w));

  // ---- L1 Indexing: one long-context pass builds a shared fact ledger -----
  const indexer =
    selectModel(specs, { longContext: 5, structured: 4, speed: 3 }, { budgetBias: cfg.budgetBias }) ??
    specs[0];
  const ledger = await turn({
    key: "l1:index",
    level: 1,
    label: "Data room index",
    model: indexer,
    system: `You are the diligence associate who reads the entire data room first and prepares the fact base every other analyst will work from.\n\n${rules}`,
    user:
      `${header}\n\nDATA ROOM:\n${docsBlock(docs, indexer, 0.75)}\n\n` +
      `Produce a FACT LEDGER: a dense, organised extraction of every concrete fact that bears on diligence — figures, dates, counterparties, contractual terms, obligations. Group by workstream. Attribute each fact to its document by name. Do not analyse or opine; extract. Then list, under MISSING, the standard diligence materials that are absent from this data room.`,
    maxTokens: 12000,
  });

  if (isCancelled()) throw new Error("cancelled");

  // ---- L2 Analysis: workstream analysts in parallel -----------------------
  const analystAssignments = staffed.map((ws) => {
    const model =
      selectModel(specs, ws.needs, { budgetBias: cfg.budgetBias }) ?? specs[0];
    return { ws, model };
  });

  const analyses = await Promise.all(
    analystAssignments.map(async ({ ws, model }) => {
      const text = await turn({
        key: `l2:${ws.id}`,
        level: 2,
        label: ws.name,
        model,
        system:
          `You are the ${ws.name} lead on this transaction (${ws.owner}).\n\n` +
          `CHARTER: ${ws.charter}\n\n` +
          `KNOWN FAILURE MODES IN THIS WORKSTREAM — check each one explicitly against the evidence:\n` +
          ws.redFlags.map((r) => `- ${r}`).join("\n") +
          `\n\nIf the data room does not let you test one of these, say so under REQUESTS.\n\n${rules}\n${FINDING_FORMAT}`,
        user:
          `${header}\n\nFACT LEDGER (prepared from the data room):\n${ledger}\n\n` +
          `SOURCE DOCUMENTS:\n${docsBlock(docs, model, 0.5, [ws.name])}\n\n` +
          `Conduct your workstream's diligence and report findings.`,
        maxTokens: 9000,
      });
      return { ws, model, text };
    }),
  );

  if (isCancelled()) throw new Error("cancelled");

  // ---- L3 Cross-examination: a *different provider* challenges each --------
  const debates: { ws: Workstream; exchange: string }[] = [];
  for (const { ws, model, text } of analyses) {
    let position = text;
    let exchange = "";
    for (let round = 1; round <= cfg.debateRounds; round++) {
      if (isCancelled()) throw new Error("cancelled");
      // The challenger must not be the same provider as the analyst.
      const challenger =
        selectModel(
          specs,
          { adversarial: 5, reasoning: 5, structured: 3 },
          { avoidProviders: [model.provider], budgetBias: cfg.budgetBias },
        ) ?? specs[0];

      const critique = await turn({
        key: `l3:${ws.id}:c${round}`,
        level: 3,
        label: `Challenge — ${ws.name} (r${round})`,
        model: challenger,
        system:
          `You are an independent reviewer cross-examining another firm's ${ws.name} analysis on this transaction. You did not write it and you have no stake in defending it.\n\n` +
          `Your job is to find where the analysis is wrong, overstated, understated, or unsupported. Specifically:\n` +
          `- Claims whose cited quote does not actually support the conclusion drawn\n` +
          `- Findings graded at the wrong severity under the rubric\n` +
          `- Material issues in this workstream that the analyst missed entirely\n` +
          `- Inferences presented as established facts\n\n` +
          `Be specific and quote what you are objecting to. Where the analysis is sound, say so plainly — a challenge that manufactures disagreement is as useless as one that rubber-stamps.\n\n${rules}`,
        user:
          `${header}\n\nANALYSIS UNDER REVIEW (${ws.name}):\n${position}\n\n` +
          `SOURCE DOCUMENTS:\n${docsBlock(docs, challenger, 0.45, [ws.name])}\n\n` +
          `Cross-examine this analysis. Structure your response as: UPHELD (findings that survive), CHALLENGED (with your specific objection to each), and MISSED (material issues the analyst did not raise, in the standard FINDING format).`,
        maxTokens: 7000,
      });

      const rebuttal = await turn({
        key: `l3:${ws.id}:r${round}`,
        level: 3,
        label: `Rebuttal — ${ws.name} (r${round})`,
        model,
        system:
          `You are the ${ws.name} lead. Your analysis has been cross-examined by an independent reviewer.\n\n` +
          `Respond honestly, point by point. Where the challenge is right, concede it and correct your finding — conceding is not a failure, it is the process working. Where the challenge is wrong, rebut it with the specific evidence. Where you genuinely cannot resolve it from the data room, mark it UNRESOLVED and state what evidence would settle it.\n\n` +
          `Then restate your final position as a complete, corrected set of FINDING blocks. This restated set is what goes forward.\n\n${rules}\n${FINDING_FORMAT}`,
        user:
          `${header}\n\nYOUR ANALYSIS:\n${position}\n\nCROSS-EXAMINATION:\n${critique}\n\n` +
          `SOURCE DOCUMENTS:\n${docsBlock(docs, model, 0.45, [ws.name])}\n\n` +
          `Respond to the challenge and restate your final findings.`,
        maxTokens: 9000,
      });

      exchange += `\n--- ${ws.name} round ${round} ---\nCHALLENGE (${challenger.label}):\n${critique}\n\nREBUTTAL (${model.label}):\n${rebuttal}\n`;
      position = rebuttal;
    }
    debates.push({ ws, exchange });
    // The post-debate position replaces the analyst's first draft.
    const idx = analyses.findIndex((a) => a.ws.id === ws.id);
    if (idx >= 0) analyses[idx].text = position;
  }

  // ---- L4 Red team: attack the thesis, not the workstreams ----------------
  let redTeam = "";
  if (cfg.redTeam) {
    if (isCancelled()) throw new Error("cancelled");
    const usedProviders = [...new Set(analystAssignments.map((a) => a.model.provider))];
    const rtModel =
      selectModel(
        specs,
        { adversarial: 5, reasoning: 5 },
        { avoidProviders: usedProviders.slice(0, 2), budgetBias: cfg.budgetBias * 0.5 },
      ) ?? specs[0];
    redTeam = await turn({
      key: "l4:redteam",
      level: 4,
      label: "Red team",
      model: rtModel,
      system:
        `You are the red team. You are paid to stop bad deals, and you are rewarded for finding the reason this one fails — not for balance.\n\n` +
        `Assume the diligence team has been anchored by management's framing and by each other. Your job:\n` +
        `- Name the scenario in which this acquisition destroys value, concretely\n` +
        `- Identify the two or three assumptions doing all the work in the thesis, and what happens if each is wrong\n` +
        `- Find what the process has rationalised away or declined to look at\n` +
        `- Ask what a competent seller would have kept out of this data room\n\n` +
        `Ground every attack in the evidence. A speculative objection with no basis in the documents wastes the committee's time.\n\n${rules}`,
      user:
        `${header}\n\nWORKSTREAM CONCLUSIONS AFTER CROSS-EXAMINATION:\n` +
        analyses.map((a) => `### ${a.ws.name}\n${a.text}`).join("\n\n") +
        `\n\nFACT LEDGER:\n${ledger.slice(0, 12000)}\n\nAttack this transaction.`,
      maxTokens: 7000,
    });
  }

  if (isCancelled()) throw new Error("cancelled");

  // ---- L5 Verification: programmatic first, then adjudicated --------------
  const parsed = analyses.flatMap((a) => parseFindings(a.text, a.ws.name));
  const verified = parsed.map((f) => verifyFinding(f, docs));
  const integrity = summarise(verified);

  record({
    key: "l5:citations",
    level: 5,
    levelName: LEVELS[4],
    label: "Citation check (deterministic)",
    state: "done",
    output:
      `${integrity.total} findings checked against ${docs.length} source documents.\n` +
      `verified: ${integrity.verified}\nparaphrased/misattributed: ${integrity.loose}\n` +
      `unsupported: ${integrity.unsupported}\nuncited: ${integrity.noCitation}\n` +
      `evidence integrity: ${(integrity.integrityScore * 100).toFixed(0)}%\n\n` +
      verified
        .filter((f) => f.verification !== "verified")
        .map((f) => `[${f.verification}] ${f.title}\n  ${f.verificationNotes.join("\n  ")}`)
        .join("\n"),
  });

  const suspect = verified.filter(
    (f) => f.verification === "unsupported" || f.verification === "no_citation",
  );
  let adjudication = "";
  if (suspect.length > 0) {
    const auditor =
      selectModel(specs, { reasoning: 5, structured: 5 }, { budgetBias: 0 }) ?? specs[0];
    adjudication = await turn({
      key: "l5:adjudicate",
      level: 5,
      label: "Evidence adjudication",
      model: auditor,
      system:
        `You are the evidence auditor. A deterministic check has flagged findings whose quotations could not be located in the data room.\n\n` +
        `For each, decide: (a) the underlying point is still supportable from the documents — supply the correct citation; (b) the point is an inference rather than a documented fact — restate it as an inference; or (c) it is unsupported and must be struck.\n\n` +
        `Do not defend a fabrication. Striking a finding is the correct outcome when the evidence is not there.\n\n${rules}`,
      user:
        `${header}\n\nFLAGGED FINDINGS:\n${renderFindings(suspect, true)}\n\n` +
        `Verification notes:\n${suspect.map((f) => `- ${f.title}: ${f.verificationNotes.join("; ")}`).join("\n")}\n\n` +
        `SOURCE DOCUMENTS:\n${docsBlock(docs, auditor, 0.5)}\n\n` +
        `Adjudicate each flagged finding. Label your verdict for each as SUPPORTED (with correct citation), INFERENCE, or STRUCK.`,
      maxTokens: 6000,
    });
  }

  if (isCancelled()) throw new Error("cancelled");

  // ---- L6 Risk committee --------------------------------------------------
  const committee =
    selectModel(specs, { reasoning: 5, structured: 5, writing: 4 }, { budgetBias: 0 }) ?? specs[0];
  const register = await turn({
    key: "l6:committee",
    level: 6,
    label: "Risk committee",
    model: committee,
    system:
      `You chair the risk committee. Eleven workstreams have reported, been cross-examined, and been evidence-checked. Consolidate.\n\n` +
      `- Deduplicate findings that different workstreams raised as the same underlying issue, and say so where one workstream's finding compounds another's.\n` +
      `- Re-grade severity consistently across workstreams using the rubric.\n` +
      `- Where the cross-examination did not converge, you decide — and record that it was disputed, with both positions.\n` +
      `- Give findings the citation check could not verify materially less weight, and say which they are.\n` +
      `- Produce a prioritised risk register: the issues that decide this deal, in order.\n\n${rules}`,
    user:
      `${header}\n\nFINDINGS AFTER CROSS-EXAMINATION (with verification status):\n${renderFindings(sortFindings(verified), true)}\n\n` +
      (adjudication ? `EVIDENCE ADJUDICATION:\n${adjudication}\n\n` : "") +
      (redTeam ? `RED TEAM:\n${redTeam}\n\n` : "") +
      `Produce the consolidated risk register with proposed treatment for each material issue.`,
    maxTokens: 9000,
  });

  if (isCancelled()) throw new Error("cancelled");

  // ---- L7 Investment committee memo ---------------------------------------
  const apex =
    selectModel(specs, { reasoning: 5, writing: 5, structured: 4 }, { budgetBias: 0 }) ?? specs[0];
  const memo = await turn({
    key: "l7:memo",
    level: 7,
    label: "IC memo",
    model: apex,
    system:
      `You are the deal captain writing to the investment committee. You own this recommendation.\n\n${rules}\n\n${MEMO_STANDARD}`,
    user:
      `${header}\n\nCONSOLIDATED RISK REGISTER:\n${register}\n\n` +
      (redTeam ? `RED TEAM CHALLENGE:\n${redTeam}\n\n` : "") +
      `EVIDENCE INTEGRITY: ${integrity.verified} of ${integrity.total} findings carry a quotation verified against the source documents (${(integrity.integrityScore * 100).toFixed(0)}%). ` +
      `${integrity.unsupported + integrity.noCitation} could not be substantiated and must be treated as unverified in your memo.\n\n` +
      `Write the investment committee memo.`,
    maxTokens: 12000,
  });

  totals.retries = limiter.retries;
  // What the widest-context seat still could not see — the honest ceiling on
  // this run's coverage.
  const omittedDocuments = selectDocuments(docs, indexer, { shareOfWindow: 0.75 }).omitted;

  return {
    memo,
    findings: sortFindings(verified),
    transcript,
    totals,
    integrity,
    injectionHits,
    omittedDocuments,
  };
}
