import { describe, expect, it, beforeEach } from "vitest";
import { _resetIds, admitAll, ledger } from "./facts";
import { detectRecurring } from "./transactions";
import { classify, describe as describeLead, discoverAssets } from "./discovery";
import { HOYT_BATCHES } from "../fixtures/hoyt-transactions";
import { HOYT_DOCS } from "../fixtures/hoyt-estate";
import { RECORDED_CANDIDATES } from "../fixtures/recorded";

const DOD = "2026-01-04";

function run() {
  const facts = admitAll(RECORDED_CANDIDATES, HOYT_DOCS, { now: 1 });
  const charges = detectRecurring(HOYT_BATCHES, { dateOfDeath: DOD });
  return { facts, charges, result: discoverAssets(charges, facts, HOYT_BATCHES, { dateOfDeath: DOD }) };
}

beforeEach(() => _resetIds());

describe("discovering assets from payment traces", () => {
  it("finds a life policy that appears in no document", () => {
    // The MetLife premium is $14.32 a month and there is no policy summary, no
    // statement and no letter anywhere in the data room. The debit is the only
    // trace the policy leaves in the world.
    const { result } = run();
    const metlife = result.hypotheses.find((h) => /metlife/i.test(h.merchant));

    expect(metlife, "MetLife premium was not surfaced").toBeDefined();
    expect(metlife!.klass).toBe("life_insurance");
    expect(metlife!.implies).toMatch(/life insurance policy/);
    expect(metlife!.amountUsd).toBeCloseTo(14.32, 2);

    // And it is genuinely absent from the documents — otherwise this test is
    // proving nothing.
    const inDocs = HOYT_DOCS.some((d) => /metlife/i.test(d.content));
    expect(inDocs, "fixture no longer hides the policy").toBe(false);
  });

  it("carries the actual debits as evidence, not just a count", () => {
    const { result } = run();
    const metlife = result.hypotheses.find((h) => /metlife/i.test(h.merchant))!;
    expect(metlife.evidence.length).toBeGreaterThanOrEqual(6);
    for (const row of metlife.evidence) {
      expect(row.description).toMatch(/METLIFE/i);
      expect(row.amount).toBeLessThan(0);
      expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // A reviewer must be able to see that it is still being paid.
    expect(metlife.activeAfterDeath).toBe(true);
  });

  it("does not re-report a policy the ledger already holds", () => {
    // Pacific Mutual is in the data room and in the ledger. Surfacing it as a
    // discovery is crying wolf, and a queue that cries wolf stops being read.
    const { facts, result } = run();
    expect(ledger(facts).get("asset.life_policy.institution")?.value).toMatch(/pacific mutual/i);

    const surfaced = result.hypotheses.find((h) => /pacific mutual/i.test(h.merchant));
    expect(surfaced, "already-known insurer was re-reported as a discovery").toBeUndefined();

    const held = result.suppressed.find((s) => /pacific mutual/i.test(s.merchant));
    expect(held, "suppression was silent — it must be reported").toBeDefined();
    expect(held!.accountedForBy.key).toBe("asset.life_policy.institution");
  });

  it("finds a safe deposit box from an annual fee", () => {
    const { result } = run();
    const box = result.hypotheses.find((h) => h.klass === "safe_deposit");
    expect(box, "safe deposit fee was not surfaced").toBeDefined();
    expect(box!.implies).toMatch(/safe deposit box/);
    // Two annual charges is thin evidence and must not be overstated.
    expect(box!.confidence).not.toBe("strong");
  });

  it("keeps the homeowner's policy separate from the life policy", () => {
    const { result } = run();
    const sf = result.hypotheses.find((h) => /state farm/i.test(h.merchant));
    expect(sf?.klass).toBe("property_insurance");
    // Cancelling this on a house the estate still holds would be a real error,
    // so the next step must not be a cancellation.
    expect(sf!.nextStep.asks).not.toMatch(/cancel/i);
    expect(sf!.nextStep.asks).toMatch(/vacant|estate-held|endorsement/i);
  });

  it("does not treat streaming and gyms as assets", () => {
    const { result } = run();
    for (const h of result.hypotheses) {
      expect(h.merchant, `${h.merchant} was treated as an asset`).not.toMatch(
        /netflix|spotify|adobe|fitness|at&t|pg&e/i,
      );
    }
  });

  it("produces hypotheses, never facts", () => {
    // The structural guarantee. A payment pattern is not a quotation, and
    // nothing inferred here may reach the verified ledger. If this module ever
    // grows a path that returns a Fact, this is where it should be caught.
    const { result } = run();
    for (const h of result.hypotheses) {
      expect(h).not.toHaveProperty("warrant");
      expect(h).not.toHaveProperty("status");
      expect(h.because.length).toBeGreaterThan(30);
      expect(h.nextStep.asks.length).toBeGreaterThan(20);
    }
  });

  it("ranks by annual outlay, as a proxy for what is at stake", () => {
    const { result } = run();
    const amounts = result.hypotheses.map((h) => h.annualisedUsd);
    expect([...amounts].sort((a, b) => b - a)).toEqual(amounts);
  });

  it("classifies only what it recognises", () => {
    expect(classify("metlife premium")?.klass).toBe("life_insurance");
    expect(classify("first republic safe deposit box fee")?.klass).toBe("safe_deposit");
    // An unknown carrier is not guessed at. Silence beats a fabricated lead.
    expect(classify("acme widgets")).toBeNull();
  });

  it("summarises a lead in one readable line", () => {
    const { result } = run();
    const metlife = result.hypotheses.find((h) => /metlife/i.test(h.merchant))!;
    const line = describeLead(metlife);
    expect(line).toMatch(/\$14\.32/);
    expect(line).toMatch(/no a life insurance policy in the ledger|life insurance/i);
    expect(line).toMatch(/still charging after the date of death/);
  });
});
