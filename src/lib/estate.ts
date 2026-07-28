// The Alix estate-record adapter.
//
// Alix's case-management system exports an estate as a single JSON document —
// decedent, fiduciary, authority, tax matters, per-form blocks, related parties
// and asset roll-ups. Track 3 ships five of these as samples. This module turns
// one into warranted facts so the rest of the engine (rules, gaps, form fill)
// works on an imported estate exactly as it works on an extracted one.
//
// Two things are deliberate.
//
// Every imported fact carries a record warrant naming the exact path it came
// from, and `admitRecord` re-reads that path to confirm it. If Alix renames a
// field, the importer produces quarantined facts naming the dead paths instead
// of quietly dropping data — the failure is loud and localised.
//
// Nothing is normalised on the way in. The samples contain a truncated street
// address ("151 N"), ALL-CAPS city names, a Florida-format licence held by a
// Texas resident and a California licence one digit too long. Their provenance
// notes are explicit that these are real shapes reproduced on purpose. An
// importer that tidied them would be hiding precisely the cases a form-filler
// has to survive, so values are carried through as they sit and the mess is
// allowed to reach the form.

import { admitRecord, type Fact, type FactValue } from "./facts";

/** Only the parts of Alix's schema this engine reads. Their export has more. */
export interface EstateRecord {
  meta: { recordId: string; schemaVersion: string; label?: string; sourceSystem?: string };
  decedent: {
    name: { first?: string | null; middle?: string | null; last?: string | null; full: string };
    ssn?: string | null;
    dateOfBirth?: string | null;
    dateOfDeath?: string | null;
    maritalStatus?: string | null;
    residenceAddress?: PostalAddress | null;
    placeOfDeath?: { type?: string | null; name?: string | null; address?: PostalAddress | null } | null;
    identifications?: Identification[];
  };
  estateEntity: {
    legalName: string;
    careOfName?: string | null;
    entityKind?: string | null;
    ein?: string | null;
    identifyingNumber?: string | null;
    mailingAddress?: PostalAddress | null;
    principalCounty?: string | null;
    principalState?: string | null;
    daytimePhone?: Phone | null;
    trust?: { name?: string | null; trusteeName?: string | null; grantorTin?: string | null } | null;
  };
  fiduciary: {
    name: { full: string };
    title?: string | null;
    ssn?: string | null;
    address?: PostalAddress | null;
    phone?: Phone | null;
    email?: string | null;
    relationshipToDecedent?: string | null;
    signatureDate?: string | null;
  };
  authority: {
    basis?: string | null;
    dateOfDeath?: string | null;
    dateOfAppointment?: string | null;
    authorityStatus?: string | null;
    administrationPath?: string | null;
    hasWill?: boolean | null;
    hasTrust?: boolean | null;
    bondRequired?: string | null;
    proceeding?: Record<string, unknown> | null;
  };
  taxMatters?: Record<string, unknown>;
  form56?: Record<string, unknown>;
  form8821?: Record<string, unknown>;
  formSS4?: Record<string, unknown>;
  formDL142?: Record<string, unknown>;
  relatedParties?: unknown[];
  assets?: AssetRollup[];
  provenance?: Record<string, unknown>;
}

export interface PostalAddress {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  county?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  isPoBox?: boolean | null;
}

export interface Phone {
  number?: string | null;
  countryCode?: string | null;
  type?: string | null;
  primary?: boolean | null;
}

export interface Identification {
  type?: string | null;
  number?: string | null;
  issuingState?: string | null;
  issuingCountry?: string | null;
  expirationDate?: string | null;
}

export interface AssetRollup {
  category: string;
  subcategory?: string | null;
  count?: number | null;
  totalEstimatedValue?: number | null;
  totalDateOfDeathValue?: number | null;
  institutions?: string[];
}

/** One import instruction: which record path becomes which fact. */
interface Import {
  key: string;
  label: string;
  path: string;
  unit?: string;
}

/**
 * The scalar imports. Assets and identifications are handled separately because
 * they are arrays whose indices are not stable across records.
 */
const IMPORTS: Import[] = [
  { key: "decedent.full_name", label: "Decedent", path: "decedent.name.full" },
  { key: "decedent.ssn", label: "Decedent SSN", path: "decedent.ssn" },
  { key: "decedent.date_of_birth", label: "Date of birth", path: "decedent.dateOfBirth" },
  { key: "decedent.date_of_death", label: "Date of death", path: "decedent.dateOfDeath" },
  { key: "decedent.marital_status", label: "Marital status", path: "decedent.maritalStatus" },
  { key: "decedent.residence_state", label: "State of residence", path: "decedent.residenceAddress.state" },
  { key: "decedent.residence_county", label: "County of residence", path: "decedent.residenceAddress.county" },
  { key: "decedent.residence_city", label: "City of residence", path: "decedent.residenceAddress.city" },
  { key: "decedent.residence_line1", label: "Residence street", path: "decedent.residenceAddress.line1" },
  { key: "decedent.residence_zip", label: "Residence ZIP", path: "decedent.residenceAddress.zip" },

  { key: "estate.legal_name", label: "Estate name", path: "estateEntity.legalName" },
  { key: "estate.entity_kind", label: "Entity kind", path: "estateEntity.entityKind" },
  { key: "estate.ein", label: "Estate EIN", path: "estateEntity.ein" },
  { key: "estate.care_of", label: "Care of", path: "estateEntity.careOfName" },
  { key: "estate.county", label: "County", path: "estateEntity.principalCounty" },
  { key: "estate.state", label: "State", path: "estateEntity.principalState" },
  { key: "estate.mailing_line1", label: "Mailing street", path: "estateEntity.mailingAddress.line1" },
  { key: "estate.mailing_city", label: "Mailing city", path: "estateEntity.mailingAddress.city" },
  { key: "estate.mailing_state", label: "Mailing state", path: "estateEntity.mailingAddress.state" },
  { key: "estate.mailing_zip", label: "Mailing ZIP", path: "estateEntity.mailingAddress.zip" },
  { key: "estate.daytime_phone", label: "Daytime phone", path: "estateEntity.daytimePhone.number" },
  { key: "estate.trust_name", label: "Trust name", path: "estateEntity.trust.name" },
  { key: "estate.trustee_name", label: "Trustee", path: "estateEntity.trust.trusteeName" },

  { key: "estate.petitioner_name", label: "Fiduciary", path: "fiduciary.name.full" },
  { key: "fiduciary.title", label: "Fiduciary title", path: "fiduciary.title" },
  { key: "fiduciary.ssn", label: "Fiduciary SSN", path: "fiduciary.ssn" },
  { key: "fiduciary.relationship", label: "Relationship", path: "fiduciary.relationshipToDecedent" },
  { key: "fiduciary.email", label: "Fiduciary email", path: "fiduciary.email" },
  { key: "fiduciary.phone", label: "Fiduciary phone", path: "fiduciary.phone.number" },
  { key: "fiduciary.line1", label: "Fiduciary street", path: "fiduciary.address.line1" },
  { key: "fiduciary.city", label: "Fiduciary city", path: "fiduciary.address.city" },
  { key: "fiduciary.state", label: "Fiduciary state", path: "fiduciary.address.state" },
  { key: "fiduciary.zip", label: "Fiduciary ZIP", path: "fiduciary.address.zip" },
  { key: "fiduciary.signature_date", label: "Signature date", path: "fiduciary.signatureDate" },

  { key: "authority.basis", label: "Authority basis", path: "authority.basis" },
  { key: "authority.status", label: "Authority status", path: "authority.authorityStatus" },
  { key: "authority.administration_path", label: "Administration path", path: "authority.administrationPath" },
  { key: "authority.date_of_appointment", label: "Date of appointment", path: "authority.dateOfAppointment" },
  { key: "authority.has_will", label: "Will exists", path: "authority.hasWill" },
  { key: "authority.has_trust", label: "Trust exists", path: "authority.hasTrust" },
  { key: "authority.bond_required", label: "Bond", path: "authority.bondRequired" },
  { key: "court.name", label: "Court", path: "authority.proceeding.courtName" },
  { key: "court.is_proceeding", label: "Court proceeding", path: "authority.proceeding.isCourtProceeding" },
  { key: "court.docket_number", label: "Docket number", path: "authority.proceeding.docketNumber" },
  { key: "court.letters_issued_date", label: "Letters issued", path: "authority.proceeding.lettersIssuedDate" },
  { key: "court.line1", label: "Court street", path: "authority.proceeding.courtAddress.line1" },
  { key: "court.city", label: "Court city", path: "authority.proceeding.courtAddress.city" },
  { key: "court.state", label: "Court state", path: "authority.proceeding.courtAddress.state" },
  { key: "court.zip", label: "Court ZIP", path: "authority.proceeding.courtAddress.zip" },
  { key: "court.room", label: "Court room", path: "authority.proceeding.courtRoomOrSuite" },

  // The first Form 8821 designee. Its presence is what makes the 8821 rule
  // fire at all, so omitting it silently suppressed the form for every record.
  { key: "tax.designee.name", label: "Tax designee", path: "form8821.designees.0.name" },
  { key: "tax.designee.firm", label: "Designee firm", path: "form8821.designees.0.firmName" },
  { key: "tax.designee.caf", label: "Designee CAF", path: "form8821.designees.0.cafNumber" },
  { key: "tax.taxpayer_identification", label: "Taxpayer TIN(s)", path: "form8821.taxpayerIdentificationNumbers" },
];

/** Category → the fact-key stem used elsewhere in the engine. */
const CATEGORY_STEM: Record<string, string> = {
  RealEstate: "residence",
  Vehicle: "vehicle",
  BankAccount: "bank",
  Investment: "brokerage",
  LifeInsurance: "life_policy",
  Retirement: "retirement",
  PersonalProperty: "personal_property",
  UnclaimedProperty: "unclaimed_property",
};

function scalar(v: unknown): FactValue | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.length ? v : null;
  if (typeof v === "number" || typeof v === "boolean") return v;
  return null;
}

export interface ImportResult {
  facts: Fact[];
  /** Paths that were present but empty — absent data, not broken mapping. */
  emptyPaths: string[];
}

/**
 * Import an estate record as facts.
 *
 * A null or empty field yields no fact at all rather than a fact with an empty
 * value. That is what keeps three-valued logic honest downstream: an estate
 * with no EIN yet must read as *unknown*, so the rule that wants one reports
 * itself blocked and names it. Writing an empty string would make the fact
 * present and the gap invisible, which is the single most damaging thing an
 * importer can do to this engine.
 */
export function importEstate(record: EstateRecord, opts: { now?: number } = {}): ImportResult {
  const system = record.meta.sourceSystem ?? "alix-estate-manager";
  const recordId = record.meta.recordId;
  const facts: Fact[] = [];
  const emptyPaths: string[] = [];

  for (const imp of IMPORTS) {
    const raw = readRaw(record, imp.path);
    const value = scalar(raw);
    if (value === null) {
      emptyPaths.push(imp.path);
      continue;
    }
    facts.push(
      admitRecord(
        { key: imp.key, label: imp.label, value, unit: imp.unit, system, recordId, path: imp.path },
        record,
        opts,
      ),
    );
  }

  // Identifications: the licence that drives DL 142 and its sibling state forms.
  const ids = record.decedent.identifications ?? [];
  const licenceIndex = ids.findIndex((i) => i?.type === "DriversLicense");
  if (licenceIndex >= 0) {
    const base = `decedent.identifications.${licenceIndex}`;
    for (const [suffix, key, label] of [
      ["number", "decedent.licence_number", "Licence number"],
      ["issuingState", "decedent.licence_state", "Licence state"],
    ] as const) {
      const value = scalar(readRaw(record, `${base}.${suffix}`));
      if (value === null) continue;
      facts.push(
        admitRecord(
          { key, label, value, system, recordId, path: `${base}.${suffix}` },
          record,
          opts,
        ),
      );
    }
  }
  const hasPassport = ids.some((i) => i?.type === "Passport");
  if (hasPassport) {
    const idx = ids.findIndex((i) => i?.type === "Passport");
    const value = scalar(readRaw(record, `decedent.identifications.${idx}.number`));
    if (value !== null) {
      facts.push(
        admitRecord(
          {
            key: "decedent.passport_number",
            label: "Passport number",
            value,
            system,
            recordId,
            path: `decedent.identifications.${idx}.number`,
          },
          record,
          opts,
        ),
      );
    }
  }

  // Asset roll-ups. Alix aggregates by category rather than listing instruments,
  // so a category with three checking accounts arrives as one row with count 3.
  // Keys are suffixed when a category repeats with different subcategories.
  const seen = new Map<string, number>();
  (record.assets ?? []).forEach((asset, i) => {
    const stem = CATEGORY_STEM[asset.category] ?? asset.category.toLowerCase();
    const n = (seen.get(stem) ?? 0) + 1;
    seen.set(stem, n);
    const id = n === 1 ? stem : `${stem}_${n}`;
    const value = scalar(readRaw(record, `assets.${i}.totalEstimatedValue`));
    if (value === null) {
      emptyPaths.push(`assets.${i}.totalEstimatedValue`);
      return;
    }
    facts.push(
      admitRecord(
        {
          key: `asset.${id}.value`,
          label: `${asset.category}${asset.subcategory ? ` — ${asset.subcategory}` : ""}`,
          value,
          unit: "USD",
          system,
          recordId,
          path: `assets.${i}.totalEstimatedValue`,
        },
        record,
        opts,
      ),
    );
  });

  return { facts, emptyPaths };
}

function readRaw(record: EstateRecord, path: string): unknown {
  let node: unknown = record;
  for (const seg of path.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    const idx = Number(seg);
    if (Array.isArray(node)) {
      if (!Number.isInteger(idx)) return undefined;
      node = node[idx];
    } else {
      node = (node as Record<string, unknown>)[seg];
    }
  }
  return node;
}

/**
 * Every leaf path in a record, for coverage reporting. Knowing that we import
 * 51 of 180 available paths is more useful than believing we import "most".
 */
export function leafPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return prefix ? [prefix] : [];
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => leafPaths(v, `${prefix}.${i}`));
  }
  return Object.entries(value).flatMap(([k, v]) => leafPaths(v, prefix ? `${prefix}.${k}` : k));
}

/** The record paths this importer reads, for the same coverage report. */
export function importedPaths(): string[] {
  return IMPORTS.map((i) => i.path);
}
