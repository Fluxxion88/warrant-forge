import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-start gap-4 border-b border-neutral-800 px-8 py-5">
      <div className="min-w-0">
        <h1 className="font-brand text-xl text-neutral-100">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Button({
  children,
  onClick,
  variant = "default",
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "ghost" | "danger";
  disabled?: boolean;
  title?: string;
}) {
  const styles = {
    default:
      "border border-neutral-700 text-neutral-200 hover:border-neutral-500 hover:text-white",
    primary: "bg-accent text-[#0e1116] font-medium hover:bg-accent-deep",
    ghost: "text-neutral-400 hover:text-neutral-100",
    danger: "border border-red-900/70 text-red-400 hover:bg-red-950/40",
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors disabled:opacity-40 disabled:pointer-events-none ${styles}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
  span,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  span?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 ${span ? "col-span-2" : ""}`}>
      <span className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-neutral-600">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "rounded-md border border-neutral-700 bg-neutral-900/70 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-accent/60";

export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <h2 className="font-brand text-lg text-neutral-300">{title}</h2>
      <p className="max-w-md text-sm text-neutral-500">{body}</p>
      {action}
    </div>
  );
}

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "border-red-800 bg-red-950/50 text-red-300",
  HIGH: "border-amber-800 bg-amber-950/40 text-amber-300",
  MEDIUM: "border-sky-900 bg-sky-950/40 text-sky-300",
  LOW: "border-neutral-700 bg-neutral-900 text-neutral-400",
};

export function SeverityTag({ severity }: { severity: string }) {
  return (
    <span
      className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium tracking-wide ${
        SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.LOW
      }`}
    >
      {severity}
    </span>
  );
}

const VERIFICATION_STYLES: Record<string, { cls: string; label: string; title: string }> = {
  verified: {
    cls: "border-emerald-800 bg-emerald-950/40 text-emerald-400",
    label: "verified",
    title: "Quotation located verbatim in the cited source document.",
  },
  loose: {
    cls: "border-amber-800 bg-amber-950/30 text-amber-400",
    label: "partial",
    title: "Quotation is paraphrased or attributed to the wrong document.",
  },
  unsupported: {
    cls: "border-red-800 bg-red-950/40 text-red-400",
    label: "unsupported",
    title: "Quotation does not appear anywhere in the data room. Treat as unproven.",
  },
  no_citation: {
    cls: "border-neutral-700 bg-neutral-900 text-neutral-500",
    label: "uncited",
    title: "No source was cited. This is an assertion, not a finding.",
  },
};

export function VerificationTag({ status }: { status: string }) {
  const v = VERIFICATION_STYLES[status] ?? VERIFICATION_STYLES.no_citation;
  return (
    <span
      title={v.title}
      className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] tracking-wide ${v.cls}`}
    >
      {v.label}
    </span>
  );
}
