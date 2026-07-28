// The New York pack, held to the figures that were actually quoted.
//
// Three jobs, in the order the brief sets them:
//   (a) every threshold equals the figure quoted from the primary source;
//   (b) every rule carries a citation and a source URL;
//   (c) the route decision is exercised either side of the $50,000 cap.
//
// Plus the thing that makes the pack worth trusting: the sourcing gaps are
// asserted too. If someone quietly adds the joint-tenancy exclusion New York
// does not have, or lets a rule carry an unknown effective date without
// registering it, a test goes red.
//
// Adversarial re-verification on 2026-07-28 re-fetched every figure. The
// thresholds all held. The tests below that changed are the ones covering four
// things that did not:
//   * SCPA 1403, not SCPA 1409, is service of process in a probate proceeding.
//   * SCPA 1310(4) is barred where a spouse or minor child survives, or where a
//     fiduciary has qualified. The rule now gates on all three facts.
//   * 22 NYCRR 207.20(b) IS fetchable from Cornell LII and sets nine months from
//     letters. The old assertion that no inventory deadline may appear anywhere
//     is inverted: the deadline must now appear, and must equal the threshold.
//   * SCPA 1310's effectiveFrom was a website revision date, not an effective
//     date. All three SCPA 1310 rules are now UNDATED and registered.

import { describe, expect, it, beforeEach } from "vitest";
import { _resetIds, derived, values, type Fact } from "../lib/facts";
import { decide } from "../lib/rules";
import { findGaps } from "../lib/gaps";
import {
  NY_EXCLUSIONS,
  NY_FILING_FEE_SCHEDULE,
  NY_OBTAIN_HINTS,
  NY_RULES,
  NY_THRESHOLDS,
  NY_UNSOURCED,
  UNDATED,
  deriveNyFacts,
} from "./ny-probate";

const WHERE = { state: "NY" };
const AS_OF = "2026-07-28";

beforeEach(() => _resetIds());

/**
 * Mint an input fact for the derivation tests. `derived()` is the only public
 * constructor that yields a verified fact without a source document, and these
 * tests are about the rule pack rather than about verification — which
 * ca-probate.test.ts already covers end to end against real documents.
 */
function input(key: string, value: number | string | boolean, label = key): Fact {
  return derived({
    key,
    label,
    value,
    formula: "test input",
    inputs: [],
  });
}

function build(inputs: Fact[], asOf = AS_OF) {
  const facts = [...inputs, ...deriveNyFacts(inputs, asOf)];
  return { facts, values: values(facts) };
}

// ---------------------------------------------------------------------------
// (a) Thresholds equal the quoted figures
// ---------------------------------------------------------------------------

describe("statutory thresholds", () => {
  it("uses the SCPA 1301 cap of $50,000, raised by L. 2019, ch. 557", () => {
    // "personal property having a gross value of $50,000 or less exclusive of
    // property required to be set off under EPTL 5-3.1 (a)" — SCPA 1301(1).
    expect(NY_THRESHOLDS.smallEstatePersonalProperty).toBe(50_000);
    expect(NY_THRESHOLDS.smallEstateCapEffectiveFrom).toBe("2019-11-25");
  });

  it("imposes no waiting period on voluntary administration", () => {
    // "No waiting period after the death of the decedent is required." SCPA 1304(1).
    // California's 40 days does not travel. This assertion exists to stop it.
    expect(NY_THRESHOLDS.voluntaryAdministrationWaitDays).toBe(0);
  });

  it("charges the SCPA 1304(4) fee of $1 to file the affidavit", () => {
    expect(NY_THRESHOLDS.voluntaryAdministrationFeeUsd).toBe(1);
  });

  it("runs the SCPA 1802 creditor-claim period for 7 months from letters", () => {
    expect(NY_THRESHOLDS.creditorClaimMonths).toBe(7);
  });

  it("uses the SCPA 1310 debt-payment figures and their waiting periods", () => {
    expect(NY_THRESHOLDS.debtPayableToSpouseUsd).toBe(30_000);
    expect(NY_THRESHOLDS.debtPayableToFamilyUsd).toBe(15_000);
    expect(NY_THRESHOLDS.debtPayableToFamilyAfterDays).toBe(30);
    expect(NY_THRESHOLDS.debtPayableToDistributeeUsd).toBe(5_000);
    expect(NY_THRESHOLDS.debtPayableToDistributeeAfterMonths).toBe(6);
  });

  it("files the Inventory of Assets nine months from letters, per 22 NYCRR 207.20(b)", () => {
    // "The Inventory of Assets form shall be filed with the court within nine
    // months of the date letters issued to the fiduciary or as the court
    // otherwise directs." Two independent readings of the regulation.
    expect(NY_THRESHOLDS.inventoryFilingMonths).toBe(9);
    // From LETTERS, like SCPA 1802 — never from death. Holding the two apart is
    // the point; if someone collapses them this goes red.
    expect(NY_THRESHOLDS.inventoryFilingMonths).not.toBe(NY_THRESHOLDS.creditorClaimMonths);
  });

  it("keeps SCPA 1310(4)'s minor-child age apart from EPTL 5-3.1(a)'s", () => {
    // SCPA 1310(4) says minor — under 18. EPTL 5-3.1(a) says under 21. Two
    // provisions, two ages, two facts. Answering one from the other silently
    // opens or closes a route.
    expect(NY_THRESHOLDS.minorChildAgeYears).toBe(18);
    // Two separate facts, each with its own way of being obtained.
    expect(NY_OBTAIN_HINTS["decedent.has_child_under_18"]).toMatch(/18/);
    expect(NY_OBTAIN_HINTS["decedent.has_child_under_21"]).toMatch(/21/);
    // And the under-18 one is what SCPA 1310(4) actually gates on.
    const distributee = NY_RULES.find((r) => r.id === "ny.debt.distributee_5000")!;
    expect(distributee.requires).toContain("decedent.has_child_under_18");
  });

  it("uses the EPTL 5-3.1(a) exempt-property figures", () => {
    expect(NY_THRESHOLDS.exemptHouseholdUsd).toBe(20_000);
    expect(NY_THRESHOLDS.exemptBooksAndMediaUsd).toBe(2_500);
    expect(NY_THRESHOLDS.exemptFarmUsd).toBe(20_000);
    expect(NY_THRESHOLDS.exemptMotorVehicleUsd).toBe(25_000);
    expect(NY_THRESHOLDS.exemptMoneyUsd).toBe(25_000);
  });

  it("keeps the EPTL 4-1.1 spousal share separate from the small-estate cap", () => {
    // Same number, unrelated provisions. Holding them in one field would be the
    // conflation this assertion exists to prevent.
    expect(NY_THRESHOLDS.spousalIntestatePreferentialShareUsd).toBe(50_000);
    expect(NY_THRESHOLDS.spousalIntestatePreferentialShareUsd).not.toBe(
      NY_THRESHOLDS.smallEstatePersonalProperty - 1,
    );
  });

  it("reproduces the SCPA 2402(7) fee schedule bracket for bracket", () => {
    expect(NY_FILING_FEE_SCHEDULE).toEqual([
      { under: 10_000, feeUsd: 45, label: "Less than $10,000" },
      { under: 20_000, feeUsd: 75, label: "$10,000 but under $20,000" },
      { under: 50_000, feeUsd: 215, label: "$20,000 but under $50,000" },
      { under: 100_000, feeUsd: 280, label: "$50,000 but under $100,000" },
      { under: 250_000, feeUsd: 420, label: "$100,000 but under $250,000" },
      { under: 500_000, feeUsd: 625, label: "$250,000 but under $500,000" },
      { under: null, feeUsd: 1_250, label: "$500,000 and over" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// (b) Provenance on every rule
// ---------------------------------------------------------------------------

describe("provenance", () => {
  it("carries a citation, a source URL and today's retrieval date on every rule", () => {
    expect(NY_RULES.length).toBeGreaterThan(0);
    for (const rule of NY_RULES) {
      expect(rule.authority.citation, rule.id).toBeTruthy();
      expect(rule.authority.sourceUrl, rule.id).toMatch(/^https:\/\//);
      expect(rule.authority.retrievedAt, rule.id).toBe("2026-07-28");
    }
  });

  it("cites only sources that were actually fetchable", () => {
    // nycourts.gov 403s to automated fetches, so nothing may rest on it.
    for (const rule of NY_RULES) {
      expect(rule.authority.sourceUrl, rule.id).not.toMatch(/nycourts\.gov/);
    }
  });

  it("labels every unsourced figure rather than letting it sit silently", () => {
    // A rule may only carry an unknown effective date if the gap register
    // names it. This is the assertion that stops the honest list from rotting.
    const declared = new Set(NY_UNSOURCED.flatMap((g) => g.affects));
    for (const rule of NY_RULES) {
      if (rule.authority.effectiveFrom === UNDATED) {
        expect(declared.has(rule.id), `${rule.id} has no effective date and is not in NY_UNSOURCED`).toBe(
          true,
        );
      } else {
        expect(rule.authority.effectiveFrom, rule.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("marks every timelineDays and estCostUsd range that is a practice estimate", () => {
    for (const rule of NY_RULES) {
      const [tLo, tHi] = rule.then.timelineDays;
      const [cLo, cHi] = rule.then.estCostUsd;
      // A range that is not a single sourced point must be declared an estimate.
      if (tLo !== tHi) expect(rule.estimates?.timelineDays, rule.id).toBeTruthy();
      if (cLo !== cHi) expect(rule.estimates?.estCostUsd, rule.id).toBeTruthy();
    }
  });

  it("excludes only the two things SCPA 1301 and SCPA 1302 actually exclude", () => {
    // New York has no Prob. Code § 13050. If someone adds joint tenancy or a
    // beneficiary designation here on the California analogy, this goes red.
    expect(NY_EXCLUSIONS.map((e) => e.flag).sort()).toEqual([
      "is_real_property",
      "set_off_eptl_5_3_1",
    ]);
  });

  it("keeps the sourcing gaps registered and substantiated", () => {
    const ids = NY_UNSOURCED.map((g) => g.id);
    expect(ids).toContain("gap.non_probate_exclusions");
    expect(ids).toContain("gap.commissions");
    expect(ids).toContain("gap.effective_dates");
    for (const gap of NY_UNSOURCED) {
      expect(gap.what, gap.id).toBeTruthy();
      expect(gap.why.length, gap.id).toBeGreaterThan(40);
    }
  });

  it("states the 22 NYCRR 207.20 inventory deadline on both court routes", () => {
    // The inverse of the assertion this file used to carry. The deadline was
    // recorded as unsourceable because Cornell LII was never tried; LII serves
    // the regulation, and 207.20(b) sets nine months from the date letters
    // issued. Two readings agreed. So the number must now be STATED, on every
    // rule that obliges the inventory, and must agree with the threshold.
    const withInventory = NY_RULES.filter((r) =>
      r.then.obligations.some((o) => /Inventory of Assets/i.test(o)),
    );
    expect(withInventory.map((r) => r.id).sort()).toEqual([
      "ny.personal.administration",
      "ny.personal.probate",
    ]);
    for (const rule of withInventory) {
      const obligation = rule.then.obligations.find((o) => /Inventory of Assets/i.test(o))!;
      expect(obligation, rule.id).toMatch(/nine months of the date letters issued/i);
      expect(obligation, rule.id).toMatch(/22 NYCRR 207\.20/);
      // Nine months from LETTERS. If someone re-anchors it on death, catch it.
      expect(obligation, rule.id).not.toMatch(/months of (the date of )?death/i);
    }
    expect(NY_THRESHOLDS.inventoryFilingMonths).toBe(9);
  });

  it("does not attribute service of process to SCPA 1409, which is notice", () => {
    // SCPA 1403 is "Persons to be served; content of process". SCPA 1409 is
    // "Notice of probate" and by its own terms reaches only those who have NOT
    // been served. An earlier draft cited 1409 for service; this catches it.
    const probate = NY_RULES.find((r) => r.id === "ny.personal.probate")!;
    const service = probate.then.obligations.find((o) => /^Serve process/.test(o));
    expect(service).toBeTruthy();
    expect(service).toMatch(/SCPA 1403/);
    expect(service).not.toMatch(/1409/);
    expect(probate.authority.citation).toMatch(/1403/);
  });
});

// ---------------------------------------------------------------------------
// (c) The route decision, either side of the cap
// ---------------------------------------------------------------------------

const NO_SET_OFF = [
  input("decedent.date_of_death", "2026-05-01"),
  input("decedent.has_surviving_spouse", false),
  input("decedent.has_child_under_21", false),
  input("decedent.has_will", false),
];

function estateWorth(amount: number, extra: Fact[] = []) {
  return build([...NO_SET_OFF, input("asset.brokerage.value", amount, "Brokerage account"), ...extra]);
}

describe("the route decision at the SCPA 1301 cap", () => {
  it("takes voluntary administration one dollar under the cap", () => {
    const { values: v } = estateWorth(49_999);
    expect(v["estate.scpa_1301_gross_value"]).toBe(49_999);

    const route = decide(NY_RULES, v, WHERE).find(
      (d) => d.decisionPoint === "personal_property_route",
    );
    expect(route?.chosen?.ruleId).toBe("ny.personal.voluntary_administration");
    expect(route?.chosen?.rule.then.forms.map((f) => f.code)).toContain("SE2A");
  });

  it("still takes voluntary administration exactly AT the cap — '$50,000 or less'", () => {
    const route = decide(NY_RULES, estateWorth(50_000).values, WHERE).find(
      (d) => d.decisionPoint === "personal_property_route",
    );
    expect(route?.chosen?.ruleId).toBe("ny.personal.voluntary_administration");
  });

  it("falls to full administration one dollar over the cap", () => {
    const { values: v } = estateWorth(50_001);
    const route = decide(NY_RULES, v, WHERE).find(
      (d) => d.decisionPoint === "personal_property_route",
    );
    expect(route?.chosen?.ruleId).toBe("ny.personal.administration");
    expect(route?.chosen?.rule.then.forms.map((f) => f.code)).toContain("A-1");
  });

  it("charges $1 under the cap and the SCPA 2402 bracket over it", () => {
    const under = decide(NY_RULES, estateWorth(49_999).values, WHERE).find(
      (d) => d.decisionPoint === "filing_fee",
    );
    expect(under?.chosen?.ruleId).toBe("ny.fee.voluntary_administration");
    expect(under?.chosen?.rule.then.estCostUsd).toEqual([1, 1]);

    const over = estateWorth(50_001, [input("estate.gross_value_in_petition", 50_001)]);
    const fee = decide(NY_RULES, over.values, WHERE).find((d) => d.decisionPoint === "filing_fee");
    // 50,001 sits in "$50,000 but under $100,000" — $280.
    expect(fee?.chosen?.rule.then.estCostUsd).toEqual([280, 280]);
  });

  it("prices each SCPA 2402(7) bracket at its boundary", () => {
    const cases: [number, number][] = [
      [0, 45],
      [9_999, 45],
      [10_000, 75],
      [20_000, 215],
      [50_000, 280],
      [100_000, 420],
      [250_000, 625],
      [500_000, 1_250],
      [5_000_000, 1_250],
    ];
    for (const [value, fee] of cases) {
      // Fed directly, so the $1 voluntary-administration rule cannot pre-empt.
      const decision = decide(
        NY_RULES,
        { "estate.gross_value_in_petition": value },
        WHERE,
      ).find((d) => d.decisionPoint === "filing_fee");
      expect(decision?.chosen?.rule.then.estCostUsd[0], `at ${value}`).toBe(fee);
      expect(decision?.alsoFired, `at ${value}`).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Does a will change the route?
// ---------------------------------------------------------------------------

describe("what a will changes, and what it does not", () => {
  it("does NOT close the small-estate route", () => {
    const testate = build([
      input("decedent.date_of_death", "2026-05-01"),
      input("decedent.has_surviving_spouse", false),
      input("decedent.has_child_under_21", false),
      input("decedent.has_will", true),
      input("asset.brokerage.value", 40_000, "Brokerage account"),
    ]);
    const route = decide(NY_RULES, testate.values, WHERE).find(
      (d) => d.decisionPoint === "personal_property_route",
    );
    expect(route?.chosen?.ruleId).toBe("ny.personal.voluntary_administration");
  });

  it("changes the route above the cap from administration to probate", () => {
    const intestate = decide(NY_RULES, estateWorth(200_000).values, WHERE).find(
      (d) => d.decisionPoint === "personal_property_route",
    );
    expect(intestate?.chosen?.ruleId).toBe("ny.personal.administration");
    expect(intestate?.chosen?.rule.then.forms.map((f) => f.code)).toContain("A-1");

    const testate = build([
      input("decedent.date_of_death", "2026-05-01"),
      input("decedent.has_surviving_spouse", false),
      input("decedent.has_child_under_21", false),
      input("decedent.has_will", true),
      input("asset.brokerage.value", 200_000, "Brokerage account"),
    ]);
    const decision = decide(NY_RULES, testate.values, WHERE).find(
      (d) => d.decisionPoint === "personal_property_route",
    );
    expect(decision?.chosen?.ruleId).toBe("ny.personal.probate");
    expect(decision?.chosen?.rule.then.forms.map((f) => f.code)).toEqual(
      expect.arrayContaining(["P-1", "P-6"]),
    );
  });

  it("gives the named executor the first right to act under SCPA 1303", () => {
    const testate = build([input("decedent.has_will", true)]);
    const who = decide(NY_RULES, testate.values, WHERE).find(
      (d) => d.decisionPoint === "who_may_act",
    );
    expect(who?.chosen?.ruleId).toBe("ny.actor.executor_named");

    const intestate = build([input("decedent.has_will", false)]);
    const whoElse = decide(NY_RULES, intestate.values, WHERE).find(
      (d) => d.decisionPoint === "who_may_act",
    );
    expect(whoElse?.chosen?.ruleId).toBe("ny.actor.spouse_first");
  });
});

// ---------------------------------------------------------------------------
// The EPTL 5-3.1(a) cascade
// ---------------------------------------------------------------------------

describe("the EPTL 5-3.1(a) set-off cascade", () => {
  const assets = (): Fact[] => [
    input("asset.brokerage.value", 40_000, "Brokerage account"),
    input("asset.vehicle.value", 25_000, "Motor vehicle"),
    input("asset.vehicle.set_off_eptl_5_3_1", true),
  ];

  it("keeps a married decedent under the cap by setting off the car", () => {
    const { values: v } = build([
      input("decedent.date_of_death", "2026-05-01"),
      input("decedent.has_surviving_spouse", true),
      input("decedent.has_child_under_21", false),
      input("decedent.has_will", false),
      ...assets(),
    ]);
    expect(v["estate.eptl_5_3_1_set_off_available"]).toBe(true);
    // 40,000 only — the car is "not assets of the estate" under EPTL 5-3.1(a).
    expect(v["estate.scpa_1301_gross_value"]).toBe(40_000);

    const route = decide(NY_RULES, v, WHERE).find(
      (d) => d.decisionPoint === "personal_property_route",
    );
    expect(route?.chosen?.ruleId).toBe("ny.personal.voluntary_administration");
  });

  it("pushes an unmarried, childless decedent over it on identical assets", () => {
    const { values: v } = build([
      input("decedent.date_of_death", "2026-05-01"),
      input("decedent.has_surviving_spouse", false),
      input("decedent.has_child_under_21", false),
      input("decedent.has_will", false),
      ...assets(),
    ]);
    expect(v["estate.eptl_5_3_1_set_off_available"]).toBe(false);
    // Nothing vests in anyone, so nothing is set off: 40,000 + 25,000.
    expect(v["estate.scpa_1301_gross_value"]).toBe(65_000);

    const route = decide(NY_RULES, v, WHERE).find(
      (d) => d.decisionPoint === "personal_property_route",
    );
    expect(route?.chosen?.ruleId).toBe("ny.personal.administration");
  });

  it("sets off for a child under 21 where there is no spouse", () => {
    const { values: v } = build([
      input("decedent.date_of_death", "2026-05-01"),
      input("decedent.has_surviving_spouse", false),
      input("decedent.has_child_under_21", true),
      input("decedent.has_will", false),
      ...assets(),
    ]);
    expect(v["estate.eptl_5_3_1_set_off_available"]).toBe(true);
    expect(v["estate.scpa_1301_gross_value"]).toBe(40_000);
  });
});

// ---------------------------------------------------------------------------
// SCPA 1302 — real property never rides along
// ---------------------------------------------------------------------------

describe("real property under SCPA 1302", () => {
  const withHouse = (hasWill: boolean) =>
    build([
      input("decedent.date_of_death", "2026-05-01"),
      input("decedent.has_surviving_spouse", false),
      input("decedent.has_child_under_21", false),
      input("decedent.has_will", hasWill),
      input("asset.brokerage.value", 12_000, "Brokerage account"),
      input("asset.residence.value", 310_000, "Residence"),
      input("asset.residence.is_real_property", true),
    ]);

  it("leaves the house out of the SCPA 1301 computation entirely", () => {
    const { values: v } = withHouse(false);
    expect(v["estate.scpa_1301_gross_value"]).toBe(12_000);
    expect(v["estate.has_real_property"]).toBe(true);
  });

  it("still forces a court route for the house while the personal property goes by affidavit", () => {
    const decisions = decide(NY_RULES, withHouse(false).values, WHERE);

    const personal = decisions.find((d) => d.decisionPoint === "personal_property_route");
    expect(personal?.chosen?.ruleId).toBe("ny.personal.voluntary_administration");

    // No New York analogue of California's § 13151 residence petition exists.
    const realty = decisions.find((d) => d.decisionPoint === "real_property_route");
    expect(realty?.chosen?.ruleId).toBe("ny.realty.administration");
    expect(realty?.chosen?.rule.then.conclusion).toMatch(/not applicable to any interest in real property/);
  });

  it("routes the house to probate instead when there is a will", () => {
    const realty = decide(NY_RULES, withHouse(true).values, WHERE).find(
      (d) => d.decisionPoint === "real_property_route",
    );
    expect(realty?.chosen?.ruleId).toBe("ny.realty.probate");
  });

  it("resolves the realty decision point to nothing-to-do when there is no realty", () => {
    const { values: v } = build([
      input("decedent.has_will", false),
      input("asset.brokerage.value", 5_000, "Brokerage account"),
      input("asset.brokerage.is_real_property", false),
    ]);
    const realty = decide(NY_RULES, v, WHERE).find((d) => d.decisionPoint === "real_property_route");
    expect(realty?.chosen?.ruleId).toBe("ny.realty.none");
  });
});

// ---------------------------------------------------------------------------
// SCPA 1310 and its waiting periods
// ---------------------------------------------------------------------------

describe("paying a debt with no administration at all (SCPA 1310)", () => {
  function debtCase(
    amount: number,
    dod: string,
    spouse: boolean,
    extra: { minorChild?: boolean; fiduciary?: boolean } = {},
  ) {
    return build([
      input("decedent.date_of_death", dod),
      input("decedent.has_surviving_spouse", spouse),
      input("decedent.has_child_under_21", false),
      // SCPA 1310(4) turns on a MINOR child (under 18) and on whether any
      // fiduciary has qualified. Both are separate facts from the EPTL 5-3.1(a)
      // under-21 question, and both must be answered before the $5,000 route
      // can be said to be open.
      input("decedent.has_child_under_18", extra.minorChild ?? false),
      input("estate.fiduciary_appointed", extra.fiduciary ?? false),
      input("estate.debt_owed_to_decedent", amount),
    ]);
  }

  it("lets a debtor pay the spouse $30,000 the day after death", () => {
    const { values: v } = debtCase(30_000, "2026-07-27", true);
    expect(v["estate.days_since_death"]).toBe(1);
    const d = decide(NY_RULES, v, WHERE).find(
      (x) => x.decisionPoint === "debt_payment_without_administration",
    );
    expect(d?.chosen?.ruleId).toBe("ny.debt.spouse_30000");
  });

  it("holds the $15,000 relative route closed for the first 30 days", () => {
    const early = debtCase(15_000, "2026-07-18", false); // 10 days
    const d1 = decide(NY_RULES, early.values, WHERE).find(
      (x) => x.decisionPoint === "debt_payment_without_administration",
    );
    expect(d1?.chosen).toBeUndefined();

    const later = debtCase(15_000, "2026-06-01", false); // 57 days
    const d2 = decide(NY_RULES, later.values, WHERE).find(
      (x) => x.decisionPoint === "debt_payment_without_administration",
    );
    expect(d2?.chosen?.ruleId).toBe("ny.debt.family_15000");
  });

  it("counts the $5,000 distributee route in calendar months, not converted days", () => {
    const fiveMonths = debtCase(5_000, "2026-02-28", false);
    expect(fiveMonths.values["estate.months_since_death"]).toBe(5);
    const d1 = decide(NY_RULES, fiveMonths.values, WHERE).find(
      (x) => x.decisionPoint === "debt_payment_without_administration",
    );
    // 5 months elapsed but well past 30 days, so the $15,000 route carries it.
    expect(d1?.chosen?.ruleId).toBe("ny.debt.family_15000");

    const sixMonths = debtCase(5_000, "2026-01-28", false);
    expect(sixMonths.values["estate.months_since_death"]).toBe(6);
    const fired = decide(NY_RULES, sixMonths.values, WHERE)
      .find((x) => x.decisionPoint === "debt_payment_without_administration")!;
    expect([fired.chosen!.ruleId, ...fired.alsoFired.map((r) => r.ruleId)]).toContain(
      "ny.debt.distributee_5000",
    );
  });

  // -------------------------------------------------------------------------
  // The SCPA 1310(4) preconditions an earlier draft of the pack omitted.
  //
  // The subdivision is not "small debt plus six months". It is open only where
  // no fiduciary has qualified or been appointed AND the decedent left no
  // surviving spouse and no minor child. Without these gates the pack would
  // have told a widow's family that a $5,000 debt could be paid to a
  // distributee six months on — a route the statute closes to them.
  // -------------------------------------------------------------------------

  it("closes the $5,000 distributee route where a spouse survives", () => {
    const { values: v } = debtCase(5_000, "2026-01-28", true);
    expect(v["estate.months_since_death"]).toBe(6);
    const fired = decide(NY_RULES, v, WHERE).find(
      (x) => x.decisionPoint === "debt_payment_without_administration",
    )!;
    const ids = [fired.chosen?.ruleId, ...fired.alsoFired.map((r) => r.ruleId)];
    expect(ids).not.toContain("ny.debt.distributee_5000");
    // The spouse's own $30,000 route under SCPA 1310(2) is the one that is open.
    expect(fired.chosen?.ruleId).toBe("ny.debt.spouse_30000");
  });

  it("closes it where a minor child survives, even with no spouse", () => {
    const { values: v } = debtCase(5_000, "2026-01-28", false, { minorChild: true });
    const fired = decide(NY_RULES, v, WHERE).find(
      (x) => x.decisionPoint === "debt_payment_without_administration",
    )!;
    const ids = [fired.chosen?.ruleId, ...fired.alsoFired.map((r) => r.ruleId)];
    expect(ids).not.toContain("ny.debt.distributee_5000");
  });

  it("closes it once a fiduciary has qualified", () => {
    const { values: v } = debtCase(5_000, "2026-01-28", false, { fiduciary: true });
    const fired = decide(NY_RULES, v, WHERE).find(
      (x) => x.decisionPoint === "debt_payment_without_administration",
    )!;
    const ids = [fired.chosen?.ruleId, ...fired.alsoFired.map((r) => r.ruleId)];
    expect(ids).not.toContain("ny.debt.distributee_5000");
  });

  it("reports itself blocked rather than open when the preconditions are unknown", () => {
    // Three-valued logic doing the work: nobody has said whether a fiduciary
    // qualified, so the route is not "available", it is unanswered — and the
    // decision names the fact it is waiting on.
    const { values: v } = build([
      input("decedent.date_of_death", "2026-01-28"),
      input("decedent.has_surviving_spouse", false),
      input("decedent.has_child_under_18", false),
      input("estate.debt_owed_to_decedent", 5_000),
    ]);
    const fired = decide(NY_RULES, v, WHERE).find(
      (x) => x.decisionPoint === "debt_payment_without_administration",
    )!;
    const ids = [fired.chosen?.ruleId, ...fired.alsoFired.map((r) => r.ruleId)];
    expect(ids).not.toContain("ny.debt.distributee_5000");
    expect(fired.needs).toContain("estate.fiduciary_appointed");

    const gap = findGaps([fired], NY_OBTAIN_HINTS).find(
      (g) => g.key === "estate.fiduciary_appointed",
    );
    expect(gap?.howToObtain).toMatch(/Surrogate's Court/);
  });

  it("names children eighteen or older in the SCPA 1310(3) class, not 'child'", () => {
    // The statute is "children eighteen years of age or older". An earlier draft
    // said "child", which would have offered the route for a minor's benefit.
    const family = NY_RULES.find((r) => r.id === "ny.debt.family_15000")!;
    expect(family.then.conclusion).toMatch(/eighteen years of age or older/i);
  });
});

// ---------------------------------------------------------------------------
// SCPA 1802
// ---------------------------------------------------------------------------

describe("the creditor claim period", () => {
  it("runs from letters, not from death", () => {
    const { values: v } = build([
      input("decedent.date_of_death", "2025-01-10"),
      input("estate.letters_issued_date", "2026-03-15"),
    ]);
    expect(v["estate.months_since_letters"]).toBe(4);
    expect(v["estate.months_since_death"]).toBe(18);

    const d = decide(NY_RULES, v, WHERE).find((x) => x.decisionPoint === "creditor_claim_period");
    expect(d?.chosen?.ruleId).toBe("ny.claims.seven_months");
    expect(d?.chosen?.rule.then.conclusion).toMatch(/7 months from the date of issue of letters/);
  });
});

// ---------------------------------------------------------------------------
// Gaps
// ---------------------------------------------------------------------------

describe("gap detection", () => {
  it("names how to obtain a fact that is blocking the route", () => {
    // Assets and a date, but nobody has established whether a spouse survived —
    // so the set-off is unknown, so the gross value cannot be computed.
    const { facts, values: v } = build([
      input("decedent.date_of_death", "2026-05-01"),
      input("decedent.has_will", false),
      input("asset.brokerage.value", 40_000, "Brokerage account"),
    ]);
    expect(v["estate.scpa_1301_gross_value"]).toBeUndefined();
    expect(facts.some((f) => f.key === "estate.eptl_5_3_1_set_off_available")).toBe(false);

    const decisions = decide(NY_RULES, v, WHERE);
    const route = decisions.find((d) => d.decisionPoint === "personal_property_route")!;
    expect(route.chosen).toBeUndefined();
    expect(route.needs).toContain("estate.scpa_1301_gross_value");

    const gap = findGaps(decisions, NY_OBTAIN_HINTS).find(
      (g) => g.key === "estate.scpa_1301_gross_value",
    );
    expect(gap?.severity).toBe("blocking");
    expect(gap?.howToObtain).toMatch(/EPTL 5-3\.1\(a\)/);
  });

  it("offers a hint for every fact key the rules require", () => {
    const required = new Set(NY_RULES.flatMap((r) => r.requires));
    for (const key of required) {
      expect(NY_OBTAIN_HINTS[key], `no obtain hint for ${key}`).toBeTruthy();
    }
  });
});
