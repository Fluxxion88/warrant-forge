import { describe, expect, it, beforeEach } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { _resetIds } from "./facts";
import { resolve, resolutionReport, type Resolution } from "./scenario";
import type { EstateRecord } from "./estate";

/**
 * The whole engine, run against every estate we hold, in whatever jurisdiction
 * it happens to be in. These records are Alix's and are gitignored, so the
 * suite skips when they are absent.
 */
const SAMPLES = "samples/track3";
const suite = existsSync(SAMPLES) ? describe : describe.skip;

function records(): EstateRecord[] {
  return readdirSync(SAMPLES)
    .filter((f) => f.startsWith("estate-") && f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(SAMPLES, f), "utf8")) as EstateRecord);
}

function solveAll(): Resolution[] {
  return records().map((record) =>
    resolve({ id: record.meta.recordId, label: record.meta.recordId, record, asOf: "2026-07-28" }),
  );
}

beforeEach(() => _resetIds());

suite("resolving an arbitrary estate", () => {
  it("produces a complete plan for every estate, in five jurisdictions", () => {
    const all = solveAll();
    expect(all.length).toBeGreaterThanOrEqual(5);
    for (const r of all) {
      expect(r.actions.length, `${r.scenario.recordId} produced no actions`).toBeGreaterThan(5);
      expect(r.forms.length, `${r.scenario.recordId} considered no forms`).toBeGreaterThan(0);
      expect(r.integrity.integrityScore, r.scenario.recordId).toBe(1);
    }
  });

  it("never applies California law to an estate outside California", () => {
    // The failure this guards against is the quiet one: falling back to the
    // only pack we have and producing a confident, wrong answer.
    for (const r of solveAll()) {
      if (r.jurisdiction.state === "CA") {
        expect(r.jurisdiction.hasStatePack, r.scenario.recordId).toBe(true);
        continue;
      }
      expect(r.jurisdiction.hasStatePack, r.scenario.recordId).toBe(false);
      expect(r.jurisdiction.note).toMatch(/No .* pack/);
      expect(
        r.unresolved.some((u) => u.kind === "no_rule_pack"),
        `${r.scenario.recordId} did not report the missing pack`,
      ).toBe(true);
      // And it must refuse to say distribution is safe on that basis.
      expect(r.distribution.safe, r.scenario.recordId).toBe(false);
    }
  });

  it("flags California-specific guidance shown outside California", () => {
    // The task graph cites the California Probate Code throughout. Showing an
    // Indiana executor "California requires notice to creditors" as their
    // instruction is worse than showing them nothing.
    for (const r of solveAll()) {
      if (r.jurisdiction.state === "CA") continue;
      const flagged = r.actions.filter((a) => a.title.includes("confirm the"));
      expect(flagged.length, `${r.scenario.recordId} passed off CA guidance unflagged`)
        .toBeGreaterThan(0);
      for (const a of flagged) {
        expect(a.detail).toMatch(/California-specific/);
        expect(a.authority, "a flagged step must not keep its California citation")
          .toBeUndefined();
        expect(a.needsHuman).toBe(true);
      }
    }
  });

  it("evaluates federal obligations everywhere", () => {
    // Federal forms attach regardless of venue — that is the point of the "*"
    // jurisdiction. An out-of-state estate should still get Form 56.
    for (const r of solveAll()) {
      const f56 = r.forms.find((f) => f.form === "irs-56");
      expect(f56, r.scenario.recordId).toBeDefined();
      expect(f56!.status, r.scenario.recordId).not.toBe("blocked");
    }
  });

  it("always reports what it could not resolve", () => {
    for (const r of solveAll()) {
      expect(r.unresolved.length, `${r.scenario.recordId} claimed nothing was open`)
        .toBeGreaterThan(0);
      for (const u of r.unresolved) {
        expect(u.why.length).toBeGreaterThan(20);
        expect(u.needs.length).toBeGreaterThan(0);
      }
    }
  });

  it("orders the plan so blocking facts come before the filings they gate", () => {
    for (const r of solveAll()) {
      const obtain = r.actions.filter((a) => a.kind === "obtain_fact");
      const file = r.actions.filter((a) => a.kind === "file_form");
      if (!obtain.length || !file.length) continue;
      const lastObtain = Math.max(...obtain.map((a) => r.actions.indexOf(a)));
      const firstFile = Math.min(...file.map((a) => r.actions.indexOf(a)));
      expect(lastObtain, r.scenario.recordId).toBeLessThan(firstFile);
    }
  });

  it("withholds a form with a reason rather than omitting it", () => {
    const all = solveAll();
    const withheld = all.flatMap((r) => r.forms.filter((f) => f.status === "withheld"));
    expect(withheld.length).toBeGreaterThan(0);
    for (const f of withheld) {
      expect(f.reason.length).toBeGreaterThan(20);
      expect(f.authority, "a withheld form must still cite why").toBeTruthy();
    }
  });

  it("renders a report a specialist could act from", () => {
    for (const r of solveAll()) {
      const md = resolutionReport(r);
      expect(md).toContain("## Do this");
      expect(md).toContain("## Forms");
      expect(md).toContain("## Not resolved");
      expect(md).toContain("## Distribution");
      expect(md.length).toBeGreaterThan(800);
    }
  });
});
