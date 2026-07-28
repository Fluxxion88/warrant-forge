import { useMemo, useState } from "react";
import { Clock, Copy, GitMerge, Mail, TriangleAlert, UserCheck } from "lucide-react";
import { Badge, Card, Label, Pane } from "../components/ui";
import { planCorrespondence, toPlainText, type Letter } from "../lib/correspondence";
import { LETTER_TEMPLATES } from "../rules/letters";
import { proposeMerges, summarise, type EntityProposal } from "../lib/entities";
import { computeEffort, hours, savingExcludingHumanWork } from "../lib/effort";
import { ESTATE, type EstateRun } from "../lib/session";

const RECIPIENTS: Record<string, string> = {
  "letter.institution.notify": "Wells Fargo estate servicing",
  "letter.institution.search": "Charles Schwab estate services",
  "letter.foreign.institution": "Banque Pictet & Cie SA, Geneva",
  "letter.irs.transcripts": "Internal Revenue Service",
  "letter.professional.file": "Halloran & Reyes CPAs",
  "letter.family.weekly": ESTATE.executor,
  "letter.creditor.notice": "Known creditor",
};

const STRENGTH_TONE = {
  conflicting: "rejected",
  conclusive: "verified",
  strong: "warn",
  weak: "neutral",
} as const;

function LetterCard({ letter }: { letter: Letter }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(toPlainText(letter));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — the text is on screen anyway */
    }
  }

  return (
    <Card tone={letter.ready ? "plain" : "warn"} className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-4 px-5 py-3.5 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-ink">{letter.purpose}</p>
            {letter.ready ? (
              <Badge tone="verified">ready to review</Badge>
            ) : (
              <Badge tone="warn">{letter.gaps.length} fact(s) missing</Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-ink-soft">
            To {letter.recipient} · saves about {letter.manualMinutes} min of drafting
          </p>
        </div>
      </button>

      {open && (
        <div className="border-t border-line-soft bg-sunk/60 px-5 py-4">
          {!letter.ready && (
            <p className="mb-3 text-xs text-warn">
              Refused until these are known:{" "}
              <span className="font-mono">{letter.gaps.map((g) => g.key).join(", ")}</span>
            </p>
          )}

          <p className="text-xs text-ink-faint">Subject</p>
          <p className="mt-0.5 text-sm font-medium text-ink">{letter.subject}</p>

          <div className="mt-3 space-y-2">
            {letter.paragraphs.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-ink-soft">
                {p}
              </p>
            ))}
          </div>

          {letter.enclosures.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <p className="text-xs text-ink-faint">Enclosures</p>
              <ul className="mt-1 space-y-0.5">
                {letter.enclosures.map((e) => (
                  <li key={e.id + e.label} className="text-xs text-ink-soft">
                    {e.label}
                    {e.certified && <span className="text-warn"> — certified copy</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {letter.citedFacts.length > 0 && (
            <p className="mt-3 text-[11px] text-ink-faint">
              Every figure above resolves from: {letter.citedFacts.join(", ")}
            </p>
          )}

          {letter.ready && (
            <button
              onClick={copy}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-sunk"
            >
              <Copy size={12} />
              {copied ? "Copied" : "Copy as plain text"}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

function ProposalRow({ p }: { p: EntityProposal }) {
  return (
    <div className="px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STRENGTH_TONE[p.strength]}>{p.strength}</Badge>
        <span className="font-mono text-xs text-ink">{p.left}</span>
        <GitMerge size={12} className="text-ink-faint" />
        <span className="font-mono text-xs text-ink">{p.right}</span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{p.recommendation}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {p.signals.map((s, i) => (
          <span
            key={i}
            className={`rounded px-1.5 py-0.5 text-[10px] ${
              s.agrees ? "bg-verified-soft text-verified" : "bg-rejected-soft text-rejected"
            }`}
          >
            {s.kind.replace("_", " ")}: {s.detail}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function EfficiencyPane({ run }: { run: EstateRun }) {
  const plan = useMemo(
    () =>
      planCorrespondence(
        LETTER_TEMPLATES.map((t) => ({ template: t, recipient: RECIPIENTS[t.id] ?? "Recipient" })),
        run.facts,
      ),
    [run.facts],
  );

  const proposals = useMemo(() => proposeMerges(run.facts), [run.facts]);
  const entitySummary = useMemo(() => summarise(run.facts, proposals), [run.facts, proposals]);

  const effort = computeEffort();
  const scoped = savingExcludingHumanWork(effort);

  return (
    <Pane
      title="Efficiency"
      lede="Where the hours actually go, and which of them this removes. Drafts are counted as drafts — review time is subtracted rather than treated as free."
    >
      <div className="mx-auto max-w-4xl space-y-7">
        <div className="grid grid-cols-3 gap-3">
          <Card tone="alix" className="px-4 py-3">
            <p className="tabular font-brand text-2xl text-ink">{hours(effort.manualTotal)}</p>
            <p className="mt-0.5 text-[11px] text-ink-soft">Manual effort per estate</p>
          </Card>
          <Card tone="verified" className="px-4 py-3">
            <p className="tabular font-brand text-2xl text-ink">{hours(effort.savedMinutes)}</p>
            <p className="mt-0.5 text-[11px] text-ink-soft">Removed — {effort.savedPercent}% of total</p>
          </Card>
          <Card className="px-4 py-3">
            <p className="tabular font-brand text-2xl text-ink">{scoped.percent}%</p>
            <p className="mt-0.5 text-[11px] text-ink-soft">Of the work meant to be automated</p>
          </Card>
        </div>

        <Card tone="warn" className="px-5 py-4">
          <div className="flex items-start gap-3">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" />
            <p className="text-sm leading-relaxed text-ink-soft">
              These are practice estimates of manual effort, not measurements of this system
              running. Two figures are quoted because the honest one is smaller: the {scoped.percent}%
              excludes speaking with the family and waiting on hold, which are deliberately left to
              people.
            </p>
          </div>
        </Card>

        <section>
          <Label>
            <span className="flex items-center gap-1.5">
              <Clock size={12} /> Where the time goes
            </span>
          </Label>
          <Card className="mt-2 divide-y divide-line-soft">
            {effort.lines.map((l) => {
              const saved = l.manualMinutes - l.residualMinutes;
              const pct = Math.round((saved / l.manualMinutes) * 100);
              return (
                <div key={l.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-ink">{l.activity}</p>
                        <Badge
                          tone={
                            l.bucket === "automated"
                              ? "verified"
                              : l.bucket === "assisted"
                                ? "alix"
                                : "neutral"
                          }
                        >
                          {l.bucket}
                        </Badge>
                      </div>
                      <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-ink-soft">
                        {l.basis}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tabular text-sm text-ink">
                        {hours(l.manualMinutes)} → {hours(l.residualMinutes)}
                      </p>
                      <p
                        className={`tabular text-[11px] ${pct > 0 ? "text-verified" : "text-ink-faint"}`}
                      >
                        {pct > 0 ? `−${pct}%` : "unchanged"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-sunk">
                    <div
                      className={pct > 0 ? "h-full bg-verified" : "h-full bg-ink-faint/30"}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </Card>
        </section>

        <section>
          <div className="flex items-baseline justify-between">
            <Label>
              <span className="flex items-center gap-1.5">
                <Mail size={12} /> Correspondence
              </span>
            </Label>
            <span className="text-[11px] text-ink-faint">
              {plan.ready} ready · about {hours(plan.minutesSaved)} of drafting replaced
            </span>
          </div>
          <p className="mt-1 mb-2 text-sm leading-relaxed text-ink-soft">
            Merged from verified facts, with enclosures computed from what each recipient requires.
            No model writes these — the wording is a reviewed template and the figures carry their
            sources, so the specialist checks rather than composes.
          </p>
          <div className="space-y-2">
            {plan.letters.map((l) => (
              <LetterCard key={l.templateId} letter={l} />
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-baseline justify-between">
            <Label>
              <span className="flex items-center gap-1.5">
                <UserCheck size={12} /> Entity resolution
              </span>
            </Label>
            <span className="text-[11px] text-ink-faint">
              {entitySummary.distinctAssets} distinct assets · {entitySummary.needingReview} need a
              human
            </span>
          </div>
          <p className="mt-1 mb-2 text-sm leading-relaxed text-ink-soft">
            The same account appears under different descriptions in different documents. Merging
            two loses one from the inventory; failing to merge double-counts the estate and can push
            it over a threshold it never crossed. So this proposes and never decides.
          </p>
          {proposals.length === 0 ? (
            <Card className="px-5 py-4">
              <p className="text-sm text-ink-soft">
                No candidate duplicates found across {entitySummary.distinctAssets} assets.
              </p>
            </Card>
          ) : (
            <Card className="divide-y divide-line-soft">
              {proposals.map((p, i) => (
                <ProposalRow key={i} p={p} />
              ))}
            </Card>
          )}
        </section>
      </div>
    </Pane>
  );
}
