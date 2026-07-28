// A synthetic California estate, built so the arithmetic lands either side of
// the real Prob. Code § 13151 primary-residence cap of $750,000.
//
// Margaret Hoyt died on 4 January 2026 in San Mateo County. Her residence was
// appraised at $740,000 — ten thousand dollars under the cap — so her daughter
// Claire can take the cheap road: one petition, no administration.
//
// Then a supplemental appraisal turns up in the data room. It re-values the
// residence at $760,000 after a permitted ADU that the first appraiser missed.
// Twenty thousand dollars moves, and both economical routes close at once.
//
// Every quote below appears verbatim in the document text, except one: the
// $50,000 life insurance policy, which no document supports. It is here on
// purpose, so the verifier can be seen catching a fabrication.

import type { FactCandidate } from "../lib/facts";
import type { SourceDoc } from "../lib/verify";

export const HOYT_DOCS: SourceDoc[] = [
  {
    name: "Certificate of Death.pdf",
    content: `STATE OF CALIFORNIA — CERTIFICATE OF DEATH
Local Registration District 4101, County of San Mateo.
Name of decedent: MARGARET ELLEN HOYT.
Sex: Female. Date of birth: 22 September 1944.
The date of death was 04 January 2026 at 06:12 hours.
Place of death: Mills-Peninsula Medical Center, Burlingame, California.
Usual residence: 1412 Bayberry Lane, San Mateo, California 94402.
Informant: Claire Hoyt, daughter.`,
  },
  {
    name: "Last Will and Testament of Margaret Ellen Hoyt.pdf",
    content: `LAST WILL AND TESTAMENT OF MARGARET ELLEN HOYT

I, Margaret Ellen Hoyt, a resident of the County of San Mateo, State of
California, being of sound mind, declare this to be my Last Will and Testament
and revoke all prior wills.

ARTICLE ONE. I am a widow. My husband Raymond Hoyt predeceased me on
11 March 2019. I have one child, my daughter Claire Hoyt.

ARTICLE TWO. I nominate my daughter Claire Hoyt as Executor of this Will, to
serve without bond.

ARTICLE THREE. My residence at 1412 Bayberry Lane, San Mateo, California has
been my primary residence continuously since 1978, and I direct that it pass to
my daughter Claire Hoyt.

ARTICLE FOUR. I give the remainder of my property, including my accounts at
Wells Fargo Bank and Charles Schwab, to my daughter Claire Hoyt.

ARTICLE FIVE. My 2019 Honda CR-V shall pass to my daughter Claire Hoyt.

Executed at San Mateo, California on 9 May 2021.`,
  },
  {
    name: "Appraisal - 1412 Bayberry Lane.pdf",
    content: `UNIFORM RESIDENTIAL APPRAISAL REPORT
Subject property: 1412 Bayberry Lane, San Mateo, California 94402.
Purpose: retrospective valuation as at date of death for probate purposes.
Effective date of appraisal: 04 January 2026.
Prepared for: Claire Hoyt, prospective personal representative.

The subject is a single-family residence of 1,480 square feet on a 5,200 square
foot lot. Three bedrooms, two bathrooms, detached single garage.

Based on the three closed comparable sales analysed above, the appraiser's
opinion of market value as of the effective date is $740,000.

Appraiser: D. Okonkwo, Certified Residential, CA licence 3049112.
Report date: 02 February 2026.`,
  },
  {
    name: "Wells Fargo statement Jan 2026.pdf",
    content: `WELLS FARGO BANK, N.A. — PERSONAL CHECKING STATEMENT
Account holder: MARGARET E HOYT
Account number ending 4471.
Statement period: 01 December 2025 through 04 January 2026.

Beginning balance $19,208.55
Deposits and credits $1,842.00
Withdrawals and debits $2,650.55

The closing balance as of 04 January 2026 was $18,400.00.`,
  },
  {
    name: "Schwab brokerage statement.pdf",
    content: `CHARLES SCHWAB & CO., INC. — BROKERAGE ACCOUNT STATEMENT
Registration: MARGARET E HOYT, individual account, ending 8802.
Valuation date: 04 January 2026.

Holdings summary:
  Cash and money market            $6,140.00
  Equities and mutual funds      $114,860.00

Total account value on the valuation date was $121,000.00.
This account has no transfer-on-death beneficiary designation on file.`,
  },
  {
    name: "Pacific Mutual policy summary.pdf",
    content: `PACIFIC MUTUAL LIFE — POLICY SUMMARY
Policy number PM-77451-C. Insured: Margaret Ellen Hoyt.
Face amount: $180,000.00.
The designated primary beneficiary of record is Claire Hoyt, daughter.
Because a beneficiary is designated, proceeds are payable directly to the
beneficiary and do not form part of the probate estate.`,
  },
  {
    name: "IRS Account Transcript 2024.pdf",
    content: `INTERNAL REVENUE SERVICE — RETURN TRANSCRIPT
Taxpayer: MARGARET E HOYT. Tax period: December 2024. Form number: 1040.

SCHEDULE B — INTEREST AND ORDINARY DIVIDENDS, PART III
Line 7a: At any time during 2024, did you have a financial interest in or
signature authority over a financial account located in a foreign country?
ANSWER: YES.
Line 7b: Name of foreign country: SWITZERLAND.

FORMS AND SCHEDULES FILED WITH THIS RETURN
  Schedule B    Interest and Ordinary Dividends
  Form 1116     Foreign Tax Credit
  Form 5471     Information Return of U.S. Persons With Respect
                To Certain Foreign Corporations
  Form 8938     Statement of Specified Foreign Financial Assets

FOREIGN TAX PAID (Form 1116, Part II): $4,182.00
PREPARER: Halloran & Reyes CPAs, San Mateo, California.`,
  },
  {
    name: "Wells Fargo wire advice 2024-09-12.pdf",
    content: `WELLS FARGO BANK, N.A. — OUTGOING WIRE TRANSFER ADVICE
Originator: MARGARET E HOYT, account ending 4471.
Value date: 12 September 2024. Amount: USD 48,500.00.

Beneficiary bank: BANQUE PICTET & CIE SA, GENEVA, SWITZERLAND.
SWIFT/BIC: PICTCHGGXXX.
Beneficiary: M E HOYT. Beneficiary account: CH93 0076 2011 6238 5295 7.
Purpose of payment stated by originator: PORTFOLIO FUNDING.

This advice confirms the transfer has been executed and is final.`,
  },
  {
    name: "Call transcript - Claire Hoyt 2026-02-11.txt",
    content: `SETTLEMENT SPECIALIST CALL — RECORDED AND TRANSCRIBED
Participants: Claire Hoyt (executor), settlement specialist.
Date: 11 February 2026.

SPECIALIST: I want to confirm the vehicle. Is it still at the house?
CLAIRE: Yes, the Honda is in the garage. It's a 2019 CR-V.
SPECIALIST: Any idea of the value?
CLAIRE: I looked it up, the Blue Book on it was about sixteen and a half
thousand. Call it $16,500.
SPECIALIST: And your mother's jewellery — was that appraised?
CLAIRE: The jeweller in Burlingame valued the whole collection at $9,200.
SPECIALIST: Did she ever set up a trust?
CLAIRE: She talked about it for years but I don't think she ever finished it.
There's no trust document anywhere in her papers.`,
  },
];

/**
 * A supplemental appraisal, discovered later in the data room. This is the only
 * new document in the second half of the demo.
 */
export const SUPPLEMENTAL_APPRAISAL: SourceDoc = {
  name: "Supplemental Appraisal - 1412 Bayberry Lane.pdf",
  content: `SUPPLEMENTAL APPRAISAL REPORT — REVISION 1
Subject property: 1412 Bayberry Lane, San Mateo, California 94402.
Effective date of appraisal: 04 January 2026. Report date: 19 June 2026.

REASON FOR REVISION. The original report of 02 February 2026 did not account
for the permitted accessory dwelling unit at the rear of the lot, which was
completed under City of San Mateo permit B-2023-4471 and adds 440 square feet
of conditioned living area.

Incorporating the accessory dwelling unit and two further comparable sales, the
revised opinion of market value as of the effective date is $760,000.

This report supersedes the report dated 02 February 2026.

Appraiser: D. Okonkwo, Certified Residential, CA licence 3049112.`,
};

/** What the extractor proposes from the initial data room. */
export const INITIAL_CANDIDATES: FactCandidate[] = [
  {
    key: "decedent.date_of_death",
    label: "Date of death",
    value: "2026-01-04",
    document: "Certificate of Death.pdf",
    quote: "The date of death was 04 January 2026 at 06:12 hours.",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "estate.county",
    label: "County of residence",
    value: "San Mateo",
    document: "Certificate of Death.pdf",
    quote: "Usual residence: 1412 Bayberry Lane, San Mateo, California 94402.",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "decedent.full_name",
    label: "Decedent's full name",
    value: "Margaret Ellen Hoyt",
    document: "Certificate of Death.pdf",
    quote: "Name of decedent: MARGARET ELLEN HOYT.",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "decedent.has_surviving_spouse",
    label: "Surviving spouse",
    value: false,
    document: "Last Will and Testament of Margaret Ellen Hoyt.pdf",
    quote: "I am a widow. My husband Raymond Hoyt predeceased me on\n11 March 2019.",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "decedent.place_of_death",
    label: "Place of death",
    value: "Mills-Peninsula Medical Center, Burlingame, California",
    document: "Certificate of Death.pdf",
    quote: "Place of death: Mills-Peninsula Medical Center, Burlingame, California.",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "estate.petitioner_name",
    label: "Petitioner (executor)",
    value: "Claire Hoyt",
    document: "Last Will and Testament of Margaret Ellen Hoyt.pdf",
    quote: "I nominate my daughter Claire Hoyt as Executor of this Will, to\nserve without bond.",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "asset.residence.address",
    label: "Residence address",
    value: "1412 Bayberry Lane, San Mateo, California 94402",
    document: "Certificate of Death.pdf",
    quote: "Usual residence: 1412 Bayberry Lane, San Mateo, California 94402.",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "asset.residence.value",
    label: "Residence, 1412 Bayberry Lane",
    value: 740_000,
    unit: "USD",
    asOf: "2026-01-04",
    document: "Appraisal - 1412 Bayberry Lane.pdf",
    quote: "opinion of market value as of the effective date is $740,000",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "asset.residence.is_primary_residence",
    label: "Residence was the decedent's primary residence",
    value: true,
    document: "Last Will and Testament of Margaret Ellen Hoyt.pdf",
    quote:
      "My residence at 1412 Bayberry Lane, San Mateo, California has\nbeen my primary residence continuously since 1978",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "asset.checking.value",
    label: "Wells Fargo checking ending 4471",
    value: 18_400,
    unit: "USD",
    asOf: "2026-01-04",
    document: "Wells Fargo statement Jan 2026.pdf",
    quote: "The closing balance as of 04 January 2026 was $18,400.00.",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "asset.brokerage.value",
    label: "Schwab brokerage ending 8802",
    value: 121_000,
    unit: "USD",
    asOf: "2026-01-04",
    document: "Schwab brokerage statement.pdf",
    quote: "Total account value on the valuation date was $121,000.00.",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "asset.jewellery.value",
    label: "Jewellery collection",
    value: 9_200,
    unit: "USD",
    document: "Call transcript - Claire Hoyt 2026-02-11.txt",
    quote: "The jeweller in Burlingame valued the whole collection at $9,200.",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "asset.vehicle.value",
    label: "2019 Honda CR-V",
    value: 16_500,
    unit: "USD",
    document: "Call transcript - Claire Hoyt 2026-02-11.txt",
    quote: "the Blue Book on it was about sixteen and a half\nthousand. Call it $16,500.",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "asset.vehicle.registered_vehicle",
    label: "Vehicle is registered — transfers via DMV",
    value: true,
    document: "Last Will and Testament of Margaret Ellen Hoyt.pdf",
    quote: "My 2019 Honda CR-V shall pass to my daughter Claire Hoyt.",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "asset.life_policy.value",
    label: "Pacific Mutual life policy PM-77451-C",
    value: 180_000,
    unit: "USD",
    document: "Pacific Mutual policy summary.pdf",
    quote: "Face amount: $180,000.00.",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "asset.life_policy.has_named_beneficiary",
    label: "Life policy has a named beneficiary",
    value: true,
    document: "Pacific Mutual policy summary.pdf",
    quote: "The designated primary beneficiary of record is Claire Hoyt, daughter.",
    extractedBy: "claude-opus-4-8",
  },

  // --- Offshore indicators --------------------------------------------------
  // None of these are assets. Each is evidence that an asset exists which no
  // document in the data room describes.
  {
    key: "tax.schedule_b.foreign_account",
    label: "Schedule B reports a foreign financial account",
    value: true,
    document: "IRS Account Transcript 2024.pdf",
    quote: "ANSWER: YES.",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "tax.schedule_b.foreign_country",
    label: "Foreign country named on Schedule B",
    value: "Switzerland",
    document: "IRS Account Transcript 2024.pdf",
    quote: "Line 7b: Name of foreign country: SWITZERLAND.",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "tax.form_5471.filed",
    label: "Form 5471 filed — foreign corporation",
    value: true,
    document: "IRS Account Transcript 2024.pdf",
    quote:
      "Form 5471     Information Return of U.S. Persons With Respect\n                To Certain Foreign Corporations",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "tax.form_8938.filed",
    label: "Form 8938 filed — specified foreign financial assets",
    value: true,
    document: "IRS Account Transcript 2024.pdf",
    quote: "Form 8938     Statement of Specified Foreign Financial Assets",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "tax.form_1116.filed",
    label: "Form 1116 filed — foreign tax credit",
    value: true,
    document: "IRS Account Transcript 2024.pdf",
    quote: "Form 1116     Foreign Tax Credit",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "banking.international_wire.country",
    label: "Outgoing international wire destination",
    value: "Switzerland",
    document: "Wells Fargo wire advice 2024-09-12.pdf",
    quote: "Beneficiary bank: BANQUE PICTET & CIE SA, GENEVA, SWITZERLAND.",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "banking.international_wire.beneficiary_account",
    label: "Foreign beneficiary account",
    value: "CH93 0076 2011 6238 5295 7",
    document: "Wells Fargo wire advice 2024-09-12.pdf",
    quote: "Beneficiary: M E HOYT. Beneficiary account: CH93 0076 2011 6238 5295 7.",
    extractedBy: "claude-opus-4-8",
  },
  {
    key: "advisers.professional.name",
    label: "Named accountant",
    value: "Halloran & Reyes CPAs",
    document: "IRS Account Transcript 2024.pdf",
    quote: "PREPARER: Halloran & Reyes CPAs, San Mateo, California.",
    extractedBy: "claude-opus-4-8",
  },

  // --- The fabrication ------------------------------------------------------
  // No document says this. The model has confused the Pacific Mutual policy
  // with a second, non-existent one. The quote below appears nowhere in the
  // data room, so the warrant fails and the fact is quarantined before it can
  // reach the § 13100 computation — where it would have added $50,000 and, on
  // a closer estate, changed the answer.
  {
    key: "asset.prudential_policy.value",
    label: "Prudential life policy",
    value: 50_000,
    unit: "USD",
    document: "Pacific Mutual policy summary.pdf",
    quote:
      "The decedent also held a Prudential whole life policy with a face amount of $50,000.00 payable to the estate.",
    extractedBy: "claude-opus-4-8",
  },
];

/** What the extractor proposes once the supplemental appraisal is ingested. */
export const SUPPLEMENTAL_CANDIDATE: FactCandidate = {
  key: "asset.residence.value",
  label: "Residence, 1412 Bayberry Lane",
  value: 760_000,
  unit: "USD",
  asOf: "2026-01-04",
  document: "Supplemental Appraisal - 1412 Bayberry Lane.pdf",
  quote: "revised opinion of market value as of the effective date is $760,000",
  extractedBy: "claude-opus-4-8",
};

export const AS_OF = "2026-07-27";
