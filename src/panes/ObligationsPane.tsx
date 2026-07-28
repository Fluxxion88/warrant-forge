import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  Mail,
  Phone,
  Repeat,
  Send,
  TrendingDown,
} from "lucide-react";
import { Badge, Card, Label, Pane } from "../components/ui";
import { detectRecurring, summariseBleed } from "../lib/transactions";
import {
  assetObligations,
  board,
  subscriptionObligations,
  KIND_LABEL,
  type Obligation,
  type ObligationStatus,
} from "../lib/obligations";
import { HOYT_BATCHES } from "../fixtures/hoyt-transactions";
import { ESTATE, money as fmtMoney, type EstateRun } from "../lib/session";

const DOD = "2026-01-04";

const STATUS_TONE: Record<ObligationStatus, "verified" | "warn" | "alix" | "neutral" | "rejected"> = {
  confirmed: "verified",
  sent: "alix",
  ready: "warn",
  blocked: "neutral",
  not_applicable: "neutral",
};

function ObligationRow({
  o,
  onAdvance,
}: {
  o: Obligation;
  onAdvance: (id: string, status: ObligationStatus) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`px-5 py-3 ${o.urgent && o.status !== "confirmed" ? "bg-rejected-soft/40" : ""}`}>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-start gap-3 text-left">
        {o.status === "confirmed" ? (
          <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-verified" />
        ) : o.status === "sent" ? (
          <Send size={15} className="mt-0.5 shrink-0 text-alix-deep" />
        ) : (
          <CircleDashed size={15} className="mt-0.5 shrink-0 text-ink-faint" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-ink">{o.subject}</span>
            <Badge tone={STATUS_TONE[o.status]}>{o.status.replace("_", " ")}</Badge>
            {o.urgent && (
              <Badge tone="rejected">
                <AlertTriangle size={9} /> still charging
              </Badge>
            )}
            {o.phoneFirst && (
              <Badge tone="warn">
                <Phone size={9} /> call first
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{o.rationale}</p>
        </div>
        <div className="shrink-0 text-right">
          {o.annualBleedUsd > 0 && (
            <p className="tabular text-sm font-medium text-ink">{fmtMoney(o.annualBleedUsd)}/yr</p>
          )}
          <p className="text-[10px] text-ink-faint">{KIND_LABEL[o.kind]}</p>
        </div>
      </button>

      {open && (
        <div className="mt-3 ml-8 space-y-3 rounded-lg bg-sunk px-4 py-3">
          <div>
            <Label>Evidence required</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {o.evidence.map((e) => (
                <span
                  key={e.kind}
                  className={`rounded px-2 py-0.5 text-[11px] ${
                    e.held ? "bg-verified-soft text-verified" : "bg-warn-soft text-warn"
                  }`}
                >
                  {e.held ? "✓" : "✗"} {e.label}
                </span>
              ))}
            </div>
          </div>

          <div>
            <Label>Steps</Label>
            <ol className="mt-1.5 space-y-1">
              {o.steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-xs leading-relaxed text-ink-soft">
                  <span className="shrink-0 font-mono text-ink-faint">{i + 1}.</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-faint">
            <span>
              <Mail size={10} className="mr-1 inline" />
              {o.channel.replace("_", " ")} · accepts {o.channelsAccepted.join(", ")}
            </span>
            <span>
              <Clock size={10} className="mr-1 inline" />
              {o.turnaroundDays[0]}–{o.turnaroundDays[1]} days
            </span>
            {o.refundsUnusedPortion === true && <span>refund likely</span>}
          </div>

          {o.policyProvenance.status === "unverified" && (
            <p className="rounded bg-warn-soft px-3 py-2 text-[11px] leading-relaxed text-ink-soft">
              This vendor's bereavement process has not been confirmed against their published
              policy. The plan above assumes the strongest evidence and the slowest channel, which
              over-prepares rather than under-prepares.
            </p>
          )}

          <p className="text-[11px] leading-relaxed text-ink-faint">{o.jurisdictionNotes[0]}</p>

          <div className="flex gap-2 border-t border-line pt-2.5">
            <button
              disabled={o.status === "blocked"}
              onClick={() => onAdvance(o.id, "sent")}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper disabled:text-ink-faint"
            >
              Mark sent
            </button>
            <button
              onClick={() => onAdvance(o.id, "confirmed")}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper"
            >
              Mark confirmed
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ObligationsPane({ run }: { run: EstateRun }) {
  const [overrides, setOverrides] = useState<Record<string, ObligationStatus>>({});

  const charges = useMemo(() => detectRecurring(HOYT_BATCHES, { dateOfDeath: DOD }), []);
  const bleed = useMemo(() => summariseBleed(charges), [charges]);

  const all = useMemo(() => {
    const base = [
      ...subscriptionObligations(charges, run.facts, { state: "CA" }),
      ...assetObligations(run.facts, { state: "CA" }),
    ];
    return base.map((o) => (overrides[o.id] ? { ...o, status: overrides[o.id] } : o));
  }, [charges, run.facts, overrides]);

  const b = useMemo(() => board(all), [all]);
  const done = b.byStatus.confirmed;
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;

  return (
    <Pane
      title="Shut-down board"
      lede={`Everything that has to be closed, transferred or claimed for ${ESTATE.decedent} — with what each recipient requires, how it must reach them, and what has actually been done.`}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <Card tone={bleed.stillCharging > 0 ? "rejected" : "verified"} className="px-5 py-4">
          <div className="flex items-start gap-3">
            <TrendingDown
              size={18}
              className={`mt-0.5 shrink-0 ${bleed.stillCharging ? "text-rejected" : "text-verified"}`}
            />
            <div>
              <p className="text-sm font-medium text-ink">
                {bleed.stillCharging > 0
                  ? `${bleed.stillCharging} subscriptions have charged since the death`
                  : "Nothing is still charging"}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">
                {fmtMoney(b.monthlyBleedUsd)} a month, {fmtMoney(b.annualBleedUsd)} a year, leaving
                the estate while these stay open. Detected from {HOYT_BATCHES[0].transactions.length}{" "}
                transactions on the {HOYT_BATCHES[0].institution} account — no model involved,
                because periodicity is arithmetic rather than judgement.
              </p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Obligations", value: all.length, tone: "plain" as const },
            { label: "Ready to send", value: b.readyToSend, tone: "warn" as const },
            { label: "Awaiting evidence", value: b.byStatus.blocked, tone: "neutral" as const },
            { label: "Confirmed done", value: done, tone: "verified" as const },
          ].map((s) => (
            <Card key={s.label} tone={s.tone === "neutral" ? "plain" : s.tone} className="px-4 py-3">
              <p className="tabular font-brand text-2xl text-ink">{s.value}</p>
              <p className="mt-0.5 text-[11px] text-ink-soft">{s.label}</p>
            </Card>
          ))}
        </div>

        <Card className="px-5 py-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-ink">Progress for {ESTATE.decedent}</p>
            <span className="tabular text-xs text-ink-soft">
              {done} of {all.length} confirmed · {pct}%
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunk">
            <div className="h-full bg-verified transition-all" style={{ width: `${Math.max(pct, 1)}%` }} />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            This board is per estate. The same machinery runs for every matter a specialist holds,
            which is what makes “what has actually been done for this family?” a question with
            an answer rather than a folder to search.
          </p>
        </Card>

        <section>
          <Label>
            <span className="flex items-center gap-1.5">
              <Repeat size={12} /> Recurring charges and accounts
            </span>
          </Label>
          <Card className="mt-2 divide-y divide-line-soft">
            {b.obligations.map((o) => (
              <ObligationRow
                key={o.id}
                o={o}
                onAdvance={(id, status) => setOverrides((prev) => ({ ...prev, [id]: status }))}
              />
            ))}
          </Card>
        </section>

        <Card tone="warn" className="px-5 py-4">
          <p className="text-sm font-medium text-ink">
            {b.unverifiedPolicies} of {all.length} plans rest on an unconfirmed vendor policy
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            No vendor's bereavement process here has been checked against its own published terms,
            and no state's consumer-cancellation rules have been researched. Both are modelled
            dimensions with real structure and no verified content — surfaced rather than hidden,
            because telling an executor a vendor accepts email when it does not costs them a week.
          </p>
        </Card>
      </div>
    </Pane>
  );
}
