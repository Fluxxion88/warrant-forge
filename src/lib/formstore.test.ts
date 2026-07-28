import { describe, expect, it } from "vitest";
import { coverage, formKey, formsFor, planDispatch, resolveForm } from "./formstore";
import { FORM_STORE, formByKey } from "../rules/form-catalog";

describe("composite identity", () => {
  it("scopes a printed identifier to its issuer and revision", () => {
    const jc = { kind: "judicial_council" as const, name: "California Judicial Council", state: "CA" };
    expect(formKey(jc, "DE-111", "2017-07-01")).toBe("judicial_council.ca.de-111@2017-07-01");

    const la = { kind: "court" as const, name: "LASC", state: "CA", county: "Los Angeles" };
    expect(formKey(la, "PRO 010")).toBe("court.ca.los-angeles.pro-010");

    const bank = { kind: "institution" as const, name: "Wells Fargo" };
    expect(formKey(bank, "Affidavit of Domicile")).toContain("wells-fargo");
  });

  it("keeps two issuers of the same printed id distinct", () => {
    const both = FORM_STORE.filter((f) => f.printedId === "Affidavit of Domicile");
    expect(both).toHaveLength(2);
    expect(new Set(both.map((f) => f.key)).size).toBe(2);
  });
});

describe("resolution", () => {
  it("resolves a statewide form uniquely", () => {
    const r = resolveForm(FORM_STORE, { printedId: "DE-111", state: "CA" });
    expect(r.form?.title).toBe("Petition for Probate");
    expect(r.ambiguous).toEqual([]);
  });

  it("refuses to guess when two institutions print the same identifier", () => {
    const r = resolveForm(FORM_STORE, { printedId: "Affidavit of Domicile" });
    expect(r.form).toBeUndefined();
    expect(r.ambiguous).toHaveLength(2);
    expect(r.reason).toMatch(/2 issuers/);
  });

  it("disambiguates once the institution is named", () => {
    const r = resolveForm(FORM_STORE, {
      printedId: "Affidavit of Domicile",
      institution: "Charles Schwab",
    });
    expect(r.form?.issuer.name).toBe("Charles Schwab");
  });

  it("will not hand a county form to the wrong county", () => {
    const wrong = resolveForm(FORM_STORE, { printedId: "PRO 010", state: "CA", county: "San Mateo" });
    expect(wrong.form).toBeUndefined();
    expect(wrong.reason).toMatch(/not for this jurisdiction/i);

    const right = resolveForm(FORM_STORE, { printedId: "PRO 010", state: "CA", county: "Los Angeles" });
    expect(right.form?.issuer.county).toBe("Los Angeles");
  });

  it("says so plainly when nothing prints that identifier", () => {
    const r = resolveForm(FORM_STORE, { printedId: "DE-999" });
    expect(r.form).toBeUndefined();
    expect(r.reason).toMatch(/No form in the store/);
  });

  it("returns federal forms for every jurisdiction", () => {
    const sm = formsFor(FORM_STORE, { state: "CA", county: "San Mateo" });
    expect(sm.map((f) => f.printedId)).toContain("4506-T");
    expect(sm.map((f) => f.printedId)).toContain("PR-5");
    // Los Angeles' local form must not appear for San Mateo.
    expect(sm.map((f) => f.printedId)).not.toContain("PRO 010");
  });
});

describe("dispatch", () => {
  it("routes an e-filable court petition electronically", () => {
    const de111 = formByKey("judicial_council.ca.de-111@2017-07-01")!;
    const plan = planDispatch(de111, { signed: true });
    expect(plan.channel).toBe("efile");
    expect(plan.status).toBe("ready");
  });

  it("forces physical delivery where a notarised original is required", () => {
    const aod = FORM_STORE.find((f) => f.issuer.name === "Wells Fargo")!;
    const plan = planDispatch(aod, { signed: true });
    expect(plan.channel).toBe("postal");
    expect(plan.steps.join(" ")).toMatch(/notaris/i);
    expect(plan.steps.join(" ")).toMatch(/wet signature/i);
  });

  it("puts the telephone call before the paperwork where the bank demands it", () => {
    const chase = FORM_STORE.find((f) => f.issuer.name === "JPMorgan Chase")!;
    const plan = planDispatch(chase, { signed: true });
    expect(plan.steps[0]).toMatch(/Telephone JPMorgan Chase estate servicing first/);
  });

  it("blocks dispatch of an unsigned form that has a signature block", () => {
    const de310 = FORM_STORE.find((f) => f.printedId === "DE-310")!;
    const plan = planDispatch(de310, { signed: false });
    expect(plan.status).toBe("blocked");
    expect(plan.blockers.join(" ")).toMatch(/not yet signed/i);
  });

  it("carries signature block coordinates for the e-sign packet", () => {
    const de310 = FORM_STORE.find((f) => f.printedId === "DE-310")!;
    expect(de310.signatures[0].rect.width).toBeGreaterThan(0);
    expect(de310.signatures[0].pageNum).toBeGreaterThanOrEqual(0);
  });
});

describe("store coverage", () => {
  it("reports what the store actually holds", () => {
    const c = coverage(FORM_STORE);
    expect(c.total).toBe(FORM_STORE.length);
    expect(c.byIssuerKind.judicial_council).toBeGreaterThan(0);
    expect(c.byIssuerKind.institution).toBeGreaterThan(0);
    expect(c.byIssuerKind.federal_agency).toBeGreaterThan(0);
    expect(c.requiringWetSignature).toBeGreaterThan(0);
    expect(c.requiringPhoneFirst).toBe(1);
  });

  it("records provenance on every record", () => {
    for (const f of FORM_STORE) {
      expect(f.sourceUrl).toMatch(/^https?:\/\//);
      expect(f.retrievedAt).toBe("2026-07-27");
      expect(f.parties.length).toBeGreaterThan(0);
      expect(f.delivery.channels.length).toBeGreaterThan(0);
    }
  });
});
