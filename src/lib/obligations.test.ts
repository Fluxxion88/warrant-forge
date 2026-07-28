import { describe, expect, it, beforeEach } from "vitest";
import { _resetIds, admitAll, type Fact } from "./facts";
import {
  canonicalise,
  classifyCadence,
  detectRecurring,
  displayMerchant,
  normaliseMerchant,
  summariseBleed,
} from "./transactions";
import { assetObligations, board, holdingsFrom, subscriptionObligations } from "./obligations";
import { DEFAULT_POLICY, overlayFor, policyFor } from "../rules/vendors";
import { deriveCaFacts } from "../rules/ca-probate";
import { AS_OF, HOYT_DOCS, INITIAL_CANDIDATES } from "../fixtures/hoyt-estate";
import { HOYT_BATCHES } from "../fixtures/hoyt-transactions";

const DOD = "2026-01-04";

function facts(): Fact[] {
  const base = admitAll(INITIAL_CANDIDATES, HOYT_DOCS, { now: 1 });
  return [...base, ...deriveCaFacts(base, AS_OF, 1)];
}

const charges = () => detectRecurring(HOYT_BATCHES, { dateOfDeath: DOD });

beforeEach(() => _resetIds());

describe("merchant normalisation", () => {
  it("strips processor prefixes, store numbers, references and locations", () => {
    expect(normaliseMerchant("NETFLIX.COM 866-579-7172 CA")).toBe("netflix.com");
    expect(normaliseMerchant("SQ *SPOTIFY USA 2025090031 NEW YORK NY")).toContain("spotify");
    expect(normaliseMerchant("PUBLIC STORAGE 08822 SAN MATEO CA")).toContain("public storage");
    expect(normaliseMerchant("ADOBE  SYSTEMS INC #4471 SAN JOSE CA")).toContain("adobe");
  });

  it("keeps a brand's leading number but drops reference numbers", () => {
    // "24" is part of the name; "08822" is a store number.
    expect(normaliseMerchant("24 HOUR FITNESS USA 8009514204 CA")).toBe("24 hour fitness usa");
    expect(normaliseMerchant("PUBLIC STORAGE 08822 SAN MATEO CA")).toBe("public storage san mateo");
  });

  it("merges a city-suffixed descriptor with its bare form at grouping time", () => {
    const a = normaliseMerchant("SPOTIFY USA 8772761994 NY");
    const b = normaliseMerchant("SQ *SPOTIFY USA 2025100031 NEW YORK NY");
    expect(a).not.toBe(b); // normalisation alone cannot tell a city from a brand
    const canon = canonicalise([a, b]);
    expect(canon.get(a)).toBe(canon.get(b));
  });

  it("does not merge two brands that merely share a first word", () => {
    const canon = canonicalise(["american express", "american airlines"]);
    expect(canon.get("american express")).not.toBe(canon.get("american airlines"));
  });

  it("titles merchants for display", () => {
    expect(displayMerchant("public storage")).toBe("Public Storage");
  });
});

describe("cadence", () => {
  it("buckets intervals with tolerance for month length", () => {
    expect(classifyCadence(30).cadence).toBe("monthly");
    expect(classifyCadence(28).cadence).toBe("monthly");
    expect(classifyCadence(7).cadence).toBe("weekly");
    expect(classifyCadence(365).cadence).toBe("annual");
    expect(classifyCadence(200).cadence).toBe("irregular");
  });
});

describe("recurring detection", () => {
  it("finds the monthly subscriptions", () => {
    const names = charges().map((c) => c.merchant.toLowerCase());
    expect(names.some((n) => n.includes("netflix"))).toBe(true);
    expect(names.some((n) => n.includes("spotify"))).toBe(true);
    expect(names.some((n) => n.includes("fitness"))).toBe(true);
    expect(names.some((n) => n.includes("storage"))).toBe(true);
  });

  it("groups a vendor whose descriptor changed shape mid-year", () => {
    const spotify = charges().find((c) => c.merchant.toLowerCase().includes("spotify"))!;
    expect(spotify.occurrences).toBeGreaterThan(10);
    expect(spotify.rawDescriptions.length).toBeGreaterThan(1);
    expect(spotify.cadence).toBe("monthly");
  });

  it("ignores ordinary spending at the same merchant", () => {
    // Four Safeway visits at irregular intervals and wildly different amounts
    // must not be called a subscription.
    const safeway = charges().find((c) => c.merchant.toLowerCase().includes("safeway"));
    expect(safeway === undefined || safeway.confidence === "low").toBe(true);
  });

  it("ignores credits", () => {
    expect(charges().some((c) => c.merchant.toLowerCase().includes("ssa"))).toBe(false);
  });

  it("flags charges that landed after the death", () => {
    const netflix = charges().find((c) => c.merchant.toLowerCase().includes("netflix"))!;
    expect(netflix.chargedAfterDeath).toBe(true);
    expect(netflix.lastSeen > DOD).toBe(true);
  });

  it("notices a variable-amount utility without discarding it", () => {
    const pge = charges().find((c) => c.merchant.toLowerCase().includes("pg"))!;
    expect(pge.amountVaries).toBe(true);
    expect(pge.occurrences).toBeGreaterThan(6);
  });

  it("annualises correctly by cadence", () => {
    const netflix = charges().find((c) => c.merchant.toLowerCase().includes("netflix"))!;
    expect(netflix.annualCostUsd).toBe(Math.round(22.99 * 12));
  });

  it("puts still-charging and expensive items first", () => {
    const list = charges();
    expect(list[0].chargedAfterDeath).toBe(true);
  });

  it("carries transaction ids as evidence", () => {
    for (const c of charges()) {
      expect(c.evidence.length).toBe(c.occurrences);
      expect(c.sourceDocument).toBe("Wells Fargo statement Jan 2026.pdf");
    }
  });

  it("totals what the estate is losing", () => {
    const s = summariseBleed(charges());
    expect(s.stillCharging).toBeGreaterThan(2);
    expect(s.annualUsd).toBeGreaterThan(3_000);
    expect(s.monthlyUsd).toBe(Math.round(s.annualUsd / 12));
  });
});

describe("vendor policy", () => {
  it("matches known vendors on their aliases", () => {
    expect(policyFor("Netflix.com").vendor).toBe("Netflix");
    expect(policyFor("Public Storage").phoneFirst).toBe(true);
  });

  it("falls back to a conservative default for unknown vendors", () => {
    const p = policyFor("Some Local Gym LLC");
    expect(p.provenance.status).toBe("unverified");
    expect(p.requires).toEqual(DEFAULT_POLICY.requires);
  });

  it("marks every shipped policy unverified rather than asserting it", () => {
    expect(policyFor("Netflix").provenance.status).toBe("unverified");
  });

  it("says plainly that no state rules have been researched", () => {
    const o = overlayFor("NY");
    expect(o.status).toBe("not_researched");
    expect(o.notes.join(" ")).toMatch(/have not been researched/i);
  });
});

describe("obligations", () => {
  it("turns each recurring charge into an actionable obligation", () => {
    const obs = subscriptionObligations(charges(), facts());
    expect(obs.length).toBe(charges().length);
    for (const o of obs) {
      expect(o.steps.length).toBeGreaterThan(0);
      expect(o.evidence.length).toBeGreaterThan(0);
      expect(o.evidenceRefs.length).toBeGreaterThan(0);
    }
  });

  it("treats a utility as a transfer rather than a cancellation", () => {
    const pge = subscriptionObligations(charges(), facts()).find((o) =>
      o.subject.toLowerCase().includes("pg"),
    )!;
    expect(pge.kind).toBe("transfer_utility");
    expect(pge.rationale).toMatch(/transfer or suspend/i);
  });

  it("puts the telephone call before the paperwork where the vendor demands it", () => {
    const storage = subscriptionObligations(charges(), facts()).find((o) =>
      o.subject.toLowerCase().includes("storage"),
    )!;
    expect(storage.phoneFirst).toBe(true);
    expect(storage.steps[0] + storage.steps[1]).toMatch(/Telephone/);
  });

  it("blocks on evidence the estate does not yet hold", () => {
    const obs = subscriptionObligations(charges(), facts());
    const blocked = obs.filter((o) => o.status === "blocked");
    // Letters have not issued in this fixture, so anything needing them waits.
    expect(blocked.length).toBeGreaterThan(0);
  });

  it("marks post-death charges urgent", () => {
    const obs = subscriptionObligations(charges(), facts());
    expect(obs.some((o) => o.urgent)).toBe(true);
  });

  it("generalises past subscriptions to accounts and assets", () => {
    const obs = assetObligations(facts());
    const kinds = new Set(obs.map((o) => o.kind));
    expect(kinds.has("close_account")).toBe(true);
    expect(kinds.has("transfer_asset")).toBe(true);
    expect(kinds.has("claim_benefit")).toBe(true);
    // The residence is handled by the probate route, not here.
    expect(obs.some((o) => o.id.includes("residence"))).toBe(false);
  });

  it("routes a beneficiary-designated policy to a claim, not a marshalling", () => {
    const life = assetObligations(facts()).find((o) => o.id.includes("life_policy"))!;
    expect(life.kind).toBe("claim_benefit");
    expect(life.rationale).toMatch(/outside probate/i);
  });

  it("reports what the estate holds as evidence", () => {
    const h = holdingsFrom(facts());
    expect(h.death_certificate).toBe(true);
    // Letters have not issued.
    expect(h.letters_testamentary).toBe(false);
  });
});

describe("the board", () => {
  it("totals the bleed and counts unverified policies", () => {
    const all = [...subscriptionObligations(charges(), facts()), ...assetObligations(facts())];
    const b = board(all);
    expect(b.obligations.length).toBe(all.length);
    expect(b.annualBleedUsd).toBeGreaterThan(3_000);
    expect(b.monthlyBleedUsd).toBe(Math.round(b.annualBleedUsd / 12));
    expect(b.unverifiedPolicies).toBe(all.length);
  });

  it("sorts urgent items to the top", () => {
    const b = board(subscriptionObligations(charges(), facts()));
    expect(b.obligations[0].urgent).toBe(true);
  });

  it("counts every obligation into exactly one status", () => {
    const all = [...subscriptionObligations(charges(), facts()), ...assetObligations(facts())];
    const b = board(all);
    const total = Object.values(b.byStatus).reduce((s, n) => s + n, 0);
    expect(total).toBe(all.length);
  });
});
