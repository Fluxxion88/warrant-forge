/**
 * The work order — Warrant's half of the seam with Forge.
 *
 * `forge/docs/01-CONTRACT.md` states the division in one line: *Warrant decides
 * what and why, Forge decides how*. This file is the "what and why", emitted in
 * the shape Forge already parses (`forge/src/forge/registry.py::load_work_order`,
 * and read by `fill.py`, `bench.py`, `reuse.py` and the review UI).
 *
 * Every applicability call here comes from `FORM_RULES` — the same rules-as-data
 * evaluator, three-valued logic and citations as the rest of the engine. Nothing
 * reads an applicability flag out of the estate record and passes it off as a
 * decision. That is what the pre-merge stand-in did, and it is deleted.
 *
 * Two places where the contract's vocabulary is narrower than Warrant's, both
 * handled explicitly rather than silently:
 *
 *  - `priority` in the contract is *filing order* (lower goes first), which is
 *    not what `Rule.priority` means — that is rule precedence, where higher
 *    wins. They are separate numbers and must not be confused.
 *  - `reversibility` in the contract is `reversible | irreversible`. Warrant
 *    also has `costly`. See REVERSIBILITY below.
 */

import { importEstate, type EstateRecord } from "./estate";
import { values } from "./facts";
import { decide, type BlastRadius, type Reversibility } from "./rules";
import { FORM_RULES } from "../rules/form-applicability";

export interface WorkOrderForm {
  formId: string;
  applicable: boolean;
  /** Required when `applicable` is false. Rendered verbatim in Forge's review UI. */
  reason: string | null;
  /** Filing order, lower first. Null when the form is not applicable. */
  priority: number | null;
  blastRadius: BlastRadius | null;
  reversibility: "reversible" | "irreversible" | null;
}

export interface WorkOrder {
  estateId: string;
  /** Forge-root-relative, as the contract's example writes it. */
  estatePath: string;
  jurisdiction: { state: string | null; county: string | null };
  route: string | null;
  generatedAt: string;
  generatedBy: string;
  forms: WorkOrderForm[];
}

/**
 * The one link between Forge's fixed `formId` registry and Warrant's decision
 * points. `affirmative` is the rule id that means "this form is required" — the
 * other rules at the same decision point are the ones that say, with authority,
 * that it is not.
 *
 * `filingOrder` is the contract's `priority`. SS-4 leads because a fiduciary
 * cannot open an estate bank account without an EIN (that obligation is stated
 * on the SS-4 rule itself); DL 142 trails because a licence surrender blocks
 * nothing else.
 */
const SEAM: {
  formId: string;
  decisionPoint: string;
  affirmative: string;
  filingOrder: number;
}[] = [
  { formId: "irs-ss4", decisionPoint: "form_ss4", affirmative: "form.ss4.needed", filingOrder: 1 },
  { formId: "irs-f56", decisionPoint: "form_56", affirmative: "form.56.needed", filingOrder: 2 },
  { formId: "irs-f8821", decisionPoint: "form_8821", affirmative: "form.8821.needed", filingOrder: 3 },
  { formId: "ca-dmv-dl142", decisionPoint: "form_dl142", affirmative: "form.dl142.applies", filingOrder: 4 },
];

/**
 * Warrant grades reversibility on three levels; the contract carries two, and
 * Forge's review UI has plain-English copy for exactly those two
 * (`walkthrough.py::REVERSIBILITY_COPY`), so an unmapped value renders as
 * nothing at all.
 *
 * `costly` maps to `irreversible` because that is the truthful side to round
 * to: the only `costly` rule here is SS-4, whose own note says applying twice
 * issues a second EIN for one estate. The filer cannot undo that; they can only
 * write to the IRS and wait. Rounding the other way would tell a human the
 * mistake is correctable.
 */
const REVERSIBILITY: Record<Reversibility, "reversible" | "irreversible"> = {
  reversible: "reversible",
  costly: "irreversible",
  irreversible: "irreversible",
};

/**
 * The estate record's own note about why a form does not apply, where Alix's
 * schema carries one. Warrant decides; this text is quoted verbatim alongside
 * the decision so the reason a human reads is the source's own words rather
 * than a paraphrase of them.
 */
function recordReason(record: EstateRecord, formId: string): string | null {
  if (formId !== "ca-dmv-dl142") return null;
  const note = (record.formDL142 as { notApplicableReason?: unknown } | undefined)
    ?.notApplicableReason;
  return typeof note === "string" && note.trim() ? note.trim() : null;
}

export function buildWorkOrder(
  record: EstateRecord,
  opts: { now?: Date; generatedBy?: string } = {},
): WorkOrder {
  const { facts } = importEstate(record);
  const v = values(facts);
  const state = record.estateEntity.principalState ?? null;
  const county = record.estateEntity.principalCounty ?? null;
  const decisions = decide(FORM_RULES, v, { state: state ?? "*", county: county ?? undefined });

  const forms: WorkOrderForm[] = SEAM.map((seam) => {
    const d = decisions.find((x) => x.decisionPoint === seam.decisionPoint);
    const chosen = d?.chosen;

    if (chosen && chosen.ruleId === seam.affirmative) {
      return {
        formId: seam.formId,
        applicable: true,
        reason: null,
        priority: seam.filingOrder,
        blastRadius: chosen.rule.blastRadius,
        reversibility: REVERSIBILITY[chosen.rule.reversibility],
      };
    }

    // Not applicable, or not decidable. Either way the form is not produced and
    // the reason has to survive to the human — a skipped form with no
    // explanation is indistinguishable from one the system forgot.
    const quoted = recordReason(record, seam.formId);
    let reason: string;
    if (chosen) {
      reason = `${chosen.rule.then.conclusion} (${chosen.rule.authority.citation})`;
      if (quoted) reason += ` Estate record: ${quoted}`;
    } else if (d && d.needs.length > 0) {
      // Three-valued logic reaching the seam: unknown is not false. The form is
      // withheld, and the reason names the facts that would settle it.
      reason =
        `Undecided — Warrant holds no verified fact for ` +
        `${d.needs.join(", ")}, so applicability is unknown rather than false. ` +
        `Withheld pending that evidence.`;
      if (quoted) reason += ` Estate record: ${quoted}`;
    } else {
      reason = `No rule in this pack covers ${seam.decisionPoint} for ${state ?? "this jurisdiction"}.`;
      if (quoted) reason += ` Estate record: ${quoted}`;
    }

    return {
      formId: seam.formId,
      applicable: false,
      reason,
      priority: null,
      blastRadius: null,
      reversibility: null,
    };
  });

  return {
    estateId: record.meta.recordId,
    estatePath: `inputs/estates/${record.meta.recordId}.json`,
    jurisdiction: { state, county },
    route: record.authority.administrationPath ?? null,
    generatedAt: (opts.now ?? new Date()).toISOString().replace(/\.\d{3}Z$/, "Z"),
    generatedBy: opts.generatedBy ?? "warrant",
    forms,
  };
}
