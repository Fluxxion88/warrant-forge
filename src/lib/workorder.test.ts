// The seam with Forge, asserted from Warrant's side.
//
// forge/docs/01-CONTRACT.md is normative: Forge parses these field names in
// fill.py, bench.py, reuse.py and the review UI, so a rename here is a silent
// break over there. The shape assertions below are deliberately the same ones
// Forge's own contract test makes, from the opposite direction.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildWorkOrder } from "./workorder";
import type { EstateRecord } from "./estate";

const ESTATES = "forge/inputs/estates";
const FORM_IDS = ["irs-ss4", "irs-f56", "irs-f8821", "ca-dmv-dl142"];

const records = readdirSync(ESTATES)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(ESTATES, f), "utf8")) as EstateRecord);

describe("work order", () => {
  it("covers all five sample estates", () => {
    expect(records).toHaveLength(5);
  });

  it.each(records.map((r) => [r.meta.recordId, r] as const))(
    "%s matches the contract shape",
    (id, record) => {
      const order = buildWorkOrder(record, { now: new Date("2026-07-28T12:00:00Z") });

      expect(order.estateId).toBe(id);
      expect(order.estatePath).toBe(`inputs/estates/${id}.json`);
      expect(order.generatedAt).toBe("2026-07-28T12:00:00Z");
      expect(order.generatedBy).toBe("warrant");
      expect(order.jurisdiction.state).toBeTruthy();
      expect(order.route).toBeTruthy();

      // Every form in the registry appears, including the skipped ones — a
      // missing entry renders in the review UI as unknown, not as "not needed".
      expect(order.forms.map((f) => f.formId)).toEqual(FORM_IDS);

      for (const f of order.forms) {
        expect(Object.keys(f).sort()).toEqual([
          "applicable",
          "blastRadius",
          "formId",
          "priority",
          "reason",
          "reversibility",
        ]);
        if (f.applicable) {
          expect(f.reason).toBeNull();
          expect(["low", "medium", "high"]).toContain(f.blastRadius);
          // The contract's vocabulary is two-valued; Warrant's `costly` is
          // mapped, never passed through.
          expect(["reversible", "irreversible"]).toContain(f.reversibility);
          expect(f.priority).toBeGreaterThan(0);
        } else {
          expect(f.reason, "a form that is not produced must say why").toBeTruthy();
          expect(f.priority).toBeNull();
          expect(f.blastRadius).toBeNull();
          expect(f.reversibility).toBeNull();
        }
      }
    },
  );

  it("withholds DL 142 on exactly the three estates without a California licence", () => {
    const withheld = records
      .map((r) => buildWorkOrder(r))
      .filter((o) => !o.forms.find((f) => f.formId === "ca-dmv-dl142")!.applicable)
      .map((o) => o.estateId);

    expect(withheld).toEqual([
      "estate-01-nj-ancillary-probate",
      "estate-03-oh-trust-administration",
      "estate-05-in-formal-probate",
    ]);
  });

  it("quotes the estate record's own words when it withholds DL 142", () => {
    for (const record of records) {
      const order = buildWorkOrder(record);
      const dl = order.forms.find((f) => f.formId === "ca-dmv-dl142")!;
      const note = (record.formDL142 as { notApplicableReason?: string })?.notApplicableReason;
      if (!dl.applicable && note) expect(dl.reason).toContain(note);
    }
  });

  it("reports an unknown licence state as undecided, not as inapplicable", () => {
    // estate-01's only identification is a passport. Three-valued logic has to
    // survive the trip across the seam: the form is withheld and the missing
    // fact is named, rather than the absence being read as a "no".
    const order = buildWorkOrder(records.find((r) => r.meta.recordId.startsWith("estate-01"))!);
    const dl = order.forms.find((f) => f.formId === "ca-dmv-dl142")!;
    expect(dl.applicable).toBe(false);
    expect(dl.reason).toContain("Undecided");
    expect(dl.reason).toContain("decedent.licence_state");
  });

  it("carries SS-4's non-reversibility across, rather than dropping the grade", () => {
    // SS-4 is `costly` in the rule pack: a second EIN for one estate cannot be
    // taken back by the filer. It must not arrive at Forge as "reversible".
    const order = buildWorkOrder(records.find((r) => r.meta.recordId.startsWith("estate-02"))!);
    const ss4 = order.forms.find((f) => f.formId === "irs-ss4")!;
    expect(ss4.applicable).toBe(true);
    expect(ss4.reversibility).toBe("irreversible");
  });
});
