// California county registry — all 58 counties.
//
// This is the file that answers "how does this scale to 3,000 counties?".
//
// Two kinds of county knowledge live here, and the difference matters:
//
//   1. Things we can assert for EVERY county from a single authority. The
//      Judicial Council fee schedule states that asterisked fees vary "only in
//      the counties of Riverside, San Bernardino, and San Francisco". That is
//      an exhaustive negative statement, so the correct probate filing fee is
//      known for all 58 counties from one citation — not guessed.
//
//   2. Local rules, which genuinely differ and must be read court by court.
//      Three counties have been researched against their published local rules.
//      The other 55 carry `status: "not_researched"` and are surfaced as such.
//
// A county we have not researched is NOT silently treated as having no local
// requirements. It is flagged, because the whole product claim is that the
// system knows what it does not know. Quietly defaulting 55 counties to
// "nothing special applies" would be exactly the confident-wrong-answer failure
// this architecture exists to prevent.

import type { Authority, Rule } from "../lib/rules";

const FEE_SCHEDULE_URL = "https://courts.ca.gov/";
const RETRIEVED = "2026-07-27";

export type ResearchStatus =
  /** Local rules read against the court's own published text. */
  | "verified"
  /** Statewide rules apply; no local overlay has been researched. */
  | "not_researched";

export interface LocalForm {
  code: string;
  title: string;
  whenRequired: string;
}

export interface CountyProfile {
  name: string;
  court: string;
  /** First-paper probate filing fee, in USD. */
  firstPaperFeeUsd: number;
  feeAuthority: Authority;
  status: ResearchStatus;
  /** Effective date of the local rules we read, when we read them. */
  localRulesEffective?: string;
  localForms: LocalForm[];
  /** Extra obligations beyond the statewide Judicial Council packet. */
  obligations: string[];
  efiling?: {
    mandatoryFor: "attorneys" | "represented parties" | "none";
    since?: string;
    exclusions: string[];
    authority: string;
  };
  /** How the court pre-reviews petitions before the hearing. */
  examiner?: string;
  tentativeRulings?: string;
  /** Places where widely-circulated sources are out of date. */
  staleDataWarnings?: string[];
  notes?: string;
}

/** The three counties with a local courthouse construction surcharge. */
const SURCHARGE_FEES: Record<string, number> = {
  // Gov. Code § 70625 allows up to $50 in San Francisco; the schedule appendix
  // nets it against a reduced state distribution to reach $450.
  "San Francisco": 450,
  Riverside: 450,
  // San Bernardino's surcharge does not reach the probate first paper.
  "San Bernardino": 435,
};

export const STATEWIDE_FIRST_PAPER_FEE = 435;

const feeAuthority = (county: string): Authority => ({
  citation:
    SURCHARGE_FEES[county] !== undefined
      ? "Cal. Gov. Code §§ 70625, 70650(a); Statewide Civil Fee Schedule, Appendix (eff. 1 Jan 2026)"
      : "Cal. Gov. Code §§ 70650(a), 70602.5, 70602.6; Statewide Civil Fee Schedule, item 124 (eff. 1 Jan 2026)",
  sourceUrl: FEE_SCHEDULE_URL,
  effectiveFrom: "2026-01-01",
  retrievedAt: RETRIEVED,
});

/** All 58 California counties. */
export const CA_COUNTY_NAMES = [
  "Alameda", "Alpine", "Amador", "Butte", "Calaveras", "Colusa", "Contra Costa",
  "Del Norte", "El Dorado", "Fresno", "Glenn", "Humboldt", "Imperial", "Inyo",
  "Kern", "Kings", "Lake", "Lassen", "Los Angeles", "Madera", "Marin",
  "Mariposa", "Mendocino", "Merced", "Modoc", "Mono", "Monterey", "Napa",
  "Nevada", "Orange", "Placer", "Plumas", "Riverside", "Sacramento",
  "San Benito", "San Bernardino", "San Diego", "San Francisco", "San Joaquin",
  "San Luis Obispo", "San Mateo", "Santa Barbara", "Santa Clara", "Santa Cruz",
  "Shasta", "Sierra", "Siskiyou", "Solano", "Sonoma", "Stanislaus", "Sutter",
  "Tehama", "Trinity", "Tulare", "Tuolumne", "Ventura", "Yolo", "Yuba",
] as const;

export type CountyName = (typeof CA_COUNTY_NAMES)[number];

/** Counties whose local probate rules have actually been read. */
const RESEARCHED: Record<string, Omit<CountyProfile, "name" | "court" | "firstPaperFeeUsd" | "feeAuthority">> = {
  "Los Angeles": {
    status: "verified",
    localRulesEffective: "2026-07-01",
    localForms: [
      {
        code: "PRO 010",
        title: "Probate Case Cover Sheet and Certificate of Grounds for Assignment to District",
        whenRequired: "Must accompany the petitioner's first paper (Local Rule 4.5).",
      },
    ],
    obligations: [
      "File PRO 010 with the first paper — a mandatory local overlay on the DE-111 packet (LASC Rule 4.5)",
      "Clear the published Probate Notes by the third court day before the hearing (LASC Rule 4.4(b))",
      "File in the Central District at the Stanley Mosk Courthouse unless the matter belongs to the North District (LASC Rule 4.3(a))",
      "The petition must be complete when filed, including all requests for relief and fees (LASC Rule 4.6)",
    ],
    efiling: {
      mandatoryFor: "represented parties",
      exclusions: [
        "Peremptory challenges or challenges for cause of a judicial officer",
        "Testamentary instruments — wills and codicils",
        "Original trust documents",
        "Bond and undertaking documents",
        "Trial and hearing exhibits",
      ],
      authority: "LASC Local Rule 4.7(a)–(c)",
    },
    examiner:
      "Probate Notes are published before the hearing. Failure to clear them lets the court continue, take off calendar, or deny without prejudice (Rule 4.4(c)).",
    staleDataWarnings: [
      "Form PRO 037 (Subsequent Document Filing Coversheet) was deleted from Rule 4.5 effective 1 Jan 2026. Sources still requiring it are reading the 2022 ruleset.",
      "The 3:30 p.m. second-court-day Probate Notes deadline was superseded effective 1 Jan 2026 by a third-court-day filing deadline.",
      "lacourt.ca.gov/courtrules/currentcourtrulespdf/chap4.pdf still serves the superseded 2022 text. The current text is served from lascpubstorage.blob.core.windows.net — a scraper pointed at the obvious URL silently ingests four-year-old rules.",
    ],
    notes: "The original will cannot be e-filed in Los Angeles.",
  },

  "San Francisco": {
    status: "verified",
    localRulesEffective: "2026-07-01",
    localForms: [],
    obligations: [
      "Obtain the hearing date from the Clerk at the time of filing — San Francisco does not give dates by telephone (LRSF 14.3)",
      "List all heirs even where the decedent died testate; if there are no known heirs, file a declaration setting out the basis and the search efforts (LRSF 14.18(C)(1))",
      "Where a will names a trust or trustee as devisee, identify the trustee in item 8 of the Petition for Probate (LRSF 14.18(C)(2); Prob. Code § 1208(b))",
      "File DE-147S separately with its own cover page — it must NOT be attached to DE-147 (LRSF 14.18(E); Prob. Code § 8404(b))",
      "A holographic instrument must always be accompanied by an exact typewritten copy (LRSF 14.18(A))",
      "The proposed order must accompany the petition at filing (LRSF 14.7(A)(1))",
    ],
    efiling: {
      mandatoryFor: "represented parties",
      exclusions: ["Nine document types listed at LRSF 14.59(C) must be filed conventionally"],
      authority: "LRSF 14.59, applying LRSF 2.11 to Decedent's Estate cases",
    },
    examiner:
      "Examiner pre-grant system: an unopposed matter set Mon–Wed at 9:00 a.m. and approved by the Examiner is presented for signature with no appearance necessary (LRSF 14.6(A)).",
    tentativeRulings: "Tentative rulings line 415-551-4000, or the court's website (LRSF 14.6(B)).",
    staleDataWarnings: [
      "The Jan 2024 rule requiring a hard-copy proposed order ten court days in advance was superseded on 1 Jul 2026 — the order now accompanies the petition and may be submitted electronically.",
      "Guardianship and conservatorship cases became Designated Cases for e-filing on 1 Jan 2026; before that they were expressly excluded.",
    ],
    notes:
      "E-service is expressly NOT mandatory in the Probate Division, a carve-out from the general San Francisco e-service rule (LRSF 14.59(F)).",
  },

  "San Mateo": {
    status: "verified",
    localRulesEffective: "2026-07-01",
    localForms: [
      { code: "PR-1", title: "San Mateo local probate form", whenRequired: "Per Local Rule 4.10(A)." },
      { code: "PR-2", title: "San Mateo local probate form", whenRequired: "Per Local Rule 4.10(A)." },
      {
        code: "PR-5",
        title: "Request for Appointment of California Probate Referee",
        whenRequired:
          "A referee is appointed when the order for probate is signed, upon the filing of PR-5 (Local Rule 4.28(A)).",
      },
      { code: "PR-13", title: "Newspaper Listings", whenRequired: "Court-approved newspapers for publication of the DE-121." },
      { code: "PR-18", title: "San Mateo local probate form", whenRequired: "Per Local Rule 4.10(A)." },
      { code: "PR-19", title: "San Mateo local probate form", whenRequired: "Per Local Rule 4.10(A)." },
    ],
    obligations: [
      "File local form PR-5 to obtain appointment of the probate referee (Local Rule 4.28(A))",
      "Publish within 30 days of the filing date, using a newspaper from local form PR-13",
      "File DE-147S with the clerk — it is filed confidentially and not as part of the public file (Local Rule 4.18.4)",
      "Submit the Order for Probate (DE-140) at least 7 days before the hearing",
      "Email an editable Word version of the proposed order to probate@sanmateocourt.org so the judge can modify it before signing",
      "Address the six categories required in item 8 of the Petition for Probate (Local Rule 4.18.3)",
    ],
    efiling: {
      mandatoryFor: "attorneys",
      since: "2020-01-21",
      exclusions: [
        "Wills and codicils",
        "Estate planning documents",
        "Documents lodged under Prob. Code § 2620",
        "Letters of administration and letters testamentary",
        "Certified copy of the death certificate",
        "Letters of conservatorship or guardianship",
      ],
      authority: "San Mateo Local Rule 2.1.5(b) (amended eff. 1 Jul 2025)",
    },
    tentativeRulings:
      "Available after 3:00 p.m. one court day before the hearing, by telephone on (650) 261-5019 or the court's website (Local Rule 4.1(B)).",
    notes:
      "Negative finding: San Mateo imposes no local probate cover sheet analogous to Los Angeles PRO 010. A continuance may be requested by email to probate@sanmateocourt.org no later than 5 court days before the hearing (Rule 4.1(D)).",
  },
};

function build(name: string): CountyProfile {
  const researched = RESEARCHED[name];
  return {
    name,
    court: `Superior Court of California, County of ${name}`,
    firstPaperFeeUsd: SURCHARGE_FEES[name] ?? STATEWIDE_FIRST_PAPER_FEE,
    feeAuthority: feeAuthority(name),
    status: researched?.status ?? "not_researched",
    localRulesEffective: researched?.localRulesEffective,
    localForms: researched?.localForms ?? [],
    obligations: researched?.obligations ?? [],
    efiling: researched?.efiling,
    examiner: researched?.examiner,
    tentativeRulings: researched?.tentativeRulings,
    staleDataWarnings: researched?.staleDataWarnings,
    notes: researched?.notes,
  };
}

export const CA_COUNTIES: CountyProfile[] = CA_COUNTY_NAMES.map(build);

export function county(name: string): CountyProfile | undefined {
  return CA_COUNTIES.find((c) => c.name === name);
}

export interface CoverageReport {
  total: number;
  verified: number;
  notResearched: number;
  /** Counties where the fee differs from the statewide figure. */
  feeVariances: { name: string; fee: number }[];
}

/**
 * Honest coverage. The fee column is complete for all 58 counties because the
 * fee schedule enumerates its own exceptions; the local-rules column is not,
 * and saying so is the point.
 */
export function coverage(): CoverageReport {
  return {
    total: CA_COUNTIES.length,
    verified: CA_COUNTIES.filter((c) => c.status === "verified").length,
    notResearched: CA_COUNTIES.filter((c) => c.status === "not_researched").length,
    feeVariances: CA_COUNTIES.filter((c) => c.firstPaperFeeUsd !== STATEWIDE_FIRST_PAPER_FEE).map(
      (c) => ({ name: c.name, fee: c.firstPaperFeeUsd }),
    ),
  };
}

// ---------------------------------------------------------------------------
// Rules generated from the registry
// ---------------------------------------------------------------------------

/**
 * Turn the registry into rules. Adding a county is a data edit — this is the
 * concrete answer to "you can't have a Python file per county".
 *
 * Every county produces a filing-fee rule, because that is knowable for all 58
 * from one authority. Researched counties additionally produce a local-overlay
 * rule; unresearched counties produce a rule that *says so*, rather than
 * quietly implying no local requirements exist.
 */
export function countyRules(): Rule[] {
  const rules: Rule[] = [];

  for (const c of CA_COUNTIES) {
    rules.push({
      id: `ca.fee.${c.name.toLowerCase().replace(/\s+/g, "-")}`,
      decisionPoint: "filing_fee",
      jurisdiction: { state: "CA", county: c.name },
      title: `First-paper probate filing fee — ${c.name}`,
      requires: ["estate.county"],
      when: { exists: "estate.county" },
      then: {
        conclusion:
          c.firstPaperFeeUsd === STATEWIDE_FIRST_PAPER_FEE
            ? `First-paper probate filing fee is $${c.firstPaperFeeUsd} — the statewide figure, with no local surcharge in ${c.name}.`
            : `First-paper probate filing fee is $${c.firstPaperFeeUsd} in ${c.name}, which levies a local courthouse construction surcharge.`,
        forms: [],
        obligations: [],
        timelineDays: [0, 0],
        estCostUsd: [c.firstPaperFeeUsd, c.firstPaperFeeUsd],
      },
      authority: c.feeAuthority,
      priority: 100,
      blastRadius: "low",
      reversibility: "reversible",
    });

    if (c.status === "verified") {
      rules.push({
        id: `ca.local.${c.name.toLowerCase().replace(/\s+/g, "-")}`,
        decisionPoint: "county_requirements",
        jurisdiction: { state: "CA", county: c.name },
        title: `Local requirements — ${c.court}`,
        requires: ["estate.county"],
        when: { exists: "estate.county" },
        then: {
          conclusion: `${c.obligations.length} local requirement(s) apply in ${c.name} beyond the statewide Judicial Council packet.`,
          forms: c.localForms.map((f) => ({ code: f.code, title: f.title })),
          obligations: c.obligations,
          timelineDays: [0, 0],
          estCostUsd: [0, 0],
        },
        authority: {
          citation: `${c.court} local probate rules`,
          sourceUrl: FEE_SCHEDULE_URL,
          effectiveFrom: c.localRulesEffective ?? "unknown",
          retrievedAt: RETRIEVED,
        },
        priority: 100,
        blastRadius: "medium",
        reversibility: "costly",
        notes: c.notes,
      });
    } else {
      rules.push({
        id: `ca.local.unverified.${c.name.toLowerCase().replace(/\s+/g, "-")}`,
        decisionPoint: "county_requirements",
        jurisdiction: { state: "CA", county: c.name },
        title: `Local requirements — ${c.name} (not yet verified)`,
        requires: ["estate.county"],
        when: { exists: "estate.county" },
        then: {
          conclusion:
            `Statewide procedure is determined, but ${c.name}'s local probate rules have not been read against the court's published text. ` +
            `Treat the local overlay as unknown and check the court's rules before filing.`,
          forms: [],
          obligations: [
            `Read the ${c.court} local probate rules before filing — this county has not been verified`,
          ],
          timelineDays: [0, 0],
          estCostUsd: [0, 0],
        },
        authority: {
          citation: "Not researched",
          sourceUrl: FEE_SCHEDULE_URL,
          effectiveFrom: "unknown",
          retrievedAt: RETRIEVED,
        },
        priority: 10,
        blastRadius: "medium",
        reversibility: "costly",
        notes:
          "Deliberately surfaced rather than defaulted. An unverified county is a known unknown, not an absence of requirements.",
      });
    }
  }

  return rules;
}
