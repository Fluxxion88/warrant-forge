// Federal forms.
//
// Ian's track asks for "real government or financial-institution forms", and
// the administration playbook is driven by IRS paperwork as much as by court
// paperwork. These are the forms that establish authority with the IRS and
// unlock the tax records that are the strongest source of offshore leads.
//
// Same discipline as the court forms: bindings are data, keyed to the line
// numbers on the printed form, and a field with no verified fact behind it is
// left empty and reported rather than guessed.

import type { FormTemplate } from "../lib/anvil";

/** Request for transcript — the single most productive investigative document. */
export const FORM_4506T: FormTemplate = {
  code: "4506-T",
  title: "Request for Transcript of Tax Return",
  authority: "IRS Form 4506-T; executor authority under Letters Testamentary",
  fields: [
    { alias: "line1a_name", label: "Name shown on tax return", item: "1a", factKey: "decedent.full_name", required: true },
    { alias: "line1b_ssn", label: "First social security number", item: "1b", factKey: "decedent.ssn", required: true },
    { alias: "line3_address", label: "Current name and address", item: "3", factKey: "asset.residence.address", required: true },
    { alias: "line5_thirdParty", label: "Third party to receive transcript", item: "5", factKey: "estate.petitioner_name", required: true },
    { alias: "line6_formNumber", label: "Transcript requested", item: "6", constant: "1040", required: true },
    { alias: "line6a_returnTranscript", label: "Return transcript", item: "6a", constant: "X", required: true },
    { alias: "line8_wageAndIncome", label: "Form W-2, 1099 series wage and income transcript", item: "8", constant: "X", required: true },
    { alias: "signatoryTitle", label: "Title (if line 1a is a corporation, estate or trust)", item: "sign", constant: "Executor", required: true },
    { alias: "signatoryName", label: "Signature", item: "sign", factKey: "estate.petitioner_name", required: true },
  ],
};

/** Tells the IRS who is now authorised to act for the taxpayer. */
export const FORM_56: FormTemplate = {
  code: "56",
  title: "Notice Concerning Fiduciary Relationship",
  authority: "IRC § 6903; IRS Form 56",
  fields: [
    { alias: "decedentName", label: "Name of person for whom you are acting", item: "1", factKey: "decedent.full_name", required: true },
    { alias: "decedentSsn", label: "Identifying number", item: "1", factKey: "decedent.ssn", required: true },
    { alias: "decedentAddress", label: "Address of person for whom you are acting", item: "1", factKey: "asset.residence.address", required: true },
    { alias: "fiduciaryName", label: "Name of fiduciary", item: "2", factKey: "estate.petitioner_name", required: true },
    { alias: "authorityCourt", label: "Court appointing fiduciary", item: "2c", factKey: "estate.court_name", required: true },
    { alias: "dateOfDeath", label: "Date of death", item: "2b", factKey: "decedent.date_of_death", required: true, format: "date" },
    { alias: "authorityType", label: "Authority for fiduciary relationship", item: "1b", constant: "Court appointment of testate estate", required: true },
  ],
};

/** The estate is a separate taxpayer and needs its own number. */
export const FORM_SS4: FormTemplate = {
  code: "SS-4",
  title: "Application for Employer Identification Number",
  authority: "IRS Form SS-4",
  fields: [
    { alias: "line1_legalName", label: "Legal name of entity", item: "1", template: { pattern: "Estate of {0}", keys: ["decedent.full_name"] }, required: true },
    { alias: "line3_executor", label: "Executor, administrator, trustee", item: "3", factKey: "estate.petitioner_name", required: true },
    { alias: "line4_address", label: "Mailing address", item: "4a", factKey: "asset.residence.address", required: true },
    { alias: "line7a_responsibleParty", label: "Name of responsible party", item: "7a", factKey: "estate.petitioner_name", required: true },
    { alias: "line9a_typeOfEntity", label: "Type of entity", item: "9a", constant: "Estate", required: true },
    { alias: "line9a_ssnOfDecedent", label: "SSN of decedent", item: "9a", factKey: "decedent.ssn", required: true },
    { alias: "line10_reason", label: "Reason for applying", item: "10", constant: "Created a trust or estate", required: true },
    { alias: "line11_dateStarted", label: "Date business started or acquired", item: "11", factKey: "decedent.date_of_death", required: true, format: "date" },
  ],
};

export const FEDERAL_FORMS: FormTemplate[] = [FORM_4506T, FORM_56, FORM_SS4];

/**
 * Facts the federal forms need that a data room usually will not contain.
 * Surfacing them as gaps is the honest behaviour — an SSN guessed onto a Form
 * 56 is a rejected filing at best.
 */
export const FEDERAL_OBTAIN_HINTS: Record<string, string> = {
  "decedent.ssn": "Social security number — from the death certificate, a tax return, or the Social Security Administration",
  "estate.court_name": "Name of the appointing court — appears on the Letters once issued",
};
