// Supersession replay: what is provably NOT re-computed.
//
// One fact moves — a supplemental appraisal supersedes the first one and
// re-values the residence from $740,000 to $760,000 — and the question this
// module answers is not "what changed?" but "what can we prove did not?".
//
// Everything below is computed at module load by running the real engine over
// the real fixture: `admit`/`deriveCaFacts` build the two ledgers, `reconcile`
// does the incremental re-evaluation, `impacted` decides the skip set. Nothing
// is copied from the test file or from a commit message.
//
// Two things are measured that a benchmark of this kind normally asserts in
// prose instead:
//
//   1. The skip is *checked*, not claimed. Every skipped decision point is
//      recomputed from scratch against the new ledger and compared, and the
//      skip rule is then attacked exhaustively — every single-key removal and
//      every single-key mutation of the base ledger — looking for a decision
//      point that the reactor said could not have moved and that moved anyway.
//      Most of those assertions are uninformative, because most keys in this
//      ledger are read by no rule; the informative subset is counted separately
//      rather than hidden inside a larger, more impressive total.
//
//   2. The work "avoided" is measured against what the code actually executes,
//      by instrumenting the rule objects with a Proxy that counts predicate
//      evaluations. `reconcile()` as written evaluates the whole applicable
//      rule set and then splices the untouched points through, so the skip is
//      a carry-forward and audit guarantee plus an upper bound on avoidable
//      work — it is NOT, today, a measured speed-up. Reporting it as one would
//      be exactly the kind of unwarranted claim this project exists to refuse,
//      so no wall-clock figure appears here at all.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { admit, admitAll, ledger, values, type Fact, type FactKey, type FactValue } from "../src/lib/facts";
import { applicable, decide, evaluateRule, type Decision, type Rule } from "../src/lib/rules";
import { impacted, reconcile } from "../src/lib/reactor";
import { CA_RULES, deriveCaFacts } from "../src/rules/ca-probate";
import {
  AS_OF,
  HOYT_DOCS,
  INITIAL_CANDIDATES,
  SUPPLEMENTAL_APPRAISAL,
  SUPPLEMENTAL_CANDIDATE,
} from "../src/fixtures/hoyt-estate";
import {
  assumed,
  derived as derivedFrom,
  measured,
  print,
  type Benchmark,
  type Metric,
} from "./harness";

type Values = Record<FactKey, FactValue>;

const WHERE = { state: "CA", county: "San Mateo" };

// ---------------------------------------------------------------------------
// Build both worlds for real
// ---------------------------------------------------------------------------

const beforeBase: Fact[] = admitAll(INITIAL_CANDIDATES, HOYT_DOCS, { now: 1 });
const beforeFacts: Fact[] = [...beforeBase, ...deriveCaFacts(beforeBase, AS_OF, 1)];

const afterDocs = [...HOYT_DOCS, SUPPLEMENTAL_APPRAISAL];
const afterBase: Fact[] = [
  ...admitAll(INITIAL_CANDIDATES, afterDocs, { now: 1 }),
  admit(SUPPLEMENTAL_CANDIDATE, afterDocs, { now: 2 }),
];
const afterFacts: Fact[] = [...afterBase, ...deriveCaFacts(afterBase, AS_OF, 2)];

const beforeValues: Values = values(beforeFacts);
const afterValues: Values = values(afterFacts);

// ---------------------------------------------------------------------------
// Instrumentation: count predicate evaluations the engine actually performs.
//
// `evaluateRule` reads `rule.when` exactly once per evaluation, so a get trap
// on that property is a faithful counter of rules actually evaluated. This is
// a behavioural measurement of the implementation, not a reading of its source.
// ---------------------------------------------------------------------------

let whenReads = 0;
const INSTRUMENTED: Rule[] = CA_RULES.map(
  (r) =>
    new Proxy(r, {
      get(target, prop, receiver) {
        if (prop === "when") whenReads += 1;
        return Reflect.get(target, prop, receiver);
      },
    }),
);

const beforeDecisions: Decision[] = decide(INSTRUMENTED, beforeValues, WHERE);

whenReads = 0;
const report = reconcile(
  { facts: beforeFacts, decisions: beforeDecisions },
  afterFacts,
  INSTRUMENTED,
  WHERE,
);
const evalsExecutedByReconcile = whenReads;

// ---------------------------------------------------------------------------
// Derived counts over the run
// ---------------------------------------------------------------------------

const scoped: Rule[] = applicable(CA_RULES, WHERE);
const reevaluatedSet = new Set(report.reevaluated);
const skippedSet = new Set(report.skipped);

// How the pack's rule count is actually made up. Most of it is generated from a
// county registry by two templates, and a headline "123 rules" that does not say
// so invites the reader to hear 123 distinct pieces of researched procedure.
const countyScopedRules = CA_RULES.filter((r) => r.jurisdiction.county !== undefined).length;
const statewideRules = CA_RULES.length - countyScopedRules;
const packDecisionPoints = new Set(CA_RULES.map((r) => r.decisionPoint)).size;

const rulesUnderReevaluated = scoped.filter((r) => reevaluatedSet.has(r.decisionPoint)).length;
const rulesUnderSkipped = scoped.filter((r) => skippedSet.has(r.decisionPoint)).length;

// Predicate-tree nodes that a lazy implementation would not have walked. Real
// evaluations, run here on purpose so the figure is counted rather than guessed.
const traceLengthsUnderSkipped = scoped
  .filter((r) => skippedSet.has(r.decisionPoint))
  .map((r) => evaluateRule(r, afterValues).trace.length);
const predicateStepsUnderSkipped = traceLengthsUnderSkipped.reduce((a, b) => a + b, 0);
const maxTraceUnderSkipped = Math.max(0, ...traceLengthsUnderSkipped);

/** Everything about a decision point a reader would notice if it moved. */
function project(d: Decision | undefined): string {
  if (!d) return "<absent>";
  return JSON.stringify({
    chosen: d.chosen?.ruleId ?? null,
    conclusion: d.chosen?.rule.then.conclusion ?? null,
    forms: (d.chosen?.rule.then.forms ?? []).map((f) => f.code),
    obligations: d.chosen?.rule.then.obligations ?? [],
    timelineDays: d.chosen?.rule.then.timelineDays ?? null,
    estCostUsd: d.chosen?.rule.then.estCostUsd ?? null,
    alsoFired: d.alsoFired.map((r) => r.ruleId).sort(),
    blocked: d.blocked.map((r) => r.ruleId).sort(),
    needs: d.needs,
    // The dependency set is compared as well as the visible answer. A
    // carried-forward decision keeps the `dependsOn` it was computed with, and
    // that stale set is exactly what the *next* reconcile tests for impact — so
    // a skip that preserved the conclusion while drifting the dependency edges
    // would poison the following round, and has to count as a difference here.
    dependsOn: d.dependsOn,
  });
}

// Check the skip rather than trust it: recompute the whole pack from scratch
// against the new ledger and confirm each skipped point is byte-identical to
// the one that was carried forward.
const scratch = decide(CA_RULES, afterValues, WHERE);
const scratchByPoint = new Map(scratch.map((d) => [d.decisionPoint, d]));
const mergedByPoint = new Map(report.decisions.map((d) => [d.decisionPoint, d]));
const skippedConfirmedUnchanged = report.skipped.filter(
  (p) => project(scratchByPoint.get(p)) === project(mergedByPoint.get(p)),
).length;

// ---------------------------------------------------------------------------
// Attack the skip rule exhaustively over single-key deltas
// ---------------------------------------------------------------------------

function perturb(v: FactValue): FactValue {
  if (typeof v === "number") return v * 2 + 1;
  if (typeof v === "boolean") return !v;
  return `${v} — perturbed`;
}

const baseByPoint = new Map(beforeDecisions.map((d) => [d.decisionPoint, d]));

// The two sets `impacted()` tests a changed key against. A key in neither is
// read by no decision point at all, so perturbing it *cannot* move anything —
// and an assertion about it therefore tells you nothing about whether the skip
// rule is sound. Those assertions are counted separately below rather than
// folded into a headline total that would flatter the trial.
const dependencyKeys = new Set(beforeDecisions.flatMap((d) => d.dependsOn));
const needKeys = new Set(beforeDecisions.flatMap((d) => d.needs));
const readKeys = new Set([...dependencyKeys, ...needKeys]);
const keysReadByNothing = Object.keys(beforeValues).filter((k) => !readKeys.has(k)).length;

let soundnessTrials = 0;
let soundnessViolations = 0;
let skippedPointChecks = 0;
let informativeSkippedPointChecks = 0;

for (const key of Object.keys(beforeValues)) {
  for (const mode of ["remove", "mutate"] as const) {
    const next: Values = { ...beforeValues };
    if (mode === "remove") delete next[key];
    else next[key] = perturb(next[key]);

    soundnessTrials += 1;
    const { skip } = impacted(beforeDecisions, [key]);
    const fresh = decide(CA_RULES, next, WHERE);
    const freshByPoint = new Map(fresh.map((d) => [d.decisionPoint, d]));
    for (const point of skip) {
      skippedPointChecks += 1;
      if (readKeys.has(key)) informativeSkippedPointChecks += 1;
      if (project(freshByPoint.get(point)) !== project(baseByPoint.get(point))) {
        soundnessViolations += 1;
      }
    }
  }
}

const skipCountsPerKey = Object.keys(beforeValues).map(
  (k) => impacted(beforeDecisions, [k]).skip.length,
);
const meanSkipPerSingleKey =
  skipCountsPerKey.reduce((a, b) => a + b, 0) / (skipCountsPerKey.length || 1);

// ---------------------------------------------------------------------------
// The audit property: does every decision that moved name the fact that moved it?
// ---------------------------------------------------------------------------

const changedKeySet = new Set(report.factDeltas.map((d) => d.key));
const flippedDeltas = report.decisionDeltas.filter((d) => d.flipped);

// Note what this can and cannot test. `reconcile()` builds `triggeredBy` as
// `after.dependsOn.filter(k => changedKeys.has(k))` (reactor.ts), so "every named
// key is a changed key the decision point reads" is true *by construction* — the
// `every` below is a structural assertion, not a finding, and is kept only so a
// future change to that construction fails loudly here. The one substantive
// property is non-emptiness: that a decision which flipped can point at
// something in the fact deltas rather than shrugging.
const triggeredBySubsetHolds = flippedDeltas.every((d) =>
  d.triggeredBy.every((k) => changedKeySet.has(k)),
);
const flipsNamingChangedFact = flippedDeltas.filter(
  (d) => d.triggeredBy.length > 0 && d.triggeredBy.every((k) => changedKeySet.has(k)),
).length;
const drivingKeys = [...new Set(report.decisionDeltas.flatMap((d) => d.triggeredBy))].sort();

const warrantedDeltas = report.factDeltas.filter((d) => d.cause?.status === "verified").length;

// Break the warranted count down by *kind* of warrant, because the kinds are not
// equally earned. A quote warrant reaches "verified" only by `verify.ts` locating
// the quotation in a document we hold — a check that can and does fail. A
// derivation warrant is stamped `status: "verified"` by `derived()` in facts.ts
// with no check performed at all; it inherits trust from its inputs. Reporting
// the total alone would let a reader believe three quotations were checked.
const deltaWarrantKinds = report.factDeltas
  .map((d) => d.cause?.warrant.kind ?? "absent")
  .reduce<Record<string, number>>((acc, k) => ({ ...acc, [k]: (acc[k] ?? 0) + 1 }), {});
const quoteCheckedDeltas = report.factDeltas.filter(
  (d) => d.cause?.warrant.kind === "quote" && d.cause.status === "verified",
).length;
const warrantKindBreakdown = Object.entries(deltaWarrantKinds)
  .sort()
  .map(([k, n]) => `${n} ${k}`)
  .join(", ");

const residenceDelta = report.factDeltas.find((d) => d.key === "asset.residence.value");
const rootChangeUsd =
  typeof residenceDelta?.before === "number" && typeof residenceDelta?.after === "number"
    ? residenceDelta.after - residenceDelta.before
    : undefined;

const newResidence = ledger(afterFacts).get("asset.residence.value");
const supersessionDoc =
  newResidence && newResidence.warrant.kind === "quote"
    ? (newResidence.warrant.matchedDocument ?? newResidence.warrant.document)
    : undefined;

// ---------------------------------------------------------------------------
// One repo artefact read off disk: is the skip guarantee regression-guarded?
// ---------------------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const demoTestPath = resolve(here, "..", "src", "rules", "ca-probate.test.ts");
const demoTestSrc = readFileSync(demoTestPath, "utf8");
const skipAssertionsInDemoTest = (
  demoTestSrc.match(/expect\(\s*report\.(?:skipped|reevaluated)\s*\)/g) ?? []
).length;

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

const RAN = "running the CA pack over src/fixtures/hoyt-estate.ts at module load";

const metrics: Metric[] = [
  {
    id: "rules_in_pack",
    label: "Rules in the California pack",
    value: CA_RULES.length,
    provenance: measured("CA_RULES.length, read at module load — no fixture involved"),
    caveat: `Not ${CA_RULES.length} independently researched rules. ${statewideRules} are hand-written statewide rules; the other ${countyScopedRules} are generated from the 58-county registry in ca-counties.ts by two templates (a filing-fee rule and a local-overlay rule per county). They span ${packDecisionPoints} decision points in total.`,
  },
  {
    id: "rules_applicable",
    label: "Rules applicable in San Mateo",
    value: scoped.length,
    provenance: measured("applicable(CA_RULES, {state:'CA', county:'San Mateo'}).length"),
    caveat:
      "Jurisdiction scoping already discards the other counties' rules. That is a different mechanism from dependency-tracked skipping and the two must not be added together.",
  },
  {
    id: "decision_points",
    label: "Decision points evaluated",
    value: beforeDecisions.length,
    provenance: measured(
      `decide(...).length, ${RAN} — the rules passed in are the Proxy-wrapped CA_RULES described below, which forward every property read to the originals`,
    ),
    caveat:
      "This is the size of the current rule pack, not the size of California probate. Every ratio below is a ratio over these decision points only.",
  },
  {
    id: "ledger_keys",
    label: "Verified fact keys in the ledger before the change",
    value: Object.keys(beforeValues).length,
    provenance: measured("values(beforeFacts) — verified facts only, quarantined ones excluded"),
  },
  {
    id: "dependency_keys",
    label: "Fact keys any decision point actually reads",
    value: dependencyKeys.size,
    provenance: measured("union of Decision.dependsOn over all decision points"),
    caveat: `The other ${keysReadByNothing} of the ${Object.keys(beforeValues).length} ledger keys are read by no California decision point at all. That is the pack's coverage, and it inflates every skip figure below — see the soundness and mean-skip caveats.`,
  },

  // --- the change ----------------------------------------------------------
  {
    id: "fact_deltas",
    label: "Fact keys that moved",
    value: report.factDeltas.length,
    provenance: measured("reconcile(...).factDeltas.length"),
  },
  {
    id: "changed_fact_keys",
    label: "Which keys moved",
    value: report.factDeltas.map((d) => `${d.key} (${d.kind})`).join("; "),
    provenance: measured("reconcile(...).factDeltas"),
    caveat: "One extracted fact was superseded; the rest are derived facts that follow from it.",
  },
  {
    id: "warranted_deltas",
    label: "Moved facts whose new value carries a warrant marked verified",
    value: warrantedDeltas,
    provenance: measured("count of factDeltas whose cause fact has status 'verified'"),
    caveat: `Do not read this as three checked quotations. By warrant kind the moved facts are: ${warrantKindBreakdown}. Only a quote warrant earns 'verified' by a check that could have failed; \`derived()\` in facts.ts stamps status 'verified' on a derivation warrant unconditionally, inheriting trust from its inputs. This count therefore mixes one verification with two inheritances.`,
  },
  {
    id: "quote_checked_deltas",
    label: "Moved facts whose new value was checked against a document",
    value: quoteCheckedDeltas,
    provenance: measured(
      "count of factDeltas whose cause fact has warrant.kind 'quote' and status 'verified' — i.e. verify.ts located the quotation",
    ),
    caveat:
      "This is the subset of the row above that a verification actually ran on. It proves the quotation exists in a document we hold, not that the appraisal is right.",
  },

  // --- the skip ------------------------------------------------------------
  {
    id: "decisions_reevaluated",
    label: "Decision points re-evaluated",
    value: report.reevaluated.length,
    provenance: measured("reconcile(...).reevaluated.length"),
  },
  {
    id: "decisions_skipped",
    label: "Decision points provably untouched",
    value: report.skipped.length,
    provenance: measured("reconcile(...).skipped.length"),
    caveat: `The skipped points are: ${report.skipped.join(", ")}.`,
  },
  {
    id: "skip_share",
    label: "Share of decision points skipped",
    value: report.skipped.length / (beforeDecisions.length || 1),
    provenance: derivedFrom(
      ["decisions_skipped", "decision_points"],
      "decisions_skipped / decision_points",
    ),
  },
  {
    id: "skipped_confirmed_unchanged",
    label: "Skipped points confirmed identical on full recomputation",
    value: skippedConfirmedUnchanged,
    provenance: measured(
      "each skipped point recomputed from scratch against the new ledger and compared field-by-field with the carried-forward decision",
    ),
    caveat:
      "This is the check that turns 'skipped' from a claim into a finding. It compares chosen rule, conclusion, forms, obligations, timeline, cost, also-fired, blocked, needs and the dependency set. It does not compare the evaluation traces.",
  },
  {
    id: "decisions_flipped",
    label: "Decision points whose winning rule changed",
    value: report.flippedCount,
    provenance: measured("reconcile(...).flippedCount"),
    caveat:
      "reconcile() only builds decision deltas for points it re-evaluated, so a flip hidden inside the skip set could not appear in this count. The row above is what tests for that.",
  },

  // --- work avoided, honestly bounded --------------------------------------
  {
    id: "rules_under_skipped",
    label: "Rules sitting under skipped decision points",
    value: rulesUnderSkipped,
    provenance: measured("applicable rules whose decisionPoint is in reconcile(...).skipped"),
  },
  {
    id: "predicate_steps_under_skipped",
    label: "Predicate-tree nodes under skipped points",
    value: predicateStepsUnderSkipped,
    provenance: measured(
      "sum of evaluateRule(rule, after-ledger).trace.length over rules under skipped points",
    ),
    caveat: `A finer-grained unit of the work a lazy implementation would not do, and these evaluations were run here in order to count them. On this fixture it carries almost no information beyond the rule count: no rule under a skipped point produces more than ${maxTraceUnderSkipped} trace node, so ${rulesUnderSkipped} rules give ${predicateStepsUnderSkipped} nodes. A pack with real predicate trees under its skipped points would separate the two figures.`,
  },
  {
    id: "evals_executed",
    label: "Rule evaluations reconcile() actually performed",
    value: evalsExecutedByReconcile,
    provenance: measured(
      "Proxy get-trap counting reads of Rule.when during the reconcile() call",
    ),
    caveat:
      "reconcile() evaluates the full applicable set and then splices the untouched points through. The skip is therefore a carry-forward and audit guarantee, not a saving the current code banks.",
  },
  {
    id: "evals_required",
    label: "Rules under re-evaluated points — evaluations still logically required",
    value: rulesUnderReevaluated,
    provenance: measured("applicable rules whose decisionPoint is in reconcile(...).reevaluated"),
    caveat:
      "A count of rules, not an observed execution: no run performed exactly this many evaluations. It is what a lazy implementation would have been obliged to do, inferred from the re-evaluated set.",
  },
  {
    id: "evals_avoidable",
    label: "Rule evaluations an implementation could have skipped",
    value: evalsExecutedByReconcile - rulesUnderReevaluated,
    provenance: derivedFrom(
      ["evals_executed", "evals_required"],
      "evals_executed − evals_required",
    ),
    caveat: "An upper bound on avoidable work, not work presently avoided.",
  },

  // --- soundness of the skip rule -----------------------------------------
  {
    id: "soundness_trials",
    label: "Single-key perturbations tried against the skip rule",
    value: soundnessTrials,
    provenance: measured(
      "every ledger key removed, and every ledger key mutated (numbers doubled+1, booleans negated, strings suffixed), then the pack re-decided",
    ),
  },
  {
    id: "soundness_checks",
    label: "Skipped-point assertions made across those trials",
    value: skippedPointChecks,
    provenance: measured(
      "for each trial, every decision point impacted() declared unaffected was compared against the base decision",
    ),
    caveat: `Most of this total is padding, and the next row is the figure to quote. ${skippedPointChecks - informativeSkippedPointChecks} of the ${skippedPointChecks} assertions perturb a key that no decision point reads, so impacted() returns the whole pack as skipped and the assertion cannot fail whatever the skip rule does.`,
  },
  {
    id: "soundness_checks_informative",
    label: "Of those, assertions that could have failed",
    value: informativeSkippedPointChecks,
    provenance: measured(
      "the same assertions, restricted to trials whose perturbed key is in some decision point's dependsOn or needs — the only trials where impacted() has a discrimination to get wrong",
    ),
    caveat:
      "Still an over-count of difficulty: a key read by one decision point yields an easy assertion at each of the others. Nothing here is a claim that the informative trials are hard.",
  },
  {
    id: "soundness_violations",
    label: "Points impacted() called safe that moved anyway",
    value: soundnessViolations,
    provenance: measured("count of mismatches across the trials above"),
    caveat:
      "Covers single-key deltas from one base ledger only. Simultaneous multi-key changes and newly-appearing keys are not covered. Zero violations over these trials is a failure to falsify, not a proof.",
  },
  {
    id: "mean_skip_per_single_key",
    label: "Mean decision points skipped per single-key change",
    value: meanSkipPerSingleKey,
    provenance: measured("mean of impacted(beforeDecisions, [k]).skip.length over every ledger key"),
    caveat: `Inflated by the pack's coverage rather than by the reactor's cleverness: ${keysReadByNothing} of the ${Object.keys(beforeValues).length} keys in this ledger are read by no California decision point at all, so changing one of them skips everything. Read this as a statement about pack shape first.`,
  },

  // --- the audit property --------------------------------------------------
  {
    id: "flips_naming_cause",
    label: "Flipped decisions naming at least one changed fact key they read",
    value: flipsNamingChangedFact,
    provenance: measured(
      "count of flipped DecisionDeltas with a non-empty triggeredBy (the accompanying subset assertion holds by construction — see caveat)",
    ),
    caveat: `The substantive test is non-emptiness only. reconcile() builds triggeredBy as after.dependsOn filtered against the changed keys, so "every named key appears in the fact deltas" is true by construction and is asserted here (it held: ${triggeredBySubsetHolds}) as a guard against that construction changing, not as a finding.`,
  },
  {
    id: "flip_audit_completeness",
    label: "Share of flipped decisions that can point at a changed key",
    value: flipsNamingChangedFact / (report.flippedCount || 1),
    provenance: derivedFrom(
      ["flips_naming_cause", "decisions_flipped"],
      "flips_naming_cause / decisions_flipped",
    ),
    caveat:
      "The weakest reading is the correct one: no flipped decision came back with an empty cause list. Naming a changed key it read is a dependency-edge claim, not a counterfactual proof of causation, and this module runs no counterfactual — it never reverts a named key to see whether the decision goes back.",
  },
  {
    id: "driving_fact_keys",
    label: "Fact keys named as driving the changed decisions",
    value: drivingKeys.join("; ") || "none",
    provenance: measured("union of DecisionDelta.triggeredBy across reconcile(...).decisionDeltas"),
  },
  {
    id: "skip_assertions_in_demo_test",
    label: "Assertions pinning the skip set in the demo test",
    value: skipAssertionsInDemoTest,
    provenance: measured(
      "regex count of expect(report.skipped) and expect(report.reevaluated) read off disk from src/rules/ca-probate.test.ts",
    ),
    caveat: "Says the guarantee is regression-guarded, not that the guard is sufficient.",
  },

  // --- the denominator nobody has --------------------------------------------
  {
    id: "review_minutes_per_decision_point",
    label: "Human review minutes a skipped decision point saves",
    value: "unsourced",
    provenance: assumed(
      "No figure is offered. Nobody has measured how long a settlement specialist spends re-checking one decision point after a document lands, so no number is invented here.",
      "Alix operations — time-and-motion data from specialists re-reviewing decisions after a supplemental document arrives, or timesheet data broken down per decision point.",
    ),
    caveat:
      "Without this, the skip count cannot be converted into hours or dollars, and this module deliberately converts it into neither.",
  },
];

// Inserted by id rather than by literal index, so adding a metric above cannot
// silently shuffle these two into the wrong section.
const afterFactDeltas = metrics.findIndex((m) => m.id === "fact_deltas") + 1;

if (rootChangeUsd !== undefined) {
  metrics.splice(afterFactDeltas, 0, {
    id: "root_change_usd",
    label: "Size of the single valuation change",
    value: rootChangeUsd,
    unit: "USD",
    provenance: measured("after − before of asset.residence.value in reconcile(...).factDeltas"),
  });
}

if (supersessionDoc !== undefined) {
  metrics.splice(afterFactDeltas + (rootChangeUsd !== undefined ? 1 : 0), 0, {
    id: "supersession_document",
    label: "Document that superseded the appraisal",
    value: supersessionDoc,
    provenance: measured("quote warrant of the winning asset.residence.value fact in the new ledger"),
  });
}

export const BENCHMARK: Benchmark = {
  id: "replay",
  title: "Supersession replay — what is provably not re-computed",
  question:
    "When a supplemental appraisal supersedes one fact and flips the probate route, how many decision points can be shown not to need re-evaluating, and can every decision that did move point at a changed fact it read?",
  metrics,
  limits: [
    "Establishes no time or cost saving. No wall-clock figure is reported, and reconcile() as written still evaluates the whole applicable rule set before splicing the untouched points through — so the skip is an audit and carry-forward guarantee plus an upper bound on avoidable work, not a measured speed-up.",
    "One estate, one jurisdiction, one supersession. This is a case study on a synthetic fixture, not a distribution over real estates, and nothing here says how often a real data room produces a superseding document.",
    `The ${beforeDecisions.length} decision points are the size of the current California pack, not of California probate. Skip share would move with the pack's size and dependency shape, in either direction.`,
    "The soundness trials cover single-key removals and single-key mutations from one base ledger. They do not cover simultaneous multi-key changes, keys that appear for the first time, or edits to the rule pack itself.",
    `The soundness trial is weaker than its headline count suggests. Only ${informativeSkippedPointChecks} of the ${skippedPointChecks} skipped-point assertions perturb a key that any decision point reads; the remaining ${skippedPointChecks - informativeSkippedPointChecks} could not have failed however impacted() were written. Zero violations is a failure to falsify over a small informative sample, not a proof of soundness.`,
    `The rule count is mostly generated. ${countyScopedRules} of the ${CA_RULES.length} rules in the pack come from two per-county templates over the 58-county registry, and only ${statewideRules} are hand-written statewide procedure. "123 rules" is not 123 pieces of researched law.`,
    "The skip guarantee holds only because the evaluator walks the entire predicate tree and records every key it consults. A future short-circuiting evaluator would silently under-record dependencies, and nothing measured here would catch that.",
    "The fixture is synthetic. Every rule in the pack carries an authority citation, but whether those citations are correctly read is not tested here — and Margaret Hoyt is not a real decedent, so no real client file has been replayed.",
    "Says nothing about whether the decisions are legally correct — only about which ones moved, which provably did not, and what each names as its cause.",
    "The audit property measured is that a flipped decision names a changed fact key it read, and that much is partly true by construction of `triggeredBy`. No counterfactual is run: nothing here reverts a named key to confirm the decision goes back, so causation is not established beyond the dependency edge.",
    "Quarantined facts are excluded from the ledger before any of this runs, so these figures presuppose the verification layer rather than testing it. Derived facts are a second presupposition of the same kind: `derived()` marks them verified without a check, so a warrant count over the moved facts is not a count of verifications performed.",
  ],
};

// Tiny main. `npx vite-node bench/replay.ts` strips the entry path out of
// process.argv, so there is no reliable is-this-the-entry-module test; the
// module prints unless a caller opts out. A suite runner that wants the metrics
// without the console block sets WARRANT_BENCH_NO_PRINT=1 or the global below
// before importing.
const suppressed =
  process.env.WARRANT_BENCH_NO_PRINT === "1" ||
  (globalThis as { __warrantBenchSuite?: boolean }).__warrantBenchSuite === true;

if (!suppressed) print(BENCHMARK);
