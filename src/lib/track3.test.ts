import { describe, expect, it, beforeEach } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { _resetIds, integrity, quarantined, values } from "./facts";
import { importEstate, leafPaths, type EstateRecord } from "./estate";
import { fillForm, formatForBox, evaluateCondition, toFillPayload } from "./fill";
import { decide } from "./rules";
import {
  FORM_RULES,
  FORM56_LINE1,
  form56DateLine,
  form56Overrides,
} from "../rules/form-applicability";
import {
  adjudicate,
  admitMappings,
  parseCondition,
  type FieldMap,
  type FormGeometry,
} from "./formmap";

/**
 * Alix supplied five estate records and four fillable forms as Track 3
 * resources. They are synthetic but deliberately awkward: a truncated street
 * address, ALL-CAPS cities, a Florida-format licence held by a Texas resident,
 * a California licence one digit too long, three estates where the California
 * DMV form does not apply at all. Their provenance notes say outright that
 * these shapes are preserved so that "an auto-fill has to handle the malformed
 * values that are actually in the table".
 *
 * The records are not committed — they are Alix's to distribute, and this repo
 * is public — so these tests skip when the sample directory is absent. The
 * field maps they exercise are committed, because those describe form
 * structure and contain no estate data.
 */
const SAMPLES = "samples/track3";
const MAPS = "src/forms/maps";
const present = existsSync(SAMPLES);
const suite = present ? describe : describe.skip;

function records(): EstateRecord[] {
  return readdirSync(SAMPLES)
    .filter((f) => f.startsWith("estate-") && f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(SAMPLES, f), "utf8")) as EstateRecord);
}

function maps(): FieldMap[] {
  return readdirSync(MAPS)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(MAPS, f), "utf8")) as FieldMap);
}

beforeEach(() => _resetIds());

describe("field maps (committed, always run)", () => {
  it("covers all four Track 3 forms", () => {
    expect(maps().map((m) => m.form).sort()).toEqual([
      "ca-dl142",
      "irs-56",
      "irs-8821",
      "irs-ss4",
    ]);
  });

  it("every committed entry carries the printed label it was justified by", () => {
    for (const m of maps()) {
      for (const e of m.entries) {
        expect(e.labelQuote.length, `${m.form} ${e.field}`).toBeGreaterThan(0);
        expect(e.target.length, `${m.form} ${e.field}`).toBeGreaterThan(0);
      }
    }
  });

  it("never maps a decedent identifier into a fiduciary box, or the reverse", () => {
    // The single most damaging mapping error available on these forms: Form 56
    // prints the decedent's SSN and the fiduciary's details a few lines apart.
    for (const m of maps()) {
      for (const e of m.entries) {
        const label = e.labelQuote.toLowerCase();
        if (/^decedent\./.test(e.target)) {
          expect(label, `${m.form} ${e.field}`).not.toMatch(/fiduciary/);
        }
        if (/^fiduciary\./.test(e.target)) {
          expect(label, `${m.form} ${e.field}`).not.toMatch(/decedent/);
        }
      }
    }
  });

  it("explains every refusal it records", () => {
    // Not "there must be refusals" — an earlier version asserted exactly that
    // and went red the moment a better prompt stopped producing bad proposals.
    // A test that fails when the system improves is measuring the wrong thing.
    // What must hold is that any refusal carries a usable explanation.
    for (const m of maps()) {
      for (const r of m.rejected) {
        expect(r.note.length, `${m.form} ${r.field}`).toBeGreaterThan(20);
        expect(r.verdict).not.toBe("verified");
      }
    }
  });

  it("refuses the four ways a mapping can be unfounded", () => {
    // The refusal mechanism, exercised directly rather than relying on a model
    // to make each mistake. Every one of these has been produced by a real run
    // at some point, which is why each is checked.
    const geometry: FormGeometry = {
      form: "test",
      sourceFile: "test.pdf",
      pages: 1,
      widgets: [
        {
          name: "box", page: 1, type: "/Btn", rect: [0, 0, 10, 10],
          tip: null, states: ["/1", "/Off"],
          left: "", right: "Valid trust instrument", above: "", below: "",
        },
        {
          name: "txt", page: 1, type: "/Tx", rect: [0, 20, 100, 32],
          tip: null, states: null,
          left: "", right: "", above: "Fiduciary's name", below: "",
        },
      ],
    };

    const run = admitMappings(geometry, [
      // A widget that does not exist.
      { field: "ghost", target: "a.b", labelQuote: "anything" },
      // A label not printed anywhere near the widget.
      { field: "txt", target: "decedent.ssn", labelQuote: "Decedent's social security no." },
      // No label at all — trivially "locatable" unless explicitly refused.
      { field: "txt", target: "fiduciary.name.full", labelQuote: "" },
      // A tick state the widget does not have.
      {
        field: "box", target: "authority.basis", labelQuote: "Valid trust instrument",
        onState: "/7", condition: "authority.basis == ValidTrustInstrument",
      },
      // Prose where the grammar requires an expression.
      {
        field: "box", target: "authority.basis", labelQuote: "Valid trust instrument",
        onState: "/1", condition: "authority.basis is a valid trust instrument",
      },
      // The one good mapping.
      {
        field: "box", target: "authority.basis", labelQuote: "Valid trust instrument",
        onState: "/1", condition: "authority.basis == ValidTrustInstrument",
      },
    ]);

    expect(run.proposals.map((p) => p.verdict)).toEqual([
      "unknown_field",
      "unsupported_label",
      "unsupported_label",
      "bad_state",
      "unparseable_condition",
      "verified",
    ]);
    expect(run.verified).toHaveLength(1);
  });

  it("keeps the signature block out of the title box", () => {
    // Two independent runs disagreed here and the wrong one won: the only
    // same-line text is "Here", from "Please Sign Here", so one model read the
    // box as the signer's name. It sits above the caption "Title, if
    // applicable", and the generated form declared the fiduciary's title to be
    // her own name. Settled by rendering; recorded as an adjudication.
    const m = maps().find((f) => f.form === "irs-56")!;
    const sig = m.entries.find((e) => e.field.includes("f2_15"));
    expect(sig?.target).toBe("form56.signature.title");
    expect(sig?.labelQuote).toBe("Title, if applicable");
  });

  it("re-applies adjudications and verifies them like any other mapping", () => {
    const geometry: FormGeometry = {
      form: "test",
      sourceFile: "t.pdf",
      pages: 1,
      widgets: [
        {
          name: "w", page: 1, type: "/Tx", rect: [0, 0, 60, 12],
          tip: null, states: null,
          left: "Here", right: "", above: "", below: "Title, if applicable",
        },
      ],
    };
    const run = admitMappings(geometry, [
      { field: "w", target: "signature.signerName", labelQuote: "Here" },
    ]);
    expect(run.verified[0].target).toBe("signature.signerName");

    const base = {
      form: "test", field: "w", decidedBy: "review", decidedAt: "2026-07-28", reason: "caption",
    };

    // A correct override replaces the discovered target.
    const good = adjudicate(run, geometry, [
      { ...base, target: "signature.title", labelQuote: "Title, if applicable" },
    ]);
    expect(good.applied).toHaveLength(1);
    expect(good.run.verified).toHaveLength(1);
    expect(good.run.verified[0].target).toBe("signature.title");

    // An override citing a label that is not printed there is refused, and the
    // discovered mapping stands. A human is a better judge of which field a box
    // is; no better at remembering what page two actually says.
    const bad = adjudicate(run, geometry, [
      { ...base, target: "signature.date", labelQuote: "Date of signature" },
    ]);
    expect(bad.applied).toHaveLength(0);
    expect(bad.refused[0].verdict).toBe("unsupported_label");
    expect(bad.run.verified[0].target).toBe("signature.signerName");
  });

  it("accepts only the four condition forms it can evaluate", () => {
    expect(parseCondition("authority.basis == ValidTrustInstrument")).toEqual({
      path: "authority.basis", op: "==", value: "ValidTrustInstrument",
    });
    expect(parseCondition("taxMatters.taxTypes includes Income")).toEqual({
      path: "taxMatters.taxTypes", op: "includes", value: "Income",
    });
    expect(parseCondition("authority.hasWill")).toEqual({
      path: "authority.hasWill", op: "truthy",
    });
    // Prose that begins with a real path is the dangerous case: it looks like a
    // bare truthiness test and would tick the box on any non-empty basis.
    expect(parseCondition("authority.basis is a valid trust instrument")).toBeNull();
    expect(parseCondition("")).toBeNull();
  });
});

describe("value formatting", () => {
  it("converts ISO dates to the US format every one of these forms uses", () => {
    expect(formatForBox("2026-01-23", "decedent.dateOfDeath")).toBe("01/23/2026");
  });

  it("leaves a malformed identifier exactly as the record holds it", () => {
    // A California licence one digit too long, and a truncated street address.
    // Both are real shapes from the samples; correcting them would be inventing.
    expect(formatForBox("B38401962", "formDL142.documentNumber")).toBe("B38401962");
    expect(formatForBox("151 N", "form8821.designees.0.address.line1")).toBe("151 N");
  });

  it("treats an unknown condition as unknown, not as false", () => {
    expect(evaluateCondition("authority.basis == ValidTrustInstrument", {})).toBeNull();
    expect(
      evaluateCondition("authority.basis == ValidTrustInstrument", {
        authority: { basis: "ValidTrustInstrument" },
      }),
    ).toBe(true);
    expect(
      evaluateCondition("authority.basis == ValidTrustInstrument", {
        authority: { basis: "CourtAppointmentTestate" },
      }),
    ).toBe(false);
  });
});

suite("the five Alix estate records", () => {
  it("imports all five without a broken path", () => {
    for (const r of records()) {
      const { facts } = importEstate(r);
      const bad = quarantined(facts);
      if (bad.length) {
        throw new Error(
          `${r.meta.recordId}: ${bad.length} quarantined\n` +
            bad.map((f) => `  ${f.key}: ${f.warrant.note}`).join("\n"),
        );
      }
      expect(integrity(facts).integrityScore, r.meta.recordId).toBe(1);
      expect(facts.length, r.meta.recordId).toBeGreaterThan(25);
    }
  });

  it("leaves an absent EIN absent rather than filling it with a blank", () => {
    // Two records have no EIN yet; SS-4 is the live application. If the importer
    // wrote an empty string the gap would vanish and the rule would misfire.
    const byId = new Map(records().map((r) => [r.meta.recordId, r]));
    const intestate = byId.get("estate-02-ca-intestate-independent-admin")!;
    const v = values(importEstate(intestate).facts);
    expect(v["estate.ein"]).toBeUndefined();

    const indiana = byId.get("estate-05-in-formal-probate")!;
    expect(values(importEstate(indiana).facts)["estate.ein"]).toBe("35-6082714");
  });

  it("preserves the deliberately awkward values instead of tidying them", () => {
    const byId = new Map(records().map((r) => [r.meta.recordId, r]));
    // ALL-CAPS city, preserved from the source system.
    const ca = values(importEstate(byId.get("estate-02-ca-intestate-independent-admin")!).facts);
    expect(ca["estate.mailing_city"]).toBe("INGLEWOOD");
    // A California licence with one digit too many.
    const trust = values(importEstate(byId.get("estate-04-ca-trust-and-estate")!).facts);
    expect(trust["decedent.licence_number"]).toBe("B38401962");
  });

  it("agrees with Alix's own DL 142 applicability call on every record", () => {
    // The strongest available check: each record states whether DL 142 applies,
    // and why. Our rule derives it independently from the licence's issuing
    // state. The two must agree five times out of five.
    for (const r of records()) {
      const v = values(importEstate(r).facts);
      // Evaluated in the estate's OWN venue, not a hardcoded "CA". An earlier
      // version of this test passed `state: "CA"` for every record, which made
      // it agree with Alix five times out of five while the real pipeline —
      // which uses the record's actual state — silently dropped the rule for
      // the three out-of-state estates. A test that cannot fail the way
      // production fails is not testing production.
      const state = r.estateEntity.principalState ?? "CA";
      const decisions = decide(FORM_RULES, v, { state });
      const dl = decisions.find((d) => d.decisionPoint === "form_dl142");
      const applies = dl?.chosen?.ruleId === "form.dl142.applies";
      const expected = (r.formDL142 as { applicable?: boolean } | undefined)?.applicable ?? false;
      expect(applies, `${r.meta.recordId} — ${dl?.chosen?.outcome ?? "no decision"}`).toBe(expected);
    }
  });

  it("says why DL 142 was skipped, rather than just omitting it", () => {
    const byId = new Map(records().map((r) => [r.meta.recordId, r]));
    const indiana = byId.get("estate-05-in-formal-probate")!;
    const v = values(importEstate(indiana).facts);
    const dl = decide(FORM_RULES, v, { state: "IN" }).find((d) => d.decisionPoint === "form_dl142");
    expect(dl?.chosen?.ruleId).toBe("form.dl142.out_of_state");
    expect(dl?.chosen?.rule.then.conclusion).toMatch(/another state/i);
    expect(dl?.chosen?.rule.then.obligations.join(" ")).toMatch(/issuing state/i);
  });

  it("calls SS-4 needed exactly when the estate has no EIN", () => {
    for (const r of records()) {
      const v = values(importEstate(r).facts);
      const d = decide(FORM_RULES, v, { state: "CA" }).find((x) => x.decisionPoint === "form_ss4");
      const hasEin = Boolean(r.estateEntity.ein);
      expect(d?.chosen?.ruleId, r.meta.recordId).toBe(
        hasEin ? "form.ss4.not_needed" : "form.ss4.needed",
      );
    }
  });

  it("picks the Form 56 line-1 box and the matching date line", () => {
    const byId = new Map(records().map((r) => [r.meta.recordId, r]));
    const testate = byId.get("estate-05-in-formal-probate")!;
    expect(FORM56_LINE1[testate.authority.basis!].box).toBe("a");
    expect(form56DateLine(testate.authority.basis!)).toBe("death");

    const intestate = byId.get("estate-02-ca-intestate-independent-admin")!;
    expect(FORM56_LINE1[intestate.authority.basis!].box).toBe("b");

    // The Ohio successor trustee: box 1e, and line 2b takes the appointment
    // date, not the date of death. The record's own label says exactly this.
    const trust = byId.get("estate-03-oh-trust-administration")!;
    expect(FORM56_LINE1[trust.authority.basis!].box).toBe("e");
    expect(form56DateLine(trust.authority.basis!)).toBe("appointment");
  });
});

suite("filling the real forms from the real records", () => {
  it("fills every form for every record without a broken mapping", () => {
    // `broken` means a map points at a path no record has — the mapping and the
    // schema have drifted apart. Across 5 records x 4 forms that must be zero.
    for (const r of records()) {
      for (const m of maps()) {
        const f = fillForm(m, r);
        expect(f.broken.map((b) => `${b.field} -> ${b.target}`), `${r.meta.recordId}/${m.form}`)
          .toEqual([]);
      }
    }
  });

  it("fills a substantial share of each form", () => {
    for (const r of records()) {
      for (const m of maps()) {
        const f = fillForm(m, r);
        const textBoxes = f.fields.filter((x) => x.type === "/Tx").length;
        const filledText = f.fields.filter((x) => x.type === "/Tx" && x.status === "filled").length;
        expect(filledText / Math.max(1, textBoxes), `${r.meta.recordId}/${m.form}`)
          .toBeGreaterThan(0.4);
      }
    }
  });

  it("puts the right person's details in the right boxes", () => {
    // Expectations are read out of the record rather than written as literals.
    // Hardcoding them would publish Alix's sample estate data into a public
    // repo through the back door, which is the thing samples/ is gitignored to
    // prevent — and it would make the test a transcription exercise rather
    // than a check that the mapping routes each value to the right box.
    const f56 = maps().find((m) => m.form === "irs-56")!;

    for (const r of records()) {
      const filled = fillForm(f56, r);
      const byTarget = new Map(filled.fields.map((x) => [x.target, x]));

      expect(byTarget.get("estateEntity.legalName")?.value, r.meta.recordId)
        .toBe(r.estateEntity.legalName);
      expect(byTarget.get("fiduciary.name.full")?.value, r.meta.recordId)
        .toBe(r.fiduciary.name.full);
      if (r.decedent.ssn) {
        expect(byTarget.get("decedent.ssn")?.value, r.meta.recordId).toBe(r.decedent.ssn);
      }

      // The fiduciary's own SSN must never appear on Form 56 — it asks only for
      // the decedent's, and the two boxes sit inches apart. Two records carry a
      // fiduciary SSN, so this is a live check, not a hypothetical one.
      if (r.fiduciary.ssn) {
        for (const x of filled.fields) {
          if (x.status === "filled") {
            expect(x.value, `${r.meta.recordId} leaked the fiduciary SSN into ${x.field}`)
              .not.toBe(r.fiduciary.ssn);
          }
        }
      }
    }
  });

  it("never fills both Form 56 date lines at once", () => {
    // 2a takes the date of death, 2b the date of appointment, and they are
    // mutually exclusive. A purely structural field map fills both, quite
    // reasonably — each box does hold a date — and the resulting form asserts
    // that the fiduciary's authority arises from two provisions at once.
    // Caught by rendering a filled PDF and looking at it; read-back had passed.
    const A = "topmostSubform[0].Page1[0].f1_19[0]";
    const B = "topmostSubform[0].Page1[0].f1_20[0]";
    const map = maps().find((m) => m.form === "irs-56")!;

    for (const r of records()) {
      const payload = toFillPayload(fillForm(map, r));
      const ov = form56Overrides(r);
      for (const k of ov.clear) delete payload[k];
      Object.assign(payload, ov.set);

      const both = Boolean(payload[A]) && Boolean(payload[B]);
      expect(both, `${r.meta.recordId} filled both 2a and 2b`).toBe(false);

      // And exactly one line-1 box is ticked.
      const ticked = Object.keys(payload).filter((k) => k.includes("c1_1["));
      expect(ticked.length, `${r.meta.recordId} line 1`).toBe(1);
    }
  });

  it("puts the date on the line the authority basis calls for", () => {
    const A = "topmostSubform[0].Page1[0].f1_19[0]";
    const B = "topmostSubform[0].Page1[0].f1_20[0]";
    const byId = new Map(records().map((r) => [r.meta.recordId, r]));

    // Indiana: court-appointed under a will -> box 1a, date of death on 2a.
    const inOv = form56Overrides(byId.get("estate-05-in-formal-probate")!);
    expect(inOv.set["topmostSubform[0].Page1[0].c1_1[0]"]).toBe("/1");
    expect(inOv.set[A]).toBe("01/23/2026");
    expect(inOv.set[B]).toBeUndefined();

    // Ohio: successor trustee -> box 1e, appointment date on 2b, 2a blank.
    const ohOv = form56Overrides(byId.get("estate-03-oh-trust-administration")!);
    expect(ohOv.set["topmostSubform[0].Page1[0].c1_1[4]"]).toBe("/5");
    expect(ohOv.set[B]).toBe("06/29/2026");
    expect(ohOv.set[A]).toBeUndefined();
  });

  it("refuses to guess a line-1 box it does not recognise", () => {
    const ov = form56Overrides({ authority: { basis: "SomethingNewAlixAdded" } });
    expect(ov.set).toEqual({});
    expect(ov.unresolved.join(" ")).toMatch(/human must choose/i);
  });

  it("answers no question the record does not answer", () => {
    // Form 56 line 2c asks whether the taxpayer's ASSETS are in the custody of
    // the court. Discovery wired it to isCourtProceeding — whether a court case
    // exists at all. Every sample estate has one, so "Yes" was ticked on every
    // generated form, asserting to the IRS that the court holds the assets.
    // assetsUnderCourtControl is null in all five records, so both boxes must
    // stay blank. Label verification cannot catch this: the cited label is
    // really printed there and the condition parses. Only reading the question
    // caught it, which is the honest limit of what verification proves.
    const YES = "topmostSubform[0].Page1[0].c1_2[0]";
    const NO = "topmostSubform[0].Page1[0].c1_2[1]";
    const map = maps().find((m) => m.form === "irs-56")!;

    for (const r of records()) {
      const payload = toFillPayload(fillForm(map, r));
      expect(payload[YES], `${r.meta.recordId} claimed court custody of assets`).toBeUndefined();
      expect(payload[NO], `${r.meta.recordId} denied court custody of assets`).toBeUndefined();
    }
  });

  it("ticks only the tax types the record actually lists", () => {
    const map = maps().find((m) => m.form === "irs-56")!;
    const byField = new Map(map.entries.map((e) => [e.field, e]));
    const indiana = records().find((r) => r.meta.recordId === "estate-05-in-formal-probate")!;
    const payload = toFillPayload(fillForm(map, indiana));

    // taxTypes is ["Income", "Estate"] — two of seven boxes, not none and not all.
    const ticked = Object.keys(payload)
      .filter((k) => byField.get(k)?.target === "taxMatters.taxTypes")
      .map((k) => byField.get(k)!.condition)
      .sort();
    expect(ticked).toEqual([
      "taxMatters.taxTypes includes Estate",
      "taxMatters.taxTypes includes Income",
    ]);
  });

  it("reports gaps by name instead of leaving boxes mysteriously blank", () => {
    const ohio = records().find((r) => r.meta.recordId === "estate-03-oh-trust-administration")!;
    const ss4 = maps().find((m) => m.form === "irs-ss4")!;
    const f = fillForm(ss4, ohio);
    // This trust has no EIN — that is the whole point of filing SS-4 — so any
    // EIN-ish gap must be named rather than silently absent.
    for (const g of f.gaps) expect(g.target.length).toBeGreaterThan(0);
    expect(f.filled).toBeGreaterThan(10);
  });

  it("imports a meaningful share of every record's available paths", () => {
    for (const r of records()) {
      const leaves = leafPaths(r).filter((p) => !p.startsWith("provenance."));
      expect(leaves.length, r.meta.recordId).toBeGreaterThan(80);
    }
  });
});
