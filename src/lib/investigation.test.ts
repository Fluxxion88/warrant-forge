import { describe, expect, it, beforeEach } from "vitest";
import { _resetIds, admitAll, values } from "./facts";
import { authorityNeeded, blockingLeads, detectLeads } from "./leads";
import { computeDeadlines, resolveTasks, tasksByPhase } from "./tasks";
import { deriveCaFacts } from "../rules/ca-probate";
import { AS_OF, HOYT_DOCS, INITIAL_CANDIDATES } from "../fixtures/hoyt-estate";
import { initialRun } from "./session";

function factValues() {
  const base = admitAll(INITIAL_CANDIDATES, HOYT_DOCS, { now: 1 });
  return values([...base, ...deriveCaFacts(base, AS_OF, 1)]);
}

beforeEach(() => _resetIds());

describe("lead detection", () => {
  it("raises a lead from a Schedule B foreign-account answer", () => {
    const { leads } = detectLeads(factValues());
    const lead = leads.find((l) => l.patternId === "lead.schedule_b_foreign");
    expect(lead).toBeDefined();
    expect(lead!.priority).toBe("critical");
    expect(lead!.foreign).toBe(true);
    expect(lead!.evidence).toContain("tax.schedule_b.foreign_account");
  });

  it("raises a lead from an international wire, naming what the request may reveal", () => {
    const { leads } = detectLeads(factValues());
    const lead = leads.find((l) => l.patternId === "lead.international_wire")!;
    expect(lead.implies).toMatch(/account at the counterparty/i);
    expect(lead.actions.flatMap((a) => a.mayReveal).join(" ")).toMatch(/SWIFT/);
  });

  it("infers a foreign corporation from a Form 5471 without seeing the company", () => {
    const { leads } = detectLeads(factValues());
    const lead = leads.find((l) => l.patternId === "lead.form_5471")!;
    expect(lead.implies).toMatch(/foreign corporation/i);
    // Nothing in the data room names the company — that is the point.
    expect(Object.keys(factValues()).some((k) => k.startsWith("asset.foreign_corp"))).toBe(false);
  });

  it("orders critical leads first", () => {
    const { leads } = detectLeads(factValues());
    const priorities = leads.map((l) => l.priority);
    expect(priorities.indexOf("critical")).toBeLessThan(
      priorities.lastIndexOf("routine") === -1 ? Infinity : priorities.lastIndexOf("routine"),
    );
  });

  it("keeps unraised patterns as dormant rather than discarding them", () => {
    const { dormant } = detectLeads(factValues());
    // No crypto evidence in this estate, so the pattern is dormant, not gone.
    expect(dormant.map((d) => d.patternId)).toContain("lead.crypto");
  });

  it("collects the authority documents the open requests will need", () => {
    const { leads } = detectLeads(factValues());
    const docs = authorityNeeded(leads);
    expect(docs).toContain("letters_testamentary");
    expect(docs).toContain("apostille");
  });

  it("treats critical unresolved leads as blocking", () => {
    const { leads } = detectLeads(factValues());
    expect(blockingLeads(leads).length).toBeGreaterThan(0);
  });
});

describe("deadlines", () => {
  it("reports unknown rather than guessing when the anchor date is missing", () => {
    const deadlines = computeDeadlines(factValues(), AS_OF);
    const inventory = deadlines.find((d) => d.id === "deadline.inventory")!;
    // Letters have not issued in this fixture.
    expect(inventory.status).toBe("unknown");
    expect(inventory.missingAnchors).toContain("estate.letters_issued_date");
  });

  it("computes the lodge-the-will deadline from the date of death", () => {
    const deadlines = computeDeadlines(factValues(), AS_OF);
    const lodge = deadlines.find((d) => d.id === "deadline.lodge_will")!;
    expect(lodge.dueIso).toBe("2026-02-03");
    expect(lodge.status).toBe("overdue");
  });

  it("takes the later of two anchors for the creditor claim period", () => {
    const deadlines = computeDeadlines(
      {
        ...factValues(),
        "estate.letters_issued_date": "2026-03-01",
        "estate.creditor_notice_date": "2026-06-01",
      },
      AS_OF,
    );
    const claims = deadlines.find((d) => d.id === "deadline.creditor_claims")!;
    // 4 months from Letters is 2026-06-29; 60 days from notice is 2026-07-31.
    expect(claims.dueIso).toBe("2026-07-31");
    expect(claims.governedBy).toBe("estate.creditor_notice_date");
  });

  it("carries the consequence of missing each deadline", () => {
    const claims = computeDeadlines(factValues(), AS_OF).find(
      (d) => d.id === "deadline.creditor_claims",
    )!;
    expect(claims.consequence).toMatch(/personally/i);
  });
});

describe("task graph", () => {
  it("blocks bank enquiries until Letters are obtained", () => {
    const tasks = resolveTasks(factValues());
    const banks = tasks.find((t) => t.id === "task.bank_searches")!;
    expect(banks.status).toBe("blocked");
    expect(banks.blockedBy).toContain("task.petition");
  });

  it("unblocks downstream work as tasks complete", () => {
    const tasks = resolveTasks(factValues(), new Set(["task.petition"]));
    expect(tasks.find((t) => t.id === "task.bank_searches")!.status).toBe("ready");
    // The EIN is now reachable, but the estate account still waits on it.
    expect(tasks.find((t) => t.id === "task.ein")!.status).toBe("ready");
    expect(tasks.find((t) => t.id === "task.estate_account")!.status).toBe("blocked");
  });

  it("requires international review only where foreign indicators exist", () => {
    const withForeign = resolveTasks({ ...factValues(), "estate.has_foreign_indicators": true });
    expect(withForeign.find((t) => t.id === "task.international_review")!.status).not.toBe(
      "not_applicable",
    );

    const without = resolveTasks({ "estate.has_foreign_indicators": false });
    expect(without.find((t) => t.id === "task.international_review")!.status).toBe(
      "not_applicable",
    );
  });

  it("warns against filing foreign forms before counsel reviews them", () => {
    const review = resolveTasks(factValues()).find((t) => t.id === "task.international_review")!;
    expect(review.caution).toMatch(/wilful|willful/i);
  });

  it("groups tasks into the six administration phases", () => {
    const phases = tasksByPhase(resolveTasks(factValues()));
    expect(phases.map((p) => p.phase)).toEqual([
      "authority",
      "secure",
      "investigate",
      "report",
      "creditors",
      "close",
    ]);
    expect(phases.every((p) => p.tasks.length > 0)).toBe(true);
  });

  it("makes final distribution depend on inventory, reserves and both returns", () => {
    const final = resolveTasks(factValues()).find((t) => t.id === "task.final_distribution")!;
    expect(final.dependsOn).toEqual(
      expect.arrayContaining(["task.inventory", "task.reserves", "task.final_1040", "task.estate_1041"]),
    );
  });
});

describe("distribution gate", () => {
  it("refuses to call distribution safe while offshore leads are open", () => {
    const run = initialRun();
    expect(run.distribution.safe).toBe(false);
    expect(run.distribution.openCriticalLeads).toBeGreaterThan(0);
    expect(run.distribution.reasons.join(" ")).toMatch(/no document describes/i);
  });

  it("flags the unclosed creditor period as its own reason", () => {
    const run = initialRun();
    expect(run.distribution.reasons.join(" ")).toMatch(/creditor claim period/i);
  });

  it("surfaces the offshore exposure on the run", () => {
    const run = initialRun();
    expect(run.leads.some((l) => l.foreign)).toBe(true);
    expect(run.tasks.find((t) => t.id === "task.international_review")!.status).not.toBe(
      "not_applicable",
    );
  });
});
