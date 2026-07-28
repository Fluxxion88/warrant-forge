// How much ground does the engine actually cover — and how much does it decline?
//
// The second half of that question is the one that matters. A form-filler that
// fills everything is not covering more ground than one that fills half and
// refuses the rest; it is covering less, because it has silently taken over the
// decisions it got wrong. Three of Alix's five sample estates must NOT receive a
// DL 142, and a system that produces five tidy DL 142s looks more capable on a
// slide while being strictly worse in a file drawer. So the withheld count is
// reported beside the filled count, split by *why* it was withheld, and the
// weakest kind of decline — no rule fired at all — is separated out rather than
// folded in with the reasoned ones.
//
// Everything below is counted at module load from real repo artefacts: the
// county registry, the rule packs, the committed widget geometry and field maps,
// and (when present) the Track 3 sample records run through the same importer,
// evaluator and filler the production pipeline uses. Nothing is transcribed —
// including the figures that appear inside a caveat or a limit, which are
// interpolated from the same measurements, because a number frozen into prose
// goes stale silently and is then quoted as though it had been counted.
//
// Three things this module deliberately refuses to score. A form withheld
// because every rule blocked is not a form correctly declined, even when an
// outside label agrees that none was due — agreement by silence is counted in
// its own row and subtracted from the credited figure. A box left unticked
// because its condition evaluated false is not a box correctly unticked: the
// condition has to be asking the question the box asks, and the adjudication
// log holds a case where it was not. And a widget declined with a reason is not
// a widget correctly declined — `verifyMapping` returns the `unmapped` verdict
// before it looks for a printed label, so a decline is the one disposition in
// this repo that carries no located evidence at all.
//
// `samples/` is gitignored — the records are Alix's to distribute and this repo
// is public. When they are absent the sample-dependent metrics are omitted
// entirely rather than estimated, and `limits` says so.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assumed,
  derived,
  measured,
  print,
  type Benchmark,
  type Metric,
} from "./harness";

import { CA_COUNTIES, countyRules, coverage as countyCoverage } from "../src/rules/ca-counties";
import { CA_RULES } from "../src/rules/ca-probate";
import { FORM_RULES, form56Overrides } from "../src/rules/form-applicability";
import { importEstate, importedPaths, leafPaths, type EstateRecord } from "../src/lib/estate";
import { values, type Fact } from "../src/lib/facts";
import { decide, type Rule } from "../src/lib/rules";
import { fillForm, toFillPayload } from "../src/lib/fill";
import type { FieldMap } from "../src/lib/formmap";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const MAPS_DIR = join(ROOT, "src/forms/maps");
const GEOM_DIR = join(ROOT, "src/forms/geometry");
const SAMPLES_DIR = join(ROOT, "samples/track3");

const metrics: Metric[] = [];
const limits: string[] = [];
const add = (m: Metric) => void metrics.push(m);

// ---------------------------------------------------------------------------
// 1. Jurisdictional surface — the county registry and the rule packs
// ---------------------------------------------------------------------------

const counties = countyCoverage();
const generatedCountyRules = countyRules();
const allRules: Rule[] = [...CA_RULES, ...FORM_RULES];

add({
  id: "counties.registered",
  label: "California counties in the registry",
  value: CA_COUNTIES.length,
  provenance: measured("CA_COUNTIES.length from src/rules/ca-counties.ts, imported and counted"),
  caveat:
    "Registered means the county exists as an addressable rule subject with a filing fee " +
    "backed by a citation. It does not mean its local rules have been read.",
});

add({
  id: "counties.local_rules_read",
  label: "Counties whose local probate rules were read",
  value: counties.verified,
  provenance: measured("coverage().verified from src/rules/ca-counties.ts"),
});

add({
  id: "counties.local_rules_unread",
  label: "Counties flagged as not researched",
  value: counties.notResearched,
  provenance: measured("coverage().notResearched from src/rules/ca-counties.ts"),
  caveat:
    "These are surfaced as a known unknown, not defaulted to 'no local requirements'. " +
    `That is the honest behaviour, but it is still ${counties.notResearched} counties of ` +
    "unread local rules.",
});

add({
  id: "counties.fee_variances",
  label: "Counties whose filing fee differs from the statewide figure",
  value: counties.feeVariances.length,
  provenance: measured("coverage().feeVariances.length from src/rules/ca-counties.ts"),
  caveat:
    `The fee column is complete for all ${CA_COUNTIES.length} counties because the Judicial ` +
    "Council fee schedule enumerates its own exceptions, so one citation covers the column. " +
    "That exhaustiveness is the schedule's claim as recorded in src/rules/ca-counties.ts; this " +
    "benchmark counted the variances in the registry and did not re-read the schedule.",
});

const statewideRuleCount = CA_RULES.filter((r) => !r.jurisdiction.county).length;

add({
  id: "rules.ca_statewide",
  label: "Statewide California rules",
  value: statewideRuleCount,
  provenance: measured("CA_RULES filtered to rules with no jurisdiction.county, counted"),
});

add({
  id: "rules.county_generated",
  label: "County rules generated from the registry",
  value: generatedCountyRules.length,
  provenance: measured("countyRules().length — the registry expanded into rules at load"),
  caveat:
    `Generated from ${CA_COUNTIES.length} data rows, not written ${generatedCountyRules.length} ` +
    "times. The count measures reach, not research effort: one filing-fee rule per county plus " +
    "one local-overlay rule, which for most counties is the 'not researched' flag.",
});

const unresearchedFlagRules = generatedCountyRules.filter(
  (r) => r.authority.citation === "Not researched",
).length;

add({
  id: "rules.county_unresearched_flags",
  label: "County rules that exist only to declare the county unread",
  value: unresearchedFlagRules,
  provenance: measured(
    "countyRules() filtered to rules whose authority.citation === 'Not researched'",
  ),
  caveat:
    "Counted separately so the rule total is not read as legal coverage. These rules carry " +
    "no local authority; they carry the statement that none was read.",
});

add({
  id: "rules.form_applicability",
  label: "Form-applicability rules",
  value: FORM_RULES.length,
  provenance: measured("FORM_RULES.length from src/rules/form-applicability.ts"),
});

// CA_RULES is itself STATEWIDE_RULES ∪ countyRules(), so the composition below
// reconstructs a number that is also directly countable. Checked rather than
// trusted: if the pack is ever rearranged so the county rules are counted twice,
// or dropped, the sum stops matching the set that was actually evaluated and the
// benchmark says so instead of reporting the larger figure.
const ruleTotal = statewideRuleCount + generatedCountyRules.length + FORM_RULES.length;
if (ruleTotal !== allRules.length) {
  limits.push(
    `The rule total is reported as ${ruleTotal} by composition but ${allRules.length} rules were ` +
      "actually evaluated. The two disagree, so neither figure should be quoted until the " +
      "county-rule expansion in src/rules/ca-probate.ts is reconciled with this benchmark.",
  );
}

add({
  id: "rules.total",
  label: "Rules in the evaluated packs",
  value: ruleTotal,
  provenance: derived(
    ["rules.ca_statewide", "rules.county_generated", "rules.form_applicability"],
    "ca_statewide + county_generated + form_applicability, cross-checked against the length of the evaluated set",
  ),
  caveat:
    "CA_RULES already contains the generated county rules, so this is one set counted by its " +
    `parts, not three packs added together. Counting reach, not research: ${unresearchedFlagRules} ` +
    "of the county rules exist only to record that the county was not read.",
});

add({
  id: "rules.cited",
  label: "Rules carrying a source citation",
  value: allRules.filter(
    (r) => r.authority.citation.length > 0 && r.authority.citation !== "Not researched",
  ).length,
  provenance: measured(
    "CA_RULES ∪ FORM_RULES counted where authority.citation is non-empty and not 'Not researched'",
  ),
  caveat:
    "A citation proves a source was named and read, not that the rule follows from it. " +
    "No independent lawyer has audited the inference from text to rule.",
});

add({
  id: "decision.points",
  label: "Distinct decision points",
  value: new Set(allRules.map((r) => r.decisionPoint)).size,
  provenance: measured("distinct rule.decisionPoint across CA_RULES ∪ FORM_RULES"),
  caveat:
    "A decision point is a question the engine can answer with competing rules. The " +
    "denominator — how many questions settling an estate actually poses — is not held here.",
});

add({
  id: "jurisdictions.state_packs",
  label: "State rule packs",
  value: new Set(allRules.map((r) => r.jurisdiction.state).filter((s) => s !== "*")).size,
  provenance: measured(
    "distinct non-'*' rule.jurisdiction.state across CA_RULES ∪ FORM_RULES ('*' is the federal scope)",
  ),
  caveat:
    "One. Three of the five sample estates are administered outside it, which is why the " +
    "out-of-state licence surrender is named as an obligation with no form behind it.",
});

// ---------------------------------------------------------------------------
// 2. Form surface — committed geometry against committed field maps
// ---------------------------------------------------------------------------

interface Geometry {
  form: string;
  sourceFile: string;
  widgets: { name: string }[];
}

const mapFiles = existsSync(MAPS_DIR)
  ? readdirSync(MAPS_DIR).filter((f) => f.endsWith(".json")).sort()
  : [];

const fieldMaps: FieldMap[] = mapFiles.map(
  (f) => JSON.parse(readFileSync(join(MAPS_DIR, f), "utf8")) as FieldMap,
);

add({
  id: "forms.mapped",
  label: "Government forms with a committed field map",
  value: fieldMaps.length,
  provenance: measured("*.json files counted and parsed in src/forms/maps"),
  caveat:
    "A count of committed map files, and nothing more. Reading a file does not establish that " +
    "the verifier produced it. 'Verified' is a property of individual entries — see " +
    "forms.entries_mapped — and not even of all of those: a declined widget's reason never " +
    "reaches the verifier at all.",
});

const mappedWidgets = fieldMaps.reduce((n, m) => n + m.entries.length, 0);
const unmappedWidgets = fieldMaps.reduce((n, m) => n + m.unmapped.length, 0);
const rejectedProposals = fieldMaps.reduce((n, m) => n + m.rejected.length, 0);

/**
 * Distinct widget names a map says anything about — mapped, refused or declined.
 *
 * A set, not a sum. The DL 142 prints the same named field twice (the form is an
 * original plus a retained copy), the geometry carries one row per rectangle and
 * the map one entry per rectangle, so adding the three bucket lengths counts
 * every repeated box twice. The repetition is measured, not asserted:
 * `forms.repeated_field_names` counts the names the geometry prints more than
 * once, and it spans both buckets — repeated boxes that are mapped and repeated
 * boxes that are declined. Where a repeated name is mapped, every copy carries
 * the same target, so collapsing to the set loses nothing.
 */
const disposedNames = (m: FieldMap): Set<string> => {
  const named = new Set<string>();
  for (const e of m.entries) named.add(e.field);
  for (const u of m.unmapped) named.add(u.field);
  for (const r of m.rejected) named.add(r.field);
  return named;
};

const disposedFields = fieldMaps.reduce((n, m) => n + disposedNames(m).size, 0);

add({
  id: "forms.entries_mapped",
  label: "Map entries binding a widget to a record path",
  value: mappedWidgets,
  provenance: measured("sum of FieldMap.entries.length across src/forms/maps/*.json"),
  caveat:
    "Entries, one per widget rectangle, so the DL 142's duplicated boxes are counted twice — " +
    "see forms.fields_disposed for the distinct-field figure. " +
    "Every entry carries a verbatim printed label that the verifier located on the page. " +
    "That proves the evidence is real, not that the widget was routed to the right path — " +
    "two such routing errors are recorded in src/forms/adjudications.json (as three entries, " +
    "because the line-2c error spans a Yes/No pair) and were found only by rendering the PDF " +
    "and reading it.",
});

add({
  id: "forms.widgets_declined",
  label: "Widgets left unmapped, each carrying a recorded reason",
  value: unmappedWidgets,
  provenance: measured(
    "sum of FieldMap.unmapped.length across src/forms/maps/*.json — one entry per widget " +
      "rectangle, as with entries, so repeated boxes are counted twice",
  ),
  caveat:
    "Recorded, not verified, and the distinction is this repo's whole subject. verifyMapping " +
    "returns the `unmapped` verdict before it ever looks for a printed label, so a decline is " +
    "the one disposition here that carries no located evidence: the reason is the model's own " +
    "prose. Many are plainly right — the IRS-completed EIN box on the SS-4 masthead, second " +
    `designee slots, preparer blocks — but nobody has reviewed all ${unmappedWidgets}, and ` +
    "the count establishes that a reason was written, not that declining was correct.",
});

add({
  id: "forms.proposals_rejected",
  label: "Mapping proposals refused by the verifier",
  value: rejectedProposals,
  provenance: measured("sum of FieldMap.rejected.length across src/forms/maps/*.json"),
  caveat:
    "Refused because the label the model quoted could not be located on the page. A low " +
    "count over one discovery run is not a measured error rate for the discovery process.",
});

add({
  id: "forms.fields_disposed",
  label: "Distinct form fields a map says something about",
  value: disposedFields,
  provenance: measured(
    "size of the set (FieldMap.entries ∪ unmapped ∪ rejected) by widget name, summed per form",
  ),
});

/**
 * Repeated widget names whose mapped copies disagree about where the value comes
 * from. Collapsing rectangles to distinct names is only lossless if every copy
 * of a name resolves to the same target, so that is measured rather than
 * asserted — the same treatment `boxes.map_drift` gets, and for the same reason.
 */
const repeatedTargetConflicts = fieldMaps.reduce((n, m) => {
  const targets = new Map<string, Set<string>>();
  for (const e of m.entries) {
    const seen = targets.get(e.field) ?? new Set<string>();
    seen.add(e.target);
    targets.set(e.field, seen);
  }
  return n + [...targets.values()].filter((s) => s.size > 1).length;
}, 0);

add({
  id: "forms.repeated_target_conflicts",
  label: "Repeated fields whose copies disagree on the record path",
  value: repeatedTargetConflicts,
  provenance: measured(
    "widget names appearing in FieldMap.entries more than once with more than one distinct target",
  ),
  caveat:
    "Zero is what makes the distinct-field collapse lossless. Non-zero would mean two copies " +
    "of one printed box were mapped to different record paths, and the disposition counts " +
    "below would be hiding a contradiction rather than a duplicate.",
});

// Geometry is read per form, and the disposition share is only computed when
// EVERY mapped form has geometry beside it. A partial read would put a map-side
// numerator over a smaller geometry-side denominator and could print a share
// above 100% without anything looking wrong.
const geometries: { file: string; map: FieldMap; geometry: Geometry }[] = [];
if (existsSync(GEOM_DIR)) {
  for (const [i, f] of mapFiles.entries()) {
    const p = join(GEOM_DIR, f);
    if (!existsSync(p)) continue;
    geometries.push({
      file: f,
      map: fieldMaps[i],
      geometry: JSON.parse(readFileSync(p, "utf8")) as Geometry,
    });
  }
}

if (geometries.length > 0) {
  let widgetRects = 0;
  let distinctFields = 0;
  let repeatedNames = 0;
  let disposedOnForm = 0;
  let disposedOffForm = 0;

  for (const { map, geometry } of geometries) {
    const counts = new Map<string, number>();
    for (const w of geometry.widgets) counts.set(w.name, (counts.get(w.name) ?? 0) + 1);
    widgetRects += geometry.widgets.length;
    distinctFields += counts.size;
    repeatedNames += [...counts.values()].filter((c) => c > 1).length;

    // Split by whether the disposed name is a widget the form actually has.
    // `unknown_field` is a supported rejection verdict — the model can name a
    // widget that does not exist — and such a name sits in FieldMap.rejected,
    // hence in the numerator, while the geometry denominator cannot contain it.
    // Comparing the two set SIZES would let one hallucinated name cancel one
    // genuinely undisposed widget and print a flawless 100%. So the numerator
    // is the intersection, and the remainder is reported on its own row.
    for (const name of disposedNames(map)) {
      if (counts.has(name)) disposedOnForm++;
      else disposedOffForm++;
    }
  }

  const forms = geometries.length;

  add({
    id: "forms.widget_rects",
    label: "Fillable widget rectangles on the mapped forms",
    value: widgetRects,
    provenance: measured(
      `sum of FormGeometry.widgets.length over the ${forms} committed geometry files in ` +
        "src/forms/geometry that match a field map (generated from the named sourceFile PDF by tools/geometry.py)",
    ),
    caveat:
      "Rectangles, not fields. The DL 142 places named fields on the page twice, so this " +
      "exceeds the number of distinct boxes a filler has to decide about.",
  });

  add({
    id: "forms.fields_distinct",
    label: "Distinct fields on the mapped forms",
    value: distinctFields,
    provenance: measured(
      `sum over the ${forms} forms of the distinct FormGeometry.widgets[].name count — the ` +
        "denominator for mapping disposition",
    ),
  });

  add({
    id: "forms.repeated_field_names",
    label: "Field names the geometry prints more than once",
    value: repeatedNames,
    provenance: measured(
      "widget names occurring more than once in FormGeometry.widgets, summed over the forms read",
    ),
    caveat:
      "This is the whole gap between the rectangle count and the distinct-field count, and it " +
      "spans both buckets: some repeated boxes are mapped, some are declined. Any count summed " +
      "over rectangles rather than names is inflated by exactly this much.",
  });

  add({
    id: "forms.disposed_off_form",
    label: "Disposed field names the form's geometry does not contain",
    value: disposedOffForm,
    provenance: measured(
      "names in (FieldMap.entries ∪ unmapped ∪ rejected) with no matching FormGeometry.widgets[].name",
    ),
    caveat:
      "Zero is what makes the disposition share below a share. A rejected proposal can carry an " +
      "`unknown_field` verdict — a widget the model invented — and that name would otherwise " +
      "inflate a numerator whose denominator cannot contain it. Non-zero means the map and the " +
      "geometry are describing different forms.",
  });

  if (geometries.length === fieldMaps.length && distinctFields > 0) {
    add({
      id: "forms.field_disposition_share",
      label: "Fields with an explicit disposition",
      value: (disposedOnForm / distinctFields) * 100,
      unit: "%",
      provenance: derived(
        ["forms.fields_disposed", "forms.disposed_off_form", "forms.fields_distinct"],
        "(fields_disposed − disposed_off_form) / fields_distinct × 100, over the forms carrying " +
          "both a map and geometry — the numerator is the intersection with the geometry, so the " +
          "share cannot exceed 100% by counting a field the form does not have",
      ),
      caveat:
        "Disposition means every field is either mapped, refused, or declined with a recorded " +
        "reason — none is silently unaccounted for. It is bookkeeping completeness, not mapping " +
        "correctness: a field routed to the wrong record path is disposed of just as fully as " +
        "one routed correctly, and two such fields are known to exist. Declines count as " +
        "dispositions, because a recorded refusal is a disposition — but see " +
        "forms.widgets_declined for how little a decline's reason has been checked.",
    });

    limits.push(
      "Disposition is bookkeeping, not correctness. Every field on the mapped forms being " +
        "accounted for says nothing about whether the mapped ones point at the right record " +
        "path: the two adjudicated routing errors in src/forms/adjudications.json were fully " +
        "disposed of while being wrong.",
    );
  } else {
    limits.push(
      `Geometry was read for ${geometries.length} of the ${fieldMaps.length} mapped forms, so the ` +
        "share of fields carrying a disposition was not computed — a map-side numerator over a " +
        "part-read geometry denominator is not a share of anything.",
    );
  }
} else {
  limits.push(
    "src/forms/geometry is absent, so the mapped-field count has no denominator here — " +
      "the share of each form's fields that carry a disposition was not computed.",
  );
}

// ---------------------------------------------------------------------------
// 3. The sample estates — filled versus withheld, and why
// ---------------------------------------------------------------------------

/**
 * Which decision point governs each form, and which record block carries Alix's
 * own applicability call for it. Both are lookups mirroring tools/fill-forms.ts,
 * not measurements — they are how the pipeline is wired, stated here so the
 * benchmark exercises the same wiring.
 */
const GOVERNS: Record<string, { point: string; recordBlock: string }> = {
  "ca-dl142": { point: "form_dl142", recordBlock: "formDL142" },
  "irs-ss4": { point: "form_ss4", recordBlock: "formSS4" },
  "irs-56": { point: "form_56", recordBlock: "form56" },
  "irs-8821": { point: "form_8821", recordBlock: "form8821" },
};

// A mapped form with no GOVERNS entry has no decision point wired to it, so no
// rule is ever evaluated for it and `decide()` is never even asked. That pair
// would otherwise fall through to the last branch below and be counted as
// "every rule evaluated not-applicable" — reporting a wiring gap as an engine
// decision, in the one row that exists to keep non-decisions out of the credited
// figures. Excluded from the pair count and named in `limits` instead.
const decidableMaps = fieldMaps.filter((m) => GOVERNS[m.form]);
const unwiredForms = fieldMaps.filter((m) => !GOVERNS[m.form]).map((m) => m.form);

if (unwiredForms.length > 0) {
  limits.push(
    `No decision point is wired to ${unwiredForms.join(", ")}, so ${unwiredForms.length} of the ` +
      `${fieldMaps.length} mapped forms ${unwiredForms.length === 1 ? "is" : "are"} excluded ` +
      "from every fill-versus-withhold count here. A form the engine was never asked about is a " +
      "gap in this benchmark's wiring, not a decline by the engine, and is not counted as one.",
  );
}

const sampleFiles = existsSync(SAMPLES_DIR)
  ? readdirSync(SAMPLES_DIR).filter((f) => f.startsWith("estate-") && f.endsWith(".json")).sort()
  : [];

/**
 * Shape of the sample set, so the closing `limits` can describe it from the
 * records rather than from a number written into the prose. Null when the
 * samples are absent, and the limits then say nothing about how many there were.
 */
let sampleShape: { records: number; outOfState: number } | null = null;

if (sampleFiles.length === 0 || fieldMaps.length === 0) {
  limits.push(
    "The Track 3 sample estate records were not present at " +
      "samples/track3 (they are gitignored — Alix's to distribute, and this repo is public). " +
      "Every metric about filled versus withheld forms, and about how much of a record the " +
      "importer reads, was omitted rather than estimated. Re-run with the samples in place.",
  );
} else {
  const records: EstateRecord[] = sampleFiles.map(
    (f) => JSON.parse(readFileSync(join(SAMPLES_DIR, f), "utf8")) as EstateRecord,
  );

  let filled = 0;
  let withheldRuleSaysNo = 0;
  let withheldBlocked = 0;
  let withheldNoRule = 0;

  let boxesWritten = 0;
  let boxGaps = 0;
  let boxesBroken = 0;
  let boxesConditionFalse = 0;
  let form56Unresolved = 0;

  let labelledPairs = 0;
  let labelAgreements = 0;
  let labelAgreementsRuleFired = 0;
  let labelAgreementsBySilence = 0;

  let leafTotal = 0;
  let factsTotal = 0;
  let quarantinedTotal = 0;
  let emptyDeclaredTotal = 0;
  let pathsReadTotal = 0;
  let pathsReadLeafTotal = 0;
  let outOfStateRecords = 0;

  const declaredPaths = importedPaths();

  for (const record of records) {
    const { facts, emptyPaths } = importEstate(record);
    const v = values(facts);
    const state = record.estateEntity.principalState ?? "CA";
    if (state !== "CA") outOfStateRecords++;

    // Evaluated in the estate's OWN venue. Forcing "CA" would make three
    // out-of-state estates agree with a California rule pack they never reach.
    const decisions = decide(FORM_RULES, v, {
      state,
      county: record.estateEntity.principalCounty ?? undefined,
    });

    const leafSet = new Set(leafPaths(record));
    leafTotal += leafPaths(record).length;
    factsTotal += facts.length;
    quarantinedTotal += facts.filter((f: Fact) => f.status !== "verified").length;
    emptyDeclaredTotal += emptyPaths.length;

    // Every record path this estate was actually read at: the importer's record
    // warrants, plus the field-map targets that resolved to a written box. The
    // two sets barely overlap — the fact ledger and the form filler read the
    // record for different reasons — so the union is the honest figure.
    const touched = new Set<string>();
    for (const f of facts) {
      if (f.warrant.kind === "record") touched.add(f.warrant.path);
    }

    for (const map of decidableMaps) {
      const governs = GOVERNS[map.form];
      const d = decisions.find((x) => x.decisionPoint === governs.point);
      const chosen = d?.chosen;

      // A rule is affirmative when its conclusion obliges a form. Read off the
      // rule data rather than kept as a second list that can drift out of step.
      const affirmative = Boolean(chosen && chosen.rule.then.forms.length > 0);

      if (chosen && affirmative) {
        filled++;
        const filling = fillForm(map, record);
        const payload = toFillPayload(filling);

        if (map.form === "irs-56") {
          const ov = form56Overrides(record);
          for (const k of ov.clear) delete payload[k];
          Object.assign(payload, ov.set);
          form56Unresolved += ov.unresolved.length;
        }

        boxesWritten += Object.keys(payload).length;
        boxGaps += filling.gaps.length;
        boxesBroken += filling.broken.length;
        boxesConditionFalse += filling.fields.filter((f) => f.status === "condition_false").length;
        for (const f of filling.fields) if (f.status === "filled") touched.add(f.target);
      } else if (chosen) {
        withheldRuleSaysNo++;
      } else if (d && d.blocked.length > 0) {
        withheldBlocked++;
      } else {
        withheldNoRule++;
      }

      // Alix labels some form blocks with their own `applicable` boolean. Where
      // one exists it is an independent check on our decision — the only ground
      // truth in this benchmark that we did not also author.
      //
      // Agreement is split by whether a rule actually fired. A pair where every
      // rule reported itself blocked produces no form, so it *matches* a label
      // of `false` — but the engine did not conclude the form was inapplicable,
      // it concluded it could not tell. Crediting that as a correct call would
      // be scoring silence as reasoning, which is the thing this whole module
      // separates out everywhere else.
      const block = (record as unknown as Record<string, unknown>)[governs.recordBlock];
      const label =
        block && typeof block === "object" && "applicable" in block
          ? (block as { applicable?: unknown }).applicable
          : undefined;
      if (typeof label === "boolean") {
        labelledPairs++;
        if (label === affirmative) {
          labelAgreements++;
          if (chosen) labelAgreementsRuleFired++;
          else labelAgreementsBySilence++;
        }
      }
    }

    pathsReadTotal += touched.size;
    // Only the reads that land on a scalar leaf can be put over a leaf-path
    // denominator. A map target naming a whole array — `taxMatters.taxTypes` —
    // is a genuine read of the record but is not itself a leaf, so counting it
    // in the share would put a numerator outside its own denominator.
    for (const p of touched) if (leafSet.has(p)) pathsReadLeafTotal++;
  }

  const n = records.length;
  const pairs = n * decidableMaps.length;
  const withheldTotal = withheldRuleSaysNo + withheldBlocked + withheldNoRule;
  sampleShape = { records: n, outOfState: outOfStateRecords };

  add({
    id: "records.evaluated",
    label: "Alix estate records evaluated",
    value: n,
    provenance: measured("estate-*.json counted and parsed in samples/track3"),
    caveat: "Five synthetic records supplied for one hackathon track. Not a sample of estates.",
  });

  add({
    id: "pairs.total",
    label: "(record × form) decisions taken",
    value: pairs,
    provenance: derived(
      ["records.evaluated", "forms.mapped"],
      `records.evaluated × the ${decidableMaps.length} of ${fieldMaps.length} mapped forms that ` +
        "have a decision point wired to them — a form the engine is never asked about produces " +
        "no decision to count",
    ),
  });

  add({
    id: "pairs.filled",
    label: "Forms filled",
    value: filled,
    provenance: measured(
      "decide(FORM_RULES, …) per record in its own venue; a form is filled when the chosen rule obliges a form",
    ),
  });

  add({
    id: "pairs.withheld_rule_says_no",
    label: "Withheld — a rule fired saying the form does not apply",
    value: withheldRuleSaysNo,
    provenance: measured(
      "decisions where a rule was chosen but its then.forms is empty (e.g. form.dl142.out_of_state, form.ss4.not_needed)",
    ),
    caveat:
      "The strongest kind of decline: a cited rule states positively why not, and names the " +
      "obligation that moves elsewhere. An out-of-state licence still has to be surrendered.",
  });

  add({
    id: "pairs.withheld_blocked",
    label: "Withheld — blocked on a fact the record does not hold",
    value: withheldBlocked,
    provenance: measured(
      "decisions with no chosen rule and at least one rule reporting outcome 'blocked' under three-valued evaluation",
    ),
    caveat:
      "Blocked names the missing fact. This is a gap that a human can close, not a refusal.",
  });

  add({
    id: "pairs.withheld_no_rule",
    label: "Withheld — every rule evaluated not-applicable",
    value: withheldNoRule,
    provenance: measured(
      "decisions with no chosen rule and no blocked rule — the form was skipped with nothing affirmatively said about it",
    ),
    caveat:
      "The weakest decline, separated out on purpose. Nothing here distinguishes 'correctly " +
      "out of scope' from 'the pack has no rule for this case'. Counted, not credited.",
  });

  add({
    id: "pairs.withheld_total",
    label: "Forms withheld",
    value: withheldTotal,
    provenance: derived(
      ["pairs.withheld_rule_says_no", "pairs.withheld_blocked", "pairs.withheld_no_rule"],
      "withheld_rule_says_no + withheld_blocked + withheld_no_rule",
    ),
  });

  add({
    id: "pairs.withheld_share",
    label: "Share of decisions that were declines",
    value: pairs ? (withheldTotal / pairs) * 100 : 0,
    unit: "%",
    provenance: derived(
      ["pairs.withheld_total", "pairs.total"],
      "withheld_total / pairs.total × 100",
    ),
    caveat:
      "A high share is neither good nor bad on its own. It is high here because the sample " +
      "was chosen to contain forms that should not be filed.",
  });

  add({
    id: "decline.independently_labelled",
    label: "Decisions with an Alix-supplied applicability label",
    value: labelledPairs,
    provenance: measured(
      "(record × form) pairs where the record's own form block carries an `applicable` boolean",
    ),
    caveat:
      "Only the DL 142 block carries one. It is the sole ground truth in this benchmark that " +
      "we did not also author.",
  });

  add({
    id: "decline.label_agreement",
    label: "Of those, pairs whose outcome matches the label",
    value: labelAgreements,
    provenance: measured(
      "whether a form was produced, compared against the record's own `applicable` boolean, per pair",
    ),
    caveat:
      "Outcome agreement: did we produce a form where the label says one is due. It is never " +
      "read from the label — the decision comes off the licence's issuing state — but it does " +
      "not distinguish a reasoned call from a non-call, which is why the next two rows split it. " +
      "Agreement over a handful of labelled pairs is a smoke test, not an accuracy rate.",
  });

  add({
    id: "decline.label_agreement_rule_fired",
    label: "Of those, agreements where a rule actually fired",
    value: labelAgreementsRuleFired,
    provenance: measured(
      "agreeing pairs where decide() returned a chosen rule — the engine reached a conclusion and it matched",
    ),
    caveat:
      "This is the only figure here that is an independent check on a decision. Everything the " +
      "engine concluded about the DL 142 and was graded on by somebody else lives in this row.",
  });

  add({
    id: "decline.label_agreement_by_silence",
    label: "Of those, agreements where the engine reached no conclusion",
    value: labelAgreementsBySilence,
    provenance: measured(
      "agreeing pairs with no chosen rule — every rule blocked or was not applicable, so no form was produced and the label happened to say none was due",
    ),
    caveat:
      "Counted, not credited. Producing no form because a required fact is missing matches a " +
      "label of 'not applicable' without concluding anything: the engine did not find the form " +
      "inapplicable, it reported that it could not tell, and named the fact it wanted. Subtract " +
      "this from the row above before reading agreement as evidence of a correct decision.",
  });

  if (labelAgreementsBySilence > 0) {
    limits.push(
      `Independently-labelled pairs where the engine reached no conclusion: ` +
        `${labelAgreementsBySilence} of ${labelledPairs}. Every rule blocked for want of a fact, ` +
        "so no form was produced and the label happened to say none was due. That is counted in " +
        "the outcome-agreement row and excluded from the credited one, but it means the number " +
        "of decisions this benchmark can show an outside check on is smaller than the number of " +
        "labels it holds.",
    );
  }

  add({
    id: "decline.unchecked",
    label: "Decisions with no independent check at all",
    value: pairs - labelledPairs,
    provenance: derived(
      ["pairs.total", "decline.independently_labelled"],
      "pairs.total − decline.independently_labelled",
    ),
    caveat:
      `${pairs ? (((pairs - labelledPairs) / pairs) * 100).toFixed(0) : "0"}% of the decisions ` +
      "in this benchmark are graded only by the rule pack that made them, and not every " +
      "labelled pair is even a conclusion — see decline.label_agreement_by_silence. This is the " +
      "number that most needs an outside adjudicator.",
  });

  add({
    id: "boxes.written",
    label: "Form boxes written across all filled forms",
    value: boxesWritten,
    provenance: measured(
      "sum of Object.keys(toFillPayload(fillForm(map, record))).length, with the Form 56 rule-pack overrides applied as in tools/fill-forms.ts",
    ),
    caveat:
      "Boxes written, not boxes correct. Read-back proves the bytes are in the file; only " +
      "reading the rendered form proves a human sees the right thing there.",
  });

  add({
    id: "boxes.gaps",
    label: "Mapped boxes left blank because the record held nothing",
    value: boxGaps,
    provenance: measured("sum of FormFilling.gaps.length across every filled (record, form) pair"),
    caveat: "Each comes back named with the record path that would have supplied it.",
  });

  add({
    id: "boxes.checkbox_not_ticked",
    label: "Checkboxes left unticked because their condition evaluated false",
    value: boxesConditionFalse,
    provenance: measured(
      "fields with status 'condition_false' across every filled (record, form) pair",
    ),
    caveat:
      "Not 'correctly unticked'. What was measured is that the mapped condition read the record " +
      "and came back false — which is only right if the condition points at the question the " +
      "box actually asks. One of the adjudicated errors is exactly that failure: a Form 56 " +
      "line-2c box wired to 'does a court case exist' instead of 'are the assets in the court's " +
      "custody', which ticked on every sample estate and was invisible to label verification.",
  });

  add({
    id: "boxes.map_drift",
    label: "Mapped boxes whose record path does not exist",
    value: boxesBroken,
    provenance: measured(
      "sum of FormFilling.broken.length — a mapping pointing at a path absent from the record schema",
    ),
    caveat:
      "Zero is the expected value. Non-zero means the field map and the Alix schema have " +
      "drifted apart and every form built from that map is quietly wrong.",
  });

  add({
    id: "form56.unresolved",
    label: "Form 56 line-1 groups the rule pack refused to decide",
    value: form56Unresolved,
    provenance: measured(
      "sum of form56Overrides(record).unresolved.length over the records whose Form 56 was filled",
    ),
    caveat:
      "An unrecognised authority basis sets no box and says so, rather than guessing between " +
      "1b and 1d. A blank gets caught in review; a wrong box misstates legal standing.",
  });

  // -------------------------------------------------------------------------
  // 4. How much of each record do we actually read?
  // -------------------------------------------------------------------------

  add({
    id: "record.leaf_paths_mean",
    label: "Leaf paths per record",
    value: leafTotal / n,
    provenance: measured("mean of leafPaths(record).length over the sample records"),
    caveat:
      "Counts scalar leaves, so a long free-text note and a ZIP code weigh the same. Paths are " +
      "not information. It also counts the leaves a record declares and leaves null, which are " +
      "unreadable by anything — so as the denominator of record.read_share it is generous to " +
      "the record and harsh on the engine, not the other way round.",
  });

  add({
    id: "import.declared_paths",
    label: "Record paths the importer declares",
    value: declaredPaths.length,
    provenance: measured("importedPaths().length from src/lib/estate.ts"),
    caveat:
      "The declared scalar import list. Assets and identifications are imported by array " +
      "walk and are not in it, so this both under- and over-states what one record yields.",
  });

  add({
    id: "import.declared_share",
    label: "Declared import list, sized against an average record",
    value: leafTotal ? (declaredPaths.length / (leafTotal / n)) * 100 : 0,
    unit: "%",
    provenance: derived(
      ["import.declared_paths", "record.leaf_paths_mean"],
      "import.declared_paths / record.leaf_paths_mean × 100",
    ),
    caveat:
      "A sense of scale, not a coverage figure, and it is not the share of a record that gets " +
      "read — that is record.read_share. The numerator is a fixed list written into the " +
      "importer: some of its paths are absent or empty in any given record (see " +
      "import.declared_paths_empty_mean), and the assets and identifications the importer walks " +
      "by array are not in it at all.",
  });

  add({
    id: "import.facts_mean",
    label: "Facts admitted per record",
    value: factsTotal / n,
    provenance: measured("mean of importEstate(record).facts.length over the sample records"),
  });

  add({
    id: "import.declared_paths_empty_mean",
    label: "Declared paths that held nothing, per record",
    value: emptyDeclaredTotal / n,
    provenance: measured("mean of importEstate(record).emptyPaths.length over the sample records"),
    caveat:
      "An empty path yields no fact at all, so the rule that wants it reports itself blocked. " +
      "Writing an empty string instead would make the gap invisible.",
  });

  add({
    id: "import.quarantined",
    label: "Imported facts quarantined",
    value: quarantinedTotal,
    provenance: measured(
      "facts with status !== 'verified' after importEstate — admitRecord re-reads each declared path against the record",
    ),
    caveat:
      "Zero means the importer and the Alix schema agree today. It is a schema-drift alarm, " +
      "not evidence that the values are correct.",
  });

  add({
    id: "record.paths_read_mean",
    label: "Distinct record paths actually read, per record",
    value: pathsReadTotal / n,
    provenance: measured(
      "mean size of the union of (record-warrant paths on admitted facts) and (field-map targets that produced a written box), per record",
    ),
    caveat:
      "The fact ledger and the form filler read the record for different reasons and barely " +
      "overlap, so neither alone is the answer to 'how much of the record do we touch'.",
  });

  add({
    id: "record.paths_read_leaf_mean",
    label: "Of those, paths that are scalar leaves of the record",
    value: pathsReadLeafTotal / n,
    provenance: measured(
      "mean count of read paths that appear in leafPaths(record) — the subset that is comparable with the leaf-path denominator",
    ),
    caveat:
      "Smaller than the row above because some map targets name a whole array rather than a " +
      "scalar. Reading one is a real read of the record, but it is not one of the leaves the " +
      "denominator counts, so only this subset can go into a share.",
  });

  add({
    id: "record.read_share",
    label: "Share of an average record's leaves that are read",
    value: leafTotal ? (pathsReadLeafTotal / leafTotal) * 100 : 0,
    unit: "%",
    provenance: derived(
      ["record.paths_read_leaf_mean", "record.leaf_paths_mean"],
      "record.paths_read_leaf_mean / record.leaf_paths_mean × 100",
    ),
    caveat:
      "The rest of the record is not read by anything here. Some of it is genuinely irrelevant " +
      "to these four forms; nobody has gone through it to say which. Counted over leaves only, " +
      "so a whole-array read is excluded rather than credited as one path out of hundreds.",
  });
}

// ---------------------------------------------------------------------------
// 5. The denominators nobody has supplied
// ---------------------------------------------------------------------------
//
// Every count above is a numerator. Turning any of them into a coverage
// percentage needs a figure for how much ground there is, and no such figure has
// been sourced. Rather than pick a plausible one and let repetition harden it
// into a fact, they are carried as assumptions with no value.

add({
  id: "universe.decision_points",
  label: "Decision points a full estate settlement poses",
  value: "unsourced",
  provenance: assumed(
    "No figure held. Without it, the decision-point count cannot be expressed as coverage.",
    "Alix's own process taxonomy, or an end-to-end checklist from a probate practitioner, " +
      "counted the same way this engine counts a decision point",
  ),
});

add({
  id: "universe.forms_per_estate",
  label: "Distinct government forms a settling estate must file",
  value: "unsourced",
  provenance: assumed(
    `No figure held. ${fieldMaps.length} forms are mapped; ${fieldMaps.length} out of what is unknown.`,
    "A form inventory for a representative estate from Alix, or a state bar probate checklist " +
      "enumerating the federal, state and county filings",
  ),
});

// ---------------------------------------------------------------------------

limits.push(
  `Counting rules is not covering law. ${counties.notResearched} of California's ` +
    `${CA_COUNTIES.length} counties carry no researched local overlay, and the rules that ` +
    "represent them exist only to say so.",
  "One state pack. " +
    (sampleShape
      ? `${sampleShape.outOfState} of the ${sampleShape.records} sample estates are administered ` +
        "outside California, where "
      : "Wherever an estate is administered outside California, ") +
    "this engine can name an obligation but has no form or threshold behind it.",
  "A citation on a rule proves a source was read, not that the rule follows from it. No " +
    "lawyer has audited the step from statutory text to encoded predicate.",
  "A decline is the least-evidenced disposition in this benchmark. A mapping that fills a box " +
    "had its printed label located on the page; a mapping that refuses a box is exempted from " +
    "that check by verifyMapping itself, so every unmapped-widget reason counted here is " +
    "unverified model prose. Bookkeeping completeness is measured over both.",
  "Filled is not correct. The box counts measure what was written, not what was right; the " +
    "two known routing errors in src/forms/adjudications.json passed quote verification and " +
    "were caught only by rendering the PDF and reading it.",
  "Withheld is graded almost entirely by the rule pack that did the withholding. Only the " +
    "DL 142 decisions carry an independent applicability label from Alix; the rest have no " +
    "outside check.",
  (sampleShape ? `${sampleShape.records} synthetic records` : "Synthetic records") +
    " from one hackathon track are not a sample of estates. Nothing here estimates how the " +
    "fill/withhold split would move on a real caseload.",
  "Path coverage counts paths, not information. A single unread path can matter more than a " +
    "hundred read ones, and nobody has reviewed the unread remainder to say whether it does.",
  "No baseline. This benchmark contains no measurement of what a human, a paralegal workflow, " +
    "or any competing system covers, so none of these counts supports a comparative claim.",
  "No timing and no cost. This is a breadth measurement only.",
);

export const BENCHMARK: Benchmark = {
  id: "coverage",
  title: "Coverage — what the engine reaches, and what it declines",
  question:
    "How much jurisdictional and form ground does the engine actually cover, how much of " +
    "each estate record does it read, and how many forms does it refuse to fill — on what " +
    "stated basis, and how few of those refusals anyone outside the rule pack has checked?",
  metrics,
  limits,
};

// The development view: `npx vite-node bench/coverage.ts` prints the table.
//
// There is no entry check here because vite-node strips the entry path out of
// process.argv entirely, so "am I the file that was run?" is not answerable from
// inside the module. A suite runner that needs clean stdout — piping report()
// to a file, say — sets BENCH_QUIET=1, the same switch bench/calibration.ts and
// bench/extraction.ts read, and tested the same way so the three agree.
if (process.env.BENCH_QUIET !== "1") print(BENCHMARK);
