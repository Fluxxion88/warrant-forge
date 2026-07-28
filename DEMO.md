# Warrant — three-minute demo

**Judging weights:** Real-World Impact 30 · Technical Execution 25 · Product Quality 20 ·
Originality 15 · Demo 10. This script front-loads impact and technical execution.

---

## 0:00 — The problem (20s)

> Margaret Hoyt died in January. Her daughter Claire is the executor. Claire has a job, and now
> she has to work out which of six California probate procedures applies to her mother's estate.
> Get it right and it takes three weeks. Get it wrong and it takes a year.
>
> The obvious move is to ask an LLM. The obvious move is wrong: it will hallucinate a threshold,
> and Claire will not know which sentence was invented.

---

## 0:20 — Extraction, and a fabrication caught (50s)

Ingest the data room: death certificate, will, appraisal, two bank statements, a life insurance
summary, and a recorded call with Claire.

> Every fact the model proposes has to arrive with the verbatim sentence that justifies it. A
> deterministic check — no second model — looks for that sentence in the documents we actually
> hold.

Point at the quarantined row.

> Eleven facts verified. **One rejected.** The model claimed a $50,000 Prudential policy. That
> sentence does not exist in any document in this data room. It never reaches the rules engine —
> and on a closer estate, that phantom $50,000 would have changed the answer.

This is the trust story. Let it land.

---

## 1:10 — Rules as data, not code (40s)

> The model does not decide anything, and it does not do arithmetic. It extracts quoted values.
> Deterministic code applies Probate Code § 13050 exclusions — the vehicle goes to the DMV, the
> life policy has a named beneficiary — and sums what is left.

Show the derivation: 18,400 + 121,000 + 9,200 = **$148,600**.

> The residence is appraised at $740,000, which is under the § 13151 primary-residence cap of
> $750,000. So Claire files one petition, form DE-310. Personal property is $148,600, under the
> § 13100 cap of $208,850, so that goes by affidavit. Three weeks, about $435.

Point at the citations.

> Every threshold on this screen is a real statute with a real effective date. These moved on
> 1 April 2025 under AB 2016. Most of the internet still shows the old numbers.

---

## 1:50 — The flip (60s) ← the moment

Drop in the supplemental appraisal.

> A second appraisal turns up. The first appraiser missed a permitted ADU. The residence is
> re-valued at **$760,000**.

Let the change report render.

> One fact moved by twenty thousand dollars. The system did not re-run everything — it knows
> which decisions read that fact. Two decision points re-evaluated. **Two flipped.** Vehicle
> transfer and filing fee were provably untouched, so they were not recomputed.
>
> The residence crosses the $750,000 cap, so the § 13151 petition is gone. And here is the part
> that gets people: § 13100 excludes property that is *in* a § 13151 petition. Once the
> residence falls out of that petition, it falls back into the § 13100 sum — $908,600, four
> times over the cap.
>
> Both cheap roads closed at once. Claire is now in formal probate: DE-111, DE-121, three
> newspaper publications, a probate referee, creditor claims. Three weeks became nine to
> eighteen months.

Beat.

> Twenty thousand dollars of appraisal moved a year of her life. No human caught that. The
> dependency graph did.

---

## 2:50 — Governance (20s)

> Filing formal probate is irreversible with a high blast radius, so it is gated — a named human
> signs, against the full trail. Transferring the car is reversible and low impact, so it is
> automatic. That is Soren's own test, encoded.
>
> And when we cannot conclude, we say what is missing and where to get it, rather than guessing.

---

## Q&A — likely questions

**"What if the model lies about the quote?"** It cannot help. The check is string matching
against the source, not a second model's opinion. Fabrication is caught with certainty, not
probability. `src/lib/verify.ts`.

**"How does this scale to 3,000 counties?"** Rules are data, not code — a predicate tree plus an
authority. A new county is a JSON entry, not a deploy. We ship the San Francisco $450 filing-fee
surcharge against the statewide $435 as a worked example of a real county overlay.

**"What does a re-run cost?"** The decision layer is free — it is pure functions. The only spend
is extracting the one new document. That is the point of tracking dependencies rather than
re-running the pipeline.

**"Is this legal advice?"** No. It is analysis support a human owns and signs. Verification
proves a quote exists; it does not prove the conclusion follows.

**"How much is real?"** The engine, the verification, the rule pack and the thresholds are real
and tested — 91 passing tests, and the demo itself is a test file. The estate is synthetic, and
the extractor is stubbed with what a model would propose; the shape is identical to a live call.

---

## Do not claim

- That it is trained or fine-tuned on legal data. It is not.
- That it covers all of California, let alone all counties.
- That verification proves correctness. It proves the quote is real.
