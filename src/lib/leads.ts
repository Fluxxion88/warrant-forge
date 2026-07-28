// Leads — reasoning about assets nobody has found yet.
//
// A fact ledger records what the documents say. An estate investigation has to
// go further: a wire to Zürich is not itself an asset, but it is strong
// evidence that an account exists which no document in our possession
// describes. A Form 5471 in a tax return is not a company; it is proof that a
// company exists somewhere.
//
// A `Lead` is that inference made explicit — a fact pattern that implies an
// undiscovered asset, together with the specific request that would confirm or
// kill it, and the legal authority that request requires.
//
// This is the difference between "we read the documents" and "we conducted an
// investigation". It is also the executor's defence: if a beneficiary later
// argues that the offshore account should have been found, the record shows
// the lead was raised, the request was sent, and what came back.
//
// Detection reuses the rules engine's predicate evaluator, so lead conditions
// have the same three-valued semantics as everything else: a lead cannot be
// silently dismissed because a fact was missing.

import type { FactKey, FactValue } from "./facts";
import { evaluatePredicate, type Authority, type Predicate } from "./rules";

/** Documents an institution will demand before answering an estate enquiry. */
export type AuthorityDoc =
  | "letters_testamentary"
  | "death_certificate"
  | "form_56"
  | "estate_ein"
  | "court_order"
  | "apostille"
  | "certified_translation"
  | "local_counsel";

export type Channel =
  | "irs_form"
  | "institution_letter"
  | "public_search"
  | "portal"
  | "counsel"
  | "forensics"
  | "subpoena";

export interface InvestigationAction {
  id: string;
  label: string;
  /** Who the request goes to. */
  target: string;
  channel: Channel;
  requiresAuthority: AuthorityDoc[];
  /** Judicial Council, IRS or FinCEN form, where one exists. */
  form?: string;
  /** What a response may surface. */
  mayReveal: string[];
}

export type LeadPriority = "critical" | "high" | "routine";

export interface LeadPattern {
  id: string;
  title: string;
  /** The class of thing this implies exists. */
  implies: string;
  /** Fact condition that raises the lead. */
  when: Predicate;
  rationale: string;
  actions: InvestigationAction[];
  priority: LeadPriority;
  /** Foreign leads drive ancillary-administration and reporting obligations. */
  foreign: boolean;
  authority?: Authority;
}

export type LeadStatus = "open" | "requested" | "resolved" | "dismissed";

export interface Lead {
  patternId: string;
  title: string;
  implies: string;
  rationale: string;
  priority: LeadPriority;
  foreign: boolean;
  /** Facts that raised it — each carries its own warrant in the ledger. */
  evidence: FactKey[];
  actions: InvestigationAction[];
  status: LeadStatus;
  authority?: Authority;
}

const IRS_TRANSCRIPTS: InvestigationAction = {
  id: "act.irs.transcripts",
  label: "Request returns and wage-and-income transcripts for the last 5–7 years",
  target: "Internal Revenue Service",
  channel: "irs_form",
  form: "4506-T",
  requiresAuthority: ["letters_testamentary", "death_certificate", "form_56"],
  mayReveal: [
    "Schedule B foreign account and foreign trust answers",
    "Foreign information returns already filed",
    "Foreign-source income and withholding",
    "Payers and institutions not otherwise known",
  ],
};

const bankSearch = (what: string): InvestigationAction => ({
  id: `act.bank.${what.toLowerCase().replace(/\W+/g, "-")}`,
  label: `Request an institution-wide search under the decedent's SSN and all known names — ${what}`,
  target: "Bank or brokerage",
  channel: "institution_letter",
  requiresAuthority: ["letters_testamentary", "death_certificate"],
  mayReveal: [
    "Accounts not named in any document",
    "Closed-account history",
    "Date-of-death balances",
    "Incoming and outgoing wires with SWIFT/BIC and beneficiary details",
    "Safe-deposit-box records",
    "Linked external accounts",
  ],
});

const foreignInstitution: InvestigationAction = {
  id: "act.foreign.institution",
  label: "Send a formal estate enquiry requesting an institution-wide account search",
  target: "Foreign financial institution",
  channel: "institution_letter",
  requiresAuthority: [
    "letters_testamentary",
    "death_certificate",
    "apostille",
    "certified_translation",
  ],
  mayReveal: [
    "Accounts held directly or through a nominee",
    "Date-of-death balances and statements",
    "Beneficial-ownership and entity records",
  ],
};

const localCounsel = (why: string): InvestigationAction => ({
  id: `act.counsel.${why.toLowerCase().replace(/\W+/g, "-")}`,
  label: `Retain local counsel — ${why}`,
  target: "Counsel in the relevant jurisdiction",
  channel: "counsel",
  requiresAuthority: ["letters_testamentary"],
  mayReveal: [
    "Whether the California grant must be resealed or recognised",
    "Whether an ancillary or separate succession proceeding is required",
    "Local inheritance tax and clearance obligations",
  ],
});

/**
 * Lead patterns.
 *
 * The tax-derived group is first because returns are the single strongest
 * source of offshore leads — the IRS itself identifies Forms 3520, 5471, 8621
 * and 8865 as records that may reveal foreign assets held by a decedent.
 */
export const LEAD_PATTERNS: LeadPattern[] = [
  // ---- Tax-derived ---------------------------------------------------------
  {
    id: "lead.schedule_b_foreign",
    title: "Schedule B reports a foreign account or foreign trust",
    implies: "A foreign financial account or foreign trust interest",
    when: { fact: "tax.schedule_b.foreign_account", op: "==", value: true },
    rationale:
      "Schedule B Part III asks directly whether the taxpayer had an interest in, or signature authority over, a foreign financial account. A 'yes' is an admission that one existed in that tax year.",
    actions: [
      IRS_TRANSCRIPTS,
      foreignInstitution,
      {
        id: "act.fbar.review",
        label: "Have an international-tax CPA review FBAR exposure for the final and prior years",
        target: "International-tax CPA",
        channel: "counsel",
        requiresAuthority: ["letters_testamentary"],
        mayReveal: ["Unfiled FinCEN Form 114 for years the aggregate exceeded $10,000"],
      },
    ],
    priority: "critical",
    foreign: true,
    authority: {
      citation: "IRS Form 1040 Schedule B, Part III; FinCEN Form 114",
      sourceUrl: "https://www.fincen.gov/report-foreign-bank-and-financial-accounts",
      effectiveFrom: "unknown",
      retrievedAt: "2026-07-27",
    },
  },
  {
    id: "lead.form_8938",
    title: "Form 8938 was filed — specified foreign financial assets",
    implies: "Foreign accounts, securities, or foreign pension interests",
    when: { exists: "tax.form_8938.filed" },
    rationale:
      "Form 8938 reports specified foreign financial assets. Note its limits: directly held foreign real estate, jewellery and artwork do not appear on it, so an 8938 sets a floor on foreign holdings, never a ceiling.",
    actions: [IRS_TRANSCRIPTS, foreignInstitution],
    priority: "critical",
    foreign: true,
    authority: {
      citation: "IRS Form 8938, Statement of Specified Foreign Financial Assets",
      sourceUrl:
        "https://www.irs.gov/businesses/corporations/basic-questions-and-answers-on-form-8938",
      effectiveFrom: "unknown",
      retrievedAt: "2026-07-27",
    },
  },
  {
    id: "lead.form_3520",
    title: "Form 3520 or 3520-A was filed — foreign trust",
    implies: "A foreign trust of which the decedent was grantor or beneficiary",
    when: { any: [{ exists: "tax.form_3520.filed" }, { exists: "tax.form_3520a.filed" }] },
    rationale:
      "A foreign trust survives the decedent and may hold substantial property outside the probate estate. Executors of U.S. estates can carry direct Form 3520 responsibilities.",
    actions: [
      IRS_TRANSCRIPTS,
      localCounsel("determine whether the trust is recognised and how it is administered"),
      {
        id: "act.trustee.enquiry",
        label: "Write to the trustee for the trust instrument, asset schedule and date-of-death valuations",
        target: "Foreign trustee",
        channel: "institution_letter",
        requiresAuthority: ["letters_testamentary", "death_certificate", "apostille"],
        mayReveal: ["Trust corpus", "Beneficiary schedule", "Distributions to the decedent"],
      },
    ],
    priority: "critical",
    foreign: true,
  },
  {
    id: "lead.form_5471",
    title: "Form 5471 was filed — foreign corporation",
    implies: "Shares in a foreign corporation",
    when: { exists: "tax.form_5471.filed" },
    rationale:
      "Form 5471 is filed by U.S. persons who are officers, directors or shareholders of certain foreign corporations. The shareholding is estate property even though no domestic registry records it.",
    actions: [
      IRS_TRANSCRIPTS,
      localCounsel("obtain corporate registry records and confirm the shareholding"),
      {
        id: "act.registry.foreign_corp",
        label: "Search the foreign companies registry for the entity and its officers",
        target: "Foreign companies registry",
        channel: "public_search",
        requiresAuthority: [],
        mayReveal: ["Registered shareholding", "Directors", "Filed accounts", "Registered agent"],
      },
    ],
    priority: "critical",
    foreign: true,
  },
  {
    id: "lead.form_8865",
    title: "Form 8865 was filed — foreign partnership",
    implies: "An interest in a foreign partnership",
    when: { exists: "tax.form_8865.filed" },
    rationale: "A partnership interest is transferable property and requires valuation at date of death.",
    actions: [IRS_TRANSCRIPTS, localCounsel("obtain the partnership agreement and capital account")],
    priority: "high",
    foreign: true,
  },
  {
    id: "lead.form_8621",
    title: "Form 8621 was filed — passive foreign investment company",
    implies: "Holdings in a foreign mutual fund or PFIC",
    when: { exists: "tax.form_8621.filed" },
    rationale:
      "PFIC holdings usually sit in a foreign brokerage or fund platform that has not otherwise been identified.",
    actions: [IRS_TRANSCRIPTS, foreignInstitution],
    priority: "high",
    foreign: true,
  },
  {
    id: "lead.form_1116",
    title: "Foreign tax credit claimed on Form 1116",
    implies: "Foreign-source income, and therefore a foreign income-producing asset",
    when: { exists: "tax.form_1116.filed" },
    rationale:
      "A foreign tax credit means foreign tax was paid, which means foreign income was earned. Something abroad produced it.",
    actions: [IRS_TRANSCRIPTS],
    priority: "high",
    foreign: true,
  },
  {
    id: "lead.foreign_pension",
    title: "Foreign pension income appears on a return",
    implies: "A foreign pension or superannuation entitlement",
    when: { exists: "tax.foreign_pension_income" },
    rationale:
      "Foreign pensions frequently continue paying after death or carry a survivor benefit, and are easily missed because no domestic statement arrives.",
    actions: [
      IRS_TRANSCRIPTS,
      localCounsel("identify the scheme administrator and any survivor entitlement"),
    ],
    priority: "high",
    foreign: true,
  },

  // ---- Banking-derived -----------------------------------------------------
  {
    id: "lead.international_wire",
    title: "An international wire transfer was sent or received",
    implies: "An account at the counterparty institution abroad",
    when: { exists: "banking.international_wire.country" },
    rationale:
      "Wire records are the single most productive banking lead. They carry the receiving bank, SWIFT/BIC, beneficiary name, foreign account number and often the stated purpose.",
    actions: [
      bankSearch("full wire history, incoming and outgoing"),
      foreignInstitution,
      {
        id: "act.subpoena.wire",
        label: "If the institution refuses, seek a subpoena for wire and account-opening records",
        target: "Probate-litigation counsel",
        channel: "subpoena",
        requiresAuthority: ["letters_testamentary", "court_order"],
        mayReveal: ["Account-opening documents", "Beneficial ownership", "Intermediary banks"],
      },
    ],
    priority: "critical",
    foreign: true,
  },
  {
    id: "lead.safe_deposit_box",
    title: "A safe-deposit box exists",
    implies: "Tangible property, certificates or documents of unknown value",
    when: { exists: "banking.safe_deposit_box.institution" },
    rationale:
      "Boxes routinely hold bearer certificates, foreign property deeds, jewellery and hardware wallets that appear in no statement.",
    actions: [
      {
        id: "act.box.inventory",
        label: "Arrange a supervised opening and inventory of the box",
        target: "Bank",
        channel: "institution_letter",
        requiresAuthority: ["letters_testamentary", "death_certificate"],
        mayReveal: ["Deeds", "Certificates", "Valuables", "Hardware wallets or seed backups"],
      },
    ],
    priority: "high",
    foreign: false,
  },
  {
    id: "lead.currency_exchange",
    title: "Foreign currency was purchased or exchanged",
    implies: "Spending or holdings in that currency's jurisdiction",
    when: { exists: "banking.currency_exchange.currency" },
    rationale: "Sustained currency conversion usually accompanies property, tuition or maintenance abroad.",
    actions: [bankSearch("currency conversions and related transfers")],
    priority: "routine",
    foreign: true,
  },

  // ---- Documents and life --------------------------------------------------
  {
    id: "lead.foreign_property_indicator",
    title: "A foreign address, passport or residency appears in the records",
    implies: "Assets, accounts or real property in that country",
    when: {
      any: [
        { exists: "identity.foreign_passport.country" },
        { exists: "identity.foreign_address.country" },
        { exists: "identity.foreign_residency.country" },
      ],
    },
    rationale:
      "A foreign passport or long-term address is the most common starting point for identifying which countries to investigate at all.",
    actions: [
      localCounsel("advise whether ancillary administration or resealing is required"),
      foreignInstitution,
    ],
    priority: "high",
    foreign: true,
  },
  {
    id: "lead.business_interest",
    title: "Business formation documents or a K-1 were found",
    implies: "A private company interest, loans, or carried interest",
    when: {
      any: [{ exists: "business.entity.name" }, { exists: "tax.k1.payer" }],
    },
    rationale:
      "Private interests rarely produce statements. Value must be established from the operating agreement, capitalisation table and books.",
    actions: [
      {
        id: "act.sos.search",
        label: "Search Secretary of State records under the decedent's name and known entities",
        target: "Secretary of State",
        channel: "public_search",
        requiresAuthority: [],
        mayReveal: ["Entities held", "Registered agent", "Officers", "Status"],
      },
      {
        id: "act.books.request",
        label: "Request the operating agreement, cap table, minute book and K-1 history",
        target: "Company or its accountant",
        channel: "institution_letter",
        requiresAuthority: ["letters_testamentary"],
        mayReveal: ["Ownership percentage", "Distributions", "Buy-sell provisions", "Loans"],
      },
    ],
    priority: "high",
    foreign: false,
  },
  {
    id: "lead.crypto",
    title: "Cryptocurrency exchange or wallet evidence was found",
    implies: "Digital assets, possibly self-custodied and irrecoverable without keys",
    when: {
      any: [{ exists: "digital.exchange.name" }, { exists: "digital.wallet.type" }],
    },
    rationale:
      "Self-custodied assets vanish permanently if devices are wiped or seed phrases lost. Preservation is urgent and precedes valuation.",
    actions: [
      {
        id: "act.crypto.preserve",
        label: "Preserve devices and backups without resetting anything; engage digital forensics",
        target: "Digital-forensics specialist",
        channel: "forensics",
        requiresAuthority: ["letters_testamentary"],
        mayReveal: ["Exchange accounts", "Wallet addresses", "Seed backups", "2FA recovery"],
      },
      {
        id: "act.crypto.exchange",
        label: "File the exchange's decedent process for each identified platform",
        target: "Cryptocurrency exchange",
        channel: "portal",
        requiresAuthority: ["letters_testamentary", "death_certificate"],
        mayReveal: ["Balances", "Transfer history", "Linked bank accounts"],
      },
    ],
    priority: "critical",
    foreign: false,
  },
  {
    id: "lead.named_professional",
    title: "An accountant, attorney or adviser is named in the records",
    implies: "Files describing assets nobody else knows about",
    when: { exists: "advisers.professional.name" },
    rationale:
      "The decedent's professionals frequently know of entities, trusts and foreign holdings that appear in no statement reaching the house.",
    actions: [
      {
        id: "act.adviser.file",
        label: "Request the complete client file",
        target: "Named professional",
        channel: "institution_letter",
        requiresAuthority: ["letters_testamentary"],
        mayReveal: ["Entity records", "Trust instruments", "Prior planning", "Foreign advisers"],
      },
    ],
    priority: "high",
    foreign: false,
  },
  {
    id: "lead.employer",
    title: "An employer or former employer is known",
    implies: "Retirement plan, deferred compensation, or unexercised equity",
    when: { exists: "employment.employer.name" },
    rationale:
      "Plan interests pass by beneficiary designation and are missed precisely because they never enter probate.",
    actions: [
      {
        id: "act.plan.admin",
        label: "Write to the plan administrator for balances, beneficiary of record and equity awards",
        target: "Employer or plan administrator",
        channel: "institution_letter",
        requiresAuthority: ["letters_testamentary", "death_certificate"],
        mayReveal: ["401(k) or pension balance", "Beneficiary designation", "Vested equity"],
      },
    ],
    priority: "routine",
    foreign: false,
  },
  {
    id: "lead.unclaimed_property",
    title: "Prior names, addresses or states are known",
    implies: "Unclaimed property held by a state",
    when: {
      any: [{ exists: "identity.prior_name" }, { exists: "identity.prior_state" }],
    },
    rationale:
      "Search every state connected to the decedent, under prior names, misspellings, business names, trust names and 'Estate of' variations.",
    actions: [
      {
        id: "act.unclaimed.search",
        label: "Search California and every connected state's unclaimed property database",
        target: "State controller / unclaimed property",
        channel: "public_search",
        requiresAuthority: [],
        mayReveal: ["Dormant accounts", "Uncashed cheques", "Insurance proceeds", "Safe-deposit contents"],
      },
    ],
    priority: "routine",
    foreign: false,
  },
];

/**
 * Raise leads against the current ledger.
 *
 * A pattern whose condition is `unknown` does not raise a lead, but neither is
 * it discarded — it is returned as `dormant` so the investigation log can show
 * that the pattern was considered and what fact would have triggered it.
 */
export function detectLeads(
  facts: Record<FactKey, FactValue>,
  patterns: LeadPattern[] = LEAD_PATTERNS,
): { leads: Lead[]; dormant: { patternId: string; awaiting: FactKey[] }[] } {
  const leads: Lead[] = [];
  const dormant: { patternId: string; awaiting: FactKey[] }[] = [];

  for (const p of patterns) {
    const { result, reads, missing } = evaluatePredicate(p.when, facts);
    if (result === true) {
      leads.push({
        patternId: p.id,
        title: p.title,
        implies: p.implies,
        rationale: p.rationale,
        priority: p.priority,
        foreign: p.foreign,
        evidence: reads.filter((k) => k in facts),
        actions: p.actions,
        status: "open",
        authority: p.authority,
      });
    } else {
      dormant.push({ patternId: p.id, awaiting: missing.length ? missing : reads });
    }
  }

  const order: Record<LeadPriority, number> = { critical: 0, high: 1, routine: 2 };
  leads.sort((a, b) => order[a.priority] - order[b.priority]);
  return { leads, dormant };
}

/** Leads that must be closed out before the estate can safely be distributed. */
export function blockingLeads(leads: Lead[]): Lead[] {
  return leads.filter((l) => l.priority === "critical" && l.status !== "resolved" && l.status !== "dismissed");
}

/** Every distinct authority document the open actions require. */
export function authorityNeeded(leads: Lead[]): AuthorityDoc[] {
  const s = new Set<AuthorityDoc>();
  for (const l of leads) for (const a of l.actions) for (const d of a.requiresAuthority) s.add(d);
  return [...s];
}
