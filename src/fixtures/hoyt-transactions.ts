// A year of transactions from the Wells Fargo checking account.
//
// Written the way a bank actually prints descriptors — processor prefixes,
// store numbers, reference ids and a trailing city and state — because the
// whole difficulty of subscription detection is that the same vendor never
// looks the same twice.
//
// Margaret died on 4 January 2026. Several of these keep charging afterwards,
// which is the point: this is money leaving the estate every month while
// nobody is looking.

import type { TransactionBatch, Transaction } from "../lib/transactions";

let seq = 0;
const tx = (date: string, description: string, amount: number): Transaction => ({
  id: `wf-${String(++seq).padStart(3, "0")}`,
  account: "asset.checking",
  date,
  description,
  amount,
});

/** Monthly charge on a given day, with the descriptor noise a bank adds. */
function monthly(
  months: string[],
  day: string,
  describe: (m: string) => string,
  amount: number | ((m: string) => number),
): Transaction[] {
  return months.map((m) =>
    tx(`${m}-${day}`, describe(m), -(typeof amount === "function" ? amount(m) : amount)),
  );
}

const M_2025 = [
  "2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07",
  "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
];
const THROUGH_DEATH = [...M_2025, "2026-01"];
const PAST_DEATH = [...THROUGH_DEATH, "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"];

const rows: Transaction[] = [
  // Still charging six months after death — 22.99 a month, nobody noticed.
  ...monthly(PAST_DEATH, "14", () => "NETFLIX.COM 866-579-7172 CA", 22.99),

  // Also still charging. Descriptor changes shape halfway through the year,
  // which is exactly what breaks naive string grouping.
  ...monthly(M_2025.slice(0, 6), "03", () => "SPOTIFY USA 8772761994 NY", 11.99),
  ...monthly([...M_2025.slice(6), "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"], "03",
    (m) => `SQ *SPOTIFY USA ${m.replace("-", "")}0031 NEW YORK NY`, 11.99),

  // Annual software renewal, due again in September.
  tx("2024-09-22", "ADOBE SYSTEMS 408-536-6000 CA", -239.88),
  tx("2025-09-22", "ADOBE  SYSTEMS INC #4471 SAN JOSE CA", -263.88),

  // Gym: fixed-term contract, still billing.
  ...monthly(PAST_DEATH, "05", () => "24 HOUR FITNESS USA 8009514204 CA", 49.99),

  // Storage unit — holds estate property, so this is marshalling, not just billing.
  ...monthly(PAST_DEATH, "01", () => "PUBLIC STORAGE 08822 SAN MATEO CA", 189.0),

  // Utility. Must be transferred, not cancelled — the house is still standing.
  ...monthly(THROUGH_DEATH, "18", (m) => `PG&E ${m.replace("-", "")} WEB PMT`,
    (m) => (["2025-12", "2026-01"].includes(m) ? 214.4 : 138.6)),

  // Telephone. Two-factor codes for her financial accounts arrive here.
  ...monthly(PAST_DEATH, "22", () => "AT&T MOBILITY 800-331-0500 TX", 84.32),

  // Homeowner's policy. Cancelling this on a house the estate still holds
  // would be a serious mistake.
  tx("2025-03-11", "STATE FARM INSURANCE 8007828332 IL", -1_842.0),
  tx("2026-03-11", "STATE FARM  INSURANCE  8007828332 IL", -1_918.0),

  // The one nobody knows about.
  //
  // $14.32 a month to a life insurer. There is no policy document anywhere in
  // the data room, no statement, no letter, and the family has never mentioned
  // it — the only trace this policy leaves in the world is this debit. The
  // standard professional advice for finding a deceased parent's life cover is
  // to read a year of bank statements by hand looking for exactly this.
  //
  // Deliberately small. A $14 line is beneath notice next to a $1,842 one, and
  // that is why it survives a manual review.
  ...monthly(PAST_DEATH, "09", () => "METLIFE PREMIUM 8006384582 NY", 14.32),

  // Second discovery, different shape: an annual box fee. The box itself is an
  // asset that has to be inventoried before the estate can close, and nothing
  // in the data room mentions one exists.
  tx("2024-11-06", "FIRST REPUBLIC SAFE DEPOSIT BOX FEE SAN MATEO CA", -95.0),
  tx("2025-11-06", "FIRST REPUBLIC  SAFE DEPOSIT  BOX FEE  SAN MATEO CA", -95.0),

  // The control. Pacific Mutual IS in the data room — the policy summary is a
  // source document and the ledger already holds it. A discovery pass that
  // re-reports this as a find is crying wolf, and after the third false alarm
  // nobody reads the queue. Suppressing it is as important as surfacing MetLife.
  ...monthly(THROUGH_DEATH, "20", () => "PACIFIC MUTUAL LIFE PREM 8005551234 CA", 87.4),

  // Ordinary spending — must NOT be detected as recurring.
  tx("2025-04-08", "SAFEWAY #1842 SAN MATEO CA", -84.21),
  tx("2025-04-19", "SAFEWAY #1842 SAN MATEO CA", -112.07),
  tx("2025-05-02", "SAFEWAY #1842 SAN MATEO CA", -46.88),
  tx("2025-05-21", "SAFEWAY #1842 SAN MATEO CA", -131.44),
  tx("2025-06-09", "SHELL OIL 57444120108 BURLINGAME CA", -61.20),
  tx("2025-07-14", "SHELL OIL 57444120108 BURLINGAME CA", -58.90),
  tx("2025-08-30", "DR K PATEL MD SAN MATEO CA", -240.0),

  // Income, so the detector must ignore positive amounts.
  ...monthly(THROUGH_DEATH, "03", () => "SOCIAL SECURITY ADMIN SSA TREAS 310 XXSOC SEC", -0),
];

// Social security is a credit, not a debit.
const credits: Transaction[] = THROUGH_DEATH.map((m) =>
  tx(`${m}-03`, "SSA TREAS 310 XXSOC SEC PPD", 2_184.0),
);

export const HOYT_TRANSACTIONS: TransactionBatch = {
  id: "batch.wf.checking",
  account: "asset.checking",
  institution: "Wells Fargo",
  sourceDocument: "Wells Fargo statement Jan 2026.pdf",
  retrievedAt: "2026-07-27",
  periodStart: "2024-09-01",
  periodEnd: "2026-07-27",
  transactions: [...rows.filter((r) => r.amount !== 0), ...credits],
};

export const HOYT_BATCHES: TransactionBatch[] = [HOYT_TRANSACTIONS];
