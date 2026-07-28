// Form-field mapping, discovered rather than hand-written.
//
// A fillable PDF names its fields for the software that generated it, not for
// anyone who has to use them. Form 56 calls the fiduciary's name
// `topmostSubform[0].Page1[0].f1_10[0]`. SS-4 has 89 such fields, and Alix
// faces hundreds of forms across fifty states and three thousand counties.
// Hand-mapping does not scale, and hand-mapping from memory is how you end up
// filing a decedent's SSN into the executor's box.
//
// So mapping uses the same shape as everything else here: a model proposes, a
// deterministic check disposes. The model is shown, for each widget, the words
// actually printed around it on the page — extracted geometrically, not
// summarised — and must return both the target field and *the verbatim printed
// label it relied on*. `verifyMapping` then checks that quote against the page
// text using the same matcher that verifies factual claims. A mapping whose
// label cannot be found is quarantined and never fills anything.
//
// This matters more than it might look. A wrong mapping is worse than a missing
// one: a blank box gets caught in review, whereas a plausible value in the
// wrong box gets signed. Requiring the model to point at the printed label
// means it cannot map `f1_10` to the fiduciary's name on a hunch — it has to
// find the words "Fiduciary's name" next to that box, and if it invents them,
// the check fails.

import { locateQuote, normalise } from "./verify";

/** One AcroForm widget plus the printed text around it. */
export interface Widget {
  name: string;
  page: number;
  /** "/Tx" for text, "/Btn" for checkbox or radio. */
  type: string;
  rect: number[];
  /** Tooltip, where the form author supplied one. Many IRS forms do not. */
  tip: string | null;
  /** Appearance states of a button, e.g. ["/1", "/Off"]. */
  states: string[] | null;
  left: string;
  right: string;
  above: string;
  below: string;
}

export interface FormGeometry {
  form: string;
  sourceFile: string;
  pages: number;
  /**
   * Page dimensions in PDF points. Carried so that consumers converting to a
   * top-left origin never have to guess the page height — getting that wrong
   * places every field a mirror-image distance down the page without erroring.
   */
  pageSizes?: { page: number; width: number; height: number }[];
  widgets: Widget[];
}

/**
 * All printed text near a widget, in one string, for quote matching.
 *
 * Order matters for readability but not for matching, since the matcher
 * normalises whitespace. Tooltips come first because when a form supplies them
 * they are authoritative.
 */
export function widgetContext(w: Widget): string {
  return [w.tip ?? "", w.above, w.left, w.right, w.below].filter(Boolean).join(" · ");
}

/** What the model returns for one field. */
export interface MappingProposal {
  /** Fully-qualified widget name. */
  field: string;
  /** Dotted path into the estate record, or "" when the field has no source. */
  target: string;
  /** Verbatim printed text near the widget that identifies it. */
  labelQuote: string;
  /** For a checkbox: which appearance state means "ticked". */
  onState?: string;
  /**
   * For a checkbox whose meaning is conditional, the record condition that
   * should tick it, e.g. `authority.basis == CourtAppointmentTestate`.
   */
  condition?: string;
  note?: string;
}

export type MappingVerdict =
  | "verified"
  | "unknown_field"
  | "unsupported_label"
  | "bad_state"
  | "unparseable_condition"
  | "unmapped";

/**
 * The condition grammar a checkbox mapping may use. Deliberately tiny:
 *
 *   path == Value      path != Value      path includes Value      path
 *
 * A model asked for a checkbox condition will happily write prose — "taxTypes
 * includes Income" reads fine, and so does "authority.basis is court
 * appointment of a testate estate". The first happens to be parseable and the
 * second never will be, and both look equally confident in a JSON file.
 *
 * The failure this prevents is asymmetric and nasty. An unparseable condition
 * evaluates to unknown, so the box silently never ticks — Form 56's required
 * tax-type lines come out blank on every filing and nothing reports it. The
 * same mapping consumed by a filler that reads the bare target instead ticks
 * *every* box in the group, declaring that an estate owes every class of tax.
 * Silent-blank and silent-everything from one ambiguous string.
 *
 * So a condition that does not parse fails verification and is refused, which
 * puts it in the rejected list where somebody sees it.
 */
export const CONDITION_GRAMMAR =
  /^([A-Za-z_][\w]*(?:\.[\w]+)*)\s*(==|!=|includes)?\s*(.*)$/;

export interface ParsedCondition {
  path: string;
  op: "==" | "!=" | "includes" | "truthy";
  value?: string;
}

export function parseCondition(raw: string): ParsedCondition | null {
  const t = raw.trim();
  if (!t) return null;

  const m = t.match(CONDITION_GRAMMAR);
  if (!m) return null;
  const [, path, op, rest] = m;

  if (!op) {
    // Bare path is a truthiness test — but only if nothing trails it. Prose
    // like "authority.basis is a valid trust instrument" matches the path and
    // leaves a tail, and must not be mistaken for a boolean check.
    return rest.trim() ? null : { path, op: "truthy" };
  }

  const value = rest.trim().replace(/^["']|["']$/g, "");
  if (!value) return null;
  return { path, op: op as "==" | "!=" | "includes", value };
}

export interface VerifiedMapping extends MappingProposal {
  verdict: MappingVerdict;
  page?: number;
  type?: string;
  /** How much of the claimed label was found in the printed context, 0–1. */
  similarity: number;
  note: string;
}

/**
 * Check one proposed mapping against the page.
 *
 * Three ways to fail, kept distinct because they mean different things to
 * whoever reads the report. `unknown_field` means the model invented a widget
 * — a hallucination. `unsupported_label` means the widget exists but the label
 * the model claims to have read is not printed near it — a guess dressed as
 * evidence. `bad_state` means the tick value would not actually tick the box —
 * a mapping that would silently produce an unchecked form.
 */
export function verifyMapping(
  proposal: MappingProposal,
  byName: Map<string, Widget>,
): VerifiedMapping {
  const w = byName.get(proposal.field);
  if (!w) {
    return {
      ...proposal,
      verdict: "unknown_field",
      similarity: 0,
      note: `No widget named "${proposal.field}" on this form.`,
    };
  }

  const base = { ...proposal, page: w.page, type: w.type };

  if (!proposal.target) {
    return {
      ...base,
      verdict: "unmapped",
      similarity: 0,
      note: proposal.note ?? "No estate-record source for this field.",
    };
  }

  const context = widgetContext(w);

  // An empty label is not evidence, and it must be rejected explicitly:
  // locating the empty string in any text trivially succeeds, so without this
  // check a mapping that cites nothing at all passes verification and looks
  // exactly like one that cited a real printed label.
  if (!proposal.labelQuote.trim()) {
    return {
      ...base,
      verdict: "unsupported_label",
      similarity: 0,
      note: `No label cited for ${proposal.field}. A mapping must point at printed text.`,
    };
  }

  const found = locateQuote(proposal.labelQuote, context);
  if (!found) {
    return {
      ...base,
      verdict: "unsupported_label",
      similarity: labelCoverage(proposal.labelQuote, context),
      note:
        `Claimed label ${JSON.stringify(proposal.labelQuote)} is not printed near ` +
        `${proposal.field}. Nearby text: ${JSON.stringify(context.slice(0, 160))}`,
    };
  }

  if (w.type === "/Btn" && proposal.onState) {
    const states = w.states ?? [];
    if (states.length && !states.includes(proposal.onState)) {
      return {
        ...base,
        verdict: "bad_state",
        similarity: 1,
        note: `State "${proposal.onState}" is not one of ${states.join(", ")}.`,
      };
    }
  }

  if (w.type === "/Btn" && proposal.condition && !parseCondition(proposal.condition)) {
    return {
      ...base,
      verdict: "unparseable_condition",
      similarity: 1,
      note:
        `Condition ${JSON.stringify(proposal.condition)} is prose, not one of ` +
        `"path == v", "path != v", "path includes v", "path". A condition that ` +
        `cannot be evaluated leaves the box permanently unticked with no warning.`,
    };
  }

  return { ...base, verdict: "verified", similarity: 1, note: "Label located on the page." };
}

/**
 * Share of the claimed label's words that appear in the printed context. Used
 * only to rank near-misses in the failure report; it never promotes a mapping.
 */
function labelCoverage(label: string, context: string): number {
  const want = normalise(label).split(" ").filter(Boolean);
  if (!want.length) return 0;
  const have = new Set(normalise(context).split(" ").filter(Boolean));
  return want.filter((t) => have.has(t)).length / want.length;
}

export interface MappingRun {
  form: string;
  proposals: VerifiedMapping[];
  verified: VerifiedMapping[];
  rejected: VerifiedMapping[];
  /** Widgets the model returned no proposal for at all. */
  unaddressed: string[];
}

export function admitMappings(
  geometry: FormGeometry,
  proposals: MappingProposal[],
): MappingRun {
  const byName = new Map(geometry.widgets.map((w) => [w.name, w]));
  const checked = proposals.map((p) => verifyMapping(p, byName));
  const addressed = new Set(proposals.map((p) => p.field));
  return {
    form: geometry.form,
    proposals: checked,
    verified: checked.filter((m) => m.verdict === "verified"),
    rejected: checked.filter((m) => m.verdict !== "verified" && m.verdict !== "unmapped"),
    unaddressed: geometry.widgets.filter((w) => !addressed.has(w.name)).map((w) => w.name),
  };
}

// ---------------------------------------------------------------------------
// Discovery prompt
// ---------------------------------------------------------------------------

export const MAPPING_SYSTEM = `You map fields of a government PDF form onto a structured estate record.

You will be given, for each fillable widget on one page: its internal name, its
type, and the words actually printed around it on the page (above it, to its
left, to its right, below it, and its tooltip if the form has one). The internal
names are meaningless. The printed words are the evidence.

For every widget, emit one block:

<<<MAP
field: <exact internal name, copied character for character>
target: <dotted path into the estate record, or leave empty if nothing fits>
label: <the printed words near this widget that identify it, copied verbatim>
state: <for a checkbox only: the appearance state that ticks it>
when: <for a checkbox only: the record condition that should tick it>
note: <only if something is unusual>
MAP>>>

Rules that matter:

1. "label" must be text you were actually shown next to that widget. Copy it
   exactly, including punctuation and capitalisation. Do not paraphrase, do not
   tidy, do not reconstruct what the form "should" say. A label that cannot be
   found in the printed text is discarded, and the mapping with it.

2. Prefer a short distinctive label over a long one. "Fiduciary's name" is
   better than a whole sentence, because a long span is more likely to cross a
   line break and fail to match.

   Prefer a label that actually names the field over one that merely sits
   nearby. In signature blocks the caption is printed BELOW the line, and the
   only text to the left is something like "Here" from "Please Sign Here" —
   which identifies nothing. A real run mapped such a box to the signer's name
   on the strength of "Here"; the caption underneath it read "Title, if
   applicable", and the generated form declared the fiduciary's title to be her
   own name. When the same-line context is uninformative, use "printed below".

3. If no record path fits a widget, leave "target" empty and still emit the
   block. Buttons like Print and Clear Form, "For IRS Use Only" boxes, and
   signature images have no source. Saying so is useful; guessing is not.

4. Address lines are separate fields on these forms. Map the street line, the
   city, the state and the ZIP each to their own path. Never concatenate.

5. For a group of checkboxes where exactly one applies — a "check one" line —
   give each box the same "target" and distinguish them by "when".

6. "when" is code, not prose. It must be exactly one of these four forms:

     <path> == <value>
     <path> != <value>
     <path> includes <value>
     <path>

   Write "taxMatters.taxTypes includes Income", never "the taxTypes list
   contains Income". Write "authority.basis == ValidTrustInstrument", never
   "authority.basis is a valid trust instrument". Use the enum value exactly as
   it appears in the record, not its English description.

   A condition that does not parse is discarded along with its mapping. This is
   strict on purpose: an unevaluable condition leaves the box silently unticked
   on every form you ever generate, and nothing reports it.

   If a box genuinely cannot be decided from the record by such a test — it
   needs judgement, or a value the record does not carry — leave "when" empty
   and say why in "note". A box a human must tick is a fine answer. A box that
   looks automated and never ticks is not.

7. Never map a decedent's identifier to a fiduciary field or vice versa. These
   forms place them adjacent on purpose and it is the most damaging error you
   can make here.`;

export function buildMappingPrompt(
  geometry: FormGeometry,
  page: number,
  schemaPaths: string[],
): string {
  const widgets = geometry.widgets.filter((w) => w.page === page);
  const lines = widgets.map((w) => {
    const parts = [
      `field: ${w.name}`,
      `type: ${w.type === "/Btn" ? "checkbox" : "text"}`,
    ];
    if (w.states?.length) parts.push(`states: ${w.states.join(" ")}`);
    if (w.tip) parts.push(`tooltip: ${w.tip}`);
    if (w.above) parts.push(`printed above: ${w.above}`);
    if (w.left) parts.push(`printed left: ${w.left}`);
    if (w.right) parts.push(`printed right: ${w.right}`);
    if (w.below) parts.push(`printed below: ${w.below}`);
    return parts.join("\n");
  });

  return [
    `Form: ${geometry.sourceFile} (page ${page} of ${geometry.pages})`,
    ``,
    `Available record paths:`,
    schemaPaths.map((p) => `  ${p}`).join("\n"),
    ``,
    `Widgets on this page (${widgets.length}):`,
    ``,
    lines.join("\n\n---\n\n"),
  ].join("\n");
}

const BLOCK = /<<<MAP\s*([\s\S]*?)MAP>>>/g;

export function parseMappings(text: string): MappingProposal[] {
  const out: MappingProposal[] = [];
  for (const m of text.matchAll(BLOCK)) {
    const body = m[1];
    const get = (k: string): string => {
      const re = new RegExp(`^${k}:[ \\t]*(.*)$`, "mi");
      return (body.match(re)?.[1] ?? "").trim();
    };
    const field = get("field");
    if (!field) continue;
    const proposal: MappingProposal = {
      field,
      target: get("target"),
      labelQuote: get("label"),
    };
    const state = get("state");
    if (state) proposal.onState = state.startsWith("/") ? state : `/${state}`;
    const when = get("when");
    if (when) proposal.condition = when;
    const note = get("note");
    if (note) proposal.note = note;
    out.push(proposal);
  }
  return out;
}

/**
 * A human correction to a discovered mapping.
 *
 * Kept separate from the generated map because generated files get
 * regenerated. A correction applied by editing the output survives exactly
 * until the next discovery run, then vanishes silently and the original error
 * comes back — which is worse than never having fixed it, because by then
 * everyone believes it is fixed.
 */
export interface Adjudication {
  form: string;
  field: string;
  target: string;
  labelQuote: string;
  /** What discovery had proposed, for the record. */
  wasTarget?: string;
  decidedBy: string;
  decidedAt: string;
  reason: string;
  onState?: string;
  condition?: string;
}

/**
 * Apply human corrections on top of a discovery run.
 *
 * Adjudications are verified like anything else. A human is a better judge of
 * *which* field a box is than a model, but no better at remembering what is
 * printed on page two — so an override citing a label that is not there is
 * refused, and says so.
 */
export function adjudicate(
  run: MappingRun,
  geometry: FormGeometry,
  adjudications: Adjudication[],
): { run: MappingRun; applied: Adjudication[]; refused: VerifiedMapping[] } {
  const mine = adjudications.filter((a) => a.form === run.form);
  if (!mine.length) return { run, applied: [], refused: [] };

  const byName = new Map(geometry.widgets.map((w) => [w.name, w]));
  const applied: Adjudication[] = [];
  const refused: VerifiedMapping[] = [];
  const replacements = new Map<string, VerifiedMapping>();

  for (const a of mine) {
    const checked = verifyMapping(
      {
        field: a.field,
        target: a.target,
        labelQuote: a.labelQuote,
        onState: a.onState,
        condition: a.condition,
        note: `adjudicated by ${a.decidedBy} on ${a.decidedAt}: ${a.reason}`,
      },
      byName,
    );
    if (checked.verdict === "verified") {
      replacements.set(a.field, checked);
      applied.push(a);
    } else {
      refused.push(checked);
    }
  }

  const verified = run.verified
    .filter((m) => !replacements.has(m.field))
    .concat([...replacements.values()]);

  return {
    run: { ...run, verified, proposals: run.proposals.concat([...replacements.values()]) },
    applied,
    refused,
  };
}

/** The committed artefact: a form's verified mapping, with its evidence. */
export interface FieldMap {
  form: string;
  sourceFile: string;
  discoveredBy: string;
  discoveredAt: string;
  /**
   * What the discovery run cost, persisted so it can be measured rather than
   * remembered. Wall clock and token counts were previously printed to stdout
   * and thrown away, which meant the one number anybody would ask about — how
   * long does it take to onboard a form? — could only be asserted from memory.
   * A benchmark that cannot read a figure off an artefact should refuse to
   * quote it, and ours does.
   */
  run?: {
    elapsedMs: number;
    inputTokens: number;
    outputTokens: number;
    /** Model calls made for this form, after chunking. */
    calls: number;
  };
  entries: {
    field: string;
    target: string;
    labelQuote: string;
    page: number;
    type: string;
    onState?: string;
    condition?: string;
  }[];
  /** Widgets deliberately left unmapped, with the reason. */
  unmapped: { field: string; note: string }[];
  /** Proposals that failed verification. Kept so the failure is inspectable. */
  rejected: { field: string; verdict: string; note: string }[];
}

export function toFieldMap(
  run: MappingRun,
  geometry: FormGeometry,
  meta: {
    model: string;
    at: string;
    run?: { elapsedMs: number; inputTokens: number; outputTokens: number; calls: number };
  },
): FieldMap {
  return {
    form: run.form,
    sourceFile: geometry.sourceFile,
    discoveredBy: meta.model,
    discoveredAt: meta.at,
    ...(meta.run ? { run: meta.run } : {}),
    entries: run.verified.map((m) => ({
      field: m.field,
      target: m.target,
      labelQuote: m.labelQuote,
      page: m.page ?? 0,
      type: m.type ?? "",
      ...(m.onState ? { onState: m.onState } : {}),
      ...(m.condition ? { condition: m.condition } : {}),
    })),
    unmapped: run.proposals
      .filter((m) => m.verdict === "unmapped")
      .map((m) => ({ field: m.field, note: m.note })),
    rejected: run.rejected.map((m) => ({ field: m.field, verdict: m.verdict, note: m.note })),
  };
}
