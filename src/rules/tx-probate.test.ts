// The Texas pack, as a test.
//
// Three jobs, in the order the brief sets them:
//
//   (a) every threshold equals the figure quoted from the statute, with the
//       provision named in the test itself so a reader can check the number
//       without opening the pack;
//   (b) every rule carries a citation, a source URL and the retrieval date;
//   (c) the route decision is exercised on both sides of the $75,000 cap —
//       and, because Texas's cheapest route has no cap at all, on both sides
//       of the debt test that governs it instead.
//
// Facts are built through `admitRecord` against a synthetic estate record, so
// the tests run the real warrant machinery rather than hand-assembling Fact
// objects. A path that stopped matching would quarantine the fact and fail
// these tests loudly, which is the behaviour worth having.

import { describe, expect, it, beforeEach } from "vitest";
import {
  _resetIds,
  admitRecord,
  ledger,
  quarantined,
  readPath,
  values,
  type Fact,
  type FactValue,
} from "../lib/facts";
import { decide } from "../lib/rules";
import {
  TX_EXCLUSIONS,
  TX_OBTAIN_HINTS,
  TX_PACK,
  TX_RULES,
  TX_SOURCES,
  TX_THRESHOLDS,
  deriveTxFacts,
  fourthAnniversary,
} from "./tx-probate";

const WHERE = { state: "TX", county: "Travis" };
const AS_OF = "2026-07-28";
const SYSTEM = "warrant-test-fixture";
const RECORD_ID = "tx-estate-01";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

interface AssetSpec {
  label: string;
  value: number;
  homestead?: boolean;
  exempt_property?: boolean;
  has_named_beneficiary?: boolean;
  transfer_on_death_deed?: boolean;
}

interface TxRecord {
  decedent: {
    date_of_death: string;
    testate: boolean;
    will: { directs_independent: boolean; prohibits_independent: boolean };
    family_allowance_claimant: boolean;
  };
  estate: {
    unpaid_unsecured_debt: boolean;
    pr_petition_pending: boolean;
    exceeds_family_allowance: boolean;
    all_distributees_agree: boolean;
    heirship_determined: boolean;
    county: string;
  };
  assets: Record<string, AssetSpec>;
}

/**
 * An intestate Travis County estate that lands just under the cap: $40,000 of
 * cash plus $34,999 of brokerage is $74,999 includable. The homestead is
 * excluded by § 205.001(3) and the IRA by § 111.052, and between them they are
 * worth five times the estate that actually counts — which is the whole reason
 * the exclusions decide the route rather than merely trimming a total.
 */
function baseRecord(): TxRecord {
  return {
    decedent: {
      date_of_death: "2026-03-01",
      testate: false,
      will: { directs_independent: false, prohibits_independent: false },
      family_allowance_claimant: false,
    },
    estate: {
      unpaid_unsecured_debt: true,
      pr_petition_pending: false,
      exceeds_family_allowance: true,
      all_distributees_agree: true,
      heirship_determined: true,
      county: "Travis",
    },
    assets: {
      checking: { label: "Checking account", value: 40_000 },
      brokerage: { label: "Brokerage account", value: 34_999 },
      residence: { label: "Homestead at 2118 Pecan Grove", value: 310_000, homestead: true },
      ira: { label: "Rollover IRA", value: 95_000, has_named_beneficiary: true },
    },
  };
}

const SCALARS: { key: string; label: string; path: string }[] = [
  { key: "decedent.date_of_death", label: "Date of death", path: "decedent.date_of_death" },
  { key: "decedent.died_testate", label: "Decedent left a will", path: "decedent.testate" },
  {
    key: "decedent.will_directs_independent_administration",
    label: "Will directs independent administration",
    path: "decedent.will.directs_independent",
  },
  {
    key: "decedent.will_prohibits_independent_administration",
    label: "Will forbids independent administration",
    path: "decedent.will.prohibits_independent",
  },
  {
    key: "decedent.has_family_allowance_claimant",
    label: "Surviving spouse, minor child or adult incapacitated child",
    path: "decedent.family_allowance_claimant",
  },
  {
    key: "estate.has_unpaid_debt_other_than_real_estate_lien",
    label: "Unpaid debt not secured by a lien on real estate",
    path: "estate.unpaid_unsecured_debt",
  },
  {
    key: "estate.pr_petition_pending_or_granted",
    label: "Petition for a personal representative pending or granted",
    path: "estate.pr_petition_pending",
  },
  {
    key: "estate.exceeds_family_allowance",
    label: "Estate exceeds the family allowance",
    path: "estate.exceeds_family_allowance",
  },
  {
    key: "estate.all_distributees_agree_independent",
    label: "All distributees agree to independent administration",
    path: "estate.all_distributees_agree",
  },
  {
    key: "estate.heirship_determined",
    label: "Heirship adjudicated under ch. 202",
    path: "estate.heirship_determined",
  },
  { key: "estate.county", label: "County of venue", path: "estate.county" },
];

const ASSET_FLAGS = ["homestead", "exempt_property", "has_named_beneficiary", "transfer_on_death_deed"] as const;

function admitAt(key: string, label: string, path: string, record: TxRecord, now = 0): Fact {
  return admitRecord(
    {
      key,
      label,
      value: readPath(record, path) as FactValue,
      system: SYSTEM,
      recordId: RECORD_ID,
      path,
    },
    record,
    { now },
  );
}

function build(record: TxRecord, now = 0): Fact[] {
  const base: Fact[] = SCALARS.map((s) => admitAt(s.key, s.label, s.path, record, now));

  for (const [id, asset] of Object.entries(record.assets)) {
    base.push(
      admitAt(`asset.${id}.value`, asset.label, `assets.${id}.value`, record, now),
    );
    for (const flag of ASSET_FLAGS) {
      if (asset[flag] === undefined) continue;
      base.push(
        admitAt(`asset.${id}.${flag}`, `${asset.label} — ${flag}`, `assets.${id}.${flag}`, record, now),
      );
    }
  }

  return [...base, ...deriveTxFacts(base, AS_OF, now)];
}

function routeFor(record: TxRecord): string | undefined {
  const decisions = decide(TX_RULES, values(build(record)), WHERE);
  return decisions.find((d) => d.decisionPoint === "probate_route")?.chosen?.ruleId;
}

function supervisionFor(record: TxRecord): string | undefined {
  const decisions = decide(TX_RULES, values(build(record)), WHERE);
  return decisions.find((d) => d.decisionPoint === "administration_supervision")?.chosen?.ruleId;
}

beforeEach(() => _resetIds());

// ---------------------------------------------------------------------------
// (a) the figures
// ---------------------------------------------------------------------------

describe("statutory thresholds", () => {
  it("matches Tex. Est. Code § 205.001 on the cap and the waiting period", () => {
    // "the value of the estate assets on the date of the affidavit ...
    //  excluding homestead and exempt property, does not exceed $75,000"
    expect(TX_THRESHOLDS.smallEstateAffidavit).toBe(75_000);
    // "30 days have elapsed since the date of the decedent's death"
    expect(TX_THRESHOLDS.smallEstateWaitingDays).toBe(30);
  });

  it("records that muniment of title has no cap, as an assertion rather than a hole", () => {
    expect(TX_THRESHOLDS.munimentOfTitleCapUsd).toBeNull();
    // And no rule on the muniment route may smuggle a dollar comparison in.
    const muniment = TX_RULES.find((r) => r.id === "tx.route.257_muniment_of_title")!;
    expect(JSON.stringify(muniment.when)).not.toMatch(/\d{4,}/);
  });

  it("keys the cap to the filing, not the death — H.B. 2271 § 46", () => {
    // "applies to a small estate administration commenced on or after the
    //  effective date of this Act, regardless of the date of the decedent's death"
    expect(TX_THRESHOLDS.effectiveFrom).toBe("2017-09-01");
    expect(TX_THRESHOLDS.capKeyedTo).toBe("date_administration_commenced");
    // § 205.001(3): "on the date of the affidavit".
    expect(TX_THRESHOLDS.smallEstateValuationDate).toBe("affidavit_date");
  });

  it("matches the statutory deadlines", () => {
    // §§ 256.003(a), 257.054(2), 301.002(a) — "the fourth anniversary".
    expect(TX_THRESHOLDS.probateDeadlineYears).toBe(4);
    // § 257.103(a) — "not later than the 180th day".
    expect(TX_THRESHOLDS.munimentComplianceAffidavitDays).toBe(180);
    // § 309.051(a) "before the 91st day", called "the 90-day period" by § 309.056(b).
    expect(TX_THRESHOLDS.inventoryDueDays).toBe(90);
    // § 306.001(a) — "Before the 21st day after the date a will has been probated".
    expect(TX_THRESHOLDS.lettersTestamentaryDays).toBe(21);
    // § 308.002(a) — "not later than the 60th day".
    expect(TX_THRESHOLDS.noticeToBeneficiariesDays).toBe(60);
    // § 308.051(a) — "Within one month after receiving letters".
    expect(TX_THRESHOLDS.noticeToCreditorsMonths).toBe(1);
    // § 308.053(a) — "Within two months after receiving letters".
    expect(TX_THRESHOLDS.noticeToSecuredCreditorsMonths).toBe(2);
    // § 355.060 — "before the 121st day after the date of receipt of the notice".
    expect(TX_THRESHOLDS.unsecuredClaimBarDays).toBe(121);
    // § 355.064(a) — "not later than the 90th day after the date of rejection".
    expect(TX_THRESHOLDS.rejectedClaimSuitDays).toBe(90);
  });

  it("matches the cited fee and compensation figures", () => {
    // Loc. Gov't Code § 133.151(a)(1) — "a fee in the amount of $137".
    expect(TX_THRESHOLDS.stateFilingFeeUsd).toBe(137);
    // Loc. Gov't Code § 135.102(a)(1) — "$223 on filing any probate ... case".
    expect(TX_THRESHOLDS.localProbateFilingFeeUsd).toBe(223);
    // Arithmetic on the two above, and nothing more.
    expect(TX_THRESHOLDS.statutoryFilingFeeFloorUsd).toBe(
      TX_THRESHOLDS.stateFilingFeeUsd + TX_THRESHOLDS.localProbateFilingFeeUsd,
    );
    expect(TX_THRESHOLDS.statutoryFilingFeeFloorUsd).toBe(360);
    // Est. Code § 352.002(a) — "a five percent commission".
    expect(TX_THRESHOLDS.representativeCommissionPercent).toBe(5);
    // §§ 308.002(c)(2), 309.056(b-1)(1) — "$2,000 or less".
    expect(TX_THRESHOLDS.beneficiaryNoticeDeMinimisUsd).toBe(2_000);
  });

  it("does not round the cap into a tidier number", () => {
    // A guard against the failure this project exists to prevent: a later
    // editor "tidying" a real statutory figure into a memorable one.
    expect(TX_THRESHOLDS.smallEstateAffidavit).not.toBe(50_000);
    expect(TX_THRESHOLDS.smallEstateAffidavit).not.toBe(100_000);
  });
});

// ---------------------------------------------------------------------------
// (b) the provenance
// ---------------------------------------------------------------------------

describe("provenance", () => {
  it("carries a citation, a source URL and the retrieval date on every rule", () => {
    expect(TX_RULES.length).toBeGreaterThan(0);
    for (const rule of TX_RULES) {
      expect(rule.authority.citation, rule.id).toBeTruthy();
      expect(rule.authority.sourceUrl, rule.id).toMatch(/^https?:\/\//);
      expect(rule.authority.retrievedAt, rule.id).toBe("2026-07-28");
      expect(rule.authority.effectiveFrom, rule.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("cites a Texas primary source, never a secondary one", () => {
    for (const rule of TX_RULES) {
      expect(rule.authority.sourceUrl, rule.id).toMatch(
        /^https:\/\/(statutes\.)?capitol\.texas\.gov\//,
      );
      expect(rule.authority.citation, rule.id).toMatch(/Tex\.\s(Est\.|Loc\.\sGov't)\sCode/);
    }
  });

  it("draws every rule's source URL from the declared source list", () => {
    const known = new Set(Object.values(TX_SOURCES));
    for (const rule of TX_RULES) {
      expect(known.has(rule.authority.sourceUrl), `${rule.id} cites an undeclared source`).toBe(
        true,
      );
    }
    for (const exclusion of TX_EXCLUSIONS) {
      expect(known.has(exclusion.sourceUrl), `${exclusion.id} cites an undeclared source`).toBe(
        true,
      );
    }
  });

  it("carries a citation and source URL on every exclusion", () => {
    for (const exclusion of TX_EXCLUSIONS) {
      expect(exclusion.citation, exclusion.id).toMatch(/Tex\./);
      expect(exclusion.sourceUrl, exclusion.id).toMatch(/^https?:\/\//);
    }
  });

  it("labels every uncited number in `then` as an estimate", () => {
    // The lower bound of estCostUsd is the cited $360 floor throughout; the
    // upper bound and every timeline are practice estimates. A rule that
    // asserts a range without saying which parts are sourced is the exact
    // silent-uncited-figure failure the Rule interface exists to prevent.
    for (const rule of TX_RULES) {
      const [lowCost, highCost] = rule.then.estCostUsd;
      if (highCost !== lowCost) {
        expect(rule.estimates?.estCostUsd, rule.id).toBeTruthy();
      }
      const [lowDays, highDays] = rule.then.timelineDays;
      if (highDays !== lowDays) {
        expect(rule.estimates?.timelineDays, rule.id).toBeTruthy();
      }
    }
  });

  it("tells an executor how to obtain every fact a rule requires", () => {
    const required = new Set(TX_RULES.flatMap((r) => r.requires));
    for (const key of required) {
      expect(TX_OBTAIN_HINTS[key], `no obtain hint for ${key}`).toBeTruthy();
    }
  });

  it("scopes every rule to Texas", () => {
    for (const rule of TX_RULES) expect(rule.jurisdiction.state).toBe("TX");
    expect(TX_PACK.jurisdiction.state).toBe("TX");
    expect(TX_PACK.version).toContain("2026-07-28");
  });
});

// ---------------------------------------------------------------------------
// The fact ledger underneath
// ---------------------------------------------------------------------------

describe("the § 205.001 computation", () => {
  it("admits every fixture fact against the record", () => {
    const facts = build(baseRecord());
    expect(quarantined(facts)).toHaveLength(0);
  });

  it("excludes homestead and beneficiary-designated property from the value", () => {
    const facts = build(baseRecord());
    // 40,000 + 34,999. The $310,000 homestead is out under § 205.001(3), the
    // $95,000 IRA is out under § 111.052 — $405,000 of wealth that does not
    // count.
    expect(values(facts)["estate.chapter_205_value"]).toBe(74_999);
  });

  it("stamps the § 205 value with the affidavit date, not the date of death", () => {
    const fact = ledger(build(baseRecord())).get("estate.chapter_205_value")!;
    expect(fact.asOf).toBe(AS_OF);
    expect(fact.asOf).not.toBe(baseRecord().decedent.date_of_death);
    if (fact.warrant.kind === "derivation") {
      expect(fact.warrant.note).toMatch(/date of the affidavit/i);
      expect(fact.warrant.authority?.citation).toMatch(/205\.001\(3\)/);
    }
  });

  it("computes the fourth anniversary as a calendar date", () => {
    expect(fourthAnniversary("2026-03-01")).toBe("2030-03-01");
    // A four-year step from 29 February lands on another leap year, so these
    // do NOT roll. The pack's comment used to claim the opposite; the
    // assertions were right and the prose was wrong, and the prose was fixed.
    expect(fourthAnniversary("2024-02-29")).toBe("2028-02-29");
    expect(fourthAnniversary("2028-02-29")).toBe("2032-02-29");
    expect(fourthAnniversary("2020-02-29")).toBe("2024-02-29");
    // The one case that does roll: 2100 is a century year and not a leap
    // year, so the anniversary overflows to 1 March.
    expect(fourthAnniversary("2096-02-29")).toBe("2100-03-01");
    expect(fourthAnniversary("not a date")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// (c) the route decision, either side of the cap
// ---------------------------------------------------------------------------

describe("the $75,000 cap", () => {
  function atValue(brokerage: number): TxRecord {
    const r = baseRecord();
    r.assets.brokerage.value = brokerage;
    return r;
  }

  it("routes to a small estate affidavit just under the cap", () => {
    expect(values(build(atValue(34_999)))["estate.chapter_205_value"]).toBe(74_999);
    expect(routeFor(atValue(34_999))).toBe("tx.route.205_small_estate_affidavit");
  });

  it("still routes to a small estate affidavit exactly at the cap", () => {
    // § 205.001(3) says "does not exceed $75,000" — the boundary is inclusive,
    // and an off-by-one here is a family sent to court for a dollar.
    expect(values(build(atValue(35_000)))["estate.chapter_205_value"]).toBe(75_000);
    expect(routeFor(atValue(35_000))).toBe("tx.route.205_small_estate_affidavit");
  });

  it("falls to full administration one dollar over the cap", () => {
    expect(values(build(atValue(35_001)))["estate.chapter_205_value"]).toBe(75_001);
    expect(routeFor(atValue(35_001))).toBe("tx.route.full_administration");
  });

  it("blocks rather than guesses while the 30-day wait is still running", () => {
    const r = baseRecord();
    r.decedent.date_of_death = "2026-07-20"; // 8 days before AS_OF
    const decisions = decide(TX_RULES, values(build(r)), WHERE);
    const route = decisions.find((d) => d.decisionPoint === "probate_route")!;
    // Under the cap but inside the waiting period: the affidavit is simply not
    // available yet, and nothing else fires either.
    expect(route.chosen).toBeUndefined();
    expect(values(build(r))["estate.days_since_death"]).toBeLessThan(
      TX_THRESHOLDS.smallEstateWaitingDays,
    );
  });

  it("names the missing fact instead of failing closed", () => {
    const facts = build(baseRecord()).filter(
      (f) => f.key !== "estate.pr_petition_pending_or_granted",
    );
    const decisions = decide(TX_RULES, values(facts), WHERE);
    const route = decisions.find((d) => d.decisionPoint === "probate_route")!;
    expect(route.chosen).toBeUndefined();
    expect(route.needs).toContain("estate.pr_petition_pending_or_granted");
    expect(TX_OBTAIN_HINTS["estate.pr_petition_pending_or_granted"]).toMatch(/probate docket/i);
  });
});

describe("a will changes the route", () => {
  it("closes the small estate affidavit outright — it is intestate-only", () => {
    const r = baseRecord();
    r.decedent.testate = true;
    // Same $74,999, comfortably under the cap. Chapter 205 is still unavailable
    // because § 205.001 opens "a decedent who dies intestate".
    expect(values(build(r))["estate.chapter_205_value"]).toBe(74_999);
    expect(routeFor(r)).not.toBe("tx.route.205_small_estate_affidavit");
  });

  it("opens muniment of title, which has no cap at all", () => {
    const r = baseRecord();
    r.decedent.testate = true;
    r.estate.unpaid_unsecured_debt = false;
    expect(routeFor(r)).toBe("tx.route.257_muniment_of_title");
  });

  it("keeps muniment open at a value that would bury the affidavit route", () => {
    const r = baseRecord();
    r.decedent.testate = true;
    r.estate.unpaid_unsecured_debt = false;
    r.assets.brokerage.value = 4_000_000;
    expect(values(build(r))["estate.chapter_205_value"]).toBeGreaterThan(
      TX_THRESHOLDS.smallEstateAffidavit * 50,
    );
    expect(routeFor(r)).toBe("tx.route.257_muniment_of_title");
  });

  it("closes muniment on an unpaid unsecured debt, whatever the estate is worth", () => {
    const r = baseRecord();
    r.decedent.testate = true;
    r.estate.unpaid_unsecured_debt = true;
    r.assets.brokerage.value = 1_000;
    // A tiny testate estate with one unpaid card balance goes to full
    // administration; the four-million-dollar one above does not. Value is not
    // what decides this route.
    expect(routeFor(r)).toBe("tx.route.full_administration");
  });
});

describe("the four-year bar", () => {
  it("forecloses the will and letters past the fourth anniversary", () => {
    const r = baseRecord();
    r.decedent.testate = true;
    r.estate.unpaid_unsecured_debt = false;
    r.decedent.date_of_death = "2020-01-15";
    expect(values(build(r))["estate.within_four_years_of_death"]).toBe(false);
    expect(routeFor(r)).toBe("tx.route.four_year_bar");
  });

  it("does not catch an intestate small estate — ch. 205 has no deadline", () => {
    const r = baseRecord();
    r.decedent.date_of_death = "2020-01-15";
    expect(values(build(r))["estate.within_four_years_of_death"]).toBe(false);
    // The affidavit outranks the bar precisely because Chapter 205 contains no
    // limitations period; asserting it here pins that asymmetry down.
    expect(routeFor(r)).toBe("tx.route.205_small_estate_affidavit");
  });
});

describe("order of no administration", () => {
  it("fires when the family allowance would exhaust the estate", () => {
    const r = baseRecord();
    r.estate.exceeds_family_allowance = false;
    r.decedent.family_allowance_claimant = true;
    expect(routeFor(r)).toBe("tx.route.451_no_administration");
  });

  it("needs a qualifying claimant, not merely a small estate", () => {
    const r = baseRecord();
    r.estate.exceeds_family_allowance = false;
    r.decedent.family_allowance_claimant = false;
    expect(routeFor(r)).toBe("tx.route.205_small_estate_affidavit");
  });
});

// ---------------------------------------------------------------------------
// Independent administration is the default, and that is the point
// ---------------------------------------------------------------------------

describe("independent versus dependent administration", () => {
  it("follows the will where it directs independent administration", () => {
    const r = baseRecord();
    r.decedent.testate = true;
    r.decedent.will.directs_independent = true;
    expect(supervisionFor(r)).toBe("tx.admin.independent_by_will");
  });

  it("lets the distributees agree to it where the will is silent", () => {
    const r = baseRecord();
    r.decedent.testate = true;
    r.decedent.will.directs_independent = false;
    r.estate.all_distributees_agree = true;
    expect(supervisionFor(r)).toBe("tx.admin.independent_by_agreement_testate");
  });

  it("honours a will that forbids it, over the distributees' agreement", () => {
    const r = baseRecord();
    r.decedent.testate = true;
    r.decedent.will.directs_independent = false;
    r.decedent.will.prohibits_independent = true;
    r.estate.all_distributees_agree = true;
    // § 401.002(a) and (b) both open "Except as provided in Section
    // 401.001(b)", so the testate agreement route yields to the will's
    // prohibition. (§ 401.003 has no such clause — it is the intestate route,
    // where there is no will to forbid anything.)
    expect(supervisionFor(r)).toBe("tx.admin.dependent");
  });

  it("falls to dependent administration on a single holdout distributee", () => {
    const r = baseRecord();
    r.decedent.testate = true;
    r.estate.all_distributees_agree = false;
    expect(supervisionFor(r)).toBe("tx.admin.dependent");
  });

  it("allows an intestate independent administration once heirship is adjudicated", () => {
    const r = baseRecord();
    r.estate.all_distributees_agree = true;
    r.estate.heirship_determined = true;
    expect(supervisionFor(r)).toBe("tx.admin.independent_by_agreement_intestate");
  });

  it("refuses to appoint an intestate independent administrator before heirship", () => {
    const r = baseRecord();
    r.estate.all_distributees_agree = true;
    r.estate.heirship_determined = false;
    // § 401.003(b): the court "may not appoint an independent administrator to
    // serve in an intestate administration unless and until" heirship is
    // determined. Agreement alone buys nothing, so nothing is chosen.
    expect(supervisionFor(r)).toBeUndefined();
  });
});

describe("filing fees", () => {
  it("charges the cited statewide floor and calls it a floor", () => {
    const decisions = decide(TX_RULES, values(build(baseRecord())), WHERE);
    const fee = decisions.find((d) => d.decisionPoint === "filing_fee")!;
    expect(fee.chosen?.ruleId).toBe("tx.fee.statutory_floor");
    expect(fee.chosen?.rule.then.estCostUsd).toEqual([360, 360]);
    expect(fee.chosen?.rule.then.conclusion).toMatch(/floor, not a price/i);
    // The county clerk's own fee is not asserted anywhere.
    expect(fee.chosen?.rule.estimates?.estCostUsd).toMatch(/no statewide source/i);
  });
});
