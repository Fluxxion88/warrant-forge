// Call-recording consent law, as a test.
//
// This file is the guard on a criminal statute, not a style check. Its job is to
// make it hard to quietly introduce a state rule that nobody sourced. Every
// definite rule must carry a verbatim quote and the URL it came from; every
// `unknown` must stay unknown rather than degrading to one_party.

import { describe, expect, it } from "vitest";
import {
  CONSENT_LAW,
  INTERSTATE_RULE_NOTE,
  consentFor,
  type ConsentLaw,
} from "./call-consent";

/** All 50 states plus DC. */
const ALL_JURISDICTIONS = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
  "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

const entries = (): ConsentLaw[] => Object.values(CONSENT_LAW);
const sourced = (): ConsentLaw[] => entries().filter((l) => l.rule !== "unknown");

describe("coverage", () => {
  it("has an entry for every state and DC, and nothing extra", () => {
    expect(Object.keys(CONSENT_LAW).sort()).toEqual([...ALL_JURISDICTIONS].sort());
  });

  it("keys match the state field on each record", () => {
    for (const [key, law] of Object.entries(CONSENT_LAW)) {
      expect(law.state).toBe(key);
    }
  });
});

describe("California", () => {
  it("is all_party", () => {
    expect(CONSENT_LAW.CA.rule).toBe("all_party");
  });

  it("cites Penal Code section 632", () => {
    expect(CONSENT_LAW.CA.citation).toContain("§ 632");
    expect(CONSENT_LAW.CA.citation).toMatch(/Cal.*Penal Code/);
  });

  it("quotes the operative all-parties language from section 632(a)", () => {
    expect(CONSENT_LAW.CA.quote).toContain(
      "without the consent of all parties to a confidential communication",
    );
  });

  it("flags the confidentiality requirement, which is the usual trap", () => {
    expect(CONSENT_LAW.CA.caveat).toBeTruthy();
    expect(CONSENT_LAW.CA.caveat).toMatch(/confidential/i);
  });

  it("points at the official leginfo source", () => {
    expect(CONSENT_LAW.CA.sourceUrl).toContain("leginfo.legislature.ca.gov");
  });
});

describe("provenance", () => {
  it("gives every sourced entry a non-empty verbatim quote", () => {
    const missing = sourced()
      .filter((l) => l.quote.trim().length === 0)
      .map((l) => l.state);
    expect(missing).toEqual([]);
  });

  it("gives every entry a non-empty source URL", () => {
    const missing = entries()
      .filter((l) => !/^https?:\/\/\S+$/.test(l.sourceUrl.trim()))
      .map((l) => l.state);
    expect(missing).toEqual([]);
  });

  it("gives every sourced entry a citation and a retrieval date", () => {
    for (const law of sourced()) {
      expect(law.citation.trim().length, law.state).toBeGreaterThan(0);
      expect(law.retrievedAt, law.state).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("does not let a sourced entry cite a summary site instead of primary text", () => {
    // These aggregate and paraphrase. They are exactly what this table must not
    // be built from, however convenient they are.
    const secondary =
      /justia|findlaw|casetext|nolo|lawserver|casemine|public\.law|wikipedia|rcfp|recordinglaw|shouselaw|mwl-law/i;
    const offenders = sourced()
      .filter((l) => secondary.test(l.sourceUrl))
      .map((l) => `${l.state}: ${l.sourceUrl}`);
    expect(offenders).toEqual([]);
  });

  it("leaves the quote empty on unknown entries rather than inventing filler", () => {
    for (const law of entries().filter((l) => l.rule === "unknown")) {
      expect(law.quote, law.state).toBe("");
      // ...but it must say what was tried, so the human has somewhere to start.
      expect(law.caveat, law.state).toBeTruthy();
      expect(law.citation, law.state).toContain("UNVERIFIED");
    }
  });
});

describe("consentFor: stricter of the two states governs", () => {
  it("resolves a one-party caller and an all-party callee to all_party", () => {
    const d = consentFor("TX", "CA");
    expect(d.rule).toBe("all_party");
    expect(d.mustAnnounce).toBe(true);
    expect(d.states).toEqual(["TX", "CA"]);
  });

  it("resolves an all-party caller and a one-party callee to all_party", () => {
    const d = consentFor("CA", "TX");
    expect(d.rule).toBe("all_party");
    expect(d.mustAnnounce).toBe(true);
  });

  it("explains which state governed and cites it", () => {
    const d = consentFor("TX", "CA");
    expect(d.because).toContain("CA");
    expect(d.because).toContain("§ 632");
    expect(d.because).toMatch(/stricter/i);
  });

  it("leaves a one-party/one-party pair at one_party with no announcement", () => {
    const d = consentFor("TX", "NY");
    expect(d.rule).toBe("one_party");
    expect(d.mustAnnounce).toBe(false);
  });

  it("keeps an all-party/all-party pair at all_party", () => {
    const d = consentFor("WA", "PA");
    expect(d.rule).toBe("all_party");
    expect(d.mustAnnounce).toBe(true);
  });

  it("collapses states to one entry for an intrastate call", () => {
    const d = consentFor("CA", "CA");
    expect(d.rule).toBe("all_party");
    expect(d.states).toEqual(["CA"]);
  });

  it("is order-independent in outcome", () => {
    for (const [a, b] of [["TX", "WA"], ["FL", "OH"], ["MT", "VA"], ["NV", "TX"]]) {
      expect(consentFor(a, b).rule).toBe(consentFor(b, a).rule);
    }
  });

  it("accepts lowercase and padded input", () => {
    expect(consentFor(" ca ", "tx").rule).toBe("all_party");
  });
});

describe("consentFor: unknown propagates and never degrades", () => {
  it("returns unknown when the callee state is unknown", () => {
    // GA could not be sourced: the OCGA is behind a LexisNexis contract.
    expect(CONSENT_LAW.GA.rule).toBe("unknown");
    const d = consentFor("TX", "GA");
    expect(d.rule).toBe("unknown");
  });

  it("returns unknown when the caller state is unknown", () => {
    expect(consentFor("GA", "TX").rule).toBe("unknown");
  });

  it("returns unknown even when the other side is all_party", () => {
    // The strict side must not 'rescue' the unknown side into a definite answer.
    expect(consentFor("CA", "GA").rule).toBe("unknown");
  });

  it("never returns one_party when either side is unknown", () => {
    const unknowns = entries().filter((l) => l.rule === "unknown").map((l) => l.state);
    expect(unknowns.length).toBeGreaterThan(0);
    for (const u of unknowns) {
      for (const other of ALL_JURISDICTIONS) {
        expect(consentFor(u, other).rule, `${u}->${other}`).toBe("unknown");
        expect(consentFor(other, u).rule, `${other}->${u}`).toBe("unknown");
      }
    }
  });

  it("still demands an announcement when the answer is unknown", () => {
    expect(consentFor("TX", "GA").mustAnnounce).toBe(true);
  });

  it("says a human must decide", () => {
    expect(consentFor("TX", "GA").because).toMatch(/human/i);
  });

  it("treats an unrecognized code as unknown, not as one_party", () => {
    for (const bad of ["", "ZZ", "PR", "California", "  "]) {
      const d = consentFor("TX", bad);
      expect(d.rule, bad).toBe("unknown");
      expect(d.mustAnnounce, bad).toBe(true);
    }
  });
});

describe("the states that the popular two-party list gets wrong", () => {
  it("treats Oregon as one_party for telephone, and says why", () => {
    expect(CONSENT_LAW.OR.rule).toBe("one_party");
    expect(CONSENT_LAW.OR.citation).toContain("165.540(1)(a)");
    expect(CONSENT_LAW.OR.caveat).toMatch(/in-person/i);
  });

  it("treats Nevada as all_party despite its one-party-looking clause", () => {
    expect(CONSENT_LAW.NV.rule).toBe("all_party");
    // The conjunctive 'and' is the reason; make sure the quote actually carries it.
    expect(CONSENT_LAW.NV.quote).toContain("prior consent of one of the parties");
    expect(CONSENT_LAW.NV.quote).toContain("emergency situation exists");
  });

  it("keeps Connecticut all_party and notes the civil/criminal split", () => {
    expect(CONSENT_LAW.CT.rule).toBe("all_party");
    expect(CONSENT_LAW.CT.caveat).toMatch(/civil/i);
  });

  it("keeps Illinois all_party and notes the private-conversation limit", () => {
    expect(CONSENT_LAW.IL.rule).toBe("all_party");
    expect(CONSENT_LAW.IL.caveat).toMatch(/private conversation/i);
  });

  it("keeps Massachusetts all_party and notes it turns on secrecy", () => {
    expect(CONSENT_LAW.MA.rule).toBe("all_party");
    expect(CONSENT_LAW.MA.quote).toContain("secretly");
  });

  it("keeps Michigan all_party and flags the participant-recording split", () => {
    expect(CONSENT_LAW.MI.rule).toBe("all_party");
    expect(CONSENT_LAW.MI.caveat).toMatch(/Sullivan v\. Gray/);
  });

  it("keeps Montana all_party and notes that a warning cures it", () => {
    expect(CONSENT_LAW.MT.rule).toBe("all_party");
    expect(CONSENT_LAW.MT.caveat).toMatch(/warning/i);
  });
});

describe("interstate calls", () => {
  it("states plainly that the question is unsettled", () => {
    expect(INTERSTATE_RULE_NOTE).toMatch(/unsettled/i);
  });

  it("says practitioners apply the stricter rule", () => {
    expect(INTERSTATE_RULE_NOTE).toMatch(/stricter/i);
  });

  it("names the authority it relies on", () => {
    expect(INTERSTATE_RULE_NOTE).toContain("2511(2)(d)");
    expect(INTERSTATE_RULE_NOTE).toContain("Kearney");
  });

  it("is honest that Kearney was not verified from a primary source", () => {
    expect(INTERSTATE_RULE_NOTE).toMatch(/not verifiable|not verified/i);
  });
});
