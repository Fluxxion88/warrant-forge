import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Cpu,
  History,
  KeyRound,
  Loader2,
  Play,
  Quote,
  ShieldAlert,
} from "lucide-react";
import { Badge, Card, Label, Pane } from "../components/ui";
import { PROVIDER_META, type ProviderKind } from "../lib/catalog";
import { chooseExtractor, estimateCost, runLiveExtraction, type LiveExtractionResult } from "../lib/extractRun";
import { fromExtractedFacts, recordedRun, type EstateRun } from "../lib/session";
import { RECORDED_SUMMARY } from "../fixtures/recorded";
import { inTauri, invoke, money, type ProviderPublic } from "../lib/tauri";

const KINDS: ProviderKind[] = ["anthropic", "openai", "google", "deepseek", "moonshot"];

export default function ExtractionPane({
  run,
  onAdopt,
}: {
  run: EstateRun;
  onAdopt: (next: EstateRun) => void;
}) {
  const [providers, setProviders] = useState<ProviderPublic[]>([]);
  const [kind, setKind] = useState<ProviderKind>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; doc: string } | null>(null);
  const [result, setResult] = useState<LiveExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!inTauri) return;
    try {
      setProviders(await invoke<ProviderPublic[]>("providers_list"));
    } catch {
      /* pane still explains itself without the shell */
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const choice = chooseExtractor(providers);
  const estimate = choice ? estimateCost(run.docs, choice.model) : null;

  async function connect() {
    setSaving(true);
    setError(null);
    try {
      await invoke("providers_save", {
        id: kind,
        kind,
        label: PROVIDER_META[kind].label,
        baseUrl: null,
        apiKey,
        enabled: true,
      });
      setApiKey("");
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function test(id: string, modelId: string) {
    setError(null);
    try {
      const reply = await invoke<string>("provider_test", { providerId: id, model: modelId });
      setError(`Test reply: ${reply}`);
    } catch (e) {
      setError(String(e));
    }
  }

  async function extract() {
    if (!choice) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await runLiveExtraction(run.docs, choice, {
        budgetUsd: 5,
        onProgress: (done, total, doc) => setProgress({ done, total, doc }),
      });
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function adopt() {
    if (!result) return;
    onAdopt(fromExtractedFacts(result.facts, run.docs, run.county));
  }

  function download() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result.recorded, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "recorded-extraction.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Pane
      title="Extraction"
      lede="The only place a model is asked to do anything — and it is asked to do one thing: turn prose into candidate facts, each with the verbatim sentence it relied on. It is never asked to add anything up, decide anything, or judge whether its own quotation is real."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {!inTauri && (
          <Card tone="warn" className="px-5 py-4">
            <p className="text-sm text-ink-soft">
              Live extraction runs in the desktop app, where provider keys are held by Rust.
            </p>
          </Card>
        )}

        {/*
          A real run, frozen and replayable. This is the honest way to show
          extraction without betting a three-minute slot on someone else's
          network: the candidates below are exactly what a model proposed, and
          they go through the same verifier a live call would.
        */}
        <Card className="px-5 py-4">
          <Label>Recorded run</Label>
          <p className="mt-1.5 text-sm text-ink-soft">
            {RECORDED_SUMMARY.candidates} facts proposed by {RECORDED_SUMMARY.model} over{" "}
            {RECORDED_SUMMARY.documents} documents on{" "}
            {RECORDED_SUMMARY.recordedAt.slice(0, 10)}, with{" "}
            {RECORDED_SUMMARY.parseErrors} malformed blocks. Replaying re-verifies every
            quotation rather than trusting the recording.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">
            Note what changes: the recorded run has nothing quarantined, because the model
            quoted accurately every time. The estate you started on carries a fabricated
            policy that verification rejects. Both are true, and they show different halves
            of the argument.
          </p>
          <button
            onClick={() => onAdopt(recordedRun(run.county))}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-alix-mid/40 bg-surface px-4 py-2 text-sm font-medium text-alix-dark hover:bg-alix/15"
          >
            <History size={14} /> Replay the recorded run
          </button>
        </Card>

        <section>
          <Label>
            <span className="flex items-center gap-1.5">
              <KeyRound size={12} /> Providers
            </span>
          </Label>
          <Card className="mt-2 px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => {
                const p = providers.find((x) => x.kind === k);
                return (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                      kind === k ? "border-alix-mid bg-alix/20 text-ink" : "border-line text-ink-soft hover:bg-sunk"
                    }`}
                  >
                    {PROVIDER_META[k].label}
                    {p?.has_key && <span className="ml-1.5 text-verified">✓</span>}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`${PROVIDER_META[kind].label} key — ${PROVIDER_META[kind].keyHint}`}
                className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-alix-mid"
              />
              <button
                disabled={!inTauri || !apiKey || saving}
                onClick={connect}
                className="rounded-lg bg-alix-deep px-4 py-2 text-sm font-medium text-white hover:bg-alix-dark disabled:bg-ink-faint/30 disabled:text-ink-faint"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : "Connect"}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
              Keys are written to an owner-only file by Rust and never returned to this interface —
              it only ever learns whether a key exists.
            </p>

            {choice && (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-sunk px-4 py-2.5">
                <p className="text-xs text-ink-soft">
                  <Cpu size={11} className="mr-1.5 inline text-alix-deep" />
                  Extractor: <span className="font-medium text-ink">{choice.model.label}</span> —
                  chosen for faithful long-context reading and structured output, not deep reasoning
                </p>
                <button
                  onClick={() => test(choice.providerId, choice.model.id)}
                  className="shrink-0 text-xs font-medium text-alix-deep underline underline-offset-2"
                >
                  Test
                </button>
              </div>
            )}
          </Card>
        </section>

        <section>
          <div className="flex items-baseline justify-between">
            <Label>Run</Label>
            {estimate && (
              <span className="tabular text-[11px] text-ink-faint">
                {run.docs.length} documents · about {estimate.tokens.toLocaleString("en-US")} tokens ·{" "}
                {money(estimate.usd)} estimated
              </span>
            )}
          </div>
          <Card className="mt-2 px-5 py-4">
            <button
              disabled={!inTauri || !choice || busy}
              onClick={extract}
              className="inline-flex items-center gap-2 rounded-lg bg-alix-deep px-4 py-2.5 text-sm font-medium text-white hover:bg-alix-dark disabled:bg-ink-faint/30 disabled:text-ink-faint"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              {busy ? "Extracting…" : "Run extraction on the data room"}
            </button>

            {progress && (
              <div className="mt-3">
                <p className="text-xs text-ink-soft">
                  {progress.done} of {progress.total} — {progress.doc}
                </p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-sunk">
                  <div
                    className="h-full bg-alix-deep transition-all"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-lg bg-rejected-soft px-3 py-2 font-mono text-xs text-rejected">
                {error}
              </p>
            )}

            <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
              One call per document rather than one for the whole room: a smaller fenced prompt is
              quoted more accurately, and a failure costs one document instead of the run. The spend
              cap aborts at $5.
            </p>
          </Card>
        </section>

        {result && (
          <>
            <div className="grid grid-cols-4 gap-3">
              <Card tone="verified" className="px-4 py-3">
                <p className="tabular font-brand text-2xl text-ink">{result.verified}</p>
                <p className="mt-0.5 text-[11px] text-ink-soft">Verified</p>
              </Card>
              <Card tone={result.quarantined ? "rejected" : "plain"} className="px-4 py-3">
                <p className="tabular font-brand text-2xl text-ink">{result.quarantined}</p>
                <p className="mt-0.5 text-[11px] text-ink-soft">Quarantined</p>
              </Card>
              <Card tone="warn" className="px-4 py-3">
                <p className="tabular font-brand text-2xl text-ink">{result.run.errors.length}</p>
                <p className="mt-0.5 text-[11px] text-ink-soft">Malformed blocks</p>
              </Card>
              <Card tone="alix" className="px-4 py-3">
                <p className="tabular font-brand text-2xl text-ink">{money(result.costUsd)}</p>
                <p className="mt-0.5 text-[11px] text-ink-soft">Actual cost</p>
              </Card>
            </div>

            {result.quarantined > 0 && (
              <Card tone="rejected" className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <Ban size={17} className="mt-0.5 shrink-0 text-rejected" />
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {result.quarantined} claim(s) could not be substantiated
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                      The model asserted these, but the quotation it gave does not appear in any
                      document we hold. They are visible in the fact ledger and structurally unable
                      to reach a decision.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {result.injection.length > 0 && (
              <Card tone="rejected" className="px-5 py-4">
                <p className="flex items-center gap-2 text-sm font-medium text-ink">
                  <ShieldAlert size={15} className="text-rejected" />
                  {result.injection.length} instruction-shaped passage(s) found in the data room
                </p>
                {result.injection.slice(0, 3).map((h, i) => (
                  <p key={i} className="mt-1.5 font-mono text-[11px] text-ink-soft">
                    {h.document}:{h.line} — {h.pattern}
                  </p>
                ))}
              </Card>
            )}

            <section>
              <Label>Per document</Label>
              <Card className="mt-2 divide-y divide-line-soft">
                {result.run.perDocument.map((d) => (
                  <div key={d.document} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm text-ink">{d.document}</p>
                        <p className="mt-0.5 text-[11px] text-ink-faint">
                          {d.inputTokens.toLocaleString("en-US")} in ·{" "}
                          {d.outputTokens.toLocaleString("en-US")} out · {d.ms} ms
                        </p>
                      </div>
                      <div className="shrink-0">
                        {d.failure ? (
                          <Badge tone="rejected">
                            <AlertTriangle size={10} /> failed
                          </Badge>
                        ) : (
                          <Badge tone="verified">
                            <Quote size={10} /> {d.candidates.length} facts
                          </Badge>
                        )}
                      </div>
                    </div>
                    {d.failure && (
                      <p className="mt-1 font-mono text-[11px] text-rejected">{d.failure}</p>
                    )}
                    {d.errors.map((e, i) => (
                      <p key={i} className="mt-1 text-[11px] text-warn">
                        rejected block — {e.reason}
                      </p>
                    ))}
                  </div>
                ))}
              </Card>
            </section>

            <Card tone="alix" className="px-5 py-4">
              <p className="text-sm font-medium text-ink">Use this run</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                Adopting replaces the estate's facts with these and re-decides. Downloading freezes
                the run so a demonstration replays it rather than re-calling — which is the right
                way to demo, because a live API call in a three-minute slot is a coin flip on
                someone else's network.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={adopt}
                  disabled={result.verified === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-alix-deep px-4 py-2 text-sm font-medium text-white hover:bg-alix-dark disabled:bg-ink-faint/30"
                >
                  <CheckCircle2 size={14} /> Adopt these facts
                </button>
                <button
                  onClick={download}
                  className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-sunk"
                >
                  Download recording
                </button>
              </div>
            </Card>
          </>
        )}
      </div>
    </Pane>
  );
}
