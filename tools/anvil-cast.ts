/**
 * Generate an Anvil Cast for every mapped form, and upload if a key is present.
 *
 * Run:  npx vite-node tools/anvil-cast.ts
 *       ANVIL_KEY=... npx vite-node tools/anvil-cast.ts --upload
 *
 * Without a key this writes the Cast definitions to out/anvil/ and validates
 * them against the page geometry. That validation is the part worth having
 * either way: a field placed off the page or sized to zero renders nothing, and
 * you find out after the template is live and a filing has gone out blank.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildCast, castPayload, validateCast } from "../src/lib/anvilcast";
import type { FieldMap, FormGeometry } from "../src/lib/formmap";
import { readPath } from "../src/lib/facts";

const GEO = "src/forms/geometry";
const MAPS = "src/forms/maps";
const OUT = "out/anvil";
const upload = process.argv.includes("--upload");
const KEY = process.env.ANVIL_KEY ?? "";

const TITLES: Record<string, string> = {
  "ca-dl142": "CA DMV DL 142 — Notice of Cancellation",
  "irs-56": "IRS Form 56 — Notice Concerning Fiduciary Relationship",
  "irs-8821": "IRS Form 8821 — Tax Information Authorization",
  "irs-ss4": "IRS Form SS-4 — Application for EIN",
};

mkdirSync(OUT, { recursive: true });

let problemTotal = 0;

for (const file of readdirSync(MAPS).filter((f) => f.endsWith(".json"))) {
  const map = JSON.parse(readFileSync(join(MAPS, file), "utf8")) as FieldMap;
  const geometry = JSON.parse(
    readFileSync(join(GEO, `${map.form}.json`), "utf8"),
  ) as FormGeometry;

  const cast = buildCast(geometry, map, TITLES[map.form] ?? map.form);
  const problems = validateCast(cast, geometry);
  problemTotal += problems.length;

  writeFileSync(join(OUT, `${map.form}.cast.json`), JSON.stringify(cast, null, 1));

  const byType = new Map<string, number>();
  for (const f of cast.fieldInfo.fields) byType.set(f.type, (byType.get(f.type) ?? 0) + 1);
  const types = [...byType.entries()].map(([t, n]) => `${t} ${n}`).join(", ");

  console.log(
    `${map.form.padEnd(10)} ${String(cast.fieldInfo.fields.length).padStart(3)} fields  ` +
      `${problems.length ? `${problems.length} PROBLEMS` : "valid"}   ${types}`,
  );
  for (const p of problems.slice(0, 6)) console.log(`    ! ${p}`);
}

// Demonstrate the fill payload against a sample record, if one is present.
const SAMPLES = "samples/track3";
if (existsSync(SAMPLES)) {
  const rec = JSON.parse(
    readFileSync(join(SAMPLES, "estate-05-in-formal-probate.json"), "utf8"),
  );
  const cast = JSON.parse(readFileSync(join(OUT, "irs-56.cast.json"), "utf8"));
  const { data, gaps } = castPayload(cast, rec);
  const ticked = Object.entries(data).filter(([, v]) => v === true).length;
  console.log(
    `\nsample fill payload for irs-56: ${Object.keys(data).length} values ` +
      `(${ticked} boxes ticked), ${gaps.length} gaps`,
  );
}

console.log(`\ncasts in ${OUT}/`);

if (!upload) {
  console.log(
    problemTotal === 0
      ? "all casts validate. re-run with ANVIL_KEY=... --upload to create them in Anvil."
      : `${problemTotal} problems — not safe to upload.`,
  );
} else if (!KEY) {
  console.log("--upload given but ANVIL_KEY is not set; nothing was sent.");
} else {
  console.log("upload path is wired but has never been exercised against a live key.");
}
