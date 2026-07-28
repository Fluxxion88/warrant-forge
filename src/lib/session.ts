// One estate, end to end.
//
// The UI is deliberately thin: everything below is pure computation over the
// fixture, so a pane never has to know how a decision was reached — it just
// renders what the engine already recorded. It also means the whole demo runs
// without a network call, which is the difference between a demo that works in
// the room and one that depends on someone's wifi.

import { admit, admitAll, integrity, ledger, quarantined, values, type Fact, type LedgerIntegrity } from "./facts";
import { decide, type Decision } from "./rules";
import { reconcile, type ChangeReport } from "./reactor";
import { gates, type Gate } from "./risk";
import { findGaps, readiness, type Gap } from "./gaps";
import { blockingLeads, detectLeads, type Lead } from "./leads";
import { detectRecurring } from "./transactions";
import { discoverAssets, type DiscoveryResult } from "./discovery";
import { HOYT_BATCHES } from "../fixtures/hoyt-transactions";
import { computeDeadlines, resolveTasks, type Deadline, type Task } from "./tasks";
import type { SourceDoc } from "./verify";
import { CA_OBTAIN_HINTS, CA_RULES, deriveCaFacts } from "../rules/ca-probate";
import { RECORDED_CANDIDATES } from "../fixtures/recorded";
import {
  AS_OF,
  HOYT_DOCS,
  INITIAL_CANDIDATES,
  SUPPLEMENTAL_APPRAISAL,
  SUPPLEMENTAL_CANDIDATE,
} from "../fixtures/hoyt-estate";

export const ESTATE = {
  decedent: "Margaret Ellen Hoyt",
  executor: "Claire Hoyt",
  county: "San Mateo",
  state: "CA",
  dateOfDeath: "4 January 2026",
  /** The same date a machine can compare. Prose is for the header, not for logic. */
  dateOfDeathIso: "2026-01-04",
} as const;

export const DEFAULT_COUNTY = ESTATE.county;

export interface EstateRun {
  county: string;
  docs: SourceDoc[];
  facts: Fact[];
  decisions: Decision[];
  gates: Gate[];
  gaps: Gap[];
  integrity: LedgerIntegrity;
  readiness: string;
  /** Assets implied by the evidence but not yet found. */
  leads: Lead[];
  /** Assets inferred from payment traces. Hypotheses, never facts. */
  discovery: DiscoveryResult;
  dormantLeads: { patternId: string; awaiting: string[] }[];
  tasks: Task[];
  deadlines: Deadline[];
  /** Whether the estate may safely be distributed, and why not. */
  distribution: DistributionGate;
  /** Present once the supplemental appraisal has been ingested. */
  report?: ChangeReport;
}

export interface DistributionGate {
  safe: boolean;
  reasons: string[];
  openCriticalLeads: number;
}

/**
 * Distribution is the one irreversible act in an estate. Once money reaches
 * beneficiaries it is, practically speaking, unrecoverable — so this gate is
 * deliberately conservative, and an open critical lead is enough to hold it.
 */
function distributionGate(leads: Lead[], deadlines: Deadline[], gaps: Gap[]): DistributionGate {
  const reasons: string[] = [];
  const open = blockingLeads(leads);

  if (open.length > 0) {
    reasons.push(
      `${open.length} critical lead(s) are still open — assets may exist that no document describes.`,
    );
  }
  const claims = deadlines.find((d) => d.id === "deadline.creditor_claims");
  if (claims && claims.status !== "overdue") {
    reasons.push(
      claims.status === "unknown"
        ? "The creditor claim period cannot be computed — Letters issue date is unknown."
        : "The creditor claim period has not closed.",
    );
  }
  const blocking = gaps.filter((g) => g.severity === "blocking");
  if (blocking.length > 0) {
    reasons.push(`${blocking.length} fact(s) required by a pending decision are still missing.`);
  }

  return { safe: reasons.length === 0, reasons, openCriticalLeads: open.length };
}

function assemble(
  county: string,
  docs: SourceDoc[],
  facts: Fact[],
  report?: ChangeReport,
): EstateRun {
  const decisions = report
    ? report.decisions
    : decide(CA_RULES, values(facts), { state: ESTATE.state, county });
  const gaps = findGaps(decisions, CA_OBTAIN_HINTS);
  const factValues = values(facts);

  const { leads, dormant } = detectLeads(factValues);

  // Assets inferred from payment traces. Kept separate from `leads`, which are
  // reasoned from facts already in the ledger — a discovery is reasoned from
  // bank rows, produces no fact, and cannot enter the ledger without a document
  // arriving to support it. Collapsing the two would blur exactly the line the
  // discovery module exists to hold.
  const charges = detectRecurring(HOYT_BATCHES, { dateOfDeath: ESTATE.dateOfDeathIso });
  const discovery = discoverAssets(charges, facts, HOYT_BATCHES, {
    dateOfDeath: ESTATE.dateOfDeathIso,
  });
  // Any foreign lead means international reporting must be reviewed before
  // anything is filed, so it is threaded back in as a fact the task graph reads.
  const withForeign = {
    ...factValues,
    "estate.has_foreign_indicators": leads.some((l) => l.foreign),
  };
  const tasks = resolveTasks(withForeign);
  const deadlines = computeDeadlines(withForeign, AS_OF);

  return {
    county,
    docs,
    facts,
    decisions,
    gates: gates(decisions, facts),
    gaps,
    integrity: integrity(facts),
    readiness: readiness(decisions, gaps),
    leads,
    dormantLeads: dormant,
    discovery,
    tasks,
    deadlines,
    distribution: distributionGate(leads, deadlines, gaps),
    report,
  };
}

/** The estate as it stands on the original appraisal. */
export function initialRun(county: string = DEFAULT_COUNTY): EstateRun {
  const base = admitAll(INITIAL_CANDIDATES, HOYT_DOCS, { now: 1 });
  const facts = [...base, ...deriveCaFacts(base, AS_OF, 1)];
  return assemble(county, HOYT_DOCS, facts);
}

/**
 * The estate as a real model actually extracted it.
 *
 * Replays `src/fixtures/recorded-extraction.json` — 41 candidates a live run
 * proposed over the nine source documents — through the same admission and
 * verification path as anything else.
 *
 * Deliberately NOT the default run. The recorded run has nothing quarantined,
 * because the model quoted accurately every time; the hand-written fixture
 * contains a fabricated Prudential policy that verification rejects, and that
 * rejection is the single most important thing this product has to show. Both
 * states are honest and they demonstrate different halves of the argument, so
 * the app starts on the fixture and this is one button away.
 */
export function recordedRun(county: string = DEFAULT_COUNTY): EstateRun {
  const base = admitAll(RECORDED_CANDIDATES, HOYT_DOCS, { now: 1 });
  return fromExtractedFacts(base, HOYT_DOCS, county);
}

/**
 * Build a run from facts produced elsewhere — a live extraction, or a recorded
 * one replayed. The derivation and decision layers are identical either way,
 * which is the point: nothing downstream can tell, or needs to.
 */
export function fromExtractedFacts(
  base: Fact[],
  docs: SourceDoc[],
  county: string = DEFAULT_COUNTY,
): EstateRun {
  const facts = [...base, ...deriveCaFacts(base, AS_OF, 2)];
  return assemble(county, docs, facts);
}

/**
 * Re-decide the same estate in a different county. Everything is a pure
 * function of the facts, so moving jurisdiction costs nothing and no fact has
 * to be re-extracted — which is the whole argument for rules as data.
 */
export function withCounty(previous: EstateRun, county: string): EstateRun {
  // Re-decide the facts we already hold. This used to rebuild from the fixture
  // whenever a change report was present, which threw away an adopted live
  // extraction the moment somebody clicked a different county.
  //
  // The report is carried across unchanged. It describes what happened when the
  // supplemental appraisal arrived, and that history did not stop being true
  // because the venue moved — though its per-decision deltas were computed in
  // the old county, which is why re-deciding here matters and re-reconciling
  // does not.
  return assemble(county, previous.docs, previous.facts, previous.report);
}

/**
 * Ingest the supplemental appraisal and re-decide incrementally. The returned
 * run carries the change report, which is the artefact worth showing a family.
 */
export function ingestSupplemental(previous: EstateRun): EstateRun {
  const docs = [...previous.docs, SUPPLEMENTAL_APPRAISAL];

  // Build on the facts the run already holds rather than re-admitting the
  // fixture. Rebuilding from INITIAL_CANDIDATES discarded whatever was there —
  // and after adopting a live extraction that meant seven keys the extraction
  // had and the fixture does not (institutions, account identifiers, the policy
  // beneficiary flag) disappeared, and then surfaced in the change report as
  // `removed`. A new document arriving must not look like it deleted data.
  //
  // Derived facts are dropped and recomputed: they are a pure function of the
  // asserted ones, so carrying them over would leave stale totals competing
  // with fresh ones for the same key.
  const asserted = previous.facts.filter((f) => f.warrant.kind !== "derivation");
  const base = [...asserted, admit(SUPPLEMENTAL_CANDIDATE, docs, { now: 2 })];
  const facts = [...base, ...deriveCaFacts(base, AS_OF, 2)];

  const report = reconcile(
    { facts: previous.facts, decisions: previous.decisions },
    facts,
    CA_RULES,
    { state: ESTATE.state, county: previous.county },
  );
  return assemble(previous.county, docs, facts, report);
}

/** Verified facts, newest first, for the ledger view. */
export function verifiedFacts(run: EstateRun): Fact[] {
  return [...ledger(run.facts).values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function rejectedFacts(run: EstateRun): Fact[] {
  return quarantined(run.facts);
}

export function docByName(run: EstateRun, name: string): SourceDoc | undefined {
  return run.docs.find((d) => d.name === name);
}

const LABELS: Record<string, string> = {
  residence_route: "The residence",
  personal_property_route: "Personal property",
  vehicle_transfer: "The vehicle",
  filing_fee: "Court filing fee",
  county_requirements: "Local county requirements",
};

export function decisionLabel(point: string): string {
  return LABELS[point] ?? point.replace(/_/g, " ");
}

export function money(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

export function moneyRange([lo, hi]: [number, number]): string {
  return lo === hi ? money(lo) : `${money(lo)} – ${money(hi)}`;
}

export function dayRange([lo, hi]: [number, number]): string {
  if (lo === 0 && hi === 0) return "—";
  const fmt = (d: number) => {
    if (d >= 60) {
      const m = Math.round(d / 30);
      return `${m} month${m === 1 ? "" : "s"}`;
    }
    return `${d} day${d === 1 ? "" : "s"}`;
  };
  // The low end is often 1 — a vehicle transfer, an affidavit presented at a
  // counter — and "1 days – 30 days" on the flagship pane reads as carelessness
  // in a product whose entire pitch is that the details were checked.
  return `${fmt(lo)} – ${fmt(hi)}`;
}
