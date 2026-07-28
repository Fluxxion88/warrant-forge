# Warrant — working notes for Claude Code

Verified-fact decision engine for estate settlement. Built for the Alix "Agents of
Administration" hackathon, Track 1 (Rules as Data). Tauri 2 (Rust) + React/TS/Tailwind.

Forked from Concord (multi-model M&A diligence) at `X:\PROJECTS\concord`, which keeps its own
identity, database and demo — do not modify it from here. What was inherited is the engine:
deterministic citation verification, document ingestion, the provider layer, the rate limiter
and the audit trail. What is new is everything in the estate domain.

## The problem, in the mentor's own words

Soren, who leads the Rules as Data track, described the crux in his voice memo:

> "Dear LLM, when you make a claim, you have to give me the verbatim quote... And then I have a
> deterministic system actually go in, check the transcript, and say, I need that exact quote to
> be in there. And if it's not, then I can't trust this claim."

and

> "Tomorrow, if your system told me that I have to go through formal probate, you need to track
> me every decision that was made. You need to tell me where you got your legal information."

Warrant is that system. The name is the mechanism: in law and in epistemology a *warrant* is the
justification that makes a claim trustworthy, and here every fact carries one.

## Four invariants — do not weaken these

**1. No fact without a warrant.** A model may propose anything; it cannot get a fact into a
decision without a verbatim quote that `verify.ts` locates in a document we hold. Failed
warrants are quarantined — visible to a human, invisible to `ledger()`, and therefore
unreachable by the rules engine. `src/lib/facts.ts`.

**2. No model in the decision path.** Models extract facts. Rules decide. The evaluator in
`src/lib/rules.ts` is pure and deterministic. Never introduce an LLM call into rule evaluation,
and never ask a model whether a citation is real.

**3. No model arithmetic.** Models extract individually-quoted values; `src/lib/derive.ts` and
the jurisdiction pack add them up under a cited statutory rule. A total is a fact with a
derivation warrant recording its inputs.

**4. Three-valued logic.** A predicate over a fact we do not hold is `unknown`, never `false`.
A rule whose condition is unknown reports itself *blocked* and names what it needs. This is why
gap detection is free rather than a separate feature.

## Track 3 — forms

Four fillable government forms and five estate records were supplied by Alix. All four fill
from all five, end to end, producing real PDFs. `samples/` is gitignored: the records are
Alix's to distribute and this repo is public. Tests over them skip when it is absent.

Field mapping is **discovered, not hand-written**. These forms name their fields `f1_01`
through `f1_89`; hand-mapping 258 widgets is how a decedent's SSN lands in the executor's box.
`tools/geometry.py` reads the words printed around each widget straight off the page; the model
is shown that evidence and must return the verbatim label it relied on; `verifyMapping` locates
that label using the same matcher that verifies factual claims. An invented label cannot be
found, so the mapping is refused.

**Do not hand-edit anything in `src/forms/maps/`.** It is generated, and the next discovery run
overwrites it. Corrections go in `src/forms/adjudications.json`, which is re-applied and
re-verified by `tools/revalidate-maps.ts`.

```
tools/geometry.py          widget rectangles + surrounding printed words -> src/forms/geometry
tools/discover-maps.ts     model proposes mappings, verifier disposes  -> src/forms/maps
tools/revalidate-maps.ts   re-check committed maps, re-apply adjudications
tools/compare-maps.ts      agreement between two independent runs
tools/fill-forms.ts        rules decide applicability, then fill       -> out/fills
tools/fill-pdf.py          write the PDFs and read every field back    -> out/pdf
tools/anvil-cast.ts        generate Anvil Casts from geometry + maps   -> out/anvil
```

**Verification proves the evidence is real, not that the mapping is right.** A model can quote
a genuine printed label and still route it to the wrong path. Two such errors are in
`adjudications.json`, both found by rendering a filled PDF and reading it — one put the signer's
name in "Title, if applicable", the other answered "are the assets in the custody of the court?"
from a field meaning "does a court case exist". Neither was catchable by quote checking. **Read
the rendered form. Read-back proves the bytes are in the file, not that a human sees the right
thing.**

## Layout

```
src/lib/facts.ts       fact ledger; quote, derivation and record warrants
src/lib/verify.ts      model-free quote verification + character spans  (inherited, unchanged)
src/lib/rules.ts       rules-as-data types + deterministic three-valued evaluator
src/lib/derive.ts      generic derivation: exclusions, sums, elapsed days
src/lib/reactor.ts     change propagation — dependency-tracked re-evaluation
src/lib/risk.ts        approval gate on reversibility × blast radius
src/lib/gaps.ts        what we do not have, and which rule is waiting on it
src/lib/extract.ts     live extraction; block format, parser, recorder
src/lib/estate.ts      Alix estate-record importer -> facts with record warrants
src/lib/formmap.ts     mapping proposal, verification, adjudication
src/lib/fill.ts        field map + record -> filled boxes, gaps named
src/lib/anvilcast.ts   geometry + map -> Anvil Cast, with the coordinate flip
src/rules/ca-probate.ts   the California rule pack — thresholds, forms, citations
src/rules/form-applicability.ts  which forms apply; Form 56 line 1/2 ownership
src/panes/FormCompilerPane.tsx   the merge on screen: work order, compile state, Fill, review UI
src/fixtures/hoyt-estate.ts  synthetic estate + source documents for the demo
src/fixtures/recorded-extraction.json  a real model run, frozen for the demo
src-tauri/src/providers.rs   five-provider model access; keys never leave Rust  (inherited)
src-tauri/src/docs.rs        PDF/XLSX/DOCX/PPTX extraction  (inherited, tested)
src-tauri/src/forge.rs       runs the Forge CLI as a subprocess; nothing swallowed
src/lib/workorder.ts         the seam: FORM_RULES -> forge/artifacts/workorders/<id>.json
tools/emit-workorders.ts     writes one work order per estate
forge/                       Forge, the Python form compiler — its own CLAUDE.md and docs/,
                             invoked as a subprocess, never imported, never ported
```

## The California numbers are real

Every threshold in `src/rules/ca-probate.ts` was researched against leginfo.legislature.ca.gov
and courts.ca.gov on 2026-07-27 and carries its citation. For deaths on or after 1 April 2025:

| Procedure | Cap | Authority |
|---|---|---|
| § 13100 small estate affidavit | $208,850 | Prob. Code §§ 13100, 13101 |
| § 13151 primary-residence petition (DE-310) | $750,000 | AB 2016, Stats. 2024 ch. 331 |
| § 13200 real property of small value (DE-305) | $69,625 | Prob. Code § 13200 |
| Waiting period | 40 days | Prob. Code § 13100 |

Do not "tidy" these into round numbers. The next Judicial Council adjustment is 2028-04-01.

**The interaction that drives the demo:** § 13100 excludes "any property included in a petition
filed under Section 13151". So while the residence qualifies under § 13151 it stays out of the
§ 13100 sum. Cross $750,000 and it loses § 13151 eligibility *and* falls back into the § 13100
computation — closing both economical routes at once.

## The demo

`src/rules/ca-probate.test.ts` is the demo expressed as a test. If it goes red, the demo is
broken. It proves: the fabricated Prudential policy is quarantined; the estate routes to
DE-310 + a § 13100 affidavit at a $740,000 appraisal; a supplemental appraisal at $760,000
flips both decision points to formal probate; and `vehicle_transfer` and `filing_fee` are
provably not re-evaluated.

## Conventions

- **Secrets**: API keys live only in `providers.json` in the OS config dir. The frontend never
  receives a key — `ProviderPublic` exposes `has_key: bool` only.
- **Model IDs are data**, in `src/lib/catalog.ts`. Verified 2026-07-27: `claude-opus-4-8`,
  `claude-sonnet-4-6`, `claude-haiku-4-5`, `gpt-5.6-sol|terra|luna`, `deepseek-v4-pro|flash`,
  `kimi-k2.6` are real. Catalog *pricing* for non-Anthropic providers is known stale — it
  under-counts, which matters because it feeds the hard spend cap in `limiter.ts`.
- **Fact keys** follow `asset.<id>.value` and `asset.<id>.<flag>`, so a new asset type needs no
  code change. `estate.*` keys are derived.
- **Untrusted content**: estate documents come from third parties. Anything from a document goes
  through `fenceDocument` in `safety.ts` before reaching a prompt.

## Inherited trap (cost two debugging rounds in Concord)

The `Limiter` retries with real backoff. Tests must pass `{ sleep: async () => {} }` or they
take 5+ seconds each.

## Commands

```
npm test                           # 511 tests
npm run tauri dev                  # run the app
cd src-tauri && cargo test --lib   # 16 Rust tests (real PDF/XLSX/DOCX fixtures; Forge subprocess)
./forge/.venv/bin/pytest forge/tests -q   # 80 Python tests (Forge)
npx vite-node tools/fill-forms.ts && python tools/fill-pdf.py    # regenerate the filled PDFs
```

## State

Working: fact ledger with quote, derivation and record warrants; deterministic three-valued
rule evaluation; California rule pack with cited thresholds; dependency-tracked re-evaluation;
approval gating; gap detection; **live extraction, run and recorded**; the Alix record importer;
discovered-and-verified field maps for four government forms; applicability rules; real filled
PDFs; generated Anvil Casts. 511 TypeScript, 80 Python and 16 Rust tests.

Live extraction has run: nine documents, 41 facts proposed, 41 verified, zero quarantined, zero
malformed blocks, eight cents. Frozen in `src/fixtures/recorded-extraction.json` and guarded by
`recorded.test.ts`, so the demo replays a real run rather than gambling on venue wifi.

Not built yet: the UI is still Concord's M&A panes and has not been rewired to the estate
domain — **nobody has looked at the 15 panes since the rebrand**. The Anvil upload path is
written but has never run: no Anvil key has been provided, so `createCast` and the Etch
e-signature chain are unexercised. Rule packs outside California are absent, so an out-of-state
licence surrender is named as an obligation but has no form behind it.

## Honesty rules

- Verification proves a quote exists, not that the conclusion follows. Do not overstate it.
- The rule pack covers California and a handful of decision points. It is a proof that the
  architecture scales to 3,000 counties, not a claim that it already has.
- Output is analysis support that a human owns and signs. Nothing here is legal advice.
