// Rules as data.
//
// Probate procedure varies by state, by county, and by the year you are asking
// in. That combinatorial space cannot live in code — you cannot ship a Python
// file per county — so rules here are *data*: a predicate tree over fact keys,
// plus the authority that backs the rule and the forms it obliges.
//
// The evaluator is deterministic. No model runs in the decision path. Models
// propose facts (facts.ts); rules decide. That separation is what lets us tell
// an executor exactly why the system reached a conclusion.
//
// Evaluation is three-valued. A predicate over a fact we do not hold is
// `unknown`, never `false`. A rule whose condition is unknown does not quietly
// fail to fire — it reports itself blocked, and names the fact it needs. That
// is how "you cannot file yet, and here is what is missing" falls out of the
// same machinery that decides.

import type { FactKey, FactValue } from "./facts";

export type Tri = true | false | "unknown";

export type ComparisonOp = "==" | "!=" | "<" | "<=" | ">" | ">=";

export type Predicate =
  | { all: Predicate[] }
  | { any: Predicate[] }
  | { not: Predicate }
  | { fact: FactKey; op: ComparisonOp; value: FactValue }
  | { exists: FactKey }
  | { missing: FactKey };

export interface Authority {
  /** e.g. "Cal. Prob. Code § 13100" */
  citation: string;
  sourceUrl: string;
  /** ISO date the rule text took effect. */
  effectiveFrom: string;
  /** ISO date we read the source. Provenance decays; say when we looked. */
  retrievedAt: string;
  /** Who signed off on the extraction, if anyone has. */
  approvedBy?: string;
}

export interface FormRef {
  code: string;
  title: string;
  url?: string;
}

/** How badly a wrong answer here hurts. Drives the human-approval gate. */
export type BlastRadius = "low" | "medium" | "high";
export type Reversibility = "reversible" | "costly" | "irreversible";

export interface Rule {
  id: string;
  /** Rules competing to answer the same question, e.g. "probate_route". */
  decisionPoint: string;
  jurisdiction: { state: string; county?: string };
  title: string;
  /** Facts that must be held and verified before this rule can be evaluated. */
  requires: FactKey[];
  when: Predicate;
  then: {
    conclusion: string;
    forms: FormRef[];
    obligations: string[];
    /** Rough elapsed time, in days, low and high. */
    timelineDays: [number, number];
    estCostUsd: [number, number];
  };
  authority: Authority;
  /**
   * Fields in `then` that are practice estimates rather than sourced figures,
   * keyed by field name. Everything else on a rule carries a citation; where a
   * number cannot, saying so is mandatory rather than optional — an uncited
   * figure sitting silently beside cited ones is the failure mode this whole
   * system exists to prevent.
   */
  estimates?: Partial<Record<"timelineDays" | "estCostUsd", string>>;
  /** Higher wins when several rules fire for the same decision point. */
  priority: number;
  blastRadius: BlastRadius;
  reversibility: Reversibility;
  notes?: string;
}

export interface RulePack {
  id: string;
  title: string;
  jurisdiction: { state: string; county?: string };
  version: string;
  rules: Rule[];
}

// ---------------------------------------------------------------------------
// Predicate evaluation
// ---------------------------------------------------------------------------

export interface TraceStep {
  depth: number;
  description: string;
  result: Tri;
}

interface EvalCtx {
  values: Record<FactKey, FactValue>;
  /** Every fact key the evaluator actually consulted. Feeds the reactor. */
  reads: Set<FactKey>;
  /** Keys that were consulted but absent. Feeds gap detection. */
  missing: Set<FactKey>;
  trace: TraceStep[];
}

function compare(a: FactValue, op: ComparisonOp, b: FactValue): Tri {
  // String equality is case- and whitespace-insensitive. A live extraction run
  // returned "SWITZERLAND" from a document printed in capitals — the model was
  // being faithful to its source, which is exactly what we ask of it, and a
  // rule comparing against "Switzerland" would silently have failed to fire.
  // Punishing a model for copying accurately would be the wrong incentive.
  if ((op === "==" || op === "!=") && typeof a === "string" && typeof b === "string") {
    const eq = a.trim().toLowerCase() === b.trim().toLowerCase();
    return op === "==" ? eq : !eq;
  }
  if (op === "==") return a === b;
  if (op === "!=") return a !== b;
  // Ordered comparisons only make sense on numbers.
  if (typeof a !== "number" || typeof b !== "number") return "unknown";
  switch (op) {
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    case ">":
      return a > b;
    case ">=":
      return a >= b;
  }
}

function and(parts: Tri[]): Tri {
  if (parts.some((p) => p === false)) return false;
  if (parts.some((p) => p === "unknown")) return "unknown";
  return true;
}

function or(parts: Tri[]): Tri {
  if (parts.some((p) => p === true)) return true;
  if (parts.some((p) => p === "unknown")) return "unknown";
  return false;
}

function fmt(v: FactValue | undefined): string {
  if (v === undefined) return "—";
  return typeof v === "number" ? v.toLocaleString("en-US") : String(v);
}

function evaluate(p: Predicate, ctx: EvalCtx, depth = 0): Tri {
  if ("all" in p) {
    ctx.trace.push({ depth, description: "ALL of:", result: "unknown" });
    const at = ctx.trace.length - 1;
    const r = and(p.all.map((c) => evaluate(c, ctx, depth + 1)));
    ctx.trace[at].result = r;
    return r;
  }
  if ("any" in p) {
    ctx.trace.push({ depth, description: "ANY of:", result: "unknown" });
    const at = ctx.trace.length - 1;
    const r = or(p.any.map((c) => evaluate(c, ctx, depth + 1)));
    ctx.trace[at].result = r;
    return r;
  }
  if ("not" in p) {
    ctx.trace.push({ depth, description: "NOT:", result: "unknown" });
    const at = ctx.trace.length - 1;
    const inner = evaluate(p.not, ctx, depth + 1);
    const r: Tri = inner === "unknown" ? "unknown" : !inner;
    ctx.trace[at].result = r;
    return r;
  }
  if ("exists" in p) {
    ctx.reads.add(p.exists);
    const has = p.exists in ctx.values;
    if (!has) ctx.missing.add(p.exists);
    ctx.trace.push({ depth, description: `${p.exists} is known`, result: has });
    return has;
  }
  if ("missing" in p) {
    ctx.reads.add(p.missing);
    const has = p.missing in ctx.values;
    ctx.trace.push({ depth, description: `${p.missing} is not known`, result: !has });
    return !has;
  }

  ctx.reads.add(p.fact);
  const actual = ctx.values[p.fact];
  if (actual === undefined) {
    ctx.missing.add(p.fact);
    ctx.trace.push({
      depth,
      description: `${p.fact} ${p.op} ${fmt(p.value)}  (not known)`,
      result: "unknown",
    });
    return "unknown";
  }
  const r = compare(actual, p.op, p.value);
  ctx.trace.push({
    depth,
    description: `${p.fact} ${p.op} ${fmt(p.value)}  (actual: ${fmt(actual)})`,
    result: r,
  });
  return r;
}

// ---------------------------------------------------------------------------
// Rule evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a bare predicate. Exposed so other engines — lead detection, task
 * gating — reuse the same three-valued semantics and dependency capture rather
 * than growing a second, subtly different evaluator.
 */
export function evaluatePredicate(
  p: Predicate,
  facts: Record<FactKey, FactValue>,
): { result: Tri; reads: FactKey[]; missing: FactKey[]; trace: TraceStep[] } {
  const ctx: EvalCtx = { values: facts, reads: new Set(), missing: new Set(), trace: [] };
  const result = evaluate(p, ctx);
  return {
    result,
    reads: [...ctx.reads].sort(),
    missing: [...ctx.missing].sort(),
    trace: ctx.trace,
  };
}

export type RuleOutcome = "fired" | "not_applicable" | "blocked";

export interface RuleResult {
  ruleId: string;
  decisionPoint: string;
  title: string;
  outcome: RuleOutcome;
  condition: Tri;
  /** Fact keys this evaluation consulted — the dependency edge set. */
  dependsOn: FactKey[];
  /** Required or referenced facts we do not hold. */
  blockedBy: FactKey[];
  trace: TraceStep[];
  rule: Rule;
}

export function evaluateRule(rule: Rule, facts: Record<FactKey, FactValue>): RuleResult {
  const ctx: EvalCtx = { values: facts, reads: new Set(), missing: new Set(), trace: [] };

  // `requires` are consulted first so a blocked rule can name everything it
  // needs at once, rather than dripping out one missing fact per re-run.
  for (const key of rule.requires) {
    ctx.reads.add(key);
    if (!(key in facts)) ctx.missing.add(key);
  }

  const condition = evaluate(rule.when, ctx);
  const missingRequired = rule.requires.filter((k) => !(k in facts));

  let outcome: RuleOutcome;
  if (missingRequired.length > 0 || condition === "unknown") outcome = "blocked";
  else if (condition === true) outcome = "fired";
  else outcome = "not_applicable";

  return {
    ruleId: rule.id,
    decisionPoint: rule.decisionPoint,
    title: rule.title,
    outcome,
    condition,
    dependsOn: [...ctx.reads].sort(),
    blockedBy: [...new Set([...missingRequired, ...ctx.missing])].sort(),
    trace: ctx.trace,
    rule,
  };
}

export interface Decision {
  decisionPoint: string;
  /** The winning rule, when one fired. */
  chosen?: RuleResult;
  /** Fired rules that lost on priority — kept so the choice is auditable. */
  alsoFired: RuleResult[];
  blocked: RuleResult[];
  notApplicable: RuleResult[];
  /** Union of every fact key consulted at this decision point. */
  dependsOn: FactKey[];
  /** Facts that would unblock a currently-blocked rule. */
  needs: FactKey[];
}

/** Rules apply if the jurisdiction matches: statewide, or this exact county. */
export function applicable(
  rules: Rule[],
  where: { state: string; county?: string },
): Rule[] {
  // Matched case-insensitively for the same reason string comparisons are:
  // an extracted county may arrive as "SAN MATEO" straight off a death
  // certificate, and a jurisdiction that silently fails to match would drop
  // every local rule without saying so.
  const same = (a?: string, b?: string) =>
    (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

  return rules.filter((r) => {
    // "*" is the federal jurisdiction: IRS obligations attach wherever the
    // estate is administered. Without it a federal rule pack would have to be
    // duplicated fifty times, which is precisely the duplication rules-as-data
    // exists to avoid.
    if (r.jurisdiction.state !== "*" && !same(r.jurisdiction.state, where.state)) return false;
    if (!r.jurisdiction.county) return true;
    return same(r.jurisdiction.county, where.county);
  });
}

export function decide(
  rules: Rule[],
  facts: Record<FactKey, FactValue>,
  where: { state: string; county?: string },
): Decision[] {
  const scoped = applicable(rules, where);
  const results = scoped.map((r) => evaluateRule(r, facts));

  const points = [...new Set(scoped.map((r) => r.decisionPoint))];
  return points.map((point) => {
    const mine = results.filter((r) => r.decisionPoint === point);
    const fired = mine
      .filter((r) => r.outcome === "fired")
      .sort((a, b) => b.rule.priority - a.rule.priority);
    const blocked = mine.filter((r) => r.outcome === "blocked");
    return {
      decisionPoint: point,
      chosen: fired[0],
      alsoFired: fired.slice(1),
      blocked,
      notApplicable: mine.filter((r) => r.outcome === "not_applicable"),
      dependsOn: [...new Set(mine.flatMap((r) => r.dependsOn))].sort(),
      needs: [...new Set(blocked.flatMap((r) => r.blockedBy))].sort(),
    };
  });
}
