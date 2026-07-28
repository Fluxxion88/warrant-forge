import { describe, expect, it, beforeEach } from "vitest";
import { _resetIds, admitAll, values } from "../lib/facts";
import { decide } from "../lib/rules";
import {
  CA_COUNTIES,
  CA_COUNTY_NAMES,
  STATEWIDE_FIRST_PAPER_FEE,
  countyRules,
  coverage,
  county,
} from "./ca-counties";
import { CA_RULES, deriveCaFacts } from "./ca-probate";
import { AS_OF, HOYT_DOCS, INITIAL_CANDIDATES } from "../fixtures/hoyt-estate";

function facts() {
  const base = admitAll(INITIAL_CANDIDATES, HOYT_DOCS, { now: 1 });
  return [...base, ...deriveCaFacts(base, AS_OF, 1)];
}

beforeEach(() => _resetIds());

describe("county registry", () => {
  it("covers all 58 California counties", () => {
    expect(CA_COUNTY_NAMES).toHaveLength(58);
    expect(CA_COUNTIES).toHaveLength(58);
    expect(new Set(CA_COUNTY_NAMES).size).toBe(58);
  });

  it("knows the filing fee for every county, because the schedule enumerates its own exceptions", () => {
    for (const c of CA_COUNTIES) {
      expect(c.firstPaperFeeUsd).toBeGreaterThan(0);
      expect(c.feeAuthority.citation).toMatch(/Gov\. Code/);
    }
    const report = coverage();
    // Only Riverside and San Francisco actually differ on the probate first paper.
    expect(report.feeVariances.map((f) => f.name).sort()).toEqual([
      "Riverside",
      "San Francisco",
    ]);
    expect(county("San Francisco")?.firstPaperFeeUsd).toBe(450);
    expect(county("Riverside")?.firstPaperFeeUsd).toBe(450);
    expect(county("San Bernardino")?.firstPaperFeeUsd).toBe(STATEWIDE_FIRST_PAPER_FEE);
    expect(county("Alpine")?.firstPaperFeeUsd).toBe(STATEWIDE_FIRST_PAPER_FEE);
  });

  it("is honest about which counties have had their local rules read", () => {
    const report = coverage();
    expect(report.verified).toBe(3);
    expect(report.notResearched).toBe(55);
    expect(report.verified + report.notResearched).toBe(report.total);
  });

  it("carries real local requirements for the counties that were researched", () => {
    expect(county("Los Angeles")?.localForms.map((f) => f.code)).toContain("PRO 010");
    expect(county("San Mateo")?.localForms.map((f) => f.code)).toContain("PR-5");
    expect(county("San Francisco")?.obligations.join(" ")).toMatch(/DE-147S/);
  });

  it("records where widely-circulated sources are stale", () => {
    const la = county("Los Angeles")!;
    expect(la.staleDataWarnings?.join(" ")).toMatch(/PRO 037/);
    expect(la.staleDataWarnings?.join(" ")).toMatch(/lacourt\.ca\.gov/);
  });

  it("generates two rules per county", () => {
    expect(countyRules()).toHaveLength(58 * 2);
  });
});

describe("county rules in use", () => {
  it("surfaces local requirements in a researched county", () => {
    const decisions = decide(CA_RULES, values(facts()), { state: "CA", county: "San Mateo" });
    const local = decisions.find((d) => d.decisionPoint === "county_requirements");
    expect(local?.chosen?.ruleId).toBe("ca.local.san-mateo");
    expect(local?.chosen?.rule.then.obligations.join(" ")).toMatch(/PR-5/);
  });

  it("says so plainly in a county nobody has researched", () => {
    const decisions = decide(CA_RULES, values(facts()), { state: "CA", county: "Modoc" });
    const local = decisions.find((d) => d.decisionPoint === "county_requirements");
    expect(local?.chosen?.ruleId).toBe("ca.local.unverified.modoc");
    expect(local?.chosen?.rule.then.conclusion).toMatch(/have not been read/i);
    // The statewide answer is still produced — only the local overlay is unknown.
    const route = decisions.find((d) => d.decisionPoint === "residence_route");
    expect(route?.chosen?.ruleId).toBe("ca.residence.13151_petition");
  });

  it("charges the surcharge only where the schedule says it applies", () => {
    for (const [name, expected] of [
      ["Riverside", 450],
      ["San Francisco", 450],
      ["Los Angeles", 435],
      ["Yuba", 435],
    ] as const) {
      const decisions = decide(CA_RULES, values(facts()), { state: "CA", county: name });
      const fee = decisions.find((d) => d.decisionPoint === "filing_fee");
      expect(fee?.chosen?.rule.then.estCostUsd[0], name).toBe(expected);
    }
  });

  it("scopes each county's rules to that county only", () => {
    const decisions = decide(CA_RULES, values(facts()), { state: "CA", county: "San Mateo" });
    const fee = decisions.find((d) => d.decisionPoint === "filing_fee")!;
    // Exactly one fee rule is in scope, so there is nothing to resolve on priority.
    expect(fee.alsoFired).toHaveLength(0);
  });
});

describe("rule corrections", () => {
  it("does not claim formal probate where a spouse survives", () => {
    const decisions = decide(
      CA_RULES,
      {
        "asset.residence.value": 900_000,
        "estate.residence_qualifies_13151": false,
        "decedent.has_surviving_spouse": true,
        "estate.county": "San Mateo",
      },
      { state: "CA", county: "San Mateo" },
    );
    const route = decisions.find((d) => d.decisionPoint === "residence_route");
    expect(route?.chosen?.ruleId).toBe("ca.residence.spousal_petition");
    expect(route?.chosen?.rule.then.forms.map((f) => f.code)).toContain("DE-221");
  });

  it("still reaches formal probate where no spouse survives", () => {
    const decisions = decide(
      CA_RULES,
      {
        "asset.residence.value": 900_000,
        "estate.residence_qualifies_13151": false,
        "decedent.has_surviving_spouse": false,
        "estate.county": "San Mateo",
      },
      { state: "CA", county: "San Mateo" },
    );
    expect(
      decisions.find((d) => d.decisionPoint === "residence_route")?.chosen?.ruleId,
    ).toBe("ca.residence.formal_probate");
  });

  it("applies the six-month wait to a § 13200 affidavit, not the 40-day rule", () => {
    const under = {
      "asset.residence.value": 60_000,
      "estate.residence_qualifies_13151": true,
      "decedent.has_surviving_spouse": false,
      "estate.county": "San Mateo",
    };
    const tooSoon = decide(
      CA_RULES,
      { ...under, "estate.days_since_death": 60 },
      { state: "CA", county: "San Mateo" },
    );
    expect(
      tooSoon.find((d) => d.decisionPoint === "residence_route")?.chosen?.ruleId,
    ).not.toBe("ca.residence.13200_affidavit");

    const ripe = decide(
      CA_RULES,
      { ...under, "estate.days_since_death": 200 },
      { state: "CA", county: "San Mateo" },
    );
    expect(ripe.find((d) => d.decisionPoint === "residence_route")?.chosen?.ruleId).toBe(
      "ca.residence.13200_affidavit",
    );
  });

  it("labels practice estimates so they cannot be mistaken for sourced figures", () => {
    const petition = CA_RULES.find((r) => r.id === "ca.residence.13151_petition")!;
    expect(petition.estimates?.timelineDays).toMatch(/estimate/i);
    expect(petition.then.obligations.join(" ")).toMatch(/five business days/i);
  });
});
