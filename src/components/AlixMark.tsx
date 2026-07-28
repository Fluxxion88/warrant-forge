/**
 * The Alix emblem — a wheat sheaf: an upright stem with three pairs of fronds
 * cascading down and outward. Redrawn from the mark on the hackathon deck.
 */
export function AlixMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  // One frond, described once and mirrored, so the two sides cannot drift.
  const frond = (row: number, mirrored: boolean) => {
    const top = 12 + row * 24;
    const reach = 40 + row * 6;
    const d = [
      `M 50 ${top + 20}`,
      `L ${50 + reach} ${top}`,
      `L ${50 + reach} ${top + 13}`,
      `L 50 ${top + 33}`,
      "Z",
    ].join(" ");
    return (
      <path
        key={`${row}-${mirrored}`}
        d={d}
        transform={mirrored ? "scale(-1,1) translate(-100,0)" : undefined}
      />
    );
  };

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Alix"
      fill="currentColor"
    >
      <rect x="47.6" y="6" width="4.8" height="88" rx="2.4" />
      {[0, 1, 2].map((r) => frond(r, false))}
      {[0, 1, 2].map((r) => frond(r, true))}
    </svg>
  );
}

/** Emblem plus wordmark, for the sidebar header. */
export function AlixLockup({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <AlixMark size={26} className="text-alix-deep" />
      <span className="font-brand text-[26px] leading-none tracking-tight text-ink">Alix</span>
    </div>
  );
}
