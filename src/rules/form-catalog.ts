// The form catalogue.
//
// One store, every issuer: the Judicial Council, individual county courts, the
// DMV, the IRS, FinCEN, and the financial institutions that print their own
// paper. Each record carries what makes it unique — issuer, jurisdiction,
// revision — plus who fills it, who signs it, where the signature block sits,
// and how the finished document reaches its recipient.
//
// Two things in here are worth pointing at.
//
// "Affidavit of Domicile" is printed by almost every brokerage and transfer
// agent, each with their own version. Resolving it without naming the
// institution is genuinely ambiguous, and the store says so rather than picking
// one. That is the whole argument for a composite key.
//
// The JPMorgan Chase record encodes `phone_first`, because for many
// institutions the first step in settling an account is a telephone call — not
// paperwork. A form filled and posted before that call is usually returned.

import type { FormRecord } from "../lib/formstore";
import { formKey } from "../lib/formstore";
import { DE_111, DE_300, DE_310, REG_5 } from "./ca-forms";
import { FORM_4506T, FORM_56, FORM_SS4 } from "./federal-forms";

const RETRIEVED = "2026-07-27";

const JUDICIAL_COUNCIL = {
  kind: "judicial_council" as const,
  name: "California Judicial Council",
  state: "CA",
};

const COURTS_URL = "https://courts.ca.gov/";
const IRS_URL = "https://www.irs.gov/";

/** Signature block placements, in PDF points from the bottom-left origin. */
const sigBlock = (id: string, pageNum: number, x: number, y: number): FormRecord["signatures"][number] => ({
  id,
  signerRole: "executor",
  type: "signature",
  pageNum,
  rect: { x, y, width: 180, height: 28 },
});

const dateBlock = (id: string, pageNum: number, x: number, y: number): FormRecord["signatures"][number] => ({
  id,
  signerRole: "executor",
  type: "signatureDate",
  pageNum,
  rect: { x, y, width: 90, height: 24 },
});

export const FORM_STORE: FormRecord[] = [
  // ---- California Judicial Council -----------------------------------------
  {
    key: formKey(JUDICIAL_COUNCIL, "DE-111", "2017-07-01"),
    printedId: "DE-111",
    title: "Petition for Probate",
    issuer: JUDICIAL_COUNCIL,
    jurisdiction: { level: "state", state: "CA" },
    revision: "2017-07-01",
    sourceUrl: COURTS_URL,
    retrievedAt: RETRIEVED,
    parties: [
      { role: "preparer", who: "Settlement specialist" },
      { role: "signer", who: "Petitioner", factKey: "estate.petitioner_name" },
      { role: "recipient", who: "Superior Court, probate division" },
    ],
    delivery: {
      channels: ["efile", "in_person", "postal"],
      recipient: "Superior Court of California",
      notes: "The original will cannot be e-filed in some counties — check the county overlay.",
    },
    signatures: [sigBlock("de111_sig", 2, 360, 96), dateBlock("de111_date", 2, 250, 96)],
    requiresNotary: false,
    requiresOriginal: false,
    fields: DE_111.fields,
  },
  {
    key: formKey(JUDICIAL_COUNCIL, "DE-310", "2025-04-01"),
    printedId: "DE-310",
    title: "Petition to Determine Succession to Primary Residence",
    issuer: JUDICIAL_COUNCIL,
    jurisdiction: { level: "state", state: "CA" },
    revision: "2025-04-01",
    sourceUrl: COURTS_URL,
    retrievedAt: RETRIEVED,
    parties: [
      { role: "signer", who: "Petitioner", factKey: "estate.petitioner_name" },
      { role: "recipient", who: "Superior Court, probate division" },
    ],
    delivery: {
      channels: ["efile", "in_person", "postal"],
      recipient: "Superior Court of California",
      notes: "Form DE-300 must be attached.",
    },
    signatures: [sigBlock("de310_sig", 1, 360, 120)],
    requiresNotary: false,
    requiresOriginal: false,
    fields: DE_310.fields,
    notes: "Renamed by AB 2016; sources calling it succession to real property describe the pre-2025 law.",
  },
  {
    key: formKey(JUDICIAL_COUNCIL, "DE-300", "2025-04-28"),
    printedId: "DE-300",
    title: "Maximum Values for Small Estate Set-Aside and Disposition of Estate Without Administration",
    issuer: JUDICIAL_COUNCIL,
    jurisdiction: { level: "state", state: "CA" },
    revision: "2025-04-28",
    sourceUrl: COURTS_URL,
    retrievedAt: RETRIEVED,
    parties: [{ role: "recipient", who: "Attached to the petition or affidavit it accompanies" }],
    delivery: { channels: ["efile", "postal"], recipient: "Filed as an attachment" },
    signatures: [],
    requiresNotary: false,
    requiresOriginal: false,
    fields: DE_300.fields,
    notes: "Adopted for mandatory use — must be attached to a § 13101, § 13151, § 13200 or § 13601 filing.",
  },

  // ---- County courts: the same statewide packet, plus local paper ----------
  {
    key: formKey(
      { kind: "court", name: "Los Angeles Superior Court", state: "CA", county: "Los Angeles" },
      "PRO 010",
      "2026-01-01",
    ),
    printedId: "PRO 010",
    title: "Probate Case Cover Sheet and Certificate of Grounds for Assignment to District",
    issuer: { kind: "court", name: "Los Angeles Superior Court", state: "CA", county: "Los Angeles" },
    jurisdiction: { level: "county", state: "CA", county: "Los Angeles" },
    revision: "2026-01-01",
    sourceUrl: "https://www.lacourt.ca.gov/",
    retrievedAt: RETRIEVED,
    parties: [
      { role: "preparer", who: "Petitioner" },
      { role: "recipient", who: "Los Angeles Superior Court" },
    ],
    delivery: {
      channels: ["efile"],
      recipient: "Los Angeles Superior Court",
      notes: "Must accompany the petitioner's first paper (Local Rule 4.5).",
    },
    signatures: [],
    requiresNotary: false,
    requiresOriginal: false,
    fields: [
      { alias: "decedentName", label: "Estate of", factKey: "decedent.full_name", required: true },
      { alias: "petitionerName", label: "Petitioner", factKey: "estate.petitioner_name", required: true },
      { alias: "groundsForDistrict", label: "Grounds for assignment to district", constant: "Decedent resided in the district", required: true },
    ],
    notes: "Exists only in Los Angeles. A printed identifier alone cannot tell you that.",
  },
  {
    key: formKey(
      { kind: "court", name: "San Mateo Superior Court", state: "CA", county: "San Mateo" },
      "PR-5",
      "2026-07-01",
    ),
    printedId: "PR-5",
    title: "Request for Appointment of California Probate Referee",
    issuer: { kind: "court", name: "San Mateo Superior Court", state: "CA", county: "San Mateo" },
    jurisdiction: { level: "county", state: "CA", county: "San Mateo" },
    revision: "2026-07-01",
    sourceUrl: "https://sanmateo.courts.ca.gov/",
    retrievedAt: RETRIEVED,
    parties: [
      { role: "signer", who: "Petitioner", factKey: "estate.petitioner_name" },
      { role: "recipient", who: "San Mateo Superior Court" },
    ],
    delivery: {
      channels: ["efile"],
      recipient: "San Mateo Superior Court",
      notes: "The referee is appointed when the order for probate is signed, upon the filing of PR-5.",
    },
    signatures: [sigBlock("pr5_sig", 0, 340, 140)],
    requiresNotary: false,
    requiresOriginal: false,
    fields: [
      { alias: "decedentName", label: "Estate of", factKey: "decedent.full_name", required: true },
      { alias: "petitionerName", label: "Petitioner", factKey: "estate.petitioner_name", required: true },
    ],
  },

  // ---- State agency --------------------------------------------------------
  {
    key: formKey({ kind: "state_agency", name: "California DMV", state: "CA" }, "REG 5"),
    printedId: "REG 5",
    title: "Affidavit for Transfer Without Probate — California Titled Vehicle",
    issuer: { kind: "state_agency", name: "California DMV", state: "CA" },
    jurisdiction: { level: "state", state: "CA" },
    sourceUrl: "https://www.dmv.ca.gov/",
    retrievedAt: RETRIEVED,
    parties: [
      { role: "signer", who: "Claimant", factKey: "estate.petitioner_name" },
      { role: "recipient", who: "California DMV" },
    ],
    delivery: {
      channels: ["in_person", "postal"],
      recipient: "California DMV",
      notes: "The title certificate must be surrendered with the affidavit.",
    },
    signatures: [sigBlock("reg5_sig", 0, 300, 180)],
    requiresNotary: false,
    requiresOriginal: true,
    fields: REG_5.fields,
  },

  // ---- Federal -------------------------------------------------------------
  {
    key: formKey({ kind: "federal_agency", name: "Internal Revenue Service" }, "4506-T"),
    printedId: "4506-T",
    title: "Request for Transcript of Tax Return",
    issuer: { kind: "federal_agency", name: "Internal Revenue Service" },
    jurisdiction: { level: "federal" },
    sourceUrl: IRS_URL,
    retrievedAt: RETRIEVED,
    parties: [
      { role: "signer", who: "Executor", factKey: "estate.petitioner_name" },
      { role: "recipient", who: "Internal Revenue Service" },
    ],
    delivery: {
      channels: ["fax", "postal"],
      recipient: "Internal Revenue Service",
      notes: "Submit with Letters and a certified death certificate. The correct fax number depends on the decedent's last address.",
    },
    signatures: [sigBlock("4506t_sig", 0, 120, 150), dateBlock("4506t_date", 0, 400, 150)],
    requiresNotary: false,
    requiresOriginal: false,
    fields: FORM_4506T.fields,
  },
  {
    key: formKey({ kind: "federal_agency", name: "Internal Revenue Service" }, "56"),
    printedId: "56",
    title: "Notice Concerning Fiduciary Relationship",
    issuer: { kind: "federal_agency", name: "Internal Revenue Service" },
    jurisdiction: { level: "federal" },
    sourceUrl: IRS_URL,
    retrievedAt: RETRIEVED,
    parties: [
      { role: "signer", who: "Fiduciary", factKey: "estate.petitioner_name" },
      { role: "recipient", who: "Internal Revenue Service" },
    ],
    delivery: { channels: ["postal"], recipient: "Internal Revenue Service" },
    signatures: [sigBlock("f56_sig", 0, 110, 130), dateBlock("f56_date", 0, 380, 130)],
    requiresNotary: false,
    requiresOriginal: false,
    fields: FORM_56.fields,
  },
  {
    key: formKey({ kind: "federal_agency", name: "Internal Revenue Service" }, "SS-4"),
    printedId: "SS-4",
    title: "Application for Employer Identification Number",
    issuer: { kind: "federal_agency", name: "Internal Revenue Service" },
    jurisdiction: { level: "federal" },
    sourceUrl: IRS_URL,
    retrievedAt: RETRIEVED,
    parties: [
      { role: "signer", who: "Responsible party", factKey: "estate.petitioner_name" },
      { role: "recipient", who: "Internal Revenue Service" },
    ],
    delivery: {
      channels: ["portal", "fax", "postal"],
      recipient: "Internal Revenue Service",
      notes: "The online application issues an EIN immediately; fax takes about four business days.",
    },
    signatures: [sigBlock("ss4_sig", 0, 110, 110)],
    requiresNotary: false,
    requiresOriginal: false,
    fields: FORM_SS4.fields,
  },

  // ---- Institution paper ---------------------------------------------------
  // Two issuers, one printed identifier. Resolving "Affidavit of Domicile"
  // without naming the institution is ambiguous, and the store refuses to guess.
  {
    key: formKey({ kind: "institution", name: "Wells Fargo" }, "Affidavit of Domicile"),
    printedId: "Affidavit of Domicile",
    title: "Affidavit of Domicile — Wells Fargo",
    issuer: { kind: "institution", name: "Wells Fargo" },
    jurisdiction: { level: "institution", institution: "Wells Fargo" },
    sourceUrl: "https://www.wellsfargo.com/",
    retrievedAt: RETRIEVED,
    parties: [
      { role: "signer", who: "Executor", factKey: "estate.petitioner_name" },
      { role: "notary", who: "Notary public" },
      { role: "recipient", who: "Wells Fargo estate servicing" },
    ],
    delivery: {
      channels: ["postal", "fax"],
      recipient: "Wells Fargo estate servicing",
      notes: "A notarised original is required; scans are not accepted.",
    },
    signatures: [sigBlock("wf_aod_sig", 0, 90, 200)],
    requiresNotary: true,
    requiresOriginal: true,
    fields: [
      { alias: "decedentName", label: "Name of decedent", factKey: "decedent.full_name", required: true },
      { alias: "dateOfDeath", label: "Date of death", factKey: "decedent.date_of_death", required: true, format: "date" },
      { alias: "domicileAddress", label: "Legal domicile at death", factKey: "asset.residence.address", required: true },
      { alias: "affiantName", label: "Affiant", factKey: "estate.petitioner_name", required: true },
    ],
  },
  {
    key: formKey({ kind: "institution", name: "Charles Schwab" }, "Affidavit of Domicile"),
    printedId: "Affidavit of Domicile",
    title: "Affidavit of Domicile — Charles Schwab",
    issuer: { kind: "institution", name: "Charles Schwab" },
    jurisdiction: { level: "institution", institution: "Charles Schwab" },
    sourceUrl: "https://www.schwab.com/",
    retrievedAt: RETRIEVED,
    parties: [
      { role: "signer", who: "Executor", factKey: "estate.petitioner_name" },
      { role: "notary", who: "Notary public" },
      { role: "recipient", who: "Charles Schwab estate services" },
    ],
    delivery: {
      channels: ["postal"],
      recipient: "Charles Schwab estate services",
      notes: "Medallion signature guarantee may be required in place of a notary.",
    },
    signatures: [sigBlock("schwab_aod_sig", 0, 100, 190)],
    requiresNotary: true,
    requiresOriginal: true,
    fields: [
      { alias: "decedentName", label: "Name of decedent", factKey: "decedent.full_name", required: true },
      { alias: "dateOfDeath", label: "Date of death", factKey: "decedent.date_of_death", required: true, format: "date" },
      { alias: "domicileAddress", label: "Legal domicile at death", factKey: "asset.residence.address", required: true },
      { alias: "affiantName", label: "Affiant", factKey: "estate.petitioner_name", required: true },
    ],
  },
  {
    key: formKey({ kind: "institution", name: "JPMorgan Chase" }, "Decedent Account Notification"),
    printedId: "Decedent Account Notification",
    title: "Decedent Account Notification — JPMorgan Chase",
    issuer: { kind: "institution", name: "JPMorgan Chase" },
    jurisdiction: { level: "institution", institution: "JPMorgan Chase" },
    sourceUrl: "https://www.chase.com/",
    retrievedAt: RETRIEVED,
    parties: [
      { role: "preparer", who: "Settlement specialist" },
      { role: "recipient", who: "JPMorgan Chase estate servicing" },
    ],
    delivery: {
      channels: ["phone_first", "postal"],
      recipient: "JPMorgan Chase estate servicing",
      notes:
        "Chase requires a telephone notification of the death before paperwork is accepted. The call establishes what they will then ask for — commonly Letters of authority where the account is in probate.",
    },
    signatures: [],
    requiresNotary: false,
    requiresOriginal: false,
    fields: [
      { alias: "decedentName", label: "Name of decedent", factKey: "decedent.full_name", required: true },
      { alias: "dateOfDeath", label: "Date of death", factKey: "decedent.date_of_death", required: true, format: "date" },
      { alias: "callerName", label: "Calling on behalf of", factKey: "estate.petitioner_name", required: true },
    ],
    notes:
      "The first step is a call, not a form. Posting paperwork before that call usually results in it being returned.",
  },
];

export function formByKey(key: string): FormRecord | undefined {
  return FORM_STORE.find((f) => f.key === key);
}
