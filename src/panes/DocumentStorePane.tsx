import { useMemo, useState } from "react";
import {
  Building2,
  Fingerprint,
  Landmark,
  Phone,
  PenLine,
  Send,
  Stamp,
  TriangleAlert,
} from "lucide-react";
import { Badge, Card, Label, Pane } from "../components/ui";
import { coverage, planDispatch, resolveForm, type FormRecord } from "../lib/formstore";
import { FORM_STORE } from "../rules/form-catalog";
import type { EstateRun } from "../lib/session";

const CHANNEL_LABEL: Record<string, string> = {
  efile: "e-file",
  email: "email",
  fax: "fax",
  postal: "postal mail",
  portal: "portal",
  in_person: "in person",
  phone_first: "call first",
};

const ISSUER_ICON = {
  judicial_council: Landmark,
  court: Landmark,
  state_agency: Stamp,
  federal_agency: Stamp,
  institution: Building2,
} as const;

function FormRow({ form }: { form: FormRecord }) {
  const [open, setOpen] = useState(false);
  const Icon = ISSUER_ICON[form.issuer.kind];
  const plan = planDispatch(form, { signed: true });

  return (
    <div className="px-5 py-3">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 text-left">
        <Icon size={15} className="mt-0.5 shrink-0 text-alix-deep" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium text-ink">{form.printedId}</span>
            <span className="text-sm text-ink-soft">{form.title}</span>
            {form.requiresNotary && <Badge tone="warn">notary</Badge>}
            {form.requiresOriginal && <Badge tone="warn">wet original</Badge>}
            {form.delivery.channels.includes("phone_first") && (
              <Badge tone="rejected">
                <Phone size={9} /> call first
              </Badge>
            )}
            {form.signatures.length > 0 && (
              <Badge tone="alix">
                <PenLine size={9} /> {form.signatures.length} sig
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-ink-faint">
            {form.issuer.name}
            {form.revision && ` · rev ${form.revision}`} ·{" "}
            <span className="font-mono">{form.key}</span>
          </p>
        </div>
      </button>

      {open && (
        <div className="mt-3 ml-8 space-y-3 rounded-lg bg-sunk px-4 py-3">
          <div>
            <Label>Parties</Label>
            <div className="mt-1 space-y-0.5">
              {form.parties.map((p) => (
                <p key={p.role + p.who} className="text-xs text-ink-soft">
                  <span className="font-medium text-ink">{p.role}</span> — {p.who}
                  {p.factKey && <span className="ml-1 font-mono text-ink-faint">{p.factKey}</span>}
                </p>
              ))}
            </div>
          </div>

          <div>
            <Label>Dispatch</Label>
            <p className="mt-1 text-xs text-ink-soft">
              Accepts: {form.delivery.channels.map((c) => CHANNEL_LABEL[c] ?? c).join(", ")} ·
              chosen: <span className="font-medium text-ink">{CHANNEL_LABEL[plan.channel]}</span>
            </p>
            <ol className="mt-1.5 space-y-1">
              {plan.steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-xs leading-relaxed text-ink-soft">
                  <Send size={11} className="mt-0.5 shrink-0 text-alix-deep" />
                  {s}
                </li>
              ))}
            </ol>
          </div>

          {form.signatures.length > 0 && (
            <div>
              <Label>Signature placement</Label>
              {form.signatures.map((s) => (
                <p key={s.id} className="tabular mt-1 font-mono text-[11px] text-ink-soft">
                  {s.type} · page {s.pageNum} · x {s.rect.x}, y {s.rect.y}, {s.rect.width}×
                  {s.rect.height}
                </p>
              ))}
            </div>
          )}

          {form.notes && <p className="text-xs leading-relaxed text-ink-faint">{form.notes}</p>}
        </div>
      )}
    </div>
  );
}

export default function DocumentStorePane({ run }: { run: EstateRun }) {
  const [query, setQuery] = useState("");
  const stats = coverage(FORM_STORE);

  const resolution = useMemo(
    () =>
      query.trim()
        ? resolveForm(FORM_STORE, {
            printedId: query.trim(),
            state: "CA",
            county: run.county,
          })
        : null,
    [query, run.county],
  );

  return (
    <Pane
      title="Document store"
      lede="A printed form identifier is not unique. DE-111 means something only within the California Judicial Council; PRO 010 exists only in Los Angeles; almost every brokerage prints its own Affidavit of Domicile. Every record here is keyed on issuer, jurisdiction and revision — and carries who fills it, who signs it, and how it reaches its recipient."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Forms in store", value: stats.total, tone: "plain" as const },
            { label: "Issuers", value: Object.keys(stats.byIssuerKind).length, tone: "alix" as const },
            { label: "Need wet signature", value: stats.requiringWetSignature, tone: "warn" as const },
            { label: "Require a call first", value: stats.requiringPhoneFirst, tone: "rejected" as const },
          ].map((s) => (
            <Card key={s.label} tone={s.tone} className="px-4 py-3">
              <p className="tabular font-brand text-2xl text-ink">{s.value}</p>
              <p className="mt-0.5 text-[11px] text-ink-soft">{s.label}</p>
            </Card>
          ))}
        </div>

        <Card className="px-5 py-4">
          <Label>
            <span className="flex items-center gap-1.5">
              <Fingerprint size={12} /> Resolve a printed identifier
            </span>
          </Label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try "DE-111", "PRO 010", or "Affidavit of Domicile"'
            className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-alix-mid"
          />
          {resolution && (
            <div className="mt-3">
              {resolution.form ? (
                <div className="rounded-lg bg-verified-soft px-4 py-3">
                  <p className="text-sm font-medium text-ink">{resolution.form.title}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {resolution.form.issuer.name} · {resolution.reason}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg bg-rejected-soft px-4 py-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-ink">
                    <TriangleAlert size={14} className="text-rejected" />
                    {resolution.ambiguous.length > 0 ? "Ambiguous" : "Not found"}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-soft">{resolution.reason}</p>
                  {resolution.ambiguous.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {resolution.ambiguous.map((f) => (
                        <li key={f.key} className="text-xs text-ink-soft">
                          <span className="font-medium text-ink">{f.issuer.name}</span> —{" "}
                          <span className="font-mono text-[10px]">{f.key}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
                    The store refuses to pick one. Sending the wrong institution's affidavit is a
                    returned filing and another round trip for the family.
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>

        <section>
          <Label>All records</Label>
          <Card className="mt-2 divide-y divide-line-soft">
            {FORM_STORE.map((f) => (
              <FormRow key={f.key} form={f} />
            ))}
          </Card>
        </section>
      </div>
    </Pane>
  );
}
