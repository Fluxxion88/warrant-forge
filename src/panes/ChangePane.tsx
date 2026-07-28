import { ArrowRight, Minus, Plus, SkipForward, Zap } from "lucide-react";
import { Badge, Card, Cite, Empty, Label, Pane } from "../components/ui";
import { dayRange, decisionLabel, moneyRange, type EstateRun } from "../lib/session";
import type { FactValue } from "../lib/facts";

function show(v: FactValue | undefined): string {
  if (v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString("en-US");
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
}

export default function ChangePane({ run }: { run: EstateRun }) {
  const report = run.report;

  if (!report) {
    return (
      <Pane title="Change log" lede="Nothing has changed since the estate was first assessed.">
        <Empty
          title="No changes yet"
          body="When a new document arrives, this is where you will see exactly which facts moved, which decisions depended on them, and what the family must now do differently."
        />
      </Pane>
    );
  }

  const flipped = report.decisionDeltas.filter((d) => d.flipped);

  return (
    <Pane
      title="Change log"
      lede="A new document arrived. Only decisions that read a changed fact were re-evaluated — the rest are provably untouched."
    >
      <div className="mx-auto max-w-4xl space-y-7">
        <Card tone={flipped.length ? "rejected" : "plain"} className="animate-flip-in px-5 py-4">
          <div className="flex items-center gap-3">
            <Zap size={18} className={flipped.length ? "text-rejected" : "text-ink-faint"} />
            <p className="text-sm text-ink">
              <span className="font-medium">{report.factDeltas.length} facts moved</span> ·{" "}
              {report.reevaluated.length} decision point
              {report.reevaluated.length === 1 ? "" : "s"} re-evaluated ·{" "}
              <span className="font-medium text-rejected">
                {report.flippedCount} flipped
              </span>
            </p>
          </div>
          {report.skipped.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-soft">
              <SkipForward size={12} />
              Not recomputed, because nothing they depend on changed:{" "}
              {report.skipped.map(decisionLabel).join(", ")}
            </p>
          )}
        </Card>

        <section>
          <Label>What moved</Label>
          <Card className="mt-2 divide-y divide-line-soft">
            {report.factDeltas.map((d) => (
              <div key={d.key} className="px-5 py-3">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-mono text-[12px] text-ink">{d.key}</span>
                  <span className="tabular flex items-center gap-2 text-sm">
                    <span className="text-ink-faint line-through">{show(d.before)}</span>
                    <ArrowRight size={12} className="text-ink-faint" />
                    <span className="font-medium text-ink">{show(d.after)}</span>
                  </span>
                </div>
                {d.cause && d.cause.warrant.kind === "quote" && (
                  <blockquote className="mt-2 border-l-2 border-alix-mid pl-3 font-brand text-sm italic leading-relaxed text-ink-soft">
                    “{d.cause.warrant.quote}”
                    <span className="mt-1 block font-sans not-italic text-[11px] text-ink-faint">
                      {d.cause.warrant.document}
                    </span>
                  </blockquote>
                )}
                {d.cause && d.cause.warrant.kind === "derivation" && (
                  <p className="tabular mt-1.5 font-mono text-[11px] leading-relaxed text-ink-faint">
                    {d.cause.warrant.formula}
                  </p>
                )}
              </div>
            ))}
          </Card>
        </section>

        <section>
          <Label>What the family must now do differently</Label>
          <div className="mt-2 space-y-4">
            {report.decisionDeltas.map((d) => (
              <Card
                key={d.decisionPoint}
                tone={d.flipped ? "rejected" : "plain"}
                className="animate-flip-in px-5 py-4"
              >
                <div className="flex items-center gap-2.5">
                  <h3 className="font-brand text-lg text-ink">
                    {decisionLabel(d.decisionPoint)}
                  </h3>
                  {d.flipped ? (
                    <Badge tone="rejected">route changed</Badge>
                  ) : (
                    <Badge tone="neutral">unchanged</Badge>
                  )}
                </div>

                {d.flipped && (
                  <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
                    <div className="rounded-lg bg-sunk px-3 py-2.5 opacity-70">
                      <p className="text-[11px] uppercase tracking-wider text-ink-faint">Was</p>
                      <p className="mt-0.5 text-sm text-ink line-through">{d.before?.title}</p>
                      <p className="tabular mt-1 text-xs text-ink-soft">
                        {d.before && dayRange(d.before.timelineDays)} ·{" "}
                        {d.before && moneyRange(d.before.estCostUsd)}
                      </p>
                    </div>
                    <ArrowRight size={16} className="mt-6 text-rejected" />
                    <div className="rounded-lg bg-rejected-soft px-3 py-2.5 ring-1 ring-rejected/20">
                      <p className="text-[11px] uppercase tracking-wider text-rejected">Now</p>
                      <p className="mt-0.5 text-sm font-medium text-ink">{d.after?.title}</p>
                      <p className="tabular mt-1 text-xs text-ink-soft">
                        {d.after && dayRange(d.after.timelineDays)} ·{" "}
                        {d.after && moneyRange(d.after.estCostUsd)}
                      </p>
                    </div>
                  </div>
                )}

                {d.after && (
                  <p className="mt-3">
                    <Cite>{d.after.citation}</Cite>
                  </p>
                )}

                {(d.formsAdded.length > 0 || d.formsRemoved.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line-soft pt-3">
                    {d.formsRemoved.map((f) => (
                      <span
                        key={`-${f.code}`}
                        className="inline-flex items-center gap-1 rounded-full bg-sunk px-2 py-0.5 text-[11px] text-ink-faint line-through"
                      >
                        <Minus size={9} /> {f.code}
                      </span>
                    ))}
                    {d.formsAdded.map((f) => (
                      <span
                        key={`+${f.code}`}
                        className="inline-flex items-center gap-1 rounded-full bg-rejected-soft px-2 py-0.5 text-[11px] font-medium text-rejected ring-1 ring-inset ring-rejected/20"
                      >
                        <Plus size={9} /> {f.code} · {f.title}
                      </span>
                    ))}
                  </div>
                )}

                {d.obligationsAdded.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {d.obligationsAdded.map((o) => (
                      <li key={o} className="flex gap-2 text-sm text-ink-soft">
                        <Plus size={12} className="mt-1 shrink-0 text-rejected" />
                        <span className="leading-relaxed">{o}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {d.triggeredBy.length > 0 && (
                  <p className="mt-3 text-[11px] text-ink-faint">
                    Triggered by: <span className="font-mono">{d.triggeredBy.join(", ")}</span>
                  </p>
                )}
              </Card>
            ))}
          </div>
        </section>
      </div>
    </Pane>
  );
}
