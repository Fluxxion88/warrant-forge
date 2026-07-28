# Execution plan — from now to 3:30 PM Tuesday

**Time available:** ~3 h today (to 5 PM) + ~5 h tomorrow (9:30 AM–3:30 PM, less lunch) ≈ **8 working hours.**
**Protected:** the final 90 minutes are rehearsal. Not negotiable. Teams lose this competition by over-building and under-rehearsing.

Ordering principle: **de-risk what could sink the demo → make the stubbed parts real → add capability → polish.** Never the other way round.

---

## Blocker to resolve first

**The Anthropic account hit its monthly spend limit during research.** Live extraction and the extraction council both need budget. Before committing to Phase 2 or 3, either raise the limit or decide to run the fallback (see T5b). Everything in Phase 0 and Phase 1 works without it.

---

## Phase 0 — De-risk · today, ~75 min

Things that, left undone, could end the demo regardless of how good the build is.

### T0.1 · Verify the two thresholds — **you** · 10 min · ⛔ blocking
Open the [DE-300 PDF](https://courts.ca.gov/sites/default/files/courts/default/2024-11/de300.pdf). Confirm item 2.b reads **$208,850** and item 2.c reads **$750,000** for deaths on or after 1 April 2025.

This is the highest risk-reduction per minute of anything on this list. My adversarial verification stage died on the spend limit, so both numbers are single-sourced. Stale figures ($184,500, $166,250) are everywhere online *including California's own self-help pages*, and Soren will know the real ones. If either is wrong, the arithmetic in the demo is wrong and the pitch collapses.

### T0.2 · Look at the UI — **you + me** · 20 min
The app is running but I have never seen it render. Walk all six panes, click a fact to check the source highlight lands on the right sentence, press *Ingest supplemental appraisal* and confirm the flip reads clearly. Report anything broken and I'll fix it.

### T0.3 · Fix the uncited § 13151 figures — **me** · 15 min
The timeline (45–120 days) and cost ($435–1,500) are estimates sitting next to fully-cited rules. In a project whose entire claim is provenance, an uncited number is the worst possible error. Either source them or mark them explicitly as estimates in the UI.

### T0.4 · Record the fallback — **you** · 20 min
Screen-capture a clean run end to end and keep it. Never let a live path be the only path to a working demo. This lesson is already written into the Concord handover; it applies here with more force because nothing has ever touched a live API.

---

## Phase 1 — Make Anvil real · today, ~60 min

The $1,000 Anvil prize is a **separate pool**. Highest return per minute on the board, and it needs to actually run once.

### T1.1 · Anvil account and templates — **you** · 30 min
Claim the hackathon free access. Upload **DE-310** and **DE-111**. Anvil auto-detects fields; note the field aliases it assigns and the template (cast) eid for each.

### T1.2 · Reconcile aliases and run one live fill — **me** · 30 min
Our bindings in `src/rules/ca-forms.ts` use guessed aliases (`decedentName`, `courtCounty`, `grossValue`). Map them to whatever Anvil actually assigns, register the template ids and API key, and run one real fill. Confirm a valid PDF lands on disk.

**Definition of done:** a filled DE-310 PDF you can open, with Margaret Hoyt's details in the right boxes.

---

## Phase 2 — Make extraction real · today/tomorrow AM, ~2 h · needs budget

Right now `INITIAL_CANDIDATES` is hand-written. "Is any of this real?" is the first question a judge asks, and Technical Execution is 25%.

### T2.1 · Wire live extraction — **me** · 90 min
One model call per document, prompted to emit facts each with a verbatim quote, returning the existing `FactCandidate[]` shape. Everything downstream — verification, quarantine, derivation, rules — already exists and is tested. This is genuinely a 90-minute job because the interface was designed for it.

### T2.2 · Run once, snapshot, demo the snapshot — **me** · 20 min
Run it live against the real data room, save the output as a recorded fixture, and demo from that.

This is not a compromise, it is the correct design. A live API call in a three-minute demo is a coin flip on someone else's wifi, and the honest framing is stronger anyway: *"this is a recorded run from a real extraction, and here is the fabrication it produced that our verifier caught."* A model hallucinating on its own is far more compelling than one we planted.

**T5b fallback if there is no budget:** keep the stub, but relabel it honestly in the UI as a recorded extraction rather than letting it imply a live call. Do not overstate this on stage.

---

## Phase 3 — The council · tomorrow AM, ~2.5 h · needs budget + 2 providers

Only start this once Phases 0–2 are done. It is Originality (15%), which is real but the smallest weight in play.

### T3.1 · Extraction council — **me** · 2 h
Two or three models propose facts **independently** (never sequentially — sequential anchors later agents on earlier ones). Union for recall. Deterministic verification kills fabrications for free. Debate only on interpretation.

### T3.2 · Conflict surfacing — **me** · 30 min
Where two verified quotes give different values for one key, that is a `Conflict` a human adjudicates — **never a vote**. This is the point worth making on stage: majority-voting the two appraisals would average to exactly $750,000, precisely on the threshold, the worst possible answer. Disagreement is signal.

**Requires two different providers.** With one, cross-model challenge is theatre and I would rather cut it than fake it.

---

## Phase 4 — Rule repairs · tomorrow midday, ~1 h · cut first if behind

In descending order of how badly each would hurt in Q&A:

1. **Formal-probate rule is too broad** — fires on residence value alone without checking for a surviving spouse. Correct for this fixture, wrong as a rule. 20 min.
2. **Missing § 13151 five-business-day notice** to heirs and devisees (AB 2016). 10 min.
3. **Spousal property petition** route (§ 13650 / DE-221, no dollar limit). 20 min.
4. **§ 13200** affidavit for real property of small value ($69,625, **six-month** wait, not 40 days). 15 min.
5. **Heggstad / § 850** petition — the actual remedy for an unfunded trust. 30 min.

Adding #5 would let you say the system knows the cheaper remedy exists, which is a strong Q&A answer. But it is the first thing to cut.

---

## Phase 5 — Demo craft · tomorrow 2:00–3:30 · **protected**

### T5.1 · Rehearse three times against a clock · 45 min
Three minutes is brutally short. [DEMO.md](DEMO.md) has the script with timings. The flip must land by 2:50 with time to breathe.

### T5.2 · Q&A drill · 20 min
The questions that will come, with prepared answers in DEMO.md: *what if the model lies about the quote · how does this scale to 3,000 counties · what does a re-run cost · is this legal advice · how much of this is real.*

Rehearse the honesty answers specifically. "The extractor is a recorded real run; the estate is synthetic; the thresholds and the engine are real and tested" is a **strength** if you say it before you are asked, and a wound if a judge digs it out of you.

### T5.3 · Setup check · 15 min
Laptop, charger, display adapter, app already running, fallback recording open in a second window, browser tabs closed.

---

## What we are deliberately not doing

- **Track 2 (phone).** Designed in PROPOSAL.md §6 as an adapter, not built. Talking about it costs nothing; building it costs the demo.
- **More counties.** One real county overlay proves the shape. Ten proves nothing extra and burns hours.
- **Touching the decision layer.** It is deterministic, tested, and the thing that makes this credible. No council, no model, no changes.
- **Chasing complete rule coverage.** It is a proof of architecture, not a claim of coverage. Say so.

---

## The cut ladder

If you are behind, drop in this order, without agonising:

1. Phase 4 items 5 → 4 → 3
2. Phase 3 entirely (the council)
3. Phase 2 live extraction, falling back to the honest stub

**Never cut:** T0.1 (thresholds), T0.4 (fallback recording), Phase 5 (rehearsal).

A rehearsed demo of a smaller system beats an unrehearsed demo of a larger one, every single time.
