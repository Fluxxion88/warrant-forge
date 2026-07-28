# Warrant — complete capability reference

*Estate settlement decision, investigation and filing engine · built for the Alix "Agents of Administration" hackathon · 27–28 July 2026*

**Status at time of writing:** 153 TypeScript tests, 11 Rust tests, clean build, twelve UI panes.
**Verified:** all three governing thresholds confirmed against Judicial Council form DE-300 [Rev. April 28, 2025].
**Not yet done:** no live model call, no live Anvil call.

---

## 0. What it is in one paragraph

Warrant turns a pile of estate documents into a defensible answer: which probate procedure applies, what it will cost and take, which forms must be filed and where they must go, what assets probably exist that nobody has found, and what must happen before a penny is distributed. Every fact it uses carries the verbatim sentence that justifies it, checked deterministically. Every rule carries its statute, its effective date, and the date we read it. No model runs in the decision path.

---

## 1. Capability index

| # | Capability | Module | Status |
|---|---|---|---|
| 1 | Document ingestion — PDF, DOCX, XLSX, PPTX, text | `src-tauri/src/docs.rs` | Built, 9 Rust tests |
| 2 | Deterministic quote verification | `src/lib/verify.ts` | Built, tested |
| 3 | Fact ledger with warrants and quarantine | `src/lib/facts.ts` | Built, tested |
| 4 | Derivation — statutory exclusions, sums, elapsed time | `src/lib/derive.ts` | Built, tested |
| 5 | Rules as data with three-valued evaluation | `src/lib/rules.ts` | Built, tested |
| 6 | Gap detection | `src/lib/gaps.ts` | Built, tested |
| 7 | Dependency-tracked re-evaluation | `src/lib/reactor.ts` | Built, tested |
| 8 | Reversibility × blast-radius approval gate | `src/lib/risk.ts` | Built, tested |
| 9 | Lead engine — assets nobody has found yet | `src/lib/leads.ts` | Built, tested |
| 10 | Administration task graph | `src/lib/tasks.ts` | Built, tested |
| 11 | Statutory deadline engine | `src/lib/tasks.ts` | Built, tested |
| 12 | Distribution gate | `src/lib/session.ts` | Built, tested |
| 13 | Universal document store | `src/lib/formstore.ts` | Built, tested |
| 14 | Dispatch planning | `src/lib/formstore.ts` | Built, tested |
| 15 | Form field binding with provenance | `src/lib/anvil.ts` | Built, tested |
| 16 | Anvil register / reconcile / fill / sign / retrieve | `src-tauri/src/anvil.rs` | Built, never run live |
| 17 | California rule pack | `src/rules/ca-probate.ts` | Built, thresholds single-sourced |
| 18 | All 58 California counties | `src/rules/ca-counties.ts` | Built, 3 researched |
| 19 | Multi-model provider layer | `src-tauri/src/providers.rs` | Inherited, audited, never run live |
| 20 | Injection fencing, rate limiting, spend cap | `safety.ts`, `limiter.ts`, `budget.ts` | Inherited, tested |
| 21 | LLM extraction | — | **Stubbed** |
| 22 | Voice / phone (Track 2) | — | **Designed, not built** |

---

## 2. Evidence layer

### 2.1 Document ingestion

Extracts text from PDF, XLSX/XLSM/XLS, DOCX, PPTX and plain text, in Rust.

- Spreadsheets retain sheet and row structure.
- Word runs split mid-sentence are rejoined — this is load-bearing, because a quote verifier fails against a document whose sentences the extractor shredded.
- Malformed PDFs are contained rather than crashing the run.
- Low-yield PDFs are flagged as probable scans rather than imported blank.

Tested against committed real Office and PDF fixtures, so a Windows checkout that mangles binaries fails loudly.

### 2.2 Deterministic quote verification

Given a claimed quotation and a document set, locates it or proves it absent.

- Normalised exact match first, tolerating whitespace and smart quotes.
- Then n-gram coverage, so paraphrase degrades smoothly below verbatim.
- Returns a character span for click-through to the source.

Four verdicts: `verified` (exact, in the cited document), `loose` (found elsewhere, or partial), `unsupported` (nowhere), `no_citation`.

**No model participates.** We never ask a second model whether the first was honest. Fabrication is caught with certainty rather than probability.

### 2.3 Fact ledger

Every fact carries a `Warrant`, which is one of two things:

- **`QuoteWarrant`** — the verbatim sentence a model cited, the verification verdict, the similarity score, and the character span.
- **`DerivedWarrant`** — the formula and the fact keys it consumed.

Facts also carry `asOf` dates, supersession, and the model that proposed them.

Only exact quotation earns `verified`. A `loose` match is deliberately **not** good enough — in a domain where being wrong costs six months, "probably said something like this" is not evidence.

`ledger()` returns verified facts only, so a quarantined fact is **structurally unreachable** by the rules engine. It stays visible so a reviewer can see exactly what the model tried to assert and on what basis.

`integrity()` scores only model-proposed facts, so derived totals cannot flatter the number.

---

## 3. Reasoning layer

### 3.1 Derivation

No model performs arithmetic anywhere in this system. Models extract individually-quoted values; code sums them under a cited rule.

- Statutory exclusions are **data**: joint tenancy, named beneficiary, funded trust, registered vehicle, passing to a surviving spouse.
- Asset facts follow `asset.<id>.value` and `asset.<id>.<flag>`, so a new asset class needs no code change and no migration.
- Elapsed-time facts recompute every run, so a waiting period expiring is itself a change the reactor notices.

### 3.2 Rules as data

A rule is a JSON-serialisable object:

```ts
{
  id, decisionPoint, jurisdiction: {state, county?},
  requires: FactKey[],
  when: Predicate,
  then: { conclusion, forms, obligations, timelineDays, estCostUsd },
  authority: { citation, sourceUrl, effectiveFrom, retrievedAt },
  estimates?: { timelineDays?: string, estCostUsd?: string },
  priority, blastRadius, reversibility
}
```

Predicate grammar: `all`, `any`, `not`, `{fact, op, value}`, `exists`, `missing`.

`estimates` labels any figure that is a practice estimate rather than a sourced one. An uncited number sitting silently beside cited ones is the failure this project exists to prevent, so the distinction is mandatory rather than optional.

### 3.3 Three-valued evaluation

A predicate over a fact we do not hold evaluates to **`unknown`**, never `false`. Kleene logic in `and`/`or`/`not`.

A rule whose condition is unknown does not quietly fail to fire — it reports itself **blocked** and names the fact keys it needed. Gap detection therefore falls out of the same machinery that decides, rather than being a separate feature.

Evaluation records every fact key consulted (`dependsOn`) and produces a step-by-step trace rendered in the UI.

### 3.4 Decision resolution

Rules are grouped by decision point. Within a point, fired rules resolve on priority; losers are retained as `alsoFired` so the choice stays auditable. Blocked and not-applicable rules are reported separately.

### 3.5 Dependency-tracked re-evaluation

Diffs two ledgers, intersects changed fact keys with each decision's recorded `dependsOn`, re-runs **only** the affected decision points, and carries the rest forward unchanged.

Emits a Change Report: the fact that moved, the quotation that moved it, the rules that consequently fired, forms added and removed, obligations gained, and the decision points that were **provably** untouched.

A blocked decision is not automatically re-run — the evaluator records a key even when absent, so a missing fact is already in the dependency set and the intersection test alone is sound.

### 3.6 Approval gate

Every rule carries two axes:

- **Reversibility** — `reversible` / `costly` / `irreversible`
- **Blast radius** — `low` / `medium` / `high`

`auto` requires reversible **and** not-high. Anything else requires a named human signature. A decision resting on an unverified fact returns `blocked` — defence in depth, since the ledger already prevents it.

---

## 4. Investigation layer

### 4.1 The lead engine

A fact ledger records what documents say. An investigation reasons about what they **imply**. A wire to Geneva is not an asset; it is evidence that an account exists which no document in our possession describes.

**17 lead patterns**, each with rationale, priority, and the specific requests that would confirm or kill it:

| Group | Patterns |
|---|---|
| Tax-derived | Schedule B foreign account, Form 8938, Form 3520/3520-A, Form 5471, Form 8865, Form 8621, Form 1116, foreign pension income |
| Banking | International wire, safe-deposit box, currency exchange |
| Life and documents | Foreign passport/address/residency, business interests and K-1s, cryptocurrency, named professionals, employers, unclaimed property |

Each action records: who it goes to, the channel, **which authority documents it requires** (certified Letters, death certificate, Form 56, apostille, certified translation, court order), the form where one exists, and what a response may reveal.

Detection reuses the rules engine's predicate evaluator, so patterns that do not fire are reported **dormant** rather than discarded — with the fact key that would trigger them. That list is the executor's defence if a beneficiary later argues something should have been found.

### 4.2 Administration task graph

Six phases with real dependencies:

1. **Establish authority** — petition and Letters, EIN, estate account, Form 56
2. **Secure** — redirect mail for a full annual cycle, secure property and insurance, preserve devices without accessing them, stop recurring charges
3. **Investigate** — IRS transcripts, institution-wide bank searches, public records, master ledger
4. **Report** — final personal return, estate return above $600 gross income, international review
5. **Creditors** — notice to known and reasonably ascertainable creditors, claim period
6. **Close** — inventory, reserves, final distribution and discharge

Dependencies are enforced: no bank will speak to you before Letters issue, so bank searches are blocked until the petition completes. Tasks carry cautions where they matter — do not wipe devices, do not commingle funds, do not file delinquent foreign forms before counsel reviews whether prior omissions were innocent, negligent or wilful.

### 4.3 Statutory deadlines

Computed from ledger dates, never from the clock — `asOfIso` is a parameter, so runs are reproducible.

| Deadline | Period | Authority |
|---|---|---|
| Lodge the will | 30 days from death | Prob. Code § 8200 |
| Inventory and Appraisal | 4 months from Letters | Prob. Code § 8800 |
| Creditor claims | later of 4 months from Letters **or** 60 days from notice | Prob. Code § 9100 |
| First publication | ≥ 15 days before hearing | Prob. Code § 8121 |
| Mailed notice | ≥ 15 days before hearing | Prob. Code § 8110 |
| Federal estate tax | 9 months from death | IRC § 6075(a) |
| FBAR | annual, where foreign aggregate exceeded $10,000 | 31 CFR 1010.350 |

Periods running from the later of two anchors compute both and report which governed. **A deadline whose anchor is missing reports `unknown`, never "today"** — a missed statutory deadline is exactly the irreversible harm this system exists to prevent.

### 4.4 Distribution gate

Distribution is the one irreversible act in an estate. Held by any of:

- An open **critical** lead — assets may exist that no document describes
- An unclosed creditor claim period
- Facts still required by a pending decision

---

## 5. Filing layer

### 5.1 Universal document store

The identifier printed on a PDF is **not unique**. DE-111 means something only within the California Judicial Council; PRO 010 exists only in Los Angeles; almost every brokerage prints its own Affidavit of Domicile.

A record is keyed on **issuer + jurisdiction + revision**, and carries:

- **Parties** — preparer, signer, notary, witness, recipient, each optionally bound to a fact key
- **Signature placement** — type, page number, and rect in PDF points
- **Delivery** — accepted channels, named recipient, operator notes
- **Flags** — requires notary, requires wet original
- **Provenance** — source URL and retrieval date
- Field bindings, and the Anvil cast eid once registered

Five issuer kinds: Judicial Council, county court, state agency, federal agency, financial institution.

`resolveForm` **returns ambiguity rather than guessing**. Asking for "Affidavit of Domicile" without naming the institution yields both issuers and a reason. Asking for PRO 010 in San Mateo yields nothing and explains why. A wrong confident answer here is a returned filing and another round trip for a grieving family.

### 5.2 Dispatch planning

A filled PDF on a disk has settled nothing. `planDispatch` chooses a channel from those the recipient accepts, preferring cheapest and fastest — but **two things override preference**:

- A form requiring a wet original or notarisation cannot go electronically regardless of what the recipient accepts.
- An institution requiring a telephone call first must be called first. Chase's first step for a decedent account is a call, not paperwork; posting before that call usually gets it returned.

Unsigned forms with a defined signature block are `blocked`.

### 5.3 Field binding

```ts
{ alias, label, item?, factKey?, constant?, template?, required, format? }
```

`item` is the number on the printed form, so a reviewer holding the paper can check the mapping. Formats: text, USD, date, yes/no.

`buildFill` reads **only the verified ledger**. A quarantined fact cannot reach a filed document — there is a test asserting the fabricated policy never appears in a payload. A field with no supporting fact is left empty and reported with the specific fact needed and where to obtain it.

### 5.4 Anvil integration

Five operations, all with the API key held in Rust and never returned to the frontend.

| Operation | Mechanism |
|---|---|
| **Register** | `createCast` with `aliasIds` set to our own binding aliases, so Anvil's detection maps straight onto them. Auto-publishes, since an unpublished cast cannot be filled. |
| **Reconcile** | `cast` query → `fieldInfo` → compare both directions. |
| **Fill** | `POST /api/v1/fill/{castEid}.pdf`, response written as binary. |
| **Sign** | `createEtchPacket` with a castEid reference and the **same field-keyed payload as fill**, embedded signer, `generateEtchSignURL`. |
| **Retrieve** | Document-group zip download. |

**Why reconciliation exists:** the fill endpoint fails silently. A value written to an alias the template does not have is dropped, and you get back a PDF that looks fine with an empty box in the middle of it. On a probate petition that is a rejected filing and another month gone. Reconciliation makes drift visible *before* anyone files.

GraphQL uses the same Basic auth as REST, and application errors are inspected on the response body because GraphQL reports them with HTTP 200.

---

## 6. Jurisdiction layer

### 6.1 California statewide

Thresholds for deaths on or after 1 April 2025, each cited:

| Procedure | Cap | Authority |
|---|---|---|
| § 13100 small estate affidavit | $208,850 | Prob. Code §§ 13100, 13101 |
| § 13151 primary residence petition (DE-310) | $750,000 | AB 2016, Stats. 2024 ch. 331 |
| § 13200 real property of small value (DE-305) | $69,625 | Prob. Code § 13200 |
| Waiting period (§§ 13100, 13151) | 40 days | Prob. Code § 13100 |
| Waiting period (§ 13200) | 6 months | Prob. Code § 13200 |

Routes modelled: § 13100 affidavit, § 13151 primary-residence petition, § 13200 affidavit, spousal property petition (no dollar limit), formal probate, DMV vehicle transfer.

**The interaction that matters:** § 13100 excludes "any property included in a petition filed under Section 13151". While the residence qualifies under § 13151 it stays out of the § 13100 sum; cross $750,000 and it loses eligibility **and** falls back into the computation, closing both economical routes at once.

### 6.2 All 58 counties

Two kinds of county knowledge, deliberately distinguished:

- **Filing fees are known for every county from one authority.** The Judicial Council schedule states asterisked fees vary "only in the counties of Riverside, San Bernardino, and San Francisco" — an exhaustive negative statement. Riverside and San Francisco charge $450; the other 56 charge $435.
- **Local rules are not.** Los Angeles, San Francisco and San Mateo were read against their published text. The other 55 generate a rule that **says they are unverified** rather than implying no local requirements exist.

Researched counties carry local forms (PRO 010, PR-5, PR-13), e-filing exclusions, examiner and tentative-ruling practice, and **stale-data warnings** — including that `lacourt.ca.gov` still serves the superseded 2022 chapter 4 while the operative version lives on a different host.

Switching county re-decides the estate with **no fact re-extracted**, because everything is a pure function of the facts.

---

## 7. Infrastructure

- **Multi-model provider layer** — Anthropic, OpenAI, Google, DeepSeek, Moonshot, any OpenAI-compatible endpoint. Model IDs and prices are data in `catalog.ts`. Keys live in Rust; the frontend sees `has_key: bool` only. Audited against live vendor docs on 2026-07-27.
- **Injection fencing** — third-party documents are fenced as untrusted with forged delimiters neutralised before any model sees them.
- **Rate limiting and hard spend cap** — per-provider concurrency, exponential backoff with jitter, immediate failure on a bad key, USD ceiling that aborts a run.
- **Context budgeting** — token-aware document selection; documents that do not fit are named in the prompt rather than silently dropped.

---

## 8. Interface

Twelve panes: Estate, Data room, Fact ledger, Investigation, Decisions, Forms, Document store, Anvil, Administration, Jurisdiction, Change log.

Light, quiet, serif-headed, built on the Alix palette sampled from their own deck. The whole demo runs with **no network call**, so it cannot fail on venue wifi.

---

## 9. Honest limitations

- **No live model call has ever been made** from this codebase or its parent. Extraction is stubbed with hand-written candidates in the identical `FactCandidate[]` shape.
- **No live Anvil call has ever been made.** The `createCast` file encoding and the exact etch input types are the least certain parts.
- ~~The governing thresholds are single-sourced.~~ **Resolved.** All three confirmed against form DE-300 [Rev. April 28, 2025]: § 13100 at **$208,850**, § 13151 at **$750,000**, § 13200 at **$69,625**, all for deaths on or after 1 April 2025, next adjustment 1 April 2028. The prior figures the form shows in its left column — $184,500 and $61,500 — are the ones still circulating widely online.
- **55 of 58 counties have unread local rules.** Flagged, not defaulted.
- **Heggstad / § 850 is not modelled** — the actual remedy for an unfunded trust.
- **Liabilities are not in the ledger.** Assets only; creditor work exists as tasks.
- **No foreign jurisdiction rule pack.** Ancillary probate and resealing appear as lead actions, not rules.
- **No entity resolution.** Whether two references describe the same account is unanswered.
- **The investigation log is derived, not persisted** — recomputed per run rather than append-only with timestamps.
- **Track 2 is designed, not built.**
- **Verification proves a quote exists, not that the conclusion follows.** It eliminates fabricated evidence, not bad reasoning from real evidence.
- **This is not legal advice.** It is analysis support a human owns, reviews and signs — which is Alix's own product stance.
