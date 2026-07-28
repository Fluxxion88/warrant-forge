import { describe, expect, it } from "vitest";
import {
  assess,
  escalates,
  observedChangeInterval,
  reviewQueue,
  KNOWN_CADENCES,
  type SourceHistory,
} from "./freshness";

const obs = (checkedAt: string, contentHash: string) => ({ checkedAt, contentHash });

describe("how long a researched answer stays true", () => {
  it("treats a never-fetched source as unknown, not as fresh", () => {
    const h: SourceHistory = { url: "u", label: "l", kind: "fee_schedule", observations: [] };
    const v = assess(h, "2026-07-28");
    expect(v.status).toBe("unknown");
    expect(escalates(v)).toBe(true);
  });

  it("prefers a published schedule over anything it could observe", () => {
    // The case that makes a purely learned TTL unsafe. This page has not
    // changed in three years of watching, so volatility says "very stable" —
    // and the statute says it changes on 1 April 2028. Observation and risk
    // move in opposite directions right up to the day it moves.
    const h: SourceHistory = {
      url: "https://leginfo.legislature.ca.gov/13100",
      label: "§ 13100 small-estate cap",
      kind: "statute",
      observations: [
        obs("2025-04-02", "a"),
        obs("2025-10-01", "a"),
        obs("2026-04-01", "a"),
        obs("2026-07-01", "a"),
      ],
      knownCadence: KNOWN_CADENCES["ca.small_estate_thresholds"],
    };
    const v = assess(h, "2026-07-28");
    expect(v.basis).toBe("scheduled");
    expect(v.confidence).toBe("high");
    expect(v.because).toMatch(/2028-04-01/);
    expect(v.because).toMatch(/§ 890|Prob\. Code/);
  });

  it("flags a scheduled change that has already passed", () => {
    const h: SourceHistory = {
      url: "u",
      label: "§ 13100 cap",
      kind: "statute",
      observations: [obs("2025-01-01", "a")],
      knownCadence: { nextChangeOn: "2025-04-01", because: "three-year cycle" },
    };
    const v = assess(h, "2026-07-28");
    expect(v.status).toBe("expired");
    expect(v.because).toMatch(/has passed/);
    expect(escalates(v)).toBe(true);
  });

  it("infers a horizon from observed changes when nothing is published", () => {
    const h: SourceHistory = {
      url: "u",
      label: "county local rules",
      kind: "court_local_rule",
      observations: [
        obs("2024-01-01", "a"),
        obs("2024-07-01", "b"),
        obs("2025-01-01", "c"),
        obs("2025-07-01", "d"),
      ],
    };
    const { medianDays, changes } = observedChangeInterval(h);
    expect(changes).toBe(3);
    expect(medianDays).toBeGreaterThan(170);
    expect(medianDays).toBeLessThan(190);

    const v = assess(h, "2025-08-01");
    expect(v.basis).toBe("observed");
    // Re-check at half the observed interval, so a change is caught within
    // roughly one cycle rather than up to a full one late.
    expect(v.ttlDays).toBeGreaterThan(80);
    expect(v.ttlDays).toBeLessThan(96);
  });

  it("calls a two-change history provisional rather than confident", () => {
    const h: SourceHistory = {
      url: "u",
      label: "fee page",
      kind: "fee_schedule",
      observations: [obs("2025-01-01", "a"), obs("2025-04-01", "b"), obs("2025-08-01", "c")],
    };
    const v = assess(h, "2025-09-01");
    expect(v.basis).toBe("observed");
    expect(v.confidence).toBe("low");
    expect(v.because).toMatch(/thin basis/);
  });

  it("does not mistake an unmeasured source for a stable one", () => {
    // A page fetched once and never seen to change has no evidence of
    // stability — only an absence of observation.
    const h: SourceHistory = {
      url: "u",
      label: "new county page",
      kind: "fee_schedule",
      observations: [obs("2026-01-01", "a")],
    };
    const v = assess(h, "2026-07-28");
    expect(v.basis).toBe("default");
    expect(v.confidence).toBe("low");
    expect(v.because).toMatch(/not stability/);
    // 208 days against a 90-day default horizon is 2.3 times over, which is
    // past "stale" and into "expired".
    expect(v.status).toBe("expired");
    expect(v.recheckInDays).toBeLessThan(0);
  });

  it("gives a fee schedule a shorter horizon than a statute", () => {
    const mk = (kind: SourceHistory["kind"]): SourceHistory => ({
      url: "u",
      label: kind,
      kind,
      observations: [obs("2026-06-01", "a")],
    });
    const fee = assess(mk("fee_schedule"), "2026-07-28").ttlDays!;
    const statute = assess(mk("statute"), "2026-07-28").ttlDays!;
    expect(fee).toBeLessThan(statute);
  });

  it("queues by how overdue a source is, not by how old it is", () => {
    // A fee page two weeks past a 90-day horizon must outrank a statute six
    // months into a 365-day one. Sorting by age buries the urgent under the old.
    const feeOverdue: SourceHistory = {
      url: "f",
      label: "fee page",
      kind: "fee_schedule",
      observations: [obs("2026-04-01", "a")],
    };
    const statuteOlder: SourceHistory = {
      url: "s",
      label: "statute",
      kind: "statute",
      observations: [obs("2026-01-20", "a")],
    };
    const q = reviewQueue([statuteOlder, feeOverdue], "2026-07-28");
    expect(q[0].history.label).toBe("fee page");
    expect(q[0].verdict.ageDays).toBeLessThan(q[1].verdict.ageDays);
  });

  it("escalates a stale source without silencing the rule that rests on it", () => {
    // The module deliberately offers no "stop using this rule" switch. Dropping
    // a rule because its source aged replaces a probably-right answer with no
    // answer, and makes the engine degrade silently as the pack gets older.
    const stale = assess(
      { url: "u", label: "l", kind: "fee_schedule", observations: [obs("2025-01-01", "a")] },
      "2026-07-28",
    );
    expect(escalates(stale)).toBe(true);
    expect(Object.keys(stale)).not.toContain("suppressRule");
  });
});
