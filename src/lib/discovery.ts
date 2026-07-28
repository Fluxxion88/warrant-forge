// Finding assets nobody told you about.
//
// Everything else in this system reads a document and extracts what it says.
// This module does the opposite: it reads a bank statement and works out what
// must exist somewhere else. A recurring $14.32 debit to a life insurer is not
// a policy. It is evidence that a policy is being paid for, which is a
// different kind of claim and has to be handled differently.
//
// This matters because it is the failure mode families actually suffer. The
// standard professional advice for finding a deceased parent's life cover is
// to sit down with a year of bank statements and look for premium payments by
// hand. That advice exists because there is no registry to search: an
// unclaimed policy leaves no trace anywhere except the debit that pays for it.
// Small ones survive manual review precisely because they are small — a $14
// line does not catch the eye next to a $1,842 one.
//
// Two rules govern this module, and both are about not being believed too much.
//
// **A hypothesis is never a fact.** Nothing here returns a `Fact` and nothing
// here can reach `ledger()`. An inference from a payment pattern is not a
// verbatim quotation from a document, and the entire architecture rests on
// keeping those apart. What this produces is a lead: a claim, its evidence, the
// reasoning, and who to write to. A human confirms it, the insurer's reply
// becomes a document, and *that* is what enters the ledger.
//
// **Do not re-report what is already known.** A discovery pass that surfaces
// the policy already sitting in the data room is crying wolf, and after the
// third false alarm the queue stops being read. Suppressing a known institution
// is as much of a feature as surfacing an unknown one.

import type { Cadence, RecurringCharge, TransactionBatch } from "./transactions";
import { displayMerchant } from "./transactions";
import type { Fact } from "./facts";

/** What a recurring payment to this kind of counterparty implies. */
export type DiscoveryClass =
  | "life_insurance"
  | "property_insurance"
  | "vehicle_insurance"
  | "health_insurance"
  | "annuity_or_pension"
  | "brokerage_or_custody"
  | "safe_deposit"
  | "storage"
  | "self_storage_of_records"
  | "utility"
  | "subscription"
  | "unknown";

/** Classes that imply an *asset or obligation the estate must inventory*. */
const ASSET_BEARING: DiscoveryClass[] = [
  "life_insurance",
  "property_insurance",
  "vehicle_insurance",
  "annuity_or_pension",
  "brokerage_or_custody",
  "safe_deposit",
];

export interface ClassRule {
  klass: DiscoveryClass;
  /** Matched against the normalised merchant key. */
  match: RegExp;
  /** What the payment implies exists. */
  implies: string;
  /** Why the inference holds — shown to the reviewer, not decoration. */
  because: string;
  /** Who to approach, and what to ask for. */
  ask: { recipient: string; channel: "letter" | "phone" | "portal" | "fax"; asks: string };
}

/**
 * The taxonomy.
 *
 * Names are matched, not guessed at by a model, because a false positive here
 * costs a specialist a phone call and a false negative costs a family a policy.
 * Deterministic and auditable beats clever: a reviewer can read this list and
 * see exactly why something was flagged, and add to it when they meet a
 * carrier we have never seen.
 */
export const CLASS_RULES: ClassRule[] = [
  {
    klass: "life_insurance",
    match:
      /\b(metlife|met life|prudential|northwestern mutual|new york life|massmutual|mass mutual|guardian life|principal life|lincoln financial|transamerica|john hancock|pacific mutual|pacific life|banner life|protective life|primerica|globe life|gerber life|colonial penn|mutual of omaha|aig life|brighthouse|corebridge|symetra|penn mutual|securian|minnesota life|ameritas|foresters|thrivent)\b/,
    implies: "a life insurance policy",
    because:
      "A recurring premium to a life insurer, with no policy in the ledger, means " +
      "cover is in force and a death benefit is claimable. Unclaimed policies are " +
      "the single most common asset lost in estate settlement.",
    ask: {
      recipient: "the insurer's claims department",
      channel: "letter",
      asks:
        "Confirm whether a policy is in force on the decedent, the policy number, " +
        "the face amount, and the named beneficiary. Enclose the death certificate.",
    },
  },
  {
    klass: "property_insurance",
    match: /\b(state farm|allstate|farmers ins|usaa|travelers|chubb|nationwide|liberty mutual|amica|hippo|lemonade|erie insurance|auto owners)\b/,
    implies: "a homeowner's or property policy",
    because:
      "Property cover must be kept in force while the estate holds the house, and " +
      "the carrier must be told the occupancy has changed. Cancelling it is a " +
      "serious error; ignoring it can void the policy.",
    ask: {
      recipient: "the carrier",
      channel: "phone",
      asks:
        "Confirm the policy number and the insured address, notify the death, and " +
        "ask what endorsement is required for a vacant or estate-held property.",
    },
  },
  {
    klass: "vehicle_insurance",
    match: /\b(geico|progressive|esurance|21st century|mercury insurance)\b/,
    implies: "a motor policy, and therefore a vehicle",
    because:
      "A motor premium implies a registered vehicle, which is an estate asset and " +
      "may not appear in any document the family has produced.",
    ask: {
      recipient: "the carrier",
      channel: "phone",
      asks: "Confirm the insured vehicle, its VIN, and the policy status.",
    },
  },
  {
    klass: "annuity_or_pension",
    match: /\b(tiaa|empower|voya|fidelity investments|vanguard|nationwide retirement|great.?west|athene|jackson national|allianz life)\b/,
    implies: "an annuity, pension or retirement account",
    because:
      "A recurring debit to a retirement provider usually funds a contract that has " +
      "a beneficiary designation and passes outside probate.",
    ask: {
      recipient: "the provider",
      channel: "letter",
      asks: "Confirm any contract or account held, its value at date of death, and the beneficiary.",
    },
  },
  {
    klass: "brokerage_or_custody",
    match: /\b(schwab|fidelity brokerage|e.?trade|td ameritrade|interactive brokers|robinhood|computershare|equiniti|broadridge|lpl financial)\b/,
    implies: "a securities account or a directly-registered holding",
    because:
      "Custody and transfer-agent fees are charged against an account that exists. " +
      "Directly-registered shares are routinely missed because no broker statement " +
      "ever arrives.",
    ask: {
      recipient: "the custodian or transfer agent",
      channel: "letter",
      asks: "Confirm accounts or registered positions held, and the date-of-death value.",
    },
  },
  {
    klass: "safe_deposit",
    match: /\bsafe\s*deposit|safety deposit\b/,
    implies: "a safe deposit box",
    because:
      "A box fee means a box exists, and its contents have to be inventoried before " +
      "the estate can close. Nothing else in a data room reveals one.",
    ask: {
      recipient: "the bank branch holding the box",
      channel: "letter",
      asks:
        "Confirm the box number and branch, and the procedure and authority required " +
        "for a court-appointed representative to open it and inventory the contents.",
    },
  },
  {
    klass: "storage",
    match: /\b(public storage|extra space|cubesmart|u.?haul storage|life storage)\b/,
    implies: "a storage unit holding estate property",
    because:
      "A storage unit is both a running cost and a container of unvalued personal " +
      "property. It has to be visited, not just cancelled.",
    ask: {
      recipient: "the storage operator",
      channel: "phone",
      asks: "Confirm the unit number, the access terms, and what authority is needed to enter.",
    },
  },
];

export type Confidence = "strong" | "moderate" | "weak";

export interface AssetHypothesis {
  id: string;
  /** Merchant as a human would read it. */
  merchant: string;
  klass: DiscoveryClass;
  /** What we think exists. Phrased as a hypothesis, never as a holding. */
  implies: string;
  confidence: Confidence;
  cadence: Cadence;
  amountUsd: number;
  annualisedUsd: number;
  /** Still being paid after the date of death. */
  activeAfterDeath: boolean;
  /**
   * The transaction rows themselves. This is the warrant for a hypothesis:
   * not a quotation from a document, but the specific debits it rests on, so a
   * reviewer can check the reasoning rather than take it on trust.
   */
  evidence: { date: string; description: string; amount: number }[];
  because: string;
  nextStep: { recipient: string; channel: string; asks: string };
}

export interface Suppressed {
  merchant: string;
  klass: DiscoveryClass;
  /** The ledger fact that already accounts for this payment. */
  accountedForBy: { key: string; value: string };
}

export interface DiscoveryResult {
  hypotheses: AssetHypothesis[];
  /** Known institutions we deliberately did not re-report. */
  suppressed: Suppressed[];
  /** Recurring charges that imply no asset — these belong to the shut-down queue. */
  notAssetBearing: string[];
}

export function classify(normalisedMerchant: string): ClassRule | null {
  const key = normalisedMerchant.toLowerCase();
  for (const rule of CLASS_RULES) {
    if (rule.match.test(key)) return rule;
  }
  return null;
}

/**
 * Confidence, stated conservatively.
 *
 * A long regular series is good evidence that something is in force. Two
 * annual charges are consistent with it but thin. Nothing here reaches
 * "certain", because certainty is what the insurer's reply provides, not what
 * a payment pattern can.
 */
function confidenceFor(charge: RecurringCharge): Confidence {
  const n = charge.occurrences;
  if (n >= 6 && charge.confidence === "high") return "strong";
  if (n >= 3 && charge.confidence !== "low") return "moderate";
  return "weak";
}

/**
 * Institution names already present in the verified ledger.
 *
 * Compared loosely — "Pacific Mutual" in the ledger against
 * "pacific mutual life prem" from a bank descriptor — because the bank never
 * prints the name the way the policy document does.
 */
function knownInstitutions(facts: Fact[]): { key: string; value: string; token: string }[] {
  const out: { key: string; value: string; token: string }[] = [];
  for (const f of facts) {
    if (f.status !== "verified") continue;
    if (!/\.(institution|issuer|custodian)$/.test(f.key)) continue;
    if (typeof f.value !== "string") continue;
    const token = f.value.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    if (token.length >= 4) out.push({ key: f.key, value: f.value, token });
  }
  return out;
}

/**
 * Does a known institution account for this merchant?
 *
 * Requires the ledger's institution name to appear as a whole-word prefix run
 * in the merchant descriptor. "Pacific Mutual" matches
 * "pacific mutual life prem"; it does not match "pacific gas and electric",
 * which shares only one word.
 */
function accountedFor(
  merchantKey: string,
  known: { key: string; value: string; token: string }[],
): { key: string; value: string } | null {
  const words = merchantKey.toLowerCase().split(/\s+/);
  for (const k of known) {
    const kw = k.token.split(/\s+/);
    if (kw.length === 0) continue;
    for (let i = 0; i + kw.length <= words.length; i++) {
      if (kw.every((w, j) => words[i + j] === w)) return { key: k.key, value: k.value };
    }
  }
  return null;
}

/**
 * Infer assets from recurring payments.
 *
 * `facts` is the verified ledger, used only to suppress what is already known.
 * Nothing in the return value is a fact and nothing can become one without a
 * document arriving to support it.
 */
export function discoverAssets(
  charges: RecurringCharge[],
  facts: Fact[],
  batches: TransactionBatch[],
  opts: { dateOfDeath?: string } = {},
): DiscoveryResult {
  const known = knownInstitutions(facts);
  // A charge cites its evidence as transaction ids. Resolve them to the actual
  // rows, because "here are the four debits" is reviewable and a list of ids
  // is not.
  const rowById = new Map(
    batches.flatMap((b) => b.transactions.map((t) => [t.id, t] as const)),
  );
  const hypotheses: AssetHypothesis[] = [];
  const suppressed: Suppressed[] = [];
  const notAssetBearing: string[] = [];

  for (const charge of charges) {
    const rule = classify(charge.merchant);
    if (!rule || !ASSET_BEARING.includes(rule.klass)) {
      if (!rule || rule.klass === "storage") {
        // Storage is a running cost handled by the shut-down board, but it also
        // holds property. It is reported there, not here, to avoid two queues
        // owning the same item.
        notAssetBearing.push(displayMerchant(charge.merchant));
      }
      continue;
    }

    const already = accountedFor(charge.merchant, known);
    if (already) {
      suppressed.push({
        merchant: displayMerchant(charge.merchant),
        klass: rule.klass,
        accountedForBy: already,
      });
      continue;
    }

    const rows = charge.evidence
      .map((id) => rowById.get(id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map((t) => ({ date: t.date, description: t.description, amount: t.amount }));
    const activeAfterDeath = opts.dateOfDeath
      ? rows.some((r) => r.date > opts.dateOfDeath!)
      : charge.chargedAfterDeath;

    hypotheses.push({
      id: `discovery.${rule.klass}.${charge.merchant.replace(/\s+/g, "_")}`,
      merchant: displayMerchant(charge.merchant),
      klass: rule.klass,
      implies: rule.implies,
      confidence: confidenceFor(charge),
      cadence: charge.cadence,
      amountUsd: charge.amount,
      annualisedUsd: Math.round(charge.annualCostUsd * 100) / 100,
      activeAfterDeath,
      evidence: rows,
      because: rule.because,
      nextStep: rule.ask,
    });
  }

  // Largest annual outlay first: the size of the premium is the best available
  // proxy for the size of the thing it is paying for.
  hypotheses.sort((a, b) => b.annualisedUsd - a.annualisedUsd);
  return { hypotheses, suppressed, notAssetBearing };
}

/** One-line summary for a reviewer scanning the queue. */
export function describe(h: AssetHypothesis): string {
  const amt = `$${h.amountUsd.toFixed(2)}`;
  const cadence = h.cadence === "irregular" ? "irregularly" : h.cadence;
  return (
    `${amt} ${cadence} to ${h.merchant}. Implies ${h.implies}; none in the ledger. ` +
    `${h.evidence.length} payment${h.evidence.length === 1 ? "" : "s"} on file` +
    (h.activeAfterDeath ? ", still charging after the date of death." : ".")
  );
}
