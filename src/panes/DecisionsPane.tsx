import { CircleSlash, CornerDownRight, HelpCircle } from "lucide-react";
import { Badge, Card, Cite, Label, Pane } from "../components/ui";
import { dayRange, decisionLabel, moneyRange, type EstateRun } from "../lib/session";
import type { RuleResult, Tri } from "../lib/rules";

function TriMark({ r }: { r: Tri }) {
  if (r === true) return <span className="font-mono text-xs text-verified">true</span>;
  if (r === false) return <span className="font-mono text-xs text-ink-faint">false</span>;
  return <span className="font-mono text-xs text-warn">unknown</span>;
}

function Trace({ result }: { result: RuleResult }) {
  return (
    <div className="mt-3 rounded-lg bg-sunk px-4 py-3">
      <Label>How this was evaluated</Label>
      <div className="mt-2 space-y-1">
        {result.trace.map((t, i) => (
          <div
            key={i}
            className="flex items-baseline justify-between gap-4"
            style={{ paddingLeft: t.depth * 16 }}
          >
            <span className="font-mono text-[11.5px] leading-relaxed text-ink-soft">
              {t.description}
            </span>
            <TriMark r={t.result} />
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-line pt-2 text-[11px] text-ink-faint">
        Read {result.dependsOn.length} fact{result.dependsOn.length === 1 ? "" : "s"}:{" "}
        {result.dependsOn.join(", ")}
      </p>
    </div>
  );
}

export default function DecisionsPane({ run }: { run: EstateRun }) {
  return (
    <Pane
      title="Decisions"
      lede="No model runs in this path. Rules are data — a predicate tree over verified facts, plus the authority that backs it. A fact we do not hold evaluates to unknown, never to false."
    >
      <div className="mx-auto max-w-4xl space-y-8">
        {run.decisions.map((d) => (
          <section key={d.decisionPoint}>
            <div className="flex items-baseline gap-3">
              <h2 className="font-brand text-xl text-ink">{decisionLabel(d.decisionPoint)}</h2>
              <span className="font-mono text-[11px] text-ink-faint">{d.decisionPoint}</span>
            </div>

            {d.chosen ? (
              <Card tone="alix" className="mt-3 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge tone="verified">rule fired</Badge>
                    <p className="mt-2 font-brand text-lg text-ink">{d.chosen.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                      {d.chosen.rule.then.conclusion}
                    </p>
                    <p className="mt-2">
                      <Cite>{d.chosen.rule.authority.citation}</Cite>
                      <span className="ml-2 text-[11px] text-ink-faint">
                        in force from {d.chosen.rule.authority.effectiveFrom} · read{" "}
                        {d.chosen.rule.authority.retrievedAt}
                      </span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular text-sm font-medium text-ink">
                      {dayRange(d.chosen.rule.then.timelineDays)}
                    </p>
                    <p className="tabular text-xs text-ink-soft">
                      {moneyRange(d.chosen.rule.then.estCostUsd)}
                    </p>
                  </div>
                </div>

                {d.chosen.rule.then.obligations.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-alix-mid/20 pt-3">
                    {d.chosen.rule.then.obligations.map((o) => (
                      <li key={o} className="flex gap-2 text-sm text-ink-soft">
                        <CornerDownRight size={13} className="mt-1 shrink-0 text-alix-deep" />
                        <span className="leading-relaxed">{o}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <Trace result={d.chosen} />
              </Card>
            ) : (
              <Card tone="warn" className="mt-3 px-5 py-4">
                <Badge tone="warn">
                  <HelpCircle size={11} /> cannot conclude
                </Badge>
                <p className="mt-2 text-sm text-ink-soft">
                  Needs: <span className="font-mono text-xs">{d.needs.join(", ")}</span>
                </p>
              </Card>
            )}

            {d.alsoFired.length > 0 && (
              <p className="mt-2 text-xs text-ink-faint">
                Also matched, lost on priority: {d.alsoFired.map((r) => r.title).join(", ")}
              </p>
            )}

            {d.notApplicable.length > 0 && (
              <div className="mt-2 space-y-1">
                {d.notApplicable.map((r) => (
                  <p key={r.ruleId} className="flex items-center gap-1.5 text-xs text-ink-faint">
                    <CircleSlash size={11} /> {r.title} — did not apply
                  </p>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </Pane>
  );
}
