// The universal document store.
//
// The naive model of a form is "DE-111". That fails immediately, because the
// identifier printed on a PDF is not unique. DE-111 means something only within
// the California Judicial Council. PRO 010 exists only in Los Angeles. "Form 56"
// is an IRS form, but plenty of banks print their own Form 56. Two counties can
// use the same number for different paper, and the same paper changes when a
// revision is issued.
//
// So a form is identified by a composite: who issued it, what they print on it,
// and which revision. Everything else an operator needs in order to actually
// use the form — who fills it, who signs it, where it has to go and by what
// channel — hangs off that identity, because a filled PDF sitting on a disk has
// not settled anything. It has to reach a named recipient by a channel that
// recipient accepts.
//
// The delivery model is deliberately unglamorous: a great many institutions
// still want fax or postal mail, and several require a telephone call before
// they will accept any paperwork at all.

import type { FieldBinding } from "./anvil";

export type IssuerKind =
  | "judicial_council"
  | "court"
  | "state_agency"
  | "federal_agency"
  | "institution";

export interface Issuer {
  kind: IssuerKind;
  /** Display name, e.g. "California Judicial Council", "JPMorgan Chase". */
  name: string;
  state?: string;
  county?: string;
}

export type JurisdictionLevel = "federal" | "state" | "county" | "institution";

export interface Jurisdiction {
  level: JurisdictionLevel;
  state?: string;
  county?: string;
  institution?: string;
}

/**
 * How a completed form actually reaches its recipient. `phone_first` is not a
 * delivery method — it records that the institution requires a call before it
 * will accept anything, which is the single most common reason a filed form
 * bounces.
 */
export type DeliveryChannel =
  | "efile"
  | "email"
  | "fax"
  | "postal"
  | "portal"
  | "in_person"
  | "phone_first";

export type PartyRole = "preparer" | "signer" | "notary" | "witness" | "recipient";

export interface Party {
  role: PartyRole;
  /** Who fills this role — a fact key where the estate supplies it. */
  who: string;
  factKey?: string;
}

/** Where a signature block sits on the page, in PDF points. */
export interface SignatureField {
  id: string;
  signerRole: string;
  type: "signature" | "initial" | "signatureDate" | "textInput";
  pageNum: number;
  rect: { x: number; y: number; width: number; height: number };
}

export interface Delivery {
  channels: DeliveryChannel[];
  /** Who receives the completed form. */
  recipient: string;
  /** Anything an operator must know before sending. */
  notes?: string;
}

export interface FormRecord {
  /** Composite key. Stable, and unique where a printed id is not. */
  key: string;
  /** What is actually printed on the paper. Not unique on its own. */
  printedId: string;
  title: string;
  issuer: Issuer;
  jurisdiction: Jurisdiction;
  /** Revision or effective date printed on the form. */
  revision?: string;
  sourceUrl: string;
  retrievedAt: string;
  parties: Party[];
  delivery: Delivery;
  signatures: SignatureField[];
  requiresNotary: boolean;
  requiresOriginal: boolean;
  fields: FieldBinding[];
  /** Anvil cast eid once registered. */
  anvilTemplateId?: string;
  /** Key of the record this one replaces. */
  supersedes?: string;
  notes?: string;
}

/** Build the composite key. Kept in one place so it cannot drift. */
export function formKey(issuer: Issuer, printedId: string, revision?: string): string {
  const scope = [
    issuer.kind,
    issuer.state?.toLowerCase(),
    issuer.county?.toLowerCase().replace(/\s+/g, "-"),
    issuer.kind === "institution" ? issuer.name.toLowerCase().replace(/\s+/g, "-") : undefined,
  ]
    .filter(Boolean)
    .join(".");
  const id = printedId.toLowerCase().replace(/\s+/g, "-");
  return revision ? `${scope}.${id}@${revision}` : `${scope}.${id}`;
}

export interface ResolveQuery {
  printedId: string;
  state?: string;
  county?: string;
  institution?: string;
}

export interface Resolution {
  /** Exactly one match — safe to use. */
  form?: FormRecord;
  /** More than one issuer prints this id; the caller must disambiguate. */
  ambiguous: FormRecord[];
  reason: string;
}

/**
 * Resolve a printed identifier to a single form record.
 *
 * Ambiguity is returned rather than guessed at. Picking the wrong DE-111 —
 * the wrong revision, or a county's local variant — produces a filing that
 * looks right and is rejected, which is the failure this store exists to stop.
 */
export function resolveForm(store: FormRecord[], q: ResolveQuery): Resolution {
  const byId = store.filter(
    (f) => f.printedId.toLowerCase() === q.printedId.toLowerCase(),
  );
  if (byId.length === 0) {
    return { ambiguous: [], reason: `No form in the store prints the identifier "${q.printedId}".` };
  }

  const scoped = byId.filter((f) => {
    const j = f.jurisdiction;
    if (j.level === "federal") return true;
    if (j.level === "state") return !q.state || j.state === q.state;
    if (j.level === "county") return (!q.state || j.state === q.state) && (!q.county || j.county === q.county);
    if (j.level === "institution") return !q.institution || j.institution === q.institution;
    return true;
  });

  if (scoped.length === 1) return { form: scoped[0], ambiguous: [], reason: "Unique match." };
  if (scoped.length === 0) {
    return {
      ambiguous: byId,
      reason: `"${q.printedId}" exists, but not for this jurisdiction. ${byId.length} other issuer(s) print it.`,
    };
  }

  // Prefer the most specific jurisdiction that still matches.
  const rank: Record<JurisdictionLevel, number> = {
    institution: 0,
    county: 1,
    state: 2,
    federal: 3,
  };
  const best = [...scoped].sort((a, b) => rank[a.jurisdiction.level] - rank[b.jurisdiction.level]);
  if (rank[best[0].jurisdiction.level] < rank[best[1].jurisdiction.level]) {
    return { form: best[0], ambiguous: [], reason: "Most specific jurisdiction wins." };
  }

  return {
    ambiguous: scoped,
    reason: `"${q.printedId}" is printed by ${scoped.length} issuers at the same level. Disambiguate by issuer or revision.`,
  };
}

/** Everything the store holds for one jurisdiction, federal forms included. */
export function formsFor(store: FormRecord[], q: { state?: string; county?: string }): FormRecord[] {
  return store.filter((f) => {
    const j = f.jurisdiction;
    if (j.level === "federal") return true;
    if (j.level === "state") return j.state === q.state;
    if (j.level === "county") return j.state === q.state && j.county === q.county;
    return false;
  });
}

export interface StoreCoverage {
  total: number;
  byIssuerKind: Record<string, number>;
  withAnvilTemplate: number;
  requiringWetSignature: number;
  requiringPhoneFirst: number;
  channels: Record<string, number>;
}

export function coverage(store: FormRecord[]): StoreCoverage {
  const byIssuerKind: Record<string, number> = {};
  const channels: Record<string, number> = {};
  for (const f of store) {
    byIssuerKind[f.issuer.kind] = (byIssuerKind[f.issuer.kind] ?? 0) + 1;
    for (const c of f.delivery.channels) channels[c] = (channels[c] ?? 0) + 1;
  }
  return {
    total: store.length,
    byIssuerKind,
    withAnvilTemplate: store.filter((f) => f.anvilTemplateId).length,
    requiringWetSignature: store.filter((f) => f.requiresOriginal || f.requiresNotary).length,
    requiringPhoneFirst: store.filter((f) => f.delivery.channels.includes("phone_first")).length,
    channels,
  };
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export type DispatchStatus = "ready" | "blocked" | "manual";

export interface DispatchPlan {
  formKey: string;
  printedId: string;
  recipient: string;
  /** The channel we would actually use, chosen from those accepted. */
  channel: DeliveryChannel;
  status: DispatchStatus;
  steps: string[];
  blockers: string[];
}

/**
 * Decide how a completed form gets delivered.
 *
 * Channel preference runs cheapest-and-fastest first, but two things override
 * it: a form requiring a wet original or notarisation cannot be delivered
 * electronically no matter what the recipient accepts, and an institution that
 * insists on a call first has to be called first.
 */
export function planDispatch(form: FormRecord, opts: { signed: boolean }): DispatchPlan {
  const steps: string[] = [];
  const blockers: string[] = [];

  if (form.signatures.length > 0 && !opts.signed) {
    blockers.push("Not yet signed — the signature block is defined but no signature is recorded.");
  }
  if (form.requiresNotary) {
    steps.push("Have the signature notarised before dispatch.");
  }

  const accepted = form.delivery.channels;
  if (accepted.includes("phone_first")) {
    steps.push(
      `Telephone ${form.delivery.recipient} first to notify them of the death and confirm their current requirements.`,
    );
  }

  const electronicBarred = form.requiresOriginal || form.requiresNotary;
  const preference: DeliveryChannel[] = electronicBarred
    ? ["postal", "in_person", "fax"]
    : ["efile", "portal", "email", "fax", "postal", "in_person"];

  const channel = preference.find((c) => accepted.includes(c));

  if (!channel) {
    return {
      formKey: form.key,
      printedId: form.printedId,
      recipient: form.delivery.recipient,
      channel: "postal",
      status: "manual",
      steps: [...steps, "No supported channel — handle manually."],
      blockers,
    };
  }

  if (electronicBarred) {
    steps.push("An original with a wet signature is required — print and send physically.");
  }
  steps.push(`Send by ${channel.replace("_", " ")} to ${form.delivery.recipient}.`);
  if (form.delivery.notes) steps.push(form.delivery.notes);

  return {
    formKey: form.key,
    printedId: form.printedId,
    recipient: form.delivery.recipient,
    channel,
    status: blockers.length ? "blocked" : channel === "postal" || channel === "in_person" ? "manual" : "ready",
    steps,
    blockers,
  };
}
