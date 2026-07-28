// Deterministic derivation.
//
// The gross value of a decedent's estate decides which procedural road the
// family walks down, and it is not simply "add up everything they owned".
// California excludes whole categories — joint tenancy, assets with a named
// beneficiary, property held in a funded trust, vehicles, property passing to
// a surviving spouse — before the threshold test is applied.
//
// Two things follow, and both are deliberate:
//
//   1. No model performs this arithmetic. Models extract individual asset
//      values, each with its own quotation. This module adds them up.
//   2. The exclusion list is data, not code, so it can carry a citation and be
//      corrected without a redeploy.
//
// The output is an ordinary Fact with a derivation warrant, so a total is as
// auditable as the quotes beneath it.

import { derived, ledger, type Fact, type FactKey, type FactValue } from "./facts";

export interface ExclusionRule {
  id: string;
  /** Asset property that triggers exclusion, e.g. "held_in_trust". */
  flag: string;
  label: string;
  citation: string;
  sourceUrl: string;
}

/**
 * An asset as assembled from several facts. Each field traces back to its own
 * quoted fact — `valueKey` is the fact that supplied the number.
 */
export interface AssetView {
  id: string;
  label: string;
  value: number;
  valueKey: FactKey;
  /** Exclusion flags currently true for this asset, with the fact key each came from. */
  flags: { flag: string; sourceKey: FactKey }[];
}

export interface DerivationResult {
  /** The derived total fact, ready to admit into the ledger. */
  fact: Fact;
  included: AssetView[];
  excluded: { asset: AssetView; rule: ExclusionRule; sourceKey: FactKey }[];
  total: number;
}

/**
 * Collect assets out of the fact ledger. Asset facts follow the convention
 * `asset.<id>.value` for the amount and `asset.<id>.<flag>` for booleans, so
 * new asset types need no code change.
 */
export function assetsFrom(facts: Fact[]): AssetView[] {
  const current = ledger(facts);
  const byId = new Map<string, AssetView>();

  for (const [key, fact] of current) {
    const m = /^asset\.([^.]+)\.value$/.exec(key);
    if (!m || typeof fact.value !== "number") continue;
    byId.set(m[1], {
      id: m[1],
      label: fact.label,
      value: fact.value,
      valueKey: key,
      flags: [],
    });
  }

  for (const [key, fact] of current) {
    const m = /^asset\.([^.]+)\.([^.]+)$/.exec(key);
    if (!m || m[2] === "value") continue;
    const asset = byId.get(m[1]);
    if (!asset) continue;
    if (fact.value === true) asset.flags.push({ flag: m[2], sourceKey: key });
  }

  return [...byId.values()].sort((a, b) => b.value - a.value);
}

/**
 * Apply the exclusion list and sum what remains. An asset is excluded if any
 * exclusion rule's flag is set on it; the first matching rule is reported as
 * the reason, so the UI can say *why* a $740,000 house did not count.
 */
export function grossProbateableValue(
  facts: Fact[],
  exclusions: ExclusionRule[],
  opts: { now?: number; supersedes?: string; authority?: { citation: string; sourceUrl: string } } = {},
): DerivationResult {
  const assets = assetsFrom(facts);
  const included: AssetView[] = [];
  const excluded: { asset: AssetView; rule: ExclusionRule; sourceKey: FactKey }[] = [];

  for (const asset of assets) {
    const hit = exclusions
      .map((rule) => {
        const f = asset.flags.find((x) => x.flag === rule.flag);
        return f ? { rule, sourceKey: f.sourceKey } : null;
      })
      .find(Boolean);
    if (hit) excluded.push({ asset, rule: hit.rule, sourceKey: hit.sourceKey });
    else included.push(asset);
  }

  const total = included.reduce((sum, a) => sum + a.value, 0);
  const inputs: FactKey[] = [
    ...included.map((a) => a.valueKey),
    ...excluded.map((e) => e.sourceKey),
  ].sort();

  const formula =
    included.length === 0
      ? "no includable assets"
      : included.map((a) => `${a.label} ${a.value.toLocaleString("en-US")}`).join(" + ");

  return {
    fact: derived(
      {
        key: "estate.gross_probateable_value",
        label: "Gross probateable value",
        value: total,
        unit: "USD",
        formula,
        inputs,
        authority: opts.authority,
        note:
          excluded.length === 0
            ? "Sum of all assets; no statutory exclusions applied."
            : `Sum of ${included.length} includable asset(s); ${excluded.length} excluded by statute.`,
      },
      { now: opts.now, supersedes: opts.supersedes },
    ),
    included,
    excluded,
    total,
  };
}

/** Whole-day difference between two ISO dates. Used for statutory waiting periods. */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor((b - a) / 86_400_000);
}

/**
 * Facts that exist only as a function of other facts plus the current date.
 * Recomputed on every run so a waiting period elapsing is itself a change the
 * reactor can notice.
 */
export function elapsedFacts(facts: Fact[], asOfIso: string, opts: { now?: number } = {}): Fact[] {
  const current = ledger(facts);
  const dod = current.get("decedent.date_of_death");
  if (!dod || typeof dod.value !== "string") return [];
  const days = daysBetween(dod.value, asOfIso);
  return [
    derived(
      {
        key: "estate.days_since_death",
        label: "Days since date of death",
        value: days,
        unit: "days",
        formula: `${asOfIso} − ${dod.value}`,
        inputs: ["decedent.date_of_death"],
        note: "Recomputed each run; statutory waiting periods depend on it.",
      },
      { now: opts.now },
    ),
  ];
}

/** Everything derivable, in dependency order. */
export function deriveAll(
  facts: Fact[],
  exclusions: ExclusionRule[],
  asOfIso: string,
  opts: { now?: number; authority?: { citation: string; sourceUrl: string } } = {},
): { facts: Fact[]; derivation: DerivationResult } {
  const elapsed = elapsedFacts(facts, asOfIso, opts);
  const derivation = grossProbateableValue([...facts, ...elapsed], exclusions, opts);
  return { facts: [...elapsed, derivation.fact], derivation };
}

export type { FactValue };
