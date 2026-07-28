// Vendor cancellation policies.
//
// Shutting down a subscription is not one process, it is several hundred. Some
// vendors cancel on an email. Some want a death certificate. Some insist on a
// phone call and will not accept anything in writing until that call has
// happened. A few want a notarised affidavit. Several refund the unused portion
// and several do not, which changes whether cancelling early is worth chasing.
//
// So policies are data, exactly like probate rules — and, exactly like the
// county registry, each carries a provenance status. A policy we have not
// confirmed against the vendor's own published bereavement process is marked
// `unverified` and falls back to a conservative default, rather than being
// asserted with false confidence. Telling an executor that a vendor accepts
// email when it does not simply wastes a week of their life.

import type { DeliveryChannel } from "../lib/formstore";

export type EvidenceKind =
  | "death_certificate"
  | "letters_testamentary"
  | "account_number"
  | "card_last_four"
  | "executor_id"
  | "signed_authorization"
  | "notarised_affidavit"
  | "obituary";

export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  death_certificate: "Certified death certificate",
  letters_testamentary: "Certified Letters",
  account_number: "Account number or login email",
  card_last_four: "Last four digits of the card charged",
  executor_id: "Executor's photo identification",
  signed_authorization: "Signed authorisation from the executor",
  notarised_affidavit: "Notarised affidavit",
  obituary: "Published obituary or death notice",
};

export type VendorCategory =
  | "streaming"
  | "software"
  | "fitness"
  | "storage"
  | "utility"
  | "telecom"
  | "insurance"
  | "membership"
  | "delivery"
  | "other";

export interface VendorPolicy {
  id: string;
  vendor: string;
  /** Normalised merchant strings that route to this policy. */
  aliases: string[];
  category: VendorCategory;
  channels: DeliveryChannel[];
  /** True where the vendor will not accept paperwork before a call. */
  phoneFirst: boolean;
  requires: EvidenceKind[];
  turnaroundDays: [number, number];
  refundsUnusedPortion: boolean | "unknown";
  notes?: string;
  provenance: {
    status: "verified" | "unverified";
    source?: string;
    retrievedAt?: string;
  };
}

/**
 * Applied where no vendor-specific policy is known.
 *
 * Deliberately over-cautious: it assumes the vendor will want the strongest
 * evidence and the slowest channel. Over-preparing costs a photocopy;
 * under-preparing costs a round trip.
 */
export const DEFAULT_POLICY: Omit<VendorPolicy, "id" | "vendor" | "aliases"> = {
  category: "other",
  channels: ["email", "postal"],
  phoneFirst: false,
  requires: ["death_certificate", "account_number", "signed_authorization"],
  turnaroundDays: [7, 30],
  refundsUnusedPortion: "unknown",
  notes:
    "No confirmed bereavement process for this vendor. Assume the strongest evidence will be asked for, and confirm the channel before sending anything.",
  provenance: { status: "unverified" },
};

/**
 * Category-level defaults.
 *
 * These are structural observations about how each kind of business tends to
 * operate rather than claims about a specific company, which is why they are
 * still marked unverified at the vendor level.
 */
export const CATEGORY_DEFAULTS: Partial<Record<VendorCategory, Partial<VendorPolicy>>> = {
  streaming: {
    channels: ["portal", "email"],
    requires: ["account_number"],
    turnaroundDays: [1, 7],
    refundsUnusedPortion: false,
    notes:
      "Consumer streaming accounts can usually be closed from the account portal without evidence of death, which is faster than a bereavement process. Cancel first, then ask about a refund.",
  },
  software: {
    channels: ["portal", "email"],
    requires: ["account_number"],
    turnaroundDays: [1, 14],
    refundsUnusedPortion: "unknown",
  },
  fitness: {
    channels: ["email", "postal", "in_person"],
    requires: ["death_certificate", "account_number"],
    turnaroundDays: [14, 45],
    refundsUnusedPortion: true,
    notes:
      "Gym contracts are the classic trap: many are fixed-term and continue billing through a notice period unless death is evidenced. Send the certificate early.",
  },
  storage: {
    channels: ["phone_first", "email", "postal"],
    requires: ["death_certificate", "letters_testamentary", "account_number"],
    turnaroundDays: [7, 30],
    refundsUnusedPortion: true,
    notes:
      "Storage units hold estate property, so this is a marshalling task as much as a cancellation. Do not let the unit be auctioned for arrears.",
  },
  utility: {
    channels: ["phone_first", "portal", "postal"],
    requires: ["death_certificate", "account_number", "executor_id"],
    turnaroundDays: [3, 21],
    refundsUnusedPortion: true,
    notes:
      "Do not simply cancel. If the property is being sold or occupied, service must be transferred rather than terminated, or the estate risks frozen pipes and a void insurance policy.",
  },
  telecom: {
    channels: ["phone_first", "in_person"],
    requires: ["death_certificate", "account_number", "executor_id"],
    turnaroundDays: [1, 21],
    refundsUnusedPortion: true,
    notes:
      "Keep the number live until the estate is settled where possible: two-factor codes for the decedent's financial accounts often arrive on it.",
  },
  insurance: {
    channels: ["postal", "email"],
    requires: ["death_certificate", "letters_testamentary", "account_number"],
    turnaroundDays: [14, 60],
    refundsUnusedPortion: true,
    notes:
      "Never cancel property insurance on an asset the estate still holds. Convert it, do not terminate it.",
  },
  membership: {
    channels: ["email", "postal"],
    requires: ["death_certificate", "account_number"],
    turnaroundDays: [7, 30],
    refundsUnusedPortion: true,
  },
};

/**
 * Known vendors.
 *
 * The list is intentionally short. Every entry here is marked `unverified`
 * because none has been confirmed against the vendor's own published
 * bereavement process — that is a research task, and asserting otherwise
 * would be the same failure as an uncited statutory threshold.
 */
export const VENDOR_POLICIES: VendorPolicy[] = [
  {
    id: "vendor.netflix",
    vendor: "Netflix",
    aliases: ["netflix", "netflix.com"],
    ...DEFAULT_POLICY,
    ...CATEGORY_DEFAULTS.streaming,
    category: "streaming",
    provenance: { status: "unverified" },
  } as VendorPolicy,
  {
    id: "vendor.spotify",
    vendor: "Spotify",
    aliases: ["spotify", "spotify usa"],
    ...DEFAULT_POLICY,
    ...CATEGORY_DEFAULTS.streaming,
    category: "streaming",
    provenance: { status: "unverified" },
  } as VendorPolicy,
  {
    id: "vendor.adobe",
    vendor: "Adobe",
    aliases: ["adobe", "adobe systems", "adobe creative cloud"],
    ...DEFAULT_POLICY,
    ...CATEGORY_DEFAULTS.software,
    category: "software",
    provenance: { status: "unverified" },
  } as VendorPolicy,
  {
    id: "vendor.24hr_fitness",
    vendor: "24 Hour Fitness",
    aliases: ["24 hour fitness", "24hr fitness", "24hourfit"],
    ...DEFAULT_POLICY,
    ...CATEGORY_DEFAULTS.fitness,
    category: "fitness",
    provenance: { status: "unverified" },
  } as VendorPolicy,
  {
    id: "vendor.public_storage",
    vendor: "Public Storage",
    aliases: ["public storage", "publicstorage"],
    ...DEFAULT_POLICY,
    ...CATEGORY_DEFAULTS.storage,
    category: "storage",
    phoneFirst: true,
    provenance: { status: "unverified" },
  } as VendorPolicy,
  {
    id: "vendor.pge",
    vendor: "Pacific Gas & Electric",
    aliases: ["pg e", "pge", "pacific gas", "pacific gas electric"],
    ...DEFAULT_POLICY,
    ...CATEGORY_DEFAULTS.utility,
    category: "utility",
    phoneFirst: true,
    provenance: { status: "unverified" },
  } as VendorPolicy,
  {
    id: "vendor.att",
    vendor: "AT&T",
    aliases: ["at t", "att", "at t mobility"],
    ...DEFAULT_POLICY,
    ...CATEGORY_DEFAULTS.telecom,
    category: "telecom",
    phoneFirst: true,
    provenance: { status: "unverified" },
  } as VendorPolicy,
  {
    id: "vendor.statefarm",
    vendor: "State Farm",
    aliases: ["state farm", "statefarm"],
    ...DEFAULT_POLICY,
    ...CATEGORY_DEFAULTS.insurance,
    category: "insurance",
    provenance: { status: "unverified" },
  } as VendorPolicy,
];

/** Match a detected merchant to a policy, falling back to the conservative default. */
export function policyFor(merchant: string): VendorPolicy {
  const key = merchant.toLowerCase().trim();
  const hit = VENDOR_POLICIES.find((p) =>
    p.aliases.some((a) => key === a || key.startsWith(a + " ") || key.includes(a)),
  );
  if (hit) return hit;
  return {
    id: `vendor.unknown.${key.replace(/\s+/g, "-")}`,
    vendor: merchant,
    aliases: [key],
    ...DEFAULT_POLICY,
  };
}

// ---------------------------------------------------------------------------
// Jurisdiction overlay
// ---------------------------------------------------------------------------

export interface StateOverlay {
  state: string;
  additionalEvidence: EvidenceKind[];
  notes: string[];
  status: "verified" | "not_researched";
}

/**
 * State-level consumer rules affect what a vendor may demand and how quickly it
 * must stop billing. That dimension is modelled here, and is currently
 * unpopulated: no state's rules have been read against primary sources.
 *
 * It is surfaced as a known gap rather than silently returning "no additional
 * requirements", because an executor cancelling an out-of-state contract needs
 * to know we have not checked rather than to infer that we have.
 */
export const STATE_OVERLAYS: StateOverlay[] = [];

export function overlayFor(state: string): StateOverlay {
  return (
    STATE_OVERLAYS.find((o) => o.state === state) ?? {
      state,
      additionalEvidence: [],
      notes: [
        `Consumer cancellation rules for ${state} have not been researched. Where the vendor is outside California, confirm the governing state's requirements before relying on this plan.`,
      ],
      status: "not_researched",
    }
  );
}
