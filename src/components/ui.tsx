import type { ReactNode } from "react";

export function Pane({
  title,
  lede,
  actions,
  children,
}: {
  title: string;
  lede?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-line bg-surface/70 px-8 py-5 backdrop-blur">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="font-brand text-2xl text-ink">{title}</h1>
            {lede && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-soft">{lede}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">{children}</div>
    </div>
  );
}

export function Card({
  children,
  className = "",
  tone = "plain",
}: {
  children: ReactNode;
  className?: string;
  tone?: "plain" | "verified" | "rejected" | "warn" | "alix";
}) {
  const tones = {
    plain: "border-line bg-surface",
    verified: "border-verified/25 bg-verified-soft",
    rejected: "border-rejected/30 bg-rejected-soft",
    warn: "border-warn/30 bg-warn-soft",
    alix: "border-alix-mid/35 bg-alix/10",
  };
  return <div className={`rounded-xl border ${tones[tone]} ${className}`}>{children}</div>;
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "verified" | "rejected" | "warn" | "alix";
}) {
  const tones = {
    neutral: "bg-sunk text-ink-soft ring-line",
    verified: "bg-verified-soft text-verified ring-verified/25",
    rejected: "bg-rejected-soft text-rejected ring-rejected/25",
    warn: "bg-warn-soft text-warn ring-warn/25",
    alix: "bg-alix/25 text-alix-dark ring-alix-mid/30",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{children}</p>
  );
}

export function Cite({ children }: { children: ReactNode }) {
  return (
    <span className="font-brand text-[12px] italic text-alix-deep" title="Statutory authority">
      {children}
    </span>
  );
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-sm text-center">
        <p className="font-brand text-lg text-ink">{title}</p>
        {body && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>}
      </div>
    </div>
  );
}
