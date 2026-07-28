// Change propagation.
//
// "How do you determine when this runs?" is the question that makes a legal
// decision engine hard. Re-running everything on every new document is
// expensive and, worse, it gives you no account of *why* an answer moved.
//
// Every decision records the fact keys it consulted while evaluating
// (`Decision.dependsOn`). So when a new document lands and the ledger shifts,
// we can compute exactly which decision points touched a changed fact,
// re-evaluate only those, and leave the rest provably untouched.
//
// The output is a Change Report: the fact that moved, the quotation that moved
// it, the rule that consequently fired, and what the executor must now do
// differently. That is the artefact a family — or a court — can actually audit.

import { ledger, type Fact, type FactKey, type FactValue } from "./facts";
import { decide, type Decision, type FormRef, type Rule } from "./rules";

export type DeltaKind = "added" | "changed" | "removed";

export interface FactDelta {
  key: FactKey;
  kind: DeltaKind;
  before?: FactValue;
  after?: FactValue;
  /** The newly admitted fact, carrying the warrant that justifies the change. */
  cause?: Fact;
}

export interface DecisionSnapshot {
  ruleId: string;
  title: string;
  conclusion: string;
  forms: FormRef[];
  obligations: string[];
  timelineDays: [number, number];
  estCostUsd: [number, number];
  citation: string;
}

export interface DecisionDelta {
  decisionPoint: string;
  /** True when the winning rule changed — the headline event. */
  flipped: boolean;
  before?: DecisionSnapshot;
  after?: DecisionSnapshot;
  formsAdded: FormRef[];
  formsRemoved: FormRef[];
  obligationsAdded: string[];
  obligationsRemoved: string[];
  /** Which of the changed fact keys this decision point actually reads. */
  triggeredBy: FactKey[];
}

export interface ChangeReport {
  factDeltas: FactDelta[];
  /** Decision points re-evaluated because they depend on a changed fact. */
  reevaluated: string[];
  /** Decision points provably unaffected — the work we did not have to do. */
  skipped: string[];
  decisionDeltas: DecisionDelta[];
  flippedCount: number;
  decisions: Decision[];
}

function snapshot(d: Decision): DecisionSnapshot | undefined {
  const c = d.chosen;
  if (!c) return undefined;
  return {
    ruleId: c.ruleId,
    title: c.title,
    conclusion: c.rule.then.conclusion,
    forms: c.rule.then.forms,
    obligations: c.rule.then.obligations,
    timelineDays: c.rule.then.timelineDays,
    estCostUsd: c.rule.then.estCostUsd,
    citation: c.rule.authority.citation,
  };
}

/** Compare two ledgers by decision-visible value. */
export function diffFacts(before: Fact[], after: Fact[]): FactDelta[] {
  const a = ledger(before);
  const b = ledger(after);
  const keys = [...new Set([...a.keys(), ...b.keys()])].sort();
  const out: FactDelta[] = [];

  for (const key of keys) {
    const was = a.get(key);
    const now = b.get(key);
    if (!was && now) {
      out.push({ key, kind: "added", after: now.value, cause: now });
    } else if (was && !now) {
      out.push({ key, kind: "removed", before: was.value });
    } else if (was && now && was.value !== now.value) {
      out.push({ key, kind: "changed", before: was.value, after: now.value, cause: now });
    }
  }
  return out;
}

/**
 * Split decision points into those that must be re-evaluated and those that
 * cannot possibly have moved. A decision point is impacted when its dependency
 * set intersects the changed keys.
 *
 * A blocked decision point is *not* automatically re-run. It is blocked on
 * specific facts, which the evaluator has already named, and it can only become
 * unblocked when one of those arrives. Since the evaluator records a key it
 * consulted even when that key was absent, a missing fact is already part of
 * the dependency set — so the intersection test alone is sound, and treating
 * "blocked" as "always stale" would forfeit the skip guarantee for nothing.
 */
export function impacted(
  previous: Decision[],
  changedKeys: FactKey[],
): { reevaluate: string[]; skip: string[] } {
  const changed = new Set(changedKeys);
  const reevaluate: string[] = [];
  const skip: string[] = [];

  for (const d of previous) {
    const touches = d.dependsOn.some((k) => changed.has(k));
    const needsChanged = d.needs.some((k) => changed.has(k));
    if (touches || needsChanged) reevaluate.push(d.decisionPoint);
    else skip.push(d.decisionPoint);
  }
  return { reevaluate, skip };
}

function formKey(f: FormRef): string {
  return f.code;
}

function diffForms(before: FormRef[], after: FormRef[]) {
  const b = new Set(before.map(formKey));
  const a = new Set(after.map(formKey));
  return {
    added: after.filter((f) => !b.has(formKey(f))),
    removed: before.filter((f) => !a.has(formKey(f))),
  };
}

/**
 * Re-run the engine incrementally against a changed ledger.
 *
 * Decision points that are not impacted are carried forward from the previous
 * run rather than recomputed, so `skipped` is a real statement about work
 * avoided, not a cosmetic one.
 */
export function reconcile(
  previous: { facts: Fact[]; decisions: Decision[] },
  nextFacts: Fact[],
  rules: Rule[],
  where: { state: string; county?: string },
): ChangeReport {
  const factDeltas = diffFacts(previous.facts, nextFacts);
  const changedKeys = factDeltas.map((d) => d.key);
  const { reevaluate, skip } = impacted(previous.decisions, changedKeys);

  // Evaluate the full rule set, then keep only the recomputed points and splice
  // the untouched ones through unchanged.
  const fresh = decide(rules, valuesOf(nextFacts), where);
  const freshByPoint = new Map(fresh.map((d) => [d.decisionPoint, d]));
  const prevByPoint = new Map(previous.decisions.map((d) => [d.decisionPoint, d]));

  const merged: Decision[] = [];
  for (const d of fresh) {
    const isNew = !prevByPoint.has(d.decisionPoint);
    if (isNew || reevaluate.includes(d.decisionPoint)) merged.push(d);
    else merged.push(prevByPoint.get(d.decisionPoint)!);
  }

  const changed = new Set(changedKeys);
  const decisionDeltas: DecisionDelta[] = [];
  for (const point of reevaluate) {
    const before = prevByPoint.get(point);
    const after = freshByPoint.get(point);
    if (!after) continue;
    const b = before ? snapshot(before) : undefined;
    const a = snapshot(after);
    const forms = diffForms(b?.forms ?? [], a?.forms ?? []);
    const obBefore = new Set(b?.obligations ?? []);
    const obAfter = new Set(a?.obligations ?? []);

    decisionDeltas.push({
      decisionPoint: point,
      flipped: (b?.ruleId ?? null) !== (a?.ruleId ?? null),
      before: b,
      after: a,
      formsAdded: forms.added,
      formsRemoved: forms.removed,
      obligationsAdded: [...obAfter].filter((o) => !obBefore.has(o)),
      obligationsRemoved: [...obBefore].filter((o) => !obAfter.has(o)),
      triggeredBy: (after.dependsOn ?? []).filter((k) => changed.has(k)),
    });
  }

  return {
    factDeltas,
    reevaluated: reevaluate,
    skipped: skip,
    decisionDeltas,
    flippedCount: decisionDeltas.filter((d) => d.flipped).length,
    decisions: merged,
  };
}

function valuesOf(facts: Fact[]): Record<FactKey, FactValue> {
  const out: Record<FactKey, FactValue> = {};
  for (const [k, f] of ledger(facts)) out[k] = f.value;
  return out;
}
