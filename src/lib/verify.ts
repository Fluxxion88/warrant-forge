// Citation verification. Models are asked to quote their source verbatim; this
// module checks the quote actually appears in the cited document. That check is
// deterministic — it does not ask a model whether a model was honest — so a
// fabricated quote is caught with certainty rather than probability.

export interface Citation {
  /** Document name as the analyst cited it. */
  document: string;
  /** Verbatim excerpt the analyst claims supports the finding. */
  quote: string;
}

export type Verdict =
  | "verified" // quote found in the cited document
  | "loose" // quote found, but in a different document than cited
  | "unsupported" // quote not found in any document
  | "no_citation"; // analyst supplied no citation at all

export interface VerificationResult {
  verdict: Verdict;
  /** Document the quote was actually located in, when found. */
  matchedDocument?: string;
  /** 0–1 similarity of the best match, for diagnostics. */
  similarity: number;
  note: string;
  /** Character offsets of the quote in the matched document, for click-through. */
  span?: { start: number; end: number };
}

/**
 * Locate a quote in a document and return its character range, so a reviewer
 * can be taken to the exact passage. Falls back to a normalised search when the
 * raw text differs by whitespace or quote characters.
 */
export function locateQuote(quote: string, document: string): { start: number; end: number } | null {
  const direct = document.indexOf(quote.trim());
  if (direct !== -1) return { start: direct, end: direct + quote.trim().length };

  // Normalised search: walk the document building a normalised projection and
  // remember where each normalised character came from in the original.
  const target = normalise(quote);
  if (!target) return null;
  const map: number[] = [];
  let projected = "";
  let lastWasSpace = false;
  for (let i = 0; i < document.length; i++) {
    const ch = normalise(document[i]);
    if (ch === "") {
      // Character dropped by normalisation; treat as a separator.
      if (!lastWasSpace && projected.length > 0) {
        projected += " ";
        map.push(i);
        lastWasSpace = true;
      }
      continue;
    }
    if (ch === " ") {
      if (lastWasSpace || projected.length === 0) continue;
      lastWasSpace = true;
    } else {
      lastWasSpace = false;
    }
    projected += ch;
    map.push(i);
  }
  const at = projected.indexOf(target);
  if (at === -1) return null;
  const start = map[at] ?? 0;
  const endIdx = Math.min(at + target.length - 1, map.length - 1);
  return { start, end: (map[endIdx] ?? start) + 1 };
}

export interface SourceDoc {
  name: string;
  content: string;
}

/** Collapse whitespace, drop punctuation and case so that a faithful quote
 *  still matches when the model normalises spacing or smart quotes. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’“”]/g, (c) => (c === "‘" || c === "’" ? "'" : '"'))
    .replace(/[^\w\s'".,%$-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  return normalise(text).split(" ").filter(Boolean);
}

/**
 * Fraction of the quote's token n-grams present in the document. Exact
 * containment scores 1. Paraphrase degrades smoothly, so the caller can
 * distinguish "quoted faithfully" from "roughly recalled".
 */
export function coverage(quote: string, document: string): number {
  const q = tokens(quote);
  const d = normalise(document);
  if (q.length === 0) return 0;
  if (d.includes(normalise(quote))) return 1;

  // Slide a 4-gram window; short quotes fall back to bigrams.
  const n = q.length >= 8 ? 4 : 2;
  if (q.length < n) return d.includes(q.join(" ")) ? 1 : 0;
  let hits = 0;
  let total = 0;
  for (let i = 0; i + n <= q.length; i++) {
    total += 1;
    if (d.includes(q.slice(i, i + n).join(" "))) hits += 1;
  }
  return total === 0 ? 0 : hits / total;
}

const VERIFIED_THRESHOLD = 0.85;
const LOOSE_THRESHOLD = 0.6;

/**
 * Tokens carrying a digit — a fee, a threshold, a date, a balance, a form
 * number. In this domain those are the payload of the claim; the prose around
 * them is packaging.
 *
 * n-gram coverage is deliberately tolerant so a faithful quote survives a
 * reflowed line or a smart quote. That tolerance is a hole when the only thing
 * that changed is the number. "The first paper filing fee in a probate
 * proceeding is $435.00" and the same sentence ending $465.00 differ in one
 * token of eleven; with a four-gram window only one of eight windows misses,
 * scoring 0.875 and passing as verified. The sentence is real, the fee is
 * invented, and the estate is told to send the wrong amount to a court.
 *
 * So a quote is only verified if every digit-bearing token in it actually
 * occurs in the document. Substring containment, not token equality, so a model
 * quoting "$435" from a page printing "$435.00" still matches — leniency in the
 * direction that cannot fabricate a value.
 */
function numbersPresent(quote: string, document: string): { ok: boolean; missing: string[] } {
  const doc = normalise(document);
  const missing = tokens(quote)
    .filter((t) => /\d/.test(t))
    .filter((t) => !doc.includes(t));
  return { ok: missing.length === 0, missing };
}

/** Check one citation against the deal's document set. */
export function verifyCitation(citation: Citation, docs: SourceDoc[]): VerificationResult {
  if (!citation.quote || citation.quote.trim().length < 8) {
    return { verdict: "no_citation", similarity: 0, note: "No usable quotation supplied." };
  }

  const cited = docs.find(
    (d) => d.name.toLowerCase().trim() === citation.document.toLowerCase().trim(),
  );

  if (cited) {
    const score = coverage(citation.quote, cited.content);
    const numbers = numbersPresent(citation.quote, cited.content);
    if (score >= VERIFIED_THRESHOLD && !numbers.ok) {
      // The prose matched and a number did not. Never "verified": the number is
      // the claim.
      return {
        verdict: "unsupported",
        matchedDocument: cited.name,
        similarity: score,
        note:
          `The wording matches the cited document but ${numbers.missing.join(", ")} ` +
          `does not appear in it. A quotation that alters a figure is not a quotation.`,
      };
    }
    if (score >= VERIFIED_THRESHOLD) {
      return {
        verdict: "verified",
        matchedDocument: cited.name,
        similarity: score,
        note: "Quotation located in the cited document.",
        span: locateQuote(citation.quote, cited.content) ?? undefined,
      };
    }
  }

  // Cited document is wrong or missing — look across the whole data room.
  let best: { doc: SourceDoc; score: number } | null = null;
  for (const d of docs) {
    const score = coverage(citation.quote, d.content);
    if (!best || score > best.score) best = { doc: d, score };
  }

  if (best && best.score >= VERIFIED_THRESHOLD) {
    return {
      verdict: "loose",
      matchedDocument: best.doc.name,
      similarity: best.score,
      note: `Quotation appears in "${best.doc.name}", not in the cited "${citation.document}".`,
      span: locateQuote(citation.quote, best.doc.content) ?? undefined,
    };
  }
  if (best && best.score >= LOOSE_THRESHOLD) {
    return {
      verdict: "loose",
      matchedDocument: best.doc.name,
      similarity: best.score,
      note: `Only a partial match in "${best.doc.name}" — likely paraphrased rather than quoted.`,
    };
  }
  return {
    verdict: "unsupported",
    similarity: best?.score ?? 0,
    note: "Quotation does not appear in any document in the data room.",
  };
}

export interface VerifiableFinding {
  id: string;
  workstream: string;
  severity: string;
  title: string;
  detail: string;
  citations: Citation[];
}

export interface VerifiedFinding extends VerifiableFinding {
  verification: Verdict;
  verificationNotes: string[];
  /** Where each citation was located, for click-through to the source. */
  locations: { document: string; start: number; end: number }[];
}

/**
 * Verify a finding as a whole. A finding is only "verified" when at least one
 * citation is exact; anything weaker is surfaced rather than silently accepted.
 */
export function verifyFinding(finding: VerifiableFinding, docs: SourceDoc[]): VerifiedFinding {
  if (finding.citations.length === 0) {
    return {
      ...finding,
      verification: "no_citation",
      verificationNotes: ["No source cited — treat as an assertion, not a finding."],
      locations: [],
    };
  }
  const results = finding.citations.map((c) => verifyCitation(c, docs));
  const notes = results
    .map((r, i) => `[${finding.citations[i].document}] ${r.note}`)
    .filter(Boolean);
  const locations = results.flatMap((r) =>
    r.span && r.matchedDocument
      ? [{ document: r.matchedDocument, start: r.span.start, end: r.span.end }]
      : [],
  );

  if (results.some((r) => r.verdict === "verified")) {
    return { ...finding, verification: "verified", verificationNotes: notes, locations };
  }
  if (results.some((r) => r.verdict === "loose")) {
    return { ...finding, verification: "loose", verificationNotes: notes, locations };
  }
  return { ...finding, verification: "unsupported", verificationNotes: notes, locations };
}

export interface VerificationSummary {
  total: number;
  verified: number;
  loose: number;
  unsupported: number;
  noCitation: number;
  /** Share of findings backed by an exact quotation. */
  integrityScore: number;
}

export function summarise(findings: VerifiedFinding[]): VerificationSummary {
  const count = (v: Verdict) => findings.filter((f) => f.verification === v).length;
  const total = findings.length;
  const verified = count("verified");
  return {
    total,
    verified,
    loose: count("loose"),
    unsupported: count("unsupported"),
    noCitation: count("no_citation"),
    integrityScore: total === 0 ? 0 : verified / total,
  };
}
