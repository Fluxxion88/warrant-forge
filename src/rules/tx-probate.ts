// Texas probate rule pack.
//
// Every dollar figure, day count and percentage below was read out of the
// Texas Estates Code, Local Government Code or Government Code on 2026-07-28
// and carries its citation inline. Where a figure could not be sourced it is
// absent and the gap is recorded in the NOTES block at the foot of this file.
//
// HOW THE SOURCE WAS ACTUALLY RETRIEVED. statutes.capitol.texas.gov is now a
// single-page app: every /Docs/... path returns the same Angular shell, so a
// naive fetch of the citation URL yields navigation chrome and no statute.
// The shell's bundle names its file server, and that server returns the real
// documents:
//
//     https://tcss.legis.texas.gov/resources/ES/htm/ES.205.htm
//
// `sourceUrl` below is the canonical statutes.capitol.texas.gov locator — the
// address a human should visit and cite. The text behind each quotation was
// fetched from the tcss.legis.texas.gov mirror of that same document. Saying
// which one was read is the point of a retrievedAt date.
//
// A caution for anyone re-checking these URLs with curl: on that host an HTTP
// 200 proves nothing. Every path under /Docs/ returns the identical 250,874-
// byte Angular shell, including chapters that do not exist — ES.999.htm
// answers 200 with the same bytes as ES.205.htm. The canonical locators were
// therefore checked in a real browser, where the shell routes client-side and
// does render the cited chapter. The site reports its own text as current
// through the 89th Legislature, 2nd Called Session, 2025; Texas sits in
// regular session only in odd-numbered years, so nothing has superseded this
// text as at the retrieval date.
//
// ---------------------------------------------------------------------------
// ADVERSARIAL RE-VERIFICATION, 2026-07-28
// ---------------------------------------------------------------------------
//
// Every dollar amount, day count, percentage and section number below was
// re-fetched from primary sources by a second reader and checked against the
// text rather than against this file's own summary. All twenty-two figures
// held: none was a remembered number, none was rounded, none had been carried
// over from the California pack. The $75,000 cap was additionally confirmed
// against the strike-through in the enrolled H.B. 2271 § 12 ("$75,000
// [$50,000]") and its § 46 applicability clause.
//
// Six defects were found and fixed, none of them a figure:
//
//   1. excl.114.tod_deed cited § 114.104(a), a provision about taking subject
//      to liens, for a proposition about passage of title. Now §§ 114.103
//      (a)(1) and 114.106(b), which say it.
//   2. Six rules claimed an `effectiveFrom` earlier than the most recent
//      amendment to a section they cite — the muniment rule predated a 2019
//      amendment to § 257.051, two independent-administration rules predated
//      a 2019 amendment to § 401.005, and two rules predated the 2025
//      amendments to § 309.051.
//   3. tx.admin.independent_by_will cited only § 401.001(a) while every one
//      of its obligations quoted a deadline from an unnamed section.
//   4. tx.admin.dependent asserted that §§ 401.002 and 401.003 are "both
//      expressly subject to § 401.001(b)". Only § 401.002 says so.
//   5. § 205.001's opening solvency condition was not modelled or mentioned
//      anywhere, though it gates the whole small estate route.
//   6. `fourthAnniversary` was documented as rolling 29 February to 1 March.
//      It does not, except across a non-leap century year.
//
// ---------------------------------------------------------------------------
// WHAT MAKES TEXAS DIFFERENT FROM CALIFORNIA
// ---------------------------------------------------------------------------
//
// A model that has learned California will get Texas wrong in four specific
// ways, and each of them is modelled here rather than glossed:
//
//   1. THE CHEAPEST ROUTE HAS NO DOLLAR CAP. Probate of a will as a muniment
//      of title (ch. 257) turns on debts, not value. § 257.001 asks only
//      whether the estate "does not owe an unpaid debt, other than any debt
//      secured by a lien on real estate", or whether there is otherwise no
//      necessity for administration. A $5,000,000 estate with a mortgage and
//      no other debt qualifies; a $60,000 estate with two credit-card
//      balances does not. Searching for "the Texas small estate limit" and
//      finding $75,000 therefore answers the wrong question most of the time.
//
//   2. THE SMALL ESTATE AFFIDAVIT IS INTESTATE-ONLY. § 205.001 opens "The
//      distributees of the estate of a decedent who dies intestate". A will
//      does not merely change the paperwork, it closes the route outright —
//      and § 205.008(a) confirms the chapter "does not affect the disposition
//      of property under a will". California's § 13100 affidavit has no such
//      restriction, so the instinct carried over from CA is wrong.
//
//   3. THE CAP IS MEASURED ON THE WRONG DATE. California keys its thresholds
//      to the date of death. Texas § 205.001(3) values "the estate assets on
//      the date of the affidavit". H.B. 2271 § 46 then says the amended
//      section "applies to a small estate administration commenced on or
//      after the effective date of this Act, regardless of the date of the
//      decedent's death". Both the valuation date and the version of the
//      statute run off the filing, not the death. An estate can therefore
//      cross the cap while nobody touches it, simply because the market moved.
//
//   4. FULL ADMINISTRATION IS USUALLY UNSUPERVISED. Independent administration
//      (ch. 401) is the ordinary Texas outcome, not an exception: the will can
//      direct it (§ 401.001(a)), or every distributee can agree to it
//      (§§ 401.002, 401.003). Court-supervised dependent administration is
//      what happens when the will forbids independence (§ 401.001(b)) or the
//      distributees cannot all agree. Modelling "formal probate" as one thing,
//      as the California pack reasonably does, would erase the difference
//      between a cheap Texas administration and an expensive one.
//
// Note also what is NOT here: Texas has no four-year deadline on a small
// estate affidavit. Chapter 205 contains no limitations period at all, while
// §§ 256.003(a), 257.054(2) and 301.002(a) each bar their route at the fourth
// anniversary of death. So the passage of four years narrows an intestate
// family to the affidavit and to heirship, and that asymmetry is a rule below
// rather than a footnote.

import { derived, ledger, type Fact } from "../lib/facts";
import type { ExclusionRule } from "../lib/derive";
import { daysBetween } from "../lib/derive";
import type { Rule } from "../lib/rules";

/** Canonical public locator for an Estates Code chapter. */
const ES = (chapter: string) => `https://statutes.capitol.texas.gov/Docs/ES/htm/ES.${chapter}.htm`;
/** Local Government Code — filing fees. */
const LG = (chapter: string) => `https://statutes.capitol.texas.gov/Docs/LG/htm/LG.${chapter}.htm`;
/** Government Code — the form-promulgation mandate. */
const GV = (chapter: string) => `https://statutes.capitol.texas.gov/Docs/GV/htm/GV.${chapter}.htm`;
/** H.B. 2271, 85th Leg. R.S. (2017) — the bill that set the current cap. */
const HB2271 = "https://capitol.texas.gov/tlodocs/85R/billtext/html/HB02271F.htm";

const RETRIEVED = "2026-07-28";

/**
 * Every primary source read to build this pack, so a reviewer can re-fetch the
 * lot without unpicking URLs from individual rules.
 *
 * These are the canonical citation addresses. Because
 * statutes.capitol.texas.gov is a single-page app, fetching one of the
 * Estates Code entries programmatically returns the Angular shell rather than
 * the statute; substitute the host `tcss.legis.texas.gov/resources` for
 * `statutes.capitol.texas.gov/Docs` and the same path returns the document.
 */
export const TX_SOURCES: Record<string, string> = {
  "Tex. Est. Code ch. 111 — nontestamentary transfers": ES("111"),
  "Tex. Est. Code ch. 114 — transfer on death deed": ES("114"),
  "Tex. Est. Code ch. 202 — proceeding to declare heirship": ES("202"),
  "Tex. Est. Code ch. 205 — small estate affidavit": ES("205"),
  "Tex. Est. Code ch. 256 — probate of wills generally": ES("256"),
  "Tex. Est. Code ch. 257 — probate of will as muniment of title": ES("257"),
  "Tex. Est. Code ch. 301 — application for letters": ES("301"),
  "Tex. Est. Code ch. 306 — granting of letters": ES("306"),
  "Tex. Est. Code ch. 308 — notice to beneficiaries and creditors": ES("308"),
  "Tex. Est. Code ch. 309 — inventory, appraisement and list of claims": ES("309"),
  "Tex. Est. Code ch. 352 — compensation of the representative": ES("352"),
  "Tex. Est. Code ch. 353 — exempt property and family allowance": ES("353"),
  "Tex. Est. Code ch. 355 — presentment and payment of claims": ES("355"),
  "Tex. Est. Code ch. 401 — creation of independent administration": ES("401"),
  "Tex. Est. Code ch. 451 — order of no administration": ES("451"),
  "Tex. Loc. Gov't Code ch. 118 — county clerk fees": LG("118"),
  "Tex. Loc. Gov't Code ch. 133 — state consolidated civil fee": LG("133"),
  "Tex. Loc. Gov't Code ch. 135 — local consolidated civil fee": LG("135"),
  "Tex. Gov't Code ch. 22 — promulgation of probate forms": GV("22"),
  "H.B. 2271, 85th Leg., R.S. (2017) — enrolled text, § 12 and § 46": HB2271,
};

/**
 * Cited figures. Each field carries the provision it came from.
 *
 * Unlike California, none of these is indexed or periodically adjusted: there
 * is no Texas analogue of Prob. Code § 890, so a figure changes only when the
 * Legislature amends it. `smallEstateAffidavit` last moved in 2017 and has
 * survived the 2019, 2021, 2023 and 2025 sessions unamended — the chapter text
 * retrieved on 2026-07-28 shows amendments through the 89th Legislature in
 * sibling sections but none to § 205.001 since H.B. 2271.
 */
export const TX_THRESHOLDS = {
  /**
   * Tex. Est. Code § 205.001(3): "the value of the estate assets on the date
   * of the affidavit described by Subdivision (4), excluding homestead and
   * exempt property, does not exceed $75,000". Raised from $50,000 by
   * Acts 2017, 85th Leg., R.S., Ch. 844 (H.B. 2271), § 12.
   */
  smallEstateAffidavit: 75_000,

  /**
   * Tex. Est. Code § 205.001(1): "30 days have elapsed since the date of the
   * decedent's death".
   */
  smallEstateWaitingDays: 30,

  /**
   * Muniment of title has NO dollar cap, and `null` here is an assertion, not
   * a hole. Chapter 257 was read in full on 2026-07-28 and contains no
   * monetary limit in any section; § 257.001 conditions the route on debts and
   * necessity alone. Recording the absence explicitly stops a later reader —
   * human or model — from "filling in" a number by analogy to another state.
   */
  munimentOfTitleCapUsd: null,

  /**
   * Tex. Est. Code § 256.003(a): a will "may not be admitted to probate after
   * the fourth anniversary of the testator's death unless it is shown by proof
   * that the applicant ... was not in default". Same period at § 257.054(2)
   * (muniment) and § 301.002(a) (letters testamentary or of administration).
   */
  probateDeadlineYears: 4,

  /**
   * Tex. Est. Code § 257.103(a): "not later than the 180th day after the date
   * a will is admitted to probate as a muniment of title, the applicant ...
   * shall file with the court clerk a sworn affidavit". Waivable and
   * extendable by the court under § 257.103(b).
   */
  munimentComplianceAffidavitDays: 180,

  /**
   * Tex. Est. Code § 309.051(a): "before the 91st day after the date the
   * personal representative qualifies". § 309.056(b) calls this "the 90-day
   * period prescribed by Section 309.051(a)", which is the statute's own
   * characterisation of its own deadline — hence 90 rather than 91.
   */
  inventoryDueDays: 90,

  /**
   * Tex. Est. Code § 306.001(a): "Before the 21st day after the date a will
   * has been probated, the court shall grant letters testamentary".
   */
  lettersTestamentaryDays: 21,

  /**
   * Tex. Est. Code § 308.002(a): "not later than the 60th day after the date
   * of an order admitting a decedent's will to probate", notice to each
   * beneficiary named in the will.
   */
  noticeToBeneficiariesDays: 60,

  /**
   * Tex. Est. Code § 308.051(a): "Within one month after receiving letters
   * testamentary or of administration", published notice to creditors. The
   * statute says a month, not a day count, and is left in its own units.
   */
  noticeToCreditorsMonths: 1,

  /**
   * Tex. Est. Code § 308.053(a): "Within two months after receiving letters
   * testamentary or of administration", notice to each known secured creditor.
   */
  noticeToSecuredCreditorsMonths: 2,

  /**
   * Tex. Est. Code § 355.060: where permissive notice under § 308.054 is
   * given, an unsecured claim "not presented before the 121st day after the
   * date of receipt of the notice" is barred. § 308.054(b)(1) requires the
   * notice to state that period expressly.
   */
  unsecuredClaimBarDays: 121,

  /**
   * Tex. Est. Code § 355.064(a): a rejected claim "is barred unless not later
   * than the 90th day after the date of rejection the claimant commences
   * suit".
   */
  rejectedClaimSuitDays: 90,

  /**
   * Tex. Loc. Gov't Code § 133.151(a)(1): "a fee in the amount of $137 on the
   * filing of any civil, probate, guardianship, or mental health case".
   * Amended to this figure by Acts 2023, 88th Leg., R.S., Ch. 256 (S.B. 1612),
   * § 19, eff. January 1, 2024.
   */
  stateFilingFeeUsd: 137,

  /**
   * Tex. Loc. Gov't Code § 135.102(a)(1): "$223 on filing any probate,
   * guardianship, or mental health case", payable "in addition to all other
   * fees and court costs". Amended to this figure by Acts 2023, 88th Leg.,
   * R.S., Ch. 256 (S.B. 1612), § 24, eff. January 1, 2024.
   */
  localProbateFilingFeeUsd: 223,

  /**
   * ARITHMETIC, NOT A QUOTED FIGURE. $137 + $223. No statute states $360; it
   * is the sum of the two cited statewide components, and it is a floor rather
   * than a price — see the NOTES block on county clerk fees.
   */
  statutoryFilingFeeFloorUsd: 360,

  /**
   * Tex. Est. Code § 352.002(a): an executor or administrator "is entitled to
   * receive a five percent commission on all amounts that the executor or
   * administrator actually receives or pays out in cash", capped by
   * § 352.002(b)(1) at "five percent of the gross fair market value of the
   * estate subject to administration".
   */
  representativeCommissionPercent: 5,

  /**
   * Tex. Est. Code § 308.002(c)(2) and § 309.056(b-1)(1): a beneficiary
   * entitled to aggregate gifts "with an estimated value of $2,000 or less"
   * need not be given notice, and need not be sent the inventory.
   */
  beneficiaryNoticeDeMinimisUsd: 2_000,

  /**
   * Tex. Est. Code § 205.001(3) measures value "on the date of the affidavit",
   * not the date of death. Carried as data because it is the single most
   * likely thing to be assumed wrong by analogy to California.
   */
  smallEstateValuationDate: "affidavit_date",

  /**
   * The $75,000 cap took effect 1 September 2017, and H.B. 2271 § 46 applies
   * it "to a small estate administration commenced on or after the effective
   * date of this Act, regardless of the date of the decedent's death". So the
   * pack keys the cap to the filing, not to the death — the opposite of the
   * California rule.
   */
  effectiveFrom: "2017-09-01",
  capKeyedTo: "date_administration_commenced",
} as const;

/**
 * Property outside the § 205.001 computation. Expressed as data so a new
 * exclusion is an edit, not a deploy — same contract as CA_EXCLUSIONS.
 *
 * The first two are named by § 205.001 itself. The second two are not
 * exclusions from a sum so much as assets that never enter the estate; they
 * are listed here because the arithmetic has to reach the same answer either
 * way, and because an executor asking "does the 401(k) count?" deserves the
 * provision rather than a shrug.
 */
export const TX_EXCLUSIONS: ExclusionRule[] = [
  {
    id: "excl.205.homestead",
    flag: "homestead",
    label: "Homestead — excluded from the § 205.001 value by the statute itself",
    citation: "Tex. Est. Code §§ 205.001(3), 205.009",
    sourceUrl: ES("205"),
  },
  {
    id: "excl.205.exempt_property",
    flag: "exempt_property",
    label: "Exempt property that could be set aside under § 353.051",
    citation:
      "Tex. Est. Code §§ 205.001(3), 205.009, 353.051(a)(2); Tex. Prop. Code § 42.002(a)",
    sourceUrl: ES("205"),
  },
  {
    id: "excl.111.nontestamentary",
    flag: "has_named_beneficiary",
    label: "Passes by beneficiary designation — nontestamentary, never an estate asset",
    citation: "Tex. Est. Code § 111.052(a)(1), (b)",
    sourceUrl: ES("111"),
  },
  {
    id: "excl.114.tod_deed",
    flag: "transfer_on_death_deed",
    // CITATION CORRECTED 2026-07-28 on review. This previously cited
    // § 114.104(a), which does not say what was claimed: that subsection is
    // headed "TRANSFER ON DEATH DEED PROPERTY SUBJECT TO LIENS AND
    // ENCUMBRANCES AT TRANSFEROR'S DEATH" and says only that "a beneficiary
    // takes the real property subject to all conveyances, encumbrances ...
    // and other interests to which the real property is subject at the
    // transferor's death". It is a burdens provision, not a passage-of-title
    // one. The provisions that actually support the exclusion are
    // § 114.103(a)(1) — on the transferor's death "the interest in the real
    // property is transferred to the designated beneficiary in accordance
    // with the deed" — and § 114.106(b), which states the property "is not
    // considered property of the probate estate for any purpose".
    //
    // Out of the § 205.001 count is not the same as out of reach: § 114.106(a)
    // lets a personal representative enforce estate liabilities against
    // transfer-on-death property to the extent the estate is insufficient.
    // The exclusion is from the threshold arithmetic only.
    label: "Real property passing under a transfer on death deed",
    citation: "Tex. Est. Code §§ 114.103(a)(1), 114.106(b)",
    sourceUrl: ES("114"),
  },
];

// ---------------------------------------------------------------------------
// Texas-specific derivation
// ---------------------------------------------------------------------------

/**
 * The fourth anniversary of a date, as a calendar date rather than 1,461 days.
 *
 * §§ 256.003(a), 257.054(2) and 301.002(a) all speak of "the fourth
 * anniversary", so day arithmetic would be wrong across leap years.
 *
 * CORRECTED on review 2026-07-28. This comment previously said a 29 February
 * death "rolls to 1 March". It almost never does, and saying so misdescribed
 * the code: a four-year step from 29 February lands on another leap year in
 * every case except across a skipped century leap year, so 2024-02-29 yields
 * 2028-02-29, not 2028-03-01 — which is what the tests have always asserted.
 * The roll happens only at a century boundary that is not a leap year:
 * 2096-02-29 yields 2100-03-01, because 2100 is not a leap year. That single
 * case is the modelling choice, and it is the Date constructor's overflow
 * behaviour rather than anything the Estates Code resolves on its face.
 */
export function fourthAnniversary(dateIso: string): string | undefined {
  const t = Date.parse(dateIso);
  if (Number.isNaN(t)) return undefined;
  const d = new Date(t);
  const rolled = new Date(Date.UTC(d.getUTCFullYear() + 4, d.getUTCMonth(), d.getUTCDate()));
  return rolled.toISOString().slice(0, 10);
}

/**
 * Compute the Texas-specific derived facts.
 *
 * No model participates. Each derived fact records the inputs it consumed and
 * the statute that says the computation is the right one to perform.
 */
export function deriveTxFacts(facts: Fact[], asOfIso: string, now = 0): Fact[] {
  const current = ledger(facts);
  const out: Fact[] = [];

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
          authority: { citation: "Tex. Est. Code § 205.001(1)", sourceUrl: ES("205") },
          note: "A small estate affidavit may not be used until 30 days have elapsed since death.",
        },
        { now },
      ),
    );

    const anniversary = fourthAnniversary(dod.value);
    if (anniversary) {
      const within = asOfIso.slice(0, 10) <= anniversary;
      out.push(
        derived(
          {
            key: "estate.within_four_years_of_death",
            label: "Still within four years of death",
            value: within,
            formula: `${asOfIso.slice(0, 10)} ≤ fourth anniversary ${anniversary}`,
            inputs: ["decedent.date_of_death"],
            authority: {
              citation: "Tex. Est. Code §§ 256.003(a), 257.054(2), 301.002(a)",
              sourceUrl: ES("256"),
            },
            note: within
              ? "A will may still be admitted to probate and letters may still issue."
              : "Past the fourth anniversary: probate of the will and letters are both barred absent proof the applicant was not in default. Chapter 205 and Chapter 202 carry no such deadline.",
          },
          { now },
        ),
      );
    }
  }

  // § 205.001(3)'s value. Two things about this sum are Texas-specific and
  // both are recorded on the fact: homestead and exempt property come out, and
  // the valuation date is the affidavit's, not the death's.
  const total = chapter205Total(current);
  if (total.counted > 0) {
    out.push(
      derived(
        {
          key: "estate.chapter_205_value",
          label: "Estate assets for § 205.001, excluding homestead and exempt property",
          value: total.total,
          unit: "USD",
          asOf: asOfIso,
          formula: total.formula,
          inputs: total.inputs,
          authority: {
            citation: "Tex. Est. Code §§ 205.001(3), 205.009",
            sourceUrl: ES("205"),
          },
          note:
            "Valued as at the date of the affidavit, not the date of death — § 205.001(3) reads \"the value of the estate assets on the date of the affidavit\". Homestead and exempt property are excluded, and by § 205.009 those words mean only property that could be set aside under § 353.051.",
        },
        { now },
      ),
    );
  }

  return out;
}

function chapter205Total(current: Map<string, Fact>) {
  const inputs: string[] = [];
  const parts: string[] = [];
  let total = 0;
  let counted = 0;

  const excludedFlags = new Set(TX_EXCLUSIONS.map((e) => e.flag));

  for (const [key, fact] of current) {
    const m = /^asset\.([^.]+)\.value$/.exec(key);
    if (!m || typeof fact.value !== "number") continue;
    counted += 1;
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
    counted,
    inputs: inputs.sort(),
    formula: parts.length ? parts.join(" + ") : "no includable estate assets",
  };
}

// ---------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------

/**
 * `effectiveFrom` is the effective date of the MOST RECENT amendment to any
 * provision named in `citation` — not the date the oldest of them was enacted.
 *
 * Five rules failed that test on review and were corrected on 2026-07-28; each
 * carries the amendment that moved it inline. Getting this backwards is a
 * quiet failure: a rule that claims to state the law as of 2015 while quoting
 * a section rewritten in 2025 gives a reader no way to tell whether the
 * quotation was checked against the current text or a stale one.
 */
const authority = (citation: string, sourceUrl: string, effectiveFrom: string) => ({
  citation,
  sourceUrl,
  effectiveFrom,
  retrievedAt: RETRIEVED,
});

/**
 * Texas prescribes no numbered statewide probate forms.
 *
 * Tex. Gov't Code § 22.020(b)(1) directs the Supreme Court of Texas to
 * promulgate forms "for use in: (A) a small estate affidavit proceeding under
 * Chapter 205, Estates Code; and (B) the probate of a will as a muniment of
 * title under Chapter 257, Estates Code", and § 22.020(g) obliges a probate
 * court to accept any form so promulgated. But the mandate is qualified — "as
 * the court considers appropriate" — and no promulgated form bearing a stable
 * identifier could be located from a primary source on 2026-07-28. Every
 * instrument below therefore carries code "—", the same convention the
 * California pack uses for the § 13101 affidavit, with the statute that
 * defines its contents named in the title.
 *
 * Inventing a form number here would be precisely the failure this pack
 * exists to avoid, and it would be a worse failure than an inflated dollar
 * cap: a wrong number invites argument, whereas a plausible-looking form code
 * gets typed into a caption and filed.
 */
const NO_STATEWIDE_FORM = "no statewide form number — Tex. Gov't Code § 22.020";

export const TX_RULES: Rule[] = [
  // --- Which road the estate walks down ------------------------------------
  {
    id: "tx.route.four_year_bar",
    decisionPoint: "probate_route",
    jurisdiction: { state: "TX" },
    title: "Four years have elapsed — the will and letters are both barred",
    requires: ["estate.within_four_years_of_death"],
    when: { fact: "estate.within_four_years_of_death", op: "==", value: false },
    then: {
      conclusion:
        "Past the fourth anniversary of death the will cannot be admitted to probate and letters cannot issue, unless the applicant proves they were not in default in failing to apply sooner. A proceeding to declare heirship remains available with no deadline, and an intestate estate within the § 205.001 cap can still proceed by affidavit — Chapter 205 contains no limitations period.",
      forms: [
        { code: "—", title: `Application to Declare Heirship under Tex. Est. Code § 202.005 (${NO_STATEWIDE_FORM})` },
      ],
      obligations: [
        "Plead and prove the applicant was not in default in failing to present the will within four years — Tex. Est. Code § 256.003(a)",
        "Note that even a will admitted after four years yields no letters testamentary unless the application itself was filed within four years — § 256.003(b)",
        "A purchaser for value from the heirs after the fourth anniversary, without knowledge of the will, takes good title against a later-probated devisee — § 256.003(c)",
      ],
      timelineDays: [60, 365],
      estCostUsd: [360, 12_000],
    },
    estimates: {
      timelineDays:
        "Practice estimate. No statutory period governs how quickly a court sets or hears a heirship proceeding.",
      estCostUsd:
        "Lower bound is the cited $360 statewide statutory filing floor ($137 + $223). Upper bound is a practice estimate and includes the attorney ad litem a heirship proceeding requires.",
    },
    authority: authority(
      "Tex. Est. Code §§ 256.003, 301.002(a), 202.0025, 202.005",
      ES("256"),
      "2017-09-01",
    ),
    // Outranks full administration, which is foreclosed here, but deliberately
    // sits below the small estate affidavit: Chapter 205 has no deadline, so a
    // qualifying intestate family is not caught by this bar at all.
    priority: 90,
    blastRadius: "high",
    reversibility: "irreversible",
    notes:
      "§ 202.0025 is explicit that a heirship proceeding \"may be brought at any time after the decedent's death\", notwithstanding the residual four-year limitations statute in Civ. Prac. & Rem. Code § 16.051.",
  },
  {
    id: "tx.route.257_muniment_of_title",
    decisionPoint: "probate_route",
    jurisdiction: { state: "TX" },
    title: "Probate the will as a muniment of title",
    requires: [
      "decedent.died_testate",
      "estate.has_unpaid_debt_other_than_real_estate_lien",
      "estate.within_four_years_of_death",
    ],
    when: {
      all: [
        { fact: "decedent.died_testate", op: "==", value: true },
        { fact: "estate.has_unpaid_debt_other_than_real_estate_lien", op: "==", value: false },
        { fact: "estate.within_four_years_of_death", op: "==", value: true },
      ],
    },
    then: {
      conclusion:
        "Admit the will to probate as a muniment of title. No personal representative is appointed, no letters issue, no inventory is filed and no administration is opened. The order itself is the authority to transfer: § 257.102(a) makes it \"sufficient legal authority\" for every bank, registrar and transfer agent holding estate property. There is no dollar limit on this route.",
      forms: [
        {
          code: "—",
          title: `Application for Probate of Will as Muniment of Title, contents fixed by Tex. Est. Code § 257.051 (${NO_STATEWIDE_FORM})`,
        },
        { code: "—", title: "Order Admitting Will to Probate as Muniment of Title" },
        {
          code: "—",
          title: "Affidavit of fulfilment of the terms of the will, Tex. Est. Code § 257.103",
        },
      ],
      obligations: [
        "File before the fourth anniversary of the testator's death — Tex. Est. Code § 257.054(2)",
        "Prove the estate owes no unpaid debt other than debt secured by a lien on real estate, or that no administration is otherwise necessary — § 257.054(5)",
        "File the original will with the application if it is in the applicant's control; it stays in the clerk's custody — § 257.052",
        "Have citation served and returned for the period this title requires before the hearing — § 257.054(4)",
        "Prove the testator did not revoke the will — § 257.054(6)",
        "File a sworn affidavit stating which terms of the will have and have not been fulfilled not later than the 180th day after the will is admitted — § 257.103(a); the court may waive or extend this under § 257.103(b), and failure to file does not affect title under § 257.103(c)",
      ],
      timelineDays: [30, 120],
      estCostUsd: [360, 3_500],
    },
    estimates: {
      timelineDays:
        "Practice estimate. The only statutory clock on this route runs after the order, not before it — § 257.103's 180 days.",
      estCostUsd:
        "Lower bound is the cited $360 statewide statutory filing floor. Upper bound is a practice estimate for attorney's fees and does not include any county clerk fee.",
    },
    authority: authority(
      "Tex. Est. Code §§ 257.001, 257.051, 257.052, 257.054, 257.102, 257.103",
      ES("257"),
      // CORRECTED on review: was 2017-09-01, but § 257.051 was amended by
      // Acts 2019, 86th Leg., R.S., Ch. 1141 (H.B. 2782), § 15, eff.
      // 1 September 2019 — the same act that added §§ 257.151 and 257.152,
      // both relied on in the notes below.
      "2019-09-01",
    ),
    // The cheapest route Texas offers, and the one most often missed. It
    // outranks everything except the four-year bar, which its own `when`
    // already excludes.
    priority: 140,
    blastRadius: "high",
    reversibility: "costly",
    notes:
      "NO DOLLAR CAP — Chapter 257 was read in full and contains none. Eligibility turns on § 257.001: no unpaid debt other than debt secured by a lien on real estate, or no necessity for administration. A mortgage does not disqualify; an unpaid credit-card balance does. § 257.151 preserves the right to open an administration later if an application is filed within four years of death or administration becomes necessary under § 301.002(b).",
  },
  {
    id: "tx.route.205_small_estate_affidavit",
    decisionPoint: "probate_route",
    jurisdiction: { state: "TX" },
    title: "Small estate affidavit",
    requires: [
      "decedent.died_testate",
      "estate.chapter_205_value",
      "estate.days_since_death",
      "estate.pr_petition_pending_or_granted",
    ],
    when: {
      all: [
        // Intestate only. § 205.001 opens "a decedent who dies intestate", and
        // § 205.008(a) confirms the chapter does not touch a will. This is the
        // clause that makes a will change the route in Texas.
        { fact: "decedent.died_testate", op: "==", value: false },
        { fact: "estate.chapter_205_value", op: "<=", value: TX_THRESHOLDS.smallEstateAffidavit },
        { fact: "estate.days_since_death", op: ">=", value: TX_THRESHOLDS.smallEstateWaitingDays },
        { fact: "estate.pr_petition_pending_or_granted", op: "==", value: false },
      ],
    },
    then: {
      conclusion:
        "File a small estate affidavit with the clerk of the court that has jurisdiction and venue. Once the judge approves it, a clerk-certified copy compels each holder of estate property to pay or transfer without any administration.",
      forms: [
        {
          code: "—",
          title: `Small Estate Affidavit, contents fixed by Tex. Est. Code § 205.002 (${NO_STATEWIDE_FORM})`,
        },
        { code: "—", title: "Order Approving Small Estate Affidavit, Tex. Est. Code § 205.003" },
      ],
      obligations: [
        // ADDED on review 2026-07-28. The pack modelled all six numbered
        // conditions of § 205.001 but silently dropped the solvency test in
        // its opening sentence, which is a condition on the whole route and
        // not a numbered subdivision. An insolvent estate under the cap does
        // not qualify, and nothing here said so.
        "Confirm the estate is solvent on the statutory measure: § 205.001 grants the route only \"to the extent the estate assets, excluding homestead and exempt property, exceed the known liabilities of the estate, excluding any liabilities secured by homestead and exempt property\"",
        "Wait 30 days from the date of death — Tex. Est. Code § 205.001(1)",
        "Value the estate assets as at the DATE OF THE AFFIDAVIT, not the date of death — § 205.001(3)",
        "Confirm no petition for appointment of a personal representative is pending or has been granted — § 205.001(2)",
        "Have the affidavit sworn to by two disinterested witnesses and by every distributee with legal capacity — § 205.002(a)(1)",
        "State the family history facts showing each distributee's right to inherit — § 205.002(a)(3)(C)",
        "Indicate on the asset list which assets are claimed to be exempt — § 205.002(b)",
        "Obtain the judge's approval; the affidavit has no effect without it — §§ 205.001(5), 205.003",
        "Deliver a clerk-certified copy to each person who owes money to the estate, holds estate property, or acts as registrar or transfer agent — § 205.004",
      ],
      timelineDays: [30, 90],
      estCostUsd: [360, 1_500],
    },
    estimates: {
      timelineDays:
        "Lower bound is the cited 30-day statutory wait. Upper bound is a practice estimate — no statute governs how quickly a judge examines the affidavit under § 205.003.",
      estCostUsd:
        "Lower bound is the cited $360 statewide statutory filing floor. Upper bound is a practice estimate.",
    },
    authority: authority(
      "Tex. Est. Code §§ 205.001–205.009; Acts 2017, 85th Leg., R.S., Ch. 844 (H.B. 2271), § 12",
      ES("205"),
      "2017-09-01",
    ),
    priority: 130,
    blastRadius: "medium",
    reversibility: "costly",
    notes:
      "Cap is $75,000 excluding homestead and exempt property, measured on the affidavit date. SOLVENCY: the cap is not the only quantitative test — § 205.001's opening sentence also requires that the estate assets, net of homestead and exempt property, exceed the known liabilities measured the same way. That condition is carried as an obligation rather than a `when` clause because the pack holds no liabilities facts to evaluate it against; it is stated so it cannot be missed, not computed. REAL PROPERTY: § 205.008(b) says the chapter does not transfer title to real property, with one exception — § 205.006(a) allows the homestead to pass by affidavit, but only \"if a decedent's homestead is the only real property in the decedent's estate\", and the affidavit must then be recorded in the deed records. A second parcel closes that door. By H.B. 2271 § 46 the cap applies to any administration commenced on or after 1 September 2017 regardless of when the decedent died.",
  },
  {
    id: "tx.route.451_no_administration",
    decisionPoint: "probate_route",
    jurisdiction: { state: "TX" },
    title: "Order of no administration (family allowance exhausts the estate)",
    requires: ["estate.exceeds_family_allowance", "decedent.has_family_allowance_claimant"],
    when: {
      all: [
        { fact: "estate.exceeds_family_allowance", op: "==", value: false },
        { fact: "decedent.has_family_allowance_claimant", op: "==", value: true },
      ],
    },
    then: {
      conclusion:
        "Apply for a family allowance and an order that no administration is necessary. If the allowance exhausts the estate the court assigns the whole of it to the surviving spouse, minor children and adult incapacitated children, and orders that there be no administration. The order is itself sufficient authority to pay or transfer.",
      forms: [
        {
          code: "—",
          title: `Application for Family Allowance and Order of No Administration, contents fixed by Tex. Est. Code § 451.001(c) (${NO_STATEWIDE_FORM})`,
        },
        { code: "—", title: "Order of No Administration, Tex. Est. Code § 451.002(b)" },
      ],
      obligations: [
        "Show the expenses of last illness, funeral charges and the expenses of the proceeding have been paid or secured — Tex. Est. Code § 451.002(b)",
        "List the heirs or devisees, the known creditors and their claim amounts, and all estate property with estimated values and encumbrances — § 451.001(c)",
        "Be aware the order can be revoked on application by any interested person for one year — § 451.004(a)",
      ],
      timelineDays: [14, 90],
      estCostUsd: [360, 2_500],
    },
    estimates: {
      timelineDays:
        "Practice estimate. § 451.002(a) lets the court hear the application \"promptly without notice\", so this can be fast, but no statute requires it to be.",
      estCostUsd: "Lower bound is the cited $360 statewide statutory filing floor. Upper bound is a practice estimate.",
    },
    authority: authority("Tex. Est. Code §§ 451.001–451.004, 353.101", ES("451"), "2014-01-01"),
    priority: 135,
    blastRadius: "medium",
    reversibility: "reversible",
    notes:
      "THIS ROUTE'S CAP CANNOT BE STATED AS A NUMBER. § 451.001(a) compares the estate, excluding homestead and exempt property, to \"the amount to which the surviving spouse, minor children, and adult incapacitated children ... are entitled as a family allowance\", and § 353.101(b)(1) defines that as \"the amount necessary for the maintenance\" of those persons \"for one year after the date of the decedent's death\". The court fixes it case by case. The engine therefore takes the comparison as an input fact rather than computing it, because computing it would require inventing the figure.",
  },
  {
    id: "tx.route.full_administration",
    decisionPoint: "probate_route",
    jurisdiction: { state: "TX" },
    title: "Full administration required",
    requires: [
      "decedent.died_testate",
      "estate.chapter_205_value",
      "estate.has_unpaid_debt_other_than_real_estate_lien",
    ],
    when: {
      any: [
        {
          all: [
            { fact: "decedent.died_testate", op: "==", value: false },
            {
              fact: "estate.chapter_205_value",
              op: ">",
              value: TX_THRESHOLDS.smallEstateAffidavit,
            },
          ],
        },
        {
          all: [
            { fact: "decedent.died_testate", op: "==", value: true },
            { fact: "estate.has_unpaid_debt_other_than_real_estate_lien", op: "==", value: true },
          ],
        },
      ],
    },
    then: {
      conclusion:
        "Open an administration: apply for letters testamentary or of administration, qualify a personal representative, and settle the estate. Whether the court supervises that administration is a separate question — see the administration_supervision decision point, where independent administration under Chapter 401 is the ordinary Texas answer.",
      forms: [
        {
          code: "—",
          title: `Application for Probate of Will and Issuance of Letters Testamentary, contents fixed by Tex. Est. Code § 256.052 (${NO_STATEWIDE_FORM})`,
        },
        {
          code: "—",
          title: `Application for Letters of Administration, contents fixed by Tex. Est. Code § 301.052 (${NO_STATEWIDE_FORM})`,
        },
        { code: "—", title: "Order Admitting Will to Probate and Authorizing Letters" },
        { code: "—", title: "Oath of Executor or Administrator" },
        {
          code: "—",
          title: "Inventory, Appraisement and List of Claims, Tex. Est. Code §§ 309.051, 309.052",
        },
        {
          code: "—",
          title: "Affidavit in Lieu of Inventory, Appraisement and List of Claims, Tex. Est. Code § 309.056",
        },
      ],
      obligations: [
        "File the application not later than the fourth anniversary of the decedent's death — Tex. Est. Code § 301.002(a)",
        "Establish that a necessity for administration exists; the court may not grant one otherwise — § 306.002(b), with the statutory instances at § 306.002(c)",
        "Publish notice to creditors in a newspaper of general circulation within one month after receiving letters — § 308.051(a)",
        "Give notice to each known secured creditor within two months after receiving letters — § 308.053(a)",
        "Where the decedent left a will, notify each beneficiary named in it not later than the 60th day after the order admitting the will — § 308.002(a); no notice is owed to a beneficiary taking $2,000 or less — § 308.002(c)(2)",
        "File the inventory, appraisement and list of claims before the 91st day after the representative qualifies — § 309.051(a)",
        "Set aside the homestead and exempt property once the inventory is approved — § 353.051(a)",
      ],
      timelineDays: [180, 540],
      estCostUsd: [360, 25_000],
    },
    estimates: {
      timelineDays:
        "Practice estimate. The statutory clocks (§ 306.001's 21 days, § 309.051's 90 days) bound individual steps, not the elapsed life of an administration.",
      estCostUsd:
        "Lower bound is the cited $360 statewide statutory filing floor. Upper bound is a practice estimate for attorney's fees; the representative's own commission is separately capped by the cited § 352.002 five percent.",
    },
    authority: authority(
      "Tex. Est. Code §§ 301.002, 301.052, 306.001, 306.002, 308.002, 308.051, 308.053, 309.051",
      ES("301"),
      // CORRECTED on review: was 2015-09-01. § 308.002 was amended by Acts
      // 2023, 88th Leg., R.S., Ch. 205 (S.B. 1373), § 28, eff. 1 September
      // 2023, and § 309.051 twice in 2025 — Acts 2025, 89th Leg., R.S.,
      // Ch. 438 (H.B. 3421), § 4 and Ch. 831 (S.B. 1448), § 5, both eff.
      // 1 September 2025. Neither 2025 act touched the 91st-day deadline;
      // both enrolled bills set out § 309.051(a) reading "before the 91st
      // day" (see NOTES 7).
      "2025-09-01",
    ),
    priority: 50,
    blastRadius: "high",
    reversibility: "irreversible",
    notes:
      "The representative is entitled to a five percent commission on cash received and paid out, capped in the aggregate at five percent of the gross fair market value of the estate subject to administration, and not allowed on funds already on deposit at death, life insurance proceeds, or cash paid to an heir as an heir — § 352.002.",
  },

  // --- Whether a court watches over that administration --------------------
  {
    id: "tx.admin.independent_by_will",
    decisionPoint: "administration_supervision",
    jurisdiction: { state: "TX" },
    title: "Independent administration directed by the will",
    requires: ["decedent.died_testate", "decedent.will_directs_independent_administration"],
    when: {
      all: [
        { fact: "decedent.died_testate", op: "==", value: true },
        { fact: "decedent.will_directs_independent_administration", op: "==", value: true },
      ],
    },
    then: {
      conclusion:
        "Independent administration. The will provides that no action shall be had in the probate court beyond probating and recording the will and returning the inventory, appraisement and list of claims. The executor then acts without court orders — no permission to sell, no annual accountings, no court approval of distributions.",
      forms: [
        { code: "—", title: "Application for Probate of Will and Issuance of Letters Testamentary" },
        { code: "—", title: "Order Admitting Will to Probate and Authorizing Letters Testamentary" },
        {
          code: "—",
          title: "Inventory, Appraisement and List of Claims — or the § 309.056 affidavit in lieu",
        },
      ],
      obligations: [
        "Take the oath and receive letters; the court shall grant them before the 21st day after the will is probated — Tex. Est. Code § 306.001(a)",
        "Notify each beneficiary named in the will not later than the 60th day after the order admitting the will — § 308.002(a)",
        "Publish notice to creditors within one month of receiving letters — § 308.051(a)",
        "Notify each known secured creditor within two months of receiving letters — § 308.053(a)",
        "File the inventory before the 91st day after qualifying — § 309.051(a) — or, where the only unpaid debts are secured debts, taxes and administration expenses, file the affidavit in lieu within the same 90-day period — § 309.056(b)",
        "Consider giving permissive notice to unsecured creditors: an unsecured claim not presented before the 121st day after receipt is barred — §§ 308.054(b)(1), 355.060",
      ],
      timelineDays: [120, 365],
      estCostUsd: [360, 12_000],
    },
    estimates: {
      timelineDays: "Practice estimate; no statute fixes the overall length of an independent administration.",
      estCostUsd:
        "Lower bound is the cited $360 statewide statutory filing floor. Upper bound is a practice estimate.",
    },
    authority: authority(
      // BROADENED on review. This cited § 401.001(a) alone, but every
      // obligation below states a deadline drawn from a different section —
      // 306.001, 308.002, 308.051, 308.053, 309.051, 309.056 — none of which
      // the citation named, so nothing tied those day counts to a source or
      // to an effective date.
      "Tex. Est. Code §§ 401.001(a), 306.001, 308.002, 308.051, 308.053, 309.051, 309.056",
      ES("401"),
      // § 309.051 amended eff. 1 September 2025; § 401.001(a) itself has been
      // unchanged since 1 January 2014.
      "2025-09-01",
    ),
    priority: 140,
    blastRadius: "high",
    reversibility: "costly",
    notes:
      "The § 309.056 affidavit in lieu of inventory is the quiet privacy win of Texas practice: it keeps the decedent's asset schedule off the public record. It is available only where there are no unpaid debts other than secured debts, taxes and administration expenses, and a beneficiary taking $2,000 or less need not be sent the inventory at all — § 309.056(b-1)(1).",
  },
  {
    id: "tx.admin.independent_by_agreement_testate",
    decisionPoint: "administration_supervision",
    jurisdiction: { state: "TX" },
    title: "Independent administration by agreement of the distributees (testate)",
    requires: [
      "decedent.died_testate",
      "decedent.will_directs_independent_administration",
      "decedent.will_prohibits_independent_administration",
      "estate.all_distributees_agree_independent",
    ],
    when: {
      all: [
        { fact: "decedent.died_testate", op: "==", value: true },
        { fact: "decedent.will_directs_independent_administration", op: "==", value: false },
        { fact: "decedent.will_prohibits_independent_administration", op: "==", value: false },
        { fact: "estate.all_distributees_agree_independent", op: "==", value: true },
      ],
    },
    then: {
      conclusion:
        "The will is silent on independent administration, but all of the distributees may agree to it and collectively designate the executor named in the will to serve independently. The court shall then grant independent administration unless it finds that doing so would not be in the best interest of the estate.",
      forms: [
        {
          code: "—",
          title: "Application for Probate of Will designating an independent executor, Tex. Est. Code § 401.002(a)",
        },
        { code: "—", title: "Consents of distributees to independent administration" },
        { code: "—", title: "Application to Waive Bond, Tex. Est. Code § 401.005(a-1)" },
      ],
      obligations: [
        "Serve every distributee with citation and notice of the application unless the distributee waives service or appears — Tex. Est. Code § 401.004(b)",
        "Obtain the agreement of ALL distributees; a single holdout defeats the route — § 401.002(a)",
        "Enter into bond unless the court waives it; where the will does not excuse bond the court may waive it only if all distributees agree in the application or in separate consents — § 401.005(a), (a-1)",
        "If the will gives no power of sale, ask the court to include one in the order by consent of the distributees who take the property — § 401.006",
      ],
      timelineDays: [120, 365],
      estCostUsd: [360, 14_000],
    },
    estimates: {
      timelineDays: "Practice estimate.",
      estCostUsd:
        "Lower bound is the cited $360 statewide statutory filing floor. Upper bound is a practice estimate and assumes the consents are obtained without contest.",
    },
    authority: authority(
      "Tex. Est. Code §§ 401.002, 401.004, 401.005, 401.006",
      ES("401"),
      // CORRECTED on review: was 2015-09-01. § 401.005 — including the
      // subsection (a-1) this rule's bond obligation and form both rely on —
      // was amended by Acts 2019, 86th Leg., R.S., Ch. 1141 (H.B. 2782),
      // § 40, eff. 1 September 2019.
      "2019-09-01",
    ),
    priority: 120,
    blastRadius: "high",
    reversibility: "costly",
  },
  {
    id: "tx.admin.independent_by_agreement_intestate",
    decisionPoint: "administration_supervision",
    jurisdiction: { state: "TX" },
    title: "Independent administration by agreement of the heirs (intestate)",
    requires: [
      "decedent.died_testate",
      "estate.all_distributees_agree_independent",
      "estate.heirship_determined",
    ],
    when: {
      all: [
        { fact: "decedent.died_testate", op: "==", value: false },
        { fact: "estate.all_distributees_agree_independent", op: "==", value: true },
        { fact: "estate.heirship_determined", op: "==", value: true },
      ],
    },
    then: {
      conclusion:
        "All of the heirs may agree to an independent administration and designate a qualified person to serve as independent administrator. The court shall grant it unless it finds that doing so would not be in the best interest of the estate — but not before a Chapter 202 heirship proceeding has determined that the applicants are all of the heirs.",
      forms: [
        { code: "—", title: "Application to Declare Heirship, Tex. Est. Code § 202.005" },
        {
          code: "—",
          title: "Application for Independent Administration designating an administrator, Tex. Est. Code § 401.003(a)",
        },
        { code: "—", title: "Consents of heirs to independent administration" },
        { code: "—", title: "Judgment Declaring Heirship" },
      ],
      obligations: [
        "Complete a proceeding to declare heirship under Chapter 202 first — the court MAY NOT appoint an independent administrator in an intestate administration until the applicants have been determined to constitute all of the decedent's heirs — Tex. Est. Code § 401.003(b)",
        "Serve every distributee with citation and notice unless service is waived or the distributee appears — § 401.004(b)",
        "Obtain the agreement of ALL heirs — § 401.003(a)",
        "Enter into bond unless the court waives it on application — § 401.005(a)",
        "Ask the court to grant a power of sale by consent; an intestate estate has no will to supply one — § 401.006",
      ],
      timelineDays: [150, 420],
      estCostUsd: [360, 18_000],
    },
    estimates: {
      timelineDays:
        "Practice estimate, and longer than the testate route because the heirship proceeding must finish first.",
      estCostUsd:
        "Lower bound is the cited $360 statewide statutory filing floor. Upper bound is a practice estimate and includes the attorney ad litem a heirship proceeding requires.",
    },
    authority: authority(
      "Tex. Est. Code §§ 401.003, 401.004, 401.005, 401.006, 202.002, 202.005",
      ES("401"),
      // CORRECTED on review: was 2015-09-01. Same § 401.005 amendment as the
      // testate rule above — Acts 2019, 86th Leg., R.S., Ch. 1141
      // (H.B. 2782), § 40, eff. 1 September 2019.
      "2019-09-01",
    ),
    priority: 110,
    blastRadius: "high",
    reversibility: "costly",
    notes:
      "§ 401.003(b) is the trap. Heirs commonly agree among themselves and expect to be appointed on that agreement alone; the statute forbids the appointment until heirship is adjudicated, which adds a separate proceeding, citation by publication and an attorney ad litem for unknown heirs.",
  },
  {
    id: "tx.admin.dependent",
    decisionPoint: "administration_supervision",
    jurisdiction: { state: "TX" },
    title: "Court-supervised dependent administration",
    requires: [
      "decedent.died_testate",
      "decedent.will_prohibits_independent_administration",
      "estate.all_distributees_agree_independent",
    ],
    when: {
      any: [
        { fact: "decedent.will_prohibits_independent_administration", op: "==", value: true },
        { fact: "estate.all_distributees_agree_independent", op: "==", value: false },
      ],
    },
    then: {
      conclusion:
        "Dependent administration. The estate is administered and settled under the direction of the probate court: the representative needs a court order to sell property, pay claims or distribute, and must account to the court. This is the expensive road, and in Texas it is the exception rather than the rule.",
      forms: [
        { code: "—", title: "Application for Letters Testamentary or of Administration" },
        { code: "—", title: "Inventory, Appraisement and List of Claims, Tex. Est. Code § 309.051" },
        { code: "—", title: "Application for Sale of Real or Personal Property" },
        { code: "—", title: "Annual and Final Accounts" },
      ],
      obligations: [
        "Administer and settle the estate under the direction of the probate court — Tex. Est. Code § 401.001(b)",
        "File the inventory, appraisement and list of claims before the 91st day after qualifying — § 309.051(a); the § 309.056 affidavit in lieu is available only to an independent executor",
        "Act on claims within the statutory scheme: a rejected claim is barred unless the claimant sues within 90 days of rejection — § 355.064(a)",
        "Do not allow a claim that is already barred; the court must disapprove it — § 355.061",
      ],
      timelineDays: [365, 900],
      estCostUsd: [360, 40_000],
    },
    estimates: {
      timelineDays: "Practice estimate; no statute fixes the length of a dependent administration.",
      estCostUsd:
        "Lower bound is the cited $360 statewide statutory filing floor. Upper bound is a practice estimate reflecting repeated applications and hearings; the representative's commission remains capped by the cited § 352.002 five percent.",
    },
    authority: authority(
      "Tex. Est. Code §§ 401.001(b), 306.002, 309.051, 355.061, 355.064",
      ES("401"),
      // CORRECTED on review: was 2014-01-01. § 306.002 was amended eff.
      // 1 September 2015 and § 309.051 twice eff. 1 September 2025.
      "2025-09-01",
    ),
    priority: 60,
    blastRadius: "high",
    reversibility: "irreversible",
    notes:
      "§ 401.001(b) lets a testator affirmatively forbid independent administration, and that instruction binds: \"the person's estate, if administered, shall be administered and settled under the direction of the probate court\". No agreement among distributees can override it: § 401.002 opens \"Except as provided in Section 401.001(b)\" in both subsections, so the testate agreement route is expressly subordinate to the will's prohibition. § 401.003 carries no such clause — corrected on review, this pack previously claimed it did — but it does not need one, because it governs only \"a decedent dying intestate\", where there is no will to contain the prohibition.",
  },

  // --- What it costs to walk through the door ------------------------------
  {
    id: "tx.fee.statutory_floor",
    decisionPoint: "filing_fee",
    jurisdiction: { state: "TX" },
    title: "Statewide statutory filing fee floor",
    requires: ["estate.county"],
    when: { exists: "estate.county" },
    then: {
      conclusion:
        "Two statewide fees attach to the filing of any probate case: a $137 state consolidated civil fee and a $223 local consolidated probate fee, $360 in total. Each county clerk charges a further filing fee on top, set locally and not fixed by any statewide statute — so $360 is a floor, not a price.",
      forms: [],
      obligations: [
        "Pay the $137 state consolidated civil fee on filing — Tex. Loc. Gov't Code § 133.151(a)(1)",
        "Pay the $223 local probate fee on filing, which is payable \"in addition to all other fees and court costs\" — § 135.102(a)(1)",
        "Obtain the county clerk's own fee schedule; it is not set statewide",
      ],
      timelineDays: [0, 0],
      estCostUsd: [360, 360],
    },
    estimates: {
      estCostUsd:
        "Both bounds are the cited statewide statutory total ($137 + $223). The county clerk's own filing fee is NOT included because no statewide source states it — see the NOTES block.",
    },
    authority: authority(
      "Tex. Loc. Gov't Code §§ 133.151(a)(1), 135.102(a)(1)",
      LG("133"),
      "2024-01-01",
    ),
    priority: 10,
    blastRadius: "low",
    reversibility: "reversible",
    notes:
      "SOURCE URL COVERS ONLY HALF THE CITATION. `sourceUrl` is the Chapter 133 locator, because a Rule carries one URL and the $137 fee comes first; the $223 fee is in a different chapter and a reader wanting it should go to https://statutes.capitol.texas.gov/Docs/LG/htm/LG.135.htm, which is declared in TX_SOURCES. Both figures were set at their current amounts by Acts 2023, 88th Leg., R.S., Ch. 256 (S.B. 1612), §§ 19 and 24, effective 1 January 2024. Note also that § 135.102(a) applies in \"a statutory county court, statutory probate court, or county court\", which is where probate is heard. Tex. Loc. Gov't Code § 118.052(2) lists further probate fees but they are for services in a PENDING action — filing an inventory $25.00, approving and recording bond $5.00, administering an oath $2.00, filing an annual or final account $25.00, letters testamentary or of administration $2.00 (§ 118.061). None of them is the original filing fee.",
  },
];

/** Where an executor would actually go to obtain a missing fact. */
export const TX_OBTAIN_HINTS: Record<string, string> = {
  "decedent.date_of_death":
    "Certified copy of the death certificate from the Texas Department of State Health Services or the local registrar",
  "decedent.died_testate":
    "Search the county clerk's will deposit records under Tex. Est. Code § 252.001 and the decedent's safe deposit box, papers and attorney's files; a negative search is itself a finding to record",
  "decedent.will_directs_independent_administration":
    "Read the will for language that no action be had in the probate court other than probating and recording the will and returning an inventory, appraisement and list of claims — Tex. Est. Code § 401.001(a)",
  "decedent.will_prohibits_independent_administration":
    "Read the will for an express direction that no independent administration be allowed — Tex. Est. Code § 401.001(b). Absent such language this is false, not unknown",
  "decedent.has_family_allowance_claimant":
    "Identify any surviving spouse, minor child or adult incapacitated child — only they may apply under Tex. Est. Code § 451.001(a)",
  "estate.chapter_205_value":
    "Derived. Supply each asset as asset.<id>.value, and flag homestead, exempt property, beneficiary-designated assets and transfer-on-death-deed property so they are excluded. Value everything as at the date the affidavit will be signed, not the date of death",
  "estate.days_since_death": "Derived from decedent.date_of_death",
  "estate.within_four_years_of_death": "Derived from decedent.date_of_death",
  "estate.has_unpaid_debt_other_than_real_estate_lien":
    "Pull a credit report on the decedent, review 12 months of bank and card statements, and check for medical balances. A mortgage or home equity lien does NOT count — Tex. Est. Code § 257.001(1) excepts debt secured by a lien on real estate",
  "estate.pr_petition_pending_or_granted":
    "Search the probate docket of the county clerk where venue lies — Tex. Est. Code § 205.001(2)",
  "estate.exceeds_family_allowance":
    "Compare the estate excluding homestead and exempt property against one year's maintenance for the surviving spouse, minor children and adult incapacitated children. The court fixes the allowance under § 353.101; no statute states an amount, so this is a judgement to be made and recorded, not a figure to be looked up",
  "estate.all_distributees_agree_independent":
    "Written consents from every distributee, or their agreement in the application itself — Tex. Est. Code §§ 401.002(a), 401.003(a), 401.004",
  "estate.heirship_determined":
    "A judgment declaring heirship under Tex. Est. Code ch. 202. Required before any intestate independent administrator can be appointed — § 401.003(b)",
  "estate.county":
    "County of the decedent's domicile at death; venue is fixed by Tex. Est. Code ch. 33",
};

export const TX_PACK = {
  id: "tx-probate",
  title: "Texas probate procedure",
  jurisdiction: { state: "TX" },
  // .2 — figures unchanged, citations and effective dates corrected on the
  // 2026-07-28 re-verification recorded at the head of this file.
  version: `${RETRIEVED}.2`,
  rules: TX_RULES,
};

// ---------------------------------------------------------------------------
// NOTES — what could NOT be sourced, on 2026-07-28
// ---------------------------------------------------------------------------
//
// Recorded here rather than guessed. Each entry says what was looked for, what
// was found instead, and what the pack does in the meantime.
//
// 1. COUNTY CLERK FILING FEES. No statewide figure exists. Tex. Loc. Gov't
//    Code §§ 133.151(a)(1) and 135.102(a)(1) were fetched and give $137 and
//    $223, and § 118.052(2) was fetched and gives fees for services in a
//    pending probate action — but the county clerk's own charge for opening a
//    probate case is set by each commissioners court and is not in the
//    statutes. The pack states $360 as an explicit FLOOR and says so in the
//    rule's conclusion, obligations, `estimates` and `notes`. There is no
//    Texas analogue of the CA_COUNTIES registry in this pack, and inventing
//    254 county fees would be worse than having none.
//
// 2. STATEWIDE FORM NUMBERS. None were established. Tex. Gov't Code
//    § 22.020(b)(1) was fetched and directs the Supreme Court of Texas to
//    promulgate forms for Chapter 205 small estate affidavits and Chapter 257
//    muniment of title, "as the court considers appropriate", with § 22.020(g)
//    obliging probate courts to accept them. A search of txcourts.gov surfaced
//    a 2016 task force and a 2023 referral discussing such a kit, but no
//    promulgated form with a stable identifier could be confirmed from a
//    primary source; www.txcourts.gov/rules-forms/probate-forms returns 404.
//    Every FormRef therefore carries code "—" with the statute that fixes its
//    contents named in the title. Practitioners in fact use county-specific
//    templates, which is a fact about Texas rather than a gap in the research,
//    but the pack does not assert a form number it cannot cite.
//
// 3. THE CHAPTER 451 CAP. Genuinely unquantifiable, not merely unfound.
//    § 451.001(a) measures the estate against the family allowance, and
//    § 353.101(b)(1) defines that as the amount necessary for one year's
//    maintenance, fixed by the court case by case. The engine takes
//    `estate.exceeds_family_allowance` as an input boolean. No number is
//    asserted anywhere because none exists to assert.
//
// 4. LEAP-YEAR ANNIVERSARIES. Narrowed on review — this note used to say
//    `fourthAnniversary` rolls a 29 February death to 1 March, which
//    misdescribed the code. A four-year step from 29 February lands on
//    another leap year, so it does not roll: 2024-02-29 gives 2028-02-29.
//    The only roll is across a century year that is not a leap year, where
//    2096-02-29 gives 2100-03-01. Both behaviours are now pinned by tests.
//    The Estates Code says "the fourth anniversary" and does not resolve that
//    case; the Code Construction Act was still not researched on the point,
//    so the remaining century-boundary behaviour is a modelling choice.
//
// 5. INDEPENDENT EXECUTOR'S DUTY TO DISTRIBUTE / CLOSING PROCEDURES.
//    Chapters 402 and 405 were not fetched, so this pack models how an
//    independent administration is CREATED but not how it is closed. The
//    § 405.003 accounting-and-distribution proceeding and the § 405.004
//    closing statement are therefore absent from the obligations lists. That
//    is a scope boundary, not a finding of absence.
//
// 6. HOMESTEAD AND EXEMPT PROPERTY VALUES. Gap closed on review: Tex. Prop.
//    Code ch. 42 has now been fetched. The § 205.009 → § 353.051(a)(2) chain
//    resolves as the pack described — § 353.051(a)(2) does read "all other
//    exempt property described by Section 42.002(a), Property Code" — and
//    § 42.001(a) caps the exemption at an aggregate fair market value of
//    $100,000 for property provided for a family and $50,000 for a single
//    adult who is not a member of a family. Those two figures are recorded
//    here and deliberately NOT promoted into TX_THRESHOLDS: no rule performs
//    the aggregation they would govern, and an unused threshold is a number
//    waiting to be misapplied. The exclusion still works off a per-asset flag
//    an executor sets.
//
// 7. § 309.051 2025 AMENDMENTS. Gap closed on review. Both bills were fetched
//    from the enrolled text — Acts 2025, 89th Leg., R.S., Ch. 438
//    (H.B. 3421) § 4 and Ch. 831 (S.B. 1448) § 5, both eff. 1 September 2025.
//    Each sets out § 309.051(a) in full and each reads "before the 91st day
//    after the date the personal representative qualifies", with no struck
//    text anywhere in the subsection. Neither amendment touched the deadline.
//    The current codified text agrees, and § 309.056(b) independently calls
//    it "the 90-day period prescribed by Section 309.051(a)". Three sources,
//    one figure.
