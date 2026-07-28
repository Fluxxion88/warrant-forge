// Letter templates.
//
// Wording is reviewed once and reused, which is the point: a specialist should
// be checking that the facts are right, not re-deciding how to phrase a death
// notification for the four hundredth time.
//
// `manualMinutes` is what drafting and assembling each one costs a specialist by
// hand. Those figures are practice estimates, not measurements, and are labelled
// as such wherever they are totalled.

import type { LetterTemplate } from "../lib/correspondence";

const LETTERS_AND_CERT: LetterTemplate["enclosures"] = [
  { id: "letters_testamentary", label: "Letters Testamentary", certified: true },
  { id: "death_certificate", label: "Certificate of Death", certified: true },
];

export const LETTER_TEMPLATES: LetterTemplate[] = [
  {
    id: "letter.institution.notify",
    purpose: "Notify an institution of the death and open the account file",
    audience: "institution",
    subject: "Notification of death — {decedent.full_name}",
    body: [
      `I am writing on behalf of the estate of {decedent.full_name}, who died on
       {decedent.date_of_death}. I am the appointed personal representative.`,
      `Please record the death against any account, product or policy held in this
       name, and suspend any automatic payments, statements or marketing
       correspondence pending instructions from the estate.`,
      `Please confirm in writing what your institution requires in order to release
       or transfer the assets, including any forms specific to your process, and
       the address or portal to which they should be returned.`,
      `Certified copies of my authority and of the death certificate are enclosed.`,
    ],
    requires: ["decedent.full_name", "decedent.date_of_death", "estate.petitioner_name"],
    enclosures: LETTERS_AND_CERT,
    channels: ["postal", "fax"],
    signOff: "{estate.petitioner_name}, personal representative",
    manualMinutes: 18,
  },
  {
    id: "letter.institution.search",
    purpose: "Request an institution-wide search for accounts",
    audience: "institution",
    subject: "Estate account search request — {decedent.full_name}",
    body: [
      `I act for the estate of {decedent.full_name}, who died on {decedent.date_of_death}.`,
      `Please conduct a search across your institution under the decedent's social
       security number and all known names, rather than against a single account
       number. I am asking specifically for: every open and closed account
       connected to that customer profile; balances as at the date of death;
       statements for the preceding five years; incoming and outgoing wire
       transfers with counterparty, SWIFT/BIC and beneficiary details; safe-deposit
       box records; linked external accounts; and any beneficiary or joint-owner
       designations of record.`,
      `Where an account has a payable-on-death or transfer-on-death designation,
       please confirm the designated beneficiary rather than closing the account.`,
      `Certified copies of my authority and of the death certificate are enclosed.`,
    ],
    requires: ["decedent.full_name", "decedent.date_of_death", "estate.petitioner_name"],
    enclosures: LETTERS_AND_CERT,
    channels: ["postal", "fax"],
    signOff: "{estate.petitioner_name}, personal representative",
    manualMinutes: 25,
  },
  {
    id: "letter.foreign.institution",
    purpose: "Formal estate enquiry to a foreign institution",
    audience: "institution",
    subject: "Estate enquiry — {decedent.full_name} (deceased {decedent.date_of_death})",
    body: [
      `I am the personal representative of the estate of {decedent.full_name}, a
       resident of {estate.county} County, California, United States, who died on
       {decedent.date_of_death}.`,
      `Please confirm whether your institution holds, or has held, any account,
       custody position, safe-deposit facility or other asset in the name of the
       decedent, whether held directly, jointly, or through a nominee, trust or
       corporate structure.`,
      `Where any such asset exists, please provide the balance or valuation as at
       the date of death, statements for the preceding five years, and the
       beneficial-ownership records you hold.`,
      `Enclosed are certified and apostilled copies of my authority and of the
       death certificate, together with a certified translation where required. I
       am content to complete any additional documentation your jurisdiction
       requires; please advise what that is.`,
    ],
    requires: [
      "decedent.full_name",
      "decedent.date_of_death",
      "estate.county",
      "estate.petitioner_name",
    ],
    enclosures: [
      ...LETTERS_AND_CERT,
      { id: "apostille", label: "Apostille", certified: true },
      { id: "certified_translation", label: "Certified translation", certified: true },
    ],
    channels: ["postal"],
    signOff: "{estate.petitioner_name}, personal representative",
    manualMinutes: 40,
  },
  {
    id: "letter.irs.transcripts",
    purpose: "Cover letter for a transcript request",
    audience: "institution",
    subject: "Form 4506-T — estate of {decedent.full_name}",
    body: [
      `Enclosed is a completed Form 4506-T requesting return and wage-and-income
       transcripts for {decedent.full_name}, who died on {decedent.date_of_death}.`,
      `I am the appointed personal representative of the estate. Certified Letters
       and a certified death certificate are enclosed, together with Form 56
       notifying the Service of the fiduciary relationship.`,
    ],
    requires: ["decedent.full_name", "decedent.date_of_death", "estate.petitioner_name"],
    enclosures: [
      ...LETTERS_AND_CERT,
      { id: "form_56", label: "Form 56, Notice Concerning Fiduciary Relationship", certified: false },
      { id: "filled_form", label: "Form 4506-T", certified: false },
    ],
    channels: ["fax", "postal"],
    signOff: "{estate.petitioner_name}, personal representative",
    manualMinutes: 15,
  },
  {
    id: "letter.professional.file",
    purpose: "Request the complete client file from a named professional",
    audience: "professional",
    subject: "Client file request — estate of {decedent.full_name}",
    body: [
      `I am the personal representative of the estate of {decedent.full_name}, who
       died on {decedent.date_of_death}. Your firm is named in the decedent's
       records as having acted for them.`,
      `Please provide the complete client file, including engagement letters,
       correspondence, entity and trust documents, prior planning memoranda, and
       the identity of any other professionals — domestic or foreign — with whom
       you dealt on the decedent's behalf.`,
    ],
    requires: ["decedent.full_name", "decedent.date_of_death", "estate.petitioner_name"],
    enclosures: LETTERS_AND_CERT,
    channels: ["email", "postal"],
    signOff: "{estate.petitioner_name}, personal representative",
    manualMinutes: 12,
  },
  {
    id: "letter.family.weekly",
    purpose: "Weekly update to the family",
    audience: "family",
    subject: "Weekly update — estate of {decedent.full_name}",
    body: [
      `Here is where things stand this week on your mother's estate.`,
      `The estate is being administered in {estate.county} County, California. The
       personal property we have identified and valued so far comes to
       {estate.section_13100_gross_value}, and the residence at
       {asset.residence.address} is included in the estate at
       {asset.residence.value}.`,
      `We are continuing to confirm the full picture of what your mother held
       before anything is distributed. That is deliberate: distributing early is
       the one step that cannot be undone, and it is where executors most often
       become personally liable.`,
      `I will write again next week. If anything arrives in the post that looks
       financial — a statement, a policy, a tax notice, anything from an
       institution you do not recognise — please keep it and send it over rather
       than discarding it.`,
    ],
    requires: [
      "decedent.full_name",
      "estate.county",
      "estate.section_13100_gross_value",
      "asset.residence.value",
      "asset.residence.address",
    ],
    enclosures: [],
    channels: ["email"],
    signOff: "Your settlement specialist",
    manualMinutes: 20,
  },
  {
    id: "letter.creditor.notice",
    purpose: "Notice to a known or reasonably ascertainable creditor",
    audience: "creditor",
    subject: "Notice of administration — estate of {decedent.full_name}",
    body: [
      `{decedent.full_name} died on {decedent.date_of_death}. Administration of the
       estate has commenced in the Superior Court of California, County of
       {estate.county}.`,
      `If you have a claim against the estate, you must file it with the court and
       deliver a copy to me before the later of four months after Letters were
       first issued to a general personal representative, or sixty days after this
       notice is delivered to you.`,
      `A claim not filed within that period may be barred.`,
    ],
    requires: ["decedent.full_name", "decedent.date_of_death", "estate.county"],
    enclosures: [],
    channels: ["postal"],
    signOff: "{estate.petitioner_name}, personal representative",
    manualMinutes: 10,
  },
];

export function letterById(id: string): LetterTemplate | undefined {
  return LETTER_TEMPLATES.find((t) => t.id === id);
}
