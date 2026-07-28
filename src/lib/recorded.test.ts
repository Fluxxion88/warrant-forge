import { describe, expect, it, beforeEach } from "vitest";
import { _resetIds, admitAll, integrity, quarantined, values } from "./facts";
import { decide } from "./rules";
import { CA_RULES, deriveCaFacts } from "../rules/ca-probate";
import { buildFill } from "./anvil";
import { DE_310 } from "../rules/ca-forms";
import { AS_OF, HOYT_DOCS } from "../fixtures/hoyt-estate";
import { RECORDED, RECORDED_CANDIDATES, RECORDED_SUMMARY } from "../fixtures/recorded";

/**
 * These assertions describe a real model run, not a hand-written fixture.
 * If a change to the prompt, parser or verifier degrades real-world yield,
 * this file is where it shows up.
 */

function facts() {
  const base = admitAll(RECORDED_CANDIDATES, HOYT_DOCS, { now: 1 });
  return [...base, ...deriveCaFacts(base, AS_OF, 1)];
}

beforeEach(() => _resetIds());

describe("the recorded live run", () => {
  it("is a real run against a real model", () => {
    expect(RECORDED.version).toBe(1);
    expect(RECORDED_SUMMARY.model).toBeTruthy();
    expect(RECORDED_SUMMARY.documents).toBe(HOYT_DOCS.length);
    expect(RECORDED_SUMMARY.inputTokens).toBeGreaterThan(1000);
  });

  it("parsed without a single malformed block", () => {
    expect(RECORDED_SUMMARY.parseErrors).toBe(0);
  });

  it("proposed a substantial number of facts", () => {
    expect(RECORDED_SUMMARY.candidates).toBeGreaterThanOrEqual(35);
  });

  it("every quotation the model produced survives verification", () => {
    const all = admitAll(RECORDED_CANDIDATES, HOYT_DOCS, { now: 1 });
    const bad = quarantined(all);
    if (bad.length) {
      // Surface the offending quotes rather than a bare count.
      throw new Error(
        `${bad.length} quarantined:\n` +
          bad
            .map((f) => `  ${f.key}: ${String((f.warrant as { quote?: string }).quote).slice(0, 90)}`)
            .join("\n"),
      );
    }
    expect(integrity(all).integrityScore).toBe(1);
  });

  it("recovers the facts the court forms actually need", () => {
    const v = values(facts());
    for (const key of [
      "decedent.full_name",
      "decedent.date_of_death",
      "decedent.place_of_death",
      "estate.county",
      "estate.petitioner_name",
      "asset.residence.value",
      "asset.residence.address",
      "asset.residence.is_primary_residence",
    ]) {
      expect(v[key], key).toBeDefined();
    }
  });

  it("recovers the offshore indicators", () => {
    const v = values(facts());
    expect(v["tax.schedule_b.foreign_account"]).toBe(true);
    expect(v["tax.form_5471.filed"]).toBe(true);
    // The model returned "SWITZERLAND" because the transcript prints it in
    // capitals. Faithful copying is what we asked for, so the assertion — and
    // the rules engine — compare case-insensitively rather than demanding the
    // model tidy its source.
    expect(String(v["banking.international_wire.country"]).toLowerCase()).toBe("switzerland");
  });

  it("reaches the same probate conclusion as the hand-written fixture", () => {
    const decisions = decide(CA_RULES, values(facts()), { state: "CA", county: "San Mateo" });
    const route = decisions.find((d) => d.decisionPoint === "residence_route");
    expect(route?.chosen?.ruleId).toBe("ca.residence.13151_petition");
  });

  it("derives the gross value from the model's own extracted figures", () => {
    const v = values(facts());
    expect(typeof v["estate.section_13100_gross_value"]).toBe("number");
    expect(v["estate.section_13100_gross_value"]).toBeLessThan(208_850);
  });

  it("fills DE-310 from a real extraction", () => {
    const fill = buildFill(DE_310, facts());
    expect(fill.payload.decedentName).toBe("Margaret Ellen Hoyt");
    expect(fill.payload.petitionerName).toBe("Claire Hoyt");
    expect(fill.payload.grossValue).toBe("$740,000");
    // The parcel number is genuinely absent from the data room, so the form
    // stays honestly incomplete rather than being filled with a guess.
    expect(fill.missingRequired).toContain("asset.residence.apn");
  });
});
