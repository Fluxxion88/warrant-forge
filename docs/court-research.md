# Court research — jurisdiction pack acquisition run

Retrieved **2026-07-28**. Three courts: Houston County GA, San Francisco CA, New York City NY.

Emitted as `<<<CLAIM ... CLAIM>>>` blocks per `COUNTY_SYSTEM` in `src/lib/countycompile.ts`, so
they can be fed to `parseClaims` → `verifyClaim` → `compileCounty`.

> **Two of these courts are not California superior courts.** `COUNTY_SYSTEM` is written for one
> ("You read a California superior court's own published pages"), and the `COUNTY_FIELDS`
> allowlist encodes California assumptions — `examiner`, `tentativeRulings`, `firstPaperFeeUsd`
> as a single scalar. Georgia and New York do not fit that shape cleanly. Where a court's reality
> did not fit a field, I left the field unclaimed rather than bending the value. See
> **Notes for the compiler layer** at the end.

---

## 1. Access map

The instruction to record what could and could not be fetched directly — this is that record.

| Target | Plain `WebFetch` | Resolution |
|---|---|---|
| `houstoncountyga.gov` probate pages | **200 OK** | but only ever returned *model summaries*, never raw text — see caveat below |
| `sf.courts.ca.gov` HTML pages | **200 OK** | raw markdown obtainable on the second attempt |
| `sf.courts.ca.gov` PDFs | **200 OK** (bytes) | text extraction refused/failed by the fetcher; extracted locally instead |
| `www.nycourts.gov/new-york-city-surrogates-court` | **403 Forbidden** | headless browser (`Claude_Browser`) loaded it fine |
| `www.nycourts.gov/courts/1jd/surrogates/index.shtml` | **302 → 403** | same |
| `www.nycourts.gov/legacypdfs/.../feeschedule_2.pdf` | **403 Forbidden** | **never obtained** — see NYC could-not-establish |
| `ww2.nycourts.gov` | **302 cross-host** | redirects to `www.nycourts.gov`, then 403 |

Findings for the acquisition layer:

1. **`nycourts.gov` blocks non-browser user agents at the edge, but not selectively.** HTML pages
   and PDFs both 403. A real browser session got the HTML immediately; the PDF was never retried
   through the browser and remains unfetched. An acquisition pipeline for New York needs a
   browser-based fetcher, not an HTTP client.
2. **`WebFetch` returning HTTP 200 does not mean you have the text.** For Houston County every
   call returned a *summarised, reworded* rendering of the page. Two calls to the same URL
   produced differently-worded "quotes" of the same sentence. This is the exact failure this
   project exists to prevent: a summariser in the acquisition path silently manufactures
   near-verbatim text. **Every quote below was re-obtained from DOM `innerText` or from local PDF
   extraction**, never from a summary. Nothing sourced only from a summary was allowed to become
   a CLAIM.
3. **PDFs must be extracted locally.** The fetcher declined to extract two of them (once citing
   copyright, once citing binary encoding) while having already saved the bytes to disk.
4. **Flat PDF text extraction silently misaligns multi-column fee tables.** See the San Francisco
   fee finding — this one would have produced a wrong number that looked right.

---

## 2. Source documents

Quote verification requires the verifier be handed the *same* text I quoted from. Extraction
method is therefore part of the source identity, and is recorded here so a `SourceDoc` can be
rebuilt byte-identically.

| Document name | URL | Extraction method |
|---|---|---|
| `HC-PROBATE-HOME` | https://www.houstoncountyga.gov/government/probate-court.cms | browser `document.body.innerText` |
| `HC-ESTATE` | https://www.houstoncountyga.gov/government/estate.cms | browser, `innerText` of `#content,.content,main` |
| `HC-FORMS` | https://www.houstoncountyga.gov/government/commonprobateforms.cms | browser, `innerText` of `#content,.content,main` |
| `HC-STEPS-PDF` | https://www.houstoncountyga.gov/skins/userfiles/files/Steps%20in%20Probating%20a%20Will.pdf | `pdftotext -layout` |
| `SF-PROBATE` | https://sf.courts.ca.gov/divisions/probate-court | browser, `innerText` of `main` |
| `SF-WILLS` | https://sf.courts.ca.gov/divisions/probate-court/wills-and-decedents-estates | browser, `innerText` of `main` |
| `SF-EFILING` | https://sf.courts.ca.gov/online-services/e-filing | browser, `innerText` of `main` |
| `SF-LOCALFORMS` | https://sf.courts.ca.gov/forms-fees/local-forms | browser, `innerText` of `main` |
| `SF-APPENDIX-A` | https://sf.courts.ca.gov/system/files/tentative-rulings/probate-local-rule_appendix.pdf | `pdftotext -layout` |
| `SF-FEE-SCHEDULE` | https://sf.courts.ca.gov/system/files/general/statewide-civil-fee-schedule-eff-01012026.pdf | `pdfplumber`, words grouped into rows by `round(top/3)`, joined by ascending `x0` |
| `NYC-SURR-HOME` | https://www.nycourts.gov/new-york-city-surrogates-court | browser, `innerText` of `main` |
| `NYC-FAQ` | https://www.nycourts.gov/new-york-city-surrogates-court/nyc-surrogates-court-frequently-asked-questions | browser same-origin `fetch` + `DOMParser`, `innerText` of `main` |
| `NYC-FORMS` | https://www.nycourts.gov/new-york-city-surrogates-court/nyc-surrogates-court-forms | browser same-origin `fetch` + `DOMParser`, `innerText` of `main` |
| `NY-COUNTY-SURR` | https://www.nycourts.gov/courts/1st-judicial-district/new-york-county-surrogates-court | browser same-origin `fetch` + `DOMParser`, `innerText` of `main` |

`SF-FEE-SCHEDULE` is the only source whose text is **reconstructed rather than linear**. Flat
extraction of that PDF interleaves the description, code and amount columns across rows, so
`pdftotext` output associates item 124's description with a *different* row's dollar amount. The
y-clustering above is what makes the row readable. Quotes from that document are therefore quotes
from the reconstruction, and the reconstruction is reproducible from the recipe in the table.

Two quotes below preserve **typos in the original** (`filling` for "filing"; `April, 1, 2022`).
They are copied as printed, because a tidied quote fails the matcher and should.

---

## 3. CLAIM blocks

### 3.1 Houston County, Georgia

<<<CLAIM
field: court
value: Houston County Probate Court
document: HC-STEPS-PDF
quote: HOUSTON COUNTY PROBATE COURT
CLAIM>>>

<<<CLAIM
field: firstPaperFeeUsd
value: 210
document: HC-ESTATE
quote: COMMON FORM WILL PROBATE $210
CLAIM>>>

<<<CLAIM
field: obligations
value: A petition must be complete and legible, typed or printed.
document: HC-ESTATE
quote: Your petition must be complete and legible (please type or print).
CLAIM>>>

<<<CLAIM
field: obligations
value: A certified copy of the death certificate must be supplied if it is not already on file in Houston County.
document: HC-ESTATE
quote: If the decedent's death certificate is not on file here in Houston County, you must provide us with a certified copy of his or her death certificate
CLAIM>>>

<<<CLAIM
field: obligations
value: The original will must be filed with the petition.
document: HC-ESTATE
quote: If applicable, the original will must be filed with your petition (if original will is lost, there will be further requirements)
CLAIM>>>

<<<CLAIM
field: obligations
value: A death certificate must be submitted in will probates, administrations and year's support proceedings.
document: HC-PROBATE-HOME
quote: You must submit a Death Certificate in Will Probates, Administrations, and Year’s Support Proceedings.
CLAIM>>>

<<<CLAIM
field: obligations
value: A legal ad is always required for year's support petitions, for administrations seeking certain powers and waiver of bond, and for solemn form probates and administrations with unknown heirs or heirs with unknown addresses.
document: HC-ESTATE
quote: A legal ad is always required for Year's Support petitions, administrations where petitioners are requesting certain powers and waiver of bond and for solemn form probates and administrations with any unknown heirs or heirs with unknown addresses.
CLAIM>>>

<<<CLAIM
field: obligations
value: All signatures on the petition must be notarised.
document: HC-STEPS-PDF
quote: Have ALL signatures NOTARIZED
CLAIM>>>

<<<CLAIM
field: obligations
value: Original documents must be filed by mail or in person, not electronically.
document: HC-STEPS-PDF
quote: The Court requires that the original documents be filed by mail or in person.
CLAIM>>>

<<<CLAIM
field: obligations
value: Court clerks may not answer questions about or assist with completing petitions.
document: HC-STEPS-PDF
quote: Clerks of the probate court may NOT answer any questions or provide any assistance in completing the petitions.
CLAIM>>>

<<<CLAIM
field: efiling.exclusions
value: Original documents, which must be filed by mail or in person
document: HC-STEPS-PDF
quote: The Court requires that the original documents be filed by mail or in person.
CLAIM>>>

<<<CLAIM
field: efiling.exclusions
value: The "Court Pages" portion of any petition
document: HC-PROBATE-HOME
quote: Please do not submit the “Court Pages” portion of Any Petition
CLAIM>>>

<<<CLAIM
field: localForm.code
value: GPCSF 33
document: HC-ESTATE
quote: DISCHARGE FEES FOR PERSONAL REPRESENTATIVE -- GPCSF 33
CLAIM>>>

<<<CLAIM
field: localForm.title
value: Petition for Discharge of Personal Representative
document: HC-FORMS
quote: Petition for Discharge of Personal Representative
CLAIM>>>

**Deliberately not claimed for Houston County:** `efiling.mandatoryFor`, `efiling.since`,
`examiner`, `tentativeRulings`, `localRulesEffective`. Reasons in §5.1.

---

### 3.2 San Francisco County, California

<<<CLAIM
field: court
value: Superior Court of California, County of San Francisco — Probate Court
document: SF-EFILING
quote: the Superior Court of California County of San Francisco required mandatory electronic filing and service pursuant to Code of Civil Procedure section 1010.6
CLAIM>>>

<<<CLAIM
field: firstPaperFeeUsd
value: 450
document: SF-FEE-SCHEDULE
quote: Total fee (with local $ 225 $ 370 $ 145 $ 450
CLAIM>>>

<<<CLAIM
field: examiner
value: Petitions are pre-reviewed by a probate examiner whose name appears on the tentative ruling for the hearing; the court lists five examiners with direct email addresses.
document: SF-PROBATE
quote: How do I contact the examiner whose name appears on the tentative ruling for my upcoming hearing?
CLAIM>>>

<<<CLAIM
field: tentativeRulings
value: Probate tentative rulings are published online or by phone one to three days before the hearing.
document: SF-PROBATE
quote: Probate Tentative Rulings may be obtained online or by phone one to three days before the hearing.
CLAIM>>>

<<<CLAIM
field: efiling.mandatoryFor
value: represented parties
document: SF-EFILING
quote: Pursuant to California Rules of Court 2.253 self-represented parties are not subject to mandatory electronic filing.
CLAIM>>>

<<<CLAIM
field: efiling.since
value: 2024-07-01
document: SF-EFILING
quote: Effective July 1, 2024, the Court expanded its mandatory electronic filing program to Probate Guardianship and Conservatorship cases.
CLAIM>>>

<<<CLAIM
field: efiling.exclusions
value: Petition For Authority To Give Consent For Medical Treatment
document: SF-EFILING
quote: Petition For Authority To Give Consent For Medical Treatment
CLAIM>>>

<<<CLAIM
field: obligations
value: Mandatory e-filing reached probate only for guardianship and conservatorship cases, effective 1 July 2024.
document: SF-EFILING
quote: Effective July 1, 2024, the Court expanded its mandatory electronic filing program to Probate Guardianship and Conservatorship cases.
CLAIM>>>

<<<CLAIM
field: obligations
value: A Confidential Supplement to Duties and Liabilities of Personal Representative is required.
document: SF-WILLS
quote: Confidential Supplement to Duties and Liabilities of Personal Representative is required.
CLAIM>>>

<<<CLAIM
field: obligations
value: The hearing date is assigned by the filing clerk when the petition is filed, not requested by the petitioner.
document: SF-PROBATE
quote: Hearing dates for all appearance matters are assigned by the filing clerk at the time the petition is filed.
CLAIM>>>

<<<CLAIM
field: obligations
value: Ex parte petitions not seeking an appearance must be submitted by leaving a courtesy copy with the probate clerk in Room 103.
document: SF-PROBATE
quote: All ex parte petitions not seeking an appearance must be submitted by leaving a courtesy copy with the probate clerk in Room 103.
CLAIM>>>

<<<CLAIM
field: obligations
value: A petition seeking expedited review for demonstrable urgency must have the blue cover sheet attached.
document: SF-PROBATE
quote: If petition seeks expedited review for demonstrable urgency, the petitioner must attach the blue cover sheet, Request For Expedited Review By Probate Court.
CLAIM>>>

<<<CLAIM
field: obligations
value: A petition for appointment of probate conservator on Form GC-310 must be accompanied by Judicial Council form GC-325.
document: SF-PROBATE
quote: Petition for Appointment of Probate Conservator [Form GC-310] to establish conservatorship must be accompanied by the following new mandatory Judicial Council form:
CLAIM>>>

<<<CLAIM
field: obligations
value: The court publishes a checklist of common problems and reasons for delay as Appendix A to Local Rules Chapter 14, Probate.
document: SF-APPENDIX-A
quote: CHECKLIST OF COMMON PROBLEMS AND REASONS FOR DELAY
CLAIM>>>

<<<CLAIM
field: localForm.title
value: Order Appointing Probate Referee
document: SF-LOCALFORMS
quote: Order Appointing Probate Referee PRB-PES-002
CLAIM>>>

<<<CLAIM
field: localForm.code
value: PRB-PES-002
document: SF-LOCALFORMS
quote: Order Appointing Probate Referee PRB-PES-002
CLAIM>>>

<<<CLAIM
field: localForm.title
value: Request for Appointment of Probate Referee
document: SF-LOCALFORMS
quote: Request for Appointment of Probate Referee PRB-PES-003
CLAIM>>>

<<<CLAIM
field: localForm.code
value: PRB-PES-003
document: SF-LOCALFORMS
quote: Request for Appointment of Probate Referee PRB-PES-003
CLAIM>>>

<<<CLAIM
field: localForm.title
value: Contact Information
document: SF-LOCALFORMS
quote: Contact Information PRB-PCN-001
CLAIM>>>

<<<CLAIM
field: localForm.code
value: PRB-PCN-001
document: SF-LOCALFORMS
quote: Contact Information PRB-PCN-001
CLAIM>>>

<<<CLAIM
field: localForm.title
value: General Plan for Personal and Financial Needs of Conservatee
document: SF-LOCALFORMS
quote: General Plan for Personal and Financial Needs of Conservatee PRB-PCN-002
CLAIM>>>

<<<CLAIM
field: localForm.code
value: PRB-PCN-002
document: SF-LOCALFORMS
quote: General Plan for Personal and Financial Needs of Conservatee PRB-PCN-002
CLAIM>>>

<<<CLAIM
field: localForm.title
value: Status Report on Conservatee
document: SF-LOCALFORMS
quote: Status Report on Conservatee PRB-PCN-005
CLAIM>>>

<<<CLAIM
field: localForm.code
value: PRB-PCN-005
document: SF-LOCALFORMS
quote: Status Report on Conservatee PRB-PCN-005
CLAIM>>>

<<<CLAIM
field: localForm.title
value: Confidential Declaration of Proposed Guardian
document: SF-LOCALFORMS
quote: Confidential Declaration of Proposed Guardian PRB-PGN-001
CLAIM>>>

<<<CLAIM
field: localForm.code
value: PRB-PGN-001
document: SF-LOCALFORMS
quote: Confidential Declaration of Proposed Guardian PRB-PGN-001
CLAIM>>>

**Deliberately not claimed for San Francisco:** `localRulesEffective`, and any
`localForm.whenRequired`. Reasons in §5.2.

---

### 3.3 New York City Surrogate's Court

<<<CLAIM
field: court
value: New York City Surrogate's Court
document: NYC-SURR-HOME
quote: About the New York City Surrogate's Court
CLAIM>>>

<<<CLAIM
field: obligations
value: The original will and a certified copy of the death certificate must be filed with the probate petition in the Surrogate's Court of the county where the decedent was domiciled.
document: NYC-FAQ
quote: The original will and a certified copy of the death certificate need to be filed with the probate petition and other supporting documents in the Surrogate's Court located in the county in which the decedent was domiciled (had their primary residence).
CLAIM>>>

<<<CLAIM
field: obligations
value: The filing fee varies with the size of the estate; no amount is stated on the court's pages.
document: NYC-FAQ
quote: There will be a filing fee based on the size of the estate.
CLAIM>>>

<<<CLAIM
field: obligations
value: Official Surrogate's Court PDF forms are fillable on screen but cannot be submitted online or saved.
document: NYC-FORMS
quote: The PDF version of these forms are fillable. They can be filled out electronically, then printed. However, they cannot be submitted online or saved.
CLAIM>>>

<<<CLAIM
field: obligations
value: Checklists published alongside the forms are aids for completing petitions and must not be filed with the court.
document: NYC-FORMS
quote: These checklists are provided to assist members of the public in completing petitions for common proceedings in the Surrogate's Court, and should not be submitted to the court.
CLAIM>>>

<<<CLAIM
field: obligations
value: In New York County, all citations in administration proceedings are returnable in person at 10:00 a.m. on Tuesdays and Fridays.
document: NY-COUNTY-SURR
quote: All citations in Administration Proceedings, whether issued in matters before Surrogate Gingold or Surrogate Mella, will be returnable in person. Citations will be returnable at 10:00 a.m. on Tuesdays and Fridays.
CLAIM>>>

<<<CLAIM
field: efiling.exclusions
value: Miscellaneous filings, in New York County
document: NY-COUNTY-SURR
quote: New York County Surrogate’s Court users can file all proceedings electronically through the NYSCEF system except for Miscellaneous filings.
CLAIM>>>

**Deliberately not claimed for New York City:** `firstPaperFeeUsd`, `efiling.mandatoryFor`,
`efiling.since`, `examiner`, `tentativeRulings`, `localRulesEffective`, all `localForm.*`.
Reasons in §5.3.

---

## 4. Plain-language summary

### 4.1 Houston County, Georgia — Houston County Probate Court

A Georgia probate court is a **court in its own right, not a division of a superior court**. There
is no "probate division" to name here, and the `court` field carries the whole institution. Judge
Kristen Warren Harris presides; Kim Willson is Chief Clerk.

**Fees are per-petition and published as a table keyed to Georgia Probate Court Standard Form
(GPCSF) numbers**, which is a materially different shape from California's single first-paper fee:

| GPCSF | Petition | Fee |
|---|---|---|
| 2 | Temporary Administration | $195 |
| 3 | Administration | $210 |
| 4 | Common Form Will Probate | $210 |
| 5 | Solemn Form Will Probate | $210 |
| 7 | Will Annexed | $210 |
| 9 | No Administration Necessary | $210 |
| 10 | Year's Support | $210 |

I claimed `firstPaperFeeUsd: 210` from the Common Form Will Probate row, per `COUNTY_SYSTEM`
rule 3 ("take the first-paper petition fee and no other"). **Be aware that this collapses a
seven-row table into one scalar and loses the $195 temporary-administration case.** The GPCSF
numbers in the left column are a *column-header association*, not contiguous text — "GPCSF 4"
appears nowhere on the page as a string — so I did not emit them as `localForm.code`. The one
exception is `GPCSF 33`, which the page does print inline.

**There is an unresolved conflict about the filing fee.** The estate page's table says $210 for a
common form will probate. The court's own "Steps in Probating a Will" PDF says a check or money
order "in the amount of $130.00 for the filing fee". Both are the court's own publications. See §6.

E-filing launched through **TrueFiling** and the page's verb is "accepts", not "requires" —
$14.00 per petition or caveat plus a 3.25% card convenience fee, with statutory fees unchanged.
Two exclusions are stated outright: original documents must come by mail or in person, and filers
must not submit the "Court Pages" portion of any petition — those pages, the court explains, are
the ones headed by a notice referring to **Uniform Probate Court Rule 5.6(A)**, and Houston County
simply does not want them completed.

Procedurally unusual: no personal cheques; appointments required to speak to a clerk or the judge
about a filing; and the forms page carries an explicit **WE CAN / WE CANNOT** list drawing the
line between legal information and legal advice, reinforced by the PDF's flat statement that
clerks "may NOT answer any questions or provide any assistance in completing the petitions".

### 4.2 San Francisco, California — Superior Court of California, County of San Francisco, Probate Court (Dept. 204)

**The first-paper probate fee in San Francisco is $450, not $435.** This is the most consequential
finding in the run and it is a trap that flat text extraction walks straight into:

- The Statewide Civil Fee Schedule effective 2026-01-01 shows item 124, "First-filed petition for
  letters of administration or letters testamentary", under GC 70650(a), at **`$ 435*`**.
- The asterisk is not decoration. Its footnote reads: *"Fees marked with an asterisk will vary in
  the counties of Riverside, San Bernardino, and San Francisco because of a local surcharge for
  courthouse construction."*
- The schedule's own appendix gives the San Francisco total for the "Unlimited civil cases
  (> $35,000), family, probate" column as **$450**.

Arithmetic, so it can be disagreed with a step at a time — every input is quoted in §3.2 or below:

```
  statewide uniform fee                                    $ 435
  less normal distribution to SCFCF                        - $ 35
  plus San Francisco courthouse construction surcharge     + $ 50
  ------------------------------------------------------------
  total first paper fee, San Francisco                     $ 450   <- printed in the appendix
```

The $450 is **published, not constructed** — the appendix prints it as "Total fee". The arithmetic
is corroboration that I read the right column, not the derivation of the number. Footnote 8
confirms the column covers probate: *"These uniform filing fees apply to both first paper filings
and response filings in limited, unlimited, family law and probate cases."* Footnote 12 confirms
the surcharge: *"In San Francisco the maximum surcharge allowed by statute is $50. $10 is applied
to limited civil cases and $50 to other first paper filings. (GC 70625.)"*

Note also that this fee is **published by the Judicial Council and republished on the court's Local
Fees page** — it is not a San Francisco local fee. The court's Local Fees page contains no
probate-specific fee of its own.

**Pre-review is by probate examiner, surfaced as tentative rulings.** Examiners review petitions
before hearing; the examiner's name appears on the tentative ruling, and the court publishes five
examiners with direct email addresses (Sean Bang, Aero Feth, Aeyoung Kim, Edward Miyauchi, Helen
Trowbridge). Tentative rulings are available online or by phone (415) 551-4000 **one to three days
before the hearing**; rulings on motions are generally available by 3 p.m. the court day prior.
The court also publishes **Local Rules Chapter 14, Probate — Appendix A, "CHECKLIST OF COMMON
PROBLEMS AND REASONS FOR DELAY"**, a 2-page enumeration of the defects that get a probate hearing
continued — defective proofs of mailing, accounts in poor form, failure to allege a plan of
distribution, and so on. For a rules-as-data pack this appendix is close to a machine-readable
list of the court's own rejection criteria.

**E-filing: read the scope carefully.** Mandatory e-filing began court-wide 2014-12-08 under CCP
§ 1010.6 and CRC 2.253(b)(2). It reached probate **only for Guardianship and Conservatorship
cases, effective 2024-07-01**. Self-represented parties are excluded by CRC 2.253; represented
parties may apply ex parte in Dept. 206 for relief on undue hardship or significant prejudice.
**Nothing on these pages says a decedent's-estate probate petition must be e-filed.** I emitted
`efiling.mandatoryFor: represented parties` because that is literally what the page establishes
about who the mandate binds, but the scalar field has nowhere to record that probate coverage
stops at guardianship and conservatorship — so I have also emitted the scope sentence as an
`obligations` block, and listed decedents'-estate e-filing status as not established in §5.2.
**Do not let the pack read this as "SF requires e-filing for estate petitions."**

Local probate forms carry a `PRB-` prefix with sub-series by matter type: `PRB-PES-` (estates),
`PRB-PCN-` (conservatorship), `PRB-PGN-` (guardianship). The two that touch decedents' estates are
PRB-PES-002 Order Appointing Probate Referee and PRB-PES-003 Request for Appointment of Probate
Referee, both revised 06/03/25.

Procedurally unusual: hearing dates are **assigned by the filing clerk at filing**, not requested;
non-appearance ex parte petitions are dropped with a courtesy copy at the probate clerk in Room
103; urgency requires a physical **blue cover sheet**; and "Pre-Granted Orders" can be collected
from Room 103 windows 23–25 after 9:30 a.m. on the hearing day.

### 4.3 New York City — Surrogate's Court

**"NYC Surrogate's Court" is not one court.** The URL supplied is an umbrella landing page for
**five separate county Surrogate's Courts** — Bronx (12th JD), Kings (2nd JD), New York (1st JD),
Queens (11th JD) and Richmond — each with its own Surrogate, clerk, procedures and part rules.
A jurisdiction pack cannot hold "NYC" as one jurisdiction; it needs five, and the pack's county
granularity is right while its label here would be wrong.

The landing page itself is **extremely thin**: two sentences of scope ("hears cases involving the
affairs of decedents, including the probate of wills and the administration of estates. It also
handles adoptions"), plus navigation. **It carries no fees, no e-filing rules, no forms list and no
pre-review procedure.** Almost everything below came from subpages.

**No probate filing fee could be established from any page I reached.** The FAQ says only "There
will be a filing fee based on the size of the estate." New York's fee is a variable schedule under
SCPA § 2402 keyed to estate value, which does not fit `firstPaperFeeUsd` as a scalar at all. The
official schedule PDF 403'd and I never obtained it. See §5.3 and §6.

**E-filing is stated permissively, and only for New York County**: NYSCEF is available for "all
proceedings ... except for Miscellaneous filings". The page says users *can* file electronically;
it does not say they must, and gives no commencement date. In tension with this, the citywide
forms page says the official PDF forms "cannot be submitted online or saved".

Procedurally unusual, New York County: citations in administration proceedings are **returnable in
person**, 10:00 a.m. Tuesdays and Fridays. There is a walk-in **Help Center** for self-represented
people (Room 302, no appointments). And the court publishes an unusual equity rule encouraging
speaking roles for junior and historically underrepresented attorneys: *"To create opportunities
for attorneys knowledgeable of the subject matter and the case and who historically have been
underrepresented in Surrogate's Court practice, courtroom participation of such attorneys is
strongly encouraged."* A "Petition to Search Apartment" — for accessing a decedent's sealed
residence — costs $26, no personal cheques.

---

## 5. Could not establish

Absence of a claim here means **the sources did not say**, not that the answer is "no".

### 5.1 Houston County, Georgia

- **`efiling.mandatoryFor`** — the page says the court "now accepts electronic filing", which is
  permissive language, and the PDF requires original documents by mail or in person. Neither
  states whether anyone is *required* to e-file. Emitting `none` would be an inference dressed as
  a quote. Strong indicator, not a finding.
- **`efiling.since`** — the launch is announced ("Houston County Probate Court Launches E-Filing")
  with no date anywhere on the page.
- **`examiner`** — no pre-review process of any kind is described. Nothing about who reviews a
  petition before hearing, or when.
- **`tentativeRulings`** — not mentioned. No tentative ruling practice described.
- **`localRulesEffective`** — Uniform Probate Court Rule 5.6(A) is cited but no local rules
  document and no effective date is published on these pages.
- **GPCSF codes for the fee-table petitions** — the numbers exist in a table column but never as
  contiguous text with the form name. Not quotable, therefore not claimed.
- **The full formal court name** — the General Information section begins "The Probate Court of
  Houst…" and I did not capture the remainder of that sentence cleanly. I claimed the letterhead
  form "HOUSTON COUNTY PROBATE COURT" instead, which I did verify.
- **The linked "Fee Schedule"** for all other estate filings — referenced on the estate page but
  not followed or fetched.

### 5.2 San Francisco, California

- **Whether e-filing is mandatory for decedents' estate petitions.** This is the important gap.
  The mandate is documented for civil, family law dissolution, and probate guardianship and
  conservatorship. Decedents' estates are named in none of the scope statements, and no page says
  they are included or excluded.
- **`localRulesEffective`** — I read Chapter 14 Appendix A but never fetched the Local Rules
  index, and the appendix PDF carries no effective date.
- **`localForm.whenRequired` for every PRB- form.** The local forms index publishes code, title
  and a revision date, and says nothing about when a form must be filed. This has a structural
  consequence — see §7.
- **Probate-specific e-filing exclusions.** The exclusion list on the e-filing page is a civil
  list. The only entry that is a Probate Code petition is Petition For Authority To Give Consent
  For Medical Treatment; the rest (small claims, unlawful detainer, civil harassment, name change,
  False Claims Act) are not probate and I did not import them as probate exclusions.
- **PRB-PCN-003, PRB-PCN-004, PRB-PCN-006, PRB-PGN-002 and the Probate Attorney Billing
  Template** — these exist on the index and I read them, but I emitted only a representative set
  of form claims rather than all eleven. Not a source gap; a completeness gap in this pass.
- **Whether the $450 appendix figure has changed since 2026-01-01.** The schedule is the current
  one by its own effective date, but I did not check for a later revision.

### 5.3 New York City Surrogate's Court

- **`firstPaperFeeUsd` — no probate filing fee whatsoever.** The FAQ states only that a fee exists
  and varies with estate size. **The official variable fee schedule
  (`nycourts.gov/legacypdfs/courts/1jd/surrogates/feeschedule_2.pdf`) returned 403 and was never
  retrieved.** A web search surfaced a bracket table ($45 under $10,000 rising to $1,250 at
  $500,000 and over) attributed to that schedule — **I did not fetch it, I am not asserting it,
  and it must not enter the pack as the court's published figure.** It is recorded here only so a
  later run knows what to go and verify.
- **`efiling.mandatoryFor`** — the New York County page says users "can file"; permissive. Search
  results claimed mandatory NYSCEF for New York County and a June 2026 mandate for Bronx, Kings,
  Queens and Richmond, but those came from third-party sites and an unfetched court rules page.
  Not established from anything I read on the court's own pages.
- **`efiling.since`** — no date. The heading is "New Efiling Protocol" with no commencement date.
- **E-filing status for Bronx, Kings, Queens and Richmond** — I did not open those four county
  pages at all. Four of the five NYC Surrogate's Courts are entirely unresearched.
- **`examiner` / `tentativeRulings`** — no pre-review mechanism described on any page I read. New
  York Surrogate's practice does not obviously have a California-style examiner, but the sources
  are silent rather than negative, and I am recording silence.
- **`localRulesEffective`** — Surrogate Gingold's Part Rules and Surrogate Mella's motion-filing
  process are linked from the New York County page. I did not follow either link.
- **`localForm.*`** — the forms page describes the forms collectively and links out; I did not
  reach a page listing individual form codes and titles.
- **Uniform Rules Part 207** (Uniform Rules for the Surrogate's Court) appeared in search results
  and was not fetched.

---

## 6. Conflicts between a court's own publications

Two cases where one court publishes two different numbers. Neither is resolved here, because
resolving them means picking one, and nothing I read authorises the pick.

**Houston County — $210 vs $130.** The estate page fee table gives $210 for Common Form Will
Probate. "Steps in Probating a Will" says: *"Return completed petition, Original Will, copy of
death certificate and a check or money order in the amount of $130.00 for the filing fee."* That
same PDF continues *"(There will be a remaining balance of court costs which must be paid before
letters of testamentary can be issued)"* and *"Total court costs will usually average $200.00 to
$250.00"*.

> **My hypothesis, clearly labelled as mine and not the court's:** the $130 may be an initial
> deposit against total costs that average $200–$250, in which case the two are not strictly
> contradictory. **The court does not say this.** I have not verified it, the PDF is undated, and
> it may simply be stale. A filer told "$130" on my inference and rejected at the window is
> exactly the failure this project exists to prevent. Someone should ring the court.

**San Francisco — $184,500 vs the statutory figure in our own rule pack.** The Wills and
Decedents' Estates page states: *"Decedent's personal property may be collected without probate
court administrative proceeding if the value of the estate is under $184,500 (if  decedent died on
or after April, 1, 2022) or $166,250 (if decedent died before April 1, 2022)."*

`src/rules/ca-probate.ts` carries **$208,850** for § 13100 for deaths on or after 2025-04-01,
researched against leginfo on 2026-07-27. The court's page is showing the pre-2025 figure and has
not been updated for the April 2025 adjustment.

This deserves attention beyond a footnote. `countycompile.ts`'s header argues that embeddings are
the wrong mechanism partly because *"every model still says $184,500 because that is what the
training data says"*. **The court's own live page still says $184,500 too.** The staleness is not
only in model weights — it is in the primary source. That is an argument *for* the compiled-county
design (`retrievedAt`, `effectiveFrom`, diffable) and *against* trusting a court page as
self-evidently current. It also means a compiled county can be faithfully verified against its
source and still be legally wrong, because verification proves the quote is real, not that the
court is right. I did not emit this figure as a claim.

---

## 7. Notes for the compiler layer

Five things this run surfaced about `countycompile.ts` itself.

1. **Partial `localForm.*` claims are silently dropped, and can cross-contaminate.** In
   `compileCounty`, form fields accumulate into `pending` and only flush when `code`, `title` and
   `whenRequired` are all present. Courts publish form indexes with code, title and revision date
   and *no* "when required" — that is exactly what San Francisco does for all eleven PRB- forms.
   The result: every one of those verified claims lands in `pending`, never flushes, and vanishes
   from the compiled profile without appearing in `rejected` either. Worse, because `pending` is
   never cleared on a non-flush, a later form's `code` overwrites an earlier one's while the
   earlier `title` is still sitting there — so a mismatched code/title pair could flush together
   if a stray `whenRequired` ever arrived. Suggest: flush on code+title with `whenRequired`
   optional, and report leftover `pending` as a named gap.
2. **`silentOn` does not cover `localForm.*`.** `COUNTY_FIELDS.filter(f => !f.startsWith("localForm."))`
   means a county with no form data at all reports nothing about forms.
3. **`firstPaperFeeUsd` as a scalar does not survive contact with two of these three courts.**
   Georgia publishes a per-petition-type table; New York publishes a bracket schedule keyed to
   estate value. Only California has a single first-paper number. The field needs to become a
   small structure, or the pack needs to record that the scalar is lossy.
4. **`efiling.mandatoryFor` has no scope slot.** San Francisco's mandate binds represented parties
   *for some case types only*. The field can say who but not for what, and the difference between
   those is a rejected filing.
5. **`court` conflates institution and division**, which is fine for California superior courts
   and wrong for a Georgia probate court (a court in its own right) and for NYC (five courts under
   one label).

---

## 8. Standing caveat

Every quote above was taken from text I actually retrieved, by the extraction method named in §2.
Where a court's page did not address something, it is in §5 rather than filled with what is typical
for that state. The two cross-publication conflicts in §6 are left open. Verification of these
quotes will prove the sentences are real; it will not prove the courts are current, and in at least
one case (San Francisco's $184,500) the source is demonstrably not.
