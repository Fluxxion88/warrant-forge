import { describe, expect, it, beforeEach } from "vitest";
import { _resetIds, admit, admitAll, integrity, ledger, quarantined, values, type FactCandidate } from "./facts";
import { deriveAll, grossProbateableValue, type ExclusionRule } from "./derive";
import { decide, evaluateRule, type Rule } from "./rules";
import { impacted, reconcile } from "./reactor";
import { gateFor } from "./risk";
import { findGaps } from "./gaps";
import type { SourceDoc } from "./verify";

const DOCS: SourceDoc[] = [
  {
    name: "Last Will and Testament.pdf",
    content:
      "I, Margaret Ellen Hoyt, of San Mateo County, California, declare this to be my will. " +
      "I devise my residence at 1412 Bayberry Lane to the Hoyt Family Trust. " +
      "I appoint my daughter Claire Hoyt as executor of this estate.",
  },
  {
    name: "Appraisal.pdf",
    content:
      "Subject property: 1412 Bayberry Lane, San Mateo, CA. " +
      "The appraiser's opinion of market value as of the date of death is $740,000.",
  },
  {
    name: "Grant Deed.pdf",
    content:
      "GRANT DEED. Recorded 03 June 2019. Margaret Ellen Hoyt, a widow, hereby grants to " +
      "Margaret Ellen Hoyt, an unmarried woman, the real property at 1412 Bayberry Lane.",
  },
];

const HOUSE_IN_TRUST: FactCandidate[] = [
  {
    key: "asset.house.value",
    label: "Residence, 1412 Bayberry Lane",
    value: 740_000,
    unit: "USD",
    document: "Appraisal.pdf",
    quote: "The appraiser's opinion of market value as of the date of death is $740,000.",
    extractedBy: "test-model",
  },
  {
    key: "asset.house.held_in_trust",
    label: "Residence held in trust",
    value: true,
    document: "Last Will and Testament.pdf",
    quote: "I devise my residence at 1412 Bayberry Lane to the Hoyt Family Trust.",
    extractedBy: "test-model",
  },
  {
    key: "asset.savings.value",
    label: "Savings account",
    value: 82_000,
    unit: "USD",
    document: "Last Will and Testament.pdf",
    quote: "I appoint my daughter Claire Hoyt as executor of this estate.",
    extractedBy: "test-model",
  },
  {
    key: "decedent.date_of_death",
    label: "Date of death",
    value: "2026-01-04",
    document: "Appraisal.pdf",
    quote: "The appraiser's opinion of market value as of the date of death is $740,000.",
    extractedBy: "test-model",
  },
];

const EXCLUSIONS: ExclusionRule[] = [
  {
    id: "excl.trust",
    flag: "held_in_trust",
    label: "Property held in a funded revocable trust",
    citation: "Cal. Prob. Code § 13050",
    sourceUrl: "https://leginfo.legislature.ca.gov/",
  },
];

const RULES: Rule[] = [
  {
    id: "ca.route.affidavit",
    decisionPoint: "probate_route",
    jurisdiction: { state: "CA" },
    title: "Small estate affidavit",
    requires: ["estate.gross_probateable_value", "estate.days_since_death"],
    when: {
      all: [
        { fact: "estate.gross_probateable_value", op: "<=", value: 208_850 },
        { fact: "estate.days_since_death", op: ">=", value: 40 },
      ],
    },
    then: {
      conclusion: "Collect by affidavit; no court petition required.",
      forms: [{ code: "AFF-13100", title: "Affidavit for Collection of Personal Property" }],
      obligations: ["Wait 40 days from date of death", "Deliver affidavit to each holder"],
      timelineDays: [14, 45],
      estCostUsd: [0, 500],
    },
    authority: {
      citation: "Cal. Prob. Code § 13100",
      sourceUrl: "https://leginfo.legislature.ca.gov/",
      effectiveFrom: "2025-04-01",
      retrievedAt: "2026-07-27",
    },
    priority: 100,
    blastRadius: "medium",
    reversibility: "costly",
  },
  {
    id: "ca.route.formal",
    decisionPoint: "probate_route",
    jurisdiction: { state: "CA" },
    title: "Formal probate",
    requires: ["estate.gross_probateable_value"],
    when: { fact: "estate.gross_probateable_value", op: ">", value: 208_850 },
    then: {
      conclusion: "Petition the Superior Court to administer the estate.",
      forms: [
        { code: "DE-111", title: "Petition for Probate" },
        { code: "DE-121", title: "Notice of Petition to Administer Estate" },
      ],
      obligations: ["Publish notice in a newspaper of general circulation", "Obtain Letters"],
      timelineDays: [270, 540],
      estCostUsd: [3_000, 20_000],
    },
    authority: {
      citation: "Cal. Prob. Code § 8000",
      sourceUrl: "https://leginfo.legislature.ca.gov/",
      effectiveFrom: "2000-01-01",
      retrievedAt: "2026-07-27",
    },
    priority: 50,
    blastRadius: "high",
    reversibility: "irreversible",
  },
  {
    id: "ca.vehicle.dmv",
    decisionPoint: "vehicle_transfer",
    jurisdiction: { state: "CA" },
    title: "Transfer vehicle without probate",
    requires: ["asset.vehicle.value"],
    when: { fact: "asset.vehicle.value", op: "<=", value: 150_000 },
    then: {
      conclusion: "Transfer title using DMV REG 5.",
      forms: [{ code: "REG 5", title: "Affidavit for Transfer Without Probate" }],
      obligations: ["Wait 40 days from date of death"],
      timelineDays: [7, 30],
      estCostUsd: [0, 100],
    },
    authority: {
      citation: "Cal. Veh. Code § 5910",
      sourceUrl: "https://dmv.ca.gov/",
      effectiveFrom: "2000-01-01",
      retrievedAt: "2026-07-27",
    },
    priority: 10,
    blastRadius: "low",
    reversibility: "reversible",
  },
];

const AS_OF = "2026-07-27";

function buildLedger(candidates: FactCandidate[], now = 0) {
  const base = admitAll(candidates, DOCS, { now });
  const { facts: derivedFacts, derivation } = deriveAll(base, EXCLUSIONS, AS_OF, { now });
  return { facts: [...base, ...derivedFacts], derivation };
}

beforeEach(() => _resetIds());

describe("fact ledger", () => {
  it("admits a fact whose quote appears verbatim in the cited document", () => {
    const fact = admit(HOUSE_IN_TRUST[0], DOCS);
    expect(fact.status).toBe("verified");
    expect(fact.warrant.kind).toBe("quote");
    if (fact.warrant.kind === "quote") {
      expect(fact.warrant.verdict).toBe("verified");
      expect(fact.warrant.span).toBeDefined();
    }
  });

  it("quarantines a fabricated quote and keeps it out of the decision-visible ledger", () => {
    const fabricated: FactCandidate = {
      key: "asset.life_policy.value",
      label: "Life insurance policy",
      value: 50_000,
      document: "Last Will and Testament.pdf",
      quote: "I leave the proceeds of my Prudential life insurance policy of $50,000 to my son.",
      extractedBy: "test-model",
    };
    const fact = admit(fabricated, DOCS);
    expect(fact.status).toBe("quarantined");

    const all = [...admitAll(HOUSE_IN_TRUST, DOCS), fact];
    expect(ledger(all).has("asset.life_policy.value")).toBe(false);
    expect(quarantined(all).map((f) => f.key)).toContain("asset.life_policy.value");
    expect(values(all)["asset.life_policy.value"]).toBeUndefined();
  });

  it("scores integrity over model-proposed facts only", () => {
    const { facts } = buildLedger(HOUSE_IN_TRUST);
    const score = integrity(facts);
    expect(score.proposed).toBe(HOUSE_IN_TRUST.length);
    expect(score.verified).toBe(HOUSE_IN_TRUST.length);
    expect(score.integrityScore).toBe(1);
  });

  it("prefers the later value when a fact is restated", () => {
    const early = admit(HOUSE_IN_TRUST[0], DOCS, { now: 1 });
    const late = admit({ ...HOUSE_IN_TRUST[0], value: 760_000 }, DOCS, { now: 2 });
    expect(ledger([early, late]).get("asset.house.value")?.value).toBe(760_000);
  });
});

describe("derivation", () => {
  it("excludes trust-held property from the gross probateable value", () => {
    const base = admitAll(HOUSE_IN_TRUST, DOCS);
    const result = grossProbateableValue(base, EXCLUSIONS);
    expect(result.total).toBe(82_000);
    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0].rule.citation).toBe("Cal. Prob. Code § 13050");
  });

  it("records the inputs that produced a derived total", () => {
    const base = admitAll(HOUSE_IN_TRUST, DOCS);
    const { fact } = grossProbateableValue(base, EXCLUSIONS);
    expect(fact.warrant.kind).toBe("derivation");
    if (fact.warrant.kind === "derivation") {
      expect(fact.warrant.inputs).toContain("asset.savings.value");
      expect(fact.warrant.inputs).toContain("asset.house.held_in_trust");
    }
  });

  it("computes days since death from the date of death", () => {
    const { facts } = buildLedger(HOUSE_IN_TRUST);
    expect(values(facts)["estate.days_since_death"]).toBeGreaterThan(40);
  });
});

describe("rule evaluation", () => {
  it("blocks rather than denies when a required fact is missing", () => {
    const result = evaluateRule(RULES[0], { "estate.days_since_death": 90 });
    expect(result.outcome).toBe("blocked");
    expect(result.condition).toBe("unknown");
    expect(result.blockedBy).toContain("estate.gross_probateable_value");
  });

  it("records every fact key it consulted", () => {
    const result = evaluateRule(RULES[0], {
      "estate.gross_probateable_value": 82_000,
      "estate.days_since_death": 200,
    });
    expect(result.outcome).toBe("fired");
    expect(result.dependsOn).toEqual([
      "estate.days_since_death",
      "estate.gross_probateable_value",
    ]);
  });

  it("resolves competing rules by priority", () => {
    const decisions = decide(
      RULES,
      { "estate.gross_probateable_value": 82_000, "estate.days_since_death": 200 },
      { state: "CA" },
    );
    const route = decisions.find((d) => d.decisionPoint === "probate_route");
    expect(route?.chosen?.ruleId).toBe("ca.route.affidavit");
  });

  it("produces a readable trace of the comparison it made", () => {
    const result = evaluateRule(RULES[1], { "estate.gross_probateable_value": 822_000 });
    expect(result.outcome).toBe("fired");
    expect(result.trace.some((t) => t.description.includes("822,000"))).toBe(true);
  });
});

describe("the threshold flip", () => {
  it("re-evaluates only decision points that depend on a changed fact", () => {
    const before = buildLedger(HOUSE_IN_TRUST, 1);
    const beforeDecisions = decide(RULES, values(before.facts), { state: "CA" });
    expect(beforeDecisions.find((d) => d.decisionPoint === "probate_route")?.chosen?.ruleId).toBe(
      "ca.route.affidavit",
    );

    // The grant deed shows the house was never retitled into the trust.
    const deedCorrection: FactCandidate = {
      key: "asset.house.held_in_trust",
      label: "Residence held in trust",
      value: false,
      document: "Grant Deed.pdf",
      quote:
        "Margaret Ellen Hoyt, a widow, hereby grants to Margaret Ellen Hoyt, an unmarried woman, the real property at 1412 Bayberry Lane.",
      extractedBy: "test-model",
    };
    const corrected = admit(deedCorrection, DOCS, { now: 2 });
    expect(corrected.status).toBe("verified");

    const nextBase = [...admitAll(HOUSE_IN_TRUST, DOCS, { now: 1 }), corrected];
    const { facts: nextDerived } = deriveAll(nextBase, EXCLUSIONS, AS_OF, { now: 2 });
    const nextFacts = [...nextBase, ...nextDerived];

    const report = reconcile(
      { facts: before.facts, decisions: beforeDecisions },
      nextFacts,
      RULES,
      { state: "CA" },
    );

    expect(report.factDeltas.map((d) => d.key)).toContain("asset.house.held_in_trust");
    expect(report.factDeltas.map((d) => d.key)).toContain("estate.gross_probateable_value");

    // The vehicle decision reads none of the changed facts, so it is not re-run.
    expect(report.skipped).toContain("vehicle_transfer");
    expect(report.reevaluated).toContain("probate_route");

    expect(report.flippedCount).toBe(1);
    const flip = report.decisionDeltas.find((d) => d.decisionPoint === "probate_route");
    expect(flip?.before?.ruleId).toBe("ca.route.affidavit");
    expect(flip?.after?.ruleId).toBe("ca.route.formal");
    expect(flip?.formsAdded.map((f) => f.code)).toContain("DE-111");
    expect(flip?.triggeredBy).toContain("estate.gross_probateable_value");
  });

  it("names the decision points that cannot have moved", () => {
    const decisions = decide(
      RULES,
      { "estate.gross_probateable_value": 82_000, "estate.days_since_death": 200 },
      { state: "CA" },
    );
    const { reevaluate, skip } = impacted(decisions, ["asset.savings.value"]);
    expect(skip).toContain("vehicle_transfer");
    expect(reevaluate).not.toContain("vehicle_transfer");
  });
});

describe("approval gate", () => {
  it("requires human sign-off for an irreversible, high-blast-radius route", () => {
    const facts = buildLedger(HOUSE_IN_TRUST).facts;
    const decisions = decide(RULES, { "estate.gross_probateable_value": 822_000 }, { state: "CA" });
    const route = decisions.find((d) => d.decisionPoint === "probate_route")!;
    const gate = gateFor(route, facts);
    expect(gate.approval).toBe("review");
    expect(gate.reasons.join(" ")).toMatch(/cannot be undone/i);
  });

  it("allows a reversible, low-impact action to proceed automatically", () => {
    const facts = buildLedger(HOUSE_IN_TRUST).facts;
    const decisions = decide(RULES, { "asset.vehicle.value": 9_000 }, { state: "CA" });
    const vehicle = decisions.find((d) => d.decisionPoint === "vehicle_transfer")!;
    expect(gateFor(vehicle, facts).approval).toBe("auto");
  });

  it("refuses to conclude when the decision point is blocked", () => {
    const decisions = decide(RULES, {}, { state: "CA" });
    const route = decisions.find((d) => d.decisionPoint === "probate_route")!;
    expect(gateFor(route, []).approval).toBe("blocked");
  });
});

describe("gap detection", () => {
  it("names the missing fact and the rule waiting on it", () => {
    const decisions = decide(RULES, {}, { state: "CA" });
    const gaps = findGaps(decisions, {
      "asset.vehicle.value": "Kelley Blue Book valuation as at date of death",
    });
    const vehicleGap = gaps.find((g) => g.key === "asset.vehicle.value");
    expect(vehicleGap?.severity).toBe("blocking");
    expect(vehicleGap?.blocks).toContain("vehicle_transfer");
    expect(vehicleGap?.howToObtain).toMatch(/Blue Book/);
    expect(vehicleGap?.wantedBy[0].citation).toBe("Cal. Veh. Code § 5910");
  });
});
