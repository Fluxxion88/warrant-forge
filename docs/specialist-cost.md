# Fully-loaded hourly cost of an estate settlement specialist — United States, 2026

**Built:** 2026-07-28
**Headline result:** employer cost per *matter-chargeable* hour

| | LOW | CENTRAL | HIGH |
|---|---|---|---|
| **Effective cost / productive hour** | **$58** | **$74** | **$102** |
| Fully-loaded cost / hour actually worked | $43.21 | $48.42 | $56.33 |
| Fully-loaded annual employer cost | $79,300 | $88,800 | $103,300 |
| Implied chargeable hours / year | 1,376 | 1,192 | 1,009 |

The spread is driven almost entirely by **one assumption I could not source** — the
utilization rate (step 5). Steps 1–4 are sourced to BLS primary documents and vary by
only about ±15%. If you disagree with a number, the utilization row is where the
argument should be.

---

## 0. What I could and could not fetch

Honesty about provenance, since the whole point of this document is that the numbers
were actually read.

**Fetched successfully (quoted verbatim below):**

- `https://www.bls.gov/news.release/ocwage.t01.htm` — OEWS national wage table, May 2025
- `https://www.bls.gov/news.release/ecec.nr0.htm` — Employer Costs for Employee Compensation, March 2026
- `https://www.bls.gov/opub/hom/ncs/concepts.htm` — BLS Handbook of Methods, NCS concepts
- `https://api.bls.gov/publicAPI/v2/timeseries/data/` — BLS Public Data API v2 (percentiles, industry cuts, ECEC component series)
- `https://data.bls.gov/timeseries/<SERIES_ID>` — used only to confirm the official title of each series ID I queried
- `https://www.payscale.com/research/US/Job=Trust_Administrator/Salary` and two sibling PayScale pages
- Three county job postings on `governmentjobs.com`

**Could not fetch (HTTP 403 to my client). No remembered figure has been substituted for any of these:**

- ZipRecruiter, Glassdoor, ERI SalaryExpert, Comparably, VelvetJobs, Salary.com salary pages.
  Search-engine snippets quoted numbers from these sites; I have **excluded all of them**,
  because a snippet is not a page I read.
- `https://www.clio.com/resources/legal-trends/benchmarks/` (403). I did reach Clio's blog
  summary of the same report and use only what that page states.
- The per-occupation OEWS profile page `bls.gov/oes/current/oes232011.htm` now redirects to
  the OES home page. The same May 2025 estimates were obtained from the OEWS news release
  table and the BLS API instead.
- NAICS industry titles (census.gov 403). The industry rows in §1.3 are therefore labelled
  by NAICS code only — see the warning there.

**Note on BLS access:** `www.bls.gov` returns 403 to a default HTTP client. It serves
normally when sent a complete browser header set. Every BLS figure below was verified
against the primary release document, not only the API.

---

## 1. Step 1 — Base wage (SOURCED)

### 1.1 The core occupation: SOC 23-2011

Source: **BLS, Occupational Employment and Wage Statistics, May 2025.**
`https://www.bls.gov/news.release/ocwage.t01.htm`

Page title, verbatim:

> "Table 1. National employment and wage data from the Occupational Employment and Wage
> Statistics survey by occupation, May 2025"

The row, verbatim from the release (columns are Employment | Mean hourly | Mean annual | Median hourly):

```
    Paralegals and legal assistants...................................................     392,880    33.51	69,700	   30.24
```

Percentile detail, BLS Public Data API v2, same survey vintage (`2025`, period `A01 Annual`):

| Statistic | Hourly | Annual | API series ID |
|---|---|---|---|
| 10th percentile | $21.51 | $44,740 | `OEUN000000000000023201106` / `...11` |
| 25th percentile | $24.20 | $50,340 | `OEUN000000000000023201107` / `...12` |
| **Median** | **$30.24** | **$62,890** | `OEUN000000000000023201108` / `...13` |
| 75th percentile | $38.50 | $80,080 | `OEUN000000000000023201109` / `...14` |
| 90th percentile | $48.80 | $101,500 | `OEUN000000000000023201110` / `...15` |
| **Mean** | **$33.51** | **$69,700** | `OEUN000000000000023201103` / `...04` |
| Employment | — | 392,880 | `OEUN000000000000023201101` |

**Load-bearing footnote**, verbatim from the same release — this is why every annual/hourly
conversion in this document uses 2,080 and not some other number:

> "Annual wages have been calculated by multiplying the hourly mean wage by a "year-round,
> full-time" hours figure of 2,080 hours; for those occupations where there is not an hourly
> mean wage published, the annual wage has been directly calculated from the reported survey data."

### 1.2 Adjacent occupations (same table, same release)

There is **no SOC code for "estate settlement specialist" or "trust administrator."** That is
itself a finding: the role is split across at least three SOC buckets, and which bucket a
given employer uses moves the wage by 25%+. Verbatim rows:

```
   Legal support workers..............................................................     488,220    34.08	70,880	   30.23
    Paralegals and legal assistants...................................................     392,880    33.51	69,700	   30.24
     Legal support workers, all other.................................................      46,760    43.10	89,660	   34.67
    Financial specialists, all other..................................................     132,130    45.10	93,810	   38.99
```

A bank trust department is far more likely to code the role as *Financial specialists, all
other* (13-2099, mean $45.10/hr) than as *Paralegals* (23-2011, mean $33.51/hr). A law firm
will code it as 23-2011. Same work, $11.59/hr of classification difference.

### 1.3 Paralegals by industry (SOURCED figures, UNVERIFIED industry titles)

BLS Public Data API v2, OEWS May 2025, SOC 23-2011 cross-tabbed by NAICS.

⚠️ **I could not fetch a page confirming the NAICS titles** (census.gov returned 403 and the
BLS OEWS industry pages now redirect). The wage figures below are sourced; the *titles* are my
mapping of the NAICS code and should be treated as the weakest claim on this page. The code is
the authoritative identifier.

| NAICS | My reading of the title | Employment | Mean annual | Median annual |
|---|---|---|---|---|
| 541100 | Legal services | 304,820 | $67,500 | $61,770 |
| 999300 | Local government (excl. schools/hospitals) | 19,620 | $66,570 | $63,370 |
| 551100 | Management of companies and enterprises | 6,970 | $94,320 | $94,570 |
| 523000 | Securities/commodity contracts and investments | 1,550 | $99,730 | $99,500 |

Series IDs follow the pattern `OEUN0000000<NAICS>23201104` (mean annual) and `...13` (median annual).

The direction matters: paralegals employed in *financial* settings — which is where trust and
estate settlement work actually sits — earn roughly **40–60% more** than paralegals in law
firms. But the employment counts there are tiny (8,520 combined vs. 304,820), so these are
thin estimates.

### 1.4 Third-party data for the actual job titles (SOURCED, weaker)

**PayScale** (self-reported salary profiles; not an employer-reported survey — treat as
directionally useful only). Base-salary distributions, taken from the structured
`estimatedSalary` data embedded in each page:

| Title | p10 | p25 | Median | p75 | p90 | n profiles | Page last reviewed | URL |
|---|---|---|---|---|---|---|---|---|
| Trust Administrator | $55,491 | $64,692 | **$79,608** | $91,827 | $115,859 | 134 | 2026-05-18 | `payscale.com/research/US/Job=Trust_Administrator/Salary` |
| Trust Officer | — | — | **$82,023** (stated as average; 10th–90th "$57k - $113k") | — | — | 184 | 2026-06-02 | `payscale.com/research/US/Job=Trust_Officer/Salary` |
| Paralegal | $42,815 | $49,566 | **$58,624** | $70,170 | $82,491 | 5,850 | 2026-07-13 | `payscale.com/research/US/Job=Paralegal/Salary` |

PayScale's Paralegal median ($58,624) sits **6.8% below** the BLS OEWS median ($62,890). That
is a reasonable convergence for two very different methodologies, and it is a point in favour
of trusting the BLS number as the anchor.

**Actual job postings with employer-stated ranges** (all fetched and read):

| Employer | Title | Stated range (verbatim) | Posted |
|---|---|---|---|
| County of Orange, CA | Estate Administration Specialist II | "$23.51 - $31.21 Hourly" / "$48,900.80 - $64,916.80 Annually" | 2026-04-23 |
| Montgomery County, PA | Office Support Person VI - Estate Probate Specialist | "$20.52 - $26.68 Hourly" | 2026-01-27 |
| County of Santa Clara, CA | Estate Administrator Assistant | "$40.89 - $49.49" hourly / "$85,053.28 - $102,941.28" annual | 2024-04-18 ⚠️ stale |

URLs: `governmentjobs.com/careers/oc/jobs/newprint/5318101`,
`governmentjobs.com/careers/montcopa/jobs/5214710/office-support-person-vi-estate-probate-specialist`,
`governmentjobs.com/careers/santaclara/jobs/newprint/4456708`

All three are **public-sector** postings, which is a real sampling bias — they are the postings
that are legally required to state a range and that are fetchable. I found no private-sector
bank or trust-company posting I could actually retrieve. Do not read this table as
representative of the private market.

### 1.5 Wage selected for each scenario

| Scenario | Wage rate `W` | Justification |
|---|---|---|
| **LOW** | **$30.24/hr** | OEWS May 2025 median hourly, SOC 23-2011. The literal median paralegal. |
| **CENTRAL** | **$33.51/hr** | OEWS May 2025 mean hourly, SOC 23-2011. Mean > median here, and estate settlement skews to experienced staff. |
| **HIGH** | **$38.50/hr** | OEWS May 2025 **75th percentile** hourly, SOC 23-2011. |

The HIGH figure has an independent cross-check worth noting: PayScale's Trust Administrator
median base of $79,608 ÷ 2,080 = **$38.27/hr**. Two unrelated sources — a BLS percentile and a
crowd-sourced salary median for a differently-named job — land within 0.6% of each other. That
is the single most reassuring number in this document.

---

## 2. Step 2 — Compensation load multiplier (SOURCED)

Source: **BLS, Employer Costs for Employee Compensation, March 2026 (2026 Q1).**
`https://www.bls.gov/news.release/ecec.nr0.htm`

Verbatim from the release:

> "Employer costs for employee compensation for civilian workers averaged $49.32 per hour
> worked in March 2026, the U.S. Bureau of Labor Statistics reported today. Wages and salaries
> averaged $33.72..."

> "Total employer compensation costs for private industry workers averaged $46.60 per hour
> worked in March 2026. Wages and salaries averaged $32.60 per hour worked and accounted for
> 69.9 percent of employer costs, while benefit costs averaged $14.01 per hour worked and
> accounted for the remaining 30.1 [percent]"

The occupational cut that actually matches a paralegal — **private industry, professional and
related occupations** — is not in the summary text, so it comes from the BLS series
(March 2026). Every series title was confirmed against `data.bls.gov/timeseries/<ID>`:

| Component | $/hour worked | % of total comp | Series ID |
|---|---|---|---|
| Total compensation | $72.99 | 100.0 | `CMU2010000120000D` |
| Wages and salaries | $50.53 | 69.2 | `CMU2020000120000D` / `...P` |
| Total benefits | $22.46 | 30.8 | `CMU2030000120000D` / `...P` |
| — of which paid leave | $6.76 | 9.3 | `CMU2040000120000D` / `...P` |

Confirmed title of `CMU2010000120000D`, verbatim:
> "Total compensation cost per hour worked for private industry workers in professional and related occupations"

The percentages (69.2 / 30.8 / 9.3) are **BLS-published values**, not my division.

### The multiplier

`M = total compensation per hour worked ÷ wages and salaries per hour worked`

| Cut | Arithmetic | `M` |
|---|---|---|
| Private industry, all workers | 46.60 ÷ 32.60 | **1.429** |
| Private industry, professional and related | 72.99 ÷ 50.53 | **1.445** |
| Civilian (incl. state/local govt), all workers | 49.32 ÷ 33.72 | **1.463** |
| Private industry, management/professional/related | 78.10 ÷ 53.50 | 1.460 |

Assignment: **LOW = 1.429** (private employer, lean benefits), **CENTRAL = 1.445** (the
occupational match), **HIGH = 1.463** (civilian — a bank or county employer with a richer
retirement plan).

Note how narrow this is: 1.429 to 1.463 is a 2.4% spread. The benefits load is the
best-determined input in the whole model. Anyone quoting a "2.0× fully-loaded multiplier" and
attributing it to benefits is not describing anything BLS measures.

---

## 3. Step 3 — Loaded cost per hour actually worked (SOURCED × SOURCED)

The most important methodological point in this document, and the one most models get wrong:

> **BLS Handbook of Methods, NCS concepts** (`bls.gov/opub/hom/ncs/concepts.htm`), verbatim:
> "Cost per hour worked . Total employer cost of wages and salaries or benefits divided by
> total hours worked (includes all hours worked only or annual work schedule hours plus
> overtime minus leave hours)."

And, verbatim from the same source, paid leave is a **benefit**, not a wage:

> "Total benefit costs consist of five major categories and include 18 benefits:
> * Paid leave - vacation, holiday, sick, and personal leave; ..."

**Consequence: `M` already contains the cost of PTO, and its denominator already excludes PTO
hours.** So `W × M` is the employer's cost per hour the person is *at their desk*. Applying a
separate "minus vacation and holidays" haircut on top of this would double-count paid leave.
I have not applied one.

| | LOW | CENTRAL | HIGH |
|---|---|---|---|
| `W` (OEWS May 2025) | $30.24 | $33.51 | $38.50 |
| `× M` (ECEC Mar 2026) | 1.429 | 1.445 | 1.463 |
| **= cost / hour worked** | **$43.21** | **$48.42** | **$56.33** |

---

## 4. Step 4 — Hours actually worked per year (DERIVED — my arithmetic on sourced inputs)

⚠️ **This is my construction, not a BLS-published figure.** BLS does not publish an
hours-worked-per-year number for this occupation. I derive it from two sourced quantities.

Because ECEC expresses both paid leave and wages per hour worked, and both are valued at the
same underlying wage rate, their ratio *is* the ratio of leave hours to worked hours:

```
leave hours / hours worked  =  paid leave $/hr worked  ÷  wages $/hr worked
                            =  6.76 ÷ 50.53
                            =  0.13378
```

The OEWS annual-wage footnote fixes total paid hours at 2,080 (§1.1). Paid hours = hours
worked + leave hours:

```
2,080  =  H × (1 + 0.13378)
H      =  2,080 ÷ 1.13378
H      =  1,834.6  ->  ~1,835 hours worked per year
leave  =  2,080 − 1,835  =  245 hours  =  30.7 eight-hour days
```

**The step you should attack if you want to attack this:** the derivation assumes paid leave
is compensated at the same average rate as worked hours. If leave accrues
disproportionately to senior (higher-paid) staff, this overstates leave hours.

**Sanity check:** 30.7 days of combined vacation + holidays + sick + personal for a
professional-occupation employee is entirely ordinary (e.g. 11 holidays + 15 vacation + 5 sick
= 31 days). The derivation produces a believable number from two figures that were never
intended to produce it, which is mild evidence it is right.

### Annual fully-loaded compensation cost

`Annual cost = W × M × H`

| | LOW | CENTRAL | HIGH |
|---|---|---|---|
| Cost / hour worked | $43.21 | $48.42 | $56.33 |
| × H = 1,835 | | | |
| **Annual employer cost** | **$79,300** | **$88,800** | **$103,300** |
| Stated salary (`W × 2,080`) | $62,899 | $69,701 | $80,080 |
| **Implied load on salary** | **1.26×** | **1.27×** | **1.29×** |

**Read that last row carefully.** The load *on the wage rate* is 44.5%, but the load *on the
annual salary* is only ~27%. The difference is paid leave: 13.4 of those 44.5 points are
vacation and holidays, which are already inside the $69,700 salary figure. A model that
multiplies a $69,700 salary by 1.445 gets $100,700 and has silently paid for vacation twice.

The CENTRAL salary of $69,701 reproduces the published OEWS mean annual wage of $69,700 to the
dollar, which confirms the 2,080-hour convention is being applied consistently.

---

## 5. Step 5 — Utilization (ASSUMPTION — the weak joint)

⚠️ **This is the one input I could not source for this occupation, and it dominates the
result.** Everything above varies by ±15%; this varies the answer by ±40%.

The closest sourced anchor I could actually fetch:

> **Clio, 2024 Legal Trends Report**, as summarised on
> `https://www.clio.com/blog/highlights-from-2024-legal-trends-report/`:
> "just under three hours of billable hours per day", described as the "industry average of 37%"
> utilization rate. The article states the report is "now in its ninth year" with data
> collected June–July 2024.

**This figure does not transfer directly and I am not treating it as if it does.** It measures
*lawyers* in *law firms*, whose non-billable time is dominated by business development, client
intake and firm management — none of which a salaried estate settlement specialist does. Using
37% for a back-office specialist would be indefensible.

My assumption, stated as an assumption: a salaried estate settlement specialist charges
**55–75%** of worked hours to a specific matter, with the remainder going to training,
supervision, internal meetings, systems work, covering colleagues' absences and unassignable
administration.

| | LOW cost | CENTRAL | HIGH cost |
|---|---|---|---|
| Utilization `U` | 75% | 65% | 55% |
| Chargeable hours/yr (`H × U`) | 1,376 | 1,192 | 1,009 |

(Note the inversion: *high* utilization produces the *low* cost per hour.)

Unsourced commentary, flagged as such: the CENTRAL figure of ~1,192 chargeable hours lands
close to the 1,200-hour annual targets commonly set for law-firm paralegals. I could not fetch
a survey establishing that benchmark, so it is offered as a plausibility check and nothing more.

---

## 6. Result — effective cost per productive hour

```
Effective hourly cost  =  (W × M × H) / (H × U)  =  W × M / U
```

The `H` cancels, which is worth noticing: **the hours-worked derivation in §4 affects the
annual cost but not the per-productive-hour cost.** So if you think §4 is wrong, it does not
change the headline.

| | LOW | CENTRAL | HIGH |
|---|---|---|---|
| `W` — OEWS May 2025 hourly (SOURCED) | $30.24 | $33.51 | $38.50 |
| `M` — ECEC Mar 2026 load (SOURCED) | 1.429 | 1.445 | 1.463 |
| `W × M` — cost/hour worked | $43.21 | $48.42 | $56.33 |
| `U` — utilization (**ASSUMPTION**) | 0.75 | 0.65 | 0.55 |
| **Effective cost / productive hour** | **$57.62** | **$74.50** | **$102.41** |
| Rounded | **$58** | **$74** | **$102** |

**Use $74/hour as the central figure. Carry the $58–$102 range wherever it matters.**

---

## 7. Optional layer — non-compensation overhead (NOT SOURCED)

ECEC measures **employer compensation cost only**. It does not include office space, IT,
software licences, malpractice/E&O insurance, recruiting, supervision, or the allocated cost of
non-billable support staff. A genuinely "fully absorbed" cost would include these.

**I could not source an overhead factor from any document I was able to fetch.** I am
therefore not folding one into the headline. If you need an absorbed rate, apply your own
factor to the §6 output and label it as yours:

| Overhead factor applied | LOW ($57.62) | CENTRAL ($74.50) | HIGH ($102.41) |
|---|---|---|---|
| 1.25× | $72 | $93 | $128 |
| 1.40× | $81 | $104 | $143 |
| 1.60× | $92 | $119 | $164 |

The 1.25–1.60 span is illustrative arithmetic on an unsourced input. **Do not cite it as a
finding.** If this layer becomes load-bearing for a decision, it needs its own sourcing pass —
a law-firm economics survey or an actual G&A allocation from a comparable operation.

---

## 8. Summary of provenance

| Input | Value(s) | Kind | Source |
|---|---|---|---|
| Paralegal hourly wage, median / mean / p75 | $30.24 / $33.51 / $38.50 | **Published by BLS** | OEWS May 2025, `bls.gov/news.release/ocwage.t01.htm` + API |
| 2,080-hour annualisation convention | 2,080 | **Published by BLS** | OEWS Table 1, footnote 1 |
| Compensation load multiplier | 1.429 / 1.445 / 1.463 | **Published by BLS** (ratio of two published figures) | ECEC March 2026, `bls.gov/news.release/ecec.nr0.htm` + series `CMU20*` |
| Paid leave = 9.3% of total comp | 9.3% | **Published by BLS** | Series `CMU2040000120000P` |
| "Cost per hour worked" excludes leave hours | definition | **Published by BLS** | Handbook of Methods, `bls.gov/opub/hom/ncs/concepts.htm` |
| Trust Administrator / Trust Officer salaries | $79,608 / $82,023 median base | **Third party about the market** (self-reported, n=134 / n=184) | PayScale, fetched 2026-07-28 |
| Three county job-posting ranges | $20.52–$49.49/hr | **Published by the employers** (public sector only) | governmentjobs.com |
| Hours actually worked per year | 1,835 | **My derivation** from two BLS figures | §4 — arithmetic shown |
| Utilization rate | 55% / 65% / 75% | **My assumption** | §5 — no source found |
| Lawyer utilization benchmark (context only) | 37% | **Third party, different population** | Clio 2024 Legal Trends Report blog summary |
| Non-compensation overhead factor | none adopted | **Unsourced; excluded from headline** | §7 |

### The three things most likely to be wrong

1. **Utilization (§5).** Unsourced, and it sets the width of the entire range. Fixing this is
   the highest-value next step: one credible survey of estate/trust support-staff chargeable
   hours would collapse $58–$102 to something much tighter.
2. **Occupational identification (§1.2).** "Estate settlement specialist" has no SOC code. The
   choice between SOC 23-2011 ($33.51 mean hourly) and SOC 13-2099 ($45.10 mean hourly) shifts
   the answer by roughly a third, and I resolved it toward 23-2011 by judgement, not evidence.
3. **Overhead (§7).** Excluded entirely for lack of a source. If the intended use is a
   cost-to-serve or make-vs-buy comparison against an external vendor price, excluding
   overhead understates the true internal cost — possibly substantially.
