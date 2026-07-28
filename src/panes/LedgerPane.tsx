import { useState } from "react";
import { Ban, Calculator, Quote } from "lucide-react";
import { Badge, Card, Cite, Label, Pane } from "../components/ui";
import { rejectedFacts, verifiedFacts, type EstateRun } from "../lib/session";
import type { Fact } from "../lib/facts";

function value(f: Fact): string {
  if (typeof f.value === "number")
    return f.unit === "USD" ? `$${f.value.toLocaleString("en-US")}` : f.value.toLocaleString("en-US");
  if (typeof f.value === "boolean") return f.value ? "yes" : "no";
  return String(f.value);
}

function FactRow({ fact, onOpen }: { fact: Fact; onOpen: (doc: string, quote: string) => void }) {
  const [open, setOpen] = useState(false);
  const w = fact.warrant;
  const rejected = fact.status !== "verified";

  return (
    <div className="px-5 py-3">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-baseline gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="text-sm font-medium text-ink">{fact.label}</span>
          <span className="ml-2 font-mono text-[11px] text-ink-faint">{fact.key}</span>
        </span>
        <span className={`tabular shrink-0 text-sm ${rejected ? "text-rejected line-through" : "text-ink"}`}>
          {value(fact)}
        </span>
        <span className="shrink-0">
          {w.kind === "derivation" ? (
            <Badge tone="alix">
              <Calculator size={10} /> derived
            </Badge>
          ) : rejected ? (
            <Badge tone="rejected">
              <Ban size={10} /> no warrant
            </Badge>
          ) : (
            <Badge tone="verified">
              <Quote size={10} /> verified
            </Badge>
          )}
        </span>
      </button>

      {open && (
        <div className="mt-3 rounded-lg bg-sunk px-4 py-3">
          {w.kind === "quote" ? (
            <>
              <Label>Warrant</Label>
              <blockquote className="mt-1.5 border-l-2 border-alix-mid pl-3 font-brand text-sm italic leading-relaxed text-ink">
                “{w.quote}”
              </blockquote>
              <p className="mt-2 text-xs text-ink-soft">
                {w.document}
                {w.matchedDocument && w.matchedDocument !== w.document && (
                  <span className="text-rejected"> — actually found in {w.matchedDocument}</span>
                )}
              </p>
              <p className="mt-1 text-xs text-ink-faint">{w.note}</p>
              {!rejected && (
                <button
                  onClick={() => onOpen(w.matchedDocument ?? w.document, w.quote)}
                  className="mt-2 text-xs font-medium text-alix-deep underline underline-offset-2 hover:text-alix-dark"
                >
                  Open in source
                </button>
              )}
            </>
          ) : w.kind === "record" ? (
            <>
              <Label>System of record</Label>
              <p className="tabular mt-1.5 font-mono text-xs leading-relaxed text-ink">{w.path}</p>
              <blockquote className="mt-1.5 border-l-2 border-alix-mid pl-3 font-brand text-sm italic leading-relaxed text-ink">
                “{w.raw}”
              </blockquote>
              <p className="mt-2 text-xs text-ink-soft">
                {w.system} · record {w.recordId}
              </p>
              <p className="mt-1 text-xs text-ink-faint">{w.note}</p>
            </>
          ) : (
            <>
              <Label>Derivation</Label>
              <p className="tabular mt-1.5 font-mono text-xs leading-relaxed text-ink">{w.formula}</p>
              <p className="mt-2 text-xs text-ink-soft">{w.note}</p>
              {w.authority && (
                <p className="mt-1">
                  <Cite>{w.authority.citation}</Cite>
                </p>
              )}
              <p className="mt-2 text-[11px] text-ink-faint">
                Inputs: {w.inputs.join(", ")}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function LedgerPane({
  run,
  onOpenSource,
}: {
  run: EstateRun;
  onOpenSource: (doc: string, quote: string) => void;
}) {
  const good = verifiedFacts(run);
  const bad = rejectedFacts(run);

  return (
    <Pane
      title="Fact ledger"
      lede="A model may propose any fact it likes. It cannot reach a decision without a verbatim quotation that we can locate in a document we actually hold."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {bad.length > 0 && (
          <div>
            <Label>Rejected — never reached the rules engine</Label>
            <Card tone="rejected" className="mt-2 divide-y divide-rejected/15">
              {bad.map((f) => (
                <FactRow key={f.id} fact={f} onOpen={onOpenSource} />
              ))}
            </Card>
          </div>
        )}

        <div>
          <Label>
            Admitted — {good.length} fact{good.length === 1 ? "" : "s"}
          </Label>
          <Card className="mt-2 divide-y divide-line-soft">
            {good.map((f) => (
              <FactRow key={f.id} fact={f} onOpen={onOpenSource} />
            ))}
          </Card>
        </div>
      </div>
    </Pane>
  );
}
