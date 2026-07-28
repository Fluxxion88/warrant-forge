/**
 * Run every benchmark and write docs/BENCHMARKS.md.
 *
 *   npx vite-node bench/run.ts
 *
 * Sets BENCH_QUIET so the modules do not each print their own table on import.
 */
process.env.BENCH_QUIET = "1";

import { writeFileSync, mkdirSync } from "node:fs";
import { report, taint, type Benchmark, type Suite } from "./harness";

const modules = await Promise.all([
  import("./onboarding"),
  import("./calibration"),
  import("./extraction"),
  import("./replay"),
  import("./coverage"),
  import("./economics"),
]);

const benchmarks: Benchmark[] = modules.map((m) => m.BENCHMARK);

const suite: Suite = {
  generatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
  benchmarks,
};

mkdirSync("docs", { recursive: true });
writeFileSync("docs/BENCHMARKS.md", report(suite));

// A one-screen census, because the split between what we measured and what we
// assumed is the thing most worth knowing about a benchmark suite.
let measured = 0;
let derivedClean = 0;
let citedCount = 0;
let assumedCount = 0;
let tainted = 0;

for (const b of benchmarks) {
  for (const m of b.metrics) {
    const t = taint(b.metrics, m);
    if (m.provenance.kind === "assumed") assumedCount++;
    else if (t === "assumption-tainted") tainted++;
    else if (m.provenance.kind === "measured") measured++;
    else if (m.provenance.kind === "cited") citedCount++;
    else derivedClean++;
  }
  const missingLimits = b.limits.length === 0;
  console.log(
    `${b.id.padEnd(12)} ${String(b.metrics.length).padStart(3)} metrics` +
      (missingLimits ? "   NO LIMITS DECLARED" : ""),
  );
}

console.log(
  `\n${measured} measured, ${derivedClean} derived, ${citedCount} cited, ` +
    `${assumedCount} assumed, ${tainted} derived-from-an-assumption`,
);
console.log(
  assumedCount + tainted === 0
    ? "every figure is evidence."
    : `${assumedCount + tainted} figures are NOT evidence and are marked as such.`,
);
console.log("\n-> docs/BENCHMARKS.md");
