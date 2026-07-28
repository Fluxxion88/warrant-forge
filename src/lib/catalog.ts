// The model catalog. Routing is only meaningful if the router knows what each
// model is actually good at, so every entry carries capability scores and a
// price. Model IDs verified against provider documentation, July 2026 — they
// are editable in Settings because vendors rename models frequently.

export type ProviderKind =
  | "anthropic"
  | "openai"
  | "google"
  | "deepseek"
  | "moonshot"
  | "openai_compatible";

/** What a level needs from a model. Scores are 1–5, relative not absolute. */
export interface Capabilities {
  /** Deep multi-step reasoning, judgement under ambiguity. */
  reasoning: number;
  /** Holding a large data room in one context without losing detail. */
  longContext: number;
  /** Reliable structured/JSON output and instruction adherence. */
  structured: number;
  /** Throughput per dollar — matters for wide parallel layers. */
  speed: number;
  /** Willingness to disagree and press an adversarial line. */
  adversarial: number;
  /** Quality of institutional prose for the final memo. */
  writing: number;
}

export interface ModelSpec {
  id: string;
  provider: ProviderKind;
  label: string;
  contextTokens: number;
  /** USD per 1M tokens. */
  inputCost: number;
  outputCost: number;
  caps: Capabilities;
  note: string;
}

// Model ids, context windows and output caps below were read from the live
// /v1/models endpoint on 2026-07-28, not from a cached reference.
//
// That distinction earned its place. An earlier edit "corrected" claude-sonnet-5
// to claude-sonnet-4-6 on the strength of documentation cached in June; the API
// shows Sonnet 5 and Opus 5 both shipped since, so the original entry had been
// right and the correction was the error. Provenance decays. Check the endpoint.
//
// Prices are NOT returned by the models endpoint and remain unconfirmed. They
// feed costOf(), which feeds the hard spend cap, so an unknown price is set at
// or above the nearest known tier: over-estimating stops a run early,
// under-estimating lets it overspend.
export const CATALOG: ModelSpec[] = [
  // ---- Anthropic ---- ids and limits verified against /v1/models 2026-07-28
  {
    id: "claude-opus-5",
    provider: "anthropic",
    label: "Claude Opus 5",
    contextTokens: 1_000_000,
    inputCost: 5,
    outputCost: 25,
    caps: { reasoning: 5, longContext: 5, structured: 5, speed: 3, adversarial: 5, writing: 5 },
    note: "Current apex. 1M context, 128k output, adaptive thinking. Pricing unconfirmed.",
  },
  {
    id: "claude-sonnet-5",
    provider: "anthropic",
    label: "Claude Sonnet 5",
    contextTokens: 1_000_000,
    inputCost: 3,
    outputCost: 15,
    caps: { reasoning: 4, longContext: 5, structured: 5, speed: 4, adversarial: 4, writing: 5 },
    note: "Near-apex at lower cost. 1M context, 128k output. Pricing unconfirmed.",
  },
  {
    id: "claude-opus-4-8",
    provider: "anthropic",
    label: "Claude Opus 4.8",
    contextTokens: 1_000_000,
    inputCost: 5,
    outputCost: 25,
    caps: { reasoning: 5, longContext: 5, structured: 5, speed: 3, adversarial: 4, writing: 5 },
    note: "Previous apex. Strong institutional prose.",
  },
  {
    id: "claude-sonnet-4-6",
    provider: "anthropic",
    label: "Claude Sonnet 4.6",
    contextTokens: 1_000_000,
    inputCost: 3,
    outputCost: 15,
    caps: { reasoning: 4, longContext: 5, structured: 5, speed: 4, adversarial: 4, writing: 5 },
    note: "Balanced tier. Good workstream analyst.",
  },
  {
    // The alias resolves (verified 200 against /v1/models/claude-haiku-4-5) and
    // is stable across dated snapshots, so it is preferred over the dated id
    // the list endpoint happens to return.
    id: "claude-haiku-4-5",
    provider: "anthropic",
    label: "Claude Haiku 4.5",
    contextTokens: 200_000,
    inputCost: 1,
    outputCost: 5,
    caps: { reasoning: 3, longContext: 3, structured: 4, speed: 5, adversarial: 2, writing: 4 },
    note: "Fast and cheap. Extraction and formatting. No adaptive thinking.",
  },

  // ---- OpenAI ----
  {
    id: "gpt-5.6-sol",
    provider: "openai",
    label: "GPT-5.6 Sol",
    contextTokens: 400_000,
    inputCost: 6,
    outputCost: 24,
    caps: { reasoning: 5, longContext: 4, structured: 5, speed: 3, adversarial: 5, writing: 4 },
    note: "Flagship reasoning. Excellent challenger and quantitative analyst.",
  },
  {
    id: "gpt-5.6-terra",
    provider: "openai",
    label: "GPT-5.6 Terra",
    contextTokens: 400_000,
    inputCost: 3,
    outputCost: 12,
    caps: { reasoning: 4, longContext: 4, structured: 5, speed: 4, adversarial: 4, writing: 4 },
    note: "Balanced tier for analyst roles.",
  },
  {
    id: "gpt-5.6-luna",
    provider: "openai",
    label: "GPT-5.6 Luna",
    contextTokens: 400_000,
    inputCost: 1,
    outputCost: 4,
    caps: { reasoning: 3, longContext: 3, structured: 5, speed: 5, adversarial: 3, writing: 3 },
    note: "High-volume extraction at speed.",
  },

  // ---- Google ----
  {
    id: "gemini-3.1-pro-preview",
    provider: "google",
    label: "Gemini 3.1 Pro",
    contextTokens: 1_000_000,
    inputCost: 2.5,
    outputCost: 15,
    caps: { reasoning: 5, longContext: 5, structured: 4, speed: 3, adversarial: 4, writing: 4 },
    note: "Very large context with strong reasoning. Commercial and market work.",
  },
  {
    id: "gemini-3.6-flash",
    provider: "google",
    label: "Gemini 3.6 Flash",
    contextTokens: 1_000_000,
    inputCost: 0.4,
    outputCost: 2.5,
    caps: { reasoning: 3, longContext: 5, structured: 4, speed: 5, adversarial: 3, writing: 3 },
    note: "Cheapest way to read an entire data room. Default indexer.",
  },

  // ---- DeepSeek ----
  {
    id: "deepseek-v4-pro",
    provider: "deepseek",
    label: "DeepSeek V4 Pro",
    contextTokens: 1_000_000,
    inputCost: 0.6,
    outputCost: 2.2,
    caps: { reasoning: 5, longContext: 5, structured: 4, speed: 3, adversarial: 5, writing: 3 },
    note: "Exceptional reasoning per dollar. Strong quantitative challenger.",
  },
  {
    id: "deepseek-v4-flash",
    provider: "deepseek",
    label: "DeepSeek V4 Flash",
    contextTokens: 128_000,
    inputCost: 0.28,
    outputCost: 1.1,
    caps: { reasoning: 4, longContext: 3, structured: 4, speed: 5, adversarial: 4, writing: 3 },
    note: "Cheap reasoning for wide parallel layers.",
  },

  // ---- Moonshot ----
  {
    id: "kimi-k2.6",
    provider: "moonshot",
    label: "Kimi K2.6",
    contextTokens: 256_000,
    inputCost: 0.6,
    outputCost: 2.5,
    caps: { reasoning: 4, longContext: 5, structured: 4, speed: 4, adversarial: 4, writing: 4 },
    note: "Agentic 1T MoE with long-document strength. Good legal reader.",
  },
];

export const PROVIDER_META: Record<ProviderKind, { label: string; defaultBase: string; keyHint: string }> = {
  anthropic: { label: "Anthropic", defaultBase: "https://api.anthropic.com", keyHint: "sk-ant-…" },
  openai: { label: "OpenAI", defaultBase: "https://api.openai.com/v1", keyHint: "sk-…" },
  google: {
    label: "Google Gemini",
    defaultBase: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyHint: "AIza…",
  },
  deepseek: { label: "DeepSeek", defaultBase: "https://api.deepseek.com/v1", keyHint: "sk-…" },
  moonshot: { label: "Moonshot (Kimi)", defaultBase: "https://api.moonshot.ai/v1", keyHint: "sk-…" },
  openai_compatible: { label: "OpenAI-compatible", defaultBase: "", keyHint: "provider key" },
};

export function modelById(id: string): ModelSpec | undefined {
  return CATALOG.find((m) => m.id === id);
}

export function modelsFor(providers: ProviderKind[]): ModelSpec[] {
  return CATALOG.filter((m) => providers.includes(m.provider));
}

/** USD cost of a completed call. */
export function costOf(modelId: string, inputTokens: number, outputTokens: number): number {
  const m = modelById(modelId);
  if (!m) return 0;
  return (inputTokens / 1e6) * m.inputCost + (outputTokens / 1e6) * m.outputCost;
}

/**
 * Pick the best available model for a role.
 *
 * `weights` says what the role needs; `diversityPenalty` lets the router avoid
 * handing a challenger the same provider it is challenging, which is the whole
 * point of cross-examination — a model is a weak critic of its own reasoning.
 */
export function selectModel(
  available: ModelSpec[],
  weights: Partial<Capabilities>,
  opts: { avoidProviders?: ProviderKind[]; budgetBias?: number } = {},
): ModelSpec | null {
  if (available.length === 0) return null;
  const { avoidProviders = [], budgetBias = 0 } = opts;
  let best: ModelSpec | null = null;
  let bestScore = -Infinity;
  for (const m of available) {
    let score = 0;
    let totalWeight = 0;
    for (const [k, w] of Object.entries(weights) as [keyof Capabilities, number][]) {
      score += m.caps[k] * w;
      totalWeight += w;
    }
    score = totalWeight > 0 ? score / totalWeight : 0;
    // Cost pressure: budgetBias 0 ignores price, 1 weights it heavily.
    const priceIndex = (m.inputCost + m.outputCost * 3) / 40;
    score -= priceIndex * budgetBias * 2;
    if (avoidProviders.includes(m.provider)) score -= 1.5;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}
