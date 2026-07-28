/** What the discovery pass actually finds. `npx vite-node bench/discovery-demo.ts` */
import { admitAll } from "../src/lib/facts";
import { detectRecurring, summariseBleed } from "../src/lib/transactions";
import { discoverAssets, describe } from "../src/lib/discovery";
import { HOYT_BATCHES } from "../src/fixtures/hoyt-transactions";
import { HOYT_DOCS } from "../src/fixtures/hoyt-estate";
import { RECORDED_CANDIDATES } from "../src/fixtures/recorded";

const DOD = "2026-01-04";
const facts = admitAll(RECORDED_CANDIDATES, HOYT_DOCS, { now: 1 });
const charges = detectRecurring(HOYT_BATCHES, { dateOfDeath: DOD });
const { hypotheses, suppressed, notAssetBearing } = discoverAssets(
  charges,
  facts,
  HOYT_BATCHES,
  { dateOfDeath: DOD },
);

console.log(`\n${charges.length} recurring charges detected from ${HOYT_BATCHES[0].transactions.length} transactions\n`);

console.log(`=== ASSETS NOBODY MENTIONED (${hypotheses.length})\n`);
for (const h of hypotheses) {
  console.log(`  ${h.merchant}`);
  console.log(`    ${describe(h)}`);
  console.log(`    implies: ${h.implies}   confidence: ${h.confidence}   $${h.annualisedUsd}/yr`);
  console.log(`    next: ${h.nextStep.channel} to ${h.nextStep.recipient}`);
  console.log(`    evidence: ${h.evidence.length} debits, first ${h.evidence[0]?.date}, last ${h.evidence.at(-1)?.date}`);
  console.log();
}

console.log(`=== ALREADY KNOWN, DELIBERATELY NOT RE-REPORTED (${suppressed.length})\n`);
for (const s of suppressed) {
  console.log(`  ${s.merchant} — accounted for by ${s.accountedForBy.key} = "${s.accountedForBy.value}"`);
}

const bleed = summariseBleed(charges);
console.log(`\n=== MONEY STILL LEAVING THE ESTATE`);
console.log(`  ${JSON.stringify(bleed, null, 1)}`);
console.log(`\nnot asset-bearing (shut-down queue): ${notAssetBearing.length}`);
