import { describe, expect, it } from "vitest";
import {
  coverage,
  locateQuote,
  summarise,
  verifyCitation,
  verifyFinding,
  type SourceDoc,
} from "./verify";

const docs: SourceDoc[] = [
  {
    name: "FY24 Management Accounts",
    content:
      "Revenue for FY24 was $48.2M against $41.0M in FY23. Gross margin declined to 22% from 27%. " +
      "The largest customer represented 38% of revenue and its master agreement expires in Q3 2027. " +
      "Days sales outstanding increased from 44 to 71 days over the period.",
  },
  {
    name: "MSA — Apex Retail",
    content:
      "Upon a change of control of the Supplier, Apex Retail may terminate this Agreement on thirty (30) days written notice. " +
      "Liability is capped at twelve months of fees paid.",
  },
];

describe("coverage", () => {
  it("scores an exact quotation as a full match", () => {
    expect(coverage("Gross margin declined to 22% from 27%", docs[0].content)).toBe(1);
  });

  it("tolerates whitespace and smart-quote normalisation", () => {
    expect(coverage("gross   margin declined to 22%  from 27%", docs[0].content)).toBe(1);
  });

  it("scores an invented quotation near zero", () => {
    expect(
      coverage("The board approved a dividend of $5M in December", docs[0].content),
    ).toBeLessThan(0.4);
  });
});

describe("verifyCitation", () => {
  it("verifies a faithful quote from the cited document", () => {
    const r = verifyCitation(
      { document: "FY24 Management Accounts", quote: "The largest customer represented 38% of revenue" },
      docs,
    );
    expect(r.verdict).toBe("verified");
    expect(r.matchedDocument).toBe("FY24 Management Accounts");
  });

  it("flags a real quote attributed to the wrong document", () => {
    const r = verifyCitation(
      { document: "FY24 Management Accounts", quote: "Apex Retail may terminate this Agreement on thirty (30) days written notice" },
      docs,
    );
    expect(r.verdict).toBe("loose");
    expect(r.matchedDocument).toBe("MSA — Apex Retail");
  });

  // The core anti-fabrication guarantee.
  it("marks a fabricated quotation unsupported", () => {
    const r = verifyCitation(
      { document: "FY24 Management Accounts", quote: "EBITDA margin improved to 31% following the restructuring programme" },
      docs,
    );
    expect(r.verdict).toBe("unsupported");
  });

  it("rejects an empty or trivial citation", () => {
    expect(verifyCitation({ document: "FY24 Management Accounts", quote: "" }, docs).verdict).toBe(
      "no_citation",
    );
  });
});

describe("verifyFinding", () => {
  const base = { id: "f1", workstream: "Financial", severity: "HIGH", detail: "…" };

  it("passes a finding with at least one exact citation", () => {
    const f = verifyFinding(
      {
        ...base,
        title: "Customer concentration",
        citations: [
          { document: "FY24 Management Accounts", quote: "The largest customer represented 38% of revenue" },
        ],
      },
      docs,
    );
    expect(f.verification).toBe("verified");
  });

  it("fails a finding whose every citation is fabricated", () => {
    const f = verifyFinding(
      {
        ...base,
        title: "Undisclosed related-party loan",
        citations: [{ document: "FY24 Management Accounts", quote: "a related party loan of $3.4M was extended to the founder" }],
      },
      docs,
    );
    expect(f.verification).toBe("unsupported");
  });

  it("treats an uncited finding as an assertion", () => {
    const f = verifyFinding({ ...base, title: "Margin pressure", citations: [] }, docs);
    expect(f.verification).toBe("no_citation");
  });
});

describe("locateQuote", () => {
  it("returns the exact character range of a verbatim quote", () => {
    const span = locateQuote("Gross margin declined to 22% from 27%", docs[0].content)!;
    expect(docs[0].content.slice(span.start, span.end)).toBe(
      "Gross margin declined to 22% from 27%",
    );
  });

  // The reviewer must still land on the passage when spacing differs.
  it("locates a quote whose whitespace differs from the source", () => {
    const span = locateQuote("largest   customer represented 38%", docs[0].content)!;
    expect(span).not.toBeNull();
    const slice = docs[0].content.slice(span.start, span.end);
    expect(slice).toContain("largest customer represented 38%");
  });

  it("returns null for a quote that is not present", () => {
    expect(locateQuote("EBITDA margin improved to 31%", docs[0].content)).toBeNull();
  });
});

describe("verifyFinding locations", () => {
  it("carries a span so the finding can be opened in its source", () => {
    const f = verifyFinding(
      {
        id: "f1",
        workstream: "Financial",
        severity: "HIGH",
        title: "Concentration",
        detail: "",
        citations: [
          { document: "FY24 Management Accounts", quote: "The largest customer represented 38% of revenue" },
        ],
      },
      docs,
    );
    expect(f.locations).toHaveLength(1);
    expect(f.locations[0].document).toBe("FY24 Management Accounts");
    const { start, end } = f.locations[0];
    expect(docs[0].content.slice(start, end)).toContain("38% of revenue");
  });

  it("has no locations when the citation is fabricated", () => {
    const f = verifyFinding(
      {
        id: "f2",
        workstream: "Financial",
        severity: "HIGH",
        title: "Invented",
        detail: "",
        citations: [{ document: "FY24 Management Accounts", quote: "a related party loan of $3.4M" }],
      },
      docs,
    );
    expect(f.verification).toBe("unsupported");
    expect(f.locations).toHaveLength(0);
  });
});

describe("summarise", () => {
  it("computes an integrity score over a mixed set", () => {
    const mk = (verification: string) =>
      ({
        id: "x",
        workstream: "w",
        severity: "HIGH",
        title: "t",
        detail: "d",
        citations: [],
        verification,
        verificationNotes: [],
      }) as never;
    const s = summarise([mk("verified"), mk("verified"), mk("unsupported"), mk("loose")]);
    expect(s.total).toBe(4);
    expect(s.verified).toBe(2);
    expect(s.integrityScore).toBe(0.5);
  });
});

describe("altering a figure inside a real sentence", () => {
  // The hole this closes: n-gram coverage is deliberately tolerant so a
  // faithful quote survives reflowed lines and smart quotes. Swap one number in
  // an eleven-token sentence and only one of eight four-gram windows misses —
  // 0.875, over the 0.85 threshold, and the fabricated figure came back
  // "verified". In this domain the number IS the claim: a fee, a statutory cap,
  // a date-of-death balance.
  const page: SourceDoc[] = [
    {
      name: "fees.html",
      content: "The first paper filing fee in a probate proceeding is $435.00 as of 1 January 2026.",
    },
  ];

  it("refuses a quote whose figure is not in the document", () => {
    const r = verifyCitation(
      {
        document: "fees.html",
        quote: "The first paper filing fee in a probate proceeding is $465.00",
      },
      page,
    );
    expect(r.verdict).toBe("unsupported");
    expect(r.note).toMatch(/\$465\.00/);
    expect(r.note).toMatch(/not a quotation/);
  });

  it("still accepts the same sentence quoted correctly", () => {
    const r = verifyCitation(
      {
        document: "fees.html",
        quote: "The first paper filing fee in a probate proceeding is $435.00",
      },
      page,
    );
    expect(r.verdict).toBe("verified");
  });

  it("leaves quotes carrying no figures exactly as they were", () => {
    // The guard must not become a general tightening. A prose quote has no
    // digit tokens, so it takes the same path it always did.
    const prose: SourceDoc[] = [
      { name: "d", content: "Wills and codicils must be lodged in paper and may not be e-filed." },
    ];
    expect(
      verifyCitation({ document: "d", quote: "must be lodged in paper and may not be e-filed" }, prose)
        .verdict,
    ).toBe("verified");
  });

  it("is a check on the figure, not on how precisely it is written", () => {
    // The guard asks only whether the digits occur in the document. It is plain
    // coverage — not this check — that rejects a quote which stops being
    // verbatim, which is why dropping the cents still fails: "$435 as of" is
    // not what the page says.
    const dropped = verifyCitation(
      { document: "fees.html", quote: "probate proceeding is $435 as of 1 January 2026" },
      page,
    );
    expect(dropped.note).not.toMatch(/not a quotation/);
  });

  it("catches an altered date as readily as an altered amount", () => {
    const r = verifyCitation(
      {
        document: "fees.html",
        quote: "The first paper filing fee in a probate proceeding is $435.00 as of 1 January 2027",
      },
      page,
    );
    expect(r.verdict).toBe("unsupported");
    expect(r.note).toMatch(/2027/);
  });
});
