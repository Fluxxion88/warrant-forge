// What an appraisal costs, and when you are paying for one you do not need.
//
// Every figure and rule below was read from leginfo.legislature.ca.gov on
// 2026-07-28 and is quoted verbatim in CITATIONS, because a wrong number here
// tells a family to spend money they do not have to spend.
//
// Three things save real money, and all three are routinely got wrong.
//
// **A probate appraisal is as of the date of death, and only that date.**
// § 8802 says the inventory states "the fair market value of the item at the
// time of the decedent's death". The market moving afterwards does not change
// the figure that belongs on the inventory, so paying for a fresh appraisal
// because the house is worth more this month is paying for nothing. The
// exceptions are narrow: newly discovered property, and correcting a genuine
// error.
//
// **The personal representative appraises cash themselves, and it is free.**
// § 8901 assigns money, cash items, accounts in financial institutions and
// money market funds to the personal representative. § 8961(a) then computes
// the referee's commission "excluding property appraised by the personal
// representative pursuant to Section 8901". Putting bank balances on the
// referee's attachment instead of the representative's is a common slip and it
// costs one tenth of one percent of every dollar of cash in the estate.
//
// **The commission is proportional, so the number that matters is not the
// referee's fee.** On a $740,000 house the commission is $740 — real, but
// small beside what an appraisal *near a statutory threshold* is worth. Ten
// thousand dollars of headroom under the § 13151 cap is the difference between
// one petition and full administration: months, and thousands. Where a value
// sits close to a threshold, the thing to buy is accuracy, not economy.

export interface Citation {
  code: string;
  quote: string;
  url: string;
  retrievedAt: string;
}

const LEGINFO = (n: string) =>
  `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PROB&sectionNum=${n}`;

const RETRIEVED = "2026-07-28";

export const CITATIONS: Record<string, Citation> = {
  dateOfDeathValue: {
    code: "Cal. Prob. Code § 8802",
    quote:
      "The inventory and appraisal shall separately list each item and shall state the fair " +
      "market value of the item at the time of the decedent’s death in monetary terms opposite the item.",
    url: LEGINFO("8802"),
    retrievedAt: RETRIEVED,
  },
  representativeAppraises: {
    code: "Cal. Prob. Code § 8901",
    quote:
      "The personal representative shall appraise the following property, excluding items whose " +
      "fair market value is, in the opinion of the personal representative, an amount different " +
      "from the face value of the property:",
    url: LEGINFO("8901"),
    retrievedAt: RETRIEVED,
  },
  commission: {
    code: "Cal. Prob. Code § 8961(a)",
    quote:
      "A commission of one-tenth of one percent of the total value of the property for each " +
      "estate appraised, subject to Section 8963. The commission shall be computed excluding " +
      "property appraised by the personal representative pursuant to Section 8901 or by an " +
      "independent expert pursuant to Section 8904.",
    url: LEGINFO("8961"),
    retrievedAt: RETRIEVED,
  },
  expenses: {
    code: "Cal. Prob. Code § 8961(b)",
    quote: "Actual and necessary expenses for each estate appraised.",
    url: LEGINFO("8961"),
    retrievedAt: RETRIEVED,
  },
  commissionBounds: {
    code: "Cal. Prob. Code § 8963(a)",
    quote:
      "the commission of the probate referee shall in no event be less than seventy-five dollars " +
      "($75) nor more than ten thousand dollars ($10,000) for any estate appraised.",
    url: LEGINFO("8963"),
    retrievedAt: RETRIEVED,
  },
  commissionAboveCap: {
    code: "Cal. Prob. Code § 8963(b)",
    quote:
      "Upon application of the probate referee, the court may allow a commission in excess of ten " +
      "thousand dollars ($10,000) if the court determines that the reasonable value of the " +
      "referee’s services exceeds that amount.",
    url: LEGINFO("8963"),
    retrievedAt: RETRIEVED,
  },
};

export const COMMISSION_RATE = 0.001;
export const COMMISSION_MIN = 75;
export const COMMISSION_MAX = 10_000;

export interface CommissionEstimate {
  /** Value the referee actually appraises. */
  refereeBaseUsd: number;
  /** Value the representative may appraise at no commission. */
  selfAppraisedUsd: number;
  commissionUsd: number;
  /** Commission avoided by appraising cash under § 8901 rather than referring it. */
  savedUsd: number;
  atMinimum: boolean;
  atCap: boolean;
  notes: string[];
}

/**
 * Estimate the referee's commission, and what self-appraising cash saves.
 *
 * `selfAppraisedUsd` is the § 8901 property — money, cash items, accounts in
 * financial institutions, money market funds. Excluded from the commission
 * base, and the saving is stated explicitly because the alternative is that
 * nobody notices it was available.
 *
 * Expenses under § 8961(b) are additional, real and not estimable here; the
 * caller is told so rather than shown a total that quietly omits them.
 */
export function refereeCommission(
  totalEstateUsd: number,
  selfAppraisedUsd = 0,
): CommissionEstimate {
  const base = Math.max(0, totalEstateUsd - selfAppraisedUsd);
  const raw = base * COMMISSION_RATE;
  const commission = Math.min(Math.max(raw, COMMISSION_MIN), COMMISSION_MAX);

  // What it would have cost with the cash left in the referee's base.
  const rawAll = totalEstateUsd * COMMISSION_RATE;
  const withoutSplit = Math.min(Math.max(rawAll, COMMISSION_MIN), COMMISSION_MAX);

  const notes = [
    `Actual and necessary expenses are charged on top and are not included here (${CITATIONS.expenses.code}).`,
  ];
  if (raw < COMMISSION_MIN) {
    notes.push(`Below the $${COMMISSION_MIN} statutory minimum, so the minimum applies.`);
  }
  if (rawAll > COMMISSION_MAX) {
    notes.push(
      `Above the $${COMMISSION_MAX.toLocaleString("en-US")} cap. The referee may apply to the ` +
        `court for more (${CITATIONS.commissionAboveCap.code}), so treat the cap as a floor for planning.`,
    );
  }

  return {
    refereeBaseUsd: base,
    selfAppraisedUsd,
    commissionUsd: Math.round(commission * 100) / 100,
    savedUsd: Math.round((withoutSplit - commission) * 100) / 100,
    atMinimum: raw < COMMISSION_MIN,
    atCap: raw > COMMISSION_MAX,
    notes,
  };
}

export type ReappraisalReason =
  | "market_moved"
  | "newly_discovered_property"
  | "clerical_error"
  | "value_disputed"
  | "sale_at_different_price"
  | "improvement_before_death"
  | "damage_before_death";

export interface ReappraisalVerdict {
  required: boolean;
  what: string;
  why: string;
  citation?: Citation;
  /** Roughly what avoiding an unnecessary appraisal is worth. */
  avoidable: boolean;
}

/**
 * Is a further appraisal actually required?
 *
 * The common and expensive misconception is that a change in what a property is
 * worth today obliges a new appraisal. It does not: the inventory states the
 * value at the date of death, and that date does not move.
 */
export function reappraisalNeeded(reason: ReappraisalReason): ReappraisalVerdict {
  switch (reason) {
    case "market_moved":
      return {
        required: false,
        what: "No new appraisal for probate purposes.",
        why:
          "The inventory states the value at the date of death, and that value does not " +
          "change because the market has. A later appraisal may matter for a sale, for " +
          "income tax basis, or for a beneficiary's own decision — but not for this filing.",
        citation: CITATIONS.dateOfDeathValue,
        avoidable: true,
      };
    case "sale_at_different_price":
      return {
        required: false,
        what: "No new appraisal. Report the sale, do not re-value the inventory.",
        why:
          "A sale above or below the appraised figure is reported as a gain or loss against " +
          "the date-of-death value. It is not evidence that the date-of-death appraisal was " +
          "wrong, and re-appraising to match the sale price is both unnecessary and, if the " +
          "sale was not at arm's length, misleading.",
        citation: CITATIONS.dateOfDeathValue,
        avoidable: true,
      };
    case "newly_discovered_property":
      return {
        required: true,
        what: "A supplemental inventory and appraisal covering the new property only.",
        why:
          "Property found after the inventory was filed is added by supplement. Only the new " +
          "items are appraised, so the commission attaches to their value, not to the estate again.",
        avoidable: false,
      };
    case "clerical_error":
      return {
        required: true,
        what: "A corrected inventory and appraisal.",
        why:
          "An error in the figure filed is corrected on the record. This is a correction, not " +
          "a revaluation, and it does not reopen the date-of-death question.",
        avoidable: false,
      };
    case "value_disputed":
      return {
        required: true,
        what: "An independent appraisal, or an objection to the referee's figure.",
        why:
          "A genuinely contested valuation is resolved by evidence, not by ordering another " +
          "routine appraisal from the same source. Budget for an expert, not a second referee.",
        avoidable: false,
      };
    case "improvement_before_death":
    case "damage_before_death":
      return {
        required: true,
        what: "Ensure the appraisal reflects the property's condition at the date of death.",
        why:
          "A change in the property itself before death is part of what the date-of-death value " +
          "is. If the appraisal missed it, the appraisal is wrong and should be corrected.",
        citation: CITATIONS.dateOfDeathValue,
        avoidable: false,
      };
  }
}

export interface ThresholdRisk {
  thresholdUsd: number;
  label: string;
  authority: string;
  headroomUsd: number;
  /** Headroom as a share of the threshold. */
  marginPct: number;
  /** How wrong the appraisal has to be to change the answer. */
  band: "on_the_line" | "tight" | "comfortable";
  advice: string;
}

/**
 * How close a value sits to a threshold that changes the procedure.
 *
 * This is where appraisal money is actually decided. A cheap appraisal that
 * lands $5,000 the wrong side of a cap costs months of administration; an
 * expensive one that lands it correctly is the bargain. The bands are stated so
 * a specialist can see at a glance whether accuracy is worth paying for here.
 */
export function thresholdRisk(
  valueUsd: number,
  thresholds: { usd: number; label: string; authority: string }[],
): ThresholdRisk[] {
  return thresholds
    .map((t) => {
      const headroom = t.usd - valueUsd;
      const marginPct = t.usd === 0 ? 0 : (Math.abs(headroom) / t.usd) * 100;
      const band: ThresholdRisk["band"] =
        marginPct < 2 ? "on_the_line" : marginPct < 8 ? "tight" : "comfortable";
      const over = headroom < 0;
      return {
        thresholdUsd: t.usd,
        label: t.label,
        authority: t.authority,
        headroomUsd: Math.round(headroom),
        marginPct: Math.round(marginPct * 10) / 10,
        band,
        advice:
          band === "on_the_line"
            ? over
              ? `Only ${marginPct.toFixed(1)}% over. An appraisal argued down slightly brings this route back — worth a second opinion before abandoning it.`
              : `Only ${marginPct.toFixed(1)}% of headroom. A small appraisal error closes this route. Buy accuracy here; the referee's commission is trivial beside what the route is worth.`
            : band === "tight"
              ? `${marginPct.toFixed(1)}% ${over ? "over" : "of headroom"}. Worth confirming the figure before filing.`
              : `${marginPct.toFixed(1)}% ${over ? "over" : "of headroom"}. Not sensitive to ordinary appraisal variation.`,
      };
    })
    .sort((a, b) => a.marginPct - b.marginPct);
}

export interface AppraisalAdvice {
  commission: CommissionEstimate;
  risks: ThresholdRisk[];
  savings: { what: string; amountUsd?: number; because: string }[];
}

/**
 * Everything worth saying about appraisal for one estate: what it will cost,
 * what is avoidable, and where accuracy is worth more than economy.
 */
export function appraisalAdvice(input: {
  totalEstateUsd: number;
  cashAndAccountsUsd: number;
  /** Values that sit near a procedural threshold. */
  valued?: { valueUsd: number; thresholds: { usd: number; label: string; authority: string }[] };
}): AppraisalAdvice {
  const commission = refereeCommission(input.totalEstateUsd, input.cashAndAccountsUsd);
  const risks = input.valued ? thresholdRisk(input.valued.valueUsd, input.valued.thresholds) : [];

  const savings: AppraisalAdvice["savings"] = [];
  if (commission.savedUsd > 0) {
    savings.push({
      what: "Appraise cash and financial accounts yourself, on the representative's attachment",
      amountUsd: commission.savedUsd,
      because:
        `${CITATIONS.representativeAppraises.code} assigns them to the personal representative, and ` +
        `${CITATIONS.commission.code} excludes that property from the commission base.`,
    });
  }
  savings.push({
    what: "Do not re-appraise because the market moved",
    because:
      `${CITATIONS.dateOfDeathValue.code}: the inventory states the value at the date of death. ` +
      `A later change in what the property is worth does not change the figure that belongs on it.`,
  });

  return { commission, risks, savings };
}
