// New York probate rule pack.
//
// Every dollar figure, day count and form number below was read off a primary
// source that was actually fetched on 2026-07-28, and each carries its citation
// inline. Where a figure could not be sourced it is ABSENT, not guessed — see
// the NOTES ON WHAT COULD NOT BE SOURCED block at the foot of this file and the
// exported `NY_UNSOURCED` list, which the test suite asserts against.
//
// Sources actually fetched:
//   nysenate.gov/legislation/laws/SCP/...   Surrogate's Court Procedure Act
//   nysenate.gov/legislation/laws/EPT/...   Estates, Powers and Trusts Law
//   nysenate.gov/legislation/bills/2019/S4951/amendment/A   chapter law + signing date
//   codes.findlaw.com/ny/...                second, independent reading of the same text
//   law.cornell.edu/regulations/new-york/22-NYCRR-...       the Official Surrogate's Forms
//                                                           and 22 NYCRR 207.20
//
// Every statutory figure in NY_THRESHOLDS was read from TWO of those sources and
// they agreed. nycourts.gov 403s to automated fetches, so no figure here rests on
// a court website.
//
// ---------------------------------------------------------------------------
// Adversarial re-verification, 2026-07-28
// ---------------------------------------------------------------------------
//
// Every dollar amount, day count, month count and section number in this file
// was re-fetched from primary sources by a second reader. All fourteen
// NY_THRESHOLDS figures and all seven SCPA 2402(7) brackets survived unchanged,
// each on two independent readings. Five defects were found and fixed, none of
// them a dollar figure:
//
//   1. SCPA 1409 was cited for service of process. It is not — SCPA 1409 is
//      "Notice of probate", and it governs precisely those persons who have NOT
//      been served. Service of process in a probate proceeding is SCPA 1403,
//      "Persons to be served; content of process". Corrected, and the notice to
//      the Attorney General narrowed to the case SCPA 1409(1) actually states.
//   2. SCPA 1310(4) was modelled as turning on amount and elapsed time alone.
//      The subdivision also requires that the decedent left NO surviving spouse
//      and NO minor child and that no fiduciary has qualified or been appointed.
//      As written the rule would have told a surviving spouse's family to use a
//      route the statute closes to them. Both conditions are now gates.
//   3. SCPA 1310(3)'s payee class said "child". The statute says children
//      EIGHTEEN YEARS OF AGE OR OLDER. Corrected.
//   4. 22 NYCRR 207.20 was recorded as unfetchable from every host. It is not:
//      Cornell LII serves it, and 207.20(b) sets nine months from the date
//      letters issued. Sourced from two readings and now stated.
//   5. SCPA 1310's effectiveFrom carried 2019-11-01, which is Open Legislation's
//      per-section revision date and not an effective date. By this file's own
//      standard that is not a sourced date; the chapter law behind the 2019
//      amendment could not be found. Demoted to UNDATED and registered.
//
// ---------------------------------------------------------------------------
// The structure that matters in New York
// ---------------------------------------------------------------------------
//
// New York's economical route is *voluntary administration* under SCPA Article
// 13. Three statutes interlock to decide whether it is open:
//
//   SCPA 1301(1)  "A small estate is the estate of a domiciliary or a
//                 non-domiciliary who dies leaving personal property having a
//                 gross value of $50,000 or less exclusive of property required
//                 to be set off under EPTL 5-3.1 (a)."
//
//   SCPA 1302     "This article is not applicable to any interest in real
//                 property in this state owned by a decedent" — but "his
//                 ownership of an interest in real property shall not prevent
//                 the use of this article in administering his personal
//                 property."
//
//   EPTL 5-3.1(a) "If a person dies, leaving a surviving spouse or children
//                 under the age of twenty-one years, the following items of
//                 property are not assets of the estate but vest in, and shall
//                 be set off to such surviving spouse..."
//
// So the cascade is: whether a spouse or a child under 21 survives decides
// whether EPTL 5-3.1(a) set-off property exists at all; that decides whether
// the car and the cash come off the top of the SCPA 1301 computation; and that
// decides whether the estate is under $50,000. A childless decedent with no
// spouse counts the same $25,000 car that a married decedent does not.
//
// Two contrasts with California worth stating out loud, because a model that
// pattern-matches from the California pack will get both wrong:
//
//   * There is NO waiting period. SCPA 1304(1): "No waiting period after the
//     death of the decedent is required." California makes you wait 40 days.
//   * A will does NOT close the small-estate route. SCPA 1303 gives a named
//     executor the first right to act as voluntary administrator. What the will
//     changes is the route ABOVE the cap: probate under Article 14 (Form P-1)
//     rather than administration under Article 10 (Form A-1).
//
// Real property never rides along. SCPA 1302 keeps Article 13 off realty
// entirely, so an estate whose only significant asset is a house is a full
// probate or administration no matter how modest the house is — there is no New
// York analogue to California's § 13151 residence petition.

import { derived, ledger, type Fact } from "../lib/facts";
import type { ExclusionRule } from "../lib/derive";
import { daysBetween } from "../lib/derive";
import type { Rule } from "../lib/rules";

const SCPA = "https://www.nysenate.gov/legislation/laws/SCP/";
const EPTL = "https://www.nysenate.gov/legislation/laws/EPT/";
const S4951 = "https://www.nysenate.gov/legislation/bills/2019/S4951/amendment/A";
const FORMS = "https://www.law.cornell.edu/regulations/new-york/title-22/subtitle-D/chapter-VII/subchapter-A/surrogates-forms";
const NYCRR_207_20 = "https://www.law.cornell.edu/regulations/new-york/22-NYCRR-207.20";
const RETRIEVED = "2026-07-28";

/**
 * The primary sources actually fetched on 2026-07-28, so a reviewer can re-run
 * the same reads rather than taking the citations on trust. Two independent
 * readings back every figure in NY_THRESHOLDS: NY Senate Open Legislation for
 * the statute, FindLaw's reproduction of the same section as the check.
 */
export const NY_SOURCES = {
  scpa1301: `${SCPA}1301`,
  scpa1302: `${SCPA}1302`,
  scpa1303: `${SCPA}1303`,
  scpa1304: `${SCPA}1304`,
  scpa1310: `${SCPA}1310`,
  /** "Persons to be served; content of process" — NOT SCPA 1409, which is notice. */
  scpa1403: `${SCPA}1403`,
  scpa1409: `${SCPA}1409`,
  scpa1802: `${SCPA}1802`,
  scpa2402: `${SCPA}2402`,
  eptl4_1_1: `${EPTL}4-1.1`,
  eptl5_3_1: `${EPTL}5-3.1`,
  /** L. 2019, ch. 557 — the chapter law that raised the cap from $30,000 to $50,000. */
  capChapterLaw: S4951,
  officialForms: FORMS,
  /** 22 NYCRR 207.20 — Inventory of assets. Cornell LII serves it; nycourts.gov 403s. */
  nycrr207_20: NYCRR_207_20,
} as const;

/**
 * Sentinel for `Authority.effectiveFrom` where no effective date could be
 * established from a fetched source.
 *
 * New York does not publish effective dates alongside its consolidated law.
 * NY Senate Open Legislation shows a per-section "most recent revision" date,
 * but for a section untouched since the site's corpus begins that date is
 * 2014-09-22 — the start of the dataset, not the start of the provision. Using
 * it as an effective date would be inventing a fact about when the law changed.
 * So: sections whose Open Legislation revision date is the 2014-09-22 baseline
 * carry this sentinel, and every rule that does is listed in NY_UNSOURCED.
 */
export const UNDATED = "unknown";

/**
 * Cited figures. Each field's comment carries the citation and, where the
 * wording is load-bearing, the quoted phrase it came from.
 *
 * Nothing here is CPI-indexed. Unlike California, where Prob. Code § 890 moves
 * the caps every three years on a published schedule, every New York figure
 * below moves only when the Legislature amends the section. There is therefore
 * no "next adjustment" date to record, and asserting one would be fabrication.
 */
export const NY_THRESHOLDS = {
  /**
   * SCPA 1301(1): "personal property having a gross value of $50,000 or less
   * exclusive of property required to be set off under EPTL 5-3.1 (a)".
   * Raised from $30,000 by L. 2019, ch. 557 (S4951A), signed 25 Nov 2019.
   */
  smallEstatePersonalProperty: 50_000,

  /**
   * SCPA 1304(1): "No waiting period after the death of the decedent is
   * required." Zero, and deliberately so — this is the figure a model is most
   * likely to import from another state.
   */
  voluntaryAdministrationWaitDays: 0,

  /** SCPA 1304(4): "The clerk shall charge a fee of $1 for filing the affidavit." */
  voluntaryAdministrationFeeUsd: 1,

  /**
   * SCPA 1802: "If any claim is not presented within 7 months from the date of
   * issue of letters, the fiduciary shall not be chargeable..."
   */
  creditorClaimMonths: 7,

  /**
   * SCPA 1310(2) — a debtor may pay the surviving spouse this much with no
   * administration at all and no waiting period: "it shall be lawful for the
   * debtor forthwith to pay to the surviving spouse of the decedent not more
   * than thirty thousand dollars".
   */
  debtPayableToSpouseUsd: 30_000,
  /**
   * SCPA 1310(3) — "[n]ot less than thirty days after the death", to the
   * surviving spouse, a child EIGHTEEN YEARS OF AGE OR OLDER, either parent, a
   * brother or sister, or a niece or nephew; or, on their request, to a creditor
   * or to a person who paid the funeral expenses. The affidavit must state that
   * no fiduciary has qualified or been appointed.
   */
  debtPayableToFamilyUsd: 15_000,
  debtPayableToFamilyAfterDays: 30,
  /**
   * SCPA 1310(4) — "[n]ot less than 6 months after the death", to a distributee
   * or, so far as the funds are not exempt from creditors' claims, to a creditor
   * or a person who paid the funeral expenses. Open ONLY where no fiduciary has
   * qualified or been appointed AND the decedent left no surviving spouse and no
   * minor child. Both conditions are gates on `ny.debt.distributee_5000`.
   */
  debtPayableToDistributeeUsd: 5_000,
  debtPayableToDistributeeAfterMonths: 6,

  /**
   * "Minor" in SCPA 1310(4) is under eighteen. It is deliberately NOT the
   * twenty-one used by EPTL 5-3.1(a), which is why the pack carries two separate
   * facts (`decedent.has_child_under_18`, `decedent.has_child_under_21`) rather
   * than one. Collapsing them would silently close or open a route.
   */
  minorChildAgeYears: 18,

  /** EPTL 5-3.1(a)(1) — housekeeping utensils, furniture, appliances, clothing, jewelry. */
  exemptHouseholdUsd: 20_000,
  /** EPTL 5-3.1(a)(2) — family bible, pictures, books, discs, software, other electronic storage. */
  exemptBooksAndMediaUsd: 2_500,
  /** EPTL 5-3.1(a)(3) — domestic and farm animals with 60 days' food, farm machinery, one tractor and one lawn tractor. */
  exemptFarmUsd: 20_000,
  /** EPTL 5-3.1(a)(5) — "One motor vehicle" not exceeding this value. */
  exemptMotorVehicleUsd: 25_000,
  /** EPTL 5-3.1(a)(6) — cash, checking, savings, money market, CDs, marketable securities. */
  exemptMoneyUsd: 25_000,

  /**
   * EPTL 4-1.1(a)(1) — intestate share where issue survive: "fifty thousand
   * dollars and one-half of the residue to the spouse, and the balance thereof
   * to the issue by representation."
   *
   * NOT the small-estate cap. It is the same number, which is exactly why it is
   * recorded separately: conflating the two is a live failure mode.
   */
  spousalIntestatePreferentialShareUsd: 50_000,

  /**
   * 22 NYCRR 207.20(b): "The Inventory of Assets form shall be filed with the
   * court within nine months of the date letters issued to the fiduciary or as
   * the court otherwise directs."
   *
   * Read on 2026-07-28 from Cornell LII's reproduction of the regulation and
   * from a second reproduction that agreed word for word. An earlier draft of
   * this pack recorded the deadline as unsourceable because nycourts.gov,
   * regulations.justia.com and nyrules.elaws.us all refuse automated fetches;
   * LII was simply not tried. Runs from LETTERS, like SCPA 1802 — not from death.
   */
  inventoryFilingMonths: 9,

  /** Effective date of the $50,000 small-estate cap. L. 2019, ch. 557, signed 25 Nov 2019, effective immediately. */
  smallEstateCapEffectiveFrom: "2019-11-25",
} as const;

/**
 * SCPA 2402(7): "The fee schedule for subdivision 1 through 7 inclusive is as
 * follows". Subdivision 1 measures it against the "gross estate passing by will
 * as stated in the petition"; subdivision 2 against the "gross estate passing
 * by intestacy as stated in the petition".
 *
 * `under` is the exclusive upper bound of the bracket; the top bracket is open.
 */
export const NY_FILING_FEE_SCHEDULE: readonly { under: number | null; feeUsd: number; label: string }[] = [
  { under: 10_000, feeUsd: 45, label: "Less than $10,000" },
  { under: 20_000, feeUsd: 75, label: "$10,000 but under $20,000" },
  { under: 50_000, feeUsd: 215, label: "$20,000 but under $50,000" },
  { under: 100_000, feeUsd: 280, label: "$50,000 but under $100,000" },
  { under: 250_000, feeUsd: 420, label: "$100,000 but under $250,000" },
  { under: 500_000, feeUsd: 625, label: "$250,000 but under $500,000" },
  { under: null, feeUsd: 1_250, label: "$500,000 and over" },
];

/**
 * Property that comes out of the SCPA 1301 computation. Only two exclusions
 * appear here, because only two are stated by the statutes I could fetch.
 *
 * Notably ABSENT: joint tenancy, beneficiary designations, and funded trusts.
 * California states those exclusions expressly in Prob. Code § 13050 and the
 * California pack cites it. New York has no equivalent enumeration in Article
 * 13 — SCPA 1301 excludes only EPTL 5-3.1(a) set-off property. Practitioners
 * treat survivorship and beneficiary-designated assets as outside the estate
 * because they never become estate property, not because Article 13 says so,
 * and I could not source a New York provision that says so. Adding them here on
 * the strength of the California analogy is exactly the error this pack exists
 * to avoid, so they are not here. See NY_UNSOURCED.
 */
export const NY_EXCLUSIONS: ExclusionRule[] = [
  {
    id: "excl.eptl.5_3_1_set_off",
    flag: "set_off_eptl_5_3_1",
    label: "Set off to the surviving spouse or a child under 21 under EPTL 5-3.1(a) — not an asset of the estate",
    citation: "SCPA 1301(1); EPTL 5-3.1(a)",
    sourceUrl: `${EPTL}5-3.1`,
  },
  {
    id: "excl.scpa.1302_real_property",
    flag: "is_real_property",
    label: "Real property — Article 13 does not reach it and it is not personal property",
    citation: "SCPA 1302",
    sourceUrl: `${SCPA}1302`,
  },
];

// ---------------------------------------------------------------------------
// New York-specific derivation
// ---------------------------------------------------------------------------

/** Whole calendar months elapsed. SCPA 1310(4) and SCPA 1802 count months, not days. */
function monthsBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  let months =
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  return months;
}

/**
 * Compute the New York derived facts. No model participates: models extract
 * individually-quoted asset values, this adds them up under a cited statute and
 * records which inputs it consumed.
 */
export function deriveNyFacts(facts: Fact[], asOfIso: string, now = 0): Fact[] {
  const current = ledger(facts);
  const out: Fact[] = [];
  const bool = (key: string): boolean | undefined => {
    const f = current.get(key);
    return typeof f?.value === "boolean" ? f.value : undefined;
  };

  const dod = current.get("decedent.date_of_death");
  if (dod && typeof dod.value === "string") {
    out.push(
      derived(
        {
          key: "estate.days_since_death",
          label: "Days since date of death",
          value: daysBetween(dod.value, asOfIso),
          unit: "days",
          formula: `${asOfIso} − ${dod.value}`,
          inputs: ["decedent.date_of_death"],
          authority: { citation: "SCPA 1310(3)", sourceUrl: `${SCPA}1310` },
          note: "SCPA 1304(1) imposes NO waiting period on voluntary administration. This count exists for the SCPA 1310 debt-payment routes, which do have one.",
        },
        { now },
      ),
      derived(
        {
          key: "estate.months_since_death",
          label: "Whole calendar months since date of death",
          value: monthsBetween(dod.value, asOfIso),
          unit: "months",
          formula: `whole calendar months from ${dod.value} to ${asOfIso}`,
          inputs: ["decedent.date_of_death"],
          authority: { citation: "SCPA 1310(4)", sourceUrl: `${SCPA}1310` },
          note: "SCPA 1310(4) says 'not less than 6 months after the death'. Counted in calendar months rather than converted to days, because the statute counts months.",
        },
        { now },
      ),
    );
  }

  const letters = current.get("estate.letters_issued_date");
  if (letters && typeof letters.value === "string") {
    out.push(
      derived(
        {
          key: "estate.months_since_letters",
          label: "Whole calendar months since letters issued",
          value: monthsBetween(letters.value, asOfIso),
          unit: "months",
          formula: `whole calendar months from ${letters.value} to ${asOfIso}`,
          inputs: ["estate.letters_issued_date"],
          authority: { citation: "SCPA 1802", sourceUrl: `${SCPA}1802` },
          note: "SCPA 1802 runs the creditor-claim period from the date of issue of letters, not from death.",
        },
        { now },
      ),
    );
  }

  // Does EPTL 5-3.1(a) set-off property exist at all? It vests only in a
  // surviving spouse or, failing that, children under 21. With neither, nothing
  // is set off, and the car and the cash stay inside the SCPA 1301 computation.
  const spouse = bool("decedent.has_surviving_spouse");
  const minorChild = bool("decedent.has_child_under_21");
  if (spouse !== undefined || minorChild !== undefined) {
    const available = spouse === true || minorChild === true;
    out.push(
      derived(
        {
          key: "estate.eptl_5_3_1_set_off_available",
          label: "EPTL 5-3.1(a) exempt property is set off",
          value: available,
          formula: `surviving spouse (${spouse ?? "unknown"}) OR child under 21 (${minorChild ?? "unknown"})`,
          inputs: ["decedent.has_surviving_spouse", "decedent.has_child_under_21"].filter(
            (k) => current.has(k),
          ),
          authority: { citation: "EPTL 5-3.1(a)", sourceUrl: `${EPTL}5-3.1` },
          note: available
            ? "Exempt items are 'not assets of the estate' and come off the top of the SCPA 1301 gross value."
            : "No surviving spouse and no child under 21, so nothing is set off and every item counts toward the $50,000 cap.",
        },
        { now },
      ),
    );

    const sum = personalPropertyTotal(current, available);
    out.push(
      derived(
        {
          key: "estate.scpa_1301_gross_value",
          label: "Gross value of personal property for SCPA 1301",
          value: sum.total,
          unit: "USD",
          formula: sum.formula,
          inputs: [...sum.inputs, "estate.eptl_5_3_1_set_off_available"],
          authority: {
            citation:
              "SCPA 1301(1) (personal property, exclusive of EPTL 5-3.1(a) set-off property); SCPA 1302 (real property excluded)",
            sourceUrl: `${SCPA}1301`,
          },
          note: available
            ? "EPTL 5-3.1(a) items excluded — they are not assets of the estate."
            : "EPTL 5-3.1(a) items included — with no spouse and no child under 21 there is no set-off.",
        },
        { now },
      ),
    );
  }

  const realty = realPropertyTotal(current);
  if (realty.inputs.length > 0) {
    out.push(
      derived(
        {
          key: "estate.has_real_property",
          label: "Estate includes an interest in real property",
          value: realty.total > 0,
          formula: realty.formula,
          inputs: realty.inputs,
          authority: { citation: "SCPA 1302", sourceUrl: `${SCPA}1302` },
          note: "Article 13 'is not applicable to any interest in real property in this state owned by a decedent', so realty needs its own route regardless of value.",
        },
        { now },
      ),
    );
  }

  return out;
}

function personalPropertyTotal(current: Map<string, Fact>, setOffAvailable: boolean) {
  const inputs: string[] = [];
  const parts: string[] = [];
  let total = 0;

  for (const [key, fact] of current) {
    const m = /^asset\.([^.]+)\.value$/.exec(key);
    if (!m || typeof fact.value !== "number") continue;
    const id = m[1];

    // SCPA 1302 — realty is never personal property, set-off or no set-off.
    if (current.get(`asset.${id}.is_real_property`)?.value === true) {
      inputs.push(`asset.${id}.is_real_property`);
      continue;
    }
    // SCPA 1301(1) — EPTL 5-3.1(a) property, but only where it is actually set off.
    if (setOffAvailable && current.get(`asset.${id}.set_off_eptl_5_3_1`)?.value === true) {
      inputs.push(`asset.${id}.set_off_eptl_5_3_1`);
      continue;
    }

    total += fact.value;
    inputs.push(key);
    parts.push(`${fact.label} ${fact.value.toLocaleString("en-US")}`);
  }

  return {
    total,
    inputs: [...new Set(inputs)].sort(),
    formula: parts.length ? parts.join(" + ") : "no includable personal property",
  };
}

function realPropertyTotal(current: Map<string, Fact>) {
  const inputs: string[] = [];
  let total = 0;
  // Every is_real_property fact counts as an input, true or false. A verified
  // "this is not realty" is evidence that the question was asked and answered,
  // and without it the derived fact must stay absent so the rule reports itself
  // blocked rather than quietly concluding there is no house.
  for (const [key, fact] of current) {
    const m = /^asset\.([^.]+)\.is_real_property$/.exec(key);
    if (!m) continue;
    inputs.push(key);
    if (fact.value !== true) continue;
    const value = current.get(`asset.${m[1]}.value`);
    if (typeof value?.value === "number") {
      total += value.value;
      inputs.push(`asset.${m[1]}.value`);
    }
  }
  return {
    total,
    inputs: inputs.sort(),
    formula: inputs.length ? `real property totalling ${total.toLocaleString("en-US")}` : "no real property",
  };
}

// ---------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------

const authority = (citation: string, sourceUrl: string, effectiveFrom: string) => ({
  citation,
  sourceUrl,
  effectiveFrom,
  retrievedAt: RETRIEVED,
});

const STATEWIDE_RULES: Rule[] = [
  // --- How personal property transfers -------------------------------------
  {
    id: "ny.personal.voluntary_administration",
    decisionPoint: "personal_property_route",
    jurisdiction: { state: "NY" },
    title: "Voluntary administration (small estate) under SCPA Article 13",
    requires: ["estate.scpa_1301_gross_value", "decedent.date_of_death"],
    when: {
      // No day gate. SCPA 1304(1): "No waiting period after the death of the
      // decedent is required." Importing California's 40 days here would be the
      // exact class of error this pack is written to prevent.
      fact: "estate.scpa_1301_gross_value",
      op: "<=",
      value: NY_THRESHOLDS.smallEstatePersonalProperty,
    },
    then: {
      conclusion:
        "File an Affidavit in Relation to Settlement of Estate under Article 13 with the Surrogate's Court clerk of the decedent's domicile. No petition, no citation, no bond, no court order — SCPA 1304(4): 'No order of the court or other proceeding shall be necessary.'",
      forms: [
        {
          code: "SE2A",
          title: "Affidavit in relation to settlement of estate under Article 13, SCPA",
          url: FORMS,
        },
        { code: "SE1D", title: "Report and account in settlement of estate", url: FORMS },
      ],
      obligations: [
        "File a certified copy of the death certificate with the affidavit (SCPA 1304(3))",
        "Pay the clerk's $1 filing fee (SCPA 1304(4))",
        "No bond is required (SCPA 1304(2))",
        "Deliver a short certificate to each debtor, transfer agent, bank or other person holding the decedent's property (SCPA 1304(5))",
        "Account to the clerk by filing a statement of all assets collected and all payments and distributions made, with receipts or cancelled checks (SCPA 1307)",
        "Stop acting once another fiduciary is appointed and qualifies — the voluntary administrator's powers then cease (SCPA 1306)",
        "Do not use this route for a wrongful-death or personal-injury claim; SCPA 1306 withholds that power",
      ],
      // The $1 is the cited statutory fee. Everything else in these ranges is a
      // practice estimate and is labelled as one.
      timelineDays: [1, 60],
      estCostUsd: [1, 400],
    },
    estimates: {
      timelineDays:
        "Practice estimate. No statute fixes how long a clerk takes to issue the short certificate, and SCPA 1304(1) imposes no waiting period at all, so the true lower bound is set by administration rather than by law.",
      estCostUsd:
        "Lower bound is the cited $1 clerk's fee under SCPA 1304(4). Upper bound is a practice estimate covering certified death certificates and certificate copies; no fee for those was sourced.",
    },
    authority: authority(
      "SCPA 1301(1), 1303, 1304, 1306, 1307 (cap raised to $50,000 by L. 2019, ch. 557)",
      `${SCPA}1301`,
      NY_THRESHOLDS.smallEstateCapEffectiveFrom,
    ),
    priority: 100,
    blastRadius: "medium",
    reversibility: "costly",
    notes:
      "Available whether or not the decedent left a will — SCPA 1303 gives the named executor the first right to act. Reaches personal property only; SCPA 1302 keeps it off real property.",
  },
  {
    id: "ny.personal.probate",
    decisionPoint: "personal_property_route",
    jurisdiction: { state: "NY" },
    title: "Probate of the will (personal property exceeds the SCPA 1301 cap)",
    requires: ["estate.scpa_1301_gross_value", "decedent.has_will"],
    when: {
      all: [
        {
          fact: "estate.scpa_1301_gross_value",
          op: ">",
          value: NY_THRESHOLDS.smallEstatePersonalProperty,
        },
        { fact: "decedent.has_will", op: "==", value: true },
      ],
    },
    then: {
      conclusion:
        "The estate is over the Article 13 cap and the decedent left a will. Petition for probate under SCPA Article 14 and letters testamentary; the executor cannot act until letters issue.",
      forms: [
        { code: "P-1", title: "Petition for probate", url: FORMS },
        { code: "P-6", title: "Notice of probate", url: FORMS },
        { code: "I-1", title: "Inventory of assets", url: FORMS },
      ],
      obligations: [
        // SCPA 1403 is "Persons to be served; content of process". SCPA 1409 is
        // "Notice of probate" and reaches only those NOT served. An earlier
        // draft attributed service of process to 1409; it does not do that job.
        "Serve process on the persons SCPA 1403 requires to be served, or obtain their waivers (SCPA 1403)",
        "Serve the notice of probate on each person named or referred to in the petition who has NOT been served, has not appeared and has not waived service of process (SCPA 1409(1))",
        "Name the Attorney General in the notice of probate where the will contains a charitable bequest that is either to an unnamed charitable organization or in an unspecified amount (SCPA 1409(1)) — not for every charitable gift",
        "File proof by affidavit of the mailing of the notice of probate (SCPA 1409(2))",
        "Produce the attesting witnesses, or proof in their place (SCPA 1404, 1405, 1406)",
        "Obtain letters testamentary before acting — probate of the will alone confers no authority (SCPA 1414)",
        "Hold the estate open for creditor claims: a fiduciary is not chargeable for claims presented more than 7 months after letters issue (SCPA 1802)",
        "File the Inventory of Assets (Form I-1) within nine months of the date letters issued, or as the court otherwise directs (22 NYCRR 207.20(b))",
      ],
      timelineDays: [210, 540],
      estCostUsd: [45, 1_250],
    },
    estimates: {
      timelineDays:
        "Practice estimate anchored only on the cited 7-month SCPA 1802 claim period; no statute fixes total elapsed time.",
      estCostUsd:
        "The range is the cited SCPA 2402(7) filing-fee schedule end to end, from $45 to $1,250. It is the court fee alone. Attorney and fiduciary compensation are NOT included — SCPA 2307 commissions were not fetched, so no figure for them appears anywhere in this pack.",
    },
    authority: authority(
      "SCPA 1402, 1403, 1404, 1409, 1414; SCPA 1802; 22 NYCRR 207.20",
      `${SCPA}1402`,
      UNDATED,
    ),
    priority: 60,
    blastRadius: "high",
    reversibility: "irreversible",
  },
  {
    id: "ny.personal.administration",
    decisionPoint: "personal_property_route",
    jurisdiction: { state: "NY" },
    title: "Administration in intestacy (personal property exceeds the SCPA 1301 cap)",
    requires: ["estate.scpa_1301_gross_value", "decedent.has_will"],
    when: {
      all: [
        {
          fact: "estate.scpa_1301_gross_value",
          op: ">",
          value: NY_THRESHOLDS.smallEstatePersonalProperty,
        },
        { fact: "decedent.has_will", op: "==", value: false },
      ],
    },
    then: {
      conclusion:
        "The estate is over the Article 13 cap and there is no will. Petition for letters of administration under SCPA Article 10; the estate passes under EPTL 4-1.1.",
      forms: [
        { code: "A-1", title: "Petition for letters of administration", url: FORMS },
        { code: "A-3", title: "Notice of application for letters of administration", url: FORMS },
        { code: "A-4", title: "Affidavit of service of mailing notice of application", url: FORMS },
        { code: "I-1", title: "Inventory of assets", url: FORMS },
      ],
      obligations: [
        "Petition in the order of priority set by SCPA 1001 — the surviving spouse takes precedence",
        "Serve process on the persons required by SCPA 1003, or obtain waivers",
        "Serve notice of the application for letters (SCPA 1005) and file the affidavit of mailing",
        "Distribute under EPTL 4-1.1: where issue survive, the spouse takes $50,000 and one-half of the residue, the balance to the issue by representation",
        "Hold the estate open for creditor claims: a fiduciary is not chargeable for claims presented more than 7 months after letters issue (SCPA 1802)",
        "File the Inventory of Assets (Form I-1) within nine months of the date letters issued, or as the court otherwise directs (22 NYCRR 207.20(b))",
      ],
      timelineDays: [210, 540],
      estCostUsd: [45, 1_250],
    },
    estimates: {
      timelineDays: "Practice estimate; no statutory period governs total elapsed time.",
      estCostUsd:
        "The cited SCPA 2402(7) filing-fee schedule end to end. Court fee only; no compensation figure is sourced anywhere in this pack.",
    },
    authority: authority(
      "SCPA 1001, 1002, 1003, 1005; EPTL 4-1.1; SCPA 1802; 22 NYCRR 207.20",
      `${SCPA}1001`,
      UNDATED,
    ),
    priority: 60,
    blastRadius: "high",
    reversibility: "irreversible",
    notes:
      "EPTL 4-1.1(a)(1)'s $50,000 preferential spousal share is numerically identical to the SCPA 1301 small-estate cap and has nothing to do with it.",
  },

  // --- Real property never rides along -------------------------------------
  {
    id: "ny.realty.probate",
    decisionPoint: "real_property_route",
    jurisdiction: { state: "NY" },
    title: "Probate required for real property (testate)",
    requires: ["estate.has_real_property", "decedent.has_will"],
    when: {
      all: [
        { fact: "estate.has_real_property", op: "==", value: true },
        { fact: "decedent.has_will", op: "==", value: true },
      ],
    },
    then: {
      conclusion:
        "Article 13 cannot carry the real property at any value — SCPA 1302: 'This article is not applicable to any interest in real property in this state owned by a decedent.' Probate the will under Article 14. There is no New York equivalent of a small-value real-property affidavit.",
      forms: [
        { code: "P-1", title: "Petition for probate", url: FORMS },
        { code: "P-6", title: "Notice of probate", url: FORMS },
      ],
      obligations: [
        "Probate the will and obtain letters testamentary before dealing with the realty (SCPA 1414)",
        "Note that the personal property may still be settled by voluntary administration in parallel — SCPA 1302: ownership of realty 'shall not prevent the use of this article in administering his personal property'",
      ],
      timelineDays: [210, 540],
      estCostUsd: [45, 1_250],
    },
    estimates: {
      timelineDays: "Practice estimate.",
      estCostUsd: "Cited SCPA 2402(7) schedule end to end; court fee only.",
    },
    authority: authority("SCPA 1302; SCPA 1402, 1414", `${SCPA}1302`, UNDATED),
    priority: 100,
    blastRadius: "high",
    reversibility: "irreversible",
  },
  {
    id: "ny.realty.administration",
    decisionPoint: "real_property_route",
    jurisdiction: { state: "NY" },
    title: "Administration required for real property (intestate)",
    requires: ["estate.has_real_property", "decedent.has_will"],
    when: {
      all: [
        { fact: "estate.has_real_property", op: "==", value: true },
        { fact: "decedent.has_will", op: "==", value: false },
      ],
    },
    then: {
      conclusion:
        "Article 13 cannot carry the real property at any value — SCPA 1302: 'This article is not applicable to any interest in real property in this state owned by a decedent.' Petition for letters of administration under Article 10.",
      forms: [
        { code: "A-1", title: "Petition for letters of administration", url: FORMS },
        { code: "A-3", title: "Notice of application for letters of administration", url: FORMS },
      ],
      obligations: [
        "Petition in the SCPA 1001 order of priority",
        "Obtain letters before dealing with the realty",
      ],
      timelineDays: [210, 540],
      estCostUsd: [45, 1_250],
    },
    estimates: {
      timelineDays: "Practice estimate.",
      estCostUsd: "Cited SCPA 2402(7) schedule end to end; court fee only.",
    },
    authority: authority("SCPA 1302; SCPA 1001, 1002", `${SCPA}1302`, UNDATED),
    priority: 100,
    blastRadius: "high",
    reversibility: "irreversible",
  },
  {
    id: "ny.realty.none",
    decisionPoint: "real_property_route",
    jurisdiction: { state: "NY" },
    title: "No New York real property to transfer",
    requires: ["estate.has_real_property"],
    when: { fact: "estate.has_real_property", op: "==", value: false },
    then: {
      conclusion:
        "The decedent held no interest in New York real property, so no realty route is needed and the SCPA 1302 bar never bites.",
      forms: [],
      obligations: [],
      timelineDays: [0, 0],
      estCostUsd: [0, 0],
    },
    authority: authority("SCPA 1302", `${SCPA}1302`, UNDATED),
    priority: 10,
    blastRadius: "low",
    reversibility: "reversible",
  },

  // --- Does a will change who may act? -------------------------------------
  {
    id: "ny.actor.executor_named",
    decisionPoint: "who_may_act",
    jurisdiction: { state: "NY" },
    title: "Named executor has the first right to act (testate)",
    requires: ["decedent.has_will"],
    when: { fact: "decedent.has_will", op: "==", value: true },
    then: {
      conclusion:
        "A will does NOT close the small-estate route in New York. SCPA 1303: 'the named executor or alternate executor shall have the first right to act as voluntary administrator'. If they renounce or do not qualify, any adult who could petition for letters of administration with will annexed may act.",
      forms: [
        { code: "SE1C", title: "Renunciation of voluntary administration", url: FORMS },
      ],
      obligations: [
        "Establish that the named executor has qualified, renounced, or failed to qualify before anyone else acts",
      ],
      timelineDays: [0, 0],
      estCostUsd: [0, 0],
    },
    authority: authority("SCPA 1303", `${SCPA}1303`, UNDATED),
    priority: 100,
    blastRadius: "medium",
    reversibility: "reversible",
    notes:
      "What the will changes is the route ABOVE the cap — probate under Article 14 rather than administration under Article 10 — not availability of Article 13.",
  },
  {
    id: "ny.actor.spouse_first",
    decisionPoint: "who_may_act",
    jurisdiction: { state: "NY" },
    title: "Surviving adult spouse has the first right to act (intestate)",
    requires: ["decedent.has_will"],
    when: { fact: "decedent.has_will", op: "==", value: false },
    then: {
      conclusion:
        "SCPA 1303: the right to act as voluntary administrator 'is hereby given first to the surviving adult spouse', then in order to a competent adult who is a child or grandchild, parent, brother or sister, niece or nephew, or aunt or uncle. Above the cap, SCPA 1001 sets the equivalent priority for letters of administration.",
      forms: [{ code: "A-1", title: "Petition for letters of administration", url: FORMS }],
      obligations: [
        "Establish the order of priority under SCPA 1303 (Article 13) or SCPA 1001 (full administration) before anyone petitions",
      ],
      timelineDays: [0, 0],
      estCostUsd: [0, 0],
    },
    authority: authority("SCPA 1303; SCPA 1001", `${SCPA}1303`, UNDATED),
    priority: 100,
    blastRadius: "medium",
    reversibility: "reversible",
  },

  // --- Paying a debt of the decedent with no administration at all ---------
  {
    id: "ny.debt.spouse_30000",
    decisionPoint: "debt_payment_without_administration",
    jurisdiction: { state: "NY" },
    title: "Debtor may pay the surviving spouse up to $30,000 immediately",
    requires: ["estate.debt_owed_to_decedent", "decedent.has_surviving_spouse"],
    when: {
      all: [
        {
          fact: "estate.debt_owed_to_decedent",
          op: "<=",
          value: NY_THRESHOLDS.debtPayableToSpouseUsd,
        },
        { fact: "decedent.has_surviving_spouse", op: "==", value: true },
      ],
    },
    then: {
      conclusion:
        "No administration of any kind is needed. SCPA 1310(2): 'it shall be lawful for the debtor forthwith to pay to the surviving spouse of the decedent not more than thirty thousand dollars'. No waiting period.",
      forms: [
        {
          code: "—",
          title:
            "Affidavit under SCPA 1310 (no Official Surrogate's Form prescribed; payers supply their own — see NY_UNSOURCED)",
        },
      ],
      obligations: [
        "Establish the payee is the surviving spouse",
        "Confirm the total does not exceed $30,000 across all payments under this subdivision",
      ],
      timelineDays: [1, 30],
      estCostUsd: [0, 100],
    },
    estimates: {
      timelineDays: "Practice estimate; the statute imposes no period.",
      estCostUsd: "Practice estimate. No fee is prescribed by SCPA 1310.",
    },
    authority: authority("SCPA 1310(2)", `${SCPA}1310`, UNDATED),
    priority: 120,
    blastRadius: "low",
    reversibility: "costly",
    notes:
      "SCPA 1310(2) is the one subdivision with no waiting period and no 'nobody has qualified' condition. Open Legislation shows a revision date of 2019-11-01 for SCPA 1310, but a revision date is not an effective date and the chapter law behind the amendment could not be found — so effectiveFrom is UNDATED. See NY_UNSOURCED.",
  },
  {
    id: "ny.debt.family_15000",
    decisionPoint: "debt_payment_without_administration",
    jurisdiction: { state: "NY" },
    title: "Debtor may pay certain relatives up to $15,000 after 30 days",
    requires: ["estate.debt_owed_to_decedent", "estate.days_since_death"],
    when: {
      all: [
        {
          fact: "estate.debt_owed_to_decedent",
          op: "<=",
          value: NY_THRESHOLDS.debtPayableToFamilyUsd,
        },
        {
          fact: "estate.days_since_death",
          op: ">=",
          value: NY_THRESHOLDS.debtPayableToFamilyAfterDays,
        },
      ],
    },
    then: {
      conclusion:
        "SCPA 1310(3): 'Not less than thirty days after the death' a debtor may pay up to $15,000 of the debt to the surviving spouse, a child EIGHTEEN YEARS OF AGE OR OLDER, either parent, a brother or sister, or a niece or nephew — or, on the request of one of those persons, to a creditor of the decedent or to someone who paid the funeral expenses.",
      forms: [
        { code: "—", title: "Affidavit under SCPA 1310 (no Official Surrogate's Form prescribed)" },
      ],
      obligations: [
        "Wait 30 days from the date of death",
        // The statute says children eighteen years of age or older. An earlier
        // draft said 'child', which would have opened the route to a minor.
        "Establish the payee falls in the SCPA 1310(3) class — note that a child of the decedent qualifies only if eighteen years of age or older",
        "Obtain the affidavit SCPA 1310(3) requires, which must state that no fiduciary has qualified or been appointed",
      ],
      timelineDays: [30, 60],
      estCostUsd: [0, 100],
    },
    estimates: {
      timelineDays:
        "Lower bound is the cited 30-day period in SCPA 1310(3). Upper bound is a practice estimate — the statute sets a floor and no ceiling.",
      estCostUsd: "Practice estimate. No fee is prescribed by SCPA 1310.",
    },
    authority: authority("SCPA 1310(3)", `${SCPA}1310`, UNDATED),
    priority: 100,
    blastRadius: "low",
    reversibility: "costly",
    notes:
      "The 'no fiduciary has qualified or been appointed' requirement is carried as an obligation rather than a gate: SCPA 1310(3) puts it in the affidavit the payee swears, and this pack holds no fact for it on this route. SCPA 1310(4), where the same condition is an eligibility bar, does gate on it.",
  },
  {
    id: "ny.debt.distributee_5000",
    decisionPoint: "debt_payment_without_administration",
    jurisdiction: { state: "NY" },
    title: "Debtor may pay a distributee up to $5,000 after six months",
    // SCPA 1310(4) is NOT just an amount and a clock. The subdivision is open
    // only where no fiduciary has qualified or been appointed AND the decedent
    // left no surviving spouse and no minor child. An earlier draft of this pack
    // gated on amount and elapsed months alone, which would have offered the
    // route to a household where a spouse survives — a household the statute
    // sends to SCPA 1310(2) or (3) instead. Both conditions are now required
    // facts, so an estate that has not answered them reports itself blocked
    // rather than being told the route is open.
    requires: [
      "estate.debt_owed_to_decedent",
      "estate.months_since_death",
      "decedent.has_surviving_spouse",
      "decedent.has_child_under_18",
      "estate.fiduciary_appointed",
    ],
    when: {
      all: [
        {
          fact: "estate.debt_owed_to_decedent",
          op: "<=",
          value: NY_THRESHOLDS.debtPayableToDistributeeUsd,
        },
        {
          fact: "estate.months_since_death",
          op: ">=",
          value: NY_THRESHOLDS.debtPayableToDistributeeAfterMonths,
        },
        { fact: "decedent.has_surviving_spouse", op: "==", value: false },
        { fact: "decedent.has_child_under_18", op: "==", value: false },
        { fact: "estate.fiduciary_appointed", op: "==", value: false },
      ],
    },
    then: {
      conclusion:
        "SCPA 1310(4): 'Not less than 6 months after the death' a debtor may pay a debt not exceeding $5,000 to a distributee or, so far as the funds are not exempt from creditors' claims, to a creditor or to a person who paid or incurred the funeral expenses — but only where no fiduciary has qualified or been appointed and the decedent left no surviving spouse and no minor child.",
      forms: [
        { code: "—", title: "Affidavit under SCPA 1310 (no Official Surrogate's Form prescribed)" },
      ],
      obligations: [
        "Wait six calendar months from the date of death",
        "Establish the payee is a distributee or qualifying creditor",
        "Confirm no fiduciary has qualified or been appointed for the estate (SCPA 1310(4))",
        "Confirm the decedent left no surviving spouse and no minor child — if either survives, this subdivision is closed and the route is SCPA 1310(2) or (3) (SCPA 1310(4))",
      ],
      timelineDays: [180, 240],
      estCostUsd: [0, 100],
    },
    estimates: {
      timelineDays:
        "Practice estimate. The statute counts SIX MONTHS, not a number of days; the day range here is presentational only and the rule fires on the cited month count.",
      estCostUsd: "Practice estimate. No fee is prescribed by SCPA 1310.",
    },
    authority: authority("SCPA 1310(4)", `${SCPA}1310`, UNDATED),
    priority: 80,
    blastRadius: "low",
    reversibility: "costly",
    notes:
      "'Minor child' here is under EIGHTEEN, not the under-21 EPTL 5-3.1(a) uses. The two ages drive different provisions and the pack holds them as two separate facts.",
  },

  // --- Creditor claims -----------------------------------------------------
  {
    id: "ny.claims.seven_months",
    decisionPoint: "creditor_claim_period",
    jurisdiction: { state: "NY" },
    title: "Seven-month creditor claim period runs from letters",
    requires: ["estate.months_since_letters"],
    when: { exists: "estate.months_since_letters" },
    then: {
      conclusion:
        "SCPA 1802: 'If any claim is not presented within 7 months from the date of issue of letters, the fiduciary shall not be chargeable...' The clock runs from letters, not from death.",
      forms: [],
      obligations: [
        "Do not distribute before the 7-month period expires without accepting personal exposure for late claims",
        "Date the period from the date letters issued, not the date of death",
      ],
      timelineDays: [0, 0],
      estCostUsd: [0, 0],
    },
    estimates: {
      timelineDays:
        "Left at zero deliberately. The period is 7 MONTHS from letters, a month count, and converting it to a day range would manufacture precision the statute does not have. The month figure lives in NY_THRESHOLDS.creditorClaimMonths.",
    },
    authority: authority("SCPA 1802", `${SCPA}1802`, UNDATED),
    priority: 100,
    blastRadius: "high",
    reversibility: "irreversible",
  },
];

/**
 * SCPA 2402(7) filing fees, one rule per bracket, generated from the schedule so
 * a legislative change is an edit to data rather than to seven rules.
 */
function feeRules(): Rule[] {
  return NY_FILING_FEE_SCHEDULE.map((bracket, i) => {
    const floor = i === 0 ? 0 : NY_FILING_FEE_SCHEDULE[i - 1].under!;
    const when: Rule["when"] =
      bracket.under === null
        ? { fact: "estate.gross_value_in_petition", op: ">=", value: floor }
        : {
            all: [
              { fact: "estate.gross_value_in_petition", op: ">=", value: floor },
              { fact: "estate.gross_value_in_petition", op: "<", value: bracket.under },
            ],
          };
    return {
      id: `ny.fee.bracket_${i}`,
      decisionPoint: "filing_fee",
      jurisdiction: { state: "NY" },
      title: `Surrogate's Court filing fee — ${bracket.label}`,
      requires: ["estate.gross_value_in_petition"],
      when,
      then: {
        conclusion: `Filing fee is $${bracket.feeUsd.toLocaleString("en-US")} for a petition where the gross estate stated in the petition is ${bracket.label.toLowerCase()}.`,
        forms: [],
        obligations: ["Pay the fee on filing the petition"],
        timelineDays: [0, 0],
        estCostUsd: [bracket.feeUsd, bracket.feeUsd],
      },
      authority: authority(
        "SCPA 2402(1) (probate), 2402(2) (administration in intestacy), 2402(7) (fee schedule)",
        `${SCPA}2402`,
        UNDATED,
      ),
      priority: 100,
      blastRadius: "low",
      reversibility: "reversible",
      notes:
        "Measured against the 'gross estate passing by will as stated in the petition' (SCPA 2402(1)) or 'gross estate passing by intestacy as stated in the petition' (SCPA 2402(2)) — not against the SCPA 1301 computation, which excludes EPTL 5-3.1(a) property.",
    } satisfies Rule;
  });
}

const VOLUNTARY_ADMIN_FEE_RULE: Rule = {
  id: "ny.fee.voluntary_administration",
  decisionPoint: "filing_fee",
  jurisdiction: { state: "NY" },
  title: "Voluntary administration filing fee — $1",
  requires: ["estate.scpa_1301_gross_value"],
  when: {
    fact: "estate.scpa_1301_gross_value",
    op: "<=",
    value: NY_THRESHOLDS.smallEstatePersonalProperty,
  },
  then: {
    conclusion:
      "SCPA 1304(4): 'The clerk shall charge a fee of $1 for filing the affidavit.' The SCPA 2402 schedule does not apply — no petition is filed.",
    forms: [
      {
        code: "SE2A",
        title: "Affidavit in relation to settlement of estate under Article 13, SCPA",
        url: FORMS,
      },
    ],
    obligations: ["Pay the clerk $1 on filing the affidavit"],
    timelineDays: [0, 0],
    estCostUsd: [
      NY_THRESHOLDS.voluntaryAdministrationFeeUsd,
      NY_THRESHOLDS.voluntaryAdministrationFeeUsd,
    ],
  },
  authority: authority("SCPA 1304(4)", `${SCPA}1304`, UNDATED),
  // Outranks every SCPA 2402 bracket: where Article 13 is open no petition is
  // filed, so the petition fee schedule never engages.
  priority: 200,
  blastRadius: "low",
  reversibility: "reversible",
};

export const NY_RULES: Rule[] = [...STATEWIDE_RULES, VOLUNTARY_ADMIN_FEE_RULE, ...feeRules()];

/** Where an executor would actually go to obtain each fact the rules require. */
export const NY_OBTAIN_HINTS: Record<string, string> = {
  "decedent.date_of_death":
    "Certified copy of the death certificate — SCPA 1304(3) requires one to be filed with the Article 13 affidavit, so you need it anyway",
  "decedent.has_will":
    "Search the decedent's papers, safe deposit box, and the Surrogate's Court will-deposit records for the county of domicile; SCPA 1401 allows a proceeding to compel production of a will",
  "decedent.has_surviving_spouse":
    "Marriage certificate, or the death certificate's marital-status field; decides both the SCPA 1310(2) $30,000 route and whether EPTL 5-3.1(a) set-off exists",
  "decedent.has_child_under_21":
    "Birth certificates of the decedent's children; EPTL 5-3.1(a) vests the exempt property in children under 21 where there is no surviving spouse, so this alone can change the SCPA 1301 gross value",
  "decedent.has_child_under_18":
    "Birth certificates of the decedent's children. Distinct from decedent.has_child_under_21: SCPA 1310(4) closes the $5,000 distributee route where a MINOR child (under 18) survives, while EPTL 5-3.1(a) uses 21. Do not answer one from the other",
  "estate.fiduciary_appointed":
    "The Surrogate's Court file for the county of domicile will show whether letters testamentary, letters of administration, preliminary letters or temporary letters have issued. SCPA 1310(4) closes the $5,000 route once any fiduciary has qualified or been appointed",
  "estate.scpa_1301_gross_value":
    "Derived — do not enter it directly. It is computed from asset.<id>.value facts less EPTL 5-3.1(a) set-off property and less real property (SCPA 1301, 1302)",
  "estate.has_real_property":
    "Derived from asset.<id>.is_real_property. Confirm against the county clerk's or city register's land records for the county where the property sits",
  "estate.days_since_death": "Derived from decedent.date_of_death",
  "estate.months_since_death": "Derived from decedent.date_of_death",
  "estate.months_since_letters": "Derived from estate.letters_issued_date",
  "estate.letters_issued_date":
    "The date printed on the letters testamentary or letters of administration issued by the Surrogate's Court — SCPA 1802 runs the 7-month claim period from it",
  "estate.debt_owed_to_decedent":
    "Statement from the debtor, bank or employer holding the sum; SCPA 1310 turns on the amount of the individual debt, not the size of the estate",
  "estate.gross_value_in_petition":
    "The gross estate figure you state in the probate or administration petition itself — SCPA 2402(1) and (2) measure the fee against what the petition states, not against the SCPA 1301 computation",
  "asset.residence.value":
    "Licensed appraisal as at the date of death. New York has no probate-referee system; the fiduciary obtains the appraisal",
  "asset.vehicle.value":
    "Valuation as at the date of death. Relevant to EPTL 5-3.1(a)(5), which sets off one motor vehicle up to $25,000",
};

export const NY_PACK = {
  id: "ny-probate",
  title: "New York probate procedure",
  jurisdiction: { state: "NY" },
  version: `${RETRIEVED}.2`,
  rules: NY_RULES,
};

// ---------------------------------------------------------------------------
// NOTES ON WHAT COULD NOT BE SOURCED
// ---------------------------------------------------------------------------
//
// Recorded as data as well as prose so the test suite can assert that the list
// has not silently shrunk. Every entry is something a reader might reasonably
// expect this pack to contain and which is deliberately absent.

export interface SourcingGap {
  id: string;
  what: string;
  why: string;
  /** Rule ids affected, if any. */
  affects: string[];
}

export const NY_UNSOURCED: SourcingGap[] = [
  {
    id: "gap.effective_dates",
    what:
      "Effective dates for every provision except the SCPA 1301 cap. Those rules carry effectiveFrom = UNDATED. SCPA 1301 is the only rule in the pack with a sourced effective date.",
    why:
      "New York does not publish effective dates with its consolidated law. NY Senate Open Legislation shows a per-section 'most recent revision' date, but for a section untouched since the corpus begins that date is 2014-09-22 — the start of the dataset, not of the provision. Confirmed by fetching SCPA 1302, 1303, 1304, 2402 and EPTL 5-3.1, all of which show exactly 2014-09-22. Some sections do show later revision dates — SCPA 1301 shows 2019-11-29, SCPA 1310 and EPTL 4-1.1 show 2019-11-01, SCPA 1802 shows 2019-11-22 — but a revision date is still not an effective date. Only SCPA 1301 has one that was actually sourced: L. 2019, ch. 557 (S4951A), 'signed chap.557' on 2019-11-25, effect clause 'This act shall take effect immediately and shall apply to actions and proceedings commenced on or after such effective date'. The three SCPA 1310 rules previously carried 2019-11-01 taken straight from the revision widget; on re-review no chapter law for that amendment could be found, so they were demoted to UNDATED rather than left standing on a date the site never claimed was an effective date.",
    affects: [
      "ny.debt.spouse_30000",
      "ny.debt.family_15000",
      "ny.debt.distributee_5000",
      "ny.personal.probate",
      "ny.personal.administration",
      "ny.realty.probate",
      "ny.realty.administration",
      "ny.realty.none",
      "ny.actor.executor_named",
      "ny.actor.spouse_first",
      "ny.claims.seven_months",
      "ny.fee.voluntary_administration",
      "ny.fee.bracket_0",
      "ny.fee.bracket_1",
      "ny.fee.bracket_2",
      "ny.fee.bracket_3",
      "ny.fee.bracket_4",
      "ny.fee.bracket_5",
      "ny.fee.bracket_6",
    ],
  },
  {
    id: "gap.county_inventory_practice",
    what:
      "Whether an individual Surrogate's Court varies the 22 NYCRR 207.20 inventory deadline, and what it charges for a late filing.",
    why:
      "The nine-month deadline itself is NOT a gap — 22 NYCRR 207.20(b) states it and was read from Cornell LII and from a second reproduction that agreed word for word, so NY_THRESHOLDS.inventoryFilingMonths carries it. What is unsourced is the tail of the rule: 207.20(b) ends 'or as the court otherwise directs', and the consequences subdivision lets a court refuse certificates and revoke letters until the inventory and fees are paid. Neither the per-county directions nor the fee amounts live anywhere fetchable, so the pack states the statewide deadline and nothing beyond it. An earlier draft of this pack recorded the deadline itself as unsourceable, having tried nycourts.gov (403), regulations.justia.com (403), ruledex (403), nyrules.elaws.us (503) and newyork.public.law (404) but not LII; that was wrong and is corrected.",
    affects: ["ny.personal.probate", "ny.personal.administration"],
  },
  {
    id: "gap.scpa_1310_3_fiduciary_gate",
    what:
      "Whether 'no fiduciary has qualified or been appointed' is an eligibility bar on the SCPA 1310(3) $15,000 route, as it plainly is on the SCPA 1310(4) $5,000 route.",
    why:
      "One reading (FindLaw) reports the SCPA 1310(3) affidavit must state that no fiduciary has qualified or been appointed; the second reading did not address the point, so the two-source standard this pack holds itself to was not met. SCPA 1310(4) is different — both readings agree it bars payment where a fiduciary has qualified or where a spouse or minor child survives, and ny.debt.distributee_5000 gates on both. On ny.debt.family_15000 the condition is carried as an obligation instead, so it is stated to the reader without being asserted as a machine-checked bar.",
    affects: ["ny.debt.family_15000"],
  },
  {
    id: "gap.non_probate_exclusions",
    what:
      "Whether jointly-held property, beneficiary-designated accounts and funded-trust property are excluded from the SCPA 1301 gross value.",
    why:
      "SCPA 1301(1) excludes exactly one thing: property required to be set off under EPTL 5-3.1(a). It contains no analogue of California's Prob. Code § 13050 enumeration. Practitioners treat survivorship and beneficiary-designated assets as outside the estate on the general principle that they never become estate property, but no New York provision saying so was fetched. NY_EXCLUSIONS therefore carries only the two cited exclusions, and an estate whose facts flag a joint account will count it.",
    affects: ["ny.personal.voluntary_administration", "ny.personal.probate", "ny.personal.administration"],
  },
  {
    id: "gap.form_recites_stale_cap",
    what:
      "Which Official Form the Surrogate's Courts currently issue for Article 13, and what cap it prints.",
    why:
      "Form SE2A as appended to 22 NYCRR still recites a gross value that 'does not exceed $20,000.00' — three statutory increases behind the current $50,000. Form SE-3A appears to supersede it but LII holds it only as page images, which could not be read, and nycourts.gov 403s. So: the statutory cap is $50,000 on two independent readings of SCPA 1301, and the form code cited here is SE2A because it is the one whose text could actually be read. Confirm the current form with the county Surrogate's Court before filing.",
    affects: ["ny.personal.voluntary_administration", "ny.fee.voluntary_administration"],
  },
  {
    id: "gap.scpa_1310_form",
    what: "An Official Surrogate's Form for the SCPA 1310 affidavit.",
    why:
      "The Official Surrogate's Forms index at 22 NYCRR lists no SCPA 1310 form. Banks and the State Comptroller publish their own versions. The forms entry on those three rules says so rather than naming a code.",
    affects: ["ny.debt.spouse_30000", "ny.debt.family_15000", "ny.debt.distributee_5000"],
  },
  {
    id: "gap.commissions",
    what: "Fiduciary and attorney compensation (SCPA 2307 and related).",
    why:
      "Not fetched, so no compensation figure appears anywhere in this pack. Every estCostUsd upper bound on a court route is the top of the cited SCPA 2402(7) filing-fee schedule and nothing more — it is a court fee, not a cost of administration, and the estimates field on each rule says so. Reading those ranges as the cost of probating a New York estate would badly understate it.",
    affects: ["ny.personal.probate", "ny.personal.administration", "ny.realty.probate", "ny.realty.administration"],
  },
  {
    id: "gap.county_overlays",
    what: "County-level practice: local filing requirements, per-county surcharges, e-filing rules.",
    why:
      "New York has 62 Surrogate's Courts and their checklists live on nycourts.gov, which refuses automated fetches. No county rules are generated here, unlike the California pack. Every rule in this pack is statewide.",
    affects: [],
  },
  {
    id: "gap.timeline_estimates",
    what: "Every timelineDays range in this pack.",
    why:
      "No New York statute fixes how long probate or administration takes. Each range is flagged in the rule's estimates field. The only sourced durations in the whole pack are the SCPA 1310 waiting periods (30 days, 6 months), the SCPA 1802 claim period (7 months), the 22 NYCRR 207.20(b) inventory deadline (9 months from letters), and the SCPA 1304(1) absence of any waiting period at all.",
    affects: [],
  },
];
