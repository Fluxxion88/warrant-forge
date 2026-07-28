import { describe, expect, it, beforeEach } from "vitest";
import { _resetIds, admitAll } from "./facts";
import { aliasIds, buildFill, parseFieldInfo, reconcile } from "./anvil";
import { DE_111, DE_310, REG_5 } from "../rules/ca-forms";
import { FORM_4506T } from "../rules/federal-forms";
import { deriveCaFacts } from "../rules/ca-probate";
import { AS_OF, HOYT_DOCS, INITIAL_CANDIDATES } from "../fixtures/hoyt-estate";

function facts() {
  const base = admitAll(INITIAL_CANDIDATES, HOYT_DOCS, { now: 1 });
  return [...base, ...deriveCaFacts(base, AS_OF, 1)];
}

beforeEach(() => _resetIds());

describe("form filling", () => {
  it("carries the source quotation onto every filled field", () => {
    const fill = buildFill(DE_310, facts());
    const dod = fill.fields.find((f) => f.alias === "dateOfDeath")!;
    expect(dod.status).toBe("filled");
    expect(dod.value).toBe("01/04/2026");
    expect(dod.provenance?.document).toBe("Certificate of Death.pdf");
    expect(dod.provenance?.quote).toContain("04 January 2026");
  });

  it("formats currency the way the form expects", () => {
    const fill = buildFill(DE_310, facts());
    expect(fill.fields.find((f) => f.alias === "grossValue")?.value).toBe("$740,000");
  });

  it("refuses to fill a field with no verified fact behind it", () => {
    const fill = buildFill(DE_310, facts());
    const legal = fill.fields.find((f) => f.alias === "propertyLegalDescription")!;
    expect(legal.status).toBe("missing");
    expect(legal.value).toBeNull();
    expect(legal.needs).toContain("asset.residence.apn");
    expect(fill.complete).toBe(false);
    expect(fill.payload.propertyLegalDescription).toBeUndefined();
  });

  it("blocks the vehicle transfer on a VIN the data room never gave us", () => {
    const fill = buildFill(REG_5, facts());
    const vin = fill.fields.find((f) => f.alias === "vehicleVin")!;
    expect(vin.status).toBe("missing");
    expect(fill.missingRequired).toContain("asset.vehicle.vin");
    // The value we *do* have still fills, so the gap is precise rather than total.
    expect(fill.fields.find((f) => f.alias === "vehicleValue")?.value).toBe("$16,500");
  });

  it("never lets a quarantined fact reach a payload", () => {
    const fill = buildFill(DE_111, facts());
    const values = Object.values(fill.payload).join(" ");
    expect(values).not.toContain("50,000");
    expect(values).not.toContain("Prudential");
  });

  it("emits constants for boxes that do not vary", () => {
    const fill = buildFill(DE_111, facts());
    expect(fill.payload.publicationRequested).toBe("Yes");
  });

  it("produces a payload keyed by Anvil field alias", () => {
    const fill = buildFill(DE_111, facts());
    expect(fill.payload.decedentName).toBe("Margaret Ellen Hoyt");
    expect(fill.payload.courtCounty).toBe("San Mateo");
    expect(fill.payload.estimatedPersonalProperty).toBe("$148,600");
  });

  it("fills federal forms from the same ledger", () => {
    const fill = buildFill(FORM_4506T, facts());
    expect(fill.payload.line1a_name).toBe("Margaret Ellen Hoyt");
    expect(fill.payload.line6_formNumber).toBe("1040");
    // No SSN in the data room, so the form is honestly incomplete.
    expect(fill.missingRequired).toContain("decedent.ssn");
    expect(fill.complete).toBe(false);
  });
});

describe("template reconciliation", () => {
  it("hands our own aliases to createCast so detection maps onto them", () => {
    const ids = aliasIds(DE_310);
    expect(ids).toContain("grossValue");
    expect(ids).toContain("propertyLegalDescription");
    expect(ids).toHaveLength(DE_310.fields.length);
  });

  it("accepts the shapes Anvil returns fieldInfo in", () => {
    expect(parseFieldInfo(["a", "b"]).map((f) => f.id)).toEqual(["a", "b"]);
    expect(parseFieldInfo({ fields: [{ id: "x", type: "text", pageNum: 0 }] })).toEqual([
      { id: "x", name: undefined, type: "text", pageNum: 0 },
    ]);
    expect(parseFieldInfo([{ aliasId: "y" }]).map((f) => f.id)).toEqual(["y"]);
    expect(parseFieldInfo(null)).toEqual([]);
  });

  it("passes when the template carries every field we bind", () => {
    const anvil = DE_310.fields.map((f) => ({ id: f.alias }));
    const r = reconcile(DE_310, anvil);
    expect(r.ok).toBe(true);
    expect(r.missingInAnvil).toEqual([]);
    expect(r.matched).toHaveLength(DE_310.fields.length);
  });

  it("catches a binding whose field the template does not have", () => {
    // The fill endpoint drops unknown aliases silently — a blank box on a
    // filed petition. Reconciliation is what makes that visible beforehand.
    const anvil = DE_310.fields
      .filter((f) => f.alias !== "grossValue")
      .map((f) => ({ id: f.alias }));
    const r = reconcile(DE_310, anvil);
    expect(r.ok).toBe(false);
    expect(r.missingInAnvil).toContain("grossValue");
  });

  it("reports template fields nobody has bound", () => {
    const anvil = [...DE_310.fields.map((f) => ({ id: f.alias })), { id: "attorneyBarNumber" }];
    const r = reconcile(DE_310, anvil);
    expect(r.ok).toBe(true);
    expect(r.unboundInAnvil).toContain("attorneyBarNumber");
  });
});
