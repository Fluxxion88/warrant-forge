// Live extraction.
//
// This is the only place a model is asked to do anything, and it is asked to do
// exactly one thing: turn prose into candidate facts, each accompanied by the
// verbatim sentence it relied on. It is not asked to add anything up, decide
// anything, or judge whether a quote is real — code does all three downstream.
//
// The output format is line-oriented blocks rather than JSON. That is a
// deliberate choice: a truncated response still yields every complete block
// before the cut, quotations containing quotes and braces need no escaping, and
// a model that wraps its answer in a markdown fence does not break the parse.
//
// Nothing here trusts the model. Malformed blocks are collected as parse errors
// rather than thrown, and every surviving candidate still has to pass
// verification in facts.ts before it can reach a decision.

import type { FactCandidate, FactValue } from "./facts";
import { fenceDocument, UNTRUSTED_CONTENT_RULE } from "./safety";
import type { SourceDoc } from "./verify";

/** The provider call, injected so the pipeline is testable with no network. */
export type CompleteFn = (args: {
  system: string;
  user: string;
  maxTokens: number;
}) => Promise<{ text: string; inputTokens: number; outputTokens: number; model: string }>;

export const FACT_KEY_GUIDE = `
FACT KEY CONVENTIONS — use these exact shapes.

  decedent.full_name              decedent's full legal name
  decedent.date_of_death          ISO date, YYYY-MM-DD
  decedent.place_of_death         free text
  decedent.has_surviving_spouse   true or false
  decedent.ssn                    social security number, if stated

  estate.county                   California county of residence
  estate.petitioner_name          the executor or petitioner
  estate.letters_issued_date      ISO date Letters issued, if stated
  estate.creditor_notice_date     ISO date creditor notice given, if stated

  asset.<id>.value                a number, no currency symbol or commas
  asset.<id>.is_primary_residence true or false
  asset.<id>.held_in_trust        true or false
  asset.<id>.joint_tenancy        true or false
  asset.<id>.has_named_beneficiary true or false
  asset.<id>.registered_vehicle   true or false
  asset.<id>.address              free text
  asset.<id>.institution          free text
  asset.<id>.identifier           account number or last four digits

  <id> is a short stable slug you choose: residence, checking, brokerage,
  vehicle, jewellery, life_policy. Use the SAME id across every fact about the
  same asset.

COMMONLY MISSED — check for these specifically before you finish.
A live run against nine documents found every asset but omitted the executor,
which four downstream court forms require.

  estate.petitioner_name    Whoever the will nominates as executor,
                            personal representative or administrator.
                            Phrases like "I nominate", "I appoint" or
                            "shall serve as executor" identify it.
  decedent.ssn              Any social security number stated anywhere.
  asset.<id>.registered_vehicle  true for any car, boat or mobile home.
  banking.international_wire.beneficiary_account
                            The foreign account number or IBAN on a wire advice.

  tax.schedule_b.foreign_account  true or false
  tax.form_5471.filed             true or false
  tax.form_8938.filed             true or false
  tax.form_3520.filed             true or false
  tax.form_1116.filed             true or false
  banking.international_wire.country
  banking.safe_deposit_box.institution
  advisers.professional.name
  employment.employer.name
  digital.exchange.name
`.trim();

export const EXTRACTION_SYSTEM = `
You extract facts from estate documents for a probate settlement system.

THE ONE RULE THAT MATTERS
Every fact you emit must be accompanied by a quotation copied VERBATIM and
CONTIGUOUSLY from the document you are reading. A downstream system checks each
quotation against the source text by exact match. If your quotation is not
present in the document character for character, the fact is discarded and
counted against you.

Therefore:
- Copy the quotation. Do not retype it, summarise it, tidy it, correct its
  spelling, expand its abbreviations, or change its punctuation.
- Keep it contiguous. Never join two separate sentences with an ellipsis.
- Include enough of the sentence to be unambiguous, but do not pad it out.
- If a fact is true but no single passage states it, DO NOT EMIT IT. A fact you
  cannot quote is worse than a fact you omit.

WHAT NOT TO DO
- Do not compute anything. Never total, sum, subtract or convert. Extract the
  individual figures exactly as printed; other code does the arithmetic.
- Do not infer. If a document mentions a bank but gives no balance, emit the
  facts it does state and nothing more.
- Do not emit a fact for something you merely think is likely.

${UNTRUSTED_CONTENT_RULE}

OUTPUT FORMAT
Emit one block per fact and nothing else — no preamble, no commentary, no
markdown fences.

<<<FACT
key: asset.residence.value
label: Residence, 1412 Bayberry Lane
value: 740000
unit: USD
asOf: 2026-01-04
document: Appraisal.pdf
quote: opinion of market value as of the effective date is $740,000
FACT>>>

Field rules:
- key      required, from the conventions supplied
- label    required, a short human description
- value    required. Numbers bare, with no commas, currency symbols or units.
           Booleans as true or false. Dates as YYYY-MM-DD.
- unit     optional, e.g. USD
- asOf     optional ISO date the value is true as of
- document required, the exact document name given to you
- quote    required, LAST field in the block, may run over several lines,
           everything up to FACT>>> is treated as the quotation

If a document supports no facts at all, output nothing.
`.trim();

export function buildUserPrompt(doc: SourceDoc): string {
  return [
    FACT_KEY_GUIDE,
    "",
    "Extract every fact you can quote from the document below.",
    "",
    fenceDocument(doc.name, doc.content),
    "",
    `Use exactly "${doc.name}" as the document field in every block.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export interface ParseError {
  block: string;
  reason: string;
}

const KEY_SHAPE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i;

/** Coerce a printed value to number, boolean or string. */
export function coerceValue(raw: string): FactValue {
  const t = raw.trim();
  if (/^true$/i.test(t)) return true;
  if (/^false$/i.test(t)) return false;
  // Tolerate a model that ignores the "no commas or symbols" instruction.
  const numeric = t.replace(/[$,\s]/g, "");
  if (/^-?\d+(\.\d+)?$/.test(numeric)) return Number(numeric);
  return t;
}

/**
 * Parse the block format.
 *
 * Deliberately forgiving about surrounding noise — a model that adds a
 * sentence of preamble should not cost us the whole document — and
 * deliberately strict about the fields themselves.
 */
export function parseFacts(
  text: string,
  opts: { extractedBy?: string; expectDocument?: string } = {},
): { candidates: FactCandidate[]; errors: ParseError[] } {
  const candidates: FactCandidate[] = [];
  const errors: ParseError[] = [];

  const blocks = text.split(/<<<\s*FACT\b/i).slice(1);
  for (const raw of blocks) {
    const end = raw.search(/FACT\s*>>>/i);
    const body = (end === -1 ? raw : raw.slice(0, end)).replace(/^\r?\n/, "");
    if (!body.trim()) continue;

    const fields: Record<string, string> = {};
    const lines = body.split(/\r?\n/);
    let quote: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const m = /^\s*([a-zA-Z]+)\s*:\s*([\s\S]*)$/.exec(lines[i]);
      if (!m) continue;
      const name = m[1].toLowerCase();
      if (name === "quote") {
        // Everything from here to the end of the block is the quotation.
        quote = [m[2], ...lines.slice(i + 1)].join("\n").trim();
        break;
      }
      fields[name] = m[2].trim();
    }

    const problem = (reason: string) => errors.push({ block: body.trim().slice(0, 160), reason });

    if (!fields.key) {
      problem("no key");
      continue;
    }
    if (!KEY_SHAPE.test(fields.key)) {
      problem(`key "${fields.key}" is not a dotted fact key`);
      continue;
    }
    if (fields.value === undefined || fields.value === "") {
      problem(`no value for ${fields.key}`);
      continue;
    }
    if (!quote || quote.length < 8) {
      problem(`no usable quotation for ${fields.key}`);
      continue;
    }

    const document = fields.document || opts.expectDocument || "";
    if (!document) {
      problem(`no document for ${fields.key}`);
      continue;
    }

    candidates.push({
      key: fields.key,
      label: fields.label || fields.key,
      value: coerceValue(fields.value),
      unit: fields.unit || undefined,
      asOf: fields.asof || undefined,
      document,
      quote,
      extractedBy: opts.extractedBy ?? "unknown",
    });
  }

  return { candidates, errors };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export interface DocumentExtraction {
  document: string;
  candidates: FactCandidate[];
  errors: ParseError[];
  inputTokens: number;
  outputTokens: number;
  model: string;
  ms: number;
  failure?: string;
}

export interface ExtractionRun {
  perDocument: DocumentExtraction[];
  candidates: FactCandidate[];
  errors: ParseError[];
  inputTokens: number;
  outputTokens: number;
  /** Documents whose call failed outright. */
  failed: string[];
  startedAt: string;
}

/**
 * Extract across a data room.
 *
 * One call per document rather than one call for everything: a per-document
 * prompt keeps the fenced content small enough to quote accurately, and a
 * failure costs one document instead of the run.
 *
 * Duplicate keys are kept, not collapsed. Two documents asserting different
 * values for one key is exactly the conflict a human needs to see, and the
 * ledger's supersession rules handle ordering.
 */
export async function extractAll(
  docs: SourceDoc[],
  complete: CompleteFn,
  opts: {
    maxTokens?: number;
    extractedBy?: string;
    now?: () => number;
    onProgress?: (done: number, total: number, doc: string) => void;
  } = {},
): Promise<ExtractionRun> {
  const now = opts.now ?? (() => Date.now());
  const startedAt = new Date(now()).toISOString();
  const perDocument: DocumentExtraction[] = [];

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const t0 = now();
    try {
      const res = await complete({
        system: EXTRACTION_SYSTEM,
        user: buildUserPrompt(doc),
        maxTokens: opts.maxTokens ?? 8000,
      });
      const { candidates, errors } = parseFacts(res.text, {
        extractedBy: opts.extractedBy ?? res.model,
        expectDocument: doc.name,
      });
      perDocument.push({
        document: doc.name,
        candidates,
        errors,
        inputTokens: res.inputTokens,
        outputTokens: res.outputTokens,
        model: res.model,
        ms: now() - t0,
      });
    } catch (e) {
      perDocument.push({
        document: doc.name,
        candidates: [],
        errors: [],
        inputTokens: 0,
        outputTokens: 0,
        model: "",
        ms: now() - t0,
        failure: String(e),
      });
    }
    opts.onProgress?.(i + 1, docs.length, doc.name);
  }

  return {
    perDocument,
    candidates: perDocument.flatMap((d) => d.candidates),
    errors: perDocument.flatMap((d) => d.errors),
    inputTokens: perDocument.reduce((s, d) => s + d.inputTokens, 0),
    outputTokens: perDocument.reduce((s, d) => s + d.outputTokens, 0),
    failed: perDocument.filter((d) => d.failure).map((d) => d.document),
    startedAt,
  };
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

export interface RecordedExtraction {
  version: 1;
  recordedAt: string;
  model: string;
  documents: string[];
  candidates: FactCandidate[];
  /** Kept so a replayed run reports the same honest yield as the live one. */
  errorCount: number;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Freeze a live run so a demonstration replays it rather than re-calling.
 *
 * This is not a shortcut. A live API call inside a three-minute demonstration
 * is a coin flip on someone else's network, and the honest framing is stronger
 * anyway: "this is a recorded real extraction, and here is the fabrication the
 * model produced that our verifier caught."
 */
export function record(run: ExtractionRun, docs: SourceDoc[]): RecordedExtraction {
  return {
    version: 1,
    recordedAt: run.startedAt,
    model: run.perDocument.find((d) => d.model)?.model ?? "unknown",
    documents: docs.map((d) => d.name),
    candidates: run.candidates,
    errorCount: run.errors.length,
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
  };
}

export function isRecorded(value: unknown): value is RecordedExtraction {
  const v = value as RecordedExtraction | null;
  return !!v && v.version === 1 && Array.isArray(v.candidates);
}
