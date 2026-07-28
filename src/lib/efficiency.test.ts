import { describe, expect, it, beforeEach } from "vitest";
import { _resetIds, admitAll, type Fact } from "./facts";
import { planCorrespondence, renderLetter, toPlainText } from "./correspondence";
import { LETTER_TEMPLATES, letterById } from "../rules/letters";
import { accountTail, nameAgrees, normaliseInstitution, proposeMerges, summarise } from "./entities";
import { computeEffort, hours, savingExcludingHumanWork } from "./effort";
import { deriveCaFacts } from "../rules/ca-probate";
import { AS_OF, HOYT_DOCS, INITIAL_CANDIDATES } from "../fixtures/hoyt-estate";

function facts(): Fact[] {
  const base = admitAll(INITIAL_CANDIDATES, HOYT_DOCS, { now: 1 });
  return [...base, ...deriveCaFacts(base, AS_OF, 1)];
}

beforeEach(() => _resetIds());

describe("correspondence", () => {
  it("merges verified facts into a letter and formats dates for a reader", () => {
    const t = letterById("letter.institution.notify")!;
    const letter = renderLetter(t, facts(), "Wells Fargo estate servicing");
    expect(letter.ready).toBe(true);
    expect(letter.subject).toBe("Notification of death — Margaret Ellen Hoyt");
    expect(letter.paragraphs[0]).toContain("4 January 2026");
    expect(letter.paragraphs[0]).not.toContain("{");
  });

  it("cites the facts every statement rests on", () => {
    const letter = renderLetter(letterById("letter.family.weekly")!, facts(), "Claire Hoyt");
    expect(letter.citedFacts).toContain("estate.section_13100_gross_value");
    expect(letter.citedFacts).toContain("asset.residence.value");
  });

  it("refuses a letter whose required facts are missing", () => {
    const thin = admitAll(
      INITIAL_CANDIDATES.filter((c) => c.key === "decedent.full_name"),
      HOYT_DOCS,
    );
    const letter = renderLetter(letterById("letter.institution.notify")!, thin, "A bank");
    expect(letter.ready).toBe(false);
    expect(letter.gaps.map((g) => g.key)).toContain("decedent.date_of_death");
  });

  it("never leaves an unresolved placeholder passing as ready", () => {
    for (const t of LETTER_TEMPLATES) {
      const letter = renderLetter(t, facts(), "Recipient");
      if (letter.ready) {
        expect(letter.paragraphs.join(" ")).not.toMatch(/\{[a-z0-9_.]+\}/i);
        expect(letter.subject).not.toMatch(/\{[a-z0-9_.]+\}/i);
      }
    }
  });

  it("lists the enclosures a foreign enquiry actually needs", () => {
    const letter = renderLetter(letterById("letter.foreign.institution")!, facts(), "Banque Pictet");
    const ids = letter.enclosures.map((e) => e.id);
    expect(ids).toContain("apostille");
    expect(ids).toContain("certified_translation");
    expect(letter.enclosures.filter((e) => e.certified).length).toBeGreaterThan(0);
  });

  it("renders plain text with the enclosure list", () => {
    const text = toPlainText(renderLetter(letterById("letter.irs.transcripts")!, facts(), "IRS"));
    expect(text).toContain("Subject: Form 4506-T");
    expect(text).toContain("Enclosures:");
    expect(text).toContain("(certified copy)");
  });

  it("totals the drafting time a plan would replace", () => {
    const plan = planCorrespondence(
      LETTER_TEMPLATES.map((t) => ({ template: t, recipient: "Recipient" })),
      facts(),
    );
    expect(plan.ready).toBeGreaterThan(0);
    expect(plan.minutesSaved).toBeGreaterThan(60);
    expect(plan.ready + plan.blocked).toBe(LETTER_TEMPLATES.length);
  });
});

describe("entity resolution", () => {
  it("normalises institution names", () => {
    expect(normaliseInstitution("Wells Fargo Bank, N.A.")).toBe("wells fargo");
    expect(normaliseInstitution("Charles Schwab & Co., Inc.")).toBe("charles schwab");
  });

  it("extracts an account tail from any identifier shape", () => {
    expect(accountTail("account ending 4471")).toBe("4471");
    expect(accountTail("CH93 0076 2011 6238 5295 7")).toBe("2957");
    expect(accountTail("no digits")).toBeNull();
  });

  it("matches person names across initials and full middle names", () => {
    expect(nameAgrees("MARGARET E HOYT", "Margaret Ellen Hoyt")).toBe(true);
    expect(nameAgrees("Margaret Hoyt", "Margaret Ellen Hoyt")).toBe(true);
    expect(nameAgrees("Margaret Hoyt", "Claire Hoyt")).toBe(false);
    expect(nameAgrees("Margaret Ellen Hoyt", "Margaret Anne Hoyt")).toBe(false);
  });

  it("refuses to merge when account identifiers conflict", () => {
    const f = facts();
    const proposals = proposeMerges(f);
    for (const p of proposals) {
      if (p.strength === "conflicting") {
        expect(p.recommendation).toMatch(/do not merge/i);
      }
    }
  });

  it("proposes rather than decides, and carries its evidence", () => {
    const proposals = proposeMerges(facts());
    for (const p of proposals) {
      expect(p.evidence.length).toBeGreaterThan(0);
      expect(p.signals.length).toBeGreaterThan(0);
      expect(p.recommendation).toBeTruthy();
    }
  });

  it("counts distinct assets and how many pairs need a human", () => {
    const f = facts();
    const s = summarise(f, proposeMerges(f));
    expect(s.distinctAssets).toBeGreaterThan(3);
    expect(s.needingReview).toBeLessThanOrEqual(s.proposals);
  });
});

describe("effort accounting", () => {
  it("subtracts residual review time rather than counting drafts as free", () => {
    const r = computeEffort();
    for (const l of r.lines) {
      expect(l.residualMinutes).toBeGreaterThanOrEqual(0);
      if (l.bucket === "assisted") expect(l.residualMinutes).toBeGreaterThan(0);
      if (l.bucket === "manual") expect(l.residualMinutes).toBe(l.manualMinutes);
    }
  });

  it("reports a saving that excludes work meant to stay human", () => {
    const r = computeEffort();
    const scoped = savingExcludingHumanWork(r);
    // Family conversations and hold time are excluded from the headline.
    expect(scoped.manual).toBeLessThan(r.manualTotal);
    expect(scoped.percent).toBeGreaterThan(r.savedPercent);
  });

  it("marks itself an estimate", () => {
    expect(computeEffort().isEstimate).toBe(true);
  });

  it("formats minutes as readable hours", () => {
    expect(hours(45)).toBe("45 min");
    expect(hours(120)).toBe("2 h");
    expect(hours(155)).toBe("2 h 35 min");
  });

  it("keeps the human-led work in the model rather than hiding it", () => {
    const manual = computeEffort().lines.filter((l) => l.bucket === "manual");
    expect(manual.map((l) => l.id)).toContain("effort.family");
    expect(manual.find((l) => l.id === "effort.family")!.basis).toMatch(/human-led/i);
  });
});
