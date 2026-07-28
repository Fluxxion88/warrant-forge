// The demo, as a test.
//
// If this file goes red, the three-minute demo is broken. It asserts the real
// statutory thresholds, the fabrication being caught, and the cascade that a
// $20,000 change in one appraisal sets off.

import { describe, expect, it, beforeEach } from "vitest";
import { _resetIds, admit, admitAll, integrity, ledger, quarantined, values, type Fact } from "../lib/facts";
import { decide } from "../lib/rules";
import { reconcile } from "../lib/reactor";
import { gateFor } from "../lib/risk";
import { findGaps } from "../lib/gaps";
import {
  CA_OBTAIN_HINTS,
  CA_RULES,
  CA_THRESHOLDS,
  deriveCaFacts,
} from "./ca-probate";
import {
  AS_OF,
  HOYT_DOCS,
  INITIAL_CANDIDATES,
  SUPPLEMENTAL_APPRAISAL,
  SUPPLEMENTAL_CANDIDATE,
} from "../fixtures/hoyt-estate";

const WHERE = { state: "CA", county: "San Mateo" };

function build(candidates: typeof INITIAL_CANDIDATES, docs = HOYT_DOCS, now = 0) {
  const base = admitAll(candidates, docs, { now });
  const derivedFacts = deriveCaFacts(base, AS_OF, now);
  return [...base, ...derivedFacts];
}

beforeEach(() => _resetIds());

describe("statutory thresholds", () => {
  it("uses the figures in force for deaths on or after 1 April 2025", () => {
    expect(CA_THRESHOLDS.smallEstateAffidavit).toBe(208_850);
    expect(CA_THRESHOLDS.primaryResidence).toBe(750_000);
    expect(CA_THRESHOLDS.realPropertySmallValue).toBe(69_625);
    expect(CA_THRESHOLDS.waitingPeriodDays).toBe(40);
  });

  it("carries an authority and a retrieval date on every rule", () => {
    for (const rule of CA_RULES) {
      expect(rule.authority.citation).toBeTruthy();
      expect(rule.authority.sourceUrl).toMatch(/^https?:\/\//);
      expect(rule.authority.retrievedAt).toBe("2026-07-27");
    }
  });
});

describe("extraction and verification", () => {
  it("quarantines the fabricated Prudential policy", () => {
    const facts = build(INITIAL_CANDIDATES);
    const bad = quarantined(facts);
    expect(bad).toHaveLength(1);
    expect(bad[0].key).toBe("asset.prudential_policy.value");
    if (bad[0].warrant.kind === "quote") {
      expect(bad[0].warrant.verdict).toBe("unsupported");
    }
  });

  it("keeps the fabricated value out of every computation", () => {
    const facts = build(INITIAL_CANDIDATES);
    expect(values(facts)["asset.prudential_policy.value"]).toBeUndefined();
    // 18,400 + 121,000 + 9,200 = 148,600. Vehicle and life policy are excluded
    // by § 13050; the residence sits in the § 13151 petition.
    expect(values(facts)["estate.section_13100_gross_value"]).toBe(148_600);
  });

  it("reports honest integrity rather than a flattering one", () => {
    const score = integrity(build(INITIAL_CANDIDATES));
    expect(score.proposed).toBe(INITIAL_CANDIDATES.length);
    expect(score.quarantined).toBe(1);
    expect(score.integrityScore).toBeCloseTo(
      (INITIAL_CANDIDATES.length - 1) / INITIAL_CANDIDATES.length,
      5,
    );
  });

  it("locates each verified quote in its source for click-through", () => {
    const appraisal = INITIAL_CANDIDATES.find((c) => c.key === "asset.residence.value")!;
    const fact = admit(appraisal, HOYT_DOCS);
    expect(fact.status).toBe("verified");
    if (fact.warrant.kind === "quote") {
      expect(fact.warrant.span).toBeDefined();
      const doc = HOYT_DOCS.find((d) => d.name === fact.warrant.document)!;
      expect(doc.content.slice(fact.warrant.span!.start, fact.warrant.span!.end)).toContain(
        "740,000",
      );
    }
  });
});

describe("the cheap road, before the supplemental appraisal", () => {
  it("routes the residence to a § 13151 petition at $740,000", () => {
    const facts = build(INITIAL_CANDIDATES);
    expect(values(facts)["estate.residence_qualifies_13151"]).toBe(true);

    const decisions = decide(CA_RULES, values(facts), WHERE);
    const residence = decisions.find((d) => d.decisionPoint === "residence_route");
    expect(residence?.chosen?.ruleId).toBe("ca.residence.13151_petition");
    expect(residence?.chosen?.rule.then.forms.map((f) => f.code)).toContain("DE-310");
  });

  it("routes personal property to a § 13100 affidavit", () => {
    const facts = build(INITIAL_CANDIDATES);
    const decisions = decide(CA_RULES, values(facts), WHERE);
    const personal = decisions.find((d) => d.decisionPoint === "personal_property_route");
    expect(personal?.chosen?.ruleId).toBe("ca.personal.13100_affidavit");
  });

  it("applies the statewide filing fee outside San Francisco", () => {
    const facts = build(INITIAL_CANDIDATES);
    const decisions = decide(CA_RULES, values(facts), WHERE);
    const fee = decisions.find((d) => d.decisionPoint === "filing_fee");
    expect(fee?.chosen?.ruleId).toBe("ca.fee.san-mateo");
    expect(fee?.chosen?.rule.then.estCostUsd[0]).toBe(435);
  });

  it("applies the San Francisco surcharge in San Francisco", () => {
    const facts = build(INITIAL_CANDIDATES);
    const decisions = decide(CA_RULES, values(facts), { state: "CA", county: "San Francisco" });
    const fee = decisions.find((d) => d.decisionPoint === "filing_fee");
    expect(fee?.chosen?.ruleId).toBe("ca.fee.san-francisco");
    expect(fee?.chosen?.rule.then.estCostUsd[0]).toBe(450);
  });
});

describe("the threshold flip", () => {
  function runFlip() {
    const beforeFacts = build(INITIAL_CANDIDATES, HOYT_DOCS, 1);
    const beforeDecisions = decide(CA_RULES, values(beforeFacts), WHERE);

    const docs = [...HOYT_DOCS, SUPPLEMENTAL_APPRAISAL];
    const base = [
      ...admitAll(INITIAL_CANDIDATES, docs, { now: 1 }),
      admit(SUPPLEMENTAL_CANDIDATE, docs, { now: 2 }),
    ];
    const afterFacts = [...base, ...deriveCaFacts(base, AS_OF, 2)];

    const report = reconcile(
      { facts: beforeFacts, decisions: beforeDecisions },
      afterFacts,
      CA_RULES,
      WHERE,
    );
    return { beforeFacts, beforeDecisions, afterFacts, report };
  }

  it("verifies the supplemental appraisal before letting it move anything", () => {
    const { afterFacts } = runFlip();
    const residence = ledger(afterFacts).get("asset.residence.value")!;
    expect(residence.value).toBe(760_000);
    expect(residence.status).toBe("verified");
    if (residence.warrant.kind === "quote") {
      expect(residence.warrant.document).toBe("Supplemental Appraisal - 1412 Bayberry Lane.pdf");
    }
  });

  it("closes both economical routes from a single $20,000 change", () => {
    const { report } = runFlip();

    // One extracted fact moved; the two derived facts follow from it.
    const changed = report.factDeltas.map((d) => d.key);
    expect(changed).toContain("asset.residence.value");
    expect(changed).toContain("estate.residence_qualifies_13151");
    expect(changed).toContain("estate.section_13100_gross_value");

    expect(report.flippedCount).toBe(2);

    const residence = report.decisionDeltas.find((d) => d.decisionPoint === "residence_route");
    expect(residence?.before?.ruleId).toBe("ca.residence.13151_petition");
    expect(residence?.after?.ruleId).toBe("ca.residence.formal_probate");
    expect(residence?.formsAdded.map((f) => f.code)).toContain("DE-111");
    expect(residence?.formsRemoved.map((f) => f.code)).toContain("DE-310");

    const personal = report.decisionDeltas.find(
      (d) => d.decisionPoint === "personal_property_route",
    );
    expect(personal?.before?.ruleId).toBe("ca.personal.13100_affidavit");
    expect(personal?.after?.ruleId).toBe("ca.personal.formal_probate");
  });

  it("pulls the residence back into the § 13100 computation once § 13151 closes", () => {
    const { afterFacts } = runFlip();
    // 148,600 personal + 760,000 residence.
    expect(values(afterFacts)["estate.section_13100_gross_value"]).toBe(908_600);
    expect(values(afterFacts)["estate.residence_qualifies_13151"]).toBe(false);
  });

  it("does not re-evaluate decision points that cannot have moved", () => {
    const { report } = runFlip();
    expect(report.skipped).toContain("vehicle_transfer");
    expect(report.skipped).toContain("filing_fee");
    expect(report.reevaluated).toEqual(
      expect.arrayContaining(["residence_route", "personal_property_route"]),
    );
  });

  it("costs the family months, and says so", () => {
    const { report } = runFlip();
    const residence = report.decisionDeltas.find((d) => d.decisionPoint === "residence_route")!;
    const beforeMax = residence.before!.timelineDays[1];
    const afterMin = residence.after!.timelineDays[0];
    expect(afterMin).toBeGreaterThan(beforeMax);
  });
});

describe("governance", () => {
  it("requires a human to sign off before formal probate is filed", () => {
    const docs = [...HOYT_DOCS, SUPPLEMENTAL_APPRAISAL];
    const base = [
      ...admitAll(INITIAL_CANDIDATES, docs, { now: 1 }),
      admit(SUPPLEMENTAL_CANDIDATE, docs, { now: 2 }),
    ];
    const facts: Fact[] = [...base, ...deriveCaFacts(base, AS_OF, 2)];
    const decisions = decide(CA_RULES, values(facts), WHERE);

    const residence = decisions.find((d) => d.decisionPoint === "residence_route")!;
    const gate = gateFor(residence, facts);
    expect(gate.approval).toBe("review");
    expect(gate.reasons.join(" ")).toMatch(/cannot be undone/i);

    const vehicle = decisions.find((d) => d.decisionPoint === "vehicle_transfer")!;
    expect(gateFor(vehicle, facts).approval).toBe("auto");
  });

  it("names what is missing when the residence has never been appraised", () => {
    const withoutAppraisal = INITIAL_CANDIDATES.filter(
      (c) => c.key !== "asset.residence.value",
    );
    const facts = build(withoutAppraisal);
    const decisions = decide(CA_RULES, values(facts), WHERE);

    const residence = decisions.find((d) => d.decisionPoint === "residence_route")!;
    expect(residence.chosen).toBeUndefined();
    expect(gateFor(residence, facts).approval).toBe("blocked");

    const gaps = findGaps(decisions, CA_OBTAIN_HINTS);
    const gap = gaps.find((g) => g.key === "asset.residence.value");
    expect(gap?.severity).toBe("blocking");
    expect(gap?.howToObtain).toMatch(/probate referee/i);
  });
});
