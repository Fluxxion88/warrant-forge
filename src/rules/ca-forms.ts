// California Judicial Council forms, as field bindings.
//
// Same philosophy as the rule pack: the mapping from estate facts to form boxes
// is data, not code, so adding a form is an edit rather than a deploy. Item
// numbers refer to the boxes on the printed form, so a reviewer holding the
// paper can check our work.
//
// `anvilTemplateId` is left undefined until the corresponding PDF is uploaded
// to Anvil — the app reads it from settings at runtime, so no template id is
// baked into the source.

import type { FormTemplate } from "../lib/anvil";

/** Petition to Determine Succession to Primary Residence — the cheap road. */
export const DE_310: FormTemplate = {
  code: "DE-310",
  title: "Petition to Determine Succession to Primary Residence",
  authority: "Cal. Prob. Code §§ 13151–13154",
  fields: [
    { alias: "courtCounty", label: "Superior Court of California, County of", item: "caption", factKey: "estate.county", required: true },
    { alias: "decedentName", label: "Estate of (decedent)", item: "caption", factKey: "decedent.full_name", required: true },
    { alias: "petitionerName", label: "Petitioner", item: "1", factKey: "estate.petitioner_name", required: true },
    { alias: "dateOfDeath", label: "Decedent died on", item: "4a", factKey: "decedent.date_of_death", required: true, format: "date" },
    { alias: "placeOfDeath", label: "Place of death", item: "4b", factKey: "decedent.place_of_death", required: true },
    { alias: "residentOfCounty", label: "Decedent was a resident of", item: "4c", factKey: "estate.county", required: true },
    { alias: "propertyAddress", label: "Primary residence", item: "7", factKey: "asset.residence.address", required: true },
    {
      alias: "propertyLegalDescription",
      label: "Legal description / Assessor's Parcel Number",
      item: "7a",
      factKey: "asset.residence.apn",
      required: true,
    },
    { alias: "grossValue", label: "Gross value of the primary residence", item: "8", factKey: "asset.residence.value", required: true, format: "usd" },
    { alias: "daysElapsed", label: "Days elapsed since death (must be at least 40)", item: "3", factKey: "estate.days_since_death", required: true },
    { alias: "attachDE300", label: "Form DE-300 attached", item: "notice", constant: "Yes", required: true },
  ],
};

/** Petition for Probate — the expensive road. */
export const DE_111: FormTemplate = {
  code: "DE-111",
  title: "Petition for Probate",
  authority: "Cal. Prob. Code §§ 8002, 10450",
  fields: [
    { alias: "courtCounty", label: "Superior Court of California, County of", item: "caption", factKey: "estate.county", required: true },
    { alias: "decedentName", label: "Estate of (decedent)", item: "caption", factKey: "decedent.full_name", required: true },
    { alias: "petitionerName", label: "Petitioner requests", item: "1", factKey: "estate.petitioner_name", required: true },
    { alias: "publicationRequested", label: "Publication requested", item: "1e", constant: "Yes", required: true },
    { alias: "dateOfDeath", label: "Decedent died on", item: "3a", factKey: "decedent.date_of_death", required: true, format: "date" },
    { alias: "placeOfDeath", label: "Place of death", item: "3a(2)", factKey: "decedent.place_of_death", required: true },
    { alias: "residentOfCounty", label: "Decedent was a resident of the county named above", item: "3b", factKey: "estate.county", required: true },
    { alias: "estimatedRealProperty", label: "Estimated value — real property", item: "3f(1)", factKey: "asset.residence.value", required: true, format: "usd" },
    { alias: "estimatedPersonalProperty", label: "Estimated value — personal property", item: "3f(3)", factKey: "estate.section_13100_gross_value", required: true, format: "usd" },
    { alias: "bondWaived", label: "Bond waived by will", item: "3e", constant: "Yes", required: false },
  ],
};

/** Mandatory attachment stating the threshold values in force at date of death. */
export const DE_300: FormTemplate = {
  code: "DE-300",
  title: "Maximum Values for Small Estate Set-Aside and Disposition of Estate Without Administration",
  authority: "Judicial Council Form DE-300 (Rev. 28 Apr 2025)",
  fields: [
    { alias: "decedentName", label: "Estate of (decedent)", item: "caption", factKey: "decedent.full_name", required: true },
    { alias: "dateOfDeath", label: "Date of death", item: "1", factKey: "decedent.date_of_death", required: true, format: "date" },
    { alias: "affidavitLimit", label: "§ 13100 affidavit maximum", item: "2b", constant: "$208,850", required: true },
    { alias: "primaryResidenceLimit", label: "§ 13151 primary residence maximum", item: "2c", constant: "$750,000", required: true },
    { alias: "realPropertySmallValue", label: "§ 13200 real property maximum", item: "2d", constant: "$69,625", required: true },
  ],
};

/** Vehicle transfer — leaves the probate estate entirely. */
export const REG_5: FormTemplate = {
  code: "REG 5",
  title: "Affidavit for Transfer Without Probate — California Titled Vehicle",
  authority: "Cal. Veh. Code § 5910; Cal. Prob. Code § 13050(b)",
  fields: [
    { alias: "decedentName", label: "Name of deceased registered owner", item: "1", factKey: "decedent.full_name", required: true },
    { alias: "dateOfDeath", label: "Date of death", item: "2", factKey: "decedent.date_of_death", required: true, format: "date" },
    { alias: "vehicleVin", label: "Vehicle identification number", item: "3", factKey: "asset.vehicle.vin", required: true },
    { alias: "vehicleValue", label: "Estimated value of the vehicle", item: "5", factKey: "asset.vehicle.value", required: true, format: "usd" },
    { alias: "claimantName", label: "Name of claimant", item: "6", factKey: "estate.petitioner_name", required: true },
  ],
};

export const CA_FORMS: FormTemplate[] = [DE_310, DE_111, DE_300, REG_5];

export function formByCode(code: string): FormTemplate | undefined {
  return CA_FORMS.find((f) => f.code === code);
}

/** Where an executor would obtain a fact a form needs but the data room lacks. */
export const FORM_OBTAIN_HINTS: Record<string, string> = {
  "asset.residence.apn": "Assessor's Parcel Number — from the county assessor's record or the grant deed",
  "asset.vehicle.vin": "Vehicle Identification Number — from the title certificate or the registration card",
};
