/**
 * How stale is our own rule pack?
 *
 *   npx vite-node tools/freshness-report.ts [asOfDate]
 *
 * Every rule carries an authority with a `retrievedAt`. Until now nothing read
 * it. This turns the whole pack into a re-check queue: what we know, when we
 * last looked, and what is overdue — including the statutory adjustment that is
 * already on the calendar.
 */
import {
  assess,
  escalates,
  freshnessLine,
  reviewQueue,
  KNOWN_CADENCES,
  type SourceHistory,
  type SourceKind,
} from "../src/lib/freshness";
import { CA_RULES } from "../src/rules/ca-probate";
import { CA_COUNTIES } from "../src/rules/ca-counties";
import { FORM_RULES } from "../src/rules/form-applicability";

const asOf = process.argv[2] ?? new Date().toISOString().slice(0, 10);

/** Classify a citation by what kind of thing it is, which sets the horizon. */
function kindOf(citation: string, url: string): SourceKind {
  if (/fee|schedule/i.test(citation) || /fee/i.test(url)) return "fee_schedule";
  if (/local rule|superior court/i.test(citation)) return "court_local_rule";
  if (/form|DE-\d|REG |DL /i.test(citation)) return "agency_form";
  if (/instructions|publication|guidance/i.test(citation)) return "agency_guidance";
  return "statute";
}

/** Does a published cadence govern this citation? */
function cadenceFor(citation: string) {
  if (/13100|13151|13200|890/.test(citation)) {
    return KNOWN_CADENCES["ca.small_estate_thresholds"];
  }
  return undefined;
}

const seen = new Map<string, SourceHistory>();

function add(citation: string, url: string, retrievedAt: string) {
  const key = `${citation}|${url}`;
  if (seen.has(key)) return;
  seen.set(key, {
    url,
    label: citation.length > 62 ? citation.slice(0, 59) + "..." : citation,
    kind: kindOf(citation, url),
    // One observation: the day we read it. That is genuinely all the history
    // this build has, and the report says so rather than implying a watch
    // history nobody has kept.
    observations: [{ checkedAt: retrievedAt, contentHash: "initial" }],
    knownCadence: cadenceFor(citation),
  });
}

for (const r of [...CA_RULES, ...FORM_RULES]) {
  add(r.authority.citation, r.authority.sourceUrl, r.authority.retrievedAt);
}
for (const c of CA_COUNTIES) {
  add(c.feeAuthority.citation, c.feeAuthority.sourceUrl, c.feeAuthority.retrievedAt);
}

const queue = reviewQueue([...seen.values()], asOf);
const counts = new Map<string, number>();
for (const item of queue) counts.set(item.verdict.status, (counts.get(item.verdict.status) ?? 0) + 1);

console.log(`\nAs of ${asOf} — ${queue.length} distinct authorities behind the rule pack\n`);
for (const item of queue) console.log("  " + freshnessLine(item));

console.log(
  `\n${[...counts].map(([s, n]) => `${n} ${s}`).join(", ")}   ` +
    `${queue.filter((i) => escalates(i.verdict)).length} would escalate to a human`,
);

const scheduled = queue.filter((i) => i.verdict.basis === "scheduled");
if (scheduled.length) {
  console.log(`\nOn a published schedule (a learned horizon would miss these):`);
  for (const s of scheduled) console.log(`  ${s.history.label}\n    ${s.verdict.because}`);
}

const noHistory = queue.filter((i) => i.verdict.basis === "default").length;
console.log(
  `\n${noHistory} of ${queue.length} rest on a single reading with no watch history. ` +
    `That is the honest state: the horizons are type defaults, not measurements, ` +
    `and only re-fetching over time turns them into observations.`,
);
