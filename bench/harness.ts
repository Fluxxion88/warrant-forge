// The benchmark harness.
//
// This project's whole argument is that a claim without a warrant is not
// evidence. It would be incoherent to then put a slide full of unwarranted
// numbers in front of a judge, so metrics carry provenance the same way facts
// do — and the same way, the provenance is machine-checkable rather than a
// footnote somebody wrote once and stopped maintaining.
//
// Four kinds, and the distinction is the point:
//
//   measured   we ran it and counted or timed it. Reproducible by re-running.
//   derived    arithmetic over other metrics, with the formula recorded.
//   cited      a figure from a named external source, with the source named.
//   assumed    a stand-in. NOT sourced. Explicitly not evidence.
//
// `assumed` exists because the alternative is worse. Every benchmark of this
// kind needs a denominator — hours per estate, cost of a specialist hour — and
// the temptation is to pick a plausible one and let it harden into a fact by
// repetition. Naming it as an assumption keeps it visibly load-bearing, and
// `report()` will not compute a headline saving from an unsourced denominator
// at all. A number that would impress somebody is exactly the number that has
// to be honest.

export type Provenance =
  | { kind: "measured"; how: string; at: string }
  | { kind: "derived"; from: string[]; formula: string }
  | { kind: "cited"; source: string; url?: string; retrievedAt: string }
  | { kind: "assumed"; basis: string; neededFrom?: string };

export interface Metric {
  id: string;
  label: string;
  value: number | string;
  unit?: string;
  provenance: Provenance;
  /** Anything a reader needs in order not to over-read the number. */
  caveat?: string;
}

export interface Benchmark {
  id: string;
  title: string;
  /** One sentence: what question does this benchmark answer? */
  question: string;
  metrics: Metric[];
  /** What this benchmark does NOT establish. Required, not optional. */
  limits: string[];
}

export const measured = (how: string, at = new Date().toISOString().slice(0, 10)): Provenance => ({
  kind: "measured",
  how,
  at,
});

export const derived = (from: string[], formula: string): Provenance => ({
  kind: "derived",
  from,
  formula,
});

export const cited = (
  source: string,
  retrievedAt: string,
  url?: string,
): Provenance => ({ kind: "cited", source, url, retrievedAt });

export const assumed = (basis: string, neededFrom?: string): Provenance => ({
  kind: "assumed",
  basis,
  neededFrom,
});

/** Is this metric safe to put on a slide as a claim about the world? */
export function isEvidence(m: Metric): boolean {
  return m.provenance.kind !== "assumed";
}

/**
 * A derived metric is only as good as its inputs. If any input is an
 * assumption, so is the output — and this is the rule people break, because
 * arithmetic feels like it launders a guess into a result.
 */
export function taint(metrics: Metric[], m: Metric): "clean" | "assumption-tainted" {
  if (m.provenance.kind === "assumed") return "assumption-tainted";
  if (m.provenance.kind !== "derived") return "clean";
  const byId = new Map(metrics.map((x) => [x.id, x]));
  for (const id of m.provenance.from) {
    const input = byId.get(id);
    if (!input) continue;
    if (taint(metrics, input) === "assumption-tainted") return "assumption-tainted";
  }
  return "clean";
}

export interface Suite {
  generatedAt: string;
  benchmarks: Benchmark[];
}

function fmt(v: number | string, unit?: string): string {
  const s =
    typeof v === "number"
      ? Number.isInteger(v)
        ? v.toLocaleString("en-US")
        : v.toFixed(2)
      : v;
  return unit ? `${s} ${unit}` : s;
}

const TAG: Record<Provenance["kind"], string> = {
  measured: "measured",
  derived: "derived",
  cited: "cited",
  assumed: "ASSUMED",
};

/**
 * Render a suite as markdown.
 *
 * Assumptions are not hidden in an appendix. They are marked inline, on the
 * same row as the number, because that is the only place a reader will
 * actually see them.
 */
export function report(suite: Suite): string {
  const out: string[] = [
    `# Warrant — benchmarks`,
    ``,
    `Generated ${suite.generatedAt}. Every figure below carries its provenance.`,
    `Rows marked **ASSUMED** are stand-ins, not findings; a derived figure`,
    `computed from one is marked the same way, because arithmetic does not`,
    `turn a guess into a measurement.`,
    ``,
  ];

  const allAssumed: Metric[] = [];

  for (const b of suite.benchmarks) {
    out.push(`## ${b.title}`, ``, `_${b.question}_`, ``);
    out.push(`| Metric | Value | Provenance |`, `|---|---|---|`);
    for (const m of b.metrics) {
      const t = taint(b.metrics, m);
      const tag =
        t === "assumption-tainted" && m.provenance.kind !== "assumed"
          ? `derived from an assumption`
          : TAG[m.provenance.kind];
      const detail =
        m.provenance.kind === "measured"
          ? m.provenance.how
          : m.provenance.kind === "derived"
            ? m.provenance.formula
            : m.provenance.kind === "cited"
              ? m.provenance.source
              : m.provenance.basis;
      const bold = t === "assumption-tainted";
      const val = bold ? `**${fmt(m.value, m.unit)}**` : fmt(m.value, m.unit);
      out.push(`| ${m.label} | ${val} | ${tag} — ${detail} |`);
      if (m.provenance.kind === "assumed") allAssumed.push(m);
    }
    out.push(``);
    for (const m of b.metrics) {
      if (m.caveat) out.push(`- **${m.label}** — ${m.caveat}`);
    }
    if (b.metrics.some((m) => m.caveat)) out.push(``);
    out.push(`**What this does not establish**`, ``);
    for (const l of b.limits) out.push(`- ${l}`);
    out.push(``);
  }

  if (allAssumed.length) {
    out.push(
      `## Assumptions still to be sourced`,
      ``,
      `These are the numbers somebody could argue with. Each needs a source`,
      `before it goes in front of anyone.`,
      ``,
    );
    for (const m of allAssumed) {
      const p = m.provenance as Extract<Provenance, { kind: "assumed" }>;
      out.push(
        `- **${m.label}** = ${fmt(m.value, m.unit)} — ${p.basis}` +
          (p.neededFrom ? ` _(ask: ${p.neededFrom})_` : ``),
      );
    }
    out.push(``);
  }

  return out.join("\n");
}

/** Console rendering, for running a single benchmark during development. */
export function print(b: Benchmark): void {
  console.log(`\n=== ${b.title}`);
  console.log(`    ${b.question}\n`);
  const w = Math.max(...b.metrics.map((m) => m.label.length));
  for (const m of b.metrics) {
    const t = taint(b.metrics, m);
    const flag = t === "assumption-tainted" ? " (!)" : "";
    console.log(
      `  ${m.label.padEnd(w)}  ${fmt(m.value, m.unit).padStart(12)}  ` +
        `[${TAG[m.provenance.kind]}]${flag}`,
    );
  }
}
