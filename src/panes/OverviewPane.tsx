import { AlertTriangle, ArrowRight, CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import { Badge, Card, Cite, Label, Pane } from "../components/ui";
import {
  dayRange,
  decisionLabel,
  ESTATE,
  moneyRange,
  type EstateRun,
} from "../lib/session";
import type { Gate } from "../lib/risk";

function GateChip({ gate }: { gate: Gate }) {
  if (gate.approval === "auto")
    return (
      <Badge tone="verified">
        <ShieldCheck size={11} /> Automatic
      </Badge>
    );
  if (gate.approval === "review")
    return (
      <Badge tone="warn">
        <Lock size={11} /> Needs your signature
      </Badge>
    );
  return (
    <Badge tone="rejected">
      <AlertTriangle size={11} /> Blocked
    </Badge>
  );
}

export default function OverviewPane({
  run,
  onIngest,
  ingested,
  onSeeChanges,
}: {
  run: EstateRun;
  onIngest: () => void;
  ingested: boolean;
  onSeeChanges: () => void;
}) {
  const blocking = run.gaps.filter((g) => g.severity === "blocking");

  // `run.county`, not `ESTATE.county`. The county is chosen on the Jurisdiction
  // pane and lives on the run; reading the frozen literal here meant that after
  // picking Alameda this header still said San Mateo, while the sidebar four
  // inches to the left said Alameda and the cards below said Alameda too. One
  // estate should not show two counties on one screen.
  const lede =
    `Estate of ${ESTATE.decedent}, ${run.county} County, California. ` +
    `Died ${ESTATE.dateOfDeath}. ${ESTATE.executor} is executor.`;

  return (
    <Pane
      title={ESTATE.decedent}
      lede={lede}
      actions={
        ingested ? (
          <button
            onClick={onSeeChanges}
            className="inline-flex items-center gap-2 rounded-lg bg-alix-deep px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-alix-dark"
          >
            See what changed <ArrowRight size={15} />
          </button>
        ) : (
          <button
            onClick={onIngest}
            className="inline-flex items-center gap-2 rounded-lg border border-alix-mid/40 bg-surface px-4 py-2.5 text-sm font-medium text-alix-dark transition-colors hover:bg-alix/15"
          >
            Ingest supplemental appraisal
          </button>
        )
      }
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <Card tone={blocking.length ? "warn" : "verified"} className="px-5 py-4">
          <div className="flex items-center gap-3">
            {blocking.length ? (
              <AlertTriangle size={18} className="shrink-0 text-warn" />
            ) : (
              <CheckCircle2 size={18} className="shrink-0 text-verified" />
            )}
            <div>
              <p className="text-sm font-medium text-ink">{run.readiness}</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                {run.integrity.verified} of {run.integrity.proposed} proposed facts carry a verified
                quotation
                {run.integrity.quarantined > 0 && (
                  <>
                    {" · "}
                    <span className="font-medium text-rejected">
                      {run.integrity.quarantined} rejected as unsupported
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
        </Card>

        <div>
          <Label>What happens to each part of the estate</Label>
          <div className="mt-3 space-y-3">
            {run.decisions.map((d) => {
              const gate = run.gates.find((g) => g.decisionPoint === d.decisionPoint)!;
              const chosen = d.chosen;
              return (
                <Card key={d.decisionPoint} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <h3 className="font-brand text-lg text-ink">
                          {decisionLabel(d.decisionPoint)}
                        </h3>
                        <GateChip gate={gate} />
                      </div>
                      {chosen ? (
                        <>
                          <p className="mt-1 text-sm font-medium text-ink">{chosen.title}</p>
                          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">
                            {chosen.rule.then.conclusion}
                          </p>
                          <p className="mt-2">
                            <Cite>{chosen.rule.authority.citation}</Cite>
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">
                          Cannot conclude yet — {d.needs.length} fact
                          {d.needs.length === 1 ? "" : "s"} still required.
                        </p>
                      )}
                    </div>

                    {chosen && (
                      <div className="shrink-0 text-right">
                        <p className="tabular text-sm font-medium text-ink">
                          {dayRange(chosen.rule.then.timelineDays)}
                        </p>
                        <p className="tabular mt-0.5 text-xs text-ink-soft">
                          {moneyRange(chosen.rule.then.estCostUsd)}
                        </p>
                      </div>
                    )}
                  </div>

                  {chosen && chosen.rule.then.forms.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line-soft pt-3">
                      {chosen.rule.then.forms.map((f) => (
                        <Badge key={f.code} tone="alix">
                          {f.code === "—" ? f.title : `${f.code} · ${f.title}`}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {blocking.length > 0 && (
          <div>
            <Label>Before you can file</Label>
            <Card tone="warn" className="mt-3 divide-y divide-warn/15">
              {blocking.map((g) => (
                <div key={g.key} className="px-5 py-3">
                  <p className="text-sm font-medium text-ink">{g.key}</p>
                  {g.howToObtain && (
                    <p className="mt-0.5 text-xs text-ink-soft">{g.howToObtain}</p>
                  )}
                  <p className="mt-1 text-xs text-ink-faint">
                    Holding up: {g.blocks.map(decisionLabel).join(", ")}
                  </p>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
    </Pane>
  );
}
