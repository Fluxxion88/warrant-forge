import { useMemo, useState } from "react";
import { AlertCircle, Check, Download, FileWarning, Loader2 } from "lucide-react";
import { Badge, Card, Cite, Label, Pane } from "../components/ui";
import { buildFill, fillSummary, type FormFill } from "../lib/anvil";
import { CA_FORMS, FORM_OBTAIN_HINTS, formByCode } from "../rules/ca-forms";
import { FEDERAL_FORMS, FEDERAL_OBTAIN_HINTS } from "../rules/federal-forms";
import { ESTATE, type EstateRun } from "../lib/session";
import { inTauri, invoke } from "../lib/tauri";

const ALL_FORMS = [...CA_FORMS, ...FEDERAL_FORMS];
const ALL_HINTS: Record<string, string> = { ...FORM_OBTAIN_HINTS, ...FEDERAL_OBTAIN_HINTS };

const byCode = (code: string) =>
  formByCode(code) ?? FEDERAL_FORMS.find((f) => f.code === code);

/**
 * Forms this estate needs. Court forms come from the rules engine's decisions;
 * federal forms come from the administration task graph, because obtaining an
 * EIN or a transcript is a step in running the estate rather than a conclusion
 * about which procedure applies.
 */
function requiredCodes(run: EstateRun): string[] {
  const codes = new Set<string>();
  for (const d of run.decisions) {
    for (const f of d.chosen?.rule.then.forms ?? []) {
      if (f.code !== "—") codes.add(f.code);
    }
  }
  for (const t of run.tasks) {
    if (t.form && t.status !== "not_applicable") codes.add(t.form);
  }
  return ALL_FORMS.filter((f) => codes.has(f.code)).map((f) => f.code);
}

/**
 * Forms the rules say are required and for which we hold no template.
 *
 * `requiredCodes` filters to what we can fill, which silently discarded twelve
 * of the nineteen codes the engine actually demands — including DE-315, which
 * the Estate pane badges by name and which then vanished here without trace. A
 * form we have not modelled has to look unmodelled. Anything else lets a gap in
 * our coverage read as a completed checklist, which is the one impression this
 * product must never give.
 */
function unmodelledCodes(run: EstateRun): { code: string; because: string }[] {
  const have = new Set(ALL_FORMS.map((f) => f.code));
  const out = new Map<string, string>();

  for (const d of run.decisions) {
    for (const f of d.chosen?.rule.then.forms ?? []) {
      if (f.code === "—" || have.has(f.code)) continue;
      out.set(f.code, `${f.title} — required by ${d.decisionPoint}`);
    }
  }
  for (const t of run.tasks) {
    if (!t.form || have.has(t.form) || t.status === "not_applicable") continue;
    if (!out.has(t.form)) out.set(t.form, t.title);
  }
  return [...out].map(([code, because]) => ({ code, because }));
}

function FieldRow({ field }: { field: FormFill["fields"][number] }) {
  const [open, setOpen] = useState(false);
  const missing = field.status === "missing";
  const hints = (field.needs ?? []).map((n) => ALL_HINTS[n]).filter(Boolean);

  return (
    <div className={`px-5 py-2.5 ${missing ? "bg-warn-soft/60" : ""}`}>
      <button
        onClick={() => field.provenance && setOpen((o) => !o)}
        className="flex w-full items-baseline gap-3 text-left"
      >
        {field.item && (
          <span className="w-12 shrink-0 font-mono text-[10px] text-ink-faint">{field.item}</span>
        )}
        <span className="min-w-0 flex-1 text-sm text-ink-soft">{field.label}</span>
        {missing ? (
          <Badge tone="warn">
            <AlertCircle size={10} /> not known
          </Badge>
        ) : (
          <span className="tabular shrink-0 text-sm font-medium text-ink">{field.value}</span>
        )}
        {field.status === "filled" && <Check size={13} className="shrink-0 text-verified" />}
      </button>

      {missing && field.needs?.length ? (
        <p className="mt-1 pl-14 text-xs text-warn">
          Needs <span className="font-mono">{field.needs.join(", ")}</span>
          {hints.length > 0 && <> — {hints.join("; ")}</>}
        </p>
      ) : null}

      {open && field.provenance && (
        <div className="mt-2 ml-14 rounded-lg bg-sunk px-3 py-2">
          <blockquote className="border-l-2 border-alix-mid pl-3 font-brand text-[13px] italic leading-relaxed text-ink">
            “{field.provenance.quote}”
          </blockquote>
          <p className="mt-1 text-[11px] text-ink-faint">
            {field.provenance.document} · <span className="font-mono">{field.provenance.factKey}</span>
          </p>
        </div>
      )}
    </div>
  );
}

export default function FormsPane({ run }: { run: EstateRun }) {
  const codes = requiredCodes(run);
  const unmodelled = useMemo(() => unmodelledCodes(run), [run]);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, string>>({});

  const fills = useMemo(
    () =>
      codes
        .map((c) => byCode(c))
        .filter(Boolean)
        .map((f) => buildFill(f!, run.facts)),
    [codes, run.facts],
  );

  async function fill(f: FormFill) {
    setBusy(f.form.code);
    try {
      const out = await invoke<{ path: string }>("anvil_fill", {
        formCode: f.form.code,
        title: `${f.form.code} — ${ESTATE.decedent}`,
        data: f.payload,
      });
      setResult((r) => ({ ...r, [f.form.code]: out.path }));
    } catch (e) {
      setResult((r) => ({ ...r, [f.form.code]: `Error: ${String(e)}` }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Pane
      title="Forms"
      lede="The engine decides which forms this estate needs — court forms from the probate decision, federal forms from the administration graph. Anvil fills them, but only from facts carrying a verified quotation. A box we cannot substantiate is left empty and reported, never guessed."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {fills.length === 0 && (
          <Card className="px-5 py-4">
            <p className="text-sm text-ink-soft">
              No forms are required yet — no decision point has reached a conclusion.
            </p>
          </Card>
        )}

        {fills.map((f) => (
          <section key={f.form.code}>
            <Card tone={f.complete ? "plain" : "warn"} className="overflow-hidden">
              <div className="flex items-start justify-between gap-4 border-b border-line-soft px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-brand text-lg text-ink">{f.form.code}</h2>
                    {f.complete ? (
                      // Deliberately NOT "ready to file". `complete` means every
                      // field *we bound* resolved from a verified fact — and for
                      // DE-111 that is ten bindings against a multi-page court
                      // petition. Badging that as filable claims a completeness
                      // check nobody has performed, on the one screen whose whole
                      // argument is that claims must be substantiated.
                      <Badge tone="verified">
                        <Check size={10} /> all bound fields resolved
                      </Badge>
                    ) : (
                      <Badge tone="warn">
                        <FileWarning size={10} /> {f.missingRequired.length} field
                        {f.missingRequired.length === 1 ? "" : "s"} missing
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-soft">{f.form.title}</p>
                  <p className="mt-1">
                    <Cite>{f.form.authority}</Cite>
                  </p>
                  <p className="mt-1 text-[11px] text-ink-faint">{fillSummary(f)}</p>
                </div>

                <button
                  disabled={!f.complete || !inTauri || busy === f.form.code}
                  onClick={() => fill(f)}
                  title={
                    !f.complete
                      ? "Cannot fill a form with unsubstantiated fields"
                      : !inTauri
                        ? "Runs in the desktop app"
                        : "Fill via Anvil"
                  }
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-alix-deep px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-alix-dark disabled:cursor-not-allowed disabled:bg-ink-faint/30 disabled:text-ink-faint"
                >
                  {busy === f.form.code ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  Fill PDF
                </button>
              </div>

              <div className="divide-y divide-line-soft">
                {f.fields.map((field) => (
                  <FieldRow key={field.alias} field={field} />
                ))}
              </div>

              {result[f.form.code] && (
                <div className="border-t border-line-soft bg-sunk px-5 py-3">
                  <p className="font-mono text-xs text-ink-soft">{result[f.form.code]}</p>
                </div>
              )}
            </Card>
          </section>
        ))}

        <Card className="px-5 py-4">
          <Label>How the mapping works</Label>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Field bindings live in <span className="font-mono text-xs">src/rules/ca-forms.ts</span>{" "}
            and <span className="font-mono text-xs">src/rules/federal-forms.ts</span> as data, keyed
            to the item numbers on the printed form, so adding a form is an edit rather than a
            deploy. Values resolve only from the verified ledger — the same source the rules engine
            reads — which is why a fabricated fact can never reach a filed document.
          </p>
        </Card>

        {unmodelled.length > 0 && (
          <Card tone="warn" className="px-5 py-4">
            <Label>Required by the rules, not yet modelled here</Label>
            <p className="mt-1.5 text-sm text-ink-soft">
              The engine says this estate needs {unmodelled.length} further form
              {unmodelled.length === 1 ? "" : "s"} for which we hold no template. They are listed
              because a gap in our coverage must not read as a finished checklist.
            </p>
            <ul className="mt-3 space-y-1.5">
              {unmodelled.map((u) => (
                <li key={u.code} className="flex items-baseline gap-2.5 text-sm">
                  <span className="shrink-0 font-mono text-xs text-warn">{u.code}</span>
                  <span className="text-ink-soft">{u.because}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </Pane>
  );
}
