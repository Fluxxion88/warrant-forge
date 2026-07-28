/**
 * Write one work order per estate into Forge's artifacts directory.
 *
 * Run:  npx vite-node tools/emit-workorders.ts
 *
 * This is the seam, executed. Warrant decides applicability from FORM_RULES and
 * writes `forge/artifacts/workorders/<estateId>.json`; Forge reads that file and
 * fills what it says to fill. Replaces the stand-in decider, which is deleted.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildWorkOrder } from "../src/lib/workorder";
import type { EstateRecord } from "../src/lib/estate";

const ESTATES = "forge/inputs/estates";
const OUT = "forge/artifacts/workorders";

mkdirSync(OUT, { recursive: true });

const ids = readdirSync(ESTATES)
  .filter((f) => f.endsWith(".json"))
  .sort();

let applicable = 0;
let withheld = 0;

for (const file of ids) {
  const record = JSON.parse(readFileSync(join(ESTATES, file), "utf8")) as EstateRecord;
  const order = buildWorkOrder(record);
  writeFileSync(join(OUT, `${order.estateId}.json`), JSON.stringify(order, null, 2) + "\n");

  console.log(`\n${order.estateId}  (${order.jurisdiction.state}, ${order.route})`);
  for (const f of order.forms) {
    if (f.applicable) {
      applicable++;
      console.log(`  ${f.formId.padEnd(13)} needed    #${f.priority}  ${f.blastRadius}/${f.reversibility}`);
    } else {
      withheld++;
      console.log(`  ${f.formId.padEnd(13)} skipped   ${f.reason?.slice(0, 96)}…`);
    }
  }
}

console.log(`\n${ids.length} estates · ${applicable} forms needed · ${withheld} withheld with a reason`);
