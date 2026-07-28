// Knowing what you do not have.
//
// A transcript mentions a car. It does not give you the VIN, the mileage, or
// what the car is worth — and you cannot file an inventory without them. The
// hard part of discovery is not extracting what is present, it is naming what
// is absent and saying which decision it is holding up.
//
// Gaps are not a separate analysis. They fall out of rule evaluation: any rule
// that came back `blocked` has already named the fact keys it could not read.

import type { Decision, Rule } from "./rules";
import type { FactKey } from "./facts";

export type GapSeverity = "blocking" | "informational";

export interface Gap {
  key: FactKey;
  severity: GapSeverity;
  /** Decision points that cannot conclude without this fact. */
  blocks: string[];
  /** Rules waiting on it, with the authority that requires it. */
  wantedBy: { ruleId: string; title: string; citation: string }[];
  /** Suggested way to obtain it, when the rule pack offers one. */
  howToObtain?: string;
}

/**
 * Optional guidance attached to a fact key: where an executor would actually go
 * to get it. Data, not code, so it grows with the rule pack.
 */
export type ObtainHints = Record<FactKey, string>;

export function findGaps(
  decisions: Decision[],
  hints: ObtainHints = {},
): Gap[] {
  const byKey = new Map<FactKey, Gap>();

  for (const decision of decisions) {
    // A decision point with a winning rule is answered; anything still missing
    // there is informational rather than blocking.
    const answered = Boolean(decision.chosen);

    for (const blocked of decision.blocked) {
      for (const key of blocked.blockedBy) {
        const existing = byKey.get(key);
        const entry: Gap = existing ?? {
          key,
          severity: answered ? "informational" : "blocking",
          blocks: [],
          wantedBy: [],
          howToObtain: hints[key],
        };
        // Blocking beats informational if any unanswered point needs it.
        if (!answered) entry.severity = "blocking";
        if (!answered && !entry.blocks.includes(decision.decisionPoint)) {
          entry.blocks.push(decision.decisionPoint);
        }
        if (!entry.wantedBy.some((w) => w.ruleId === blocked.ruleId)) {
          entry.wantedBy.push({
            ruleId: blocked.ruleId,
            title: blocked.title,
            citation: blocked.rule.authority.citation,
          });
        }
        byKey.set(key, entry);
      }
    }
  }

  return [...byKey.values()].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "blocking" ? -1 : 1;
    return b.blocks.length - a.blocks.length;
  });
}

/** One-line readiness statement for the top of the UI. */
export function readiness(decisions: Decision[], gaps: Gap[]): string {
  const blocking = gaps.filter((g) => g.severity === "blocking");
  const answered = decisions.filter((d) => d.chosen).length;
  if (blocking.length === 0) {
    return `All ${decisions.length} decision point(s) resolved on verified facts.`;
  }
  return `${answered} of ${decisions.length} decision point(s) resolved — ${blocking.length} fact(s) still required.`;
}

export type { Rule };
