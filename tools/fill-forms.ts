/**
 * Fill every applicable form for every sample estate, and say what was left.
 *
 * Run:  npx vite-node tools/fill-forms.ts
 *
 * Writes one payload + report per (estate, form) under out/fills/. The payload
 * is what the PDF writer consumes; the report is what a human reads before
 * signing. Forms the rules say do not apply are skipped with the reason, which
 * is the part that makes this safe to run unattended.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { importEstate, type EstateRecord } from "../src/lib/estate";
import { fillForm, fillReport, toFillPayload } from "../src/lib/fill";
import { values } from "../src/lib/facts";
import { decide } from "../src/lib/rules";
import { FORM_RULES, form56Overrides } from "../src/rules/form-applicability";
import type { FieldMap } from "../src/lib/formmap";

const SAMPLES = "samples/track3";
const MAPS = "src/forms/maps";
const OUT = "out/fills";

if (!existsSync(SAMPLES)) throw new Error(`no ${SAMPLES} — Track 3 samples are not present`);
mkdirSync(OUT, { recursive: true });

const maps = readdirSync(MAPS)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(MAPS, f), "utf8")) as FieldMap);

/** Which decision point governs each form. */
const GOVERNS: Record<string, string> = {
  "ca-dl142": "form_dl142",
  "irs-ss4": "form_ss4",
  "irs-56": "form_56",
  "irs-8821": "form_8821",
};

/** Rule ids that mean "this form is required". */
const AFFIRMATIVE = new Set([
  "form.dl142.applies",
  "form.ss4.needed",
  "form.56.needed",
  "form.8821.needed",
]);

const records = readdirSync(SAMPLES)
  .filter((f) => f.startsWith("estate-") && f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(SAMPLES, f), "utf8")) as EstateRecord);

let produced = 0;
let skipped = 0;

for (const record of records) {
  const id = record.meta.recordId;
  const { facts } = importEstate(record);
  const v = values(facts);
  const state = record.estateEntity.principalState ?? "CA";
  const decisions = decide(FORM_RULES, v, { state, county: record.estateEntity.principalCounty });

  console.log(`\n=== ${id}   (${state}, ${record.authority.administrationPath})`);

  for (const map of maps) {
    const point = GOVERNS[map.form];
    const d = decisions.find((x) => x.decisionPoint === point);
    const chosen = d?.chosen;

    if (!chosen) {
      const needs = d?.needs ?? [];
      console.log(
        `  ${map.form.padEnd(10)} BLOCKED   ` +
          (needs.length ? `needs ${needs.join(", ")}` : "no rule fired"),
      );
      skipped++;
      continue;
    }
    if (!AFFIRMATIVE.has(chosen.ruleId)) {
      console.log(`  ${map.form.padEnd(10)} skipped   ${chosen.rule.then.conclusion}`);
      skipped++;
      continue;
    }

    const filling = fillForm(map, record);
    const payload = toFillPayload(filling);

    // Form 56 line 1 is a check-one group driven by the authority basis, and
    // line 2 takes a different date depending on which box was ticked. Both are
    // decided by the rule pack rather than by the field map, so they are
    // applied here where the rule result is in hand.
    if (map.form === "irs-56") {
      const ov = form56Overrides(record);
      for (const k of ov.clear) delete payload[k];
      Object.assign(payload, ov.set);
      for (const u of ov.unresolved) console.log(`    ! ${u}`);
    }

    const stem = `${id}__${map.form}`;
    writeFileSync(join(OUT, `${stem}.payload.json`), JSON.stringify({
      estate: id,
      form: map.form,
      sourceFile: map.sourceFile,
      rule: chosen.ruleId,
      authority: chosen.rule.authority.citation,
      fields: payload,
    }, null, 1));
    writeFileSync(join(OUT, `${stem}.report.txt`), fillReport(filling));

    console.log(
      `  ${map.form.padEnd(10)} FILL      ${String(Object.keys(payload).length).padStart(3)} boxes  ` +
        `(${filling.gaps.length} gap${filling.gaps.length === 1 ? "" : "s"})  <- ${chosen.ruleId}`,
    );
    produced++;
  }
}

console.log(`\n${produced} forms to fill, ${skipped} correctly skipped or blocked.`);
console.log(`payloads in ${OUT}/`);
