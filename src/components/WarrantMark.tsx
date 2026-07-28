/**
 * The Warrant mark — a quotation inside a seal.
 *
 * Deliberately not Alix's wheat sheaf. The palette and typography here are
 * theirs on purpose, because the product is built to sit inside their practice
 * and it should look like it belongs. Their emblem and wordmark are a different
 * matter: rendering those as this application's own identity would tell a
 * viewer they are looking at Alix's software, which they are not, and would
 * quietly erase whose work this is.
 *
 * A seal is what a warrant carries, and the quotation is the thing this system
 * insists on before it will believe anything.
 */
export function WarrantMark({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Warrant"
      fill="none"
      stroke="currentColor"
    >
      <circle cx="50" cy="50" r="42" strokeWidth="6" />
      {/* Two quotation strokes, the shape of a citation. */}
      <path
        d="M 34 34 L 34 52 Q 34 62 26 66"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 62 34 L 62 52 Q 62 62 54 66"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Emblem, wordmark, and who it was built for. */
export function WarrantLockup({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2.5">
        <WarrantMark size={24} className="text-alix-deep" />
        <span className="font-brand text-[26px] leading-none tracking-tight text-ink">Warrant</span>
      </div>
      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
        Estate settlement · built for Alix
      </p>
    </div>
  );
}
