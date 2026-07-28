// Entity resolution.
//
// Soren's question: "how do you know this bank account is actually related to
// the one bank account that we found on the will? What if it's an offshore
// account?"
//
// The same asset appears under different descriptions in different documents.
// The will says "my accounts at Wells Fargo Bank". A statement says "MARGARET E
// HOYT, account ending 4471". A call transcript says "her checking account".
// Deciding those are one thing is a judgement, and getting it wrong costs in
// both directions: merging two accounts loses one of them from the inventory,
// and failing to merge double-counts the estate and can push it over a
// threshold it never crossed.
//
// So this module proposes, and does not decide. Matching is deterministic and
// evidence-bearing: an exact account-number tail plus an institution match is a
// strong proposal; a name similarity alone is a weak one. Anything short of
// conclusive is surfaced for a human, because the cost of a wrong merge is
// asymmetric and the machine has no way to know which side it is wrong on.

import { ledger, type Fact, type FactKey } from "./facts";

export type MatchStrength = "conclusive" | "strong" | "weak" | "conflicting";

export interface MatchSignal {
  kind: "account_tail" | "institution" | "holder_name" | "value" | "asset_class";
  agrees: boolean;
  detail: string;
}

export interface EntityProposal {
  /** Fact-key prefixes of the two asset records, e.g. "asset.checking". */
  left: string;
  right: string;
  strength: MatchStrength;
  signals: MatchSignal[];
  /** What a human should do about it. */
  recommendation: string;
  /** Facts that support the proposal, for the audit trail. */
  evidence: FactKey[];
}

/** Normalise an institution name so "Wells Fargo Bank, N.A." matches "Wells Fargo". */
const INSTITUTION_NOISE = new Set([
  "bank", "na", "inc", "llc", "co", "corp", "corporation", "company",
  "and", "the", "of", "usa", "us", "trust", "services", "sa", "ag", "plc",
]);

/**
 * Token-based rather than a chain of regexes, because punctuation stripping
 * turns "N.A." into two single-letter tokens and "&" into a stranded one —
 * neither of which a \b…\b stopword pass catches.
 */
export function normaliseInstitution(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !INSTITUTION_NOISE.has(t))
    .join(" ")
    .trim();
}

/** Last four digits of any account-like identifier. */
export function accountTail(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

/** Compare person names tolerantly: "MARGARET E HOYT" vs "Margaret Ellen Hoyt". */
export function nameAgrees(a: string, b: string): boolean {
  const parts = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  const pa = parts(a);
  const pb = parts(b);
  if (pa.length === 0 || pb.length === 0) return false;
  // Surnames must match outright; middle names may be initials or absent.
  if (pa[pa.length - 1] !== pb[pb.length - 1]) return false;
  if (pa[0] !== pb[0]) return false;
  const mid = (p: string[]) => p.slice(1, -1).map((x) => x[0]).join("");
  const ma = mid(pa);
  const mb = mid(pb);
  return ma === "" || mb === "" || ma === mb;
}

interface AssetView {
  prefix: string;
  keys: FactKey[];
  institution?: string;
  identifier?: string;
  holder?: string;
  value?: number;
}

/** Group asset facts by their `asset.<id>` prefix. */
function assetViews(facts: Fact[]): AssetView[] {
  const current = ledger(facts);
  const byPrefix = new Map<string, AssetView>();

  for (const [key, fact] of current) {
    const m = /^(asset\.[^.]+)\.(.+)$/.exec(key);
    if (!m) continue;
    const [, prefix, attr] = m;
    const view = byPrefix.get(prefix) ?? { prefix, keys: [] };
    view.keys.push(key);

    if (attr === "value" && typeof fact.value === "number") view.value = fact.value;
    if (typeof fact.value === "string") {
      if (attr === "institution") view.institution = fact.value;
      if (attr === "identifier" || attr === "account_number") view.identifier = fact.value;
      if (attr === "holder") view.holder = fact.value;
    }
    // The label often carries the institution and tail even when no dedicated
    // fact exists, e.g. "Wells Fargo checking ending 4471".
    if (attr === "value") {
      if (!view.institution) view.institution = fact.label;
      if (!view.identifier) view.identifier = fact.label;
    }
    byPrefix.set(prefix, view);
  }
  return [...byPrefix.values()];
}

function compare(a: AssetView, b: AssetView): { signals: MatchSignal[]; strength: MatchStrength } {
  const signals: MatchSignal[] = [];

  const ta = a.identifier ? accountTail(a.identifier) : null;
  const tb = b.identifier ? accountTail(b.identifier) : null;
  if (ta && tb) {
    signals.push({
      kind: "account_tail",
      agrees: ta === tb,
      detail: ta === tb ? `both end ${ta}` : `${ta} vs ${tb}`,
    });
  }

  if (a.institution && b.institution) {
    const na = normaliseInstitution(a.institution);
    const nb = normaliseInstitution(b.institution);
    const overlap = na.split(" ").filter((w) => w.length > 2 && nb.includes(w));
    signals.push({
      kind: "institution",
      agrees: overlap.length > 0,
      detail: overlap.length > 0 ? `share "${overlap.join(" ")}"` : `"${na}" vs "${nb}"`,
    });
  }

  if (a.holder && b.holder) {
    const agrees = nameAgrees(a.holder, b.holder);
    signals.push({
      kind: "holder_name",
      agrees,
      detail: agrees ? "holder names agree" : `${a.holder} vs ${b.holder}`,
    });
  }

  if (a.value !== undefined && b.value !== undefined) {
    const agrees = a.value === b.value;
    signals.push({
      kind: "value",
      agrees,
      detail: agrees
        ? `both ${a.value.toLocaleString("en-US")}`
        : `${a.value.toLocaleString("en-US")} vs ${b.value.toLocaleString("en-US")}`,
    });
  }

  const tailAgrees = signals.find((s) => s.kind === "account_tail")?.agrees;
  const tailConflicts = tailAgrees === false;
  const instAgrees = signals.find((s) => s.kind === "institution")?.agrees === true;
  const agreeing = signals.filter((s) => s.agrees).length;

  // A differing account tail is decisive against a merge, whatever else agrees.
  let strength: MatchStrength;
  if (tailConflicts) strength = "conflicting";
  else if (tailAgrees && instAgrees) strength = "conclusive";
  else if (tailAgrees || (instAgrees && agreeing >= 2)) strength = "strong";
  else strength = "weak";

  return { signals, strength };
}

const RECOMMENDATION: Record<MatchStrength, string> = {
  conclusive:
    "Safe to treat as one asset. Account tail and institution both agree; record the merge with this evidence.",
  strong:
    "Probably one asset, but confirm before merging — a wrong merge silently drops an asset from the inventory.",
  weak:
    "Insufficient evidence either way. Obtain the account number or an institution statement before deciding.",
  conflicting:
    "Do not merge. The account identifiers differ, so these are two assets and the estate total must count both.",
};

/**
 * Propose merges across the asset ledger.
 *
 * Nothing is merged automatically. Double-counting inflates the estate and can
 * push it across a procedural threshold it never actually crossed; under-counting
 * loses an asset entirely. Both are worse than asking.
 */
export function proposeMerges(facts: Fact[]): EntityProposal[] {
  const views = assetViews(facts);
  const out: EntityProposal[] = [];

  for (let i = 0; i < views.length; i++) {
    for (let j = i + 1; j < views.length; j++) {
      const a = views[i];
      const b = views[j];
      const { signals, strength } = compare(a, b);
      // Only surface pairs with some positive signal, or an outright conflict.
      const worthShowing = strength === "conflicting" || signals.some((s) => s.agrees);
      if (!worthShowing || signals.length === 0) continue;
      if (strength === "weak" && !signals.some((s) => s.agrees)) continue;

      out.push({
        left: a.prefix,
        right: b.prefix,
        strength,
        signals,
        recommendation: RECOMMENDATION[strength],
        evidence: [...a.keys, ...b.keys].sort(),
      });
    }
  }

  const order: Record<MatchStrength, number> = {
    conflicting: 0,
    conclusive: 1,
    strong: 2,
    weak: 3,
  };
  return out.sort((x, y) => order[x.strength] - order[y.strength]);
}

export interface EntitySummary {
  distinctAssets: number;
  proposals: number;
  needingReview: number;
}

export function summarise(facts: Fact[], proposals: EntityProposal[]): EntitySummary {
  return {
    distinctAssets: assetViews(facts).length,
    proposals: proposals.length,
    needingReview: proposals.filter((p) => p.strength === "strong" || p.strength === "weak").length,
  };
}
