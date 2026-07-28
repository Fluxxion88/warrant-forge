// California probate rule pack.
//
// Every dollar figure and form number below was researched against primary
// sources (leginfo.legislature.ca.gov and courts.ca.gov) on 2026-07-27 and
// carries its citation inline. Thresholds in California are keyed to the
// decedent's DATE OF DEATH, not the filing date, and were last moved by
// AB 2016 (Stats. 2024, ch. 331) effective 1 April 2025.
//
// The interesting structure here is the interaction between two procedures:
//
//   § 13151  Petition to Determine Succession to Primary Residence — available
//            only where the primary residence is worth $750,000 or less.
//   § 13100  Small estate affidavit — available where the gross value of the
//            estate is $208,850 or less, *excluding* both § 13050 property and
//            "any property included in a petition filed under Section 13151".
//
// So the residence being eligible under § 13151 is what keeps it out of the
// § 13100 computation. If the residence crosses $750,000, it loses § 13151
// eligibility AND lands back in the § 13100 gross value — closing both
// economical routes at once and forcing formal probate.
//
// That cascade is not a demo contrivance. It is what the statute says, and it
// is why a $20,000 change in an appraisal can cost a family a year.

import { derived, ledger, type Fact } from "../lib/facts";
import type { ExclusionRule } from "../lib/derive";
import { daysBetween } from "../lib/derive";
import type { Rule } from "../lib/rules";
import { countyRules } from "./ca-counties";

const LEGINFO = "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PROB&sectionNum=";
const DE300 = "https://courts.ca.gov/sites/default/files/courts/default/2024-11/de300.pdf";
const ADJUSTED = "https://courts.ca.gov/system/files/file/probate-code-890-adjusted-amounts.pdf";
const RETRIEVED = "2026-07-27";

/**
 * Threshold values for decedents dying on or after 1 April 2025. The Judicial
 * Council adjusts most of these every three years under Prob. Code § 890; the
 * § 13151 figure is a legislative number set by AB 2016 rather than a CPI
 * adjustment, and is keyed to deaths through 31 March 2028.
 */
export const CA_THRESHOLDS = {
  /** Cal. Prob. Code §§ 13100, 13101 — small estate affidavit. */
  smallEstateAffidavit: 208_850,
  /** Cal. Prob. Code §§ 13151–13154 — primary residence succession petition. */
  primaryResidence: 750_000,
  /** Cal. Prob. Code § 13200 — affidavit re real property of small value. */
  realPropertySmallValue: 69_625,
  /** Cal. Prob. Code § 13100 — days that must elapse since death. */
  waitingPeriodDays: 40,
  effectiveFrom: "2025-04-01",
  nextAdjustment: "2028-04-01",
} as const;

/**
 * Property excluded from the gross-value computation. Cal. Prob. Code § 13050.
 * Expressed as data so a new exclusion is an edit, not a deploy.
 */
export const CA_EXCLUSIONS: ExclusionRule[] = [
  {
    id: "excl.13050.beneficiary",
    flag: "has_named_beneficiary",
    label: "Passes to a named beneficiary outside probate",
    citation: "Cal. Prob. Code § 13050",
    sourceUrl: `${LEGINFO}13050`,
  },
  {
    id: "excl.13050.joint_tenancy",
    flag: "joint_tenancy",
    label: "Held in joint tenancy with right of survivorship",
    citation: "Cal. Prob. Code § 13050",
    sourceUrl: `${LEGINFO}13050`,
  },
  {
    id: "excl.13050.trust",
    flag: "held_in_trust",
    label: "Held in a funded revocable trust",
    citation: "Cal. Prob. Code § 13050",
    sourceUrl: `${LEGINFO}13050`,
  },
  {
    id: "excl.13050.vehicle",
    flag: "registered_vehicle",
    label: "Registered vehicle — transfers via DMV, not probate",
    citation: "Cal. Prob. Code § 13050(b)",
    sourceUrl: `${LEGINFO}13050`,
  },
  {
    id: "excl.13050.spouse",
    flag: "passes_to_surviving_spouse",
    label: "Passes outright to a surviving spouse",
    citation: "Cal. Prob. Code § 13050(a)",
    sourceUrl: `${LEGINFO}13050`,
  },
];

// ---------------------------------------------------------------------------
// California-specific derivation
// ---------------------------------------------------------------------------

/**
 * Compute the California-specific derived facts. Kept in the jurisdiction pack
 * rather than the generic engine, because the § 13100 / § 13151 interaction is
 * a fact about California, not about estates in general.
 *
 * No model participates. Each derived fact records the inputs it consumed and
 * the statute that says the computation is the right one.
 */
export function deriveCaFacts(facts: Fact[], asOfIso: string, now = 0): Fact[] {
  const current = ledger(facts);
  const out: Fact[] = [];
  const num = (key: string): number | undefined => {
    const f = current.get(key);
    return typeof f?.value === "number" ? f.value : undefined;
  };
  const bool = (key: string): boolean | undefined => {
    const f = current.get(key);
    return typeof f?.value === "boolean" ? f.value : undefined;
  };

  // Days since death — statutory waiting periods hang off this, and it moves on
  // its own, so it is recomputed every run.
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
          authority: { citation: "Cal. Prob. Code § 13100", sourceUrl: `${LEGINFO}13100` },
          note: "A § 13100 affidavit may not be used until 40 days have elapsed since death.",
        },
        { now },
      ),
    );
  }

  // Does the residence still qualify for the § 13151 primary-residence route?
  const residence = num("asset.residence.value");
  const isPrimary = bool("asset.residence.is_primary_residence");
  if (residence !== undefined && isPrimary !== undefined) {
    const qualifies = isPrimary && residence <= CA_THRESHOLDS.primaryResidence;
    out.push(
      derived(
        {
          key: "estate.residence_qualifies_13151",
          label: "Residence eligible for § 13151 petition",
          value: qualifies,
          formula: `is primary residence AND value ${residence.toLocaleString("en-US")} ≤ ${CA_THRESHOLDS.primaryResidence.toLocaleString("en-US")}`,
          inputs: ["asset.residence.value", "asset.residence.is_primary_residence"],
          authority: {
            citation: "Cal. Prob. Code §§ 13151, 13152 (AB 2016, Stats. 2024, ch. 331)",
            sourceUrl: ADJUSTED,
          },
          note: qualifies
            ? "Residence is within the $750,000 primary-residence cap."
            : "Residence exceeds the $750,000 cap, so the § 13151 petition is unavailable.",
        },
        { now },
      ),
    );

    // § 13100's gross value excludes property included in a § 13151 petition.
    // When the residence loses § 13151 eligibility it falls back into this sum.
    const personal = personalPropertyTotal(current);
    const total = qualifies ? personal.total : personal.total + residence;
    out.push(
      derived(
        {
          key: "estate.section_13100_gross_value",
          label: "Gross value for § 13100 affidavit",
          value: total,
          unit: "USD",
          formula: qualifies
            ? `${personal.formula}  (residence excluded — included in a § 13151 petition)`
            : `${personal.formula} + residence ${residence.toLocaleString("en-US")}  (§ 13151 unavailable, so the residence counts)`,
          inputs: [...personal.inputs, "asset.residence.value", "estate.residence_qualifies_13151"],
          authority: {
            citation: "Cal. Prob. Code § 13100 (excluding § 13050 property and property in a § 13151 petition)",
            sourceUrl: `${LEGINFO}13100`,
          },
          note: qualifies
            ? "Residence sits outside this computation while the § 13151 route is open."
            : "Residence has fallen back into the § 13100 computation.",
        },
        { now },
      ),
    );
  }

  return out;
}

function personalPropertyTotal(current: Map<string, Fact>) {
  const inputs: string[] = [];
  const parts: string[] = [];
  let total = 0;

  const excludedFlags = new Set(CA_EXCLUSIONS.map((e) => e.flag));

  for (const [key, fact] of current) {
    const m = /^asset\.([^.]+)\.value$/.exec(key);
    if (!m || typeof fact.value !== "number") continue;
    const id = m[1];
    if (id === "residence") continue; // handled separately by the § 13151 test

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
  // --- How the primary residence transfers ---------------------------------
  {
    id: "ca.residence.13151_petition",
    decisionPoint: "residence_route",
    jurisdiction: { state: "CA" },
    title: "Petition to Determine Succession to Primary Residence",
    requires: ["asset.residence.value", "estate.residence_qualifies_13151", "estate.days_since_death"],
    when: {
      all: [
        { fact: "estate.residence_qualifies_13151", op: "==", value: true },
        { fact: "estate.days_since_death", op: ">=", value: CA_THRESHOLDS.waitingPeriodDays },
      ],
    },
    then: {
      conclusion:
        "File a single petition to determine succession to the primary residence. No full administration, no letters, no probate referee.",
      forms: [
        { code: "DE-310", title: "Petition to Determine Succession to Primary Residence" },
        { code: "DE-315", title: "Order Determining Succession to Primary Residence" },
        { code: "DE-300", title: "Maximum Values (mandatory attachment)", url: DE300 },
      ],
      obligations: [
        "Wait 40 days from the date of death before filing",
        "Deliver notice of the petition to each heir and devisee named in it within five business days of filing",
        "Attach an Inventory and Appraisal by a probate referee for the residence",
        "Give notice of hearing to all interested parties",
      ],
      // Filing fee is the cited statewide figure; the elapsed-time range is a
      // practice estimate, not a statutory period, and is labelled as such.
      timelineDays: [45, 120],
      estCostUsd: [435, 1_500],
    },
    estimates: {
      timelineDays: "Practice estimate — no statutory period governs how quickly a court sets and hears the petition.",
      estCostUsd: "Lower bound is the cited $435 filing fee; upper bound is a practice estimate including the probate referee's commission.",
    },
    authority: authority(
      "Cal. Prob. Code §§ 13151–13154; AB 2016, Stats. 2024, ch. 331",
      ADJUSTED,
      "2025-04-01",
    ),
    priority: 100,
    blastRadius: "high",
    reversibility: "costly",
    notes:
      "Cap is $750,000 for deaths on or after 1 April 2025 and is restricted to the decedent's primary residence.",
  },
  {
    id: "ca.residence.spousal_petition",
    decisionPoint: "residence_route",
    jurisdiction: { state: "CA" },
    title: "Spousal or Domestic Partner Property Petition",
    requires: ["decedent.has_surviving_spouse"],
    when: { fact: "decedent.has_surviving_spouse", op: "==", value: true },
    then: {
      conclusion:
        "Property passing to the surviving spouse can be confirmed by spousal property petition. There is no dollar limit and no administration.",
      forms: [
        { code: "DE-221", title: "Spousal or Domestic Partner Property Petition" },
        { code: "DE-226", title: "Spousal or Domestic Partner Property Order" },
      ],
      obligations: [
        "Give notice of hearing at least 15 days before the hearing",
        "Identify community and separate property characterisation for each asset",
      ],
      timelineDays: [45, 120],
      estCostUsd: [435, 2_000],
    },
    estimates: {
      timelineDays: "Practice estimate.",
      estCostUsd: "Lower bound is the cited $435 filing fee; upper bound is a practice estimate.",
    },
    authority: authority(
      "Cal. Prob. Code §§ 13500, 13650",
      `${LEGINFO}13650`,
      "2000-01-01",
    ),
    // Outranks formal probate: where a spouse survives, this route exists
    // regardless of value, so it must be considered before administration.
    priority: 120,
    blastRadius: "high",
    reversibility: "costly",
    notes: "No dollar limit applies. Availability turns on characterisation, not value.",
  },
  {
    id: "ca.residence.13200_affidavit",
    decisionPoint: "residence_route",
    jurisdiction: { state: "CA" },
    title: "Affidavit re Real Property of Small Value",
    requires: ["asset.residence.value", "estate.days_since_death"],
    when: {
      all: [
        { fact: "asset.residence.value", op: "<=", value: CA_THRESHOLDS.realPropertySmallValue },
        // Six months, not the 40 days that governs § 13100 and § 13151.
        { fact: "estate.days_since_death", op: ">=", value: 180 },
      ],
    },
    then: {
      conclusion:
        "Real property of this value transfers by affidavit without any petition.",
      forms: [
        { code: "DE-305", title: "Affidavit re Real Property of Small Value" },
        { code: "DE-300", title: "Maximum Values (mandatory attachment)", url: DE300 },
      ],
      obligations: [
        "Wait six months from the date of death — not the 40 days that applies to § 13100",
        "Attach an Inventory and Appraisal by a probate referee",
      ],
      timelineDays: [180, 240],
      estCostUsd: [0, 500],
    },
    estimates: { estCostUsd: "Practice estimate; no filing fee applies to the affidavit itself." },
    authority: authority("Cal. Prob. Code § 13200", `${LEGINFO}13200`, "2025-04-01"),
    priority: 130,
    blastRadius: "medium",
    reversibility: "costly",
  },
  {
    id: "ca.residence.formal_probate",
    decisionPoint: "residence_route",
    jurisdiction: { state: "CA" },
    title: "Formal probate (residence exceeds the § 13151 cap)",
    requires: [
      "asset.residence.value",
      "estate.residence_qualifies_13151",
      "decedent.has_surviving_spouse",
    ],
    when: {
      all: [
        { fact: "estate.residence_qualifies_13151", op: "==", value: false },
        // Without this guard the rule claims formal probate is required even
        // where a spousal petition would carry the property with no limit.
        { fact: "decedent.has_surviving_spouse", op: "==", value: false },
      ],
    },
    then: {
      conclusion:
        "The residence cannot pass by petition. Open a formal probate to administer the estate.",
      forms: [
        { code: "DE-111", title: "Petition for Probate" },
        { code: "DE-121", title: "Notice of Petition to Administer Estate" },
        { code: "DE-140", title: "Order for Probate" },
        { code: "DE-150", title: "Letters" },
        { code: "DE-147", title: "Duties and Liabilities of Personal Representative" },
        { code: "DE-160", title: "Inventory and Appraisal" },
      ],
      obligations: [
        "Publish notice three times in a newspaper of general circulation; first publication at least 15 days before the hearing",
        "Mail notice to all heirs and devisees at least 15 days before the hearing",
        "Obtain Letters before acting — the order alone confers no authority",
        "File Inventory and Appraisal within 4 months of Letters",
        "Hold the estate open for creditor claims: the later of 4 months after Letters or 60 days after notice to the creditor",
      ],
      timelineDays: [270, 540],
      estCostUsd: [435, 25_000],
    },
    authority: authority(
      "Cal. Prob. Code §§ 8002, 8121, 8400, 9100, 10450",
      `${LEGINFO}8121`,
      "2000-01-01",
    ),
    priority: 50,
    blastRadius: "high",
    reversibility: "irreversible",
    notes: "Statutory compensation to the representative and attorney is set by §§ 10800 and 10810.",
  },

  // --- How personal property transfers -------------------------------------
  {
    id: "ca.personal.13100_affidavit",
    decisionPoint: "personal_property_route",
    jurisdiction: { state: "CA" },
    title: "Small estate affidavit",
    requires: ["estate.section_13100_gross_value", "estate.days_since_death"],
    when: {
      all: [
        { fact: "estate.section_13100_gross_value", op: "<=", value: CA_THRESHOLDS.smallEstateAffidavit },
        { fact: "estate.days_since_death", op: ">=", value: CA_THRESHOLDS.waitingPeriodDays },
      ],
    },
    then: {
      conclusion:
        "Collect the personal property by affidavit. No court filing and no fee — the affidavit is presented directly to each institution holding an asset.",
      forms: [
        { code: "DE-300", title: "Maximum Values (mandatory attachment)", url: DE300 },
        { code: "—", title: "Affidavit under § 13101 (no Judicial Council form prescribed)" },
      ],
      obligations: [
        "Wait 40 days from the date of death",
        "Attach a certified copy of the death certificate",
        "Present the affidavit to each holder of the property",
      ],
      timelineDays: [1, 30],
      estCostUsd: [0, 200],
    },
    authority: authority(
      "Cal. Prob. Code §§ 13100, 13101",
      `${LEGINFO}13100`,
      "2025-04-01",
    ),
    priority: 100,
    blastRadius: "medium",
    reversibility: "costly",
  },
  {
    id: "ca.personal.formal_probate",
    decisionPoint: "personal_property_route",
    jurisdiction: { state: "CA" },
    title: "Formal probate (estate exceeds the § 13100 cap)",
    requires: ["estate.section_13100_gross_value"],
    when: {
      fact: "estate.section_13100_gross_value",
      op: ">",
      value: CA_THRESHOLDS.smallEstateAffidavit,
    },
    then: {
      conclusion: "Personal property must be administered through the formal probate estate.",
      forms: [
        { code: "DE-111", title: "Petition for Probate" },
        { code: "DE-160", title: "Inventory and Appraisal" },
      ],
      obligations: ["Inventory all personal property and have it appraised by the probate referee"],
      timelineDays: [270, 540],
      estCostUsd: [435, 25_000],
    },
    authority: authority("Cal. Prob. Code § 13100", `${LEGINFO}13100`, "2025-04-01"),
    priority: 50,
    blastRadius: "high",
    reversibility: "irreversible",
  },

  // --- Vehicles leave the estate entirely ----------------------------------
  {
    id: "ca.vehicle.reg5",
    decisionPoint: "vehicle_transfer",
    jurisdiction: { state: "CA" },
    title: "Transfer vehicle without probate",
    requires: ["asset.vehicle.value"],
    when: { exists: "asset.vehicle.value" },
    then: {
      conclusion: "Transfer the vehicle at the DMV. It never enters the probate estate.",
      forms: [{ code: "REG 5", title: "Affidavit for Transfer Without Probate" }],
      obligations: ["Wait 40 days from the date of death", "Surrender the title certificate"],
      timelineDays: [7, 30],
      estCostUsd: [0, 100],
    },
    authority: authority("Cal. Prob. Code § 13050(b); Cal. Veh. Code § 5910", `${LEGINFO}13050`, "2000-01-01"),
    priority: 10,
    blastRadius: "low",
    reversibility: "reversible",
  },

  // Filing fees and local overlays for all 58 counties are generated from the
  // county registry in ca-counties.ts — see CA_RULES below.
];

/**
 * The full California pack: statewide procedure, plus filing fees and local
 * overlays generated for every one of the 58 counties.
 */
export const CA_RULES: Rule[] = [...STATEWIDE_RULES, ...countyRules()];

/** Where an executor would actually go to obtain a missing fact. */
export const CA_OBTAIN_HINTS: Record<string, string> = {
  "asset.residence.value": "Probate referee appraisal, or a licensed appraisal as at the date of death",
  "asset.residence.is_primary_residence": "Decedent's last tax return or voter registration address",
  "decedent.date_of_death": "Certified copy of the death certificate from the county recorder",
  "estate.county": "County of the decedent's residence at the date of death",
  "asset.vehicle.value": "Kelley Blue Book valuation as at the date of death",
};

export const CA_PACK = {
  id: "ca-probate",
  title: "California probate procedure",
  jurisdiction: { state: "CA" },
  version: `${RETRIEVED}.1`,
  rules: CA_RULES,
};
