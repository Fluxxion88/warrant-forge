// Recurring-charge detection.
//
// After a death the direct debits keep going. Streaming services, gym
// memberships, storage units, software licences, insurance riders, cloud
// backups — each is small, none is memorable, and collectively they bleed an
// estate for months because nobody knows they exist until a statement arrives.
//
// Finding them is a deterministic problem, not a judgement, so no model is
// involved: normalise the merchant string, group by merchant and account, look
// at the spacing between charges, and check whether the amount holds steady.
// A model would be both slower and less reliable at this, and would need its
// answer checked anyway.
//
// Transactions arrive as a structured feed rather than as quoted prose, so
// provenance attaches to the batch — which institution supplied it, from what
// document, retrieved when — rather than to each of several hundred rows.

export interface Transaction {
  id: string;
  /** The asset prefix this account maps to, e.g. "asset.checking". */
  account: string;
  /** ISO date. */
  date: string;
  /** Raw descriptor exactly as the institution printed it. */
  description: string;
  /** Negative for money leaving the account. */
  amount: number;
}

export interface TransactionBatch {
  id: string;
  account: string;
  institution: string;
  /** Where the rows came from, so the batch is as traceable as a quotation. */
  sourceDocument: string;
  retrievedAt: string;
  periodStart: string;
  periodEnd: string;
  transactions: Transaction[];
}

export type Cadence = "weekly" | "fortnightly" | "monthly" | "quarterly" | "annual" | "irregular";

export interface RecurringCharge {
  id: string;
  merchant: string;
  /** Every distinct raw descriptor that normalised to this merchant. */
  rawDescriptions: string[];
  account: string;
  institution: string;
  cadence: Cadence;
  medianIntervalDays: number;
  /** Typical charge, in the account currency. */
  amount: number;
  amountVaries: boolean;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  annualCostUsd: number;
  /** Charged at least once after the death — money still leaving the estate. */
  chargedAfterDeath: boolean;
  confidence: "high" | "medium" | "low";
  /** Transaction ids, so every conclusion points back at rows. */
  evidence: string[];
  sourceDocument: string;
}

// ---------------------------------------------------------------------------
// Merchant normalisation
// ---------------------------------------------------------------------------

const PAYMENT_PREFIXES = [
  "sq *", "sq*", "tst*", "tst *", "paypal *", "pp*", "pp *",
  "ach debit", "ach ", "pos debit", "pos ", "recurring payment",
  "recurring ", "autopay ", "auto pay ", "web pmt", "dbt crd",
  "visa purchase", "purchase authorized on",
];

// Case-insensitive: normalisation lowercases before this runs.
const US_STATES =
  /\b(A[KLRZ]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|P[AR]|RI|S[CD]|T[NX]|UT|V[AT]|W[AIVY])\b\s*$/i;

/**
 * Reduce an institution's descriptor to a stable merchant name.
 *
 * Descriptors carry processor prefixes, store numbers, reference ids, dates and
 * a trailing city and state. All of it varies between charges from the same
 * vendor, so all of it has to go before grouping.
 */
export function normaliseMerchant(description: string): string {
  let s = description.toLowerCase().trim();

  for (const p of PAYMENT_PREFIXES) {
    if (s.startsWith(p)) {
      s = s.slice(p.length).trim();
      break;
    }
  }

  s = s
    // Telephone numbers, which vendors bury in the descriptor.
    .replace(/\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/g, " ")
    .replace(/\b1[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/g, " ")
    // Dates in any common shape.
    .replace(/\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/g, " ")
    // Store numbers: "#1234", "store 42".
    .replace(/#\s*\d+/g, " ")
    .replace(/\bstore\s+\d+\b/g, " ")
    .replace(/[^a-z0-9\s.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  s = s.replace(US_STATES, "").trim();

  // Long all-digit tokens are references, store numbers or phone fragments.
  // Short ones are part of the brand — "24 hour fitness", "7 eleven" — so the
  // threshold is three digits rather than any digits at all.
  s = s
    .split(" ")
    .filter((t) => t && !/^\d{3,}$/.test(t))
    .join(" ");

  // Trailing city names are deliberately NOT stripped here. There is no
  // reliable way to tell a city token from a brand token without a gazetteer,
  // and guessing mangles names like "24 hour fitness usa". Grouping handles it
  // instead, by treating one descriptor as the same merchant as another when
  // it is a token-prefix of it.
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Merge descriptors where one is a token-prefix of another.
 *
 * "spotify usa" and "spotify usa new york" are the same vendor with a city
 * appended; "american express" and "american airlines" are not, and comparing
 * the full overlap rather than the first token keeps them apart. Single-token
 * descriptors merge only on exact equality, since a lone token is too weak a
 * signal to group on.
 */
export function canonicalise(keys: string[]): Map<string, string> {
  const unique = [...new Set(keys)].sort(
    (a, b) => a.split(" ").length - b.split(" ").length || a.localeCompare(b),
  );
  const canon = new Map<string, string>();
  const chosen: string[] = [];

  for (const key of unique) {
    const kt = key.split(" ");
    let match: string | undefined;
    for (const c of chosen) {
      const ct = c.split(" ");
      const n = Math.min(ct.length, kt.length);
      if (n < 2) {
        if (c === key) {
          match = c;
          break;
        }
        continue;
      }
      if (ct.slice(0, n).join(" ") === kt.slice(0, n).join(" ")) {
        match = c;
        break;
      }
    }
    if (match) {
      canon.set(key, match);
    } else {
      canon.set(key, key);
      chosen.push(key);
    }
  }
  return canon;
}

/** Title-case for display, preserving obvious acronyms. */
/**
 * Acronyms that should stay capitalised in a merchant name.
 *
 * An allowlist rather than a length rule. "Any short lowercase word is an
 * acronym" turns "safe deposit box fee san mateo" into "Safe Deposit BOX FEE
 * SAN Mateo", because box, fee and san are all three letters. Short English
 * words are common enough that the heuristic is wrong more often than right.
 */
const ACRONYMS = new Set([
  "usa", "us", "uk", "llc", "llp", "inc", "plc", "na", "atm", "aaa", "aarp",
  "irs", "dmv", "ssa", "hoa", "pge", "att", "hsbc", "ubs", "bmw", "gmc",
  "al", "ak", "az", "ar", "ca", "co", "ct", "dc", "de", "fl", "ga", "hi",
  "ia", "id", "il", "in", "ks", "ky", "la", "ma", "md", "me", "mi", "mn",
  "mo", "ms", "mt", "nc", "nd", "ne", "nh", "nj", "nm", "nv", "ny", "oh",
  "ok", "or", "pa", "ri", "sc", "sd", "tn", "tx", "ut", "va", "vt", "wa",
  "wi", "wv", "wy",
]);

export function displayMerchant(normalised: string): string {
  return normalised
    .split(" ")
    .filter(Boolean)
    .map((w) => {
      if (ACRONYMS.has(w)) return w.toUpperCase();
      // Anything carrying an ampersand or a digit is a brand token, not prose.
      if (/[&\d]/.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function days(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/**
 * Exact median — no rounding.
 *
 * This used to round the even-length midpoint to an integer, which is harmless
 * for day intervals and destroys money. Any subscription with an even number of
 * charges lost its cents: $22.99 became $23, $14.32 became $14, and every
 * annual-cost figure built on top was wrong by up to a dollar per charge per
 * year. Callers that want a whole number round at the call site, where it is
 * visible.
 */
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const CADENCE_BANDS: { cadence: Cadence; low: number; high: number; perYear: number }[] = [
  { cadence: "weekly", low: 6, high: 8, perYear: 52 },
  { cadence: "fortnightly", low: 12, high: 16, perYear: 26 },
  { cadence: "monthly", low: 26, high: 35, perYear: 12 },
  { cadence: "quarterly", low: 84, high: 98, perYear: 4 },
  { cadence: "annual", low: 350, high: 380, perYear: 1 },
];

export function classifyCadence(intervalDays: number): { cadence: Cadence; perYear: number } {
  const band = CADENCE_BANDS.find((b) => intervalDays >= b.low && intervalDays <= b.high);
  return band ? { cadence: band.cadence, perYear: band.perYear } : { cadence: "irregular", perYear: 0 };
}

export interface DetectOptions {
  /** Charges after this date are money still leaving the estate. */
  dateOfDeath?: string;
  /** Minimum charges before a pattern is called recurring. */
  minOccurrences?: number;
}

/**
 * Find recurring charges across one or more statement batches.
 *
 * Three signals decide confidence: how many times it charged, how regular the
 * spacing was, and how stable the amount is. Irregular spacing is reported
 * rather than discarded — a quarterly insurance premium billed on varying
 * days is still a subscription somebody has to cancel.
 */
export function detectRecurring(
  batches: TransactionBatch[],
  opts: DetectOptions = {},
): RecurringCharge[] {
  const minOcc = opts.minOccurrences ?? 3;
  const groups = new Map<
    string,
    { batch: TransactionBatch; merchant: string; rows: Transaction[]; raw: Set<string> }
  >();

  // Canonicalise per account, so a city suffix on some charges does not split
  // one vendor into two.
  const canonByAccount = new Map<string, Map<string, string>>();
  for (const batch of batches) {
    const keys = batch.transactions
      .filter((t) => t.amount < 0)
      .map((t) => normaliseMerchant(t.description))
      .filter(Boolean);
    const existing = canonByAccount.get(batch.account) ?? new Map<string, string>();
    for (const [k, v] of canonicalise([...existing.keys(), ...keys])) existing.set(k, v);
    canonByAccount.set(batch.account, existing);
  }

  for (const batch of batches) {
    for (const t of batch.transactions) {
      // Only money leaving the account can be a subscription.
      if (t.amount >= 0) continue;
      const raw = normaliseMerchant(t.description);
      if (!raw) continue;
      const merchant = canonByAccount.get(batch.account)?.get(raw) ?? raw;
      const key = `${batch.account}::${merchant}`;
      const g = groups.get(key) ?? { batch, merchant, rows: [], raw: new Set<string>() };
      g.rows.push(t);
      g.raw.add(t.description);
      groups.set(key, g);
    }
  }

  const out: RecurringCharge[] = [];

  for (const [key, g] of groups) {
    const rows = [...g.rows].sort((a, b) => a.date.localeCompare(b.date));
    const intervals: number[] = [];
    for (let i = 1; i < rows.length; i++) intervals.push(days(rows[i - 1].date, rows[i].date));
    if (intervals.length === 0) continue;

    // Whole days: an interval is reported and banded as a day count.
    const medianInterval = Math.round(median(intervals));
    const { cadence, perYear } = classifyCadence(medianInterval);

    // An annual renewal seen only twice is still a subscription, and is exactly
    // the kind that ambushes an estate months later. Everything else needs the
    // full occurrence count before it is called recurring.
    const annualPair = cadence === "annual" && rows.length >= 2;
    if (rows.length < minOcc && !annualPair) continue;

    const amounts = rows.map((r) => Math.abs(r.amount));
    const typical = median(amounts);
    const spread = Math.max(...amounts) - Math.min(...amounts);
    const variance = typical > 0 ? spread / typical : 0;
    const amountVaries = variance > 0.15;

    // Regularity: how far the intervals stray from their own median.
    const drift =
      intervals.reduce((s, i) => s + Math.abs(i - medianInterval), 0) / intervals.length;
    const regular = medianInterval > 0 && drift / medianInterval <= 0.25;

    let confidence: RecurringCharge["confidence"] = "low";
    if (rows.length >= 4 && regular && !amountVaries) confidence = "high";
    else if (rows.length >= 3 && (regular || !amountVaries)) confidence = "medium";

    // A charge that triples between occurrences is shopping, not a
    // subscription — even a seasonal utility does not swing that far. Regular
    // spacing alone is not enough to call it recurring, because people shop on
    // a rhythm too.
    if (variance > 0.6) confidence = "low";

    const lastSeen = rows[rows.length - 1].date;
    const chargedAfterDeath = Boolean(opts.dateOfDeath && lastSeen > opts.dateOfDeath);

    out.push({
      id: key,
      merchant: displayMerchant(g.merchant),
      rawDescriptions: [...g.raw],
      account: g.batch.account,
      institution: g.batch.institution,
      cadence,
      medianIntervalDays: medianInterval,
      amount: typical,
      amountVaries,
      occurrences: rows.length,
      firstSeen: rows[0].date,
      lastSeen,
      annualCostUsd: perYear > 0 ? Math.round(typical * perYear) : Math.round(typical * (365 / Math.max(medianInterval, 1))),
      chargedAfterDeath,
      confidence,
      evidence: rows.map((r) => r.id),
      sourceDocument: g.batch.sourceDocument,
    });
  }

  // Worst offenders first: still charging, then most expensive.
  return out.sort((a, b) => {
    if (a.chargedAfterDeath !== b.chargedAfterDeath) return a.chargedAfterDeath ? -1 : 1;
    return b.annualCostUsd - a.annualCostUsd;
  });
}

export interface BleedSummary {
  count: number;
  stillCharging: number;
  annualUsd: number;
  /** What the estate loses each month these stay open. */
  monthlyUsd: number;
  highConfidence: number;
}

export function summariseBleed(charges: RecurringCharge[]): BleedSummary {
  const annual = charges.reduce((s, c) => s + c.annualCostUsd, 0);
  return {
    count: charges.length,
    stillCharging: charges.filter((c) => c.chargedAfterDeath).length,
    annualUsd: annual,
    monthlyUsd: Math.round(annual / 12),
    highConfidence: charges.filter((c) => c.confidence === "high").length,
  };
}
