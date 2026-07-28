// The approval gate.
//
// Two questions decide whether a machine may act alone: how reversible is the
// action, and how large is the blast radius if it is wrong. Telling an executor
// to send an email is cheap to undo and hurts nobody. Telling them to file for
// formal probate when a cheaper route was available costs the family months.
//
// Those axes are recorded on every rule, so the gate is computed, not guessed.
// Nothing here asks a model for permission.

import { ledger, type Fact, type FactKey } from "./facts";
import type { BlastRadius, Decision, Reversibility } from "./rules";

export type Approval = "auto" | "review" | "blocked";

export interface Gate {
  decisionPoint: string;
  ruleId?: string;
  approval: Approval;
  blastRadius?: BlastRadius;
  reversibility?: Reversibility;
  /** Plain-language justification, for the UI and the audit log. */
  reasons: string[];
  /** Facts the decision leaned on that are not verified. Must be empty. */
  unverifiedSupport: FactKey[];
}

/**
 * A decision may execute automatically only when it is cheap to be wrong.
 * Anything irreversible, or with a high blast radius, requires a named human to
 * sign — and the sign-off is recorded against the full citation trail.
 */
export function gateFor(decision: Decision, facts: Fact[]): Gate {
  const chosen = decision.chosen;
  const verified = ledger(facts);
  const reasons: string[] = [];

  if (!chosen) {
    return {
      decisionPoint: decision.decisionPoint,
      approval: "blocked",
      reasons:
        decision.blocked.length > 0
          ? [`Cannot conclude: missing ${decision.needs.length} required fact(s).`]
          : ["No rule applies to this estate on the facts held."],
      unverifiedSupport: [],
    };
  }

  // Defence in depth. The ledger already withholds unverified facts from the
  // engine, so this should never fire — if it ever does, something upstream is
  // broken and the safe response is to refuse rather than proceed.
  const unverifiedSupport = chosen.dependsOn.filter((k) => {
    const f = verified.get(k);
    return f === undefined ? false : f.status !== "verified";
  });

  const { blastRadius, reversibility } = chosen.rule;

  if (unverifiedSupport.length > 0) {
    return {
      decisionPoint: decision.decisionPoint,
      ruleId: chosen.ruleId,
      approval: "blocked",
      blastRadius,
      reversibility,
      reasons: ["Decision rests on facts that failed verification."],
      unverifiedSupport,
    };
  }

  if (reversibility === "irreversible") {
    reasons.push("The action cannot be undone once taken.");
  } else if (reversibility === "costly") {
    reasons.push("Reversing this would cost significant time or money.");
  }
  if (blastRadius === "high") {
    reasons.push("A wrong answer here changes the whole settlement path.");
  } else if (blastRadius === "medium") {
    reasons.push("A wrong answer here affects several downstream steps.");
  }

  const needsHuman = reversibility !== "reversible" || blastRadius === "high";
  if (!needsHuman) {
    reasons.push("Reversible and low impact — safe to action automatically.");
  }

  return {
    decisionPoint: decision.decisionPoint,
    ruleId: chosen.ruleId,
    approval: needsHuman ? "review" : "auto",
    blastRadius,
    reversibility,
    reasons,
    unverifiedSupport: [],
  };
}

export function gates(decisions: Decision[], facts: Fact[]): Gate[] {
  return decisions.map((d) => gateFor(d, facts));
}
