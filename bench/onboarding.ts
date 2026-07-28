// How fast can the system take on a government form it has never seen?
//
// "Fast" is the wrong first question and this module deliberately does not
// answer it, because nothing in the repository records how long discovery took
// or what it cost. What the committed artefacts *do* record is the shape of the
// result: for every fillable widget on four forms, either a mapping whose
// printed label a deterministic checker can still locate on the page, or a
// stated reason for leaving it alone, or a refusal. So the measurable claim is
// about disposition and refusal, not speed.
//
// Everything below is recomputed at module load. Counts are read out of
// src/forms/geometry and src/forms/maps with node:fs, and the verification
// numbers are not read at all — `admitMappings` and `adjudicate` from
// src/lib/formmap are re-executed over the committed entries, so "171 verified"
// means 171 labels were located on the page just now, not that 171 rows sit in
// a JSON file somebody generated in July.
//
// Two things this module found that the artefacts do not state, and that a
// benchmark copying headline numbers would have got wrong:
//
//   1. 258 is a count of widget *annotations*, not of distinct fillable fields.
//      CA DL-142 is a two-part form: 24 of its 52 annotations are second copies
//      of a field that appears again in the lower half of the page, sharing an
//      AcroForm name. There are 234 distinct fields, not 258. Both denominators
//      are reported. They give 66.28% and 66.67% coverage respectively, so the
//      headline survives the correction — but only because it was checked.
//
//   2. Three mappings passed verification and were still wrong. They are in
//      adjudications.json, and they are the most important number here, because
//      they bound what the coverage figure can possibly mean.
//
//   3. The cross-run agreement figure cannot be computed from the committed maps
//      as they stand. revalidate-maps.ts writes adjudicated targets back into
//      src/forms/maps, so for an adjudicated field `entries[].target` holds a
//      *human's* choice, not what that discovery run proposed. Comparing it to a
//      second run therefore scores the three fields a human had to correct as
//      agreements — and those are exactly the fields the two runs disagreed on.
//      Read straight off the committed file the figure comes out at a clean 100%.
//      A perfect score that exists only because the corrections were folded into
//      one side of the comparison is worth less than no score at all, so
//      `crosscheck()` below recovers each run's own proposal from `wasTarget`
//      first. Both figures are reported on the row itself, computed, so neither
//      this comment nor that caveat can drift as more crosscheck runs land.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  adjudicate,
  admitMappings,
  type Adjudication,
  type FieldMap,
  type FormGeometry,
} from "../src/lib/formmap";
import { assumed, derived, measured, print, type Benchmark, type Metric } from "./harness";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GEO = join(ROOT, "src/forms/geometry");
const MAPS = join(ROOT, "src/forms/maps");
const CROSSCHECK = join(ROOT, "src/forms/maps-crosscheck");
const ADJ_FILE = join(ROOT, "src/forms/adjudications.json");
const DISCOVER = join(ROOT, "tools/discover-maps.ts");

const readJson = <T,>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T;

const ADJUDICATIONS = readJson<{ adjudications: Adjudication[] }>(ADJ_FILE).adjudications;

interface FormResult {
  form: string;
  pages: number;
  /** Annotations per page, index 0 = page 1. A declared page with no fillable
   *  widget is a real case here and would otherwise inflate "Pages". */
  perPage: number[];
  /** Widget annotations on the page — the raw count in the geometry file. */
  annotations: number;
  /** Distinct AcroForm field names. Lower than `annotations` where a field is
   *  drawn twice on one page, as on the two-part DL-142. */
  fields: number;
  /** Re-verified just now, not read from the file. */
  verifiedAnnotations: number;
  verifiedFields: number;
  unmapped: number;
  refused: number;
  /** Committed entries that fail today's checks. Should be zero. */
  failing: number;
  /** Widgets in none of the three buckets — silently dropped, if any. */
  unaddressed: number;
  adjudicationsApplied: number;
  adjudicationsRefused: number;
  stamp: number;
  /** Model calls a full re-run would issue, at the tool's own chunk size. */
  calls: number | null;
}

/** The discovery tool chunks widgets per request. Parsed, not remembered — if
 *  the constant moves or is renamed, the derived call count is dropped rather
 *  than silently computed from a stale number. */
function chunkSize(): number | null {
  if (!existsSync(DISCOVER)) return null;
  const m = readFileSync(DISCOVER, "utf8").match(/const\s+CHUNK\s*=\s*(\d+)\s*;/);
  return m ? Number(m[1]) : null;
}

const CHUNK = chunkSize();

const results: FormResult[] = [];

for (const file of readdirSync(GEO).filter((f) => f.endsWith(".json"))) {
  const geometry = readJson<FormGeometry>(join(GEO, file));
  const mapPath = join(MAPS, `${geometry.form}.json`);
  if (!existsSync(mapPath)) continue;
  const map = readJson<FieldMap>(mapPath);

  // Re-run the real verifier over the committed entries. This is the whole
  // point: a mapping counts as verified because its label was located on the
  // page during this process, not because it survived into a file once.
  const raw = admitMappings(
    geometry,
    map.entries.map((e) => ({
      field: e.field,
      target: e.target,
      labelQuote: e.labelQuote,
      onState: e.onState,
      condition: e.condition,
    })),
  );
  const { run, applied, refused } = adjudicate(raw, geometry, ADJUDICATIONS);
  const failing = run.proposals.filter(
    (p) => p.verdict !== "verified" && p.verdict !== "unmapped",
  );

  const names = new Set(geometry.widgets.map((w) => w.name));
  const accounted = new Set([
    ...map.entries.map((e) => e.field),
    ...map.unmapped.map((u) => u.field),
    ...map.rejected.map((r) => r.field),
  ]);

  const perPage: number[] = [];
  for (let page = 1; page <= geometry.pages; page++) {
    perPage.push(geometry.widgets.filter((w) => w.page === page).length);
  }

  const calls =
    CHUNK && CHUNK > 0 ? perPage.reduce((a, n) => a + Math.ceil(n / CHUNK), 0) : null;

  results.push({
    form: geometry.form,
    pages: geometry.pages,
    perPage,
    annotations: geometry.widgets.length,
    fields: names.size,
    verifiedAnnotations: run.verified.length,
    verifiedFields: new Set(run.verified.map((m) => m.field)).size,
    unmapped: map.unmapped.length,
    refused: map.rejected.length,
    failing: failing.length,
    unaddressed: [...names].filter((n) => !accounted.has(n)).length,
    adjudicationsApplied: applied.length,
    adjudicationsRefused: refused.length,
    stamp: Date.parse(map.discoveredAt),
    calls,
  });
}

const sum = (f: (r: FormResult) => number): number => results.reduce((a, r) => a + f(r), 0);

const TOTAL_ANNOTATIONS = sum((r) => r.annotations);
const TOTAL_FIELDS = sum((r) => r.fields);
const TOTAL_VERIFIED = sum((r) => r.verifiedAnnotations);
const TOTAL_VERIFIED_FIELDS = sum((r) => r.verifiedFields);
const TOTAL_UNMAPPED = sum((r) => r.unmapped);
const TOTAL_REFUSED = sum((r) => r.refused);

/** Adjudications that changed a target, and whose correction is live in the
 *  committed map. Each one is a mapping that passed label verification and was
 *  wrong anyway. */
const correctedLive = ADJUDICATIONS.filter((a) => {
  if (!a.wasTarget || a.wasTarget === a.target) return false;
  const p = join(MAPS, `${a.form}.json`);
  if (!existsSync(p)) return false;
  const entry = readJson<FieldMap>(p).entries.find((e) => e.field === a.field);
  return entry?.target === a.target;
}).length;

/**
 * What the committed discovery run itself proposed for a field, before any human
 * override — keyed `form|field`, populated only where an adjudication actually
 * changed the target.
 *
 * This exists because src/forms/maps is not a pure record of a run. CLAUDE.md
 * routes corrections through adjudications.json and revalidate-maps.ts re-applies
 * them into the committed map, which is the right design and makes
 * `entries[].target` the wrong thing to read when the question is "what did that
 * model choose?". `wasTarget` is the only surviving record of the original
 * proposal, which is why the type carries it.
 */
const RAN_TARGET = new Map<string, string>();
for (const a of ADJUDICATIONS) {
  if (a.wasTarget && a.wasTarget !== a.target) RAN_TARGET.set(`${a.form}|${a.field}`, a.wasTarget);
}

/**
 * Agreement between two independent discovery runs.
 *
 * The repository's own note says this is the only confidence signal available
 * short of a human reading the form, which makes an empty or partial crosscheck
 * set a finding rather than a housekeeping detail. Compared per distinct field
 * on the forms where both runs produced a map; a form with no second run
 * contributes nothing rather than counting as agreement.
 *
 * Human corrections are un-applied before comparing, via RAN_TARGET. Comparing
 * the post-adjudication map against a second run would credit a human's answer
 * to the first model and turn the fields the two runs disagreed about into
 * agreements — inflating the figure precisely where it should be lowest. The
 * count of such fields is returned so the correction is visible rather than
 * silent.
 *
 * Files are read defensively because this directory is written by a separate
 * tool invocation that may be running: a file caught mid-write is not a run
 * that can be compared, and is skipped rather than crashing the module or
 * being silently scored as a disagreement.
 */
function crosscheck(): { forms: number; compared: number; agreed: number; overridden: number } {
  const out = { forms: 0, compared: 0, agreed: 0, overridden: 0 };
  if (!existsSync(CROSSCHECK)) return out;
  for (const file of readdirSync(CROSSCHECK).filter((f) => f.endsWith(".json"))) {
    let other: FieldMap;
    try {
      other = readJson<FieldMap>(join(CROSSCHECK, file));
    } catch {
      continue;
    }
    const minePath = join(MAPS, `${other.form}.json`);
    if (!existsSync(minePath)) continue;
    let mine: FieldMap;
    try {
      mine = readJson<FieldMap>(minePath);
    } catch {
      continue;
    }
    out.forms += 1;
    const theirs = new Map(other.entries.map((e) => [e.field, e.target]));
    const seen = new Set<string>();
    for (const e of mine.entries) {
      if (seen.has(e.field)) continue;
      seen.add(e.field);
      const t = theirs.get(e.field);
      if (t === undefined) continue;
      out.compared += 1;
      const override = RAN_TARGET.get(`${other.form}|${e.field}`);
      if (override !== undefined) out.overridden += 1;
      if (t === (override ?? e.target)) out.agreed += 1;
    }
  }
  return out;
}

const CROSS = crosscheck();
const crosscheckRuns = CROSS.forms;

/** Which forms actually carry duplicate annotations, and why the two totals
 *  differ. Computed rather than asserted, so the caveat cannot go stale when
 *  geometry is re-extracted. */
const duplicatedOn = results.filter((r) => r.annotations > r.fields).map((r) => r.form);

/** Declared pages carrying no fillable widget, named rather than counted, so the
 *  caveat on "Pages" points at the actual page instead of asserting which form
 *  it belongs to. */
const emptyPageList = results.flatMap((r) =>
  r.perPage.flatMap((n, i) => (n === 0 ? [`${r.form} p${i + 1}`] : [])),
);

/** The refusals, summarised from the committed records rather than described
 *  from memory. Maps are regenerated in place, so a hand-written description of
 *  what was refused is wrong the moment discovery runs again. */
const refusalSummary = (() => {
  const rows: string[] = [];
  for (const r of results) {
    const p = join(MAPS, `${r.form}.json`);
    if (!existsSync(p)) continue;
    for (const rej of readJson<FieldMap>(p).rejected) {
      const quoted = rej.note.match(/^Claimed label (".*?") is not printed/)?.[1];
      rows.push(`${r.form} ${rej.field.split(".").pop()} — ${rej.verdict}` +
        (quoted ? `, cited ${quoted}` : ""));
    }
  }
  return rows;
})();

const stamps = results.map((r) => r.stamp).filter((n) => Number.isFinite(n));
const stampSpanMin =
  stamps.length > 1 ? (Math.max(...stamps) - Math.min(...stamps)) / 60000 : null;

const AT = new Date().toISOString().slice(0, 10);
const pct = (n: number, d: number): number => (d ? (n / d) * 100 : 0);

/** Per-form coverage, and the spread across forms. Computed rather than written
 *  into the prose of `limits`, so the range quoted there cannot drift away from
 *  the numbers in the table above it. */
const perFormCoverage = results.map((r) => pct(r.verifiedFields, r.fields));
const coverageLow = perFormCoverage.length ? Math.min(...perFormCoverage) : 0;
const coverageHigh = perFormCoverage.length ? Math.max(...perFormCoverage) : 0;

/** Gap in percentage points between the two coverage denominators. */
const coverageGap = Math.abs(
  pct(TOTAL_VERIFIED, TOTAL_ANNOTATIONS) - pct(TOTAL_VERIFIED_FIELDS, TOTAL_FIELDS),
);

const metrics: Metric[] = [
  // ---- scope -------------------------------------------------------------
  {
    id: "forms",
    label: "Forms onboarded",
    value: results.length,
    provenance: measured(
      "count of files in src/forms/geometry that also have a committed map in src/forms/maps",
      AT,
    ),
    caveat:
      "Three IRS forms and one California DMV form. The IRS three share one field-naming " +
      "convention and one geometry extractor, so they are not four independent trials.",
  },
  {
    id: "pages",
    label: "Pages",
    value: sum((r) => r.pages),
    provenance: measured("sum of geometry[].pages across the committed geometry files", AT),
    caveat:
      emptyPageList.length
        ? `Printed pages, not pages of fields: ${emptyPageList.length} declared page` +
          `${emptyPageList.length === 1 ? "" : "s"} carr` +
          `${emptyPageList.length === 1 ? "ies" : "y"} no fillable widget at all ` +
          `(${emptyPageList.join(", ")}), so this is not the size of the mapping job. The ` +
          "widget counts below are that."
        : "Printed pages, not the size of the mapping job. The widget counts below are that.",
  },
  {
    id: "widgets.annotations",
    label: "Widget annotations",
    value: TOTAL_ANNOTATIONS,
    provenance: measured("sum of geometry[].widgets.length across the committed geometry files", AT),
    caveat:
      "This is the number usually quoted for this corpus. It counts annotations drawn on the " +
      "page, so a field drawn twice counts twice.",
  },
  {
    id: "widgets.fields",
    label: "Distinct fillable fields",
    value: TOTAL_FIELDS,
    provenance: measured("size of the set of distinct geometry[].widgets[].name values", AT),
    caveat:
      `${TOTAL_ANNOTATIONS - TOTAL_FIELDS} annotations are second copies of a field drawn twice ` +
      `on the same page, confined to ${duplicatedOn.join(", ") || "no form"} — a two-part form ` +
      "that prints the same block again lower down. One AcroForm name, so filling the field " +
      "fills both copies. This is the honest denominator for 'fields mapped'.",
  },

  // ---- disposition -------------------------------------------------------
  {
    id: "verified.annotations",
    label: "Mappings verified (annotations)",
    value: TOTAL_VERIFIED,
    provenance: measured(
      "re-executed admitMappings() + adjudicate() from src/lib/formmap over every committed " +
        "map entry against its geometry; counts entries whose cited label locateQuote() found " +
        "in the printed text around that widget",
      AT,
    ),
    caveat:
      "Verified means the quoted label is genuinely printed next to that widget. It does not " +
      "mean the widget was routed to the right record path. Note also that this counts map " +
      "entries, not distinct verifier decisions: a field drawn twice gets two entries which " +
      "resolve to the same widget, so " +
      `${TOTAL_VERIFIED - TOTAL_VERIFIED_FIELDS} of these are re-checks of a widget already ` +
      "checked. The distinct-field row below is the number of widgets actually verified.",
  },
  {
    id: "verified.fields",
    label: "Mappings verified (distinct fields)",
    value: TOTAL_VERIFIED_FIELDS,
    provenance: measured("distinct field names among the re-verified entries", AT),
  },
  {
    id: "unmapped",
    label: "Widgets deliberately left unmapped",
    value: TOTAL_UNMAPPED,
    provenance: measured("sum of map.unmapped.length across the committed maps", AT),
    caveat:
      "Each carries a written reason — 'For IRS Use Only', no corresponding record path, a box " +
      "a human must decide. The reasons were written by the same model that did the mapping " +
      "and are not independently checked. A field wrongly declared sourceless leaves a blank " +
      "box that nothing here flags.",
  },
  {
    id: "refused",
    label: "Proposals refused by the verifier",
    value: TOTAL_REFUSED,
    provenance: measured("sum of map.rejected.length across the committed maps", AT),
    caveat:
      (refusalSummary.length
        ? `Read out of the committed rejection records: ${refusalSummary.join("; ")}. `
        : "") +
      "A refusal means the model cited a label that the verifier could not find printed near " +
      "that widget, so the mapping never reached a form. This is only what the most recent " +
      "discovery run refused — maps are rewritten in place, so earlier refusals are gone.",
  },
  {
    id: "unaddressed",
    label: "Widgets in no bucket at all",
    value: sum((r) => r.unaddressed),
    provenance: measured(
      "widget names present in geometry but absent from map.entries, map.unmapped and " +
        "map.rejected — computed as a set difference per form",
      AT,
    ),
    caveat:
      "The integrity check on everything above. A non-zero value would mean a widget vanished " +
      "between extraction and mapping without being mapped, excused or refused.",
  },
  {
    id: "failing",
    label: "Committed entries failing today's checks",
    value: sum((r) => r.failing),
    provenance: measured(
      "every committed map entry re-run through admitMappings() + adjudicate() during this " +
        "process; counts entries whose verdict is neither 'verified' nor 'unmapped'",
      AT,
    ),
    caveat:
      "Zero means the committed maps still pass the verifier as it stands today. It does not " +
      "establish that the checks were weaker when the maps were written: this module cannot see " +
      "the verifier's history, so read it as a freshness check on the artefacts, not as evidence " +
      "that anything tightened.",
  },

  // ---- rates -------------------------------------------------------------
  {
    id: "coverage.annotations",
    label: "Coverage, per annotation",
    value: pct(TOTAL_VERIFIED, TOTAL_ANNOTATIONS),
    unit: "%",
    provenance: derived(
      ["verified.annotations", "widgets.annotations"],
      "100 * verified.annotations / widgets.annotations",
    ),
  },
  {
    id: "coverage.fields",
    label: "Coverage, per distinct field",
    value: pct(TOTAL_VERIFIED_FIELDS, TOTAL_FIELDS),
    unit: "%",
    provenance: derived(
      ["verified.fields", "widgets.fields"],
      "100 * verified.fields / widgets.fields",
    ),
    caveat:
      `${coverageGap.toFixed(2)} points from the per-annotation figure, so the DL-142 ` +
      "double-count does not move the headline. That is a result of the check, not a reason to " +
      "have skipped it — the two denominators differ by " +
      `${TOTAL_ANNOTATIONS - TOTAL_FIELDS} widgets and nothing guaranteed the answer would land ` +
      "this close.",
  },
  {
    id: "disposition",
    label: "Widgets with a recorded disposition",
    value: pct(TOTAL_VERIFIED + TOTAL_UNMAPPED + TOTAL_REFUSED, TOTAL_ANNOTATIONS),
    unit: "%",
    provenance: derived(
      ["verified.annotations", "unmapped", "refused", "widgets.annotations"],
      "100 * (verified.annotations + unmapped + refused) / widgets.annotations",
    ),
    caveat:
      "Not a quality figure, and not on its own a proof of coverage: it is a ratio of record " +
      "counts, so a map that dropped one widget and carried a spare entry for another would " +
      "still read 100%. The set-difference check above — 'Widgets in no bucket at all' — is what " +
      "establishes that nothing was silently dropped. What this row adds is that the counts " +
      "reconcile as well as the sets, which is the weakest useful property of the pipeline and " +
      "the easiest to lose.",
  },
  {
    id: "refusalRate",
    label: "Refusal rate among target-claiming proposals",
    value: pct(TOTAL_REFUSED, TOTAL_VERIFIED + TOTAL_REFUSED),
    unit: "%",
    provenance: derived(
      ["refused", "verified.annotations"],
      "100 * refused / (refused + verified.annotations)",
    ),
    caveat:
      "Denominator excludes the deliberately unmapped widgets, which claimed no target and so " +
      "could not be refused. A low refusal rate is not a quality signal on its own: it means " +
      "the model rarely invented a label, not that it rarely chose the wrong field.",
  },

  // ---- per form ----------------------------------------------------------
  ...results.flatMap((r): Metric[] => [
    {
      id: `form.${r.form}.fields`,
      label: `${r.form} — distinct fields (${r.pages}pp)`,
      value: r.fields,
      provenance: measured(`distinct widget names in src/forms/geometry/${r.form}.json`, AT),
    },
    {
      id: `form.${r.form}.mapped`,
      label: `${r.form} — fields mapped and re-verified`,
      value: r.verifiedFields,
      provenance: measured(
        `distinct fields surviving a fresh admitMappings() run over src/forms/maps/${r.form}.json`,
        AT,
      ),
    },
    {
      id: `form.${r.form}.coverage`,
      label: `${r.form} — coverage`,
      value: pct(r.verifiedFields, r.fields),
      unit: "%",
      provenance: derived(
        [`form.${r.form}.mapped`, `form.${r.form}.fields`],
        `100 * form.${r.form}.mapped / form.${r.form}.fields`,
      ),
    },
  ]),

  // ---- what verification did not catch -----------------------------------
  {
    id: "adjudications",
    label: "Human corrections on record",
    value: ADJUDICATIONS.length,
    provenance: measured("entries in src/forms/adjudications.json", AT),
  },
  {
    id: "adjudications.reverified",
    label: "Corrections that still verify against the page",
    value: sum((r) => r.adjudicationsApplied),
    provenance: measured(
      "adjudicate() re-checked each correction's cited label against the current geometry " +
        `during this run; ${sum((r) => r.adjudicationsRefused)} were refused`,
      AT,
    ),
    caveat:
      "A human is a better judge of which field a box is than a model, and no better at " +
      "remembering what is printed on page two. Corrections are verified like anything else.",
  },
  {
    id: "verifiedButWrong",
    label: "Verified mappings that were wrong anyway",
    value: correctedLive,
    provenance: measured(
      "adjudications whose wasTarget differs from target, and whose corrected target is the " +
        "one now present in the committed map — counted by re-reading both files this run",
      AT,
    ),
    caveat:
      "What is recomputed is that a human changed the target and the change is live. That the " +
      "original mapping had *passed* verification is not recomputable here — revalidate-maps.ts " +
      "rewrote the map with the corrections applied, so the original verdict is gone — and rests " +
      "on the adjudication records, each of which states the wrong mapping reached a generated " +
      "form and so must have been admitted. One put the fiduciary's name in 'Title, if " +
      "applicable'; two wired line 2c, 'are the assets in the control or custody of the court?', " +
      "to a field meaning 'does a court case exist', which ticked Yes on every generated form " +
      "because every sample estate has a proceeding. All three cited a label that is genuinely " +
      "printed there, so no amount of quote checking would have caught any of them.",
  },
  {
    id: "knownWrongRate",
    label: "Known-wrong share of verified mappings",
    value: pct(correctedLive, TOTAL_VERIFIED_FIELDS),
    unit: "%",
    provenance: derived(
      ["verifiedButWrong", "verified.fields"],
      "100 * verifiedButWrong / verified.fields",
    ),
    caveat:
      "A floor, not a rate. It counts errors somebody happened to find by rendering a PDF and " +
      `reading it. The other ${TOTAL_VERIFIED_FIELDS - correctedLive} verified mappings have ` +
      "not been audited that way, so the true error rate is unknown and is not bounded above " +
      "by this number.",
  },
  {
    id: "crosscheckForms",
    label: "Forms with an independent second run to compare",
    value: crosscheckRuns,
    unit: `of ${results.length}`,
    provenance: measured(
      "forms in src/forms/maps-crosscheck that parse and have a counterpart in src/forms/maps",
      AT,
    ),
    caveat:
      "The repository's own note says agreement between independent runs is the only confidence " +
      "signal available short of a human reading the form. It is available for " +
      `${crosscheckRuns} of ${results.length} forms, so for the rest that signal does not exist.`,
  },
  // Omitted entirely, rather than reported as 0%, when there is nothing to
  // compare: an agreement rate over an empty set is not a low score.
  ...(CROSS.compared > 0
    ? [
        {
          id: "crosscheck.compared",
          label: "Fields comparable across two runs",
          value: CROSS.compared,
          provenance: measured(
            "distinct fields mapped by both the committed run and the crosscheck run for the " +
              "same form",
            AT,
          ),
          caveat:
            "Only fields both runs chose to map. A field one run mapped and the other declined " +
            "is not counted as a disagreement, which flatters the agreement figure below.",
        } satisfies Metric,
        {
          id: "crosscheck.agreed",
          label: "Fields where both runs chose the same target",
          value: CROSS.agreed,
          provenance: measured(
            "exact string equality of the target path between the two runs for the same field, " +
              "after un-applying human adjudications from the committed side so that each run " +
              "is represented by its own proposal (wasTarget) rather than by a correction",
            AT,
          ),
          caveat:
            CROSS.overridden > 0
              ? `${CROSS.overridden} of the ${CROSS.compared} comparable fields carry a human ` +
                "override in the committed map. Read straight off that file they would score as " +
                "agreements, because revalidate-maps.ts writes the corrected target back into " +
                "it — and those are the fields the two runs actually disagreed about, so the " +
                `naive figure is ${pct(CROSS.agreed + CROSS.overridden, CROSS.compared).toFixed(2)}% ` +
                `against the ${pct(CROSS.agreed, CROSS.compared).toFixed(2)}% reported here.`
              : "No compared field carries a human override, so the committed map and the run " +
                "that produced it say the same thing on every field in this comparison.",
        } satisfies Metric,
        {
          id: "crosscheck.agreement",
          label: "Target agreement across two runs",
          value: pct(CROSS.agreed, CROSS.compared),
          unit: "%",
          provenance: derived(
            ["crosscheck.agreed", "crosscheck.compared"],
            "100 * crosscheck.agreed / crosscheck.compared",
          ),
          caveat:
            "Agreement is not correctness: two runs can be wrong together, and nothing here " +
            "detects that. Nor is disagreement error — a disagreement says a human should look, " +
            "not which run is right. Computed over " +
            `${CROSS.compared} field${CROSS.compared === 1 ? "" : "s"} on ${crosscheckRuns} ` +
            `form${crosscheckRuns === 1 ? "" : "s"}, too narrow to characterise the pipeline. ` +
            "Note that tools/compare-maps.ts reads the committed maps directly and so does not " +
            "un-apply adjudications; its percentage and this one will differ by exactly the " +
            "overridden fields noted above.",
        } satisfies Metric,
      ]
    : []),

  // ---- speed and cost: what is and is not recorded -----------------------
  ...(CHUNK
    ? [
        {
          id: "modelCalls",
          label: "Model calls a re-run would issue (reconstructed, not observed)",
          value: sum((r) => r.calls ?? 0),
          provenance: measured(
            `per-page widget counts from the committed geometry, chunked at CHUNK=${CHUNK} ` +
              "parsed out of tools/discover-maps.ts, summed as ceil(widgetsOnPage / CHUNK). " +
              "What was counted is real geometry and the tool's real constant; the run itself " +
              "was not executed, so this is arithmetic about a future run, not an observation " +
              "of a past one",
            AT,
          ),
          caveat:
            "Reconstructed from the tool's chunking rule and the real geometry, not read from a " +
            "run log — no run log was committed. An actual run that hit the output cap and was " +
            "retried would issue more. This is the size of the job, not a measurement of one.",
        } satisfies Metric,
      ]
    : []),
  ...(stampSpanMin !== null
    ? [
        {
          id: "stampSpan",
          label: "Span between first and last map timestamp",
          value: stampSpanMin,
          unit: "min",
          provenance: measured(
            `max(discoveredAt) - min(discoveredAt) over the ${stamps.length} committed maps ` +
              "whose timestamp parses",
            AT,
          ),
          caveat:
            `A property of ${stamps.length} timestamps, not a timed run. discover-maps.ts writes ` +
            "each map as it finishes and loops over all forms in one process, so this is most " +
            `likely the elapsed time for the last ${stamps.length - 1} forms — it excludes the ` +
            "first form entirely and would silently include any idle time if the runs were in " +
            "fact separate invocations. Do not quote it as an onboarding duration.",
        } satisfies Metric,
      ]
    : []),
  {
    id: "wallClock",
    label: "End-to-end onboarding wall clock",
    value: "not recorded",
    provenance: assumed(
      "no committed artefact contains a duration; discover-maps.ts prints per-chunk latency to " +
        "stdout and persists none of it, and no run log was kept",
      "re-run tools/discover-maps.ts with WK_KEY set and capture stdout, or have it write " +
        "elapsed ms into the map file so the figure survives the run",
    ),
    caveat:
      "Deliberately left as a placeholder rather than estimated. The timestamp span above is " +
      "the closest thing the repository actually holds, and it is not this.",
  },
  {
    id: "apiCost",
    label: "API cost to onboard all four forms",
    value: "not recorded",
    provenance: assumed(
      "discover-maps.ts totals input and output tokens and prints a dollar figure at the end of " +
        "a run, using a hardcoded price; neither the tokens nor the total is written to disk",
      "re-run tools/discover-maps.ts with WK_KEY set and capture the final line, and confirm " +
        "the hardcoded per-token price against current published pricing before quoting it",
    ),
  },
  {
    id: "humanBaseline",
    label: `Human time to map the same ${TOTAL_FIELDS} fields`,
    value: "not measured",
    provenance: assumed(
      "nobody has been timed hand-mapping these forms, and no published figure for the task has " +
        "been read; without it, no speedup can be stated at all",
      "time a paralegal or forms specialist hand-mapping one of these four forms from the PDF, " +
        "or ask Alix for the internal figure for onboarding a new form",
    ),
    caveat:
      "This is the denominator every 'N times faster' claim needs. It is absent, so this " +
      "benchmark makes no such claim.",
  },
];

export const BENCHMARK: Benchmark = {
  id: "onboarding",
  title: "Onboarding an unseen government form",
  question:
    "When the system is handed a fillable government form it has never seen, how much of it " +
    "can it map with evidence, how much does it refuse, and what does the mapping still get " +
    "wrong after passing every check?",
  metrics,
  limits: [
    "Coverage is not correctness. verifyMapping proves the quoted label is printed next to " +
      `that widget and nothing more. ${correctedLive} of the ${TOTAL_VERIFIED_FIELDS} verified ` +
      "mappings were wrong and were caught only by a human rendering a PDF and reading it.",
    "The known-wrong count is a floor with no ceiling. No independent audit of the remaining " +
      `${TOTAL_VERIFIED_FIELDS - correctedLive} verified mappings exists, so nothing here ` +
      "bounds the error rate from above, and three errors is far too few to estimate one from.",
    "Nothing here is a speed measurement. No committed artefact records wall clock, token " +
      `counts or cost; the timestamp span is a property of ${stamps.length} strings in ` +
      `${stamps.length} files, and the model-call count is reconstructed arithmetic about a run ` +
      "nobody executed.",
    "No baseline of any kind. There is no measured or sourced figure for how long a human takes " +
      "to map these fields, so no saving, multiple or ROI can be computed from this benchmark.",
    `${results.length} forms is not a sample. Three are IRS forms sharing one field-naming ` +
      "convention and one extractor; the fourth is a California DMV form. Per-form results vary " +
      `from ${coverageLow.toFixed(2)}% to ${coverageHigh.toFixed(2)}% coverage — a spread of ` +
      `${(coverageHigh - coverageLow).toFixed(2)} points across four forms — and nothing here ` +
      "supports projecting a rate onto an unseen form, let alone onto fifty states and three " +
      "thousand counties.",
    "The widget geometry is taken on trust. Counts come from JSON produced by tools/geometry.py " +
      "against PDFs in samples/, which is gitignored, so this module cannot re-derive a widget " +
      "count from the source PDFs. A widget the extractor missed is invisible to every figure " +
      `above, including the ${sum((r) => r.unaddressed)} 'unaddressed' check.`,
    "The unmapped bucket is unverified by construction. Its reasons are prose written by the " +
      "same model that produced the mappings; a field wrongly declared to have no record source " +
      "yields a blank box on every generated form and no check here reports it.",
    "The refusal count is what one run refused, not what the approach refuses. Maps are " +
      "regenerated in place, so earlier runs' refusals are overwritten and no history survives. " +
      `An independent second run exists for ${crosscheckRuns} of ${results.length} forms, so ` +
      "the cross-run agreement figure, where present, generalises no further than that.",
    "Says nothing about acceptance. A filled form that maps every field correctly may still be " +
      "rejected by the IRS or the DMV for reasons no part of this pipeline models.",
  ],
};

// Run standalone:  BENCH_PRINT=1 npx vite-node bench/onboarding.ts
//
// The env var is not optional under vite-node. Its CLI leaves process.argv as
// [node, cli.mjs] — the entry file is absent, verified by probe — so the argv
// test below cannot fire and the bare `npx vite-node bench/onboarding.ts`
// computes everything and prints nothing, exiting 0. Documenting the bare form
// would be documenting a silent no-op. The argv test is kept because it does
// work under tsx and under node's own TS stripping.
//
// Both are guards rather than an unconditional call, so a suite that imports
// this module for report() does not get console noise mixed into its output.
const asEntry =
  process.argv.some((a) => a.replace(/\\/g, "/").endsWith("bench/onboarding.ts")) ||
  Boolean(process.env.BENCH_PRINT);
if (asEntry) print(BENCHMARK);
