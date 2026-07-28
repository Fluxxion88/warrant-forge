import { describe, expect, it } from "vitest";
import { compileCounty, parseClaims, verifyClaim, COUNTY_SYSTEM } from "./countycompile";
import type { SourceDoc } from "./verify";

const PAGE: SourceDoc = {
  name: "sonoma-probate.html",
  content: `Superior Court of California, County of Sonoma — Probate Division.

The first paper filing fee in a probate proceeding is $435.00.

Local Rules effective January 1, 2026. Rule 6.3 requires that a Petition for
Probate be accompanied by a completed Probate Examiner Worksheet.

Electronic filing is mandatory for parties represented by counsel as of
July 1, 2024. Wills and codicils must be lodged in paper and may not be
e-filed.

Tentative rulings are posted by 2:00 p.m. on the court day before the hearing.`,
};

describe("compiling a county from its own published text", () => {
  it("accepts a claim whose quote is on the page", () => {
    const v = verifyClaim(
      {
        field: "firstPaperFeeUsd",
        value: "435",
        quote: "The first paper filing fee in a probate proceeding is $435.00.",
        document: "sonoma-probate.html",
      },
      [PAGE],
    );
    expect(v.verdict).toBe("verified");
  });

  it("refuses a fee the page does not state", () => {
    // The single most dangerous failure available here: a plausible fee for a
    // court somebody is about to file in. It must not survive.
    const v = verifyClaim(
      {
        field: "firstPaperFeeUsd",
        value: "465",
        quote: "The first paper filing fee in a probate proceeding is $465.00.",
        document: "sonoma-probate.html",
      },
      [PAGE],
    );
    expect(v.verdict).toBe("unsupported");
    expect(v.similarity).toBeLessThan(1);
  });

  it("refuses a field outside the compilable set", () => {
    const v = verifyClaim(
      {
        field: "hearingJudge",
        value: "Hon. A. Judge",
        quote: "Superior Court of California, County of Sonoma",
        document: "sonoma-probate.html",
      },
      [PAGE],
    );
    expect(v.verdict).toBe("bad_field");
  });

  it("refuses a claim citing a document it was not given", () => {
    const v = verifyClaim(
      {
        field: "court",
        value: "Superior Court of Napa",
        quote: "Superior Court of California, County of Napa",
        document: "napa-probate.html",
      },
      [PAGE],
    );
    expect(v.verdict).toBe("unknown_document");
  });

  it("compiles a profile and records what the sources never mentioned", () => {
    const claims = [
      {
        field: "firstPaperFeeUsd",
        value: "435",
        quote: "The first paper filing fee in a probate proceeding is $435.00.",
        document: PAGE.name,
      },
      {
        field: "efiling.mandatoryFor",
        value: "represented parties",
        quote: "Electronic filing is mandatory for parties represented by counsel",
        document: PAGE.name,
      },
      {
        field: "tentativeRulings",
        value: "posted by 2:00 p.m. the court day before",
        quote: "Tentative rulings are posted by 2:00 p.m. on the court day before the hearing.",
        document: PAGE.name,
      },
      // Invented — no such sentence on the page.
      {
        field: "examiner",
        value: "Petitions are reviewed 30 days before the hearing",
        quote: "The probate examiner reviews all petitions thirty days before the hearing.",
        document: PAGE.name,
      },
    ];

    const c = compileCounty("Sonoma", claims, [PAGE], [
      { name: PAGE.name, url: "https://example.invalid/sonoma", retrievedAt: "2026-07-28" },
    ]);

    expect(c.fields["firstPaperFeeUsd"]).toBe("435");
    expect(c.fields["efiling.mandatoryFor"]).toBe("represented parties");
    expect(c.fields["examiner"], "an invented claim reached the profile").toBeUndefined();
    expect(c.rejected).toHaveLength(1);

    // A page that never mentions something must not read as a county without
    // it. Silence is recorded, not resolved.
    expect(c.silentOn).toContain("examiner");
    expect(c.silentOn).toContain("localRulesEffective");
  });

  it("groups consecutive local-form claims into whole forms", () => {
    const doc: SourceDoc = {
      name: "d",
      content: "Form PR-13 Newspaper Listings must be filed with the petition.",
    };
    const c = compileCounty(
      "Test",
      [
        { field: "localForm.code", value: "PR-13", quote: "Form PR-13", document: "d" },
        { field: "localForm.title", value: "Newspaper Listings", quote: "Newspaper Listings", document: "d" },
        {
          field: "localForm.whenRequired",
          value: "with the petition",
          quote: "must be filed with the petition",
          document: "d",
        },
      ],
      [doc],
      [],
    );
    expect(c.localForms).toEqual([
      { code: "PR-13", title: "Newspaper Listings", whenRequired: "with the petition" },
    ]);
  });

  it("parses the block format the prompt asks for", () => {
    const claims = parseClaims(`
<<<CLAIM
field: firstPaperFeeUsd
value: 435
document: sonoma-probate.html
quote: The first paper filing fee in a probate proceeding is $435.00.
CLAIM>>>
<<<CLAIM
field: tentativeRulings
value: posted by 2 p.m. the day before
document: sonoma-probate.html
quote: Tentative rulings are posted by 2:00 p.m. on the court day before the hearing.
CLAIM>>>
`);
    expect(claims).toHaveLength(2);
    expect(claims[0].field).toBe("firstPaperFeeUsd");
    expect(claims[1].quote).toMatch(/^Tentative rulings/);
  });

  it("tells the model not to fill silence with what is typical", () => {
    expect(COUNTY_SYSTEM).toMatch(/Emit nothing for a field the sources do not address/);
    expect(COUNTY_SYSTEM).toMatch(/Do not carry anything over from another county/);
  });
});
