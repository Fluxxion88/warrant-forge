// What would this be worth per estate?
//
// This is the benchmark that wants to lie. Every other module here counts
// something that exists; this one is asked for a dollar figure, and a dollar
// figure needs a denominator nobody in this repo has. The tempting move is to
// pick a plausible "12 hours per estate at $180/hour", let arithmetic do the
// rest, and print a number with a dollar sign on it — at which point the
// project's entire argument, that a claim without a warrant is not evidence,
// has been abandoned on the one slide anyone will actually remember.
//
// So the module is built in two clearly separated halves.
//
// The lower half is measured. It runs the real pipeline — `importEstate`,
// `decide` over the real applicability rules, `fillForm` over the real
// discovered field maps — against the five estate records Alix supplied, and
// counts boxes. Those counts are reproducible by re-running this file. They are
// the actual contribution.
//
// The upper half is a model with three unsourced inputs: how long an estate
// takes, what share of that goes on forms, and what an hour costs. All three
// are `assumed()` with placeholder values chosen to be obviously round, so that
// no reader mistakes them for research. Everything computed from them is
// `derived()`, which makes `taint()` mark it assumption-tainted and `report()`
// print it in bold with the word ASSUMED attached. That is the intended
// outcome: the money row should look like what it is.
//
// Two things are refused outright and named in `limits`: an industry baseline
// (we have not read one, so there is none here, cited or otherwise), and any
// extrapolation from one estate to a portfolio.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  assumed,
  derived,
  measured,
  print,
  type Benchmark,
  type Metric,
} from "./harness";

import { importEstate, type EstateRecord } from "../src/lib/estate";
import { fillForm, toFillPayload } from "../src/lib/fill";
import { values } from "../src/lib/facts";
import { decide } from "../src/lib/rules";
import { FORM_RULES, form56Overrides } from "../src/rules/form-applicability";
import type { FieldMap, FormGeometry } from "../src/lib/formmap";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAPS = join(ROOT, "src/forms/maps");
const GEOM = join(ROOT, "src/forms/geometry");
const SAMPLES = join(ROOT, "samples/track3");
const RECORDED = join(ROOT, "src/fixtures/recorded-extraction.json");

const r2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Render a per-form tally as prose.
 *
 * Exists so that no caveat has to *assert* which forms a count is made of. An
 * earlier version of this module said in prose that three of the five estates
 * "must not receive a DL 142"; the run says two were positively declined and a
 * third was blocked on an unknown licence state, which is a different claim.
 * Composition is counted from now on.
 */
const breakdown = (tally: Record<string, number>): string => {
  const parts = Object.entries(tally)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([form, n]) => `${n}x ${form}`);
  return parts.length ? parts.join(", ") : "none";
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

// ---------------------------------------------------------------------------
// The form library: what is mapped, and what is not
// ---------------------------------------------------------------------------

const maps = readdirSync(MAPS)
  .filter((f) => f.endsWith(".json"))
  .map((f) => readJson<FieldMap>(join(MAPS, f)));

const geometries = readdirSync(GEOM)
  .filter((f) => f.endsWith(".json"))
  .map((f) => readJson<FormGeometry>(join(GEOM, f)));

/**
 * Distinct widget *names*, not widget instances.
 *
 * DL 142 is a three-part notice: the same AcroForm field is rendered at several
 * places on the page under one name, so 52 widget rectangles carry only 28
 * names. Writing one value puts ink in three boxes. Counting the rectangles
 * inflates every automation figure by a factor that varies per form, so
 * everything below is counted by name and the instance count is reported
 * separately rather than quietly used as a denominator.
 */
const widgetInstances = geometries.reduce((a, g) => a + g.widgets.length, 0);
const widgetNames = geometries.reduce(
  (a, g) => a + new Set(g.widgets.map((w) => w.name)).size,
  0,
);

/**
 * Distinct widget names per form, straight off the geometry.
 *
 * This is the only denominator that can honestly be called "every box on the
 * page", so it is carried per form rather than only in aggregate: the ratios
 * below have to be able to ask it about the forms a given estate generated.
 */
const namesByForm = new Map<string, number>(
  geometries.map((g) => [g.form, new Set(g.widgets.map((w) => w.name)).size]),
);

/** Per form: how many distinct widgets the map addresses, and how many it does not. */
const unmappedByForm = new Map<string, number>();
const mappedByForm = new Map<string, number>();
let mappedWidgets = 0;
let unmappedWidgets = 0;

for (const m of maps) {
  const mapped = new Set(m.entries.map((e) => e.field));
  const left = new Set([
    ...m.unmapped.map((e) => e.field),
    ...m.rejected.map((e) => e.field),
  ]);
  for (const f of mapped) left.delete(f);
  mappedWidgets += mapped.size;
  unmappedWidgets += left.size;
  unmappedByForm.set(m.form, left.size);
  mappedByForm.set(m.form, mapped.size);
}

// ---------------------------------------------------------------------------
// The run: real rules, real records, real fill
// ---------------------------------------------------------------------------

/** Which decision point governs each form. Mirrors tools/fill-forms.ts. */
const GOVERNS: Record<string, string> = {
  "ca-dl142": "form_dl142",
  "irs-ss4": "form_ss4",
  "irs-56": "form_56",
  "irs-8821": "form_8821",
};

const AFFIRMATIVE = new Set([
  "form.dl142.applies",
  "form.ss4.needed",
  "form.56.needed",
  "form.8821.needed",
]);

interface Run {
  estates: number;
  /** (estate, form) pairs the rules said to file. */
  formsGenerated: number;
  /** Pairs a rule positively declined — "SS-4 not required, EIN already held". */
  formsDeclined: number;
  /** Pairs no rule could decide, because a fact is missing. Three-valued logic. */
  formsBlocked: number;
  /** Distinct widgets the engine wrote a value or a tick into. */
  boxesWritten: number;
  /** Mapped widgets whose record path held nothing. */
  boxesEmpty: number;
  /** Mapped widgets whose path does not exist in the record at all — map drift. */
  boxesBroken: number;
  /** Widgets on the generated forms that carry no mapping at all. */
  boxesUnmapped: number;
  /**
   * Mapped checkboxes the engine looked at and deliberately did not tick,
   * because the condition governing them evaluated false.
   *
   * This bucket is the reason this module now reports three ratios instead of
   * two. It is large — larger than the gaps — and it is neither a populated box
   * nor a gap, so a ratio of written/(written+gaps+broken) silently drops it and
   * is therefore *not* a share of the mapped boxes, however it is labelled.
   */
  boxesConditionFalse: number;
  /**
   * Mapped widgets that reach none of the buckets above. Non-zero only because
   * the Form 56 rule pack clears boxes the field map had filled, so they end up
   * neither written nor named as a gap. Reported so the accounting closes.
   */
  boxesUnaccounted: number;
  /** Every widget a map addresses, summed over the generated forms. */
  mappedOnGeneratedForms: number;
  /** Every distinct widget name printed on the generated forms. */
  widgetsOnGeneratedForms: number;
  /** Form 56 line-1 groups the rule pack refused to decide. */
  unresolvedByRule: number;
  /** Which forms the positive declines and the blocks belong to. Counted, not asserted. */
  declinedByForm: Record<string, number>;
  blockedByForm: Record<string, number>;
  /** Wall clock for import + decide + fill across every estate. */
  millis: number;
}

function runPipeline(records: EstateRecord[]): Run {
  const out: Run = {
    estates: records.length,
    formsGenerated: 0,
    formsDeclined: 0,
    formsBlocked: 0,
    boxesWritten: 0,
    boxesEmpty: 0,
    boxesBroken: 0,
    boxesUnmapped: 0,
    boxesConditionFalse: 0,
    boxesUnaccounted: 0,
    mappedOnGeneratedForms: 0,
    widgetsOnGeneratedForms: 0,
    unresolvedByRule: 0,
    declinedByForm: {},
    blockedByForm: {},
    millis: 0,
  };

  const t0 = performance.now();
  for (const record of records) {
    const { facts } = importEstate(record);
    const v = values(facts);
    const state = record.estateEntity.principalState ?? "CA";
    const decisions = decide(FORM_RULES, v, {
      state,
      // `?? undefined` rather than passing the record's null through: the venue
      // type says `county?: string`, and tools/fill-forms.ts hands it the raw
      // nullable field. Harmless for FORM_RULES, every one of which is scoped
      // `state: "*"` with no county, but this module is typechecked and that one
      // is not, so the coercion happens here.
      county: record.estateEntity.principalCounty ?? undefined,
    });

    for (const map of maps) {
      const d = decisions.find((x) => x.decisionPoint === GOVERNS[map.form]);
      if (!d?.chosen) {
        out.formsBlocked++;
        out.blockedByForm[map.form] = (out.blockedByForm[map.form] ?? 0) + 1;
        continue;
      }
      if (!AFFIRMATIVE.has(d.chosen.ruleId)) {
        out.formsDeclined++;
        out.declinedByForm[map.form] = (out.declinedByForm[map.form] ?? 0) + 1;
        continue;
      }

      const filling = fillForm(map, record);
      const payload = toFillPayload(filling);

      // Form 56 lines 1 and 2 are owned by the rule pack, not the field map.
      // Replicated from tools/fill-forms.ts so this counts the boxes that
      // actually reach the PDF rather than the field map's intermediate view.
      if (map.form === "irs-56") {
        const ov = form56Overrides(record);
        for (const k of ov.clear) delete payload[k];
        Object.assign(payload, ov.set);
        out.unresolvedByRule += ov.unresolved.length;
      }

      const written = new Set(Object.keys(payload));
      // A widget written by one entry and left empty by a duplicate entry is
      // written, not a gap.
      const empty = new Set(
        filling.gaps.map((g) => g.field).filter((n) => !written.has(n)),
      );
      const broken = new Set(
        filling.broken.map((b) => b.field).filter((n) => !written.has(n)),
      );
      // A mapped checkbox whose condition came back false. Deduplicated against
      // the other buckets so a widget is counted exactly once, which is what
      // lets the accounting below be checked rather than trusted.
      const conditionFalse = new Set(
        filling.fields
          .filter((f) => f.status === "condition_false")
          .map((f) => f.field)
          .filter((n) => !written.has(n) && !empty.has(n) && !broken.has(n)),
      );

      const mappedHere = mappedByForm.get(map.form) ?? 0;

      out.formsGenerated++;
      out.boxesWritten += written.size;
      out.boxesEmpty += empty.size;
      out.boxesBroken += broken.size;
      out.boxesUnmapped += unmappedByForm.get(map.form) ?? 0;
      out.boxesConditionFalse += conditionFalse.size;
      out.mappedOnGeneratedForms += mappedHere;
      out.widgetsOnGeneratedForms += namesByForm.get(map.form) ?? 0;
      out.boxesUnaccounted += Math.max(
        0,
        mappedHere - (written.size + empty.size + broken.size + conditionFalse.size),
      );
    }
  }
  out.millis = performance.now() - t0;
  return out;
}

const haveSamples = existsSync(SAMPLES);
const records: EstateRecord[] = haveSamples
  ? readdirSync(SAMPLES)
      .filter((f) => f.startsWith("estate-") && f.endsWith(".json"))
      .map((f) => readJson<EstateRecord>(join(SAMPLES, f)))
  : [];

const run = records.length ? runPipeline(records) : null;

/**
 * Counted, not asserted. Two caveats below used to state in prose how many of
 * the sample estates are California; if the sample ever changes, prose goes
 * stale silently and a count does not.
 */
const californiaRecords = records.filter(
  (r) => r.estateEntity.principalState === "CA",
).length;

// ---------------------------------------------------------------------------
// The cost side, in tokens — deliberately not in dollars
// ---------------------------------------------------------------------------

interface RecordedRun {
  model: string;
  documents: string[];
  inputTokens: number;
  outputTokens: number;
}

const extraction = existsSync(RECORDED) ? readJson<RecordedRun>(RECORDED) : null;

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

const metrics: Metric[] = [];

// --- measured: the form library -------------------------------------------

metrics.push(
  {
    id: "forms.mapped",
    label: "Government forms with a verified field map",
    value: maps.length,
    provenance: measured(`counted the *.json field maps in src/forms/maps`),
    caveat:
      "Four forms. A real estate touches more than four, so every per-estate " +
      "figure below is per estate restricted to these four.",
  },
  {
    id: "widgets.instances",
    label: "Fillable widget rectangles on those forms",
    value: widgetInstances,
    provenance: measured(`summed widgets[] across src/forms/geometry/*.json`),
  },
  {
    id: "widgets.names",
    label: "Distinct widget names on those forms",
    value: widgetNames,
    provenance: measured(`counted unique widget.name per form in src/forms/geometry`),
    caveat:
      "Lower than the rectangle count because DL 142 renders one field in " +
      "several places. Everything below counts names, so one value is not " +
      "credited as three filled boxes.",
  },
  {
    id: "widgets.mapped",
    label: "Widgets a verified mapping addresses",
    value: mappedWidgets,
    provenance: measured(`distinct entries[].field across src/forms/maps/*.json`),
    caveat:
      "Verification proves the model quoted a label that is really printed " +
      "next to the box. It does not prove the box is the right destination.",
  },
  {
    id: "widgets.unmapped",
    label: "Widgets with no mapping at all",
    value: unmappedWidgets,
    provenance: measured(
      `distinct unmapped[].field + rejected[].field, minus anything also mapped`,
    ),
    caveat:
      "NOT TRIAGED. Some of these are Print and Clear Form buttons and " +
      "For-IRS-Use-Only boxes that no human fills either; some may be boxes a " +
      "human must fill by hand. Nobody has gone through them. This is one of the " +
      "two reasons the automation ratio is reported three times below rather " +
      "than once.",
  },
);

// --- measured: the run ------------------------------------------------------

if (run) {
  metrics.push(
    {
      id: "estates.sampled",
      label: "Estate records the pipeline was run over",
      value: run.estates,
      provenance: measured(`parsed samples/track3/estate-*.json`),
      caveat:
        `Alix's Track 3 samples. ${run.estates} records is a sample, not a ` +
        `distribution, and ${californiaRecords} of the ${run.estates} are ` +
        `California — the only state this rule pack covers.`,
    },
    {
      id: "forms.generated",
      label: "Forms the rules said to file, across all estates",
      value: run.formsGenerated,
      provenance: measured(
        `ran importEstate + decide(FORM_RULES) + fillForm over every (estate, form) pair`,
      ),
    },
    {
      id: "forms.declined",
      label: "Forms a rule positively declined",
      value: run.formsDeclined,
      provenance: measured(`decisions whose chosen rule is not in the AFFIRMATIVE set`),
      caveat:
        `Composition, counted rather than asserted: ${breakdown(run.declinedByForm)}. ` +
        "Not filling a form is work too, and a filler that produced one anyway " +
        "would look like it was working. No value is claimed for these below. A " +
        "positive decline is not the same thing as the blocked row that follows: " +
        "declined means a rule fired and said no, blocked means no rule could " +
        "tell — so a form absent from an estate's output may be either.",
    },
    {
      id: "forms.blocked",
      label: "Form decisions no rule could reach",
      value: run.formsBlocked,
      provenance: measured(`decisions with no chosen rule — a required fact is unknown`),
      caveat:
        `Composition: ${breakdown(run.blockedByForm)}. Three-valued logic ` +
        "refusing to guess: the record does not state a licence state, so the " +
        "pack will neither produce a DL 142 nor rule one out. Counted here " +
        "because it is a form the system did not produce, and any honest " +
        "per-estate figure has to show that residue rather than drop it.",
    },
    {
      id: "boxes.broken",
      label: "Boxes mapped to a path the record does not have",
      value: run.boxesBroken,
      unit: "boxes",
      provenance: measured(`FormFilling.broken (status "path_missing") across every fill`),
      caveat:
        "Map-versus-schema drift. Zero is the expected value and means only " +
        "that these maps match these five records; it says nothing about the " +
        "next schema version.",
    },
    {
      id: "boxes.unresolvedByRule",
      label: "Form 56 line-1 groups the rule pack refused to decide",
      value: run.unresolvedByRule,
      provenance: measured(`form56Overrides().unresolved, summed over every Form 56 fill`),
      caveat:
        "Zero across these five estates. The refusal path exists — an " +
        "unrecognised authority basis ticks nothing — it just was not exercised " +
        "here, so this measures the sample, not the safeguard.",
    },
    {
      id: "runtime.fill.ms",
      label: "Import, rule evaluation and fill, all estates",
      value: r2(run.millis),
      unit: "ms",
      provenance: measured(`performance.now() around the loop in this module`),
      caveat:
        "Not the cost of operating the system. Excludes the Python geometry " +
        "pass, the paid model run that discovered the maps, and PDF writing. " +
        "Machine-dependent.",
    },
  );
}

// Everything below divides by the generated-form count. Omitted rather than
// reported as NaN if the rules decline every form on every record.
if (run && run.formsGenerated > 0) {
  metrics.push(
    {
      id: "boxes.written.perEstate",
      label: "Boxes the engine writes, per estate",
      value: r2(run.boxesWritten / run.estates),
      unit: "boxes",
      provenance: measured(
        `distinct keys of toFillPayload() (plus rule-pack Form 56 overrides), ` +
          `summed over each estate's applicable forms, divided by ${run.estates} estates`,
      ),
      caveat:
        "Boxes written, not boxes correct. fill.ts reports what it populated; " +
        "two verified, plausible mappings in adjudications.json were wrong and " +
        "were caught only by rendering the PDF and reading it.",
    },
    {
      id: "boxes.written.perForm",
      label: "Boxes the engine writes, per generated form",
      value: r2(run.boxesWritten / run.formsGenerated),
      unit: "boxes",
      provenance: measured(
        `same payload keys, divided by the ${run.formsGenerated} generated forms`,
      ),
    },
    {
      id: "boxes.empty.perForm",
      label: "Gaps surfaced, per generated form",
      value: r2(run.boxesEmpty / run.formsGenerated),
      unit: "boxes",
      provenance: measured(
        `FormFilling.gaps (status "empty_in_record") from src/lib/fill.ts, ` +
          `deduplicated by widget name`,
      ),
      caveat:
        "Over-counts human work. This bucket mixes a box a human must chase — " +
        "Form 56's docket number — with a box that is simply blank on a valid " +
        "form, such as Form 8821's second designee slot for an estate with one " +
        "adviser. fill.ts distinguishes them in the note; this count does not.",
    },
    {
      id: "boxes.empty.perEstate",
      label: "Gaps surfaced, per estate",
      value: r2(run.boxesEmpty / run.estates),
      unit: "boxes",
      provenance: measured(`same gaps, divided by ${run.estates} estates`),
    },
    {
      id: "boxes.unmapped.perEstate",
      label: "Unmapped widgets on the forms generated for an estate",
      value: r2(run.boxesUnmapped / run.estates),
      unit: "boxes",
      provenance: measured(
        `per generated form, its map's untriaged unmapped+rejected widget count, ` +
          `summed and divided by ${run.estates} estates`,
      ),
      caveat:
        "Inherits the untriaged problem from widgets.unmapped. Larger than the " +
        "number of boxes written, which is exactly why it must not be omitted.",
    },
    {
      id: "boxes.conditionFalse.perEstate",
      label: "Mapped checkboxes the engine deliberately left unticked, per estate",
      value: r2(run.boxesConditionFalse / run.estates),
      unit: "boxes",
      provenance: measured(
        `FormFilling.fields with status "condition_false", deduplicated by widget ` +
          `name against the written, empty and broken sets, divided by ${run.estates} estates`,
      ),
      caveat:
        "A mapped box the engine read a fact for and decided not to tick — the " +
        "'No' half of a yes/no pair, a filing-status box for a status this " +
        "estate does not have. It is neither populated nor a gap, so any ratio " +
        "of written/(written+gaps) drops it silently. It is bigger than the gap " +
        "count, and it is the main reason three ratios follow instead of one.",
    },
    {
      id: "boxes.mapped.perEstate",
      label: "Mapped widgets on the forms generated for an estate",
      value: r2(run.mappedOnGeneratedForms / run.estates),
      unit: "boxes",
      provenance: measured(
        `per generated form, its map's distinct entries[].field count, summed and ` +
          `divided by ${run.estates} estates`,
      ),
    },
    {
      id: "widgets.onGeneratedForms.perEstate",
      label: "Widget names printed on the forms generated for an estate",
      value: r2(run.widgetsOnGeneratedForms / run.estates),
      unit: "boxes",
      provenance: measured(
        `per generated form, its geometry's distinct widget-name count, summed ` +
          `and divided by ${run.estates} estates`,
      ),
      caveat:
        "Every box, tick and button on the pages the engine produced. The mapped " +
        "and unmapped rows above sum to exactly this, which is the arithmetic " +
        "check that no widget is double-counted or lost between the two.",
    },
    // Three denominators, not two.
    //
    // The first version of this module reported two ratios and described them as
    // "share of mapped boxes" and "share of all widgets". Neither description
    // was true: both denominators were built by adding up the buckets fill.ts
    // reports on, and fill.ts has a fourth status — condition_false — that was
    // in no bucket. That silently removed the deliberately-unticked checkboxes
    // from the accounting and flattered the engine in both directions, 0.83
    // where the mapped share is 0.52 and 0.43 where the full share is 0.33.
    // The denominators below are now taken from the artefacts (the maps, the
    // geometry) rather than assembled from the buckets, so they mean what their
    // labels say.
    {
      id: "ratio.ofReportedBoxes",
      label: "Share of the boxes fill.ts reported on that the engine populates",
      value: r2(run.boxesWritten / (run.boxesWritten + run.boxesEmpty + run.boxesBroken)),
      provenance: derived(
        ["boxes.written.perEstate", "boxes.empty.perEstate", "boxes.broken"],
        "written / (written + empty + broken). The first two are per estate; " +
          "boxes.broken is a run total, so divide it by the estate count before " +
          "combining — at zero that changes nothing, but the formula is only " +
          "reproducible as written once it stops being zero",
      ),
      caveat:
        `The narrowest and most flattering denominator here, and narrower than ` +
        `any phrase containing "mapped": it counts only the widgets fill.ts ` +
        `wrote or named as a gap. The ${r2(run.boxesConditionFalse / run.estates)} ` +
        `deliberately-unticked checkboxes per estate are in neither the ` +
        `numerator nor the denominator, and neither are the ` +
        `${r2(run.boxesUnaccounted / run.estates)} per estate the Form 56 rule ` +
        `pack clears after the map filled them. Do not read this as the share of ` +
        `the mapped boxes — that is the next row, and it is much lower.`,
    },
    {
      id: "ratio.ofMappedWidgets",
      label: "Share of the mapped widgets on those forms the engine populates",
      value: r2(run.boxesWritten / run.mappedOnGeneratedForms),
      provenance: derived(
        ["boxes.written.perEstate", "boxes.mapped.perEstate"],
        "written / mapped, both per estate — the denominator is every widget a " +
          "verified map addresses on the forms this run actually generated, " +
          "taken from the maps rather than from the fill result",
      ),
      caveat:
        "This is what 'share of mapped boxes' means when the denominator is " +
        "actually the mapped boxes. The difference from the row above is not " +
        "failure: most of the shortfall is checkboxes correctly left unticked. " +
        "It is reported because a reader told only the higher number would " +
        "believe the engine had populated four in five mapped boxes.",
    },
    {
      id: "ratio.ofAllWidgets",
      label: "Share of all widget names on those forms the engine populates",
      value: r2(run.boxesWritten / run.widgetsOnGeneratedForms),
      provenance: derived(
        ["boxes.written.perEstate", "widgets.onGeneratedForms.perEstate"],
        "written / every distinct widget name on the generated forms, both per " +
          "estate, the denominator taken from the geometry",
      ),
      caveat:
        `The punishing denominator, and now genuinely punishing: every widget ` +
        `printed on those pages, including Print and Clear Form buttons nobody ` +
        `fills. The number a reader actually wants is somewhere between this row ` +
        `and the one above it, and this benchmark cannot say where, because the ` +
        `${unmappedWidgets} unmapped widgets have never been triaged.`,
    },
  );
}

// --- measured: cost side, in tokens ----------------------------------------

if (extraction) {
  metrics.push(
    {
      id: "cost.extraction.inputTokens",
      label: "Model input tokens, recorded extraction run",
      value: extraction.inputTokens,
      unit: "tokens",
      provenance: measured(`read inputTokens from src/fixtures/recorded-extraction.json`),
      caveat:
        `One real run of ${extraction.model} over ${extraction.documents.length} ` +
        `documents for one synthetic estate. This is Track 1 fact extraction, not ` +
        `the form pipeline — the form fill path above makes no model call at run ` +
        `time, because the maps were discovered once, offline.`,
    },
    {
      id: "cost.extraction.outputTokens",
      label: "Model output tokens, recorded extraction run",
      value: extraction.outputTokens,
      unit: "tokens",
      provenance: measured(`read outputTokens from src/fixtures/recorded-extraction.json`),
      caveat:
        "Deliberately not converted to dollars. See limits: the catalog price " +
        "for this provider is documented as stale and under-counting, so a " +
        "dollar figure here would be a number we already know is wrong.",
    },
  );
}

// --- assumed: the three inputs the money rests on --------------------------

const HOURS_PER_ESTATE = 10;
const SHARE_ON_FORMS = 0.25;
/**
 * The team's own figure: $70 an hour, fully loaded — salary plus benefits,
 * payroll tax and the rest.
 *
 * No longer a deliberately-round placeholder, but still an assumption rather
 * than a measurement, so it stays `assumed()` and everything computed from it
 * stays tainted. What it now has going for it is corroboration: independent
 * research into BLS OEWS wages and the ECEC benefit load puts a fully-loaded
 * chargeable hour between $58 and $102 with a central estimate of $74, so $70
 * sits inside that range and slightly below its middle. See
 * docs/specialist-cost.md for the arithmetic.
 */
const COST_PER_HOUR = 70;

metrics.push(
  {
    id: "assume.hoursPerEstate",
    label: "Baseline hours per estate (PLACEHOLDER)",
    value: HOURS_PER_ESTATE,
    unit: "hours",
    provenance: assumed(
      "PLACEHOLDER. Not sourced, not researched, not an estimate. A round " +
        "number chosen precisely because it is obviously round, so that nobody " +
        "can mistake it for a finding.",
      "Alix. The team's understanding is that Alix has published a figure for " +
        "administrative hours per estate — somebody must retrieve that " +
        "publication and cite it. We have not read it, and guessing a number " +
        "that a real published figure would contradict is worse than leaving " +
        "this blank.",
    ),
    caveat: "Change this and every dollar figure below moves in proportion.",
  },
  {
    id: "assume.shareOnForms",
    label: "Share of those hours spent on form preparation (PLACEHOLDER)",
    value: SHARE_ON_FORMS,
    provenance: assumed(
      "PLACEHOLDER. Nobody has measured how estate-administration time splits " +
        "between paperwork and everything else.",
      "Alix, from time-tracking or matter-billing data. Present as its own " +
        "assumption rather than folded into the hours figure, because the " +
        "engine only touches forms: it cannot shorten asset discovery, " +
        "creditor notice or a call with a beneficiary, and a model that hides " +
        "this factor silently claims it can.",
    ),
  },
  {
    id: "assume.costPerHour",
    label: "Loaded cost of a specialist hour",
    value: COST_PER_HOUR,
    unit: "USD/hour",
    provenance: assumed(
      "The team's figure: fully loaded, salary plus benefits and payroll tax. " +
        "An assumption rather than a measurement, so anything derived from it " +
        "stays marked — but a corroborated one. Independent research into BLS " +
        "OEWS wages and the ECEC benefit load puts a fully-loaded chargeable " +
        "hour at $58 low, $74 central, $102 high; $70 sits inside that range " +
        "and a little below its middle.",
      "Alix's own payroll, to replace a defensible outside estimate with the " +
        "internal number. See docs/specialist-cost.md for the derivation of the " +
        "range this sits in.",
    ),
    caveat:
      "Corroborated by outside data but not measured inside Alix. Every dollar " +
      "figure below inherits that status.",
  },
);

// --- derived from the assumptions: the money -------------------------------

const formHours = HOURS_PER_ESTATE * SHARE_ON_FORMS;

metrics.push({
  id: "model.formHoursPerEstate",
  label: "Form-preparation hours per estate (modelled)",
  value: r2(formHours),
  unit: "hours",
  provenance: derived(
    ["assume.hoursPerEstate", "assume.shareOnForms"],
    "hoursPerEstate * shareOnForms",
  ),
  caveat: "Both inputs are placeholders, so this is a placeholder times a placeholder.",
});

if (run) {
  // The two ends of the ratio ladder, so the swing a denominator choice buys is
  // visible in dollars rather than argued about in prose.
  const ratioReported =
    run.boxesWritten / (run.boxesWritten + run.boxesEmpty + run.boxesBroken);
  const ratioAll = run.boxesWritten / run.widgetsOnGeneratedForms;

  metrics.push(
    {
      id: "model.valuePerEstate.reportedDenominator",
      label: "Modelled value per estate, reported-box denominator",
      value: r2(formHours * ratioReported * COST_PER_HOUR),
      unit: "USD",
      provenance: derived(
        ["model.formHoursPerEstate", "ratio.ofReportedBoxes", "assume.costPerHour"],
        "formHoursPerEstate * ratio.ofReportedBoxes * costPerHour",
      ),
      caveat:
        "NOT EVIDENCE. Every dollar of this comes from three placeholders, and " +
        "the step from 'share of boxes populated' to 'share of hours removed' " +
        "is an equivalence nobody has tested. It also uses the most flattering " +
        "of the three ratios, so it is the highest number this module can " +
        "honestly print and should be read as the ceiling of a worked example.",
    },
    {
      id: "model.valuePerEstate.allWidgetDenominator",
      label: "Modelled value per estate, all-widget denominator",
      value: r2(formHours * ratioAll * COST_PER_HOUR),
      unit: "USD",
      provenance: derived(
        ["model.formHoursPerEstate", "ratio.ofAllWidgets", "assume.costPerHour"],
        "formHoursPerEstate * ratio.ofAllWidgets * costPerHour",
      ),
      caveat:
        "Same model, other end of the ladder. The distance between this row and " +
        "the one above is not uncertainty about the software — the software did " +
        "the same thing in both — it is two pieces of missing bookkeeping: the " +
        "untriaged unmapped widgets, and the checkboxes correctly left unticked " +
        "that the higher ratio excludes from its denominator.",
    },
  );
}

export const BENCHMARK: Benchmark = {
  id: "economics",
  title: "Economics — what would this be worth per estate?",
  question:
    "How much of an estate's form work does the engine actually do, and what " +
    "would have to be true about hours and rates before that could be turned " +
    "into money?",
  metrics,
  limits: [
    "No dollar figure here is evidence. All three inputs the money rests on — " +
      "hours per estate, the share of those hours spent on forms, and the cost " +
      "of an hour — are unsourced placeholders. They are marked ASSUMED, and " +
      "every figure computed from them is marked as derived from an assumption. " +
      "Read those rows as a worked example of the arithmetic, not as a result.",

    "No industry baseline appears here, cited or otherwise. We have not read an " +
      "Alix figure for hours per estate and have not looked one up elsewhere. " +
      "Nothing in this module may be quoted as an industry comparison, and the " +
      "absence of a `cited` row anywhere in it is the point.",

    "The measured ratios count boxes, not time. Nobody has established that " +
      "populating a box removes a proportional share of the work. It plausibly " +
      "does not: the boxes Form 56 leaves empty include the court address, the " +
      "court room or suite, the docket number and whether assets are under court " +
      "control — the ones that require a phone call, not a lookup. They are not " +
      "the only ones (the same list holds the fiduciary's address line 2, which " +
      "costs nobody anything), so this is a counter-example to box-share being " +
      "hour-share, not a tally of the hard boxes. The step from box-share to " +
      "hour-share is the weakest joint in this module and it is an assumption " +
      "wearing a measurement's clothes.",

    "Boxes written is not boxes correct. `fill.ts` reports what it populated, " +
      "not whether the value belongs where it went. Two mappings now in " +
      "`adjudications.json` were verified, plausible and wrong, and were caught " +
      "only by rendering the PDF and reading it. This benchmark counts ink.",

    `n = ${records.length} estates and ${maps.length} forms, all Alix samples. ` +
      `${californiaRecords} of them are California. The fill rate on a state ` +
      "this rule pack does not cover is unknown, and the engine would decline or " +
      "block rather than fill — which is safe but is not value.",

    `The automation ratio is reported against three denominators, for two ` +
      `separate reasons, and a single headline percentage would have to suppress ` +
      `one of them. First, the ${unmappedWidgets} widgets these maps leave ` +
      "unmapped have never been triaged: some are Print and Clear Form buttons " +
      "and For-IRS-Use-Only boxes no human fills either, some may be real manual " +
      "work, and nobody has classified them. Second, a mapped checkbox the " +
      "engine deliberately leaves unticked is neither a populated box nor a gap, " +
      "and whether it belongs in the denominator is a judgement, not a " +
      "measurement — so it is excluded from the narrowest ratio, included in the " +
      "other two, and counted on its own row so the choice is visible. Until the " +
      "triage exists, none of the three is the number a reader wants and this " +
      "module cannot narrow the range.",

    "The gap count over-states human work in the other direction: it does not " +
      "separate a box that must be chased from a box that is correctly blank on " +
      "a valid form, such as Form 8821's second designee slot.",

    "Model cost is reported in tokens, not dollars. `CLAUDE.md` documents the " +
      "catalog price for non-Anthropic providers as known-stale and " +
      "under-counting, and the recorded run used one. A dollar figure computed " +
      "from a price table we already know is wrong would be worse than no figure.",

    "No extrapolation to a portfolio. This module deliberately does not multiply " +
      "a per-estate number by a number of estates. With three unsourced inputs, " +
      "scaling multiplies the error and nothing else.",

    "Nothing here prices the failure modes the system prevents — a second EIN " +
      "issued because SS-4 was filed twice, a DL 142 sent to California for an " +
      "Indiana licence while the Indiana surrender goes undone. Those are the " +
      "expensive events and this benchmark does not touch them, because their " +
      "frequency and cost are both unknown to us.",

    `The ${run?.formsDeclined ?? 0} forms positively declined and the ` +
      `${run?.formsBlocked ?? 0} decision(s) left blocked produced no boxes and ` +
      "therefore contribute nothing to any figure above, even though deciding " +
      "not to file is real work the engine did. 'Declined' here means a rule " +
      "fired and said no — it is not a claim that the decline was the right " +
      "answer, which nobody has checked against ground truth.",

    ...(haveSamples
      ? []
      : [
          "samples/track3 is absent on this machine, so every per-estate figure " +
            "is missing entirely rather than defaulted. The Alix records are not " +
            "in this repository; without them this module reports only the form " +
            "library and the assumptions.",
        ]),
  ],
};

/**
 * Print when this file is run on its own, stay silent when a suite imports it.
 *
 * `node file.ts` and `vite-node --script file.ts` both leave the target in
 * argv[1], so the URL comparison settles it. Plain `vite-node file.ts` replaces
 * argv[1] with vite-node's own CLI path and drops the target entirely, leaving
 * nothing to match — so that case falls back to "the entry is vite-node", and a
 * suite runner should export BENCH_SUITE=1 to suppress these per-module dumps.
 */
const entry = process.argv[1] ?? "";
const runDirectly =
  process.env.BENCH_SUITE !== "1" &&
  (import.meta.url === pathToFileURL(entry).href || /vite-node/i.test(entry));

if (runDirectly) print(BENCHMARK);
