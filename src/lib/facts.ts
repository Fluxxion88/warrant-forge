// The fact ledger.
//
// Every fact in this system carries a *warrant*: the verbatim sentence from a
// source document that justifies it, checked deterministically by verify.ts.
// A fact whose warrant does not check out is quarantined — it is still visible
// to a human, but `ledger()` will not surface it and therefore the rules engine
// can never read it.
//
// This is the load-bearing invariant of the product. A model may propose any
// fact it likes; it cannot get that fact into a decision without producing a
// quote that actually exists in a document we hold.

import { verifyCitation, type SourceDoc, type Verdict } from "./verify";

export type FactKey = string;
export type FactValue = number | string | boolean;

/** A fact justified by a verbatim quotation from a source document. */
export interface QuoteWarrant {
  kind: "quote";
  /** Document the model cited. */
  document: string;
  /** Verbatim excerpt the model claims supports this fact. */
  quote: string;
  verdict: Verdict;
  /** 0–1 match strength, for diagnostics. */
  similarity: number;
  /** Where the quote actually sits, for click-through to the source. */
  span?: { start: number; end: number };
  /** Document the quote was really found in, when it differs from `document`. */
  matchedDocument?: string;
  note: string;
}

/**
 * A fact justified by deterministic computation over other facts — a total, a
 * count, an elapsed-days figure. No model performs arithmetic in this system:
 * models extract individually-quoted values, and code adds them up under a
 * cited statutory rule. The inputs are recorded so the sum is as auditable as
 * the quotes underneath it.
 */
export interface DerivedWarrant {
  kind: "derivation";
  /** Human-readable formula, e.g. "sum of included assets − exclusions". */
  formula: string;
  inputs: FactKey[];
  /** The authority that says the computation is the right one to perform. */
  authority?: { citation: string; sourceUrl: string };
  note: string;
}

/**
 * A fact taken from a structured system of record rather than a document.
 *
 * When a case-management system exports an estate as JSON, there is no sentence
 * to quote — the provenance is "field `fiduciary.name.full` of record
 * `estate-05` in system `alix-estate-manager`". That is still a checkable
 * claim, and `admitRecord` checks it: it re-reads the path out of the record
 * and confirms the value actually sits there. A fact whose path is absent, or
 * whose value disagrees with the record, is quarantined exactly like a bad
 * quote.
 *
 * The invariant is unchanged. What varies is the kind of evidence, not whether
 * evidence is required — and a system of record is evidence of a different sort
 * from a death certificate. Recording which sort it was matters downstream: a
 * value keyed in by a paralegal at intake carries different weight from one
 * read off the certificate, and a reviewer is entitled to see the difference.
 */
export interface RecordWarrant {
  kind: "record";
  /** The system the record came from, e.g. "alix-estate-manager". */
  system: string;
  /** Identifier of the record within that system. */
  recordId: string;
  /** Dotted path to the field, e.g. "fiduciary.name.full". */
  path: string;
  /** The value as it sat in the record, before coercion. */
  raw: string;
  verdict: "verified" | "path_missing" | "value_mismatch";
  note: string;
}

export type Warrant = QuoteWarrant | DerivedWarrant | RecordWarrant;

/** What an extractor proposes, before it has earned its place in the ledger. */
export interface FactCandidate {
  key: FactKey;
  label: string;
  value: FactValue;
  unit?: string;
  /** The date this value is true as of — a balance is only true on a date. */
  asOf?: string;
  document: string;
  quote: string;
  /** Model that proposed it, for the audit trail. */
  extractedBy?: string;
}

export type FactStatus = "verified" | "quarantined";

export interface Fact {
  id: string;
  key: FactKey;
  label: string;
  value: FactValue;
  unit?: string;
  asOf?: string;
  warrant: Warrant;
  extractedBy: string;
  status: FactStatus;
  /** Id of the fact this one replaces, when a later document corrects it. */
  supersedes?: string;
  recordedAt: number;
}

/**
 * A warrant earns "verified" only on an exact quotation. A `loose` match — the
 * quote turned up in a different document, or only partially — is deliberately
 * NOT good enough to enter a decision. In a domain where being wrong costs the
 * family six months, "probably said something like this" is not evidence.
 */
export function statusFor(verdict: Verdict): FactStatus {
  return verdict === "verified" ? "verified" : "quarantined";
}

let seq = 0;
function nextId(key: FactKey): string {
  seq += 1;
  return `${key}#${seq}`;
}

/** Reset the id counter. Tests only. */
export function _resetIds(): void {
  seq = 0;
}

/**
 * Put a proposed fact through verification and record it. Nothing is rejected
 * outright — a quarantined fact is kept so a reviewer can see exactly what the
 * model tried to assert and on what basis.
 */
export function admit(
  candidate: FactCandidate,
  docs: SourceDoc[],
  opts: { now?: number; supersedes?: string } = {},
): Fact {
  const result = verifyCitation({ document: candidate.document, quote: candidate.quote }, docs);
  const warrant: Warrant = {
    kind: "quote",
    document: candidate.document,
    quote: candidate.quote,
    verdict: result.verdict,
    similarity: result.similarity,
    span: result.span,
    matchedDocument: result.matchedDocument,
    note: result.note,
  };
  return {
    id: nextId(candidate.key),
    key: candidate.key,
    label: candidate.label,
    value: candidate.value,
    unit: candidate.unit,
    asOf: candidate.asOf,
    warrant,
    extractedBy: candidate.extractedBy ?? "unknown",
    status: statusFor(result.verdict),
    supersedes: opts.supersedes,
    recordedAt: opts.now ?? 0,
  };
}

export function admitAll(
  candidates: FactCandidate[],
  docs: SourceDoc[],
  opts: { now?: number } = {},
): Fact[] {
  return candidates.map((c) => admit(c, docs, opts));
}

/**
 * Record a fact computed from other facts. Callers must derive only from the
 * verified ledger, which is why a derived fact is admitted as verified: its
 * trustworthiness is inherited from its inputs plus the determinism of the
 * computation. `inputs` makes that inheritance explicit and auditable.
 */
export function derived(
  spec: {
    key: FactKey;
    label: string;
    value: FactValue;
    unit?: string;
    asOf?: string;
    formula: string;
    inputs: FactKey[];
    authority?: { citation: string; sourceUrl: string };
    note?: string;
  },
  opts: { now?: number; supersedes?: string } = {},
): Fact {
  return {
    id: nextId(spec.key),
    key: spec.key,
    label: spec.label,
    value: spec.value,
    unit: spec.unit,
    asOf: spec.asOf,
    warrant: {
      kind: "derivation",
      formula: spec.formula,
      inputs: spec.inputs,
      authority: spec.authority,
      note: spec.note ?? "Computed deterministically from verified facts.",
    },
    extractedBy: "derivation",
    status: "verified",
    supersedes: opts.supersedes,
    recordedAt: opts.now ?? 0,
  };
}

/**
 * Read a dotted path out of a nested object. Returns `undefined` for a path
 * that does not exist, which is distinct from a path that exists and holds
 * null — the difference decides whether a fact is quarantined or simply absent.
 */
export function readPath(source: unknown, path: string): unknown {
  let node: unknown = source;
  for (const seg of path.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    const idx = Number(seg);
    if (Array.isArray(node)) {
      if (!Number.isInteger(idx)) return undefined;
      node = node[idx];
    } else {
      if (!(seg in (node as Record<string, unknown>))) return undefined;
      node = (node as Record<string, unknown>)[seg];
    }
  }
  return node;
}

/**
 * Admit a fact sourced from a structured record, checking the path against the
 * record itself. The check is the point: an importer that drifts out of sync
 * with an upstream schema produces quarantined facts rather than silent
 * fabrications, and the reviewer sees which paths went missing.
 */
export function admitRecord(
  spec: {
    key: FactKey;
    label: string;
    value: FactValue;
    unit?: string;
    asOf?: string;
    system: string;
    recordId: string;
    path: string;
  },
  record: unknown,
  opts: { now?: number; supersedes?: string } = {},
): Fact {
  const actual = readPath(record, spec.path);

  let verdict: RecordWarrant["verdict"];
  let note: string;
  if (actual === undefined) {
    verdict = "path_missing";
    note = `No path "${spec.path}" in record ${spec.recordId}.`;
  } else if (!sameScalar(actual, spec.value)) {
    verdict = "value_mismatch";
    note = `Record holds ${JSON.stringify(actual)} at "${spec.path}", not ${JSON.stringify(spec.value)}.`;
  } else {
    verdict = "verified";
    note = `Read from "${spec.path}" of record ${spec.recordId}.`;
  }

  return {
    id: nextId(spec.key),
    key: spec.key,
    label: spec.label,
    value: spec.value,
    unit: spec.unit,
    asOf: spec.asOf,
    warrant: {
      kind: "record",
      system: spec.system,
      recordId: spec.recordId,
      path: spec.path,
      raw: actual === undefined ? "" : String(actual),
      verdict,
      note,
    },
    extractedBy: spec.system,
    status: verdict === "verified" ? "verified" : "quarantined",
    supersedes: opts.supersedes,
    recordedAt: opts.now ?? 0,
  };
}

/**
 * Compare a record value to the fact value it was turned into. Importers
 * legitimately coerce — "173000.0" becomes 173000, an ALL-CAPS city keeps its
 * casing — so the comparison tolerates numeric and case differences while still
 * catching a value that simply is not what the record says.
 */
function sameScalar(actual: unknown, claimed: FactValue): boolean {
  if (actual === claimed) return true;
  if (typeof claimed === "number" && typeof actual === "number") {
    return Math.abs(actual - claimed) < 0.005;
  }
  if (typeof claimed === "boolean") return actual === claimed;
  return String(actual).trim().toLowerCase() === String(claimed).trim().toLowerCase();
}

/**
 * The current, decision-visible view of the world: verified facts only, latest
 * value per key. Superseded facts drop out, so a corrected appraisal replaces
 * the stale one rather than competing with it.
 */
export function ledger(facts: Fact[]): Map<FactKey, Fact> {
  const superseded = new Set(facts.map((f) => f.supersedes).filter(Boolean) as string[]);
  const out = new Map<FactKey, Fact>();
  for (const f of facts) {
    if (f.status !== "verified") continue;
    if (superseded.has(f.id)) continue;
    const held = out.get(f.key);
    if (!held || f.recordedAt >= held.recordedAt) out.set(f.key, f);
  }
  return out;
}

/** Facts the model asserted but could not substantiate. Shown, never used. */
export function quarantined(facts: Fact[]): Fact[] {
  return facts.filter((f) => f.status !== "verified");
}

export interface LedgerIntegrity {
  proposed: number;
  verified: number;
  quarantined: number;
  /** Share of proposed facts backed by an exact quotation. */
  integrityScore: number;
}

export function integrity(facts: Fact[]): LedgerIntegrity {
  // Only asserted facts count — those whose warrant could have failed. Derived
  // facts inherit their trust from their inputs, so including them would
  // flatter the score. Record-sourced facts do count: a path that has gone
  // missing upstream is exactly the kind of silent rot this number exists to
  // surface.
  const claimed = facts.filter((f) => f.warrant.kind === "quote" || f.warrant.kind === "record");
  const proposed = claimed.length;
  const verified = claimed.filter((f) => f.status === "verified").length;
  return {
    proposed,
    verified,
    quarantined: proposed - verified,
    integrityScore: proposed === 0 ? 1 : verified / proposed,
  };
}

/** Convenience for the rules engine: plain key → value of verified facts. */
export function values(facts: Fact[]): Record<FactKey, FactValue> {
  const out: Record<FactKey, FactValue> = {};
  for (const [k, f] of ledger(facts)) out[k] = f.value;
  return out;
}
