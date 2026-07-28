// Which of these forms actually apply to a given estate.
//
// This is the part of form automation that everybody skips and that costs the
// most. Filling a form correctly is mechanical; knowing whether to file it at
// all is legal, jurisdictional, and the place where an automated system does
// real damage. Three of Alix's five sample estates should NOT receive a DL 142
// — two because the decedent held an out-of-state licence, one because the only
// identification on file is a passport. A filler that produced a tidy DL 142
// for an Indiana licence would look like it was working while generating
// paperwork the California DMV discards, and while leaving the Indiana BMV
// surrender undone.
//
// So applicability is expressed as rules, in the same rules-as-data form as
// ca-probate.ts, and inherits the same three-valued logic: a form whose
// applicability turns on a fact we do not hold reports itself *blocked* and
// names what it needs, rather than defaulting to either "file it" or "skip it".

import type { Rule } from "../lib/rules";

const IRS_FORMS = {
  ss4: { code: "SS-4", title: "Application for Employer Identification Number", url: "https://www.irs.gov/forms-pubs/about-form-ss-4" },
  f56: { code: "56", title: "Notice Concerning Fiduciary Relationship", url: "https://www.irs.gov/forms-pubs/about-form-56" },
  f8821: { code: "8821", title: "Tax Information Authorization", url: "https://www.irs.gov/forms-pubs/about-form-8821" },
} as const;

const DL142 = {
  code: "DL 142",
  title: "Notice of Cancellation (deceased licence holder)",
  url: "https://www.dmv.ca.gov/portal/file/notice-of-cancellation-dl-142-pdf/",
};

const DMV_AUTHORITY = {
  citation: "Cal. Veh. Code § 14100; DMV form DL 142 (Rev. 7/93)",
  sourceUrl: "https://www.dmv.ca.gov/portal/file/notice-of-cancellation-dl-142-pdf/",
  effectiveFrom: "1993-07-01",
  retrievedAt: "2026-07-28",
};

/**
 * DL 142 is a California Department of Motor Vehicles form, scoped to
 * California-issued documents.
 *
 * Keyed on the licence's *issuing state*, not the decedent's residence. Those
 * differ often enough to matter — someone who retires from Ohio to Arizona
 * without re-licensing needs the Ohio form — and the sample set contains
 * exactly that shape in reverse: a Texas-resident fiduciary holding a Florida
 * licence, which its provenance note flags as real data an auto-fill has to
 * survive.
 */
const DL142_APPLIES: Rule = {
  id: "form.dl142.applies",
  decisionPoint: "form_dl142",
  // Scoped "*" although DL 142 is a California form. The *question* — does this
  // decedent's licence need surrendering to California? — is asked of every
  // estate regardless of where it is being administered, and the answer turns
  // on where the licence was issued, not where probate is filed. Scoping these
  // to CA venue meant the Indiana estate never evaluated them at all and the
  // surrender obligation vanished silently, which is the exact failure this
  // pair of rules was written to prevent.
  jurisdiction: { state: "*" },
  title: "California licence surrender",
  requires: ["decedent.licence_state"],
  when: {
    all: [
      { fact: "decedent.licence_state", op: "==", value: "CA" },
      { exists: "decedent.licence_number" },
    ],
  },
  then: {
    conclusion: "File DL 142 to surrender the decedent's California driver licence.",
    forms: [DL142],
    obligations: ["Attach the licence if held, or state where it is."],
    timelineDays: [1, 30],
    estCostUsd: [0, 0],
  },
  authority: DMV_AUTHORITY,
  estimates: { timelineDays: "practice norm; the form states no statutory deadline" },
  priority: 10,
  blastRadius: "low",
  reversibility: "reversible",
  notes:
    "Scoped to the issuing state of the licence, not the state of residence. An " +
    "out-of-state licence needs that state's equivalent, which this pack does not carry.",
};

/**
 * The counterpart, stated positively so a report can say *why* a form was
 * skipped. A skipped form with no explanation is indistinguishable from a form
 * the system forgot about — and the obligation does not disappear, it just
 * moves to another agency.
 */
const DL142_OUT_OF_STATE: Rule = {
  id: "form.dl142.out_of_state",
  decisionPoint: "form_dl142",
  // Scoped "*" although DL 142 is a California form. The *question* — does this
  // decedent's licence need surrendering to California? — is asked of every
  // estate regardless of where it is being administered, and the answer turns
  // on where the licence was issued, not where probate is filed. Scoping these
  // to CA venue meant the Indiana estate never evaluated them at all and the
  // surrender obligation vanished silently, which is the exact failure this
  // pair of rules was written to prevent.
  jurisdiction: { state: "*" },
  title: "Licence issued outside California",
  requires: ["decedent.licence_state"],
  when: {
    all: [
      { exists: "decedent.licence_state" },
      { fact: "decedent.licence_state", op: "!=", value: "CA" },
    ],
  },
  then: {
    conclusion:
      "DL 142 does not apply — the licence was issued by another state. Surrender " +
      "it through that state's motor vehicle agency instead.",
    forms: [],
    obligations: ["Identify and file the issuing state's equivalent surrender form."],
    timelineDays: [1, 30],
    estCostUsd: [0, 0],
  },
  authority: DMV_AUTHORITY,
  estimates: { timelineDays: "varies by state; not researched in this pack" },
  priority: 10,
  blastRadius: "low",
  reversibility: "reversible",
  notes: "Exists so the surrender obligation stays visible rather than being silently dropped.",
};

/**
 * SS-4 obtains an EIN. An estate that already has one does not need it, and
 * filing again issues a second EIN for the same estate — painful to unwind.
 *
 * Keyed on the presence of the number rather than on `hasEverAppliedForEin`.
 * The California trust-and-estate sample carries an EIN *and* records a
 * previous EIN, because the trust was numbered before the grantor died; keying
 * on the historical flag would get that case wrong.
 */
const SS4_NEEDED: Rule = {
  id: "form.ss4.needed",
  decisionPoint: "form_ss4",
  jurisdiction: { state: "*" },
  title: "EIN required",
  requires: [],
  when: { missing: "estate.ein" },
  then: {
    conclusion: "File SS-4 to obtain an EIN for the estate or trust.",
    forms: [IRS_FORMS.ss4],
    obligations: ["A fiduciary cannot open an estate bank account without an EIN."],
    timelineDays: [0, 28],
    estCostUsd: [0, 0],
  },
  authority: {
    citation: "26 U.S.C. § 6109; IRS Form SS-4 instructions (Rev. December 2025)",
    sourceUrl: "https://www.irs.gov/forms-pubs/about-form-ss-4",
    effectiveFrom: "2025-12-01",
    retrievedAt: "2026-07-28",
  },
  estimates: { timelineDays: "immediate online; four weeks by mail" },
  priority: 10,
  blastRadius: "medium",
  reversibility: "costly",
};

const SS4_NOT_NEEDED: Rule = {
  id: "form.ss4.not_needed",
  decisionPoint: "form_ss4",
  jurisdiction: { state: "*" },
  title: "EIN already held",
  requires: [],
  when: { exists: "estate.ein" },
  then: {
    conclusion: "SS-4 not required — the estate already holds an EIN.",
    forms: [],
    obligations: [],
    timelineDays: [0, 0],
    estCostUsd: [0, 0],
  },
  authority: {
    citation: "IRS Form SS-4 instructions (Rev. December 2025), 'Do not apply for a new EIN'",
    sourceUrl: "https://www.irs.gov/forms-pubs/about-form-ss-4",
    effectiveFrom: "2025-12-01",
    retrievedAt: "2026-07-28",
  },
  priority: 20,
  blastRadius: "medium",
  reversibility: "costly",
  notes: "Applying again would issue a second EIN for one estate.",
};

/**
 * Form 56 notifies the IRS that a fiduciary relationship exists. It applies
 * whenever someone is acting in that capacity — but only once there is an
 * authority basis to state on line 1. Filing before appointment means ticking a
 * box that is not yet true.
 */
const FORM56_NEEDED: Rule = {
  id: "form.56.needed",
  decisionPoint: "form_56",
  jurisdiction: { state: "*" },
  title: "Fiduciary notice",
  requires: ["authority.basis", "estate.petitioner_name"],
  when: {
    all: [{ exists: "authority.basis" }, { exists: "estate.petitioner_name" }],
  },
  then: {
    conclusion: "File Form 56 to notify the IRS of the fiduciary relationship.",
    forms: [IRS_FORMS.f56],
    obligations: ["Until Form 56 is on file the IRS keeps corresponding with the decedent."],
    timelineDays: [1, 30],
    estCostUsd: [0, 0],
  },
  authority: {
    citation: "26 U.S.C. § 6903; IRS Form 56 (Rev. June 2026)",
    sourceUrl: "https://www.irs.gov/forms-pubs/about-form-56",
    effectiveFrom: "2026-06-01",
    retrievedAt: "2026-07-28",
  },
  estimates: { timelineDays: "as soon as the fiduciary is appointed" },
  priority: 10,
  blastRadius: "medium",
  reversibility: "reversible",
};

/**
 * Form 8821 authorises disclosure of tax information to a named designee. It is
 * optional: an estate with no adviser, whose fiduciary deals with the IRS
 * directly, does not need one. Modelled as applying only when a designee
 * actually exists, so the report does not nag.
 */
const FORM8821_NEEDED: Rule = {
  id: "form.8821.needed",
  decisionPoint: "form_8821",
  jurisdiction: { state: "*" },
  title: "Tax information authorisation",
  requires: [],
  when: { exists: "tax.designee.name" },
  then: {
    conclusion: "File Form 8821 to authorise tax-information disclosure to the designee.",
    forms: [IRS_FORMS.f8821],
    obligations: ["Confirm the designee's CAF number before filing."],
    timelineDays: [1, 14],
    estCostUsd: [0, 0],
  },
  authority: {
    citation: "26 U.S.C. § 6103(c); IRS Form 8821 (Rev. January 2021)",
    sourceUrl: "https://www.irs.gov/forms-pubs/about-form-8821",
    effectiveFrom: "2021-01-01",
    retrievedAt: "2026-07-28",
  },
  priority: 10,
  blastRadius: "medium",
  reversibility: "reversible",
  notes:
    "8821 authorises disclosure only. It does not permit anyone to represent the " +
    "estate before the IRS — that is Form 2848, which this pack does not carry.",
};

export const FORM_RULES: Rule[] = [
  DL142_APPLIES,
  DL142_OUT_OF_STATE,
  SS4_NEEDED,
  SS4_NOT_NEEDED,
  FORM56_NEEDED,
  FORM8821_NEEDED,
];

/**
 * Form 56 line 1 is a "check exactly one" group, and which box is right follows
 * from the authority basis. Getting it wrong misstates the fiduciary's legal
 * standing to the IRS, so it is an explicit table here rather than a judgement
 * call buried in a generated field map.
 *
 * Box 1d (fiduciary of intestate estate) is deliberately absent: it covers
 * someone acting without court appointment, which none of the sample estates
 * do, and choosing between 1b and 1d is a call a human should make. An
 * unrecognised basis produces no tick and a named gap.
 */
export const FORM56_LINE1: Record<string, { box: string; label: string }> = {
  CourtAppointmentTestate: { box: "a", label: "Court appointment of testate estate (valid will exists)" },
  CourtAppointmentIntestate: { box: "b", label: "Court appointment of intestate estate (no valid will exists)" },
  CourtAppointmentGuardian: { box: "c", label: "Court appointment as guardian or conservator" },
  ValidTrustInstrument: { box: "e", label: "Valid trust instrument and amendments" },
  Bankruptcy: { box: "f", label: "Bankruptcy or assignment for the benefit of creditors" },
};

/**
 * Form 56 line 2: which date goes in which box depends on the line-1 box.
 * Boxes 1a, 1b and 1d take the date of death; 1c, 1e, 1f and 1g take the date
 * of appointment. The Ohio trust sample is what makes this matter — a successor
 * trustee under 1e whose line 2b is the appointment date, thirteen days after
 * the death. Its own label calls this out.
 */
export function form56DateLine(basis: string | undefined): "death" | "appointment" | null {
  if (!basis) return null;
  const entry = FORM56_LINE1[basis];
  if (!entry) return null;
  return ["a", "b", "d"].includes(entry.box) ? "death" : "appointment";
}

/** Widget names for the parts of Form 56 the rule pack owns outright. */
const F56 = {
  line1: (i: number) => `topmostSubform[0].Page1[0].c1_1[${i}]`,
  dateOfDeath: "topmostSubform[0].Page1[0].f1_19[0]",
  dateOfAppointment: "topmostSubform[0].Page1[0].f1_20[0]",
};

export interface Form56Override {
  /** Widget name → value or tick state. */
  set: Record<string, string>;
  /** Widget names the field map may have filled that must be blanked. */
  clear: string[];
  /** Anything a human needs to decide, because the pack would be guessing. */
  unresolved: string[];
}

/**
 * The parts of Form 56 that a field map must not decide on its own.
 *
 * Lines 2a and 2b both hold a date, and a purely structural mapping will
 * cheerfully fill both — each box genuinely is a date box. Only the authority
 * basis says which one is live, and filling both asserts to the IRS that the
 * fiduciary's authority arises from two different provisions at once. So the
 * rule pack takes ownership of the whole group: clear both, tick exactly one
 * line-1 box, write exactly one date.
 *
 * An unrecognised basis sets nothing and reports itself in `unresolved`. That
 * is deliberate — a wrong line-1 box misstates the fiduciary's legal standing,
 * and a blank one gets caught in review.
 */
export function form56Overrides(record: {
  authority?: { basis?: string | null; dateOfAppointment?: string | null };
  decedent?: { dateOfDeath?: string | null };
}): Form56Override {
  const out: Form56Override = {
    set: {},
    clear: [F56.dateOfDeath, F56.dateOfAppointment],
    unresolved: [],
  };

  const basis = record.authority?.basis ?? undefined;
  if (!basis) {
    out.unresolved.push("authority.basis is absent — Form 56 line 1 cannot be ticked.");
    return out;
  }

  const entry = FORM56_LINE1[basis];
  if (!entry) {
    out.unresolved.push(
      `authority.basis "${basis}" has no line-1 box in this pack — a human must choose.`,
    );
    return out;
  }

  const idx = "abcdefg".indexOf(entry.box);
  if (idx >= 0) out.set[F56.line1(idx)] = `/${idx + 1}`;

  const which = form56DateLine(basis);
  const iso =
    which === "death"
      ? record.decedent?.dateOfDeath
      : which === "appointment"
        ? record.authority?.dateOfAppointment
        : null;

  if (!iso) {
    out.unresolved.push(
      `Line 1${entry.box} requires the date of ${which === "death" ? "death" : "appointment"}, ` +
        `which this record does not hold.`,
    );
    return out;
  }

  const [y, m, d] = iso.split("-");
  out.set[which === "death" ? F56.dateOfDeath : F56.dateOfAppointment] = `${m}/${d}/${y}`;
  return out;
}
