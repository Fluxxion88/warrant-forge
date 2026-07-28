import { describe, expect, it, vi } from "vitest";
import { CATALOG, selectModel, costOf } from "./catalog";
import {
  checkpointOf,
  DEFAULT_CONFIG,
  parseFindings,
  runPipeline,
  sortFindings,
  type AvailableModel,
  type CompleteFn,
  type DealContext,
  type NodeEvent,
} from "./pipeline";
import type { SourceDoc } from "./verify";

const deal: DealContext = {
  codeName: "Northwind",
  target: "Northwind Logistics Ltd.",
  sector: "Transportation & Logistics",
  geography: "UK",
  dealType: "Acquisition — 100%",
  consideration: "$120M enterprise value",
  stage: "Confirmatory diligence",
  thesis: "Consolidate regional freight; margin expansion via route density.",
};

const docs: SourceDoc[] = [
  {
    name: "FY24 Management Accounts",
    content:
      "Revenue for FY24 was $48.2M against $41.0M in FY23. Gross margin declined to 22% from 27%. " +
      "The largest customer represented 38% of revenue. Days sales outstanding increased from 44 to 71 days.",
  },
  {
    name: "MSA — Apex Retail",
    content:
      "Upon a change of control of the Supplier, Apex Retail may terminate this Agreement on thirty (30) days written notice.",
  },
];

/** Every catalogued model, wired to a fake provider. */
const allModels: AvailableModel[] = CATALOG.map((spec) => ({ spec, providerId: `p-${spec.provider}` }));

/** Retries are real in the limiter; tests must not actually wait. */
const NO_SLEEP = { sleep: async () => {} };

/** A fake completion fn that answers in the house format so the parser has real input. */
function fakeComplete(overrides: Record<string, string> = {}): CompleteFn {
  return vi.fn(async ({ messages, model }) => {
    const system = messages[0].content;
    for (const [needle, text] of Object.entries(overrides)) {
      if (system.includes(needle)) {
        return { text, inputTokens: 100, outputTokens: 50 };
      }
    }
    if (system.includes("deal captain writing to the investment committee")) {
      return {
        text: "RECOMMENDATION: PROCEED WITH CONDITIONS\n\nCustomer concentration and the Apex change-of-control right are the two issues that decide this deal.",
        inputTokens: 800,
        outputTokens: 300,
      };
    }
    if (system.includes("chair the risk committee")) {
      return { text: "RISK REGISTER\n1. Customer concentration (HIGH)\n2. Change of control (HIGH)", inputTokens: 600, outputTokens: 200 };
    }
    // Analysts and rebuttals emit findings; one is deliberately fabricated.
    if (system.includes("lead on this transaction") || system.includes("has been cross-examined")) {
      return {
        text: `<<<FINDING
SEVERITY: HIGH
TITLE: Customer concentration at 38% of revenue
DETAIL: A single customer represents 38% of revenue, creating material revenue-at-risk.
CITE: FY24 Management Accounts :: "The largest customer represented 38% of revenue"
FINDING>>>

<<<FINDING
SEVERITY: CRITICAL
TITLE: Undisclosed related-party loan to the founder
DETAIL: The accounts show a related-party loan that was not disclosed.
CITE: FY24 Management Accounts :: "a related party loan of $3.4M was extended to the founder"
FINDING>>>

ASSESSMENT: Revenue quality is the central question.
REQUESTS: Aged receivables listing.`,
        inputTokens: 1200,
        outputTokens: 400,
      };
    }
    return { text: `output from ${model}`, inputTokens: 200, outputTokens: 100 };
  });
}

describe("parseFindings", () => {
  it("extracts severity, title, detail and citations from house-format blocks", () => {
    const f = parseFindings(
      `<<<FINDING
SEVERITY: CRITICAL
TITLE: Covenant headroom under 15%
DETAIL: Net debt/EBITDA is 2.8x against a 3.0x covenant.
CITE: Debt Schedule :: "covenant net debt to EBITDA below 3.0x, currently 2.8x"
FINDING>>>`,
      "Financial",
    );
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe("CRITICAL");
    expect(f[0].title).toBe("Covenant headroom under 15%");
    expect(f[0].citations[0].document).toBe("Debt Schedule");
    expect(f[0].citations[0].quote).toContain("2.8x");
  });

  it("ignores prose that is not a finding block", () => {
    expect(parseFindings("The business looks fine overall.", "Financial")).toHaveLength(0);
  });

  it("handles multiple citations on one finding", () => {
    const f = parseFindings(
      `<<<FINDING
SEVERITY: HIGH
TITLE: Two-source issue
DETAIL: d
CITE: Doc A :: "quote one here"
CITE: Doc B :: "quote two here"
FINDING>>>`,
      "Legal",
    );
    expect(f[0].citations).toHaveLength(2);
  });
});

describe("selectModel", () => {
  it("picks a long-context model for indexing", () => {
    const m = selectModel(CATALOG, { longContext: 5, speed: 3 }, { budgetBias: 0.5 });
    expect(m!.caps.longContext).toBe(5);
  });

  it("avoids the analyst's own provider when choosing a challenger", () => {
    const m = selectModel(
      CATALOG,
      { adversarial: 5, reasoning: 5 },
      { avoidProviders: ["anthropic"] },
    );
    expect(m!.provider).not.toBe("anthropic");
  });

  it("shifts to cheaper models as budget bias rises", () => {
    const lux = selectModel(CATALOG, { reasoning: 5 }, { budgetBias: 0 })!;
    const thrift = selectModel(CATALOG, { reasoning: 5 }, { budgetBias: 1 })!;
    expect(thrift.inputCost).toBeLessThanOrEqual(lux.inputCost);
  });

  it("returns null when nothing is available", () => {
    expect(selectModel([], { reasoning: 5 })).toBeNull();
  });
});

describe("costOf", () => {
  it("prices a call from the catalogue", () => {
    // Opus 4.8: $5/1M in, $25/1M out.
    expect(costOf("claude-opus-4-8", 1_000_000, 1_000_000)).toBeCloseTo(30, 5);
  });
});

describe("runPipeline", () => {
  it("runs every level in order and returns a memo", async () => {
    const events: NodeEvent[] = [];
    const res = await runPipeline(deal, docs, allModels, DEFAULT_CONFIG, fakeComplete(), (e) =>
      events.push(e),
    );

    const done = events.filter((e) => e.state === "done");
    const levels = [...new Set(done.map((e) => e.level))].sort();
    expect(levels).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // The memo is the apex output.
    expect(res.memo).toContain("PROCEED WITH CONDITIONS");
    expect(done.at(-1)!.level).toBe(7);
  });

  it("challenges each analyst with a different provider than wrote the analysis", async () => {
    const events: NodeEvent[] = [];
    await runPipeline(
      deal,
      docs,
      allModels,
      { ...DEFAULT_CONFIG, workstreams: ["financial"], redTeam: false },
      fakeComplete(),
      (e) => events.push(e),
    );
    const analyst = events.find((e) => e.key === "l2:financial" && e.state === "running")!;
    const challenge = events.find((e) => e.key === "l3:financial:c1" && e.state === "running")!;
    const providerOf = (label: string) => CATALOG.find((m) => m.label === label)!.provider;
    expect(providerOf(challenge.model!)).not.toBe(providerOf(analyst.model!));
  });

  // The headline guarantee: a fabricated citation never passes as fact.
  it("marks fabricated findings unsupported and reports evidence integrity", async () => {
    const res = await runPipeline(
      deal,
      docs,
      allModels,
      { ...DEFAULT_CONFIG, workstreams: ["financial"], redTeam: false, debateRounds: 0 },
      fakeComplete(),
      () => {},
    );
    const fabricated = res.findings.find((f) => f.title.includes("related-party loan"))!;
    const real = res.findings.find((f) => f.title.includes("Customer concentration"))!;
    expect(fabricated.verification).toBe("unsupported");
    expect(real.verification).toBe("verified");
    expect(res.integrity.integrityScore).toBeLessThan(1);
  });

  it("tracks token spend and cost across the run", async () => {
    const res = await runPipeline(
      deal,
      docs,
      allModels,
      { ...DEFAULT_CONFIG, workstreams: ["financial"], redTeam: false, debateRounds: 0 },
      fakeComplete(),
      () => {},
    );
    expect(res.totals.inputTokens).toBeGreaterThan(0);
    expect(res.totals.costUsd).toBeGreaterThan(0);
  });

  it("survives a failing node without aborting the run", async () => {
    const complete: CompleteFn = vi.fn(async ({ messages }) => {
      // Match the Legal analyst seat specifically — the word "Legal" also
      // appears in the shared house rules injected into every prompt.
      if (messages[0].content.includes("You are the Legal & Corporate lead")) {
        throw new Error("429 rate limited");
      }
      if (messages[0].content.includes("deal captain")) {
        return { text: "RECOMMENDATION: PROCEED", inputTokens: 10, outputTokens: 10 };
      }
      return { text: "ok", inputTokens: 10, outputTokens: 10 };
    });
    const events: NodeEvent[] = [];
    const res = await runPipeline(
      deal,
      docs,
      allModels,
      { ...DEFAULT_CONFIG, workstreams: ["financial", "legal"], redTeam: false, debateRounds: 0 },
      complete,
      (e) => events.push(e),
      () => false,
      NO_SLEEP,
    );
    expect(events.some((e) => e.state === "error")).toBe(true);
    expect(res.memo).toContain("PROCEED");
  });

  it("stops when cancelled", async () => {
    let calls = 0;
    const complete: CompleteFn = vi.fn(async () => {
      calls += 1;
      return { text: "ok", inputTokens: 1, outputTokens: 1 };
    });
    await expect(
      runPipeline(deal, docs, allModels, DEFAULT_CONFIG, complete, () => {}, () => calls >= 1),
    ).rejects.toThrow(/cancelled/);
  });

  it("refuses to run with no configured providers", async () => {
    await expect(
      runPipeline(deal, docs, [], DEFAULT_CONFIG, fakeComplete(), () => {}),
    ).rejects.toThrow(/No cloud providers/);
  });
});

describe("resumable runs", () => {
  const scope = { ...DEFAULT_CONFIG, workstreams: ["financial"], redTeam: false, debateRounds: 0 };

  it("replays completed nodes instead of re-issuing them to the provider", async () => {
    // First attempt: dies at the memo.
    const failing: CompleteFn = vi.fn(async ({ messages }) => {
      // Match the memo seat only — "deal captain" also appears in house rules.
      if (messages[0].content.includes("You own this recommendation")) {
        throw new Error("boom");
      }
      return { text: "step output", inputTokens: 100, outputTokens: 50 };
    });
    const first: NodeEvent[] = [];
    const r1 = await runPipeline(deal, docs, allModels, scope, failing, (e) => first.push(e), () => false, NO_SLEEP);
    const cp = checkpointOf(r1.transcript);
    expect(Object.keys(cp).length).toBeGreaterThan(2);

    // Second attempt: resume from the checkpoint.
    const second: CompleteFn = vi.fn(async () => ({
      text: "RECOMMENDATION: PROCEED",
      inputTokens: 100,
      outputTokens: 50,
    }));
    const events: NodeEvent[] = [];
    const r2 = await runPipeline(
      deal, docs, allModels, scope, second, (e) => events.push(e), () => false, NO_SLEEP, cp,
    );

    // Only the node that previously failed is re-issued.
    expect(second).toHaveBeenCalledTimes(1);
    expect(events.some((e) => e.state === "restored")).toBe(true);
    expect(r2.memo).toContain("PROCEED");
    // And the resumed run costs a fraction of the original.
    expect(r2.totals.costUsd).toBeLessThan(r1.totals.costUsd);
  });

  it("checkpointOf keeps completed nodes and drops failed ones", () => {
    const cp = checkpointOf([
      { key: "a", level: 1, levelName: "L", label: "a", state: "done", output: "A" },
      { key: "b", level: 2, levelName: "L", label: "b", state: "error", error: "x" },
      { key: "c", level: 3, levelName: "L", label: "c", state: "running" },
    ]);
    expect(cp).toEqual({ a: "A" });
  });
});

describe("sortFindings", () => {
  it("orders by severity, then puts verified ahead of unverified", () => {
    const mk = (severity: string, verification: string, title: string) =>
      ({ id: title, workstream: "w", severity, title, detail: "", citations: [], verification, verificationNotes: [] }) as never;
    const sorted = sortFindings([
      mk("MEDIUM", "verified", "m"),
      mk("CRITICAL", "unsupported", "c-unsupported"),
      mk("CRITICAL", "verified", "c-verified"),
    ]);
    expect(sorted.map((f) => f.title)).toEqual(["c-verified", "c-unsupported", "m"]);
  });
});
