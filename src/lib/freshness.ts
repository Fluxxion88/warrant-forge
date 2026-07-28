// How long a researched answer stays true.
//
// Every authority in this system carries a `retrievedAt`, and until now nothing
// read it. That is the missing half of provenance: knowing where a figure came
// from is worth much less if nobody knows whether it is still the figure. The
// § 13100 cap is the standing example — almost every model still says $184,500
// because that is what its training data says, and the number changed on
// 1 April 2025. Somebody's cached answer went wrong on a specific date.
//
// So each source gets a re-check horizon, and the interesting question is where
// that horizon comes from. Three candidates, in strict order of preference:
//
// **A published schedule, when one exists.** This beats everything and it is
// the reason a purely learned TTL is not good enough. California's small-estate
// thresholds are adjusted by the Judicial Council every three years on a fixed
// cycle; the last adjustment was 1 April 2025 and the next is 1 April 2028.
// That date is knowable today. A volatility model watching those pages would
// observe three years of perfect stability and grow *more* confident right up
// to the morning the number changes — the observation and the risk move in
// opposite directions. Where a cadence is published, use it and ignore the
// observations.
//
// **Observed change intervals**, for sources with no published cadence — a
// court's local rules, a fee page, a filing procedure. Here the history is
// genuinely the best evidence available, and a page that has changed twice in
// eighteen months should be re-read sooner than one untouched since 2019.
//
// **A conservative default by source type**, when there is no history either.
// A new source is not a stable source; it is an unmeasured one, and it should
// be re-checked soon precisely because we know nothing about it.
//
// The asymmetry to keep in mind throughout: being early to re-check costs one
// page load. Being late means filing against a rule that stopped being true,
// and finding out from a rejection notice. Every threshold here leans early.

export type SourceKind =
  | "statute"
  | "court_local_rule"
  | "fee_schedule"
  | "agency_form"
  | "agency_guidance";

export interface SourceObservation {
  /** ISO date the source was fetched. */
  checkedAt: string;
  /** Hash of the extracted text, so a change is detected without storing it. */
  contentHash: string;
}

/** A change schedule somebody published, rather than one we inferred. */
export interface KnownCadence {
  everyMonths?: number;
  /** The next date this is known to change, if it is on a fixed calendar. */
  nextChangeOn?: string;
  /** Why we believe it — a citation, not a hunch. */
  because: string;
}

export interface SourceHistory {
  url: string;
  label: string;
  kind: SourceKind;
  /** Oldest first. */
  observations: SourceObservation[];
  knownCadence?: KnownCadence;
}

export type Freshness = "fresh" | "aging" | "stale" | "expired" | "unknown";

export interface FreshnessVerdict {
  status: Freshness;
  ageDays: number;
  /** Days a reading of this source is considered good for. */
  ttlDays: number | null;
  basis: "scheduled" | "observed" | "default" | "none";
  confidence: "high" | "medium" | "low";
  because: string;
  /** Negative when a re-check is overdue. */
  recheckInDays: number | null;
}

/**
 * Default horizons by source type, in days.
 *
 * Deliberately short. A fee schedule is the shortest because it is the cheapest
 * thing to get wrong in a way that stops a filing at the counter, and the
 * cheapest to re-read.
 */
const DEFAULT_TTL: Record<SourceKind, number> = {
  fee_schedule: 90,
  court_local_rule: 180,
  agency_form: 180,
  agency_guidance: 270,
  statute: 365,
};

const DAY = 86_400_000;

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / DAY);
}

/**
 * Median interval between observed changes, and how many changes were seen.
 *
 * Consecutive observations with the same hash are not changes; only a differing
 * hash marks one. Two changes is the minimum that yields a single interval, and
 * a single interval is a very weak basis for a median — reflected in the
 * confidence, not hidden.
 */
export function observedChangeInterval(history: SourceHistory): {
  medianDays: number | null;
  changes: number;
  spanDays: number;
} {
  const obs = history.observations;
  if (obs.length < 2) {
    return { medianDays: null, changes: 0, spanDays: 0 };
  }

  const changePoints: string[] = [];
  for (let i = 1; i < obs.length; i++) {
    if (obs[i].contentHash !== obs[i - 1].contentHash) changePoints.push(obs[i].checkedAt);
  }

  const spanDays = daysBetween(obs[0].checkedAt, obs[obs.length - 1].checkedAt);
  if (changePoints.length < 2) {
    return { medianDays: null, changes: changePoints.length, spanDays };
  }

  const gaps: number[] = [];
  for (let i = 1; i < changePoints.length; i++) {
    gaps.push(daysBetween(changePoints[i - 1], changePoints[i]));
  }
  gaps.sort((a, b) => a - b);
  const m = Math.floor(gaps.length / 2);
  const median = gaps.length % 2 ? gaps[m] : (gaps[m - 1] + gaps[m]) / 2;
  return { medianDays: Math.round(median), changes: changePoints.length, spanDays };
}

export function assess(history: SourceHistory, asOf: string): FreshnessVerdict {
  const last = history.observations.at(-1);
  if (!last) {
    return {
      status: "unknown",
      ageDays: 0,
      ttlDays: null,
      basis: "none",
      confidence: "low",
      because: "Never fetched.",
      recheckInDays: null,
    };
  }

  const ageDays = daysBetween(last.checkedAt, asOf);

  // 1. A published schedule wins outright.
  const cadence = history.knownCadence;
  if (cadence?.nextChangeOn) {
    const untilChange = daysBetween(asOf, cadence.nextChangeOn);
    return {
      ...band(ageDays, Math.max(untilChange, 0)),
      ageDays,
      ttlDays: Math.max(untilChange, 0),
      basis: "scheduled",
      confidence: "high",
      because:
        untilChange > 0
          ? `Changes on ${cadence.nextChangeOn} (${cadence.because}). ${untilChange} days away.`
          : `Scheduled change on ${cadence.nextChangeOn} has passed (${cadence.because}). Re-read before relying on this.`,
      recheckInDays: untilChange,
    };
  }
  if (cadence?.everyMonths) {
    const ttl = Math.round(cadence.everyMonths * 30.4);
    return {
      ...band(ageDays, ttl),
      ageDays,
      ttlDays: ttl,
      basis: "scheduled",
      confidence: "high",
      because: `Published cadence: every ${cadence.everyMonths} months (${cadence.because}).`,
      recheckInDays: ttl - ageDays,
    };
  }

  // 2. Observed volatility, where we have enough of it.
  const { medianDays, changes, spanDays } = observedChangeInterval(history);
  if (medianDays !== null) {
    // Re-check at half the observed change interval, so a change is caught
    // within roughly one cycle rather than up to a full one late.
    const ttl = Math.max(30, Math.round(medianDays / 2));
    return {
      ...band(ageDays, ttl),
      ageDays,
      ttlDays: ttl,
      basis: "observed",
      confidence: changes >= 3 ? "medium" : "low",
      because:
        `Changed ${changes} times in ${spanDays} days of watching; median gap ` +
        `${medianDays} days. Re-check set at half that.` +
        (changes < 3 ? " Two changes is a thin basis — treat as provisional." : ""),
      recheckInDays: ttl - ageDays,
    };
  }

  // 3. No schedule, not enough history: fall back on type, conservatively.
  const ttl = DEFAULT_TTL[history.kind];
  const watched = spanDays > 0 ? ` Watched ${spanDays} days with ${changes} change(s).` : "";
  return {
    ...band(ageDays, ttl),
    ageDays,
    ttlDays: ttl,
    basis: "default",
    confidence: "low",
    because:
      `No published cadence and too little history to infer one. Using the ` +
      `${history.kind.replace(/_/g, " ")} default of ${ttl} days.${watched}` +
      ` Stability we have not measured is not stability.`,
    recheckInDays: ttl - ageDays,
  };
}

/**
 * Status bands. "Aging" exists so a re-check can be queued before anything is
 * actually doubted — the point is to never be surprised, not to be alarmed.
 */
function band(ageDays: number, ttlDays: number): { status: Freshness } {
  if (ttlDays <= 0) return { status: "expired" };
  const ratio = ageDays / ttlDays;
  if (ratio < 0.5) return { status: "fresh" };
  if (ratio < 1) return { status: "aging" };
  if (ratio < 2) return { status: "stale" };
  return { status: "expired" };
}

/**
 * The Judicial Council adjusts the small-estate thresholds on a three-year
 * cycle. This is the case that proves a learned TTL is not sufficient: the
 * pages will sit unchanged for three years and then move on a date that is
 * already published.
 */
export const KNOWN_CADENCES: Record<string, KnownCadence> = {
  "ca.small_estate_thresholds": {
    everyMonths: 36,
    nextChangeOn: "2028-04-01",
    because:
      "Prob. Code § 890 requires the Judicial Council to adjust the § 13100, " +
      "§ 13151 and § 13200 amounts every three years; last adjusted 2025-04-01",
  },
};

export interface ReviewItem {
  history: SourceHistory;
  verdict: FreshnessVerdict;
}

/**
 * What to re-fetch, worst first.
 *
 * Sorted by how far past its horizon a source is rather than by raw age, so a
 * fee page two weeks over a ninety-day horizon outranks a statute six months
 * into a year. Age alone would bury the urgent thing under the merely old.
 */
export function reviewQueue(histories: SourceHistory[], asOf: string): ReviewItem[] {
  return histories
    .map((history) => ({ history, verdict: assess(history, asOf) }))
    .sort((a, b) => {
      const rank = { expired: 0, stale: 1, unknown: 2, aging: 3, fresh: 4 };
      const d = rank[a.verdict.status] - rank[b.verdict.status];
      if (d !== 0) return d;
      return (a.verdict.recheckInDays ?? 0) - (b.verdict.recheckInDays ?? 0);
    });
}

/**
 * Should a decision resting on this source be flagged to a human?
 *
 * Deliberately NOT "should the rule stop firing". Dropping a rule because its
 * source is old replaces a probably-right answer with no answer, which is worse
 * — and it would make the engine degrade silently as the pack aged. The rule
 * still fires; the decision carries the staleness, and the approval gate can
 * escalate on it. Same instinct as three-valued logic: surface the doubt, do
 * not resolve it by guessing in either direction.
 */
export function escalates(v: FreshnessVerdict): boolean {
  return v.status === "stale" || v.status === "expired" || v.status === "unknown";
}

export function freshnessLine(item: ReviewItem): string {
  const v = item.verdict;
  const overdue = v.recheckInDays !== null && v.recheckInDays < 0;
  const when =
    v.recheckInDays === null
      ? "never checked"
      : overdue
        ? `${-v.recheckInDays}d overdue`
        : `due in ${v.recheckInDays}d`;
  return `${v.status.toUpperCase().padEnd(8)} ${item.history.label.padEnd(46)} ${String(v.ageDays).padStart(5)}d old  ${when.padStart(14)}  [${v.basis}]`;
}
