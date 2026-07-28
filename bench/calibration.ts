// Does agreement between independent runs mean the answer is right?
//
// The tempting story is that you run the model twice, keep what both runs agree
// on, and flag the rest. This benchmark exists because that story is false in a
// way that is easy to measure and easy to miss, and because "is your confidence
// calibrated?" deserves a number rather than a shrug.
//
// The field-mapping task is unusually good ground for asking. Two different
// models saw identical evidence — the words printed around each widget, read
// off the page geometrically — and each returned a target path plus the printed
// label it relied on. Where they differ, one of them is wrong. Where they
// agree, the interesting question is whether that means anything.
//
// Ground truth here is partial and this module says so loudly. Three mappings
// are known wrong, recorded in src/forms/adjudications.json with what discovery
// had originally proposed. Those three were found by inspecting disagreements
// and by rendering filled PDFs and reading them — not by exhaustively checking
// all 171 mappings, which nobody has done. So every error rate below is a LOWER
// BOUND. That weakens the reassuring direction of the result and strengthens
// the alarming one, which is the right way round for a number like this.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  assumed,
  derived,
  measured,
  print,
  type Benchmark,
  type Metric,
} from "./harness";
import type { Adjudication, FieldMap } from "../src/lib/formmap";

const PRIMARY = "src/forms/maps";
const SECOND = "src/forms/maps-crosscheck";
const ADJ = "src/forms/adjudications.json";

interface Run {
  model: string;
  /** form -> field -> target */
  byForm: Map<string, Map<string, string>>;
  entries: number;
}

function loadRun(dir: string): Run | null {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  if (!files.length) return null;

  const byForm = new Map<string, Map<string, string>>();
  let model = "unknown";
  let entries = 0;
  for (const f of files) {
    const m = JSON.parse(readFileSync(join(dir, f), "utf8")) as FieldMap;
    model = m.discoveredBy || model;
    const fields = new Map<string, string>();
    for (const e of m.entries) {
      fields.set(e.field, e.target);
      entries++;
    }
    byForm.set(m.form, fields);
  }
  return { model, byForm, entries };
}

const primaryCommitted = loadRun(PRIMARY);
const second = loadRun(SECOND);

const adjudications: Adjudication[] = existsSync(ADJ)
  ? (JSON.parse(readFileSync(ADJ, "utf8")) as { adjudications: Adjudication[] }).adjudications
  : [];

/**
 * Rewind the human corrections.
 *
 * The committed map is post-adjudication, so on every field a human fixed it
 * now carries the *right* answer — which happens to be what the second run said.
 * Comparing that against the second run measures agreement after we already
 * copied the second run's homework, and produced a benchmark whose numerator
 * counted historical disagreements while its denominator counted surviving ones.
 * Reconstructing the original targets from `wasTarget` is what makes this a
 * comparison of two independent runs rather than of one run with itself.
 */
function rewind(run: Run | null): Run | null {
  if (!run) return run;
  const byForm = new Map([...run.byForm].map(([f, m]) => [f, new Map(m)]));
  for (const a of adjudications) {
    if (!a.wasTarget) continue;
    const fields = byForm.get(a.form);
    if (fields?.has(a.field)) fields.set(a.field, a.wasTarget);
  }
  return { ...run, byForm };
}

const primary = rewind(primaryCommitted);

const metrics: Metric[] = [];
const limits: string[] = [
  "Ground truth is partial. Three mappings are known wrong because somebody " +
    "looked; nobody has checked all of them. Every error rate here is a lower bound.",
  "Two runs is not a sample. These are proportions over a handful of known " +
    "errors, not an estimate with a confidence interval.",
  "Both runs used the same prompt, the same geometric evidence and the same " +
    "model family. Genuinely uncorrelated checks would need a different kind of " +
    "checker, not a second opinion from a sibling.",
  "Agreement is measured on the target path only. Two runs can agree on the " +
    "path and differ on the tick condition, which this does not count.",
];

if (!primary) {
  metrics.push({
    id: "unavailable",
    label: "Primary mapping run",
    value: "absent",
    provenance: assumed("src/forms/maps not found", "run tools/discover-maps.ts"),
  });
} else {
  metrics.push({
    id: "primary.model",
    label: "Primary run",
    value: primary.model,
    provenance: measured(`discoveredBy across ${PRIMARY}`),
  });
  metrics.push({
    id: "primary.mappings",
    label: "Verified mappings, primary run",
    value: primary.entries,
    provenance: measured(`entries summed across ${PRIMARY}/*.json`),
  });
  metrics.push({
    id: "rewound",
    label: "Human corrections rewound before comparing",
    value: adjudications.filter((a) => a.wasTarget).length,
    provenance: measured("adjudications with a wasTarget, restored to the original proposal"),
    caveat:
      "Without this the primary run already carries the corrections — which came " +
      "from reading the form, and on these fields coincide with the second run — " +
      "so agreement would be measured after copying the answer.",
  });
}

if (primary && second) {
  let both = 0;
  let agree = 0;
  const disagreements: { form: string; field: string; a: string; b: string }[] = [];

  for (const [form, fieldsA] of primary.byForm) {
    const fieldsB = second.byForm.get(form);
    if (!fieldsB) continue;
    for (const [field, a] of fieldsA) {
      const b = fieldsB.get(field);
      if (b === undefined) continue;
      both++;
      if (a === b) agree++;
      else disagreements.push({ form, field, a, b });
    }
  }

  metrics.push(
    {
      id: "second.model",
      label: "Second, independent run",
      value: second.model,
      provenance: measured(`discoveredBy across ${SECOND}`),
    },
    {
      id: "both",
      label: "Fields mapped by both runs",
      value: both,
      provenance: measured("intersection of the two runs, keyed by widget name"),
    },
    {
      id: "agree",
      label: "…on which they agree",
      value: agree,
      provenance: measured("identical target path"),
    },
    {
      id: "agreementRate",
      label: "Agreement rate",
      value: both ? Math.round((agree / both) * 1000) / 10 : 0,
      unit: "%",
      provenance: derived(["agree", "both"], "agree / both"),
    },
    {
      id: "disagree",
      label: "…on which they disagree",
      value: disagreements.length,
      provenance: measured("differing target path for the same widget"),
      caveat:
        disagreements.length > 0
          ? `Each one is a field a human should look at: ${disagreements
              .slice(0, 4)
              .map((d) => `${d.form}/${d.field.split(".").pop()}`)
              .join(", ")}`
          : undefined,
    },
  );

  // Ground truth: the mappings we know were wrong, and what each run said.
  const known = adjudications.filter((a) => a.wasTarget);
  let agreedAndWrong = 0;
  let disagreedAndWrong = 0;
  const bothWrong: string[] = [];

  for (const a of known) {
    const bTarget = second.byForm.get(a.form)?.get(a.field);
    if (bTarget === undefined) continue;
    // `primary` has been rewound, so its value here IS a.wasTarget.
    if (bTarget === a.wasTarget) {
      agreedAndWrong++;
      bothWrong.push(`${a.form}/${a.field.split(".").pop()} → ${a.wasTarget}`);
    } else {
      disagreedAndWrong++;
    }
  }

  metrics.push(
    {
      id: "knownErrors",
      label: "Mappings independently confirmed wrong",
      value: known.length,
      provenance: measured("adjudications carrying a wasTarget, in src/forms/adjudications.json"),
      caveat:
        "Found by inspecting disagreements and by rendering filled PDFs and reading " +
        "them. Not an exhaustive audit.",
    },
    {
      id: "agreedAndWrong",
      label: "…where BOTH runs gave the same wrong answer",
      value: agreedAndWrong,
      provenance: measured("second run's target equals the primary run's superseded target"),
      caveat: bothWrong.length
        ? `Correlated failure, observed: ${bothWrong.join("; ")}. Voting would not have caught these.`
        : undefined,
    },
    {
      id: "disagreedAndWrong",
      label: "…where the runs disagreed, and the disagreement flagged it",
      value: disagreedAndWrong,
      provenance: measured("second run's target differs from the primary run's superseded target"),
    },
  );

  if (agreedAndWrong > 0 && agree > 0) {
    metrics.push({
      id: "errorGivenAgreement",
      label: "Confirmed error rate GIVEN the runs agreed",
      value: Math.round((agreedAndWrong / agree) * 10000) / 100,
      unit: "% (lower bound)",
      provenance: derived(["agreedAndWrong", "agree"], "agreedAndWrong / agree"),
      caveat:
        "A lower bound, and the number that matters: agreement is not correctness. " +
        "Any pipeline that ships what two runs agree on would have shipped this.",
    });
  }
  if (disagreements.length > 0) {
    metrics.push({
      id: "errorGivenDisagreement",
      label: "Confirmed error rate GIVEN they disagreed",
      value: Math.round((disagreedAndWrong / disagreements.length) * 10000) / 100,
      unit: "% (lower bound)",
      provenance: derived(
        ["disagreedAndWrong", "disagree"],
        "disagreedAndWrong / disagree",
      ),
      caveat:
        "Disagreement is a useful trigger for review — it is where we found one of " +
        "the errors — but it is a filter, not a proof.",
    });
  }
} else {
  metrics.push({
    id: "second.absent",
    label: "Second independent run",
    value: "not present",
    provenance: assumed(
      `${SECOND} is empty or missing`,
      "WK_MODEL=claude-sonnet-5 WK_OUT=src/forms/maps-crosscheck npx vite-node tools/discover-maps.ts",
    ),
  });
}

export const BENCHMARK: Benchmark = {
  id: "calibration",
  title: "Calibration — does agreement mean correctness?",
  question:
    "Two independent models mapped the same government forms from the same evidence. " +
    "Where they agree, is the answer right?",
  metrics,
  limits,
};

// vite-node strips the entry path out of process.argv, so there is no reliable
// is-this-the-entry test; the aggregate suite sets BENCH_QUIET=1.
if (process.env.BENCH_QUIET !== "1") print(BENCHMARK);
