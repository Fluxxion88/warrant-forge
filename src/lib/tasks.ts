// Administration tasks and statutory deadlines.
//
// Deciding which procedure applies is one job. Running the estate is another:
// obtain authority, secure property, investigate, report, deal with creditors,
// and only then distribute. That sequence has hard dependencies — you cannot
// ask a bank anything before Letters issue — and hard deadlines that run from
// dates the ledger already holds.
//
// Both are modelled as data, for the same reason the probate rules are: the
// sequence differs by estate and by jurisdiction, and it changes when the law
// changes.
//
// The deadline engine deliberately reports `unknown` when its anchor date is
// missing, rather than assuming today. A missed statutory deadline is exactly
// the kind of irreversible, high-blast-radius harm this system exists to
// prevent, so silence is not an acceptable output.

import { daysBetween } from "./derive";
import type { FactKey, FactValue } from "./facts";
import { evaluatePredicate, type Authority, type Predicate } from "./rules";
import type { AuthorityDoc } from "./leads";

// ---------------------------------------------------------------------------
// Deadlines
// ---------------------------------------------------------------------------

export interface DeadlineRule {
  id: string;
  label: string;
  /** Fact key holding the ISO date the period runs from. */
  anchor: FactKey;
  offsetDays: number;
  /**
   * Some periods run from the later of two events — the creditor-claim window
   * is the classic case. Both are computed and the governing one is reported.
   */
  alternative?: { anchor: FactKey; offsetDays: number };
  authority: Authority;
  /** What happens if it is missed. */
  consequence: string;
}

export type DeadlineStatus = "unknown" | "upcoming" | "due_soon" | "overdue";

export interface Deadline {
  id: string;
  label: string;
  status: DeadlineStatus;
  dueIso?: string;
  daysRemaining?: number;
  /** Which anchor governed, when there was a choice. */
  governedBy?: string;
  /** Anchor facts we do not hold, which is why the status is unknown. */
  missingAnchors: FactKey[];
  authority: Authority;
  consequence: string;
}

const cite = (citation: string, sourceUrl: string): Authority => ({
  citation,
  sourceUrl,
  effectiveFrom: "unknown",
  retrievedAt: "2026-07-27",
});

const LEGINFO = "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PROB&sectionNum=";

export const CA_DEADLINES: DeadlineRule[] = [
  {
    id: "deadline.lodge_will",
    label: "Lodge the will with the court",
    anchor: "decedent.date_of_death",
    offsetDays: 30,
    authority: cite("Cal. Prob. Code § 8200", `${LEGINFO}8200`),
    consequence:
      "The custodian of a will must lodge it within 30 days of learning of the death, and is liable for damages caused by failure to do so.",
  },
  {
    id: "deadline.inventory",
    label: "File the Inventory and Appraisal (DE-160/DE-161)",
    anchor: "estate.letters_issued_date",
    offsetDays: 120,
    authority: cite("Cal. Prob. Code § 8800", `${LEGINFO}8800`),
    consequence:
      "The inventory is due within four months of Letters. Property found later is reported by supplemental inventory rather than delaying the original.",
  },
  {
    id: "deadline.creditor_claims",
    label: "Creditor claim period closes",
    anchor: "estate.letters_issued_date",
    offsetDays: 120,
    alternative: { anchor: "estate.creditor_notice_date", offsetDays: 60 },
    authority: cite("Cal. Prob. Code § 9100", `${LEGINFO}9100`),
    consequence:
      "A claim must be filed before the later of four months after Letters first issue, or 60 days after notice is given to that creditor. Distributing before this closes exposes the executor personally.",
  },
  {
    id: "deadline.publication",
    label: "First publication of the Notice of Petition to Administer Estate",
    anchor: "estate.hearing_date",
    offsetDays: -15,
    authority: cite("Cal. Prob. Code § 8121", `${LEGINFO}8121`),
    consequence:
      "First publication must be at least 15 days before the hearing, with three publications and at least five intervening days.",
  },
  {
    id: "deadline.mailed_notice",
    label: "Mail notice of hearing to heirs and devisees",
    anchor: "estate.hearing_date",
    offsetDays: -15,
    authority: cite("Cal. Prob. Code § 8110", `${LEGINFO}8110`),
    consequence: "Notice must be mailed at least 15 days before the hearing.",
  },
  {
    id: "deadline.federal_estate_tax",
    label: "Federal estate tax return (Form 706), if required",
    anchor: "decedent.date_of_death",
    offsetDays: 270,
    authority: cite(
      "IRC § 6075(a) — nine months from date of death, extendable six months on Form 4768",
      "https://www.irs.gov/",
    ),
    consequence:
      "For a U.S. citizen the gross estate includes worldwide property, so an offshore investigation that is still open can make this deadline dangerous.",
  },
  {
    id: "deadline.fbar",
    label: "FinCEN Form 114 (FBAR) for the final year, if required",
    anchor: "estate.tax_year_end",
    offsetDays: 105,
    authority: cite(
      "31 CFR 1010.350; FinCEN Form 114 — required where aggregate foreign accounts exceeded $10,000 at any time in the year",
      "https://www.fincen.gov/report-foreign-bank-and-financial-accounts",
    ),
    consequence:
      "Penalties for non-filing are severe. Do not file delinquent or amended foreign-account forms before international-tax counsel has reviewed whether prior omissions were innocent, negligent or potentially wilful.",
  },
];

/**
 * Compute deadlines against the ledger.
 *
 * `asOfIso` is passed in rather than read from the clock so the engine stays a
 * pure function and the whole run is reproducible.
 */
export function computeDeadlines(
  facts: Record<FactKey, FactValue>,
  asOfIso: string,
  rules: DeadlineRule[] = CA_DEADLINES,
): Deadline[] {
  return rules.map((r) => {
    const primary = facts[r.anchor];
    const alt = r.alternative ? facts[r.alternative.anchor] : undefined;

    const candidates: { iso: string; from: string }[] = [];
    if (typeof primary === "string") {
      candidates.push({ iso: addDays(primary, r.offsetDays), from: r.anchor });
    }
    if (r.alternative && typeof alt === "string") {
      candidates.push({ iso: addDays(alt, r.alternative.offsetDays), from: r.alternative.anchor });
    }

    const missingAnchors: FactKey[] = [];
    if (typeof primary !== "string") missingAnchors.push(r.anchor);
    if (r.alternative && typeof alt !== "string") missingAnchors.push(r.alternative.anchor);

    if (candidates.length === 0) {
      return {
        id: r.id,
        label: r.label,
        status: "unknown",
        missingAnchors,
        authority: r.authority,
        consequence: r.consequence,
      };
    }

    // Where a period runs from the later of two events, the later date governs.
    const governing = candidates.reduce((a, b) => (a.iso >= b.iso ? a : b));
    const remaining = daysBetween(asOfIso, governing.iso);

    return {
      id: r.id,
      label: r.label,
      status: remaining < 0 ? "overdue" : remaining <= 30 ? "due_soon" : "upcoming",
      dueIso: governing.iso,
      daysRemaining: remaining,
      governedBy: governing.from,
      missingAnchors,
      authority: r.authority,
      consequence: r.consequence,
    };
  });
}

function addDays(iso: string, days: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Administration tasks
// ---------------------------------------------------------------------------

export type Phase =
  | "authority"
  | "secure"
  | "investigate"
  | "report"
  | "creditors"
  | "close";

export const PHASE_LABELS: Record<Phase, string> = {
  authority: "Establish authority",
  secure: "Secure the estate",
  investigate: "Investigate assets",
  report: "Tax and reporting",
  creditors: "Creditors",
  close: "Close the estate",
};

export interface TaskDef {
  id: string;
  phase: Phase;
  title: string;
  guidance: string;
  /** Other task ids that must complete first. */
  dependsOn: string[];
  requiresAuthority: AuthorityDoc[];
  form?: string;
  /** Only applies when this holds. */
  when?: Predicate;
  authority?: Authority;
  /** Warnings that matter enough to surface on the task itself. */
  caution?: string;
}

export type TaskStatus = "blocked" | "ready" | "not_applicable";

export interface Task extends TaskDef {
  status: TaskStatus;
  blockedBy: string[];
}

export const ADMIN_TASKS: TaskDef[] = [
  // ---- Authority -----------------------------------------------------------
  {
    id: "task.petition",
    phase: "authority",
    title: "File the petition for probate and obtain certified Letters",
    guidance:
      "Being named executor in the will confers nothing by itself. Institutions want court-certified Letters and a certified death certificate before they will speak to you.",
    dependsOn: [],
    requiresAuthority: [],
    form: "DE-111",
    caution:
      "Do not delay filing until the inventory is complete. File on a reasonable estimate and keep investigating — later property goes on a supplemental inventory.",
  },
  {
    id: "task.ein",
    phase: "authority",
    title: "Obtain an estate EIN",
    guidance: "The IRS issues estate EINs without charge. The estate is a separate taxpayer from the decedent.",
    dependsOn: ["task.petition"],
    requiresAuthority: ["letters_testamentary"],
    form: "SS-4",
  },
  {
    id: "task.estate_account",
    phase: "authority",
    title: "Open an estate checking account",
    guidance: "Estate funds must never be mixed with your own. Commingling is the fastest route to personal liability.",
    dependsOn: ["task.ein"],
    requiresAuthority: ["letters_testamentary", "estate_ein"],
  },
  {
    id: "task.form_56",
    phase: "authority",
    title: "File Form 56 to establish the fiduciary relationship with the IRS",
    guidance: "Form 56 tells the IRS who is now authorised to act for the taxpayer.",
    dependsOn: ["task.petition"],
    requiresAuthority: ["letters_testamentary", "death_certificate"],
    form: "56",
  },

  // ---- Secure --------------------------------------------------------------
  {
    id: "task.redirect_mail",
    phase: "secure",
    title: "Redirect mail and keep it running for a full annual cycle",
    guidance:
      "Some investments, policies and taxes generate correspondence only once a year. Stopping mail early loses assets permanently.",
    dependsOn: ["task.petition"],
    requiresAuthority: ["letters_testamentary"],
  },
  {
    id: "task.secure_property",
    phase: "secure",
    title: "Secure residences, vehicles, documents and valuables; maintain insurance",
    guidance: "Lapsed insurance on estate property is a personal-liability event for the executor.",
    dependsOn: [],
    requiresAuthority: [],
  },
  {
    id: "task.preserve_devices",
    phase: "secure",
    title: "Preserve devices and accounts without accessing them",
    guidance:
      "Do not guess passwords, impersonate the decedent, or move money through their personal login. Obtain access through your legal authority and the provider's decedent process.",
    dependsOn: [],
    requiresAuthority: [],
    caution:
      "Do not reset or wipe any device. Forensics can recover account information that ordinary browsing destroys.",
  },
  {
    id: "task.stop_charges",
    phase: "secure",
    title: "Stop unauthorised recurring charges",
    guidance: "Subscriptions and standing orders continue drawing down estate cash until cancelled.",
    dependsOn: ["task.estate_account"],
    requiresAuthority: ["letters_testamentary"],
  },

  // ---- Investigate ---------------------------------------------------------
  {
    id: "task.irs_transcripts",
    phase: "investigate",
    title: "Request 5–7 years of returns and wage-and-income transcripts",
    guidance:
      "Tax records are the strongest single source of offshore leads. Have an international-tax CPA read them for foreign information returns, foreign-source income and foreign withholding.",
    dependsOn: ["task.form_56"],
    requiresAuthority: ["letters_testamentary", "death_certificate", "form_56"],
    form: "4506-T",
  },
  {
    id: "task.bank_searches",
    phase: "investigate",
    title: "Request institution-wide searches at every known bank and brokerage",
    guidance:
      "Ask for a search under the SSN and all known names, not just the account you know about: closed accounts, date-of-death balances, wires with SWIFT/BIC and beneficiary details, safe-deposit records and linked external accounts.",
    dependsOn: ["task.petition"],
    requiresAuthority: ["letters_testamentary", "death_certificate"],
  },
  {
    id: "task.public_records",
    phase: "investigate",
    title: "Search real property, business and unclaimed-property records",
    guidance:
      "Search every county the decedent lived in, holidayed in, or transferred money to — and search for property held through an LLC, trust or nominee, not only in the individual name.",
    dependsOn: [],
    requiresAuthority: [],
  },
  {
    id: "task.ledger",
    phase: "investigate",
    title: "Maintain the master asset-and-liability ledger and investigation log",
    guidance:
      "One row per possible asset or debt, with ownership, jurisdiction, date-of-death value, supporting document and next action. The log of what was searched and when is your defence if a beneficiary later says you failed to investigate.",
    dependsOn: [],
    requiresAuthority: [],
  },

  // ---- Report --------------------------------------------------------------
  {
    id: "task.final_1040",
    phase: "report",
    title: "File the decedent's final personal return",
    guidance: "The final personal return is separate from any estate income-tax return.",
    dependsOn: ["task.irs_transcripts"],
    requiresAuthority: ["letters_testamentary"],
    form: "1040",
  },
  {
    id: "task.estate_1041",
    phase: "report",
    title: "File the estate income-tax return where gross income exceeds $600",
    guidance: "An estate generally files Form 1041 for any year with more than $600 of gross income.",
    dependsOn: ["task.ein"],
    requiresAuthority: ["estate_ein"],
    form: "1041",
  },
  {
    id: "task.international_review",
    phase: "report",
    title: "Have international-tax counsel review foreign reporting before filing anything",
    guidance:
      "FBAR, Form 8938, and foreign trust, corporation and partnership returns can each carry separate obligations.",
    dependsOn: ["task.irs_transcripts"],
    requiresAuthority: [],
    when: { fact: "estate.has_foreign_indicators", op: "==", value: true },
    caution:
      "Do not casually file amended returns or delinquent foreign-account forms first. The correct strategy depends on whether prior omissions were innocent, negligent or potentially wilful — and that judgement belongs to counsel, not to a filing deadline.",
  },

  // ---- Creditors -----------------------------------------------------------
  {
    id: "task.creditor_notice",
    phase: "creditors",
    title: "Give notice to known and reasonably ascertainable creditors",
    guidance: "California requires notice to creditors you know of or could reasonably ascertain.",
    dependsOn: ["task.petition"],
    requiresAuthority: ["letters_testamentary"],
    form: "DE-157",
    authority: cite("Cal. Prob. Code § 9050", `${LEGINFO}9050`),
  },
  {
    id: "task.claims_period",
    phase: "creditors",
    title: "Run the claim period to close and resolve claims",
    guidance:
      "The window is the later of four months after Letters or 60 days after notice to that creditor. Calendar every date.",
    dependsOn: ["task.creditor_notice"],
    requiresAuthority: ["letters_testamentary"],
    authority: cite("Cal. Prob. Code § 9100", `${LEGINFO}9100`),
  },

  // ---- Close ---------------------------------------------------------------
  {
    id: "task.inventory",
    phase: "close",
    title: "File the Inventory and Appraisal",
    guidance: "The probate referee appraises non-cash property. Later discoveries go on a supplemental inventory.",
    dependsOn: ["task.bank_searches", "task.public_records"],
    requiresAuthority: ["letters_testamentary"],
    form: "DE-160",
    authority: cite("Cal. Prob. Code § 8800", `${LEGINFO}8800`),
  },
  {
    id: "task.reserves",
    phase: "close",
    title: "Establish reserves before distributing anything",
    guidance:
      "Reserve for taxes, litigation, professional fees, foreign administration costs, creditor claims, property expenses and disputed liabilities.",
    dependsOn: ["task.claims_period"],
    requiresAuthority: [],
    caution:
      "Do not pay beneficiaries merely because cash is available. Early distribution is the single most common way an executor becomes personally liable.",
  },
  {
    id: "task.final_distribution",
    phase: "close",
    title: "Petition for final distribution and obtain discharge",
    guidance:
      "The discharge represents that all estate property has been distributed, transferred or sold under the court's orders.",
    dependsOn: ["task.inventory", "task.reserves", "task.final_1040", "task.estate_1041"],
    requiresAuthority: ["letters_testamentary", "court_order"],
    form: "DE-295",
  },
];

/**
 * Resolve the task graph. A task is ready when every task it depends on is
 * ready-or-done and its condition is not false; blocked otherwise, naming what
 * is holding it.
 */
export function resolveTasks(
  facts: Record<FactKey, FactValue>,
  completed: Set<string> = new Set(),
  defs: TaskDef[] = ADMIN_TASKS,
): Task[] {
  const byId = new Map(defs.map((d) => [d.id, d]));

  return defs.map((d) => {
    if (d.when) {
      const { result } = evaluatePredicate(d.when, facts);
      if (result === false) {
        return { ...d, status: "not_applicable" as TaskStatus, blockedBy: [] };
      }
    }
    const blockedBy = d.dependsOn.filter((id) => byId.has(id) && !completed.has(id));
    return {
      ...d,
      status: blockedBy.length ? ("blocked" as TaskStatus) : ("ready" as TaskStatus),
      blockedBy,
    };
  });
}

export function tasksByPhase(tasks: Task[]): { phase: Phase; label: string; tasks: Task[] }[] {
  const phases: Phase[] = ["authority", "secure", "investigate", "report", "creditors", "close"];
  return phases.map((p) => ({
    phase: p,
    label: PHASE_LABELS[p],
    tasks: tasks.filter((t) => t.phase === p),
  }));
}
