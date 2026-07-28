// Pennsylvania probate rule pack.
//
// Every dollar figure, day count and form number below was read off a primary
// source that was actually fetched on 2026-07-28, and each carries its citation
// inline. The sources used were:
//
//   * 20 Pa.C.S. (Decedents, Estates and Fiduciaries) — the official text served
//     by the Pennsylvania General Assembly at legis.state.pa.us.
//   * The Tax Reform Code of 1971 (Act of Mar. 4, 1971, P.L.6, No.2), Article XXI
//     (Inheritance Tax), from the same server. Article XXI is codified at
//     72 P.S. §§ 9101–9193; the act's own section numbers are 2101–2193, and the
//     text quoted here is the act text, so both numbers are given.
//   * Pa. O.C. Rules 10.5 and 10.6, from the official Pennsylvania Code, plus
//     the Supreme Court's adopting order as printed in the Pennsylvania
//     Bulletin (52 Pa.B. 684), which is where the effective date lives.
//   * The statewide Register of Wills forms (RW-02 … RW-10) and Orphans' Court
//     forms (OC-01, OC-07) published by the Unified Judicial System, and the
//     official index of them at 231 Pa. Code Ch. 8017A.
//
// WHERE PENNSYLVANIA IS THE MIRROR IMAGE OF CALIFORNIA
//
// The California pack turns on a cascade: a residence that crosses the § 13151
// cap loses that route *and* falls back into the § 13100 gross value, closing
// both economical roads at once. Pennsylvania's § 3102 does the opposite, and
// says so in terms:
//
//   "The authority of the court to award distribution of personal property
//    under this section shall not be restricted because of the decedent's
//    ownership of real estate, regardless of its value."
//
// So in Pennsylvania a $2,000,000 house does not push the personal property out
// of the small-estate route. Real estate is simply invisible to the $50,000
// computation — and equally, the § 3102 decree cannot transfer it. The house
// neither helps nor hurts; it just needs its own road.
//
// Two more Pennsylvania inversions worth naming, because a model reasoning from
// California habits will get both wrong:
//
//   1. A will does not close the small-estate route. § 3102 is available
//      "whether or not letters have been issued or a will probated".
//   2. There is no deadline to probate a will at all — § 3133(a): "A will may
//      be offered for probate at any time."
//
// A NOTE ON EFFECTIVE DATES
//
// Pennsylvania's session-law notes state an enactment date and an offset, e.g.
// "July 2, 2013, P.L.199, No.35, eff. 60 days". The source gives the enactment
// date and the offset; it does not print the resulting date. Every
// `effectiveFrom` below that derives from such a note was computed here by
// adding the stated offset to the stated enactment date, and the underlying
// note is quoted in the field comment so the arithmetic can be checked.
//
// Two conventions, applied uniformly:
//
//   1. An enactment date is NOT an effective date and NOT an applicability
//      date. Where the source prints a separate applicability rule — Act 35's
//      "estates of decedents dying on or after", Act 13 of 2019's "who dies
//      after December 31, 2019" — that date governs, not the act date.
//   2. Where a rule cites more than one provision, `effectiveFrom` is the
//      LATEST of their effective dates, because the rule as stated is only
//      reliable once every provision it rests on is in its current form.
//      A rule that cites a 2013 provision cannot claim to hold since 1972.
//
// See the NOTES block at the foot of this file for everything that could NOT be
// sourced. That list is part of the deliverable, not an apology for it.

import { derived, ledger, type Fact } from "../lib/facts";
import type { ExclusionRule } from "../lib/derive";
import { daysBetween } from "../lib/derive";
import type { Rule } from "../lib/rules";

const RETRIEVED = "2026-07-28";

/**
 * Official text of a section of 20 Pa.C.S. The path encodes
 * `00.<chapter>.<section-within-chapter>.000`, so 20 Pa.C.S. § 3102 is chapter
 * 031, section 002.
 */
const paStat = (chapter: string, section: string) =>
  `https://www.legis.state.pa.us/WU01/LI/LI/CT/HTM/20/00.${chapter}.${section}.000..HTM`;

const S3101 = paStat("031", "001");
const S3102 = paStat("031", "002");
const S3121 = paStat("031", "021");
const S3131 = paStat("031", "031");
const S3132 = paStat("031", "032");
const S3133 = paStat("031", "033");
const S3155 = paStat("031", "055");
const S3162 = paStat("031", "062");
const S3301 = paStat("033", "001");
const S3532 = paStat("035", "032");

/** Tax Reform Code of 1971, Article XXI (Inheritance Tax) = 72 P.S. §§ 9101 et seq. */
const TAXCODE = "https://www.legis.state.pa.us/WU01/LI/LI/US/HTM/1971/0/0002..HTM";

/**
 * Current consolidated text of Pa. O.C. Rule 10.5, from the official
 * Pennsylvania Code. This is the source of record for the rule as it now
 * stands, and it carries the Source note that fixes the effective date:
 * "amended October 31, 2019, effective January 1, 2020, 49 Pa.B. 6804;
 *  amended January 12, 2022, effective April 1, 2022, 52 Pa.B. 684."
 * The Code site states it reflects changes through 56 Pa.B. 2488 (May 2,
 * 2026), so the April 2022 amendment is the operative one as of retrieval.
 */
const RULE_10_5 =
  "https://www.pacodeandbulletin.gov/Display/pacode?file=%2Fsecure%2Fpacode%2Fdata%2F231%2Fchapter8010%2Fs10.5.html";

/**
 * The Supreme Court's own order amending Rule 10.5, as printed in the
 * Pennsylvania Bulletin: "And Now, this 12th day of January, 2022 … This Order
 * shall be processed in accordance with Pa.R.J.A. 103(b) and shall be
 * effective on April 1, 2022."
 */
const RULE_10_5_ORDER =
  "https://www.pacodeandbulletin.gov/Display/pabull?file=/secure/pabulletin/data/vol52/52-5/160.html";

/** Pa. O.C. Rule 10.6 (status report by personal representative). */
const RULE_10_6 =
  "https://www.pacodeandbulletin.gov/Display/pacode?file=%2Fsecure%2Fpacode%2Fdata%2F231%2Fchapter8010%2Fs10.6.html";

/**
 * The official index of the statewide forms, 231 Pa. Code Ch. 8017A. This is
 * what establishes that the Register of Wills series ends at RW-10 and that no
 * statewide § 3102 small-estate petition form exists — see NOTES.
 */
const FORMS_INDEX =
  "https://www.pacodeandbulletin.gov/Display/pacode?file=%2Fsecure%2Fpacode%2Fdata%2F231%2Fchapter8017a%2Fs8017a.html&d=reduce";

const FORMS = "https://www.pacourts.us/Storage/media/pdfs/20210224/";
const RW02 = `${FORMS}225614-grantofletters-000822.pdf`;
const RW03 = `${FORMS}225922-rw03revised1120-008169.pdf`;
const RW06 = `${FORMS}225949-rw06revised1120-008172.pdf`;
const RW07 = `${FORMS}225958-rw07revised1120-008173.pdf`;
const RW08 = `${FORMS}230008-rw08revised1120-008174.pdf`;
const RW09 = `${FORMS}230017-rw09revised1120-008175.pdf`;
const RW10 = `${FORMS}230025-rw10revised1120-008176.pdf`;
const OC01 = `${FORMS}224745-oc01revised1120-008165.pdf`;
const OC07 = `${FORMS}224637-claimnotice-000795.pdf`;

const REV1500 =
  "https://www.pa.gov/content/dam/copapwp-pagov/en/revenue/documents/formsandpublications/formsforindividuals/inheritancetax/documents/rev-1500.pdf";

/**
 * Every primary source consulted for this pack, in one place. A rule's
 * `authority.sourceUrl` can only carry a single link, but several rules rest on
 * more sections than that — this map is where the rest of the provenance lives,
 * so a reviewer can retrace the whole pack without reading it line by line.
 */
export const PA_SOURCES: Record<string, string> = {
  "20 Pa.C.S. § 3101 (payments to family and funeral directors)": S3101,
  "20 Pa.C.S. § 3102 (settlement of small estates on petition)": S3102,
  "20 Pa.C.S. § 3121 (family exemption; when allowable)": S3121,
  "20 Pa.C.S. § 3131 (place of probate)": S3131,
  "20 Pa.C.S. § 3132 (manner of probate)": S3132,
  "20 Pa.C.S. § 3133 (limit of time for probate)": S3133,
  "20 Pa.C.S. § 3155 (persons entitled to letters)": S3155,
  "20 Pa.C.S. § 3162 (advertisement of grant of letters)": S3162,
  "20 Pa.C.S. § 3301 (inventory; duty of personal representative)": S3301,
  "20 Pa.C.S. § 3532 (distribution at risk of personal representative)": S3532,
  "Tax Reform Code of 1971, Art. XXI (inheritance tax), §§ 2116, 2136, 2142": TAXCODE,
  "Pa. O.C. Rule 10.5 (notice to beneficiaries and intestate heirs)": RULE_10_5,
  "Order amending Pa. O.C. Rule 10.5, 52 Pa.B. 684 (eff. April 1, 2022)": RULE_10_5_ORDER,
  "Pa. O.C. Rule 10.6 (status report by personal representative)": RULE_10_6,
  "231 Pa. Code Ch. 8017A (index of statewide Orphans' Court and RW forms)": FORMS_INDEX,
};

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/**
 * Every figure here is quoted from the primary source named in its comment.
 * Nothing in this object is rounded, inferred, or remembered.
 *
 * Fields are named with their statutory unit (`...Usd`, `...Days`, `...Months`,
 * `...Years`, `...Percent`) because Pennsylvania states its periods in months
 * and years far more often than in days, and silently converting a statutory
 * "nine months" into a day count is exactly the kind of quiet fabrication this
 * pack exists to avoid. Where the engine needs days, the conversion happens at
 * the point of use and is flagged there as a conversion.
 */
export const PA_THRESHOLDS = {
  // --- 20 Pa.C.S. § 3102, settlement of small estates on petition ----------
  /**
   * § 3102: property "(exclusive of real estate and of property payable under
   * section 3101 …, but including personal property claimed as the family
   * exemption) of a gross value not exceeding $50,000".
   * Last amended July 2, 2013, P.L.199, No.35, eff. 60 days; the 2013
   * amendment note provides that it "shall apply to estates of decedents dying
   * on or after the effective date of section 2".
   */
  smallEstatePetitionUsd: 50_000,
  /**
   * § 3102: "Within one year after such a decree of distribution has been made,
   * any party in interest may file a petition to revoke it".
   */
  smallEstateRevocationYears: 1,

  // --- 20 Pa.C.S. § 3121, family exemption ---------------------------------
  /**
   * § 3121: the spouse (or qualifying children/parents) "may retain or claim as
   * an exemption either real or personal property, or both … to the value of
   * $3,500". Last amended Dec. 1, 1994, P.L.655, No.102, eff. 60 days.
   *
   * Note the interaction: § 3102 counts family-exemption property *in* the
   * $50,000, so claiming the exemption does not buy headroom under the cap.
   */
  familyExemptionUsd: 3_500,

  // --- 20 Pa.C.S. § 3101, payments made without letters --------------------
  /** § 3101(a): employer may pay wages, salary or employee benefits "in an amount not exceeding $10,000". Subsec. (a) last amended Oct. 30, 2017, P.L.417, No.41, eff. 60 days. */
  payWagesUsd: 10_000,
  /** § 3101(b): a bank or credit union shall pay where the total "does not exceed $20,000", on presentation of a receipted funeral bill or funeral director's affidavit. Subsec. (b) amended Nov. 24, 2025, P.L.308, No.50, eff. 60 days. */
  payDepositAccountUsd: 20_000,
  /** § 3101(c): a facility may pay from a patient's care account "in an amount not exceeding $10,000". Subsec. (c) last amended July 2, 2013, P.L.199, No.35, eff. 60 days. */
  payPatientCareUsd: 10_000,
  /** § 3101(d): insurer owing the estate "a total amount of $11,000 or less" may pay the family. Subsec. (d) added Feb. 18, 1982, P.L.45, No.26, eff. imd. */
  payLifeInsuranceUsd: 11_000,
  /** § 3101(d): the insurer may pay "at any time after 60 days following his death". */
  payLifeInsuranceWaitDays: 60,
  /** § 3101(e)(1)(i): State Treasurer may release unclaimed property where "the value of the property is $20,000 or less". Subpara. (e)(1)(i) amended Nov. 24, 2025, P.L.308, No.50, eff. 180 days. */
  payUnclaimedPropertyUsd: 20_000,

  // --- 20 Pa.C.S. § 3155, grant of letters ---------------------------------
  /** § 3155(c): no letters to the classes in (b)(4), (5) or (8) "until 30 days after the decedent's death", absent consent of classes (1)–(3). */
  lettersToRemoterClassesWaitDays: 30,

  // --- 20 Pa.C.S. § 3162, advertisement ------------------------------------
  /** § 3162(a): notice of the grant of letters "once a week for three successive weeks". */
  advertisementWeeks: 3,

  // --- Pa. O.C. Rules 10.5 and 10.6 -----------------------------------------
  /** Rule 10.5(a): "Within three months after a grant of letters or whenever there is a change in personal representative, a personal representative or the personal representative's counsel shall send a written notice of estate administration in the form approved by the Supreme Court". Last amended Jan. 12, 2022, effective April 1, 2022, 52 Pa.B. 684. */
  beneficiaryNoticeMonths: 3,
  /** Rule 10.5(d): the certification is filed "Within ten (10) days after giving the notice required by paragraph (a)". */
  certificationFilingDays: 10,
  /** Rule 10.5(e): the Register notifies the court of a delinquent certification "after ten days subsequent to providing written notice to each personal representative and their counsel". */
  certificationDelinquencyDays: 10,
  /** Rule 10.6(a): "If administration of an estate has not been completed within two years of the decedent's death", the status report is filed then "and annually thereafter until the administration is completed". */
  statusReportYears: 2,

  // --- 20 Pa.C.S. § 3301, inventory ----------------------------------------
  /** § 3301(c): on a party in interest's written request, the inventory is due "within three months after the appointment of the personal representative or within 30 days after the request, whichever is later". */
  inventoryOnRequestMonths: 3,
  /** § 3301(c): the alternative limb of the same "whichever is later" test. */
  inventoryOnRequestDays: 30,

  // --- 20 Pa.C.S. § 3532, creditors and risk distribution ------------------
  /** § 3532(a): a risk distribution is protected unless a claim is known "within one year after the first complete advertisement of the grant of letters". */
  riskDistributionYears: 1,
  /** § 3532(b)(2): a claimant against distributed real property must file written notice with the clerk "within one year after the decedent's death". */
  realEstateClaimNoticeYears: 1,
  /** § 3532(b)(2): such a claim "shall expire at the end of five years after the decedent's death". */
  realEstateClaimExpiryYears: 5,
  /** § 3532(b.1): a personal representative's written demand may require notice of a claim "within 60 days from the mailing or delivery of the demand or within one year from the first complete advertisement …, whichever is later". */
  claimDemandDays: 60,

  // --- 20 Pa.C.S. § 3133, probate of the will ------------------------------
  /** § 3133(c): a will offered for probate "more than one year after the testator's death" is void against a bona fide grantee or lienholder of record. There is no deadline to probate as such — § 3133(a): "A will may be offered for probate at any time." */
  willVoidAgainstGranteeYears: 1,

  // --- Inheritance tax: Tax Reform Code of 1971, Art. XXI ------------------
  /** Act § 2136(d) / 72 P.S. § 9136(d): returns "shall be filed within nine months after the death of the decedent". */
  inheritanceTaxReturnMonths: 9,
  /** Act § 2136(d): the department "may grant an extension of the time for filing a return for an additional period of six months". */
  inheritanceTaxExtensionMonths: 6,
  /** Act § 2142 / 72 P.S. § 9142: tax "shall become delinquent at the expiration of nine months after the decedent's death". */
  inheritanceTaxDelinquentMonths: 9,
  /** Act § 2142: "To the extent that the inheritance tax is paid within three months after the death of the decedent, a discount of five per cent shall be allowed." */
  inheritanceTaxDiscountMonths: 3,
  /** Act § 2142: the discount is "five per cent". */
  inheritanceTaxDiscountPercent: 5,

  /** Act § 2116(a)(1.1)(ii) / 72 P.S. § 9116: "At a rate of zero per cent for estates of decedents dying on or after January 1, 1995." */
  taxRateSpousePercent: 0,
  /** Act § 2116(a)(1): transfers to a grandparent, parent, lineal descendant, or the spouse/widow(er) of a child are "at the rate of four and one-half per cent". */
  taxRateLinealPercent: 4.5,
  /** Act § 2116(a)(1.3): transfers "to or for the use of a sibling shall be at the rate of twelve per cent". */
  taxRateSiblingPercent: 12,
  /** Act § 2116(a)(2): all other transfers are "at the rate of fifteen per cent". */
  taxRateOtherPercent: 15,
  /** Act § 2116(a)(1.2): transfer "from a child twenty-one years of age or younger to or for the use of a natural parent, an adoptive parent or a stepparent … shall be at the rate of zero per cent". */
  taxRateParentFromMinorChildPercent: 0,
  /** Act § 2116(a)(1.4), added June 28, 2019, P.L.50, No.13: transfer "to or for the use of a child twenty-one years of age or younger from a natural parent, an adoptive parent or a stepparent of the child shall be at the rate of zero per cent". */
  taxRateMinorChildFromParentPercent: 0,

  /**
   * § 3102 as amended by Act 35 of 2013 applies to decedents dying on or after
   * this date. Computed: enactment July 2, 2013 + the stated "eff. 60 days".
   */
  smallEstateEffectiveFrom: "2013-08-31",

  /**
   * The date from which the Act 13 of 2019 zero rate for a parent-to-child-
   * under-21 transfer actually applies. NOT the act date. The compiler's note
   * printed with § 2116 states it in terms:
   *
   *   "Section 32 of Act 13 of 2019 provided that the amendment or addition of
   *    section 2116(a)(1.4) and (2) of this act shall apply to property
   *    transferred by a natural parent, an adoptive parent or a stepparent who
   *    dies after December 31, 2019."
   *
   * "dies after December 31, 2019" is the first day of 2020.
   */
  inheritanceTaxRatesEffectiveFrom: "2020-01-01",
} as const;

/**
 * Property outside the § 3102 computation. Quoted from the parenthetical in
 * § 3102 itself. Expressed as data so a change is an edit, not a deploy.
 *
 * There is deliberately no exclusion here for the family exemption: § 3102
 * says the gross value is computed "including personal property claimed as the
 * family exemption", so exempt property counts toward the $50,000.
 */
export const PA_EXCLUSIONS: ExclusionRule[] = [
  {
    id: "excl.3102.real_estate",
    flag: "is_real_estate",
    label: "Real estate — outside the § 3102 computation, and outside its reach",
    citation: "20 Pa.C.S. § 3102 (\"exclusive of real estate\")",
    sourceUrl: S3102,
  },
  {
    id: "excl.3102.payable_under_3101",
    flag: "payable_under_3101",
    label: "Payable to family or a funeral director without letters under § 3101",
    citation: "20 Pa.C.S. § 3102 (\"and of property payable under section 3101\")",
    sourceUrl: S3102,
  },
];

// ---------------------------------------------------------------------------
// Pennsylvania-specific derivation
// ---------------------------------------------------------------------------

/**
 * Compute the Pennsylvania-specific derived facts.
 *
 * No model participates. Each derived fact records the inputs it consumed and
 * the statute that says the computation is the right one.
 */
export function derivePaFacts(facts: Fact[], asOfIso: string, now = 0): Fact[] {
  const current = ledger(facts);
  const out: Fact[] = [];

  // Days since death. Pennsylvania hangs comparatively little on this — there
  // is no § 13100-style waiting period before the small-estate route opens —
  // but § 3101(d) and § 3155(c) both key off it, so it is recomputed each run.
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
          authority: {
            citation: "20 Pa.C.S. §§ 3101(d), 3155(c)",
            sourceUrl: S3101,
          },
          note:
            "§ 3101(d) allows an insurer to pay 60 days after death; § 3155(c) withholds letters from remoter classes for 30 days. § 3102 imposes no waiting period at all.",
        },
        { now },
      ),
    );
  }

  // The § 3102 gross value.
  const personal = smallEstateTotal(current);
  out.push(
    derived(
      {
        key: "estate.section_3102_gross_value",
        label: "Gross value for a § 3102 small-estate petition",
        value: personal.total,
        unit: "USD",
        formula: personal.formula,
        inputs: personal.inputs,
        authority: {
          citation:
            "20 Pa.C.S. § 3102 (exclusive of real estate and of property payable under § 3101, but including personal property claimed as the family exemption)",
          sourceUrl: S3102,
        },
        note:
          "Real estate is excluded from this sum and cannot be reached by the resulting decree. Family-exemption property is included, so claiming the exemption does not create headroom under the cap.",
      },
      { now },
    ),
  );

  // The California-trained instinct is that a large house closes the cheap
  // route. In Pennsylvania it provably does not, and the statute says so in a
  // sentence of its own. Recording it as a fact means the reactor can show an
  // executor *why* their $2m house did not matter here.
  const realEstate = realEstateTotal(current);
  if (realEstate.inputs.length > 0) {
    out.push(
      derived(
        {
          key: "estate.real_estate_blocks_3102",
          label: "Does the decedent's real estate close the § 3102 route?",
          value: false,
          formula: `real estate of ${realEstate.total.toLocaleString("en-US")} is disregarded — § 3102 is not restricted by real estate "regardless of its value"`,
          inputs: realEstate.inputs,
          authority: {
            citation:
              "20 Pa.C.S. § 3102 (\"The authority of the court to award distribution of personal property under this section shall not be restricted because of the decedent's ownership of real estate, regardless of its value.\")",
            sourceUrl: S3102,
          },
          note:
            "Always false. The value of the real estate is irrelevant to the personal-property route — but the § 3102 decree cannot transfer the real estate either.",
        },
        { now },
      ),
    );

    out.push(
      derived(
        {
          key: "estate.has_real_estate",
          label: "Estate includes Pennsylvania real estate",
          value: true,
          formula: `${realEstate.inputs.length} asset(s) flagged is_real_estate`,
          inputs: realEstate.inputs,
          authority: { citation: "20 Pa.C.S. § 3102", sourceUrl: S3102 },
          note: "Real estate needs its own road: letters, or a will probated and recorded.",
        },
        { now },
      ),
    );
  }

  return out;
}

function smallEstateTotal(current: Map<string, Fact>) {
  const inputs: string[] = [];
  const parts: string[] = [];
  let total = 0;

  const excludedFlags = new Set(PA_EXCLUSIONS.map((e) => e.flag));

  for (const [key, fact] of current) {
    const m = /^asset\.([^.]+)\.value$/.exec(key);
    if (!m || typeof fact.value !== "number") continue;
    const id = m[1];

    let excluded = false;
    for (const flag of excludedFlags) {
      const f = current.get(`asset.${id}.${flag}`);
      if (f?.value === true) {
        excluded = true;
        inputs.push(`asset.${id}.${flag}`);
        break;
      }
    }
    if (excluded) continue;
    total += fact.value;
    inputs.push(key);
    parts.push(`${fact.label} ${fact.value.toLocaleString("en-US")}`);
  }

  return {
    total,
    inputs: inputs.sort(),
    formula: parts.length ? parts.join(" + ") : "no includable personal property",
  };
}

function realEstateTotal(current: Map<string, Fact>) {
  const inputs: string[] = [];
  let total = 0;
  for (const [key, fact] of current) {
    const m = /^asset\.([^.]+)\.value$/.exec(key);
    if (!m || typeof fact.value !== "number") continue;
    const flag = current.get(`asset.${m[1]}.is_real_estate`);
    if (flag?.value !== true) continue;
    total += fact.value;
    inputs.push(key, `asset.${m[1]}.is_real_estate`);
  }
  return { total, inputs: inputs.sort() };
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

/**
 * Pennsylvania Register of Wills and Orphans' Court filing fees are set county
 * by county, and no statewide schedule was located. Rather than invent a range,
 * every rule reports [0, 0] and carries this string in `estimates.estCostUsd`.
 * Zero here means "not established", not "free".
 */
const NO_FEE_SOURCED =
  "NOT SOURCED — Pennsylvania Register of Wills fees are set by each county and no statewide schedule was retrieved. [0, 0] means the figure is unknown, not that the step is free.";

const NO_TIMELINE_SOURCED = (why: string) => `NOT SOURCED — ${why} [0, 0] means unknown, not instant.`;

/** 30-day months, used only where a statutory period is stated in months. */
const months = (n: number) => n * 30;

export const PA_RULES: Rule[] = [
  // --- The small-estate route and its cap ----------------------------------
  {
    id: "pa.personal.3102_small_estate",
    decisionPoint: "personal_property_route",
    jurisdiction: { state: "PA" },
    title: "Settlement of a small estate on petition (20 Pa.C.S. § 3102)",
    requires: ["decedent.domiciled_in_pa", "estate.section_3102_gross_value"],
    when: {
      all: [
        { fact: "decedent.domiciled_in_pa", op: "==", value: true },
        {
          fact: "estate.section_3102_gross_value",
          op: "<=",
          value: PA_THRESHOLDS.smallEstatePetitionUsd,
        },
      ],
    },
    then: {
      conclusion:
        "Petition the orphans' court division of the county of domicile for a decree of distribution under § 3102. No letters, no administration, no accounting: the decree 'shall in all respects have the same effect as a decree of distribution after an accounting by a personal representative', and is sufficient authority for transfer agents and registrars to recognise the distributees.",
      forms: [
        {
          code: "—",
          title:
            "Petition for settlement of a small estate under 20 Pa.C.S. § 3102 — no statewide form is prescribed; each county's orphans' court supplies its own (see NOTES)",
        },
      ],
      obligations: [
        "Petition must be brought by a party in interest, in the orphans' court division of the county where the decedent was domiciled at death",
        "Give such notice as the court directs — § 3102 fixes no notice period and leaves it to the court's discretion",
        "Appraisement is at the court's discretion: the section operates 'with or without appraisement'",
        "Family-exemption property counts toward the $50,000 — claiming the exemption does not create headroom",
        "The decree is open to attack for one year: any party in interest may petition to revoke it for improper distribution",
      ],
      timelineDays: [0, 0],
      estCostUsd: [0, 0],
    },
    estimates: {
      timelineDays: NO_TIMELINE_SOURCED(
        "§ 3102 imposes no waiting period before filing and no time limit on the court, and no statewide data on how quickly counties decide these petitions was retrieved.",
      ),
      estCostUsd: NO_FEE_SOURCED,
    },
    authority: authority(
      "20 Pa.C.S. § 3102 (as amended July 2, 2013, P.L.199, No.35)",
      S3102,
      PA_THRESHOLDS.smallEstateEffectiveFrom,
    ),
    priority: 100,
    blastRadius: "high",
    reversibility: "costly",
    notes:
      "Cap is $50,000 gross, exclusive of real estate and of § 3101 property but including family-exemption property. The 2013 amendment applies to estates of decedents dying on or after its effective date, so the date of death — not the filing date — selects the cap.",
  },
  {
    id: "pa.personal.full_administration",
    decisionPoint: "personal_property_route",
    jurisdiction: { state: "PA" },
    title: "Full administration (estate exceeds the § 3102 cap)",
    requires: ["estate.section_3102_gross_value"],
    when: {
      fact: "estate.section_3102_gross_value",
      op: ">",
      value: PA_THRESHOLDS.smallEstatePetitionUsd,
    },
    then: {
      conclusion:
        "The estate is too large for a § 3102 decree. Apply to the Register of Wills of the county of the decedent's last family or principal residence for a grant of letters, and administer the estate.",
      forms: [
        { code: "RW-02", title: "Petition for Grant of Letters", url: RW02 },
        { code: "RW-07", title: "Notice of Estate Administration Pursuant to Pa. O.C. Rule 10.5", url: RW07 },
        { code: "RW-08", title: "Certification of Notice Under Pa. O.C. Rule 10.5", url: RW08 },
        { code: "RW-09", title: "Inventory", url: RW09 },
        { code: "RW-10", title: "Pa. O.C. Rule 10.6 Status Report", url: RW10 },
        { code: "OC-01", title: "Petition for Adjudication — Decedent's Estate", url: OC01 },
      ],
      obligations: [
        "Advertise the grant of letters once a week for three successive weeks, in one newspaper of general circulation and in the designated legal periodical (§ 3162(a))",
        "Send the Rule 10.5 notice of estate administration to beneficiaries and intestate heirs within three months of the grant of letters, and file the certification",
        "File a verified inventory of all real and personal estate, except real estate outside Pennsylvania (§ 3301(a))",
        "File the inheritance tax return within nine months of death (Act § 2136(d))",
        "Do not distribute free of claims until one year after the first complete advertisement of the grant of letters (§ 3532(a))",
        "If administration is not complete within two years of the decedent's death, file the Rule 10.6 status report (RW-10) at that point and annually thereafter until it is; file it again on completion (Pa. O.C. Rule 10.6(a), (b))",
      ],
      // The one-year § 3532 claim window is the only statutory floor on how
      // long a Pennsylvania administration must stay open, so it is used for
      // both bounds and labelled as a floor rather than a prediction.
      timelineDays: [365, 365],
      estCostUsd: [0, 0],
    },
    estimates: {
      timelineDays:
        "Lower bound is the § 3532(a) one-year period after the first complete advertisement, which is a statutory floor on risk-free distribution — not a prediction of how long administration takes. No sourced upper bound; the two bounds are equal because only the floor is established.",
      estCostUsd: NO_FEE_SOURCED,
    },
    authority: authority(
      "20 Pa.C.S. §§ 3102, 3155, 3162, 3301, 3532",
      S3102,
      PA_THRESHOLDS.smallEstateEffectiveFrom,
    ),
    priority: 50,
    blastRadius: "high",
    reversibility: "irreversible",
  },

  // --- Does a will change the route? ---------------------------------------
  {
    id: "pa.small_estate.will_does_not_close_route",
    decisionPoint: "small_estate_will_effect",
    jurisdiction: { state: "PA" },
    title: "A will does not close the § 3102 small-estate route",
    requires: ["decedent.has_will"],
    when: { exists: "decedent.has_will" },
    then: {
      conclusion:
        "Whether or not the decedent left a will makes no difference to the availability of § 3102. The section applies 'whether or not letters have been issued or a will probated'. A testate estate under $50,000 may still be settled by petition, and the decree distributes to 'the parties entitled thereto' — which, where there is a will, means the will's beneficiaries.",
      forms: [],
      obligations: [
        "Establish who is entitled: under the will if there is one, otherwise under the intestate law",
        "Probating the will remains worthwhile where real estate is involved — see the § 3133(c) one-year recording risk",
      ],
      timelineDays: [0, 0],
      estCostUsd: [0, 0],
    },
    estimates: {
      timelineDays: NO_TIMELINE_SOURCED("This rule states an availability, not a process."),
      estCostUsd: NO_FEE_SOURCED,
    },
    authority: authority("20 Pa.C.S. § 3102", S3102, PA_THRESHOLDS.smallEstateEffectiveFrom),
    priority: 100,
    blastRadius: "medium",
    reversibility: "reversible",
    notes:
      "This is the opposite of the California instinct, where the existence of a will steers the whole matter. In Pennsylvania the will changes who takes, not which road the estate travels.",
  },
  {
    id: "pa.will.probate",
    decisionPoint: "will_probate",
    jurisdiction: { state: "PA" },
    title: "Probate the will before the Register of the right county",
    requires: ["decedent.has_will", "decedent.domiciled_in_pa"],
    when: {
      all: [
        { fact: "decedent.has_will", op: "==", value: true },
        { fact: "decedent.domiciled_in_pa", op: "==", value: true },
      ],
    },
    then: {
      conclusion:
        "The will of a Pennsylvania-domiciled decedent 'shall be probated only before the register of the county where the decedent had his last family or principal residence'. There is no deadline — § 3133(a) says a will 'may be offered for probate at any time' — but waiting past a year costs the will its priority over a bona fide purchaser or lienholder of the testator's real estate who recorded first.",
      forms: [
        { code: "RW-02", title: "Petition for Grant of Letters", url: RW02 },
        { code: "RW-03", title: "Oath of Subscribing Witness(es)", url: RW03 },
      ],
      obligations: [
        "File in the county of the decedent's last family or principal residence; for a decedent with no Pennsylvania domicile, any county where property is located (§ 3131)",
        "Prove the will by the oaths or affirmations of two competent witnesses (§ 3132)",
        "Prefer subscribing witnesses where readily available, and proof of the testator's signature over proof of a witness's (§ 3132(1))",
        "Probate within one year of death where real estate is involved, to keep the will good against a bona fide grantee or lienholder (§ 3133(c))",
      ],
      timelineDays: [365, 365],
      estCostUsd: [0, 0],
    },
    estimates: {
      timelineDays:
        "365 days is the § 3133(c) one-year mark, expressed in days. It is not a deadline for probate — § 3133(a) sets none — but the point past which the will loses to a recorded bona fide interest in real estate.",
      estCostUsd: NO_FEE_SOURCED,
    },
    authority: authority(
      "20 Pa.C.S. §§ 3131, 3132, 3133",
      S3131,
      // Latest of the three cited provisions. § 3131 carries no amendment note
      // at all, so it dates from Chapter 31's enactment (June 30, 1972,
      // P.L.508, No.164, effective July 1, 1972). But § 3132 was amended
      // Dec. 10, 1974, P.L.867, No.293, eff. imd., and § 3133(c) — which this
      // rule's conclusion and fourth obligation both rest on — was amended
      // July 11, 1980, P.L.565, No.118, eff. 60 days = 1980-09-09. The rule
      // cannot claim to hold since 1972 when the one-year recording risk it
      // states only took its current form in 1980.
      "1980-09-09",
    ),
    priority: 100,
    blastRadius: "high",
    reversibility: "costly",
    notes:
      "Self-proved wills under § 3132.1 were not retrieved and are not modelled here; the two-witness requirement above is § 3132's general rule.",
  },
  {
    id: "pa.letters.testamentary",
    decisionPoint: "letters_type",
    jurisdiction: { state: "PA" },
    title: "Letters testamentary — a will naming an executor",
    requires: ["decedent.has_will", "decedent.will_names_executor"],
    when: {
      all: [
        { fact: "decedent.has_will", op: "==", value: true },
        { fact: "decedent.will_names_executor", op: "==", value: true },
      ],
    },
    then: {
      conclusion:
        "The Register grants letters testamentary to the executor designated in the will — § 3155(a) is mandatory in form ('shall be granted') and applies 'whether or not he has declined a trust under the will'. There is no statutory queue to work through and no 30-day wait. The will must be probated before the Register of the county of the decedent's last family or principal residence.",
      forms: [
        { code: "RW-02", title: "Petition for Grant of Letters", url: RW02 },
        { code: "RW-03", title: "Oath of Subscribing Witness(es)", url: RW03 },
        { code: "RW-06", title: "Renunciation", url: RW06 },
      ],
      obligations: [
        "Probate the will before the Register of the county where the decedent had his last family or principal residence (§ 3131)",
        "Prove the will by the oaths or affirmations of two competent witnesses, preferring subscribing witnesses where readily available (§ 3132)",
        "Letters are refused to anyone charged with voluntary manslaughter or homicide (other than homicide by vehicle) in connection with the death, until the charge is withdrawn, dismissed, or a not-guilty verdict is returned (§ 3155(d))",
      ],
      timelineDays: [0, 0],
      estCostUsd: [0, 0],
    },
    estimates: {
      timelineDays: NO_TIMELINE_SOURCED(
        "No statutory period governs how quickly a Register acts on a petition for letters, and no statewide data was retrieved.",
      ),
      estCostUsd: NO_FEE_SOURCED,
    },
    authority: authority(
      "20 Pa.C.S. § 3155(a), (d); §§ 3131, 3132",
      S3155,
      // Nov. 29, 2006, P.L.1536, No.171, eff. 60 days.
      "2007-01-28",
    ),
    priority: 100,
    blastRadius: "high",
    reversibility: "costly",
    notes:
      "§ 3133(a): 'A will may be offered for probate at any time.' Pennsylvania sets no deadline for probate — but under § 3133(c) a will offered more than one year after death is void against a bona fide grantee or lienholder of the testator's real estate whose interest was recorded first.",
  },
  {
    id: "pa.letters.administration",
    decisionPoint: "letters_type",
    jurisdiction: { state: "PA" },
    title: "Letters of administration — no will",
    requires: ["decedent.has_will"],
    when: { fact: "decedent.has_will", op: "==", value: false },
    then: {
      conclusion:
        "The Register grants letters of administration under the § 3155(b) order of preference: (1) those entitled to the residuary estate under the will, (2) the surviving spouse, (3) those entitled under the intestate law as the Register judges will best administer the estate, preferring larger shares, (4) principal creditors, (5) other fit persons, then (7) a guardianship support agency and (8) a redevelopment authority. The order yields 'except for good cause'.",
      forms: [
        { code: "RW-02", title: "Petition for Grant of Letters", url: RW02 },
        { code: "RW-06", title: "Renunciation", url: RW06 },
      ],
      obligations: [
        "Absent the consent of classes (1), (2) and (3), no letters may issue to a principal creditor, other fit person, or redevelopment authority until 30 days after the decedent's death (§ 3155(c))",
        "A person entitled may renounce and nominate someone in preference to later classes (§ 3155(b)(6))",
        "Letters are refused to anyone charged with voluntary manslaughter or homicide (other than homicide by vehicle) in connection with the death (§ 3155(d))",
      ],
      timelineDays: [PA_THRESHOLDS.lettersToRemoterClassesWaitDays, PA_THRESHOLDS.lettersToRemoterClassesWaitDays],
      estCostUsd: [0, 0],
    },
    estimates: {
      timelineDays:
        "The 30 days is the § 3155(c) bar on granting letters to classes (b)(4), (5) and (8); it does not apply to a surviving spouse or to those entitled under the intestate law, who may apply immediately.",
      estCostUsd: NO_FEE_SOURCED,
    },
    authority: authority("20 Pa.C.S. § 3155(b), (c), (d)", S3155, "2007-01-28"),
    priority: 90,
    blastRadius: "high",
    reversibility: "costly",
  },

  // --- Real estate ----------------------------------------------------------
  {
    id: "pa.real_estate.needs_its_own_road",
    decisionPoint: "real_estate_route",
    jurisdiction: { state: "PA" },
    title: "Real estate: outside § 3102 in both directions",
    requires: ["estate.has_real_estate"],
    when: { fact: "estate.has_real_estate", op: "==", value: true },
    then: {
      conclusion:
        "Real estate is excluded from the § 3102 computation, so its value — 'regardless of its value' — cannot push the personal property out of the small-estate route. The same exclusion means the § 3102 decree cannot transfer it. Title passes under the will or the intestate law; probate the will, or take out letters, to make that provable of record.",
      forms: [
        { code: "RW-02", title: "Petition for Grant of Letters", url: RW02 },
        { code: "RW-09", title: "Inventory", url: RW09 },
      ],
      obligations: [
        "Include Pennsylvania real estate in the inventory; real estate outside Pennsylvania goes in a memorandum at the end and is not extended into the total (§ 3301(a), (b))",
        "Probate the will within one year of death if real estate is involved — after a year the will is void against a bona fide grantee or lienholder who recorded first (§ 3133(c))",
        "A creditor claiming against distributed real property must file written notice with the clerk within one year of death; the claim expires five years after death (§ 3532(b)(2))",
      ],
      timelineDays: [365, 365],
      estCostUsd: [0, 0],
    },
    estimates: {
      timelineDays:
        "365 days is the § 3133(c) / § 3532(b)(2) one-year mark, expressed in days. Both bounds are the same figure because it is a statutory cliff, not a duration.",
      estCostUsd: NO_FEE_SOURCED,
    },
    authority: authority(
      "20 Pa.C.S. §§ 3102, 3133(c), 3301, 3532(b)(2)",
      S3133,
      // Latest of the four cited provisions: § 3133(c) 1980-09-09,
      // § 3532 1992-12-16, § 3301 2010-12-26, § 3102 2013-08-31. The whole
      // point of this rule is § 3102's real-estate exclusion, and § 3102's
      // current text dates from Act 35 of 2013.
      PA_THRESHOLDS.smallEstateEffectiveFrom,
    ),
    priority: 100,
    blastRadius: "high",
    reversibility: "irreversible",
    notes:
      "The California pack's cascade does not exist here. In California a residence over the cap closes both economical routes; in Pennsylvania the statute expressly severs the two questions.",
  },

  // --- Administration obligations ------------------------------------------
  {
    id: "pa.admin.advertisement",
    decisionPoint: "estate_advertisement",
    jurisdiction: { state: "PA" },
    title: "Advertise the grant of letters",
    requires: ["estate.letters_granted"],
    when: { fact: "estate.letters_granted", op: "==", value: true },
    then: {
      conclusion:
        "Immediately after the grant of letters the personal representative must advertise it once a week for three successive weeks, in one newspaper of general circulation published at or near where the decedent resided and in the legal periodical (if any) designated by rule of court. The advertisement starts the § 3532 one-year clock, so the date of first complete advertisement is a fact worth recording.",
      forms: [],
      obligations: [
        "Publish once a week for three successive weeks in a newspaper of general circulation",
        "Publish in the legal periodical designated by rule of court, if any",
        "State the personal representative's name and address, request claimants to make claims known, and request debtors to pay without delay",
        "Record the date of first complete advertisement — § 3532 runs from it, not from the grant of letters",
      ],
      timelineDays: [21, 21],
      estCostUsd: [0, 0],
    },
    estimates: {
      timelineDays:
        "21 days is 'once a week for three successive weeks' expressed in days. The statute states weeks, not days.",
      estCostUsd: NO_FEE_SOURCED,
    },
    authority: authority(
      "20 Pa.C.S. § 3162(a)",
      S3162,
      // Oct. 27, 2010, P.L.837, No.85, eff. 60 days.
      "2010-12-26",
    ),
    priority: 100,
    blastRadius: "medium",
    reversibility: "costly",
  },
  {
    id: "pa.admin.rule_10_5_notice",
    decisionPoint: "beneficiary_notice",
    jurisdiction: { state: "PA" },
    title: "Notice to beneficiaries and intestate heirs (Pa. O.C. Rule 10.5)",
    requires: ["estate.letters_granted"],
    when: { fact: "estate.letters_granted", op: "==", value: true },
    then: {
      conclusion:
        "Within three months after a grant of letters — or whenever there is a change in personal representative — the personal representative or their counsel must send the Supreme Court's approved written notice of estate administration, and file the certification with the Register.",
      forms: [
        { code: "RW-07", title: "Notice of Estate Administration Pursuant to Pa. O.C. Rule 10.5", url: RW07 },
        { code: "RW-08", title: "Certification of Notice Under Pa. O.C. Rule 10.5", url: RW08 },
      ],
      obligations: [
        "Send the notice within three months of the grant of letters",
        "Send it again on any change in personal representative, including a grant to a successor",
        "File the certification of notice with the Register within ten days after giving the notice (Rule 10.5(d)); the Register may charge a fee for filing it",
        "Notice need not run beyond the degree of consanguinity that would entitle a person to inherit under Chapter 21 of Title 20",
      ],
      timelineDays: [months(PA_THRESHOLDS.beneficiaryNoticeMonths), months(PA_THRESHOLDS.beneficiaryNoticeMonths)],
      estCostUsd: [0, 0],
    },
    estimates: {
      timelineDays:
        "90 days is the rule's 'three months' converted at 30 days per month for the engine. The rule states months; 90 is a conversion, not a figure printed in the rule.",
      estCostUsd: NO_FEE_SOURCED,
    },
    authority: authority(
      "Pa. O.C. Rule 10.5(a), (d), (e), as amended Jan. 12, 2022, 52 Pa.B. 684",
      RULE_10_5,
      // The Pennsylvania Code Source note for Rule 10.5 reads: "amended
      // October 31, 2019, effective January 1, 2020, 49 Pa.B. 6804; amended
      // January 12, 2022, effective April 1, 2022, 52 Pa.B. 684." The
      // Supreme Court's order at 52 Pa.B. 684 says the same in its own words:
      // "This Order … shall be effective on April 1, 2022."
      "2022-04-01",
    ),
    priority: 100,
    blastRadius: "medium",
    reversibility: "costly",
    notes:
      "Rule 10.5(e): if the certification is not filed on time, the Register notifies the court of the delinquency ten days after warning the personal representative and counsel. The court's inherent power to sanction is expressly preserved.",
  },
  {
    id: "pa.admin.inventory",
    decisionPoint: "inventory",
    jurisdiction: { state: "PA" },
    title: "File the inventory",
    requires: ["estate.letters_granted"],
    when: { fact: "estate.letters_granted", op: "==", value: true },
    then: {
      conclusion:
        "File a verified inventory of all real and personal estate, except real estate outside Pennsylvania, with the Register. The deadline is the earlier of the date the account is filed and the due date (including extensions) for the inheritance tax return — which makes the nine-month tax deadline the practical outer limit in most estates.",
      forms: [{ code: "RW-09", title: "Inventory", url: RW09 }],
      obligations: [
        "Inventory all real and personal estate except real estate outside Pennsylvania",
        "List out-of-state real estate in a memorandum at the end; values there are not extended into the total",
        "File no later than the earlier of the account or the inheritance tax return due date, including extensions",
        "On a party in interest's written request, file within three months of appointment or 30 days after the request, whichever is later",
        "The court may order an inventory at any time",
      ],
      timelineDays: [
        months(PA_THRESHOLDS.inventoryOnRequestMonths),
        months(PA_THRESHOLDS.inheritanceTaxReturnMonths),
      ],
      estCostUsd: [0, 0],
    },
    estimates: {
      timelineDays:
        "Both bounds are month figures converted at 30 days per month: the 90-day lower bound is § 3301(c)'s 'three months after the appointment' on request; the 270-day upper bound is the nine-month inheritance tax return deadline that § 3301(c) points at. The statutes state months, not days.",
      estCostUsd: NO_FEE_SOURCED,
    },
    authority: authority("20 Pa.C.S. § 3301(a), (b), (c)", S3301, "2010-12-26"),
    priority: 100,
    blastRadius: "medium",
    reversibility: "reversible",
  },
  {
    id: "pa.admin.creditor_claims",
    decisionPoint: "creditor_claims",
    jurisdiction: { state: "PA" },
    title: "Creditor claims and distribution at the representative's risk",
    requires: ["estate.letters_granted"],
    when: { fact: "estate.letters_granted", op: "==", value: true },
    then: {
      conclusion:
        "A personal representative may distribute without an audit, at their own risk. That risk closes one year after the first complete advertisement of the grant of letters: a claim not known to the representative by then, and not known before the distribution, cannot be asserted against them or against the distributed personal property.",
      forms: [
        { code: "OC-07", title: "Notice of Claim (filed pursuant to 20 Pa.C.S. § 3532)", url: OC07 },
        { code: "OC-01", title: "Petition for Adjudication — Decedent's Estate", url: OC01 },
      ],
      obligations: [
        "Run the one-year clock from the first complete advertisement of the grant of letters, not from death and not from the grant",
        "For real property, a claimant must instead file written notice with the clerk within one year of death; that claim expires five years after death unless an account or a petition to compel one is filed",
        "A representative may shorten a specific claimant's window by written demand: notice within 60 days of the demand or one year from first complete advertisement, whichever is later",
        "Nothing in § 3532 affects a lien or charge that existed at the date of death",
      ],
      timelineDays: [365, 365],
      estCostUsd: [0, 0],
    },
    estimates: {
      timelineDays:
        "365 days is § 3532's 'one year' expressed in days. The statute states a year.",
      estCostUsd: NO_FEE_SOURCED,
    },
    authority: authority(
      "20 Pa.C.S. § 3532(a), (b), (b.1)",
      S3532,
      // Dec. 16, 1992, P.L.1163, No.152, eff. imd.
      "1992-12-16",
    ),
    priority: 100,
    blastRadius: "high",
    reversibility: "irreversible",
  },

  // --- Money that never needs letters --------------------------------------
  {
    id: "pa.disposition.3101_payments",
    decisionPoint: "dispositions_independent_of_letters",
    jurisdiction: { state: "PA" },
    title: "Payments to family and funeral directors without letters (§ 3101)",
    requires: ["decedent.domiciled_in_pa"],
    when: { fact: "decedent.domiciled_in_pa", op: "==", value: true },
    then: {
      conclusion:
        "Five categories of asset can be released to close family without any letters at all, and none of them count toward the § 3102 $50,000: wages, salary or employee benefits up to $10,000; a bank or credit union balance up to $20,000 against a receipted funeral bill; a patient's care account up to $10,000; life insurance payable to the estate of $11,000 or less, 60 days after death; and unclaimed property held by the State Treasurer of $20,000 or less. Preference in every case runs spouse, child, father or mother, sister or brother.",
      forms: [],
      obligations: [
        "Bank payments under § 3101(b) require a receipted funeral bill, or a licensed funeral director's affidavit that satisfactory payment arrangements have been made",
        "Life insurance under § 3101(d) may not be paid until 60 days after death, and only if no written claim from a personal representative has reached the office named in the policy",
        "State Treasurer payments under § 3101(e) require a certified death certificate and a sworn affidavit under 18 Pa.C.S. § 4904, and are unavailable if a personal representative was appointed within the last five years",
        "The payer is released as if it had paid a personal representative; the recipient is answerable to anyone prejudiced by an improper distribution",
      ],
      timelineDays: [
        PA_THRESHOLDS.payLifeInsuranceWaitDays,
        PA_THRESHOLDS.payLifeInsuranceWaitDays,
      ],
      estCostUsd: [0, 0],
    },
    estimates: {
      timelineDays:
        "60 days is the § 3101(d) life-insurance wait, the only waiting period in the section. Payments under (a), (b), (c) and (e) may be made 'at any time after the death'.",
      estCostUsd: NO_FEE_SOURCED,
    },
    authority: authority(
      "20 Pa.C.S. § 3101(a)–(e) (subsecs. (b) and (e)(1)(i) as amended Nov. 24, 2025, P.L.308, No.50)",
      S3101,
      // Act 50 of 2025 amended subsec. (b) eff. 60 days (2026-01-23) and
      // subsec. (e)(1)(i) eff. 180 days (2026-05-23). The later of the two is
      // used, so the whole rule is in force on this date.
      "2026-05-23",
    ),
    priority: 100,
    blastRadius: "medium",
    reversibility: "costly",
    notes:
      "The $20,000 deposit-account figure is recent: Act 50 of 2025 amended § 3101(b), effective 60 days after 24 November 2025. Any figure remembered from before 2026 for this subsection is stale.",
  },
  {
    id: "pa.family_exemption",
    decisionPoint: "family_exemption",
    jurisdiction: { state: "PA" },
    title: "Family exemption (§ 3121)",
    requires: ["decedent.domiciled_in_pa"],
    when: { fact: "decedent.domiciled_in_pa", op: "==", value: true },
    then: {
      conclusion:
        "The surviving spouse may retain or claim $3,500 of real or personal property as an exemption. If there is no spouse, or the spouse has forfeited, the right passes to children who were members of the decedent's household, and then to parents who were members of the household.",
      forms: [],
      obligations: [
        "Property already sold by the personal representative cannot be claimed",
        "Property specifically devised or bequeathed cannot be claimed if other assets are available for the exemption",
        "Remember that § 3102 counts family-exemption property inside the $50,000 gross value",
      ],
      timelineDays: [0, 0],
      estCostUsd: [0, 0],
    },
    estimates: {
      timelineDays: NO_TIMELINE_SOURCED("§ 3121 states no period for claiming the exemption."),
      estCostUsd: NO_FEE_SOURCED,
    },
    authority: authority(
      "20 Pa.C.S. § 3121",
      S3121,
      // Dec. 1, 1994, P.L.655, No.102, eff. 60 days.
      "1995-01-30",
    ),
    priority: 100,
    blastRadius: "low",
    reversibility: "reversible",
    notes:
      "$3,500 has stood since the 1994 amendment took effect and is not indexed. It is one of the lowest family exemptions in the country and is frequently misremembered as a larger, inflation-adjusted figure.",
  },

  // --- Inheritance tax ------------------------------------------------------
  {
    id: "pa.tax.inheritance",
    decisionPoint: "inheritance_tax",
    jurisdiction: { state: "PA" },
    title: "Pennsylvania inheritance tax",
    requires: ["decedent.domiciled_in_pa"],
    when: { fact: "decedent.domiciled_in_pa", op: "==", value: true },
    then: {
      conclusion:
        "Pennsylvania taxes the transfer, not the estate, and the rate depends on who receives: 0% to a surviving spouse (deaths on or after 1 January 1995), 0% between a parent and a child aged 21 or younger in either direction, 4.5% to grandparents, parents and lineal descendants, 12% to siblings, and 15% to everyone else. The tax is due at the date of death, becomes delinquent nine months after death, and a 5% discount is allowed on whatever is paid within three months of death. This applies whichever procedural route the estate takes — a § 3102 small estate is not exempt.",
      forms: [
        { code: "REV-1500", title: "Inheritance Tax Return — Resident Decedent", url: REV1500 },
      ],
      obligations: [
        "File the return within nine months after death; a six-month extension may be granted at the department's discretion if requested before the nine months expire",
        "Pay within three months of death to take the 5% discount",
        "Interest runs on unpaid tax from the date of delinquency",
        "For a resident decedent, file with the Register; for a nonresident, with the Register who issued letters, otherwise with the department",
        "File a supplemental return promptly for assets discovered after the original return",
      ],
      timelineDays: [
        months(PA_THRESHOLDS.inheritanceTaxDiscountMonths),
        months(PA_THRESHOLDS.inheritanceTaxReturnMonths),
      ],
      estCostUsd: [0, 0],
    },
    estimates: {
      timelineDays:
        "Both bounds are month figures converted at 30 days per month: 90 days is the three-month discount window, 270 days the nine-month return and delinquency deadline. The statute states months, not days.",
      estCostUsd:
        "NOT SOURCED as a fee — the amount payable is a percentage of the transfer under Act § 2116 and depends entirely on who inherits, so no dollar range is meaningful here. See the taxRate* fields in PA_THRESHOLDS for the cited rates.",
    },
    authority: authority(
      "Tax Reform Code of 1971, Act of Mar. 4, 1971, P.L.6, No.2, §§ 2116, 2136, 2142 (72 P.S. §§ 9116, 9136, 9142)",
      TAXCODE,
      // §§ 2136 and 2142 were both added Aug. 4, 1991, P.L.97, No.22, and are
      // unamended. § 2116(a)(1.4) and (2) were last touched by Act 13 of 2019,
      // whose own section 32 — printed as a compiler's note with § 2116 —
      // fixes the applicability: the change applies "to property transferred
      // by a natural parent, an adoptive parent or a stepparent who dies after
      // December 31, 2019". June 28, 2019 is the act date and is NOT when the
      // rate schedule below started applying to decedents.
      PA_THRESHOLDS.inheritanceTaxRatesEffectiveFrom,
    ),
    priority: 100,
    blastRadius: "high",
    reversibility: "costly",
    notes:
      "Two applicability dates are stated in the source and neither is an act date. The 0% spousal rate applies to 'estates of decedents dying on or after January 1, 1995' (§ 2116(a)(1.1)(ii), in the statutory text itself). The 0% parent-to-child-under-21 rate added in 2019 applies where the transferring parent 'dies after December 31, 2019' (§ 32 of Act 13 of 2019, printed as a compiler's note), which is the effectiveFrom above. A death before 2020 is taxed at 4.5% on that transfer, not 0%.",
  },
];

/** Where an executor would actually go to obtain a missing fact. */
export const PA_OBTAIN_HINTS: Record<string, string> = {
  "decedent.domiciled_in_pa":
    "Death certificate and the decedent's last tax return or voter registration; § 3102 and § 3131 both turn on domicile at death, and § 3131 on the last family or principal residence within Pennsylvania",
  "decedent.date_of_death":
    "Certified copy of the death certificate from the Pennsylvania Department of Health Division of Vital Records, or the county Register of Wills",
  "decedent.has_will":
    "Search the Register of Wills of the county of last residence; also check the decedent's safe deposit box and attorney's files. Note § 3133(a) — a will may be offered for probate at any time, so a late-surfacing will is a live risk",
  "decedent.will_names_executor":
    "Read the will's appointment clause. § 3155(a) requires the Register to grant letters testamentary to the designated executor even if they had declined a trust under the will",
  "estate.section_3102_gross_value":
    "Derived, not obtained: the sum of personal property values from the ledger, excluding real estate and § 3101 property. Each component needs its own valuation as at the date of death",
  "estate.has_real_estate":
    "County recorder of deeds for the county where any real property sits, plus the decedent's deeds and mortgage statements",
  "estate.letters_granted":
    "Short certificate issued by the Register of Wills; the certificate itself is the proof third parties will ask for",
  "estate.days_since_death": "Derived from decedent.date_of_death and the date of evaluation",
  "estate.real_estate_blocks_3102":
    "Derived. Always false in Pennsylvania — § 3102 says the court's authority is not restricted by real estate 'regardless of its value'",
  "asset.*.value":
    "Date-of-death valuation. Pennsylvania has no probate-referee system: the personal representative values the assets and the Department of Revenue supervises appraisement under Act § 2137",
  "asset.*.is_real_estate":
    "Deed or the county assessment record. This flag removes the asset from the § 3102 computation entirely",
  "asset.*.payable_under_3101":
    "Confirm with the holder that the asset falls in one of the five § 3101 categories and is within its cap; § 3102 excludes such property from the $50,000",
};

export const PA_PACK = {
  id: "pa-probate",
  title: "Pennsylvania probate procedure",
  jurisdiction: { state: "PA" },
  version: `${RETRIEVED}.1`,
  rules: PA_RULES,
};

// ---------------------------------------------------------------------------
// NOTES — what could NOT be sourced, and is therefore absent above
// ---------------------------------------------------------------------------
//
// This list is deliberately explicit. A figure that is missing here is missing
// because no primary source for it was fetched, not because it does not exist.
//
// AUDIT, 2026-07-28. Every dollar amount, day count, month count, percentage
// and section number in this file was re-fetched from the primary source and
// compared against the verbatim text, independently of the notes above. Every
// numeric threshold held: § 3102's $50,000, § 3121's $3,500, § 3101's $10,000 /
// $20,000 / $10,000 / $11,000 / $20,000, the 60- and 30-day periods, the three
// successive weeks, the three months and 30 days of § 3301(c), the one- and
// five-year periods of §§ 3532 and 3133(c), the nine/six/three months and 5%
// of the inheritance tax, and the 0 / 4.5 / 12 / 15 per cent rate schedule.
// Each of the 25 URLs this file cites returns 200 and lands on the provision
// cited — none is a chapter index and none 404s.
//
// What did NOT hold was four `effectiveFrom` dates. Two were arithmetic-clean
// but cited the wrong provision of a multi-section rule (pa.will.probate,
// pa.real_estate.needs_its_own_road); one rested on evidence that does not
// exist (pa.admin.rule_10_5_notice — see item 4); one used an enactment date
// as an applicability date (pa.tax.inheritance — see item 6). All four are
// corrected above, with the convention that produced them stated in the
// "A NOTE ON EFFECTIVE DATES" block at the head of this file. No rule was
// removed, because no figure failed verification.
//
//  1. REGISTER OF WILLS FILING FEES — no figure of any kind.
//     Pennsylvania sets Register of Wills and Orphans' Court fees county by
//     county rather than statewide, and no statewide schedule was located on a
//     primary source. Every rule above therefore reports estCostUsd [0, 0] with
//     a NOT SOURCED note. Zero means unknown. California's pack can cite a $435
//     statewide filing fee; Pennsylvania has no equivalent number to cite, and
//     inventing a "typical $200–$500" range would be exactly the failure this
//     pack exists to avoid.
//
//  2. NO STATEWIDE § 3102 PETITION FORM. — CONFIRMED against the official index.
//     231 Pa. Code Ch. 8017A is the Supreme Court's own index of the forms
//     adopted under Pa.R.O.C.P. 1.8. Its Register of Wills list runs: Estate
//     Information Sheet, RW-02 Petition for Grant of Letters, RW-03 Oath of
//     Subscribing Witness(es), RW-04 Oath of Non-subscribing Witness(es),
//     RW-05 Oath of Witness(es) to Will Executed by Mark, RW-06 Renunciation,
//     RW-07, RW-08, RW-09 Inventory, RW-10 Rule 10.6 Status Report. It stops
//     there. None is a petition for settlement of a small estate under § 3102,
//     so the form entry on pa.personal.3102_small_estate is coded "—". Each
//     county's orphans' court supplies its own. The index is in PA_SOURCES.
//
//  3. ELAPSED-TIME ESTIMATES.
//     No sourced figure exists for how long anything actually takes in
//     Pennsylvania: not the interval from petition to § 3102 decree, not the
//     Register's turnaround on a petition for letters, not the duration of an
//     administration. Where a statute states a period it is used and labelled;
//     where it does not, timelineDays is [0, 0] with a NOT SOURCED note. The
//     one-year § 3532 window used for full administration is a statutory floor
//     on risk-free distribution, not a prediction of how long probate runs.
//
//  4. Pa. O.C. RULE 10.5 EFFECTIVE DATE — RESOLVED. Was previously wrong here.
//     An earlier draft of this pack carried effectiveFrom 2016-09-01, sourced
//     to an "eff. 09.01.16" designation said to be printed on the RW-07 and
//     RW-08 forms. That designation is not on those forms. Both PDFs were
//     re-read: RW-07 prints "Form RW-07 rev. 01.01.20" and RW-08 prints
//     "RW-08 rev. 01.01.20". The date had no source.
//
//     The real date is now taken from two primary sources that agree. The
//     Pennsylvania Code Source note for Rule 10.5 reads: "amended October 31,
//     2019, effective January 1, 2020, 49 Pa.B. 6804; amended January 12,
//     2022, effective April 1, 2022, 52 Pa.B. 684." The Supreme Court's order
//     itself, at 52 Pa.B. 684, states: "This Order shall be processed in
//     accordance with Pa.R.J.A. 103(b) and shall be effective on April 1,
//     2022." effectiveFrom is therefore 2022-04-01, and the rule's sourceUrl
//     now points at the consolidated Code text rather than at the redline,
//     which prints no date of its own. The Code site states it is current
//     through 56 Pa.B. 2488 (May 2, 2026), so nothing later supersedes it.
//
//  5. Pa. O.C. RULE 10.6 STATUS REPORT — RESOLVED. Text now retrieved.
//     Rule 10.6(a): "If administration of an estate has not been completed
//     within two years of the decedent's death, the personal representative or
//     counsel shall file at such time, and annually thereafter until the
//     administration is completed, a report with the Register …". That two-year
//     trigger is in PA_THRESHOLDS.statusReportYears and is now stated as an
//     obligation on pa.personal.full_administration, which already listed RW-10
//     among its forms without saying when it falls due.
//
//  6. INHERITANCE TAX APPLICABILITY — RESOLVED for the 2019 rate.
//     The rates are quoted verbatim from the act text and were already solid.
//     The open question was when the 0% parent-to-child-under-21 rate added by
//     Act 13 of 2019 begins to apply to decedents; an earlier draft used the
//     act date 2019-06-28 and disclaimed it. The source does print the answer,
//     as a compiler's note under § 2116: "Section 32 of Act 13 of 2019 provided
//     that the amendment or addition of section 2116(a)(1.4) and (2) of this
//     act shall apply to property transferred by a natural parent, an adoptive
//     parent or a stepparent who dies after December 31, 2019." effectiveFrom
//     is therefore 2020-01-01. The 2000 amendment to § 2116(a) carries its own
//     note too ("estates of decedents dying after June 30, 2000"), and the 0%
//     spousal rate its own date in the statutory text (January 1, 1995).
//     STILL NOT MODELLED: the pack exposes the rate table but does not select a
//     rate by date of death, so an estate of a decedent who died before 2020
//     would need the parent-to-minor-child transfer taxed at 4.5%, not 0%.
//     No rule above makes that distinction — it reports the current schedule.
//
//  7. REV-1500 TITLE — RESOLVED. Header read directly.
//     The PDF was re-fetched from the Department of Revenue's official pa.gov
//     path and extracted. Its printed header reads "REV-1500 … INHERITANCE TAX
//     RETURN RESIDENT DECEDENT", and "THIS RETURN MUST BE FILED IN DUPLICATE
//     WITH THE REGISTER OF WILLS". The form title used above matches.
//
//  7a. Pa. O.C. RULE 10.5(a)(6)(ii) $25,000 CHARITABLE THRESHOLD — sourced but
//     deliberately not modelled. Rule 10.5(a)(6) requires notice to the
//     Attorney General on behalf of a charitable beneficiary that is a
//     residuary beneficiary, "whose legacy exceeds $25,000", or whose interest
//     will not be paid in full. The figure is verbatim from the Code, but the
//     pack has no charitable-beneficiary fact to hang it on, so no rule asserts
//     it. It is recorded here so the omission is visible rather than silent.
//
//  8. WHAT ACT 35 OF 2013 CHANGED THE § 3102 CAP *FROM* is not stated here.
//     The source gives the current figure and the amendment history, not the
//     prior figure. No pre-2013 cap is asserted anywhere in this file.
//
//  9. COUNTY OVERLAYS — absent entirely.
//     The California pack generates filing fees and local overlays for all 58
//     counties. Pennsylvania has 67 counties and this pack has none of them:
//     every rule above is jurisdiction { state: "PA" } with no county. Local
//     orphans' court rules under Pa. O.C. Rule 1.5 were not retrieved.
