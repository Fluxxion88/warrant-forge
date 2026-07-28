/**
 * Compare two independent mapping runs and report where they disagree.
 *
 * Run:  npx vite-node tools/compare-maps.ts src/forms/maps src/forms/maps-crosscheck
 *
 * Label verification proves a model did not invent the evidence it cited. It
 * does not prove the target path is the right one — a model can quote a real
 * label and still route it to the wrong field. Nothing deterministic can settle
 * that; the form does not say which JSON path feeds it.
 *
 * What is available is agreement. Two runs, different models, same evidence: a
 * field both map identically is about as good as this gets without a human, and
 * a field they map differently is precisely where a human should look. The
 * output is therefore a worklist, not a score.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { FieldMap } from "../src/lib/formmap";

const [, , dirA = "src/forms/maps", dirB = "src/forms/maps-crosscheck"] = process.argv;
if (!existsSync(dirB)) throw new Error(`no ${dirB} — run discovery with WK_OUT set`);

function load(dir: string, file: string): FieldMap | null {
  const p = join(dir, file);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as FieldMap) : null;
}

let agree = 0;
let differ = 0;
let onlyA = 0;
let onlyB = 0;

for (const file of readdirSync(dirA).filter((f) => f.endsWith(".json"))) {
  const a = load(dirA, file);
  const b = load(dirB, file);
  if (!a || !b) continue;

  const mapA = new Map(a.entries.map((e) => [e.field, e]));
  const mapB = new Map(b.entries.map((e) => [e.field, e]));
  const fields = new Set([...mapA.keys(), ...mapB.keys()]);

  const rows: string[] = [];
  let fAgree = 0;
  for (const f of fields) {
    const ea = mapA.get(f);
    const eb = mapB.get(f);
    const short = f.split(".").pop() ?? f;

    if (ea && eb) {
      if (ea.target === eb.target) {
        fAgree++;
        agree++;
      } else {
        differ++;
        rows.push(`  DIFFER  ${short.padEnd(14)} A: ${ea.target}\n${" ".repeat(24)}B: ${eb.target}`);
      }
    } else if (ea) {
      onlyA++;
      rows.push(`  A only  ${short.padEnd(14)} ${ea.target}`);
    } else if (eb) {
      onlyB++;
      rows.push(`  B only  ${short.padEnd(14)} ${eb.target}`);
    }
  }

  const both = fAgree + rows.filter((r) => r.startsWith("  DIFFER")).length;
  const pct = both ? Math.round((fAgree / both) * 100) : 0;
  console.log(
    `\n=== ${a.form}   ${fAgree}/${both} mapped-by-both agree (${pct}%)   ` +
      `${a.discoveredBy} vs ${b.discoveredBy}`,
  );
  for (const r of rows.slice(0, 14)) console.log(r);
  if (rows.length > 14) console.log(`  ... and ${rows.length - 14} more`);
}

const both = agree + differ;
console.log(
  `\ntotals: ${agree}/${both} agree (${both ? Math.round((agree / both) * 100) : 0}%), ` +
    `${differ} disagree, ${onlyA} only in A, ${onlyB} only in B`,
);
console.log(
  differ === 0
    ? "no disagreements — every field both runs mapped, they mapped the same way."
    : `${differ} field${differ === 1 ? "" : "s"} need a human to look.`,
);
