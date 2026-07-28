// The Pennsylvania pack, as a test.
//
// Three jobs, in the order the brief sets them:
//   (a) every threshold equals the figure quoted from the primary source;
//   (b) every rule carries a citation and a source URL;
//   (c) the route decision is exercised on both sides of the § 3102 cap.
//
// Plus one invariant that matters more here than it did in California: because
// no Pennsylvania filing fee could be sourced, every uncited [0, 0] figure must
// carry a NOT SOURCED note. A silent zero is indistinguishable from a claim
// that something is free, and that is the failure mode this project exists to
// prevent. The test below makes silence impossible.

import { describe, expect, it, beforeEach } from "vitest";
import { _resetIds, derived, values, type Fact, type FactValue } from "../lib/facts";
import { decide } from "../lib/rules";
import { findGaps } from "../lib/gaps";
import {
  PA_EXCLUSIONS,
  PA_OBTAIN_HINTS,
  PA_RULES,
  PA_THRESHOLDS,
  derivePaFacts,
} from "./pa-probate";

const WHERE = { state: "PA" };
const AS_OF = "2026-07-28";

beforeEach(() => _resetIds());

/** A verified fact, straight in. Extraction and verification are tested elsewhere. */
function fx(key: string, value: FactValue): Fact {
  return derived({ key, label: key, value, formula: "test fixture", inputs: [] });
}

/**
 * An estate with $42,000 of includable personal property:
 *   30,000 bank + 12,000 car.
 * A house of any value and $8,000 of § 3101 wages sit outside the computation.
 */
function estate(opts: { bank: number; house?: number; wages?: number }): Fact[] {
  const base: Fact[] = [
    fx("decedent.date_of_death", "2026-01-15"),
    fx("decedent.domiciled_in_pa", true),
    fx("asset.bank.value", opts.bank),
    fx("asset.car.value", 12_000),
  ];
  if (opts.house !== undefined) {
    base.push(fx("asset.house.value", opts.house), fx("asset.house.is_real_estate", true));
  }
  if (opts.wages !== undefined) {
    base.push(fx("asset.wages.value", opts.wages), fx("asset.wages.payable_under_3101", true));
  }
  return [...base, ...derivePaFacts(base, AS_OF)];
}

function routeFor(facts: Fact[], extra: Record<string, FactValue> = {}) {
  const decisions = decide(PA_RULES, { ...values(facts), ...extra }, WHERE);
  return decisions.find((d) => d.decisionPoint === "personal_property_route");
}

// ---------------------------------------------------------------------------
// (a) Thresholds
// ---------------------------------------------------------------------------

describe("statutory thresholds", () => {
  it("uses the § 3102 small-estate cap actually printed in the statute", () => {
    // 20 Pa.C.S. § 3102: "of a gross value not exceeding $50,000".
    expect(PA_THRESHOLDS.smallEstatePetitionUsd).toBe(50_000);
    // "Within one year after such a decree of distribution has been made ..."
    expect(PA_THRESHOLDS.smallEstateRevocationYears).toBe(1);
    // Act 35 of 2013 applies to decedents dying on or after its effective date.
    expect(PA_THRESHOLDS.smallEstateEffectiveFrom).toBe("2013-08-31");
  });

  it("uses the § 3121 family exemption of $3,500", () => {
    // "may retain or claim as an exemption ... to the value of $3,500".
    expect(PA_THRESHOLDS.familyExemptionUsd).toBe(3_500);
  });

  it("uses the § 3101 figures in force, including the 2025 deposit-account rise", () => {
    expect(PA_THRESHOLDS.payWagesUsd).toBe(10_000); // § 3101(a)
    expect(PA_THRESHOLDS.payDepositAccountUsd).toBe(20_000); // § 3101(b), Act 50 of 2025
    expect(PA_THRESHOLDS.payPatientCareUsd).toBe(10_000); // § 3101(c)
    expect(PA_THRESHOLDS.payLifeInsuranceUsd).toBe(11_000); // § 3101(d)
    expect(PA_THRESHOLDS.payLifeInsuranceWaitDays).toBe(60); // § 3101(d)
    expect(PA_THRESHOLDS.payUnclaimedPropertyUsd).toBe(20_000); // § 3101(e)(1)(i)
  });

  it("uses the statutory periods in the units the statutes state them in", () => {
    expect(PA_THRESHOLDS.lettersToRemoterClassesWaitDays).toBe(30); // § 3155(c)
    expect(PA_THRESHOLDS.advertisementWeeks).toBe(3); // § 3162(a)
    expect(PA_THRESHOLDS.beneficiaryNoticeMonths).toBe(3); // Pa. O.C. Rule 10.5(a)
    expect(PA_THRESHOLDS.certificationFilingDays).toBe(10); // Rule 10.5(d)
    expect(PA_THRESHOLDS.certificationDelinquencyDays).toBe(10); // Rule 10.5(e)
    // Rule 10.6(a): "not been completed within two years of the decedent's death".
    expect(PA_THRESHOLDS.statusReportYears).toBe(2);
    expect(PA_THRESHOLDS.inventoryOnRequestMonths).toBe(3); // § 3301(c)
    expect(PA_THRESHOLDS.inventoryOnRequestDays).toBe(30); // § 3301(c)
    expect(PA_THRESHOLDS.riskDistributionYears).toBe(1); // § 3532(a)
    expect(PA_THRESHOLDS.realEstateClaimNoticeYears).toBe(1); // § 3532(b)(2)
    expect(PA_THRESHOLDS.realEstateClaimExpiryYears).toBe(5); // § 3532(b)(2)
    expect(PA_THRESHOLDS.claimDemandDays).toBe(60); // § 3532(b.1)
    expect(PA_THRESHOLDS.willVoidAgainstGranteeYears).toBe(1); // § 3133(c)
  });

  it("uses the inheritance tax deadlines and discount from the Tax Reform Code", () => {
    expect(PA_THRESHOLDS.inheritanceTaxReturnMonths).toBe(9); // Act § 2136(d)
    expect(PA_THRESHOLDS.inheritanceTaxExtensionMonths).toBe(6); // Act § 2136(d)
    expect(PA_THRESHOLDS.inheritanceTaxDelinquentMonths).toBe(9); // Act § 2142
    expect(PA_THRESHOLDS.inheritanceTaxDiscountMonths).toBe(3); // Act § 2142
    expect(PA_THRESHOLDS.inheritanceTaxDiscountPercent).toBe(5); // Act § 2142
  });

  it("uses the inheritance tax rates from Act § 2116", () => {
    expect(PA_THRESHOLDS.taxRateSpousePercent).toBe(0); // (a)(1.1)(ii)
    expect(PA_THRESHOLDS.taxRateLinealPercent).toBe(4.5); // (a)(1)
    expect(PA_THRESHOLDS.taxRateSiblingPercent).toBe(12); // (a)(1.3)
    expect(PA_THRESHOLDS.taxRateOtherPercent).toBe(15); // (a)(2)
    expect(PA_THRESHOLDS.taxRateParentFromMinorChildPercent).toBe(0); // (a)(1.2)
    expect(PA_THRESHOLDS.taxRateMinorChildFromParentPercent).toBe(0); // (a)(1.4)
  });

  it("does not carry California's numbers by accident", () => {
    const figures = Object.values(PA_THRESHOLDS);
    for (const stale of [184_500, 208_850, 750_000, 69_625]) {
      expect(figures).not.toContain(stale);
    }
  });
});

// ---------------------------------------------------------------------------
// (a2) Effective dates
//
// Added by the 2026-07-28 audit. The figures in this pack all survived
// re-checking against the primary sources; four effectiveFrom dates did not.
// Each assertion below pins a date to the sentence in the source that fixes
// it, so the same mistake cannot be reintroduced quietly.
// ---------------------------------------------------------------------------

describe("effective dates", () => {
  const dateFor = (id: string) => PA_RULES.find((r) => r.id === id)?.authority.effectiveFrom;

  it("dates a multi-section rule from the latest provision it cites, not the earliest", () => {
    // pa.will.probate cites §§ 3131, 3132 and 3133. § 3131 has no amendment
    // note and so dates from Chapter 31's enactment (1972-07-01) — but the
    // rule's conclusion rests on § 3133(c), amended July 11, 1980, eff. 60
    // days. Dating the rule 1972 would assert the one-year recording risk
    // 8 years before it existed.
    expect(dateFor("pa.will.probate")).toBe("1980-09-09");

    // pa.real_estate.needs_its_own_road cites §§ 3102, 3133(c), 3301 and
    // 3532(b)(2). The latest is § 3102, as amended by Act 35 of 2013.
    expect(dateFor("pa.real_estate.needs_its_own_road")).toBe(
      PA_THRESHOLDS.smallEstateEffectiveFrom,
    );
  });

  it("dates Rule 10.5 from the Supreme Court's order, not from a form revision stamp", () => {
    // 52 Pa.B. 684: "This Order ... shall be effective on April 1, 2022."
    // The previous value, 2016-09-01, was attributed to an "eff. 09.01.16"
    // marking on RW-07/RW-08. Those forms print "rev. 01.01.20". The date
    // had no source.
    expect(dateFor("pa.admin.rule_10_5_notice")).toBe("2022-04-01");
  });

  it("dates the inheritance tax rates from their applicability clause, not the act date", () => {
    // Section 32 of Act 13 of 2019: the 2019 change applies "to property
    // transferred by a natural parent, an adoptive parent or a stepparent who
    // dies after December 31, 2019". 2019-06-28 is the act date.
    expect(PA_THRESHOLDS.inheritanceTaxRatesEffectiveFrom).toBe("2020-01-01");
    expect(dateFor("pa.tax.inheritance")).toBe("2020-01-01");
    expect(dateFor("pa.tax.inheritance")).not.toBe("2019-06-28");
  });

  it("never dates a rule from an enactment date that the source overrides", () => {
    // The act dates that appear in this pack's comments but must not appear as
    // effectiveFrom values, because the source prints a later applicability or
    // effective date for each.
    const actDatesThatAreNotEffectiveDates = [
      "2019-06-28", // Act 13 of 2019 -> applies to parents dying after 2019-12-31
      "2013-07-02", // Act 35 of 2013 -> eff. 60 days = 2013-08-31
      "2025-11-24", // Act 50 of 2025 -> eff. 60 days / 180 days
      "2022-01-12", // Rule 10.5 order -> effective 2022-04-01
      "2016-09-01", // never had a source at all
    ];
    for (const rule of PA_RULES) {
      expect(actDatesThatAreNotEffectiveDates, rule.id).not.toContain(
        rule.authority.effectiveFrom,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// (b) Provenance
// ---------------------------------------------------------------------------

describe("provenance", () => {
  it("carries a citation, a source URL and a retrieval date on every rule", () => {
    expect(PA_RULES.length).toBeGreaterThan(0);
    for (const rule of PA_RULES) {
      expect(rule.authority.citation, rule.id).toBeTruthy();
      expect(rule.authority.sourceUrl, rule.id).toMatch(/^https:\/\//);
      expect(rule.authority.retrievedAt, rule.id).toBe("2026-07-28");
      expect(rule.authority.effectiveFrom, rule.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("points every rule at a source that was actually fetched", () => {
    const fetched = [
      "https://www.legis.state.pa.us/WU01/LI/LI/CT/HTM/20/",
      "https://www.legis.state.pa.us/WU01/LI/LI/US/HTM/1971/",
      "https://www.pacourts.us/Storage/media/pdfs/",
      // The official Pennsylvania Code and Bulletin. Added on the 2026-07-28
      // audit: the Orphans' Court rules are not in Title 20, and the redline
      // PDF the pack used for Rule 10.5 prints no effective date, so the
      // consolidated Code text and the Supreme Court's order are the sources
      // of record for that rule.
      "https://www.pacodeandbulletin.gov/Display/",
    ];
    for (const rule of PA_RULES) {
      expect(fetched.some((p) => rule.authority.sourceUrl.startsWith(p)), rule.id).toBe(true);
    }
  });

  it("gives every form either a real code and URL, or an explicit '—'", () => {
    for (const rule of PA_RULES) {
      for (const form of rule.then.forms) {
        expect(form.title, `${rule.id}/${form.code}`).toBeTruthy();
        if (form.code === "—") {
          // The one unsourced form must say so in its title.
          expect(form.title).toMatch(/no statewide form/i);
        } else {
          expect(form.code, rule.id).toMatch(/^(RW|OC|REV)-\d+$/);
          expect(form.url, `${rule.id}/${form.code}`).toMatch(/^https:\/\//);
        }
      }
    }
  });

  it("cites a statute on every exclusion from the § 3102 computation", () => {
    expect(PA_EXCLUSIONS.length).toBeGreaterThan(0);
    for (const excl of PA_EXCLUSIONS) {
      expect(excl.citation).toMatch(/3102/);
      expect(excl.sourceUrl).toMatch(/^https:\/\//);
    }
  });

  // The point of the whole exercise: an uncited number must announce itself.
  it("marks every unsourced figure NOT SOURCED rather than letting a zero pass", () => {
    for (const rule of PA_RULES) {
      const { timelineDays, estCostUsd } = rule.then;
      if (estCostUsd[0] === 0 && estCostUsd[1] === 0) {
        expect(rule.estimates?.estCostUsd, `${rule.id} estCostUsd`).toMatch(/NOT SOURCED/);
      }
      if (timelineDays[0] === 0 && timelineDays[1] === 0) {
        expect(rule.estimates?.timelineDays, `${rule.id} timelineDays`).toMatch(/NOT SOURCED/);
      }
    }
  });

  it("explains every non-zero timeline that is a conversion rather than a statutory day count", () => {
    // Every rule states a timeline; none of them may do so silently.
    for (const rule of PA_RULES) {
      expect(rule.estimates?.timelineDays, rule.id).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// (c) The route decision, either side of the cap
// ---------------------------------------------------------------------------

describe("the § 3102 route decision", () => {
  it("computes the gross value with real estate and § 3101 property left out", () => {
    const facts = estate({ bank: 30_000, house: 400_000, wages: 8_000 });
    // 30,000 bank + 12,000 car. House and wages are excluded by § 3102.
    expect(values(facts)["estate.section_3102_gross_value"]).toBe(42_000);
  });

  it("routes to a § 3102 petition below the cap", () => {
    const route = routeFor(estate({ bank: 30_000 }));
    expect(route?.chosen?.ruleId).toBe("pa.personal.3102_small_estate");
  });

  it("routes to full administration above the cap", () => {
    // 45,000 + 12,000 = 57,000.
    const route = routeFor(estate({ bank: 45_000 }));
    expect(route?.chosen?.ruleId).toBe("pa.personal.full_administration");
    expect(route?.chosen?.rule.then.forms.map((f) => f.code)).toContain("RW-02");
  });

  it("treats the cap as inclusive, exactly as 'not exceeding $50,000' reads", () => {
    // 38,000 + 12,000 = 50,000 exactly.
    expect(routeFor(estate({ bank: 38_000 }))?.chosen?.ruleId).toBe(
      "pa.personal.3102_small_estate",
    );
    // One dollar more.
    expect(routeFor(estate({ bank: 38_001 }))?.chosen?.ruleId).toBe(
      "pa.personal.full_administration",
    );
  });

  // The mirror image of the California cascade, and the reason this pack is
  // not a copy of it: in California a residence over the cap closes both
  // economical routes at once. Here the statute severs the two questions.
  it("keeps the small-estate route open behind a house of any value", () => {
    for (const house of [400_000, 2_000_000, 25_000_000]) {
      const facts = estate({ bank: 30_000, house });
      expect(values(facts)["estate.real_estate_blocks_3102"]).toBe(false);
      expect(routeFor(facts)?.chosen?.ruleId, `house ${house}`).toBe(
        "pa.personal.3102_small_estate",
      );
    }
  });

  it("still says the real estate needs its own road", () => {
    const facts = estate({ bank: 30_000, house: 400_000 });
    const decisions = decide(PA_RULES, values(facts), WHERE);
    const realEstate = decisions.find((d) => d.decisionPoint === "real_estate_route");
    expect(realEstate?.chosen?.ruleId).toBe("pa.real_estate.needs_its_own_road");
  });
});

// ---------------------------------------------------------------------------
// Whether a will changes the route
// ---------------------------------------------------------------------------

describe("what a will does, and does not, change", () => {
  it("does not close the small-estate route", () => {
    const facts = estate({ bank: 30_000 });
    for (const hasWill of [true, false]) {
      const route = routeFor(facts, {
        "decedent.has_will": hasWill,
        "decedent.will_names_executor": hasWill,
      });
      expect(route?.chosen?.ruleId, `has_will ${hasWill}`).toBe("pa.personal.3102_small_estate");
    }
  });

  it("selects letters testamentary when the will names an executor", () => {
    const facts = estate({ bank: 45_000 });
    const decisions = decide(
      PA_RULES,
      {
        ...values(facts),
        "decedent.has_will": true,
        "decedent.will_names_executor": true,
      },
      WHERE,
    );
    const letters = decisions.find((d) => d.decisionPoint === "letters_type");
    expect(letters?.chosen?.ruleId).toBe("pa.letters.testamentary");
  });

  it("selects letters of administration when there is no will", () => {
    const facts = estate({ bank: 45_000 });
    const decisions = decide(
      PA_RULES,
      {
        ...values(facts),
        "decedent.has_will": false,
        "decedent.will_names_executor": false,
      },
      WHERE,
    );
    const letters = decisions.find((d) => d.decisionPoint === "letters_type");
    expect(letters?.chosen?.ruleId).toBe("pa.letters.administration");
    // § 3155(c): the 30-day bar on remoter classes.
    expect(letters?.chosen?.rule.then.timelineDays[0]).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Three-valued logic and gaps
// ---------------------------------------------------------------------------

describe("gaps", () => {
  it("blocks rather than guesses when it does not know whether there was a will", () => {
    const facts = estate({ bank: 45_000 });
    const decisions = decide(PA_RULES, values(facts), WHERE);
    const letters = decisions.find((d) => d.decisionPoint === "letters_type")!;
    expect(letters.chosen).toBeUndefined();
    expect(letters.needs).toContain("decedent.has_will");
  });

  it("names where to obtain every fact a blocked rule is waiting on", () => {
    const facts = estate({ bank: 45_000 });
    const decisions = decide(PA_RULES, values(facts), WHERE);
    const gaps = findGaps(decisions, PA_OBTAIN_HINTS);

    const will = gaps.find((g) => g.key === "decedent.has_will");
    expect(will?.howToObtain).toMatch(/Register of Wills/i);

    const letters = gaps.find((g) => g.key === "estate.letters_granted");
    expect(letters?.howToObtain).toMatch(/short certificate/i);
  });

  it("supplies an obtain hint for every fact the rules require", () => {
    const required = new Set(PA_RULES.flatMap((r) => r.requires));
    for (const key of required) {
      expect(PA_OBTAIN_HINTS[key], `missing hint for ${key}`).toBeTruthy();
    }
  });
});
