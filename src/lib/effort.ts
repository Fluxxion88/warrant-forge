// Effort accounting.
//
// "Take hours out of the system" is the thing this is judged on, so it should
// be measured rather than asserted — and measured honestly, which means being
// explicit that these are practice estimates of manual effort, not observations
// of this system running.
//
// Three buckets, and the distinction matters:
//
//   automated — the machine produced the output and a human need not touch it
//   assisted  — the machine produced a draft a human reviews, which is faster
//               than writing it but is not free
//   manual    — still entirely a person's job
//
// Anything that inflates "automated" by quietly counting review time as zero is
// the same category of dishonesty as an uncited threshold, so review overhead is
// modelled explicitly and subtracted.

export type EffortBucket = "automated" | "assisted" | "manual";

export interface EffortLine {
  id: string;
  activity: string;
  bucket: EffortBucket;
  /** Minutes a specialist spends doing this by hand, per estate. */
  manualMinutes: number;
  /** Minutes still required with the system in place — review, sign-off, sending. */
  residualMinutes: number;
  /** Why the saving is what it is. */
  basis: string;
}

export interface EffortReport {
  lines: EffortLine[];
  manualTotal: number;
  residualTotal: number;
  savedMinutes: number;
  savedPercent: number;
  byBucket: Record<EffortBucket, { manual: number; residual: number }>;
  /** Always true. Displayed so nobody mistakes this for telemetry. */
  isEstimate: true;
}

/**
 * Baseline model, per estate.
 *
 * Figures are practice estimates for a settlement specialist working a
 * moderately complex estate. They are deliberately conservative on the
 * automated side: where a human still has to read, approve or post something,
 * that time is counted.
 */
export const EFFORT_MODEL: EffortLine[] = [
  {
    id: "effort.route",
    activity: "Determine the applicable probate procedure",
    bucket: "automated",
    manualMinutes: 120,
    residualMinutes: 5,
    basis:
      "Researching county practice and the current thresholds by hand, versus reading a decision with its citation and trace.",
  },
  {
    id: "effort.gross_value",
    activity: "Compute gross value with statutory exclusions",
    bucket: "automated",
    manualMinutes: 45,
    residualMinutes: 5,
    basis:
      "Applying § 13050 exclusions by hand and totalling, versus checking a derivation that names its inputs.",
  },
  {
    id: "effort.verify_figures",
    activity: "Verify figures against source documents",
    bucket: "automated",
    manualMinutes: 60,
    residualMinutes: 10,
    basis: "Every fact already carries its quotation and character span; the human spot-checks rather than re-reads.",
  },
  {
    id: "effort.gap_chase",
    activity: "Identify what is missing before filing",
    bucket: "automated",
    manualMinutes: 40,
    residualMinutes: 5,
    basis: "Gaps fall out of rule evaluation instead of being discovered at the filing counter.",
  },
  {
    id: "effort.forms",
    activity: "Fill the court and federal form set",
    bucket: "assisted",
    manualMinutes: 105,
    residualMinutes: 25,
    basis:
      "Transcribing the same names, dates and numbers across a dozen forms, versus reviewing pre-filled fields that each cite a source.",
  },
  {
    id: "effort.form_identity",
    activity: "Establish which form a jurisdiction actually wants",
    bucket: "automated",
    manualMinutes: 35,
    residualMinutes: 5,
    basis:
      "The document store resolves issuer, jurisdiction and revision, and refuses when a printed identifier is ambiguous.",
  },
  {
    id: "effort.correspondence",
    activity: "Draft institution and family correspondence",
    bucket: "assisted",
    manualMinutes: 140,
    residualMinutes: 35,
    basis:
      "Seven letters per estate at roughly twenty minutes each, versus reviewing merged drafts with enclosures already listed.",
  },
  {
    id: "effort.asset_discovery",
    activity: "Work out which assets might exist but have not been found",
    bucket: "assisted",
    manualMinutes: 180,
    residualMinutes: 60,
    basis:
      "Reading returns and statements for offshore indicators by hand, versus reviewing raised leads and deciding which to pursue.",
  },
  {
    id: "effort.entity_resolution",
    activity: "Reconcile duplicate references to the same account",
    bucket: "assisted",
    manualMinutes: 50,
    residualMinutes: 20,
    basis: "Proposals arrive with their matching evidence; the human adjudicates the ambiguous ones only.",
  },
  {
    id: "effort.deadlines",
    activity: "Calendar statutory deadlines",
    bucket: "automated",
    manualMinutes: 30,
    residualMinutes: 5,
    basis: "Computed from ledger dates, including periods that run from the later of two anchors.",
  },
  {
    id: "effort.recheck",
    activity: "Re-check the position when a new document arrives",
    bucket: "automated",
    manualMinutes: 90,
    residualMinutes: 10,
    basis:
      "The largest single saving. Today this is either a full re-review or it is skipped; dependency tracking makes it cheap enough to do every time.",
  },
  {
    id: "effort.dispatch",
    activity: "Work out how each document must be delivered",
    bucket: "automated",
    manualMinutes: 25,
    residualMinutes: 5,
    basis: "Channel, enclosures and any call-first requirement are computed from the recipient's own record.",
  },
  {
    id: "effort.calls",
    activity: "Telephone institutions and wait on hold",
    bucket: "manual",
    manualMinutes: 150,
    residualMinutes: 150,
    basis: "Not addressed. This is Track 2, designed but not built.",
  },
  {
    id: "effort.family",
    activity: "Speak with the family",
    bucket: "manual",
    manualMinutes: 120,
    residualMinutes: 120,
    basis:
      "Deliberately untouched. Alix's product is human-led, and this is the part that should stay a person.",
  },
];

export function computeEffort(lines: EffortLine[] = EFFORT_MODEL): EffortReport {
  const byBucket: EffortReport["byBucket"] = {
    automated: { manual: 0, residual: 0 },
    assisted: { manual: 0, residual: 0 },
    manual: { manual: 0, residual: 0 },
  };

  for (const l of lines) {
    byBucket[l.bucket].manual += l.manualMinutes;
    byBucket[l.bucket].residual += l.residualMinutes;
  }

  const manualTotal = lines.reduce((s, l) => s + l.manualMinutes, 0);
  const residualTotal = lines.reduce((s, l) => s + l.residualMinutes, 0);
  const saved = manualTotal - residualTotal;

  return {
    lines,
    manualTotal,
    residualTotal,
    savedMinutes: saved,
    savedPercent: manualTotal === 0 ? 0 : Math.round((saved / manualTotal) * 100),
    byBucket,
    isEstimate: true,
  };
}

export function hours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * The saving excluding work we deliberately leave to people.
 *
 * Quoting a headline percentage that includes the family conversation would be
 * misleading — that time is not meant to disappear.
 */
export function savingExcludingHumanWork(report: EffortReport): {
  manual: number;
  residual: number;
  percent: number;
} {
  const inScope = report.lines.filter((l) => l.bucket !== "manual");
  const manual = inScope.reduce((s, l) => s + l.manualMinutes, 0);
  const residual = inScope.reduce((s, l) => s + l.residualMinutes, 0);
  return {
    manual,
    residual,
    percent: manual === 0 ? 0 : Math.round(((manual - residual) / manual) * 100),
  };
}
