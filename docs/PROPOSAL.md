# Warrant — technical proposal for Alix

*Agents of Administration hackathon · Track 1 (Rules as Data) with a Track 3 (Paperwork, Killed) integration · 27–28 July 2026*

---

## 0. One paragraph

Alix wants machines to do the administrative work that private banks currently throw twelve people at, and to do it 80% cheaper. The blocker is not capability — models can read a bank statement. The blocker is **trust**: an estate settlement decision that is wrong costs the family six months, and no specialist will hand work to a system that cannot show where its answer came from. Warrant is an estate-settlement decision engine built so that every conclusion is traceable to a sentence in a document, every rule is data with a citation, and the machine refuses to act when it cannot substantiate itself. It also fills the resulting court forms through Anvil, carrying that provenance onto the paper.

---

## 1. The problem, in Alix's own words

From the kickoff and the track briefings:

| Source | The problem stated |
|---|---|
| Hugh (kickoff) | "Instead of having a person do it, we have a machine do it… we can drop [cost] by 80%." The blocker is that estate rules differ "state by state, county by county… in places like California, it's different county by county." |
| Hugh | "Even the best constructed trust inevitably leaves things dangling." |
| Soren (Track 1) | "Assume it'll be wrong 10% of the time. How do you build around that?" |
| Soren | "Dear LLM, when you make a claim, you have to give me the verbatim quote… then I have a deterministic system actually go in, check the transcript… And if it's not, then I can't trust this claim." |
| Soren | "The two things I always think about is, how reversible is it? And what's the blast radius?" |
| Soren | "Tomorrow, if your system told me that I have to go through formal probate, you need to track me every decision that was made. You need to tell me where you got your legal information." |
| Soren | "How do you determine when this runs?" — on a $740k house becoming $760k and flipping the procedure. |
| Soren | "A fun problem is how do you know what you don't have? The transcript mentioned the car. But I don't know the value of the car. I don't know the license plate." |
| Soren | "Can't just have a python file for each [of 3,000 counties]." |
| Ian (Track 3) | "Messy scans in, valid filled forms out… do it at scale, thousands of forms, not five or six." |

Warrant answers each of these with a named component. The table in §3 maps them one to one.

---

## 2. Architecture

```
  documents            models                deterministic core                   output
  ─────────            ──────                ──────────────────                   ──────

  PDF / DOCX  ──┐
  XLSX / PPTX   │   ┌──────────────┐    ┌─────────────────────────────┐
  call transcripts──▶│  extraction  │───▶│  verify.ts                  │
  scans         │   │  (proposes   │    │  quote must exist in source │
                │   │   facts +    │    └──────────┬──────────────────┘
                │   │   quotes)    │               │ pass          │ fail
                │   └──────────────┘               ▼               ▼
  docs.rs ──────┘                          ┌───────────────┐  ┌──────────────┐
  (Rust ingestion)                         │  fact ledger  │  │ quarantine   │
                                           │  facts.ts     │  │ (visible,    │
                                           └───────┬───────┘  │  unusable)   │
                                                   │          └──────────────┘
                                                   ▼
                                        ┌──────────────────────┐
                                        │  derive.ts           │  exclusions, sums,
                                        │  ca-probate.ts       │  elapsed days
                                        └──────────┬───────────┘
                                                   ▼
                                        ┌──────────────────────┐
                                        │  rules.ts            │  three-valued
                                        │  (no model runs here)│  evaluation
                                        └──────────┬───────────┘
                                                   │
                        ┌──────────────────────────┼──────────────────────────┐
                        ▼                          ▼                          ▼
                ┌───────────────┐         ┌────────────────┐        ┌─────────────────┐
                │  gaps.ts      │         │  risk.ts       │        │  anvil.ts       │
                │  what's       │         │  approval gate │        │  fill the forms │
                │  missing      │         │                │        │  + provenance   │
                └───────────────┘         └────────────────┘        └─────────────────┘
                                                   │
                                                   ▼
                                        ┌──────────────────────┐
                                        │  reactor.ts          │  when a fact moves,
                                        │  change propagation  │  re-decide only what
                                        └──────────────────────┘  depended on it
```

Two rules govern the whole design:

1. **Models propose, code decides.** No LLM call sits in the decision path. Models turn prose into candidate facts; deterministic code does the arithmetic, applies the rules, and produces the answer.
2. **Nothing enters a decision without a warrant.** A fact needs either a verbatim quotation located in a source document, or a derivation naming the facts it came from.

---

## 3. Components

### 3.1 Fact ledger with warrants — `src/lib/facts.ts`

**What it does.** Holds every fact about the estate. Each carries a `Warrant`, which is one of two things: a `QuoteWarrant` (the verbatim sentence a model cited, plus the verdict from verification and the character span where it sits) or a `DerivedWarrant` (the formula and the input fact keys). Facts have `asOf` dates, supersession, and an `extractedBy` model id.

**Problem solved.** Soren's 10%-wrong assumption. A model may propose anything; `ledger()` only returns facts whose warrant verified, so a hallucinated fact is *structurally unable* to reach a decision. It stays visible in quarantine so a human can see what the model tried to assert.

**Implementation.** `admit(candidate, docs)` runs verification and returns a `Fact` with `status: "verified" | "quarantined"`. Only exact quotation counts — a `loose` match (right words, wrong document, or paraphrase) is deliberately *not* good enough, because "probably said something like this" is not evidence when being wrong costs six months. `integrity()` scores only model-proposed facts, so derived totals don't flatter the number.

**Status.** Built, 8 tests.

---

### 3.2 Deterministic quote verification — `src/lib/verify.ts`

**What it does.** Given a claimed quote and a document set, finds the quote or proves it absent. Normalised exact match first (tolerating whitespace and smart quotes), then n-gram coverage that degrades smoothly so paraphrase scores below verbatim. Returns a character span for click-through.

**Problem solved.** This is Soren's stated technique, implemented. Crucially it is **model-free** — we never ask a second model whether the first model was honest. Fabrication is caught with certainty rather than probability, which is the only version of this that survives a procurement conversation.

**Implementation.** `verifyCitation(citation, docs)` → `{verdict, similarity, span, matchedDocument}`. Verdicts: `verified` (exact, in the cited document), `loose` (found elsewhere or partial), `unsupported` (nowhere), `no_citation`.

**Status.** Inherited from Concord, unchanged, 17 tests. The single most reusable asset in the codebase.

---

### 3.3 Derivation engine — `src/lib/derive.ts`, `src/rules/ca-probate.ts`

**What it does.** Computes facts that are functions of other facts: gross estate value after statutory exclusions, days elapsed since death, eligibility booleans.

**Problem solved.** Soren: *"We're gonna add these numbers… you can't just [trust] it."* No model performs arithmetic in this system. Models extract individually-quoted values; code sums them under a cited rule. A total is therefore as auditable as the quotes beneath it — the derived fact records its formula and every input key.

**Implementation.** Exclusions are **data**: `CA_EXCLUSIONS` is a list of `{flag, label, citation, sourceUrl}` implementing Prob. Code § 13050 (joint tenancy, named beneficiary, funded trust, registered vehicle, passes to spouse). Asset facts follow the convention `asset.<id>.value` and `asset.<id>.<flag>`, so a new asset type needs no code change. `deriveCaFacts()` holds the California-specific interaction between § 13100 and § 13151.

**Status.** Built, 6 tests.

---

### 3.4 Rules as data — `src/lib/rules.ts`, `src/rules/ca-probate.ts`

**What it does.** A rule is a JSON-serialisable object: a jurisdiction, a predicate tree over fact keys, the conclusion and forms and obligations it produces, an `Authority` (citation, source URL, effective date, retrieval date), a priority, and its risk profile. `decide()` groups rules by decision point, evaluates each, and resolves competition by priority.

**Problem solved.** Soren's 3,000 counties. A new county is a data entry, not a Python file and not a deploy. Jurisdiction matching is `state` plus optional `county`, so a county rule overlays the statewide default automatically — we ship San Francisco's $450 probate filing fee against the statewide $435 as a real, verifiable example of exactly this.

It also answers *"tell me where you got your legal information"*: the citation and the date we read the source ride on the rule and surface in the UI next to the conclusion.

**Implementation.**

```ts
type Predicate =
  | { all: Predicate[] } | { any: Predicate[] } | { not: Predicate }
  | { fact: FactKey; op: "=="|"!="|"<"|"<="|">"|">="; value: FactValue }
  | { exists: FactKey } | { missing: FactKey };
```

Evaluation records every fact key consulted (`dependsOn`) and produces a step-by-step `trace` rendered in the Decisions pane.

**Status.** Built, 11 tests. California pack covers four decision points: residence route, personal-property route, vehicle transfer, filing fee.

---

### 3.5 Three-valued evaluation and gap detection — `src/lib/rules.ts`, `src/lib/gaps.ts`

**What it does.** A predicate over a fact we do not hold evaluates to `unknown`, never `false`. A rule whose condition is unknown reports itself **blocked** and names the fact keys it needed.

**Problem solved.** Soren's *"how do you know what you don't have?"* Gap detection is not a separate feature — it falls out of the same machinery that decides. The system can say "I cannot tell you which procedure applies, and the reason is that nobody has appraised the residence," which is a fundamentally different and more useful output than a confident wrong answer.

**Implementation.** Kleene logic in `and`/`or`/`not`. `findGaps()` collects `blockedBy` keys across decision points, marks them blocking or informational, and attaches an obtain-hint from the jurisdiction pack (`CA_OBTAIN_HINTS`) telling the executor where to actually get it — "probate referee appraisal", "certified death certificate from the county recorder".

**Status.** Built, tested.

---

### 3.6 Dependency-tracked re-evaluation — `src/lib/reactor.ts`

**What it does.** Diffs two ledgers, computes which decision points read a changed fact, re-runs only those, and emits a **Change Report**: the fact that moved, the quotation that moved it, the rules that consequently fired, the forms added and removed, the obligations gained, and the decision points that were provably untouched.

**Problem solved.** Soren's *"How do you determine when this runs?"* — and the $740k → $760k scenario specifically. Re-running everything on every new document is expensive and gives no account of *why* an answer moved. This gives both: the cost is bounded to the dependency closure, and the output is an artefact a family or a court can audit.

**Implementation.** `impacted(previousDecisions, changedKeys)` intersects each decision's recorded `dependsOn` with the changed set. A blocked decision is *not* automatically re-run — the evaluator records a key even when it was absent, so a missing fact is already in the dependency set and the intersection test alone is sound.

**Business value for Alix.** A settlement runs for 9–18 months and documents arrive throughout. Today a new document either triggers a full re-review (expensive) or nothing (dangerous). This makes incremental re-decision cheap enough to do on every arrival.

**Status.** Built, 5 tests including the full flip end to end.

---

### 3.7 Approval gate — `src/lib/risk.ts`

**What it does.** Classifies every rule on two axes — `reversibility` (`reversible` / `costly` / `irreversible`) and `blastRadius` (`low` / `medium` / `high`) — and computes whether the action may execute automatically or requires a named human signature.

**Problem solved.** Soren's exact framework: *"If I'm telling you that, oh, you should email your client? I don't care. I'm telling you, you need to file this formal probate form, and if you're wrong, it's another six months."* Transferring a car at the DMV is reversible and low impact, so it proceeds. Filing formal probate is irreversible and high impact, so it stops for a person.

This is also the answer to Alix's product stance that the service stays human-led. The gate is where the specialist's judgement is spent — on the decisions that matter, not on the ones a machine can safely take.

**Implementation.** `gateFor(decision, facts)` returns `auto | review | blocked` with plain-language reasons. It re-checks that no supporting fact is unverified as defence in depth; the ledger already guarantees this, so if that check ever fires something upstream is broken and refusing is the safe response.

**Status.** Built, 3 tests.

---

### 3.8 Form binding and Anvil — `src/lib/anvil.ts`, `src/rules/ca-forms.ts`, `src-tauri/src/anvil.rs`

**What it does.** Maps estate facts onto court-form fields, resolves each field from the verified ledger, and calls Anvil's fill API to produce the filled PDF. Every filled field retains the quotation behind it.

**Problem solved.** Ian's track, joined to Soren's. The rules engine already decided *which* forms are needed; this fills them. And because the binding reads only the verified ledger, **a fabricated fact cannot reach a filed document** — there is a test asserting exactly that. A field with no supporting fact is left empty and reported with the specific fact needed, rather than filled with a plausible guess. A wrong figure on a DE-310 is a rejected petition and another month gone, so refusing is correct behaviour.

**Implementation.**

```ts
interface FieldBinding {
  alias: string;        // Anvil field alias
  label: string;
  item?: string;        // item number on the printed form, e.g. "3f(1)"
  factKey?: FactKey;    // where the value comes from
  constant?: string;    // for boxes that never vary
  required: boolean;
  format?: "text" | "usd" | "date" | "yesno";
}
```

`buildFill(form, facts)` returns per-field status, the provenance record, and a `payload` object keyed by Anvil alias — exactly the `data` property Anvil expects.

The Rust command posts to `https://app.useanvil.com/api/v1/fill/{templateId}.pdf` with HTTP Basic auth where the API key is the username and the password is empty, and writes the response as binary (Anvil's docs call out string-handling as the corruption trap). The API key is stored in an owner-only `anvil.json` in the OS config directory and is **never returned to the frontend** — the same discipline as the model provider keys.

Forms currently bound: **DE-310** (Petition to Determine Succession to Primary Residence), **DE-111** (Petition for Probate), **DE-300** (Maximum Values — mandatory attachment), **REG 5** (DMV transfer without probate).

**Status.** Built, 7 tests. Requires an Anvil template id per form, registered at runtime once the PDF is uploaded to Anvil.

---

### 3.9 Multi-model provider layer — `src-tauri/src/providers.rs`, `src/lib/catalog.ts`

**What it does.** Talks to Anthropic, OpenAI, Google, DeepSeek, Moonshot and any OpenAI-compatible endpoint. Model ids, prices and capability profiles are **data** in `catalog.ts`, because vendors rename models constantly. Keys live in Rust and the frontend sees `has_key: bool` only.

**Problem solved.** Extraction quality varies by document type, and a single-vendor dependency is a procurement problem for an institutional buyer. Keeping model ids as data means a vendor rename is a config edit, not an incident.

**Status.** Inherited and audited against live vendor documentation on 2026-07-27. Verified real: `claude-opus-4-8`, `claude-sonnet-4-6`, `claude-haiku-4-5`, `gpt-5.6-sol|terra|luna`, `deepseek-v4-pro|flash`, `kimi-k2.6`. Catalog *pricing* for non-Anthropic providers is known stale and under-counts.

---

### 3.10 Operational hardening — `safety.ts`, `limiter.ts`, `budget.ts`

- **Injection fencing.** Estate documents come from third parties — banks, counterparties, the decedent's own files. `fenceDocument()` wraps them as untrusted content with forged delimiters neutralised before any model sees them, and agents are instructed to report influence attempts as findings rather than obey them.
- **Rate limiting and spend cap.** Per-provider concurrency gates, exponential backoff with jitter, immediate failure on a bad key, and a hard USD ceiling that aborts a run. This directly addresses Soren's *"you just spend $20 every time that this runs"*.
- **Context budgeting.** Token-aware document selection; documents that do not fit are named in the prompt rather than silently dropped.

**Status.** Inherited, 40 tests.

---

### 3.11 Document ingestion — `src-tauri/src/docs.rs`

**What it does.** Extracts text from PDF, XLSX/XLSM/XLS, DOCX, PPTX and plain text. Spreadsheets keep sheet and row structure; Word runs split mid-sentence are rejoined; malformed PDFs are contained; low-yield PDFs are flagged as probable scans rather than imported blank.

**Problem solved.** Ian's "messy scans in". The rejoining matters more than it sounds — a quote verifier fails against a document whose sentences were shredded by the extractor, so extraction quality is load-bearing for the trust guarantee.

**Status.** Inherited, 9 Rust tests including real committed PDF/XLSX/DOCX fixtures.

---

## 4. Where the hours actually come from

The judging criterion is real-world impact, so this is the arithmetic that matters. Per estate, against a specialist doing it by hand:

| Task | Today | With Warrant | Why |
|---|---|---|---|
| Determine the procedural route | 1–3 h research per estate, more for an unfamiliar county | Seconds | Rules are pre-encoded data; the county overlay resolves automatically |
| Compute gross value with statutory exclusions | 30–60 min, error-prone | Instant, and auditable | Exclusions are data; the sum records its inputs |
| Verify figures against source documents | 45–90 min | Instant | Every fact already carries its span |
| Re-check when a new document arrives | Full re-review, or skipped | Only the dependency closure | The reactor bounds the work |
| Fill the form set | 1–2 h, plus rejection cycles | Minutes | Anvil fill from verified facts |
| Chase what's missing | Discovered late, often at filing | Named up front, per field | Gap detection is free |

The compounding effect is the re-check row. An estate runs 9–18 months with documents arriving throughout; today each arrival either triggers expensive re-review or is quietly ignored until it surfaces as a problem at filing. Making re-decision cheap changes which errors are possible.

**The 80% claim.** Hugh's target is a cost reduction, not a headcount reduction — the specialist stays. What moves is the *ratio*: the specialist stops doing lookup, arithmetic and transcription, and spends their time on the gated decisions and the customer conversation. The approval gate is deliberately the place where that boundary is drawn in code.

---

## 5. How this scales to 3,000 counties

Three properties do the work:

1. **Rules are data with a jurisdiction key.** `{state}` matches statewide; `{state, county}` overlays. Adding San Mateo is a JSON entry.
2. **Fact keys are conventions, not schemas.** `asset.<id>.value` and `asset.<id>.<flag>` mean a new asset class needs no migration.
3. **Authority travels with the rule.** Every rule carries citation, source URL, effective date and the date we read it. Provenance decays; recording when we looked is how you know what needs re-checking. Thresholds move — California's changed on 1 April 2025 and most of the internet still shows the old figures.

What we ship is a proof of the shape, not a claim of coverage: one state, four decision points, one real county overlay. The honest framing is that the architecture scales; the content does not yet.

---

## 6. Extending to Track 2 (phone) — not built, but it drops in

Mitch's problem is specialists on hold with AT&T. The same architecture covers it with one new input adapter:

- A call transcript is **already a source document** — the fixture includes one, and two facts in the demo are extracted from it with verified quotes.
- An outbound call agent would emit `FactCandidate`s from what it hears, and those go through the identical verification path. "The bank said the balance is $18,400" becomes a fact with the transcript line as its warrant.
- The approval gate decides what the voice agent may do unsupervised: *ask for a balance* is reversible and low blast radius; *request account closure* is not.
- Gap detection generates the call list — the system already knows it lacks a VIN, so "call the DMV" is a derived task rather than a human noticing.

That is the argument that this is a platform rather than a demo: the phone track is an adapter, not a rewrite.

---

## 7. Implementation status — honest accounting

| Component | Status |
|---|---|
| Fact ledger, warrants, quarantine | **Built and tested** |
| Quote verification | **Built and tested** (inherited, unchanged) |
| Derivation, statutory exclusions | **Built and tested** |
| Rules engine, three-valued evaluation | **Built and tested** |
| California rule pack | **Built**, thresholds cited to primary sources, *not independently re-verified* |
| County registry — all 58 counties | **Built and tested.** Fees correct for every county from one exhaustive authority; local rules read for 3, the other 55 explicitly flagged unverified |
| Gap detection | **Built and tested** |
| Reactor / change reports | **Built and tested** |
| Approval gate | **Built and tested** |
| Form bindings, Anvil payload | **Built and tested** |
| Anvil HTTP call | **Built**, never executed against a live key |
| Document ingestion | **Built and tested** (inherited) |
| Provider layer | **Built** (inherited), never executed against a live key |
| **LLM extraction** | **Stubbed.** `INITIAL_CANDIDATES` stands in for what a model would propose. Shape is identical to a live call. |
| UI | **Built** — six panes, Alix-themed |
| Phone / Track 2 | **Not built.** Design above. |

98 frontend tests, 9 Rust tests. `src/rules/ca-probate.test.ts` is the demo expressed as a test.

---

## 8. Build order from here

1. **Verify the two thresholds** ($208,850 and $750,000) against the DE-300 PDF. Two minutes; highest risk-reduction per minute of anything on this list.
2. **Fix the four known probate errors** (see §9).
3. **Wire live extraction.** Replace `INITIAL_CANDIDATES` with a real model call that returns the same `FactCandidate[]` shape. The prompt must demand a verbatim quote per fact; everything downstream already exists. Estimated 1–2 hours.
4. **Register Anvil templates.** Upload DE-310 and DE-111 to Anvil, paste the template ids, run one live fill.
5. **Add the missing routes** — spousal property petition, § 13200, Heggstad § 850.

---

## 9. Known errors and limitations

**Errors we found in our own rule pack — now fixed:**

1. ~~The § 13151 timeline and cost are estimates without a citation.~~ **Fixed.** `Rule.estimates` now labels any figure that is a practice estimate rather than a sourced one, and the UI renders the distinction. An uncited number sitting silently beside cited ones was the worst possible error in a project whose claim is provenance.
2. ~~Missing the § 13151 five-business-day heir notice.~~ **Fixed** (AB 2016).
3. ~~Missing the spousal property petition and § 13200 routes.~~ **Fixed.** DE-221/DE-226 with no dollar limit, and § 13200 with its **six-month** wait — distinct from the 40 days governing §§ 13100 and 13151, which is the kind of detail that gets a filing rejected.
4. ~~Formal probate fires on residence value alone.~~ **Fixed.** It now requires that no spouse survives, because a spousal petition carries the property with no limit.

**Still outstanding:**

- The **Heggstad / § 850 petition** — the actual remedy for an unfunded trust — is still not modelled.
- 55 of 58 counties have not had their local rules read. They are flagged, not defaulted.

**Structural limitations:**

- **Verification proves a quote exists, not that the conclusion follows.** It eliminates fabricated evidence. It does not eliminate bad reasoning from real evidence.
- **The rule pack is one state and four decision points.** It is a proof of shape.
- **No live model call has been made** from this codebase or its parent.
- **This is not legal advice.** It is analysis support a human owns, reviews and signs — which is also Alix's own product stance.
