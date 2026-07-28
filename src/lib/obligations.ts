// Obligations — everything that has to be shut down, moved or claimed.
//
// Hugh's description of the job: "There's debt. There's credit cards. There's
// airline miles points. All these things have to be dealt with. I haven't even
// gotten to the hard part yet, which is all the bills that keep coming in every
// day. It all has to be shut down."
//
// A cancelled subscription and a marshalled bank account are the same shape of
// work: something exists, someone has to be told, that someone requires
// particular evidence delivered by a particular channel, and the result has to
// be recorded so a beneficiary can later be shown it was done. Modelling them
// separately would mean writing the same tracking machinery several times and
// getting it inconsistently wrong.
//
// So there is one engine. Subscriptions are the noisiest instance of it, not a
// special case.

import type { Fact, FactKey } from "./facts";
import { ledger } from "./facts";
import type { DeliveryChannel } from "./formstore";
import type { RecurringCharge } from "./transactions";
import {
  EVIDENCE_LABEL,
  overlayFor,
  policyFor,
  type EvidenceKind,
  type VendorPolicy,
} from "../rules/vendors";

export type ObligationKind =
  | "cancel_subscription"
  | "transfer_utility"
  | "notify_institution"
  | "close_account"
  | "transfer_asset"
  | "claim_benefit"
  | "redirect_mail";

export const KIND_LABEL: Record<ObligationKind, string> = {
  cancel_subscription: "Cancel subscription",
  transfer_utility: "Transfer or suspend utility",
  notify_institution: "Notify institution of death",
  close_account: "Close or marshal account",
  transfer_asset: "Transfer asset",
  claim_benefit: "Claim benefit",
  redirect_mail: "Redirect mail",
};

export type ObligationStatus = "blocked" | "ready" | "sent" | "confirmed" | "not_applicable";

export interface EvidenceRequirement {
  kind: EvidenceKind;
  label: string;
  /** Whether the estate currently holds it. */
  held: boolean;
  /** Fact key that would prove we hold it. */
  factKey?: FactKey;
}

export interface Obligation {
  id: string;
  kind: ObligationKind;
  /** What this is about — a vendor, an institution, an asset. */
  subject: string;
  rationale: string;
  /** Money still leaving the estate each year while this stays open. */
  annualBleedUsd: number;
  /** True where charges have landed since the death. */
  urgent: boolean;
  channel: DeliveryChannel;
  channelsAccepted: DeliveryChannel[];
  phoneFirst: boolean;
  evidence: EvidenceRequirement[];
  steps: string[];
  status: ObligationStatus;
  blockedBy: string[];
  /** Where the policy came from, and whether it was confirmed. */
  policyProvenance: VendorPolicy["provenance"];
  jurisdictionNotes: string[];
  /** Transaction ids or fact keys backing this. */
  evidenceRefs: string[];
  turnaroundDays: [number, number];
  refundsUnusedPortion: boolean | "unknown";
}

/** What the estate can currently prove, derived from the ledger. */
export interface EvidenceHoldings {
  death_certificate: boolean;
  letters_testamentary: boolean;
  executor_id: boolean;
  signed_authorization: boolean;
  notarised_affidavit: boolean;
  obituary: boolean;
  account_number: boolean;
  card_last_four: boolean;
}

export function holdingsFrom(facts: Fact[]): EvidenceHoldings {
  const current = ledger(facts);
  return {
    // A verified date of death means we have read the certificate.
    death_certificate: current.has("decedent.date_of_death"),
    letters_testamentary: current.has("estate.letters_issued_date"),
    executor_id: current.has("estate.petitioner_name"),
    // The executor can always sign; it costs nothing but their time.
    signed_authorization: current.has("estate.petitioner_name"),
    notarised_affidavit: false,
    obituary: false,
    account_number: true,
    card_last_four: true,
  };
}

function requirements(
  policy: VendorPolicy,
  extra: EvidenceKind[],
  holdings: EvidenceHoldings,
): EvidenceRequirement[] {
  const kinds = [...new Set([...policy.requires, ...extra])];
  return kinds.map((kind) => ({
    kind,
    label: EVIDENCE_LABEL[kind],
    held: holdings[kind] ?? false,
  }));
}

function pickChannel(policy: VendorPolicy): DeliveryChannel {
  const preference: DeliveryChannel[] = ["portal", "email", "fax", "postal", "in_person"];
  return preference.find((c) => policy.channels.includes(c)) ?? "postal";
}

function buildSteps(
  policy: VendorPolicy,
  channel: DeliveryChannel,
  evidence: EvidenceRequirement[],
  urgent: boolean,
): string[] {
  const steps: string[] = [];
  if (urgent) {
    steps.push("Charges have landed since the death — action this before the next billing date.");
  }
  if (policy.phoneFirst) {
    steps.push(
      `Telephone ${policy.vendor} first. They will not accept paperwork until the death has been reported by phone, and the call establishes what they then require.`,
    );
  }
  const missing = evidence.filter((e) => !e.held);
  if (missing.length > 0) {
    steps.push(`Obtain: ${missing.map((m) => m.label.toLowerCase()).join(", ")}.`);
  }
  steps.push(
    `Send the cancellation request to ${policy.vendor} by ${channel.replace("_", " ")}, enclosing ${
      evidence.length ? evidence.map((e) => e.label.toLowerCase()).join(", ") : "the account identifier"
    }.`,
  );
  if (policy.refundsUnusedPortion === true) {
    steps.push("Ask for a refund of the unused portion — this vendor category commonly gives one.");
  } else if (policy.refundsUnusedPortion === "unknown") {
    steps.push("Ask whether the unused portion is refundable; it is not known for this vendor.");
  }
  steps.push(
    `Expect confirmation in ${policy.turnaroundDays[0]}–${policy.turnaroundDays[1]} days. Record it against the estate when it arrives.`,
  );
  return steps;
}

/** Turn detected recurring charges into cancellation obligations. */
export function subscriptionObligations(
  charges: RecurringCharge[],
  facts: Fact[],
  opts: { state?: string } = {},
): Obligation[] {
  const holdings = holdingsFrom(facts);
  const overlay = overlayFor(opts.state ?? "CA");

  return charges.map((c) => {
    const policy = policyFor(c.merchant);
    const evidence = requirements(policy, overlay.additionalEvidence, holdings);
    const channel = pickChannel(policy);
    const blockedBy = evidence.filter((e) => !e.held).map((e) => e.label);

    const isUtility = policy.category === "utility" || policy.category === "insurance";

    return {
      id: `oblig.sub.${c.id}`,
      kind: isUtility ? "transfer_utility" : "cancel_subscription",
      subject: c.merchant,
      rationale: isUtility
        ? `${c.cadence} charge of $${c.amount.toLocaleString("en-US")} from ${c.institution}. This is a utility or policy — decide whether to transfer or suspend rather than terminate.`
        : `${c.cadence} charge of $${c.amount.toLocaleString("en-US")} seen ${c.occurrences} times on ${c.institution}, most recently ${c.lastSeen}.`,
      annualBleedUsd: c.annualCostUsd,
      urgent: c.chargedAfterDeath,
      channel,
      channelsAccepted: policy.channels,
      phoneFirst: policy.phoneFirst,
      evidence,
      steps: buildSteps(policy, channel, evidence, c.chargedAfterDeath),
      status: blockedBy.length ? "blocked" : "ready",
      blockedBy,
      policyProvenance: policy.provenance,
      jurisdictionNotes: overlay.notes,
      evidenceRefs: c.evidence,
      turnaroundDays: policy.turnaroundDays,
      refundsUnusedPortion: policy.refundsUnusedPortion,
    } satisfies Obligation;
  });
}

/**
 * Obligations that arise from assets rather than from charges.
 *
 * This is where the model generalises past subscriptions: every account,
 * policy and registered asset in the ledger produces the same shape of work.
 */
export function assetObligations(facts: Fact[], opts: { state?: string } = {}): Obligation[] {
  const current = ledger(facts);
  const holdings = holdingsFrom(facts);
  const overlay = overlayFor(opts.state ?? "CA");
  const out: Obligation[] = [];

  for (const [key, fact] of current) {
    const m = /^asset\.([^.]+)\.value$/.exec(key);
    if (!m) continue;
    const id = m[1];
    if (id === "residence") continue; // handled by the probate route, not here

    const isVehicle = current.get(`asset.${id}.registered_vehicle`)?.value === true;
    const hasBeneficiary = current.get(`asset.${id}.has_named_beneficiary`)?.value === true;

    const kind: ObligationKind = isVehicle
      ? "transfer_asset"
      : hasBeneficiary
        ? "claim_benefit"
        : "close_account";

    const required: EvidenceKind[] = hasBeneficiary
      ? ["death_certificate", "account_number"]
      : ["death_certificate", "letters_testamentary", "account_number"];

    const evidence = required.map((k) => ({
      kind: k,
      label: EVIDENCE_LABEL[k],
      held: holdings[k] ?? false,
    }));
    const blockedBy = evidence.filter((e) => !e.held).map((e) => e.label);

    out.push({
      id: `oblig.asset.${id}`,
      kind,
      subject: fact.label,
      rationale: hasBeneficiary
        ? "Passes outside probate to a named beneficiary — claim it rather than marshalling it into the estate."
        : isVehicle
          ? "Registered vehicle. Transfers at the DMV and never enters the probate estate."
          : "Held in the decedent's sole name. The institution must be notified and the balance marshalled.",
      annualBleedUsd: 0,
      urgent: false,
      channel: "postal",
      channelsAccepted: ["postal", "fax"],
      phoneFirst: kind === "close_account",
      evidence,
      steps: [
        kind === "close_account"
          ? "Telephone the institution to report the death and open the estate file — many will not accept paperwork first."
          : "Contact the administrator to begin the claim.",
        `Send the request enclosing ${evidence.map((e) => e.label.toLowerCase()).join(", ")}.`,
        "Request the balance as at the date of death for the inventory.",
      ],
      status: blockedBy.length ? "blocked" : "ready",
      blockedBy,
      policyProvenance: { status: "unverified" },
      jurisdictionNotes: overlay.notes,
      evidenceRefs: [key],
      turnaroundDays: [14, 60],
      refundsUnusedPortion: "unknown",
    });
  }

  return out;
}

export interface ObligationBoard {
  obligations: Obligation[];
  byStatus: Record<ObligationStatus, number>;
  urgent: Obligation[];
  /** Annual money still leaving the estate across everything unactioned. */
  annualBleedUsd: number;
  monthlyBleedUsd: number;
  /** Obligations resting on a policy nobody has confirmed. */
  unverifiedPolicies: number;
  readyToSend: number;
}

export function board(obligations: Obligation[]): ObligationBoard {
  const byStatus: Record<ObligationStatus, number> = {
    blocked: 0,
    ready: 0,
    sent: 0,
    confirmed: 0,
    not_applicable: 0,
  };
  for (const o of obligations) byStatus[o.status] += 1;

  const open = obligations.filter((o) => o.status === "blocked" || o.status === "ready");
  const annual = open.reduce((s, o) => s + o.annualBleedUsd, 0);

  return {
    obligations: [...obligations].sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      return b.annualBleedUsd - a.annualBleedUsd;
    }),
    byStatus,
    urgent: obligations.filter((o) => o.urgent),
    annualBleedUsd: annual,
    monthlyBleedUsd: Math.round(annual / 12),
    unverifiedPolicies: obligations.filter((o) => o.policyProvenance.status === "unverified").length,
    readyToSend: byStatus.ready,
  };
}
