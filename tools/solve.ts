/**
 * Settle an arbitrary estate, end to end.
 *
 *   npx vite-node tools/solve.ts                       all sample estates
 *   npx vite-node tools/solve.ts path/to/record.json   one estate
 *   npx vite-node tools/solve.ts --md out/plans        write a plan per estate
 *
 * Takes any record in Alix's estate-form-data shape and returns the work plan:
 * what to do, in what order, which forms to file, which to withhold and why,
 * what was inferred rather than read, and everything left unresolved.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { resolve, resolutionReport, type Scenario } from "../src/lib/scenario";
import type { EstateRecord } from "../src/lib/estate";
import { HOYT_BATCHES } from "../src/fixtures/hoyt-transactions";

const argv = process.argv.slice(2);
const mdAt = argv.indexOf("--md");
// `--md` takes a directory, so its value must not also be read as a record path.
const mdDir = mdAt >= 0 ? (argv[mdAt + 1] ?? "out/plans") : null;
const consumed = new Set(mdAt >= 0 ? [mdAt, mdAt + 1] : []);
const args = argv.filter((a, i) => !consumed.has(i) && !a.startsWith("--"));

const SAMPLES = "samples/track3";

function load(path: string): EstateRecord {
  return JSON.parse(readFileSync(path, "utf8")) as EstateRecord;
}

let paths: string[];
if (args.length) {
  paths = args;
} else if (existsSync(SAMPLES)) {
  paths = readdirSync(SAMPLES)
    .filter((f) => f.startsWith("estate-") && f.endsWith(".json"))
    .map((f) => join(SAMPLES, f));
} else {
  throw new Error(`no record given and ${SAMPLES} is absent`);
}

if (mdDir) mkdirSync(mdDir, { recursive: true });

const rows: string[] = [];

for (const path of paths) {
  const record = load(path);
  const scenario: Scenario = {
    id: record.meta.recordId,
    label: record.meta.label?.split(".")[0] ?? record.meta.recordId,
    record,
    // Bank data is only held for the Hoyt demo estate. Attaching it to the
    // others would fabricate a discovery, so they run without it and the
    // report says the discovery pass had nothing to read.
    transactions: record.meta.recordId.startsWith("hoyt") ? HOYT_BATCHES : undefined,
    asOf: "2026-07-28",
  };

  const r = resolve(scenario);

  const fill = r.forms.filter((f) => f.status === "fill").length;
  const withheld = r.forms.filter((f) => f.status === "withheld").length;
  const blocked = r.forms.filter((f) => f.status === "blocked").length;
  const unmodelled = r.forms.filter((f) => f.status === "unmodelled").length;
  const boxes = r.forms.reduce((n, f) => n + (f.filling?.filled ?? 0), 0);

  console.log(`\n=== ${r.scenario.recordId}`);
  console.log(
    `    ${r.jurisdiction.state}${r.jurisdiction.county ? `/${r.jurisdiction.county}` : ""}  ` +
      `${r.jurisdiction.hasStatePack ? "state pack applied" : "NO STATE PACK"}`,
  );
  console.log(
    `    facts ${r.integrity.verified}/${r.integrity.proposed}` +
      `  actions ${r.actions.length}` +
      `  forms ${fill} fill / ${withheld} withheld / ${blocked} blocked / ${unmodelled} unmodelled` +
      `  boxes ${boxes}` +
      `  unresolved ${r.unresolved.length}`,
  );
  console.log(`    distribution: ${r.distribution.safe ? "no hold" : "HOLD — " + r.distribution.reasons[0]}`);

  const top = r.actions.slice(0, 4);
  for (const a of top) console.log(`      · ${a.title}`);
  if (r.actions.length > top.length) console.log(`      … and ${r.actions.length - top.length} more`);

  rows.push(
    [
      r.scenario.recordId.padEnd(42),
      String(r.integrity.proposed).padStart(3),
      String(r.actions.length).padStart(3),
      String(fill).padStart(2),
      String(withheld).padStart(2),
      String(blocked).padStart(2),
      String(boxes).padStart(4),
      String(r.unresolved.length).padStart(3),
    ].join("  "),
  );

  if (mdDir) {
    writeFileSync(join(mdDir, `${r.scenario.recordId}.md`), resolutionReport(r));
  }
}

console.log(`\n${"estate".padEnd(42)}  fct  act  fl  wh  bl  boxs  unr`);
for (const row of rows) console.log(row);
if (mdDir) console.log(`\nplans written to ${mdDir}/`);
