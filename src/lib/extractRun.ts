// Wiring extraction to a live provider.
//
// Kept apart from extract.ts so the extraction logic itself stays a pure
// function of (documents, completion function) and can be tested with no
// network, no keys and no Tauri shell.
//
// This module is the only place the two meet: it picks a model, routes the call
// through the rate limiter and spend cap, charges the run, and turns the result
// into facts by putting every candidate through verification.

import { admitAll, type Fact } from "./facts";
import { costOf, modelById, modelsFor, selectModel, type ModelSpec, type ProviderKind } from "./catalog";
import { Limiter } from "./limiter";
import { extractAll, record, type CompleteFn, type ExtractionRun, type RecordedExtraction } from "./extract";
import { scanDataRoom, type InjectionHit } from "./safety";
import { invoke, type Completion, type ProviderPublic } from "./tauri";
import type { SourceDoc } from "./verify";

export interface ProviderChoice {
  providerId: string;
  model: ModelSpec;
}

/**
 * Pick a model for extraction from whatever the user has connected.
 *
 * Extraction wants faithful long-context reading and structured output, not
 * deep reasoning — it is copying sentences, not judging them. Weighting it
 * that way keeps the cheapest capable model in play rather than reaching for
 * the apex model on every document.
 */
export function chooseExtractor(providers: ProviderPublic[]): ProviderChoice | null {
  const usable = providers.filter((p) => p.enabled && p.has_key);
  if (usable.length === 0) return null;

  const kinds = usable.map((p) => p.kind as ProviderKind);
  const model = selectModel(modelsFor(kinds), {
    longContext: 5,
    structured: 5,
    speed: 3,
    reasoning: 2,
  });
  if (!model) return null;

  const provider = usable.find((p) => p.kind === model.provider);
  return provider ? { providerId: provider.id, model } : null;
}

/** Build a CompleteFn that calls the Rust provider layer through Tauri. */
export function tauriCompleter(
  choice: ProviderChoice,
  limiter: Limiter,
  onCost?: (usd: number) => void,
): CompleteFn {
  return async ({ system, user, maxTokens }) =>
    limiter.run(choice.providerId, async () => {
      const res = await invoke<Completion>("agent_complete", {
        providerId: choice.providerId,
        model: choice.model.id,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        // Extraction is transcription, not composition. Determinism is the
        // whole point, so temperature is pinned as low as the provider allows.
        temperature: 0,
        maxTokens,
      });
      const usd = costOf(res.model || choice.model.id, res.input_tokens, res.output_tokens);
      limiter.charge(usd);
      onCost?.(usd);
      return {
        text: res.text,
        inputTokens: res.input_tokens,
        outputTokens: res.output_tokens,
        model: res.model || choice.model.id,
      };
    });
}

export interface LiveExtractionResult {
  run: ExtractionRun;
  facts: Fact[];
  recorded: RecordedExtraction;
  injection: InjectionHit[];
  costUsd: number;
  verified: number;
  quarantined: number;
}

/**
 * Run extraction against a live provider and turn the output into facts.
 *
 * Verification happens here rather than in the caller so there is no path by
 * which a candidate becomes a fact without passing through `admitAll`.
 */
export async function runLiveExtraction(
  docs: SourceDoc[],
  choice: ProviderChoice,
  opts: {
    budgetUsd?: number;
    onProgress?: (done: number, total: number, doc: string) => void;
  } = {},
): Promise<LiveExtractionResult> {
  const limiter = new Limiter({ concurrency: 2, budgetUsd: opts.budgetUsd ?? 5 });
  let cost = 0;
  const complete = tauriCompleter(choice, limiter, (usd) => {
    cost += usd;
  });

  // Screen the data room before anything is sent, so an injection attempt is
  // recorded as a finding rather than discovered by its effect.
  const injection = scanDataRoom(docs);

  const run = await extractAll(docs, complete, {
    extractedBy: choice.model.id,
    onProgress: opts.onProgress,
  });

  const facts = admitAll(run.candidates, docs, { now: 1 });

  return {
    run,
    facts,
    recorded: record(run, docs),
    injection,
    costUsd: cost,
    verified: facts.filter((f) => f.status === "verified").length,
    quarantined: facts.filter((f) => f.status !== "verified").length,
  };
}

/** Rough pre-flight estimate, so a run can be priced before it is authorised. */
export function estimateCost(docs: SourceDoc[], model: ModelSpec): { tokens: number; usd: number } {
  // Roughly four characters per token, plus the standing system prompt per call.
  const promptTokens = docs.reduce((s, d) => s + Math.ceil(d.content.length / 4) + 900, 0);
  const outTokens = docs.length * 700;
  const spec = modelById(model.id);
  return {
    tokens: promptTokens + outTokens,
    usd: spec ? (promptTokens / 1e6) * spec.inputCost + (outTokens / 1e6) * spec.outputCost : 0,
  };
}
