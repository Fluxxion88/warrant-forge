import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CloudUpload,
  Download,
  FileSignature,
  KeyRound,
  Link2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Badge, Card, Label, Pane } from "../components/ui";
import {
  aliasIds,
  buildFill,
  parseFieldInfo,
  reconcile,
  type Reconciliation,
} from "../lib/anvil";
import { CA_FORMS } from "../rules/ca-forms";
import { FEDERAL_FORMS } from "../rules/federal-forms";
import { ESTATE, type EstateRun } from "../lib/session";
import { inTauri, invoke } from "../lib/tauri";

const ALL_FORMS = [...CA_FORMS, ...FEDERAL_FORMS];

interface AnvilStatus {
  has_key: boolean;
  templates: Record<string, string>;
  packets: Record<string, { packet_eid: string; document_group_eid: string; signer_eid: string; status: string }>;
}

export default function AnvilPane({ run }: { run: EstateRun }) {
  const [status, setStatus] = useState<AnvilStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<{ form: string; text: string; ok: boolean }[]>([]);
  const [recon, setRecon] = useState<Record<string, Reconciliation>>({});

  async function refresh() {
    if (!inTauri) return;
    try {
      setStatus(await invoke<AnvilStatus>("anvil_status"));
    } catch {
      /* not fatal — the pane still explains itself */
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function note(form: string, text: string, ok = true) {
    setLog((l) => [{ form, text, ok }, ...l].slice(0, 12));
  }

  async function saveKey() {
    setBusy("key");
    try {
      await invoke("anvil_save", { apiKey });
      setApiKey("");
      await refresh();
      note("account", "API key stored in Rust. The interface never receives it.");
    } catch (e) {
      note("account", String(e), false);
    } finally {
      setBusy(null);
    }
  }

  async function registerForm(code: string) {
    const form = ALL_FORMS.find((f) => f.code === code)!;
    setBusy(code);
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const path = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
        title: `Select the ${code} PDF`,
      });
      if (typeof path !== "string") {
        setBusy(null);
        return;
      }
      const res = await invoke<{ cast_eid: string; field_info: unknown }>("anvil_register_form", {
        formCode: code,
        title: form.title,
        pdfPath: path,
        aliasIds: aliasIds(form),
        advancedDetect: true,
      });
      setRecon((r) => ({ ...r, [code]: reconcile(form, parseFieldInfo(res.field_info)) }));
      await refresh();
      note(code, `Registered and published as ${res.cast_eid}`);
    } catch (e) {
      note(code, String(e), false);
    } finally {
      setBusy(null);
    }
  }

  async function reconcileForm(code: string) {
    const form = ALL_FORMS.find((f) => f.code === code)!;
    setBusy(code);
    try {
      const info = await invoke<unknown>("anvil_cast_fields", { formCode: code });
      const r = reconcile(form, parseFieldInfo(info));
      setRecon((x) => ({ ...x, [code]: r }));
      note(
        code,
        r.ok
          ? `All ${r.matched.length} bound fields exist on the template.`
          : `${r.missingInAnvil.length} bound field(s) are absent from the template — they would be silently dropped.`,
        r.ok,
      );
    } catch (e) {
      note(code, String(e), false);
    } finally {
      setBusy(null);
    }
  }

  async function fillForm(code: string) {
    const form = ALL_FORMS.find((f) => f.code === code)!;
    const fill = buildFill(form, run.facts);
    setBusy(code);
    try {
      const out = await invoke<{ path: string }>("anvil_fill", {
        formCode: code,
        title: `${code} — ${ESTATE.decedent}`,
        data: fill.payload,
      });
      note(code, `Filled → ${out.path}`);
    } catch (e) {
      note(code, String(e), false);
    } finally {
      setBusy(null);
    }
  }

  async function signForm(code: string) {
    const form = ALL_FORMS.find((f) => f.code === code)!;
    const fill = buildFill(form, run.facts);
    setBusy(code);
    try {
      const packet = await invoke<{ signer_eid: string; packet_eid: string }>(
        "anvil_create_signature_packet",
        {
          formCode: code,
          packetName: `${code} — ${ESTATE.decedent}`,
          data: fill.payload,
          signerName: ESTATE.executor,
          signerEmail: "executor@example.com",
          isTest: true,
        },
      );
      const url = await invoke<string>("anvil_sign_url", {
        signerEid: packet.signer_eid,
        clientUserId: "warrant-executor",
      });
      await refresh();
      note(code, `Signature packet created. Signing URL: ${url}`);
    } catch (e) {
      note(code, String(e), false);
    } finally {
      setBusy(null);
    }
  }

  async function downloadSigned(code: string) {
    setBusy(code);
    try {
      const out = await invoke<{ path: string }>("anvil_download_signed", { formCode: code });
      note(code, `Signed set → ${out.path}`);
    } catch (e) {
      note(code, String(e), false);
    } finally {
      setBusy(null);
    }
  }

  const connected = status?.has_key ?? false;

  return (
    <Pane
      title="Anvil"
      lede="Register a court form once and it is fillable and signable forever. Anvil's field detection is handed our own binding aliases, so a newly uploaded PDF arrives keyed the way the rest of the system already expects."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <Card tone={connected ? "verified" : "warn"} className="px-5 py-4">
          <div className="flex items-start gap-3">
            <KeyRound size={17} className={`mt-0.5 shrink-0 ${connected ? "text-verified" : "text-warn"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">
                {connected ? "Anvil connected" : "No Anvil API key stored"}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                The key is written to an owner-only file in the OS config directory by Rust and is
                never returned to the interface — the same discipline as the model provider keys.
              </p>
              {!inTauri && (
                <p className="mt-1 text-xs text-warn">Runs in the desktop app only.</p>
              )}
              <div className="mt-3 flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Anvil API key"
                  className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-alix-mid"
                />
                <button
                  disabled={!inTauri || !apiKey || busy === "key"}
                  onClick={saveKey}
                  className="rounded-lg bg-alix-deep px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-alix-dark disabled:bg-ink-faint/30 disabled:text-ink-faint"
                >
                  {busy === "key" ? <Loader2 size={14} className="animate-spin" /> : "Store"}
                </button>
              </div>
            </div>
          </div>
        </Card>

        <section>
          <Label>Form templates</Label>
          <div className="mt-2 space-y-3">
            {ALL_FORMS.map((form) => {
              const castEid = status?.templates?.[form.code];
              const packet = status?.packets?.[form.code];
              const r = recon[form.code];
              const fill = buildFill(form, run.facts);
              const working = busy === form.code;

              return (
                <Card key={form.code} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-brand text-lg text-ink">{form.code}</h3>
                        {castEid ? (
                          <Badge tone="verified">
                            <Check size={10} /> registered
                          </Badge>
                        ) : (
                          <Badge tone="neutral">not registered</Badge>
                        )}
                        {r && !r.ok && (
                          <Badge tone="rejected">
                            <AlertTriangle size={10} /> {r.missingInAnvil.length} field
                            {r.missingInAnvil.length === 1 ? "" : "s"} missing
                          </Badge>
                        )}
                        {packet && <Badge tone="alix">{packet.status}</Badge>}
                      </div>
                      <p className="mt-0.5 text-sm text-ink-soft">{form.title}</p>
                      <p className="mt-1 text-[11px] text-ink-faint">
                        {form.fields.length} bound fields ·{" "}
                        {fill.complete ? (
                          <span className="text-verified">all resolved from verified facts</span>
                        ) : (
                          <span className="text-warn">
                            {fill.missingRequired.length} unsubstantiated — fill is blocked
                          </span>
                        )}
                        {castEid && <> · cast {castEid}</>}
                      </p>
                    </div>
                  </div>

                  {r && (
                    <div className="mt-3 rounded-lg bg-sunk px-4 py-3 text-xs">
                      <p className="text-ink-soft">
                        <span className="font-medium text-ink">{r.matched.length}</span> matched
                        {r.missingInAnvil.length > 0 && (
                          <>
                            {" · "}
                            <span className="font-medium text-rejected">
                              {r.missingInAnvil.join(", ")}
                            </span>{" "}
                            absent from the template
                          </>
                        )}
                        {r.unboundInAnvil.length > 0 && (
                          <>
                            {" · "}
                            {r.unboundInAnvil.length} template field(s) nobody binds
                          </>
                        )}
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line-soft pt-3">
                    <Action
                      icon={CloudUpload}
                      label={castEid ? "Re-register" : "Register PDF"}
                      onClick={() => registerForm(form.code)}
                      disabled={!inTauri || !connected || working}
                      busy={working}
                    />
                    <Action
                      icon={RefreshCw}
                      label="Reconcile fields"
                      onClick={() => reconcileForm(form.code)}
                      disabled={!inTauri || !castEid || working}
                      busy={working}
                    />
                    <Action
                      icon={Download}
                      label="Fill"
                      onClick={() => fillForm(form.code)}
                      disabled={!inTauri || !castEid || !fill.complete || working}
                      busy={working}
                      title={!fill.complete ? "Cannot fill a form with unsubstantiated fields" : undefined}
                    />
                    <Action
                      icon={FileSignature}
                      label="Send for signature"
                      onClick={() => signForm(form.code)}
                      disabled={!inTauri || !castEid || !fill.complete || working}
                      busy={working}
                    />
                    <Action
                      icon={Link2}
                      label="Download signed"
                      onClick={() => downloadSigned(form.code)}
                      disabled={!inTauri || !packet || working}
                      busy={working}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {log.length > 0 && (
          <section>
            <Label>Activity</Label>
            <Card className="mt-2 divide-y divide-line-soft">
              {log.map((l, i) => (
                <div key={i} className="px-5 py-2.5">
                  <p className={`text-xs ${l.ok ? "text-ink-soft" : "text-rejected"}`}>
                    <span className="font-mono font-medium text-ink">{l.form}</span> — {l.text}
                  </p>
                </div>
              ))}
            </Card>
          </section>
        )}

        <Card className="px-5 py-4">
          <Label>Why registration hands over our own aliases</Label>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Anvil's fill endpoint drops a value written to a field alias the template does not have.
            You get back a PDF that looks fine with an empty box in the middle of it — on a probate
            petition, a rejected filing and another month of the family's life. So registration
            passes our binding aliases to Anvil's detection, and <em>Reconcile fields</em> reads the
            template back and compares. Drift is caught before anyone files, not after.
          </p>
        </Card>
      </div>
    </Pane>
  );
}

function Action({
  icon: Icon,
  label,
  onClick,
  disabled,
  busy,
  title,
}: {
  icon: typeof Check;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-sunk disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-surface"
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
      {label}
    </button>
  );
}
