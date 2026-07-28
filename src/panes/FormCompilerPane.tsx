import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, FileCheck2, Loader2, PenLine, Play, X } from "lucide-react";
import { Badge, Card, Label, Pane } from "../components/ui";
import { buildWorkOrder, type WorkOrder, type WorkOrderForm } from "../lib/workorder";
import type { EstateRecord } from "../lib/estate";
import { inTauri, invoke } from "../lib/tauri";

/**
 * The seam, on screen.
 *
 * The top half is Warrant's decision: which of the four forms this estate needs,
 * which it does not and why, in the words the rule pack used. The bottom half is
 * Forge's own review UI in an iframe, pointed at the same estate and the same
 * form.
 *
 * The point of putting them in one pane is that the connection is checkable
 * rather than asserted. The list is computed live, here, by the same
 * `buildWorkOrder` that wrote `forge/artifacts/workorders/<estateId>.json`; the
 * file Forge will actually read is loaded back off disk and compared against it.
 * If they disagree — someone edited the artifact, or the rules changed and
 * nobody re-emitted — the pane says so, loudly, instead of showing a tidy screen
 * built on a stale file.
 */

const FORGE_REVIEW_URL = "http://127.0.0.1:8078";

/** Forge's fixed registry, and what each form is called in English. */
const FORM_TITLES: Record<string, string> = {
  "irs-ss4": "SS-4 · Application for Employer Identification Number",
  "irs-f56": "56 · Notice Concerning Fiduciary Relationship",
  "irs-f8821": "8821 · Tax Information Authorization",
  "ca-dmv-dl142": "DL 142 · Notice of Release of Liability (California)",
};

interface ForgeStatus {
  root: string;
  binary: string;
  binary_exists: boolean;
  estates: string[];
}

interface FormArtifacts {
  form_id: string;
  approved_version: number | null;
  approved_path: string | null;
  has_draft: boolean;
  draft_path: string | null;
  fills: string[];
}

interface ForgeRun {
  argv: string[];
  cwd: string;
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  duration_ms: number;
}

type CompileState =
  | { kind: "approved"; version: number; path: string }
  | { kind: "draft"; path: string }
  | { kind: "none" };

function compileState(a: FormArtifacts | undefined): CompileState {
  if (!a) return { kind: "none" };
  if (a.approved_version !== null && a.approved_path)
    return { kind: "approved", version: a.approved_version, path: a.approved_path };
  if (a.has_draft && a.draft_path) return { kind: "draft", path: a.draft_path };
  return { kind: "none" };
}

/** Does the artifact Forge will read still say what Warrant says today? */
function sameDecision(live: WorkOrder, onDisk: WorkOrder | null): boolean {
  if (!onDisk) return false;
  const strip = (o: WorkOrder) =>
    JSON.stringify({
      estateId: o.estateId,
      jurisdiction: o.jurisdiction,
      route: o.route,
      forms: o.forms.map((f) => ({
        formId: f.formId,
        applicable: f.applicable,
        reason: f.reason,
        priority: f.priority,
      })),
    });
  return strip(live) === strip(onDisk);
}

export default function FormCompilerPane() {
  const [status, setStatus] = useState<ForgeStatus | null>(null);
  const [estateId, setEstateId] = useState<string>("estate-05-in-formal-probate");
  const [record, setRecord] = useState<EstateRecord | null>(null);
  const [onDisk, setOnDisk] = useState<WorkOrder | null>(null);
  const [artifacts, setArtifacts] = useState<FormArtifacts[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, ForgeRun | { failed: string }>>({});
  const [iframeForm, setIframeForm] = useState("irs-f56");

  // Warrant's decision, computed here and now from the rule pack — not read
  // back from the file it wrote earlier.
  const live = useMemo(() => (record ? buildWorkOrder(record) : null), [record]);

  useEffect(() => {
    if (!inTauri) return;
    invoke<ForgeStatus>("forge_status")
      .then((s) => {
        setStatus(s);
        if (!s.estates.includes(estateId) && s.estates.length) setEstateId(s.estates[0]);
      })
      .catch((e) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!inTauri) return;
    setError(null);
    try {
      const raw = await invoke<string>("forge_read_artifact", {
        relative: `inputs/estates/${estateId}.json`,
      });
      setRecord(JSON.parse(raw) as EstateRecord);
      try {
        const orderRaw = await invoke<string>("forge_read_artifact", {
          relative: `artifacts/workorders/${estateId}.json`,
        });
        setOnDisk(JSON.parse(orderRaw) as WorkOrder);
      } catch {
        setOnDisk(null); // no work order written yet — reported below, not hidden
      }
      setArtifacts(
        await invoke<FormArtifacts[]>("forge_artifacts", { formIds: Object.keys(FORM_TITLES) }),
      );
    } catch (e) {
      setError(String(e));
    }
  }, [estateId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function fill(form: WorkOrderForm, version: number) {
    const key = form.formId;
    setBusy(key);
    try {
      const run = await invoke<ForgeRun>("forge_fill", {
        form: form.formId,
        estate: estateId,
        bindingVersion: version,
      });
      setRuns((r) => ({ ...r, [key]: run }));
      setArtifacts(
        await invoke<FormArtifacts[]>("forge_artifacts", { formIds: Object.keys(FORM_TITLES) }),
      );
    } catch (e) {
      // A refusal from the Rust layer (bad subcommand, missing venv) is a
      // result too. It goes on screen next to the button that caused it.
      setRuns((r) => ({ ...r, [key]: { failed: String(e) } }));
    } finally {
      setBusy(null);
    }
  }

  if (!inTauri) {
    return (
      <Pane title="Form compiler" lede="Forge runs as a subprocess, which needs the desktop shell.">
        <Card className="p-6 text-sm text-ink-soft">
          Run <code className="font-mono text-xs">npm run tauri dev</code> — this pane invokes the
          Forge CLI and reads its artifacts through Rust.
        </Card>
      </Pane>
    );
  }

  const agrees = live ? sameDecision(live, onDisk) : false;

  return (
    <Pane
      title="Form compiler"
      lede="Warrant decides which forms this estate needs and why. Forge compiles each form once, a human approves it, and filling is then deterministic. Both halves are looking at the estate below."
      actions={
        <select
          value={estateId}
          onChange={(e) => setEstateId(e.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink"
        >
          {(status?.estates ?? [estateId]).map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      }
    >
      {error && (
        <Card tone="rejected" className="mb-4 p-4 text-sm">
          <span className="font-medium text-rejected">Forge is not reachable.</span>{" "}
          <span className="text-ink-soft">{error}</span>
        </Card>
      )}

      {live && (
        <Card tone="alix" className="mb-4 px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <Label>Estate</Label>
              <p className="mt-0.5 text-sm text-ink">{live.estateId}</p>
            </div>
            <div>
              <Label>Jurisdiction</Label>
              <p className="mt-0.5 text-sm text-ink">
                {live.jurisdiction.county}, {live.jurisdiction.state}
              </p>
            </div>
            <div>
              <Label>Route</Label>
              <p className="mt-0.5 text-sm text-ink">{live.route}</p>
            </div>
            <div>
              <Label>Work order Forge reads</Label>
              <p className="mt-0.5 font-mono text-[11px] text-ink-soft">
                forge/artifacts/workorders/{live.estateId}.json
              </p>
            </div>
            <div className="ml-auto">
              {agrees ? (
                <Badge tone="verified">
                  <Check size={11} /> file matches this decision
                </Badge>
              ) : (
                <Badge tone="rejected">
                  <AlertTriangle size={11} />
                  {onDisk ? "file disagrees — re-emit" : "no work order on disk"}
                </Badge>
              )}
            </div>
          </div>
          {onDisk && (
            <p className="mt-3 border-t border-alix-mid/20 pt-2 text-[11px] text-ink-faint">
              Decided by <span className="font-mono">{onDisk.generatedBy}</span> at{" "}
              <span className="font-mono">{onDisk.generatedAt}</span>. Re-emit with{" "}
              <code className="font-mono">npx vite-node tools/emit-workorders.ts</code>.
            </p>
          )}
        </Card>
      )}

      <div className="space-y-3">
        {live?.forms.map((form) => {
          const state = compileState(artifacts.find((a) => a.form_id === form.formId));
          const run = runs[form.formId];
          return (
            <Card key={form.formId} className="p-5" tone={form.applicable ? "plain" : "warn"}>
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-brand text-base text-ink">
                      {FORM_TITLES[form.formId] ?? form.formId}
                    </h3>
                    {form.applicable ? (
                      <Badge tone="verified">
                        <Check size={11} /> needed · file #{form.priority}
                      </Badge>
                    ) : (
                      <Badge tone="warn">not needed</Badge>
                    )}
                    {form.applicable && form.blastRadius && (
                      <Badge tone="neutral">
                        {form.blastRadius} blast radius · {form.reversibility}
                      </Badge>
                    )}
                  </div>

                  {form.reason && (
                    // Verbatim. A paraphrase here is a paraphrase of the reason
                    // a form was not filed, which is the sentence most likely to
                    // be read back to a court.
                    <p className="mt-2 max-w-3xl border-l-2 border-warn/40 pl-3 text-sm leading-relaxed text-ink-soft">
                      {form.reason}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
                    {state.kind === "approved" && (
                      <>
                        <Badge tone="verified">
                          <FileCheck2 size={11} /> approved v{state.version}
                        </Badge>
                        <span className="font-mono">{state.path.split("/artifacts/")[1]}</span>
                      </>
                    )}
                    {state.kind === "draft" && (
                      <>
                        <Badge tone="warn">
                          <PenLine size={11} /> draft — awaiting a human
                        </Badge>
                        <span className="font-mono">{state.path.split("/artifacts/")[1]}</span>
                      </>
                    )}
                    {state.kind === "none" && <Badge tone="neutral">not compiled</Badge>}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {form.applicable && state.kind === "approved" ? (
                    <button
                      onClick={() => void fill(form, state.version)}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-alix-deep px-3 py-1.5 text-sm text-white disabled:opacity-50"
                    >
                      {busy === form.formId ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Play size={13} />
                      )}
                      Fill
                    </button>
                  ) : (
                    <p className="text-[11px] text-ink-faint">
                      {!form.applicable
                        ? "nothing to fill"
                        : state.kind === "draft"
                          ? "approve the binding first"
                          : "compile the form first"}
                    </p>
                  )}
                  <button
                    onClick={() => setIframeForm(form.formId)}
                    className="mt-2 block w-full text-[11px] text-alix-deep underline underline-offset-2"
                  >
                    open in review ↓
                  </button>
                </div>
              </div>

              {run && (
                <div className="mt-4 border-t border-line pt-3">
                  {"failed" in run ? (
                    <p className="flex items-start gap-2 text-sm text-rejected">
                      <X size={14} className="mt-0.5 shrink-0" />
                      <span>{run.failed}</span>
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        {run.ok ? (
                          <Badge tone="verified">exit 0 · {run.duration_ms} ms</Badge>
                        ) : (
                          <Badge tone="rejected">
                            <X size={11} /> exit {run.code ?? "signal"} · {run.duration_ms} ms
                          </Badge>
                        )}
                        <span className="truncate font-mono text-[10px] text-ink-faint">
                          {run.argv.join(" ")}
                        </span>
                      </div>
                      {/* stdout and stderr both, always. A form filler that
                          fails quietly is worse than one that does not run. */}
                      {run.stdout.trim() && (
                        <pre className="mt-2 overflow-x-auto rounded-lg bg-sunk p-3 font-mono text-[11px] leading-relaxed text-ink-soft">
                          {run.stdout.trim()}
                        </pre>
                      )}
                      {run.stderr.trim() && (
                        <pre className="mt-2 overflow-x-auto rounded-lg bg-rejected-soft p-3 font-mono text-[11px] leading-relaxed text-rejected">
                          {run.stderr.trim()}
                        </pre>
                      )}
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-baseline justify-between">
          <Label>Forge review UI · {iframeForm} · {estateId}</Label>
          <span className="font-mono text-[10px] text-ink-faint">
            {status?.binary_exists ? status.binary : "forge/.venv/bin/forge missing"}
          </span>
        </div>
        <Card className="overflow-hidden p-0">
          <iframe
            key={`${iframeForm}-${estateId}`}
            title="Forge review"
            src={`${FORGE_REVIEW_URL}/?form=${iframeForm}&estate=${estateId}`}
            className="h-[760px] w-full border-0"
          />
        </Card>
        <p className="mt-2 text-[11px] text-ink-faint">
          Served by <code className="font-mono">forge review --port 8078</code>. If this is blank,
          the server is not running — it is a separate process, by design.
        </p>
      </div>
    </Pane>
  );
}
