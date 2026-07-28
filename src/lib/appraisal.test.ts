import { describe, expect, it } from "vitest";
import {
  CITATIONS,
  appraisalAdvice,
  reappraisalNeeded,
  refereeCommission,
  thresholdRisk,
} from "./appraisal";
import { CA_THRESHOLDS } from "../rules/ca-probate";

describe("what an appraisal costs", () => {
  it("charges one tenth of one percent", () => {
    // § 8961(a). On a $740,000 house that is $740 — real, and small beside what
    // the threshold question is worth.
    expect(refereeCommission(740_000).commissionUsd).toBe(740);
  });

  it("applies the statutory floor and ceiling", () => {
    // § 8963(a): not less than $75, not more than $10,000.
    expect(refereeCommission(10_000).commissionUsd).toBe(75);
    expect(refereeCommission(10_000).atMinimum).toBe(true);
    expect(refereeCommission(50_000_000).commissionUsd).toBe(10_000);
    expect(refereeCommission(50_000_000).atCap).toBe(true);
  });

  it("warns that the cap is a floor for planning, not a limit", () => {
    // § 8963(b) lets the referee apply for more. Presenting $10,000 as the
    // worst case on a large estate would understate it.
    const big = refereeCommission(50_000_000);
    expect(big.notes.join(" ")).toMatch(/apply to the court for more/);
  });

  it("never quietly omits expenses from the estimate", () => {
    expect(refereeCommission(500_000).notes.join(" ")).toMatch(/expenses are charged on top/);
  });

  it("excludes cash the representative appraises, and says what that saved", () => {
    // § 8901 assigns accounts to the representative; § 8961(a) excludes that
    // property from the commission base. Putting bank balances on the wrong
    // attachment costs a tenth of a percent of every dollar of cash.
    const withCash = refereeCommission(1_240_000, 500_000);
    expect(withCash.refereeBaseUsd).toBe(740_000);
    expect(withCash.commissionUsd).toBe(740);
    expect(withCash.savedUsd).toBe(500);
  });

  it("quotes the statute verbatim for every figure it uses", () => {
    for (const c of Object.values(CITATIONS)) {
      expect(c.quote.length).toBeGreaterThan(30);
      expect(c.url).toMatch(/leginfo\.legislature\.ca\.gov/);
      expect(c.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(CITATIONS.commission.quote).toMatch(/one-tenth of one percent/);
    expect(CITATIONS.commissionBounds.quote).toMatch(/seventy-five dollars/);
    expect(CITATIONS.dateOfDeathValue.quote).toMatch(/at the time of the decedent/);
  });
});

describe("when a further appraisal is actually required", () => {
  it("refuses to re-appraise because the market moved", () => {
    // The expensive misconception. The inventory states the date-of-death
    // value, and that date does not move.
    const v = reappraisalNeeded("market_moved");
    expect(v.required).toBe(false);
    expect(v.avoidable).toBe(true);
    expect(v.citation?.code).toBe("Cal. Prob. Code § 8802");
  });

  it("refuses to re-appraise to match a sale price", () => {
    const v = reappraisalNeeded("sale_at_different_price");
    expect(v.required).toBe(false);
    expect(v.why).toMatch(/gain or loss/);
  });

  it("requires a supplemental for newly discovered property, on that property only", () => {
    const v = reappraisalNeeded("newly_discovered_property");
    expect(v.required).toBe(true);
    expect(v.why).toMatch(/not to the estate again/);
  });

  it("treats a pre-death change in the property as part of the date-of-death value", () => {
    for (const r of ["improvement_before_death", "damage_before_death"] as const) {
      const v = reappraisalNeeded(r);
      expect(v.required).toBe(true);
      expect(v.citation?.code).toBe("Cal. Prob. Code § 8802");
    }
  });
});

describe("where accuracy is worth more than economy", () => {
  const thresholds = [
    {
      usd: CA_THRESHOLDS.primaryResidence,
      label: "§ 13151 primary-residence petition",
      authority: "Cal. Prob. Code §§ 13151–13154",
    },
    {
      usd: CA_THRESHOLDS.smallEstateAffidavit,
      label: "§ 13100 small-estate affidavit",
      authority: "Cal. Prob. Code §§ 13100, 13101",
    },
  ];

  it("flags a value sitting on the line", () => {
    // The demo estate: $740,000 against a $750,000 cap is 1.3% of headroom.
    const [closest] = thresholdRisk(740_000, thresholds);
    expect(closest.label).toMatch(/13151/);
    expect(closest.band).toBe("on_the_line");
    expect(closest.headroomUsd).toBe(10_000);
    expect(closest.advice).toMatch(/Buy accuracy here/);
  });

  it("tells you a route may be recoverable when only just over", () => {
    const [closest] = thresholdRisk(760_000, thresholds);
    expect(closest.headroomUsd).toBeLessThan(0);
    expect(closest.advice).toMatch(/second opinion/);
  });

  it("does not cry wolf on a value nowhere near a threshold", () => {
    const [closest] = thresholdRisk(120_000, thresholds);
    expect(closest.band).toBe("comfortable");
    expect(closest.advice).toMatch(/Not sensitive/);
  });

  it("ranks the nearest threshold first", () => {
    const risks = thresholdRisk(740_000, thresholds);
    expect(risks[0].marginPct).toBeLessThanOrEqual(risks[1].marginPct);
  });
});

describe("advice for a whole estate", () => {
  it("names the saving, the amount and the authority for it", () => {
    const a = appraisalAdvice({
      totalEstateUsd: 1_240_000,
      cashAndAccountsUsd: 500_000,
      valued: {
        valueUsd: 740_000,
        thresholds: [
          {
            usd: 750_000,
            label: "§ 13151",
            authority: "Cal. Prob. Code §§ 13151–13154",
          },
        ],
      },
    });

    const cash = a.savings.find((s) => s.what.match(/Appraise cash/));
    expect(cash?.amountUsd).toBe(500);
    expect(cash?.because).toMatch(/§ 8901/);
    expect(cash?.because).toMatch(/§ 8961/);

    // And the standing advice that costs nothing to follow.
    expect(a.savings.some((s) => s.what.match(/market moved/))).toBe(true);
    expect(a.risks[0].band).toBe("on_the_line");
  });
});
