import { useState } from "react";
import { Eye, Globe, Lock, Search, ShieldAlert, Telescope } from "lucide-react";
import { Badge, Card, Cite, Label, Pane } from "../components/ui";
import type { EstateRun } from "../lib/session";
import type { Lead, LeadPriority } from "../lib/leads";

const TONE: Record<LeadPriority, "rejected" | "warn" | "neutral"> = {
  critical: "rejected",
  high: "warn",
  routine: "neutral",
};

const AUTHORITY_LABELS: Record<string, string> = {
  letters_testamentary: "Certified Letters",
  death_certificate: "Certified death certificate",
  form_56: "Form 56",
  estate_ein: "Estate EIN",
  court_order: "Court order",
  apostille: "Apostille",
  certified_translation: "Certified translation",
  local_counsel: "Local counsel",
};

function LeadCard({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(lead.priority === "critical");

  return (
    <Card tone={lead.priority === "critical" ? "rejected" : "plain"} className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={TONE[lead.priority]}>{lead.priority}</Badge>
            {lead.foreign && (
              <Badge tone="alix">
                <Globe size={10} /> foreign
              </Badge>
            )}
            <h3 className="font-brand text-lg text-ink">{lead.title}</h3>
          </div>
          <p className="mt-1 text-sm font-medium text-ink">
            <Telescope size={13} className="mr-1.5 inline text-alix-deep" />
            Implies: {lead.implies}
          </p>
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-ink-soft">{lead.rationale}</p>
        </div>
      </button>

      {open && (
        <div className="border-t border-line-soft bg-sunk/60 px-5 py-4">
          <Label>Raised by</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {lead.evidence.map((e) => (
              <span key={e} className="rounded bg-surface px-2 py-0.5 font-mono text-[11px] text-ink-soft">
                {e}
              </span>
            ))}
          </div>

          <Label>
            <span className="mt-4 block">What to do about it</span>
          </Label>
          <div className="mt-2 space-y-3">
            {lead.actions.map((a) => (
              <div key={a.id} className="rounded-lg border border-line bg-surface px-4 py-3">
                <p className="text-sm font-medium text-ink">{a.label}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  To: {a.target}
                  {a.form && (
                    <>
                      {" · "}
                      <span className="font-medium text-alix-deep">Form {a.form}</span>
                    </>
                  )}
                </p>
                {a.requiresAuthority.length > 0 && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
                    <Lock size={10} />
                    Requires:
                    {a.requiresAuthority.map((d) => (
                      <span key={d} className="rounded bg-sunk px-1.5 py-0.5">
                        {AUTHORITY_LABELS[d] ?? d}
                      </span>
                    ))}
                  </p>
                )}
                <ul className="mt-2 space-y-0.5">
                  {a.mayReveal.map((m) => (
                    <li key={m} className="flex gap-1.5 text-xs text-ink-soft">
                      <Eye size={11} className="mt-0.5 shrink-0 text-ink-faint" />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {lead.authority && (
            <p className="mt-3">
              <Cite>{lead.authority.citation}</Cite>
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

export default function InvestigationPane({ run }: { run: EstateRun }) {
  const critical = run.leads.filter((l) => l.priority === "critical");
  const foreign = run.leads.filter((l) => l.foreign);

  return (
    <Pane
      title="Investigation"
      lede="A fact ledger records what the documents say. An investigation reasons about what they imply. A wire to Geneva is not an asset — it is evidence that an account exists which no document here describes."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {/*
          Placed first, above the distribution gate, because this is the only
          section that finds money nobody knew about. Everything else on this
          pane reasons from facts already in the ledger; these are reasoned from
          bank rows and describe assets no document mentions.
        */}
        {run.discovery.hypotheses.length > 0 && (
          <section>
            <Label>Assets nobody mentioned</Label>
            <Card className="mt-2 overflow-hidden">
              <p className="border-b border-line-soft px-5 py-3 text-xs leading-relaxed text-ink-soft">
                Inferred from recurring payments, not read from a document. These are
                hypotheses with the debits attached — none is a fact, and none can enter the
                ledger until the institution replies in writing.
              </p>
              <div className="divide-y divide-line-soft">
                {run.discovery.hypotheses.map((h) => (
                  <div key={h.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-ink">{h.merchant}</p>
                      <div className="flex items-center gap-2">
                        <Badge tone={h.confidence === "strong" ? "alix" : "warn"}>
                          {h.confidence}
                        </Badge>
                        {h.activeAfterDeath && (
                          <Badge tone="warn">still charging</Badge>
                        )}
                        <span className="tabular text-sm text-ink">
                          ${h.amountUsd.toFixed(2)} {h.cadence}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">
                      Implies {h.implies}; none in the ledger.{" "}
                      <span className="text-ink-faint">
                        {h.evidence.length} payments, {h.evidence[0]?.date} to{" "}
                        {h.evidence.at(-1)?.date}.
                      </span>
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{h.because}</p>
                    <p className="mt-1.5 text-xs text-alix-deep">
                      Next: {h.nextStep.channel} to {h.nextStep.recipient} — {h.nextStep.asks}
                    </p>
                  </div>
                ))}
              </div>

              {run.discovery.suppressed.length > 0 && (
                <div className="border-t border-line-soft bg-sunk px-5 py-3">
                  <p className="text-xs text-ink-soft">
                    Deliberately not reported:{" "}
                    {run.discovery.suppressed.map((s) => s.merchant).join(", ")} — already in the
                    ledger as{" "}
                    <span className="font-mono text-[11px]">
                      {run.discovery.suppressed[0]?.accountedForBy.key}
                    </span>
                    . A queue that cries wolf stops being read.
                  </p>
                </div>
              )}
            </Card>
          </section>
        )}

        <Card tone={run.distribution.safe ? "verified" : "rejected"} className="px-5 py-4">
          <div className="flex items-start gap-3">
            <ShieldAlert
              size={18}
              className={`mt-0.5 shrink-0 ${run.distribution.safe ? "text-verified" : "text-rejected"}`}
            />
            <div>
              <p className="text-sm font-medium text-ink">
                {run.distribution.safe
                  ? "The estate can be distributed."
                  : "The estate must not be distributed yet."}
              </p>
              <ul className="mt-1.5 space-y-1">
                {run.distribution.reasons.map((r) => (
                  <li key={r} className="text-sm leading-relaxed text-ink-soft">
                    {r}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-faint">
                Distribution is the one irreversible act in an estate. Paying beneficiaries early is
                the most common route to personal liability for an executor.
              </p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Leads open", value: run.leads.length, tone: "plain" as const },
            { label: "Critical", value: critical.length, tone: "rejected" as const },
            { label: "Foreign exposure", value: foreign.length, tone: "warn" as const },
            { label: "Patterns watched", value: run.dormantLeads.length, tone: "alix" as const },
          ].map((s) => (
            <Card key={s.label} tone={s.tone} className="px-4 py-3">
              <p className="tabular font-brand text-2xl text-ink">{s.value}</p>
              <p className="mt-0.5 text-[11px] text-ink-soft">{s.label}</p>
            </Card>
          ))}
        </div>

        <div className="space-y-3">
          {run.leads.map((l) => (
            <LeadCard key={l.patternId} lead={l} />
          ))}
        </div>

        <Card className="px-5 py-4">
          <Label>Patterns being watched but not triggered</Label>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            {run.dormantLeads.length} further lead patterns are evaluated on every run and have not
            fired on this estate. They are listed rather than discarded, so the investigation log
            can show that the pattern was considered — which is the executor's defence if a
            beneficiary later argues something should have been found.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {run.dormantLeads.map((d) => (
              <span
                key={d.patternId}
                className="inline-flex items-center gap-1 rounded-full bg-sunk px-2 py-0.5 font-mono text-[10px] text-ink-faint"
                title={`Awaiting: ${d.awaiting.join(", ")}`}
              >
                <Search size={9} />
                {d.patternId.replace("lead.", "")}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </Pane>
  );
}
