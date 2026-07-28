import { useEffect, useMemo, useRef } from "react";
import { FileText } from "lucide-react";
import { Label, Pane } from "../components/ui";
import { type EstateRun } from "../lib/session";
import { locateQuote } from "../lib/verify";

export default function DataRoomPane({
  run,
  selected,
  highlight,
  onSelect,
}: {
  run: EstateRun;
  selected: string | null;
  highlight: string | null;
  onSelect: (doc: string) => void;
}) {
  const doc = run.docs.find((d) => d.name === selected) ?? run.docs[0];
  const markRef = useRef<HTMLElement | null>(null);

  const parts = useMemo(() => {
    if (!doc) return null;
    if (!highlight) return { before: doc.content, hit: "", after: "" };
    const span = locateQuote(highlight, doc.content);
    if (!span) return { before: doc.content, hit: "", after: "" };
    return {
      before: doc.content.slice(0, span.start),
      hit: doc.content.slice(span.start, span.end),
      after: doc.content.slice(span.end),
    };
  }, [doc, highlight]);

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlight, selected]);

  return (
    <Pane
      title="Data room"
      lede="Everything the family could find. Documents arrive from third parties, so they are fenced as untrusted content before any model reads them."
    >
      <div className="mx-auto flex max-w-6xl gap-6">
        <aside className="w-72 shrink-0">
          <Label>{run.docs.length} documents</Label>
          <div className="mt-2 space-y-1">
            {run.docs.map((d) => (
              <button
                key={d.name}
                onClick={() => onSelect(d.name)}
                className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  doc?.name === d.name
                    ? "bg-alix/25 text-ink"
                    : "text-ink-soft hover:bg-sunk hover:text-ink"
                }`}
              >
                <FileText size={15} className="mt-0.5 shrink-0 text-alix-deep" />
                <span className="min-w-0 leading-snug">{d.name}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          {doc && parts && (
            <div className="rounded-xl border border-line bg-surface p-6">
              <p className="font-brand text-lg text-ink">{doc.name}</p>
              <pre className="mt-4 whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-ink-soft">
                {parts.before}
                {parts.hit && (
                  <mark ref={markRef} className="quote-hit">
                    {parts.hit}
                  </mark>
                )}
                {parts.after}
              </pre>
            </div>
          )}
        </section>
      </div>
    </Pane>
  );
}
