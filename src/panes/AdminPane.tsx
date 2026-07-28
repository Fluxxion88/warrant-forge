import { AlertTriangle, CalendarClock, CircleDashed, Lock, TriangleAlert } from "lucide-react";
import { Badge, Card, Cite, Label, Pane } from "../components/ui";
import { tasksByPhase, type Deadline, type Task } from "../lib/tasks";
import type { EstateRun } from "../lib/session";

const AUTHORITY_LABELS: Record<string, string> = {
  letters_testamentary: "Certified Letters",
  death_certificate: "Death certificate",
  form_56: "Form 56",
  estate_ein: "Estate EIN",
  court_order: "Court order",
  apostille: "Apostille",
  certified_translation: "Certified translation",
  local_counsel: "Local counsel",
};

function DeadlineRow({ d }: { d: Deadline }) {
  const tone =
    d.status === "overdue"
      ? "rejected"
      : d.status === "due_soon"
        ? "warn"
        : d.status === "unknown"
          ? "neutral"
          : "verified";

  return (
    <div className="px-5 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{d.label}</p>
          <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-ink-soft">{d.consequence}</p>
          <p className="mt-1">
            <Cite>{d.authority.citation}</Cite>
          </p>
          {d.status === "unknown" && d.missingAnchors.length > 0 && (
            <p className="mt-1 text-xs text-warn">
              Cannot be computed — missing{" "}
              <span className="font-mono">{d.missingAnchors.join(", ")}</span>
            </p>
          )}
          {d.governedBy && (
            <p className="mt-1 text-[11px] text-ink-faint">
              Governed by <span className="font-mono">{d.governedBy}</span> — the later of the two
              periods
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <Badge tone={tone as never}>{d.status.replace("_", " ")}</Badge>
          {d.dueIso && (
            <p className="tabular mt-1 text-sm text-ink">{d.dueIso}</p>
          )}
          {d.daysRemaining !== undefined && (
            <p className="tabular text-[11px] text-ink-soft">
              {d.daysRemaining < 0
                ? `${Math.abs(d.daysRemaining)} days ago`
                : `${d.daysRemaining} days`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  if (task.status === "not_applicable") return null;
  const blocked = task.status === "blocked";

  return (
    <div className={`px-5 py-3 ${blocked ? "" : "bg-verified-soft/30"}`}>
      <div className="flex items-start gap-3">
        {blocked ? (
          <CircleDashed size={15} className="mt-0.5 shrink-0 text-ink-faint" />
        ) : (
          <div className="mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-verified" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-ink">{task.title}</p>
            {task.form && <Badge tone="alix">Form {task.form}</Badge>}
            {blocked && <Badge tone="neutral">blocked</Badge>}
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">{task.guidance}</p>

          {task.caution && (
            <p className="mt-2 flex gap-2 rounded-lg bg-warn-soft px-3 py-2 text-xs leading-relaxed text-ink-soft">
              <TriangleAlert size={13} className="mt-0.5 shrink-0 text-warn" />
              {task.caution}
            </p>
          )}

          {task.requiresAuthority.length > 0 && (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
              <Lock size={10} />
              {task.requiresAuthority.map((d) => (
                <span key={d} className="rounded bg-sunk px-1.5 py-0.5">
                  {AUTHORITY_LABELS[d] ?? d}
                </span>
              ))}
            </p>
          )}

          {blocked && (
            <p className="mt-1 text-[11px] text-ink-faint">
              Waiting on: {task.blockedBy.map((b) => b.replace("task.", "")).join(", ")}
            </p>
          )}

          {task.authority && (
            <p className="mt-1">
              <Cite>{task.authority.citation}</Cite>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminPane({ run }: { run: EstateRun }) {
  const phases = tasksByPhase(run.tasks);
  const overdue = run.deadlines.filter((d) => d.status === "overdue");
  const unknown = run.deadlines.filter((d) => d.status === "unknown");

  return (
    <Pane
      title="Administration"
      lede="Deciding the procedure is one job; running the estate is another. Deadlines run from dates the ledger already holds, and a deadline whose anchor is missing reports as unknown rather than assuming today."
    >
      <div className="mx-auto max-w-4xl space-y-7">
        {(overdue.length > 0 || unknown.length > 0) && (
          <Card tone="warn" className="px-5 py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={17} className="mt-0.5 shrink-0 text-warn" />
              <p className="text-sm leading-relaxed text-ink-soft">
                {overdue.length > 0 && (
                  <>
                    <strong className="text-ink">{overdue.length} deadline(s) already passed.</strong>{" "}
                  </>
                )}
                {unknown.length > 0 && (
                  <>
                    {unknown.length} cannot be computed because the estate has not yet obtained
                    Letters — the date most statutory periods run from.
                  </>
                )}
              </p>
            </div>
          </Card>
        )}

        <section>
          <Label>
            <span className="flex items-center gap-1.5">
              <CalendarClock size={12} /> Statutory deadlines
            </span>
          </Label>
          <Card className="mt-2 divide-y divide-line-soft">
            {run.deadlines.map((d) => (
              <DeadlineRow key={d.id} d={d} />
            ))}
          </Card>
        </section>

        {phases.map((p) => {
          const visible = p.tasks.filter((t) => t.status !== "not_applicable");
          if (visible.length === 0) return null;
          const ready = visible.filter((t) => t.status === "ready").length;
          return (
            <section key={p.phase}>
              <div className="flex items-baseline justify-between">
                <Label>{p.label}</Label>
                <span className="text-[11px] text-ink-faint">
                  {ready} of {visible.length} actionable now
                </span>
              </div>
              <Card className="mt-2 divide-y divide-line-soft">
                {visible.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </Card>
            </section>
          );
        })}
      </div>
    </Pane>
  );
}
