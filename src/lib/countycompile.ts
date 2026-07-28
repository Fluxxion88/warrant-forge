// Compiling a county's published rules into the rule pack.
//
// This is the answer to "store every county's requirements and recall them".
// The instinct is right — jurisdiction fragmentation is the real problem, and
// 3,000 counties is not a thing you handle by reading a website per matter. The
// mechanism matters though, and a vector store is the wrong one:
//
//   Retrieval is similarity; filing requirements are lookup. You do not want
//   "documents like San Mateo's fee schedule". You want San Mateo's fee, and a
//   nearest-neighbour that returns Santa Clara's is wrong in a way that looks
//   right and produces a rejected filing.
//
//   Retrieved text puts a model back in the decision path. The architecture
//   says models extract and rules decide. "Retrieve chunks, ask the model" is a
//   model deciding, from text nobody verified, with no warrant on the answer.
//
//   Embeddings have nowhere to put an effective date. The whole § 13100 problem
//   — every model still says $184,500 because that is what the training data
//   says — is a staleness problem, and a vector of a scraped page carries no
//   retrievedAt, no effectiveFrom, and no way to diff last month against this
//   month.
//
// So a county is compiled, not embedded: into `CountyProfile` data with a
// citation, a source URL, an effective date and a retrieval date. Lookup is a
// table read — deterministic, zero tokens at decision time, diffable when a
// court changes its rules, and auditable line by line.
//
// The model's job is *building* the pack, not querying it. It reads the court's
// published text and proposes profile fields, and — exactly as with facts and
// with field maps — it must quote the source verbatim for each one. This module
// verifies those quotes with the same deterministic matcher that verifies
// everything else. A proposal whose quote is not in the source is refused, so
// the model cannot furnish a county with plausible fees it invented.

import { verifyCitation, type SourceDoc } from "./verify";
import type { LocalForm } from "../rules/ca-counties";

/** One claim about a county, with the sentence that supports it. */
export interface CountyClaim {
  /** Dotted field of CountyProfile, e.g. "firstPaperFeeUsd" or "efiling.mandatoryFor". */
  field: string;
  value: string;
  /** Verbatim text from the source that states this. */
  quote: string;
  /** Which supplied document it came from. */
  document: string;
}

export type ClaimVerdict = "verified" | "unsupported" | "unknown_document" | "bad_field";

export interface VerifiedClaim extends CountyClaim {
  verdict: ClaimVerdict;
  similarity: number;
  note: string;
}

/**
 * Fields a compiled county may set.
 *
 * An allowlist, so a model cannot invent a profile shape. Anything outside it
 * is refused rather than quietly attached to the object, which is how a schema
 * drifts without anybody deciding to change it.
 */
export const COUNTY_FIELDS = [
  "court",
  "firstPaperFeeUsd",
  "localRulesEffective",
  "obligations",
  "examiner",
  "tentativeRulings",
  "efiling.mandatoryFor",
  "efiling.since",
  "efiling.exclusions",
  "localForm.code",
  "localForm.title",
  "localForm.whenRequired",
] as const;

export function verifyClaim(claim: CountyClaim, docs: SourceDoc[]): VerifiedClaim {
  if (!COUNTY_FIELDS.includes(claim.field as (typeof COUNTY_FIELDS)[number])) {
    return {
      ...claim,
      verdict: "bad_field",
      similarity: 0,
      note: `"${claim.field}" is not a compilable county field.`,
    };
  }
  if (!docs.some((d) => d.name === claim.document)) {
    return {
      ...claim,
      verdict: "unknown_document",
      similarity: 0,
      note: `No supplied source named "${claim.document}".`,
    };
  }

  const result = verifyCitation({ document: claim.document, quote: claim.quote }, docs);
  // Only an exact locate counts. A fee is a number on a page; "roughly this
  // was said somewhere" is not a basis for telling somebody what to pay.
  const ok = result.verdict === "verified";
  return {
    ...claim,
    verdict: ok ? "verified" : "unsupported",
    similarity: result.similarity,
    note: ok ? "Quote located in the source." : result.note,
  };
}

export interface CompiledCounty {
  name: string;
  /** Only fields whose quote was located. */
  fields: Record<string, string>;
  localForms: LocalForm[];
  claims: VerifiedClaim[];
  rejected: VerifiedClaim[];
  /** Sources read, so the profile can be re-verified later. */
  sources: { name: string; url?: string; retrievedAt: string }[];
  /**
   * Fields the pack wants and the sources did not answer. Named, because a
   * county compiled from a page that never mentions e-filing must not read as
   * a county with no e-filing requirement.
   */
  silentOn: string[];
}

export function compileCounty(
  name: string,
  claims: CountyClaim[],
  docs: SourceDoc[],
  sources: { name: string; url?: string; retrievedAt: string }[],
): CompiledCounty {
  const checked = claims.map((c) => verifyClaim(c, docs));
  const good = checked.filter((c) => c.verdict === "verified");

  const fields: Record<string, string> = {};
  const localForms: LocalForm[] = [];
  let pending: Partial<LocalForm> = {};

  for (const c of good) {
    if (c.field.startsWith("localForm.")) {
      const key = c.field.split(".")[1] as keyof LocalForm;
      pending[key] = c.value;
      if (pending.code && pending.title && pending.whenRequired) {
        localForms.push(pending as LocalForm);
        pending = {};
      }
      continue;
    }
    fields[c.field] = c.value;
  }

  const answered = new Set(Object.keys(fields));
  const silentOn = COUNTY_FIELDS.filter(
    (f) => !f.startsWith("localForm.") && !answered.has(f),
  );

  return {
    name,
    fields,
    localForms,
    claims: checked,
    rejected: checked.filter((c) => c.verdict !== "verified"),
    sources,
    silentOn,
  };
}

export const COUNTY_SYSTEM = `You read a California superior court's own published pages and turn them into
structured data about how that court handles probate.

For each thing you can establish, emit one block:

<<<CLAIM
field: <one of the allowed fields, exactly>
value: <the value, plainly — a number with no dollar sign, a date as YYYY-MM-DD>
document: <the exact name of the source you read it in>
quote: <the sentence from that source that states it, copied verbatim>
CLAIM>>>

Allowed fields:

  court                     Full name of the court and its probate division.
  firstPaperFeeUsd          First-paper probate filing fee, digits only.
  localRulesEffective       Date the local rules you read took effect.
  obligations               One block per extra obligation beyond the statewide
                            Judicial Council packet. Plain sentence.
  examiner                  How the court pre-reviews petitions before hearing.
  tentativeRulings          How and when tentative rulings are published.
  efiling.mandatoryFor      One of: attorneys, represented parties, none.
  efiling.since             Date e-filing became mandatory.
  efiling.exclusions        One block per document type excluded from e-filing.
  localForm.code            A local form's code, e.g. "PR-13".
  localForm.title           That form's title.
  localForm.whenRequired    When that form must be filed.

Emit localForm.code, localForm.title and localForm.whenRequired consecutively
for each form, so they group correctly.

The rules that matter:

1. The quote must be text you were actually given, copied character for
   character. It is checked against the source and a claim whose quote cannot
   be found is discarded. Do not paraphrase, do not tidy, do not reconstruct
   what the page probably says.

2. Emit nothing for a field the sources do not address. A county whose page
   never mentions e-filing is a county we do not know about — which is recorded
   as such — and is not a county with no e-filing requirement. Guessing here
   produces a confident wrong answer about a court somebody is about to file in.

3. Fees change and pages go stale. Quote the fee exactly as printed, including
   the effective date if one is given. If the page shows a fee schedule with
   several amounts, take the first-paper petition fee and no other.

4. Do not carry anything over from another county, from your training data, or
   from what is typical. Only what these sources say.`;

const BLOCK = /<<<CLAIM\s*([\s\S]*?)CLAIM>>>/g;

export function parseClaims(text: string): CountyClaim[] {
  const out: CountyClaim[] = [];
  for (const m of text.matchAll(BLOCK)) {
    const body = m[1];
    const get = (k: string): string => {
      const re = new RegExp(`^${k}:[ \\t]*([\\s\\S]*?)(?=\\n[a-z]+:|$)`, "mi");
      return (body.match(re)?.[1] ?? "").trim();
    };
    const field = get("field");
    const quote = get("quote");
    if (!field || !quote) continue;
    out.push({ field, value: get("value"), quote, document: get("document") });
  }
  return out;
}

export function compileReport(c: CompiledCounty): string {
  const L = [`${c.name} — ${Object.keys(c.fields).length} fields, ${c.localForms.length} local forms`];
  for (const [k, v] of Object.entries(c.fields)) L.push(`  ${k.padEnd(24)} ${v}`);
  for (const f of c.localForms) L.push(`  form ${f.code.padEnd(19)} ${f.title}`);
  if (c.rejected.length) {
    L.push(`  REFUSED (${c.rejected.length}):`);
    for (const r of c.rejected) L.push(`    ${r.verdict.padEnd(18)} ${r.field} — ${r.note.slice(0, 90)}`);
  }
  if (c.silentOn.length) L.push(`  sources silent on: ${c.silentOn.join(", ")}`);
  return L.join("\n");
}
