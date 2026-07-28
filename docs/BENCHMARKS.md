# Warrant — benchmarks

Generated 2026-07-28 15:12. Every figure below carries its provenance.
Rows marked **ASSUMED** are stand-ins, not findings; a derived figure
computed from one is marked the same way, because arithmetic does not
turn a guess into a measurement.

## Onboarding an unseen government form

_When the system is handed a fillable government form it has never seen, how much of it can it map with evidence, how much does it refuse, and what does the mapping still get wrong after passing every check?_

| Metric | Value | Provenance |
|---|---|---|
| Forms onboarded | 4 | measured — count of files in src/forms/geometry that also have a committed map in src/forms/maps |
| Pages | 6 | measured — sum of geometry[].pages across the committed geometry files |
| Widget annotations | 258 | measured — sum of geometry[].widgets.length across the committed geometry files |
| Distinct fillable fields | 234 | measured — size of the set of distinct geometry[].widgets[].name values |
| Mappings verified (annotations) | 171 | measured — re-executed admitMappings() + adjudicate() from src/lib/formmap over every committed map entry against its geometry; counts entries whose cited label locateQuote() found in the printed text around that widget |
| Mappings verified (distinct fields) | 156 | measured — distinct field names among the re-verified entries |
| Widgets deliberately left unmapped | 85 | measured — sum of map.unmapped.length across the committed maps |
| Proposals refused by the verifier | 2 | measured — sum of map.rejected.length across the committed maps |
| Widgets in no bucket at all | 0 | measured — widget names present in geometry but absent from map.entries, map.unmapped and map.rejected — computed as a set difference per form |
| Committed entries failing today's checks | 0 | measured — every committed map entry re-run through admitMappings() + adjudicate() during this process; counts entries whose verdict is neither 'verified' nor 'unmapped' |
| Coverage, per annotation | 66.28 % | derived — 100 * verified.annotations / widgets.annotations |
| Coverage, per distinct field | 66.67 % | derived — 100 * verified.fields / widgets.fields |
| Widgets with a recorded disposition | 100 % | derived — 100 * (verified.annotations + unmapped + refused) / widgets.annotations |
| Refusal rate among target-claiming proposals | 1.16 % | derived — 100 * refused / (refused + verified.annotations) |
| ca-dl142 — distinct fields (1pp) | 28 | measured — distinct widget names in src/forms/geometry/ca-dl142.json |
| ca-dl142 — fields mapped and re-verified | 17 | measured — distinct fields surviving a fresh admitMappings() run over src/forms/maps/ca-dl142.json |
| ca-dl142 — coverage | 60.71 % | derived — 100 * form.ca-dl142.mapped / form.ca-dl142.fields |
| irs-56 — distinct fields (2pp) | 72 | measured — distinct widget names in src/forms/geometry/irs-56.json |
| irs-56 — fields mapped and re-verified | 53 | measured — distinct fields surviving a fresh admitMappings() run over src/forms/maps/irs-56.json |
| irs-56 — coverage | 73.61 % | derived — 100 * form.irs-56.mapped / form.irs-56.fields |
| irs-8821 — distinct fields (1pp) | 45 | measured — distinct widget names in src/forms/geometry/irs-8821.json |
| irs-8821 — fields mapped and re-verified | 15 | measured — distinct fields surviving a fresh admitMappings() run over src/forms/maps/irs-8821.json |
| irs-8821 — coverage | 33.33 % | derived — 100 * form.irs-8821.mapped / form.irs-8821.fields |
| irs-ss4 — distinct fields (2pp) | 89 | measured — distinct widget names in src/forms/geometry/irs-ss4.json |
| irs-ss4 — fields mapped and re-verified | 71 | measured — distinct fields surviving a fresh admitMappings() run over src/forms/maps/irs-ss4.json |
| irs-ss4 — coverage | 79.78 % | derived — 100 * form.irs-ss4.mapped / form.irs-ss4.fields |
| Human corrections on record | 3 | measured — entries in src/forms/adjudications.json |
| Corrections that still verify against the page | 3 | measured — adjudicate() re-checked each correction's cited label against the current geometry during this run; 0 were refused |
| Verified mappings that were wrong anyway | 3 | measured — adjudications whose wasTarget differs from target, and whose corrected target is the one now present in the committed map — counted by re-reading both files this run |
| Known-wrong share of verified mappings | 1.92 % | derived — 100 * verifiedButWrong / verified.fields |
| Forms with an independent second run to compare | 4 of 4 | measured — forms in src/forms/maps-crosscheck that parse and have a counterpart in src/forms/maps |
| Fields comparable across two runs | 94 | measured — distinct fields mapped by both the committed run and the crosscheck run for the same form |
| Fields where both runs chose the same target | 87 | measured — exact string equality of the target path between the two runs for the same field, after un-applying human adjudications from the committed side so that each run is represented by its own proposal (wasTarget) rather than by a correction |
| Target agreement across two runs | 92.55 % | derived — 100 * crosscheck.agreed / crosscheck.compared |
| Model calls a re-run would issue (reconstructed, not observed) | 11 | measured — per-page widget counts from the committed geometry, chunked at CHUNK=26 parsed out of tools/discover-maps.ts, summed as ceil(widgetsOnPage / CHUNK). What was counted is real geometry and the tool's real constant; the run itself was not executed, so this is arithmetic about a future run, not an observation of a past one |
| Span between first and last map timestamp | 9.23 min | measured — max(discoveredAt) - min(discoveredAt) over the 4 committed maps whose timestamp parses |
| End-to-end onboarding wall clock | **not recorded** | ASSUMED — no committed artefact contains a duration; discover-maps.ts prints per-chunk latency to stdout and persists none of it, and no run log was kept |
| API cost to onboard all four forms | **not recorded** | ASSUMED — discover-maps.ts totals input and output tokens and prints a dollar figure at the end of a run, using a hardcoded price; neither the tokens nor the total is written to disk |
| Human time to map the same 234 fields | **not measured** | ASSUMED — nobody has been timed hand-mapping these forms, and no published figure for the task has been read; without it, no speedup can be stated at all |

- **Forms onboarded** — Three IRS forms and one California DMV form. The IRS three share one field-naming convention and one geometry extractor, so they are not four independent trials.
- **Pages** — Printed pages, not pages of fields: 1 declared page carries no fillable widget at all (irs-ss4 p2), so this is not the size of the mapping job. The widget counts below are that.
- **Widget annotations** — This is the number usually quoted for this corpus. It counts annotations drawn on the page, so a field drawn twice counts twice.
- **Distinct fillable fields** — 24 annotations are second copies of a field drawn twice on the same page, confined to ca-dl142 — a two-part form that prints the same block again lower down. One AcroForm name, so filling the field fills both copies. This is the honest denominator for 'fields mapped'.
- **Mappings verified (annotations)** — Verified means the quoted label is genuinely printed next to that widget. It does not mean the widget was routed to the right record path. Note also that this counts map entries, not distinct verifier decisions: a field drawn twice gets two entries which resolve to the same widget, so 15 of these are re-checks of a widget already checked. The distinct-field row below is the number of widgets actually verified.
- **Widgets deliberately left unmapped** — Each carries a written reason — 'For IRS Use Only', no corresponding record path, a box a human must decide. The reasons were written by the same model that did the mapping and are not independently checked. A field wrongly declared sourceless leaves a blank box that nothing here flags.
- **Proposals refused by the verifier** — Read out of the committed rejection records: irs-8821 f1_10[0] — unsupported_label, cited "Name and address"; irs-8821 f1_15[0] — unsupported_label, cited "Name and address". A refusal means the model cited a label that the verifier could not find printed near that widget, so the mapping never reached a form. This is only what the most recent discovery run refused — maps are rewritten in place, so earlier refusals are gone.
- **Widgets in no bucket at all** — The integrity check on everything above. A non-zero value would mean a widget vanished between extraction and mapping without being mapped, excused or refused.
- **Committed entries failing today's checks** — Zero means the committed maps still pass the verifier as it stands today. It does not establish that the checks were weaker when the maps were written: this module cannot see the verifier's history, so read it as a freshness check on the artefacts, not as evidence that anything tightened.
- **Coverage, per distinct field** — 0.39 points from the per-annotation figure, so the DL-142 double-count does not move the headline. That is a result of the check, not a reason to have skipped it — the two denominators differ by 24 widgets and nothing guaranteed the answer would land this close.
- **Widgets with a recorded disposition** — Not a quality figure, and not on its own a proof of coverage: it is a ratio of record counts, so a map that dropped one widget and carried a spare entry for another would still read 100%. The set-difference check above — 'Widgets in no bucket at all' — is what establishes that nothing was silently dropped. What this row adds is that the counts reconcile as well as the sets, which is the weakest useful property of the pipeline and the easiest to lose.
- **Refusal rate among target-claiming proposals** — Denominator excludes the deliberately unmapped widgets, which claimed no target and so could not be refused. A low refusal rate is not a quality signal on its own: it means the model rarely invented a label, not that it rarely chose the wrong field.
- **Corrections that still verify against the page** — A human is a better judge of which field a box is than a model, and no better at remembering what is printed on page two. Corrections are verified like anything else.
- **Verified mappings that were wrong anyway** — What is recomputed is that a human changed the target and the change is live. That the original mapping had *passed* verification is not recomputable here — revalidate-maps.ts rewrote the map with the corrections applied, so the original verdict is gone — and rests on the adjudication records, each of which states the wrong mapping reached a generated form and so must have been admitted. One put the fiduciary's name in 'Title, if applicable'; two wired line 2c, 'are the assets in the control or custody of the court?', to a field meaning 'does a court case exist', which ticked Yes on every generated form because every sample estate has a proceeding. All three cited a label that is genuinely printed there, so no amount of quote checking would have caught any of them.
- **Known-wrong share of verified mappings** — A floor, not a rate. It counts errors somebody happened to find by rendering a PDF and reading it. The other 153 verified mappings have not been audited that way, so the true error rate is unknown and is not bounded above by this number.
- **Forms with an independent second run to compare** — The repository's own note says agreement between independent runs is the only confidence signal available short of a human reading the form. It is available for 4 of 4 forms, so for the rest that signal does not exist.
- **Fields comparable across two runs** — Only fields both runs chose to map. A field one run mapped and the other declined is not counted as a disagreement, which flatters the agreement figure below.
- **Fields where both runs chose the same target** — 3 of the 94 comparable fields carry a human override in the committed map. Read straight off that file they would score as agreements, because revalidate-maps.ts writes the corrected target back into it — and those are the fields the two runs actually disagreed about, so the naive figure is 95.74% against the 92.55% reported here.
- **Target agreement across two runs** — Agreement is not correctness: two runs can be wrong together, and nothing here detects that. Nor is disagreement error — a disagreement says a human should look, not which run is right. Computed over 94 fields on 4 forms, too narrow to characterise the pipeline. Note that tools/compare-maps.ts reads the committed maps directly and so does not un-apply adjudications; its percentage and this one will differ by exactly the overridden fields noted above.
- **Model calls a re-run would issue (reconstructed, not observed)** — Reconstructed from the tool's chunking rule and the real geometry, not read from a run log — no run log was committed. An actual run that hit the output cap and was retried would issue more. This is the size of the job, not a measurement of one.
- **Span between first and last map timestamp** — A property of 4 timestamps, not a timed run. discover-maps.ts writes each map as it finishes and loops over all forms in one process, so this is most likely the elapsed time for the last 3 forms — it excludes the first form entirely and would silently include any idle time if the runs were in fact separate invocations. Do not quote it as an onboarding duration.
- **End-to-end onboarding wall clock** — Deliberately left as a placeholder rather than estimated. The timestamp span above is the closest thing the repository actually holds, and it is not this.
- **Human time to map the same 234 fields** — This is the denominator every 'N times faster' claim needs. It is absent, so this benchmark makes no such claim.

**What this does not establish**

- Coverage is not correctness. verifyMapping proves the quoted label is printed next to that widget and nothing more. 3 of the 156 verified mappings were wrong and were caught only by a human rendering a PDF and reading it.
- The known-wrong count is a floor with no ceiling. No independent audit of the remaining 153 verified mappings exists, so nothing here bounds the error rate from above, and three errors is far too few to estimate one from.
- Nothing here is a speed measurement. No committed artefact records wall clock, token counts or cost; the timestamp span is a property of 4 strings in 4 files, and the model-call count is reconstructed arithmetic about a run nobody executed.
- No baseline of any kind. There is no measured or sourced figure for how long a human takes to map these fields, so no saving, multiple or ROI can be computed from this benchmark.
- 4 forms is not a sample. Three are IRS forms sharing one field-naming convention and one extractor; the fourth is a California DMV form. Per-form results vary from 33.33% to 79.78% coverage — a spread of 46.44 points across four forms — and nothing here supports projecting a rate onto an unseen form, let alone onto fifty states and three thousand counties.
- The widget geometry is taken on trust. Counts come from JSON produced by tools/geometry.py against PDFs in samples/, which is gitignored, so this module cannot re-derive a widget count from the source PDFs. A widget the extractor missed is invisible to every figure above, including the 0 'unaddressed' check.
- The unmapped bucket is unverified by construction. Its reasons are prose written by the same model that produced the mappings; a field wrongly declared to have no record source yields a blank box on every generated form and no check here reports it.
- The refusal count is what one run refused, not what the approach refuses. Maps are regenerated in place, so earlier runs' refusals are overwritten and no history survives. An independent second run exists for 4 of 4 forms, so the cross-run agreement figure, where present, generalises no further than that.
- Says nothing about acceptance. A filled form that maps every field correctly may still be rejected by the IRS or the DMV for reasons no part of this pipeline models.

## Calibration — does agreement mean correctness?

_Two independent models mapped the same government forms from the same evidence. Where they agree, is the answer right?_

| Metric | Value | Provenance |
|---|---|---|
| Primary run | claude-opus-5 | measured — discoveredBy across src/forms/maps |
| Verified mappings, primary run | 171 | measured — entries summed across src/forms/maps/*.json |
| Human corrections rewound before comparing | 3 | measured — adjudications with a wasTarget, restored to the original proposal |
| Second, independent run | claude-sonnet-5 | measured — discoveredBy across src/forms/maps-crosscheck |
| Fields mapped by both runs | 94 | measured — intersection of the two runs, keyed by widget name |
| …on which they agree | 87 | measured — identical target path |
| Agreement rate | 92.60 % | derived — agree / both |
| …on which they disagree | 7 | measured — differing target path for the same widget |
| Mappings independently confirmed wrong | 3 | measured — adjudications carrying a wasTarget, in src/forms/adjudications.json |
| …where BOTH runs gave the same wrong answer | 0 | measured — second run's target equals the primary run's superseded target |
| …where the runs disagreed, and the disagreement flagged it | 3 | measured — second run's target differs from the primary run's superseded target |
| Confirmed error rate GIVEN they disagreed | 42.86 % (lower bound) | derived — disagreedAndWrong / disagree |

- **Human corrections rewound before comparing** — Without this the primary run already carries the corrections — which came from reading the form, and on these fields coincide with the second run — so agreement would be measured after copying the answer.
- **…on which they disagree** — Each one is a field a human should look at: irs-56/f2_15[0], irs-56/c1_2[0], irs-56/c1_2[1], irs-ss4/f1_32[0]
- **Mappings independently confirmed wrong** — Found by inspecting disagreements and by rendering filled PDFs and reading them. Not an exhaustive audit.
- **Confirmed error rate GIVEN they disagreed** — Disagreement is a useful trigger for review — it is where we found one of the errors — but it is a filter, not a proof.

**What this does not establish**

- Ground truth is partial. Three mappings are known wrong because somebody looked; nobody has checked all of them. Every error rate here is a lower bound.
- Two runs is not a sample. These are proportions over a handful of known errors, not an estimate with a confidence interval.
- Both runs used the same prompt, the same geometric evidence and the same model family. Genuinely uncorrelated checks would need a different kind of checker, not a second opinion from a sibling.
- Agreement is measured on the target path only. Two runs can agree on the path and differ on the tick condition, which this does not count.

## Extraction and rejection

_On a recorded real model run, how many proposed facts earn a warrant — and, more importantly, what does verification actually reject when something is wrong?_

| Metric | Value | Provenance |
|---|---|---|
| Model that produced the recording | gpt-5.6-terra | measured — RECORDED.model from src/fixtures/recorded-extraction.json |
| Source documents extracted from | 9 | measured — RECORDED.documents.length |
| Characters of source text | 4,959 chars | measured — sum of HOYT_DOCS[].content.length |
| Recorded document names still match the fixture | yes | measured — sorted RECORDED.documents compared to sorted HOYT_DOCS names |
| Fact candidates the model proposed | 41 | measured — RECORDED_CANDIDATES.length |
| Malformed blocks in the model's output | 0 | measured — RECORDED.errorCount, recorded by extract.ts at run time |
| Input tokens | 12,471 tok | measured — RECORDED.inputTokens, reported by the provider during the run |
| Output tokens | 3,651 tok | measured — RECORDED.outputTokens, reported by the provider during the run |
| Catalog input price, gpt-5.6-terra | **3 USD/Mtok** | ASSUMED — Read at run time from CATALOG in src/lib/catalog.ts, whose own header states non-Anthropic prices are unconfirmed and set at or above the nearest known tier |
| Catalog output price, gpt-5.6-terra | **12 USD/Mtok** | ASSUMED — Read at run time from CATALOG in src/lib/catalog.ts; same caveat as the input price |
| Cost of the recorded run | **0.08 USD** | derived from an assumption — (input/1e6)*price.input + (output/1e6)*price.output |
| Candidates that earned a warrant | 41 | measured — admitAll(RECORDED_CANDIDATES, HOYT_DOCS) at module load — the same verify.ts path a live run uses |
| Candidates quarantined | 0 | measured — admitAll(RECORDED_CANDIDATES, HOYT_DOCS) at module load — the same verify.ts path a live run uses |
| Ledger integrity on the recorded run | 100 % | measured — integrity() over the replayed facts — verified / proposed |
| Distinct fact keys admitted | 30 | measured — ledger() size after replay — verified facts only, latest per key |
| Verified citations per distinct key | 1.37 | derived — live.verified / live.distinct_keys |
| Documents that yielded at least one verified fact | 9 | measured — distinct matchedDocument across verified quote warrants after replay |
| Accept threshold (n-gram coverage) | 0.85 | measured — VERIFIED_THRESHOLD parsed out of src/lib/verify.ts with node:fs at module load |
| Hand-written fixture candidates | 25 | measured — integrity(admitAll(INITIAL_CANDIDATES, HOYT_DOCS)).proposed |
| Fixture candidates quarantined | 1 | measured — integrity(admitAll(INITIAL_CANDIDATES, HOYT_DOCS)).quarantined |
| Ledger integrity on the fixture | 96 % | measured — integrity() over the fixture facts |
| Verdict on the fabricated Prudential citation | unsupported | measured — verdict on the asset.prudential_policy.value warrant after admitAll over INITIAL_CANDIDATES |
| Best match for the fabricated quote, anywhere in the data room | 0 | measured — similarity on the fabricated fact's quote warrant |
| Fabricated fact reaches the decision-visible ledger | no | measured — ledger(admitAll(INITIAL_CANDIDATES, HOYT_DOCS)).has("asset.prudential_policy.value") |
| Dollars the fabrication would have added to the estate | 50,000 USD | measured — value of the asset.prudential_policy.value candidate in src/fixtures/hoyt-estate.ts |
| Control: residence appraisal, first number altered | pass — quarantined | measured — re-admitted the recorded asset.residence.value candidate with the first digit run rewritten, then read the resulting status |
| Control: residence appraisal, middle token altered | pass — quarantined | measured — re-admitted the recorded asset.residence.value candidate with the token nearest the middle replaced by a word absent from every document |
| Wholesale rewrite caught | 41 | measured — every verified recorded quote rewritten (all digits shifted, head of every 4+ letter word replaced) and re-admitted; count of those that flipped to quarantined |
| Single middle-token substitution caught | 39 | measured — every verified recorded quote re-admitted with the token nearest its middle replaced by "Blackwood"; count that flipped to quarantined |
| Single number substitution caught | 24 | measured — every verified recorded quote containing digits re-admitted with its first digit run rewritten; count that flipped to quarantined |
| Verified quotes that contain a number at all | 24 | measured — count of verified recorded quotes matching /\d+/, the only ones this mutation can be applied to |
| Number-substitution detection rate | 100 % | derived — sweep.number_swap_caught / sweep.number_swap_applicable |
| Wrong value attached to a genuine quote — caught | 0 | measured — every verified recorded candidate re-admitted with its quote untouched and only its asserted value changed; count that flipped to quarantined |
| Keys found by both the model and the fixture author | 23 | measured — intersection of ledger() key sets from the two replays |
| Keys the fixture has that the model did not produce | 1 | measured — fixture ledger keys absent from the live ledger |
| Keys the model found that the fixture does not have | 7 | measured — live ledger keys absent from the fixture ledger |
| Shared keys where the two runs disagree on the value | 0 | measured — case-insensitive string comparison of values on the shared keys |

- **Model that produced the recording** — One model, one run, recorded 2026-07-28. Nothing here is a comparison between models.
- **Source documents extracted from** — Synthetic fixture documents authored in this repo — clean machine-set prose, no OCR, no scans, no handwriting.
- **Characters of source text** — A small data room. Real estates arrive with hundreds of pages, and nothing here says how the pipeline scales to them.
- **Recorded document names still match the fixture** — A name-set comparison, and that is all it is: the recording stores document names and no content hash, so a document whose text was edited after the recording would still pass this row. What partially covers that gap is the quarantine count below — every recorded quote still being locatable is evidence the text has not moved under it.
- **Malformed blocks in the model's output** — Counts blocks the parser could not read. A block the model never emitted is not an error here — omissions are invisible to this number.
- **Cost of the recorded run** — Assumption-tainted: the token counts are real, the prices are not sourced. Treat the order of magnitude, not the figure.
- **Candidates quarantined** — Zero here is a statement about this model on these documents, not about the verifier. See the corruption sweeps below for what the verifier does when there is something to reject.
- **Ledger integrity on the recorded run** — Read the definition, not the number. `integrity()` is the share of proposed facts whose quotation was located — it is not an accuracy, a correctness or a recall figure, and 100% here means the model quoted faithfully, not that it read the sentences right or found everything there was to find. The value-tamper row below is what this percentage cannot see.
- **Verified citations per distinct key** — Above 1 because 9 keys carry more than one verified citation (9 of them citing more than one document). Independent documents agreeing is corroboration, but ledger() keeps only the last citation per key, so the surplus is discarded rather than cross-checked — nothing here has checked that the corroborating citations agree on the value.
- **Accept threshold (n-gram coverage)** — Not a tuned parameter — no calibration set exists. The corruption sweeps below are what this number costs.
- **Fixture candidates quarantined** — Quarantined keys: asset.prudential_policy.value.
- **Ledger integrity on the fixture** — Lower than the live run by exactly the one planted fabrication. A perfect score here would mean the fixture had stopped testing anything.
- **Best match for the fabricated quote, anywhere in the data room** — Zero, not merely under the threshold: the 19-token sentence shares no n-gram window with any of the 9 documents. An invented citation is caught with room to spare. An altered one is not, which is the finding two rows down — and the easy case is the one this benchmark is least entitled to be pleased about.
- **Fabricated fact reaches the decision-visible ledger** — This is the invariant that matters. Quarantine is only meaningful if the rules engine cannot read the quarantined fact, and ledger() is the only view the engine gets.
- **Dollars the fabrication would have added to the estate** — The amount the fixture author planted, not a figure with any real-world meaning. It is here to show the size of what quarantine kept out of the § 13100 sum.
- **Control: residence appraisal, first number altered** — Coverage fell from 1 to 0.875 against a 0.85 threshold, so the altered figure was still accepted; verdict "unsupported". Corrupted quote as re-admitted: "opinion of market value as of the effective date is $295,000." (11 tokens under the verifier's own tokenisation). One rewritten figure at the end of a short quote leaves most of its n-gram windows intact. This is the load-bearing number in the whole demo — it decides § 13151 against formal probate — and quote verification does not protect it.
- **Control: residence appraisal, middle token altered** — Coverage fell from 1 to 0.5; verdict "unsupported". Same quote, same one-token edit as the row above, opposite outcome: the only difference is where in the sentence the edit landed, and a mid-sentence token sits inside more n-gram windows than a trailing one. Detection here is a property of edit position, not of the verifier knowing anything about money.
- **Wholesale rewrite caught** — Out of 41 applicable; 0 still verified. Every paraphrase in this sweep was rejected — the case the design was built for. One sweep on 41 quotes is not a guarantee about paraphrase in general.
- **Single middle-token substitution caught** — Out of 41 applicable; 2 still verified. Survivors: tax.form_8938.filed (39 tokens), tax.form_5471.filed (31 tokens) — against a median verified quote of 9 tokens and a longest of 39, so what survives here is length: one broken token is a smaller share of a long quote's n-grams.
- **Single number substitution caught** — Out of 24 applicable (17 of the 41 verified quotes contain no digits and were skipped, not counted as passes). 0 altered figures were accepted as verified. These are the survivors that matter: an altered figure that still verifies is a wrong number wearing a warrant.
- **Number-substitution detection rate** — The weakest of the three sweeps, and the one that matters most: in this domain the tokens worth falsifying are the money.
- **Wrong value attached to a genuine quote — caught** — 0 of 41, and this is not a bug — verify.ts compares the quotation to the document and never compares the value to the quotation, so nothing in this path could have caught it. It is the exact boundary of what a green "verified" badge means, and it is measured rather than argued.
- **Keys found by both the model and the fixture author** — Agreement, not recall. The fixture was hand-written by the same author as the demo and nobody has annotated these documents with the complete set of facts they contain.
- **Keys the fixture has that the model did not produce** — Absent from the live run: tax.schedule_b.foreign_country. "Missed" would be the wrong word — the fixture is one author's list, not an adjudicated answer key, so a key only it has could equally be a key it invented.
- **Keys the model found that the fixture does not have** — Extra: asset.checking.institution, asset.brokerage.institution, asset.checking.identifier, asset.brokerage.identifier, asset.brokerage.has_named_beneficiary, asset.life_policy.institution, asset.life_policy.identifier. Each is verified against a real document, but "extra" does not mean "useful" — no rule currently reads several of these.
- **Shared keys where the two runs disagree on the value** — None — but the comparison is a normalised string equality, so it would not notice two spellings of the same address being materially different.

**What this does not establish**

- 9 synthetic documents authored in this repository, 4,959 characters in total. They are clean, machine-set prose with no OCR noise, no scans, no handwriting and no adversarial formatting, so nothing here predicts behaviour on a real data room.
- One model, one prompt version, one run, one estate. No variance is measured: re-running, re-prompting or swapping models could produce a different yield and this benchmark would not know.
- Verified is not correct. A warrant proves the quoted sentence exists in a document we hold; it says nothing about whether the value attached to it is the right reading of that sentence. The value-tamper sweep measures that gap directly and catches 0 of 41.
- Not a recall figure. Nobody has annotated these documents with the facts they actually contain, so "41 verified" cannot be turned into a percentage of what was there. The agreement rows compare the model to a hand-written fixture by the same author, which is not an independent gold standard — and the ledger-integrity percentage is a share of what was proposed, never a share of what was there.
- Rejection is measured on one planted fabrication plus synthetic mutations of real quotes. One caught fabrication is not a false-negative rate, and the mutations are not errors a model was observed making — they bound the verifier's sensitivity, not its field performance.
- No false-positive rate. Nothing here measures genuine quotations wrongly quarantined, which is the failure mode that would actually annoy a user: line-wrapping, ligatures, OCR substitutions and PDF hyphenation all attack the same n-gram coverage the sweeps attack.
- The corruption sweeps show detection depends on quote length and on where in the sentence the edit falls. That dependency is characterised here on 41 quotes from one run, one mutation per quote; the shape of the curve is not established, and no mutation combines two edits.
- The document-set guard compares names only. The recording stores no hash of the document text, so this module cannot prove the fixture documents still say what they said when the run was recorded.
- Token counts are real and provider-reported; the price used to turn them into dollars is unconfirmed catalog data, so the cost row is assumption-tainted and is not evidence of anything.
- Nothing downstream is tested. Whether the rules engine reaches the right legal conclusion from these facts, and whether the fact keys are the right ones to have extracted, are separate questions this module does not touch.

## Supersession replay — what is provably not re-computed

_When a supplemental appraisal supersedes one fact and flips the probate route, how many decision points can be shown not to need re-evaluating, and can every decision that did move point at a changed fact it read?_

| Metric | Value | Provenance |
|---|---|---|
| Rules in the California pack | 123 | measured — CA_RULES.length, read at module load — no fixture involved |
| Rules applicable in San Mateo | 9 | measured — applicable(CA_RULES, {state:'CA', county:'San Mateo'}).length |
| Decision points evaluated | 5 | measured — decide(...).length, running the CA pack over src/fixtures/hoyt-estate.ts at module load — the rules passed in are the Proxy-wrapped CA_RULES described below, which forward every property read to the originals |
| Verified fact keys in the ledger before the change | 27 | measured — values(beforeFacts) — verified facts only, quarantined ones excluded |
| Fact keys any decision point actually reads | 7 | measured — union of Decision.dependsOn over all decision points |
| Fact keys that moved | 3 | measured — reconcile(...).factDeltas.length |
| Size of the single valuation change | 20,000 USD | measured — after − before of asset.residence.value in reconcile(...).factDeltas |
| Document that superseded the appraisal | Supplemental Appraisal - 1412 Bayberry Lane.pdf | measured — quote warrant of the winning asset.residence.value fact in the new ledger |
| Which keys moved | asset.residence.value (changed); estate.residence_qualifies_13151 (changed); estate.section_13100_gross_value (changed) | measured — reconcile(...).factDeltas |
| Moved facts whose new value carries a warrant marked verified | 3 | measured — count of factDeltas whose cause fact has status 'verified' |
| Moved facts whose new value was checked against a document | 1 | measured — count of factDeltas whose cause fact has warrant.kind 'quote' and status 'verified' — i.e. verify.ts located the quotation |
| Decision points re-evaluated | 2 | measured — reconcile(...).reevaluated.length |
| Decision points provably untouched | 3 | measured — reconcile(...).skipped.length |
| Share of decision points skipped | 0.60 | derived — decisions_skipped / decision_points |
| Skipped points confirmed identical on full recomputation | 3 | measured — each skipped point recomputed from scratch against the new ledger and compared field-by-field with the carried-forward decision |
| Decision points whose winning rule changed | 2 | measured — reconcile(...).flippedCount |
| Rules sitting under skipped decision points | 3 | measured — applicable rules whose decisionPoint is in reconcile(...).skipped |
| Predicate-tree nodes under skipped points | 3 | measured — sum of evaluateRule(rule, after-ledger).trace.length over rules under skipped points |
| Rule evaluations reconcile() actually performed | 9 | measured — Proxy get-trap counting reads of Rule.when during the reconcile() call |
| Rules under re-evaluated points — evaluations still logically required | 6 | measured — applicable rules whose decisionPoint is in reconcile(...).reevaluated |
| Rule evaluations an implementation could have skipped | 3 | derived — evals_executed − evals_required |
| Single-key perturbations tried against the skip rule | 54 | measured — every ledger key removed, and every ledger key mutated (numbers doubled+1, booleans negated, strings suffixed), then the pack re-decided |
| Skipped-point assertions made across those trials | 252 | measured — for each trial, every decision point impacted() declared unaffected was compared against the base decision |
| Of those, assertions that could have failed | 52 | measured — the same assertions, restricted to trials whose perturbed key is in some decision point's dependsOn or needs — the only trials where impacted() has a discrimination to get wrong |
| Points impacted() called safe that moved anyway | 0 | measured — count of mismatches across the trials above |
| Mean decision points skipped per single-key change | 4.67 | measured — mean of impacted(beforeDecisions, [k]).skip.length over every ledger key |
| Flipped decisions naming at least one changed fact key they read | 2 | measured — count of flipped DecisionDeltas with a non-empty triggeredBy (the accompanying subset assertion holds by construction — see caveat) |
| Share of flipped decisions that can point at a changed key | 1 | derived — flips_naming_cause / decisions_flipped |
| Fact keys named as driving the changed decisions | asset.residence.value; estate.residence_qualifies_13151; estate.section_13100_gross_value | measured — union of DecisionDelta.triggeredBy across reconcile(...).decisionDeltas |
| Assertions pinning the skip set in the demo test | 3 | measured — regex count of expect(report.skipped) and expect(report.reevaluated) read off disk from src/rules/ca-probate.test.ts |
| Human review minutes a skipped decision point saves | **unsourced** | ASSUMED — No figure is offered. Nobody has measured how long a settlement specialist spends re-checking one decision point after a document lands, so no number is invented here. |

- **Rules in the California pack** — Not 123 independently researched rules. 7 are hand-written statewide rules; the other 116 are generated from the 58-county registry in ca-counties.ts by two templates (a filing-fee rule and a local-overlay rule per county). They span 5 decision points in total.
- **Rules applicable in San Mateo** — Jurisdiction scoping already discards the other counties' rules. That is a different mechanism from dependency-tracked skipping and the two must not be added together.
- **Decision points evaluated** — This is the size of the current rule pack, not the size of California probate. Every ratio below is a ratio over these decision points only.
- **Fact keys any decision point actually reads** — The other 20 of the 27 ledger keys are read by no California decision point at all. That is the pack's coverage, and it inflates every skip figure below — see the soundness and mean-skip caveats.
- **Which keys moved** — One extracted fact was superseded; the rest are derived facts that follow from it.
- **Moved facts whose new value carries a warrant marked verified** — Do not read this as three checked quotations. By warrant kind the moved facts are: 2 derivation, 1 quote. Only a quote warrant earns 'verified' by a check that could have failed; `derived()` in facts.ts stamps status 'verified' on a derivation warrant unconditionally, inheriting trust from its inputs. This count therefore mixes one verification with two inheritances.
- **Moved facts whose new value was checked against a document** — This is the subset of the row above that a verification actually ran on. It proves the quotation exists in a document we hold, not that the appraisal is right.
- **Decision points provably untouched** — The skipped points are: vehicle_transfer, filing_fee, county_requirements.
- **Skipped points confirmed identical on full recomputation** — This is the check that turns 'skipped' from a claim into a finding. It compares chosen rule, conclusion, forms, obligations, timeline, cost, also-fired, blocked, needs and the dependency set. It does not compare the evaluation traces.
- **Decision points whose winning rule changed** — reconcile() only builds decision deltas for points it re-evaluated, so a flip hidden inside the skip set could not appear in this count. The row above is what tests for that.
- **Predicate-tree nodes under skipped points** — A finer-grained unit of the work a lazy implementation would not do, and these evaluations were run here in order to count them. On this fixture it carries almost no information beyond the rule count: no rule under a skipped point produces more than 1 trace node, so 3 rules give 3 nodes. A pack with real predicate trees under its skipped points would separate the two figures.
- **Rule evaluations reconcile() actually performed** — reconcile() evaluates the full applicable set and then splices the untouched points through. The skip is therefore a carry-forward and audit guarantee, not a saving the current code banks.
- **Rules under re-evaluated points — evaluations still logically required** — A count of rules, not an observed execution: no run performed exactly this many evaluations. It is what a lazy implementation would have been obliged to do, inferred from the re-evaluated set.
- **Rule evaluations an implementation could have skipped** — An upper bound on avoidable work, not work presently avoided.
- **Skipped-point assertions made across those trials** — Most of this total is padding, and the next row is the figure to quote. 200 of the 252 assertions perturb a key that no decision point reads, so impacted() returns the whole pack as skipped and the assertion cannot fail whatever the skip rule does.
- **Of those, assertions that could have failed** — Still an over-count of difficulty: a key read by one decision point yields an easy assertion at each of the others. Nothing here is a claim that the informative trials are hard.
- **Points impacted() called safe that moved anyway** — Covers single-key deltas from one base ledger only. Simultaneous multi-key changes and newly-appearing keys are not covered. Zero violations over these trials is a failure to falsify, not a proof.
- **Mean decision points skipped per single-key change** — Inflated by the pack's coverage rather than by the reactor's cleverness: 20 of the 27 keys in this ledger are read by no California decision point at all, so changing one of them skips everything. Read this as a statement about pack shape first.
- **Flipped decisions naming at least one changed fact key they read** — The substantive test is non-emptiness only. reconcile() builds triggeredBy as after.dependsOn filtered against the changed keys, so "every named key appears in the fact deltas" is true by construction and is asserted here (it held: true) as a guard against that construction changing, not as a finding.
- **Share of flipped decisions that can point at a changed key** — The weakest reading is the correct one: no flipped decision came back with an empty cause list. Naming a changed key it read is a dependency-edge claim, not a counterfactual proof of causation, and this module runs no counterfactual — it never reverts a named key to see whether the decision goes back.
- **Assertions pinning the skip set in the demo test** — Says the guarantee is regression-guarded, not that the guard is sufficient.
- **Human review minutes a skipped decision point saves** — Without this, the skip count cannot be converted into hours or dollars, and this module deliberately converts it into neither.

**What this does not establish**

- Establishes no time or cost saving. No wall-clock figure is reported, and reconcile() as written still evaluates the whole applicable rule set before splicing the untouched points through — so the skip is an audit and carry-forward guarantee plus an upper bound on avoidable work, not a measured speed-up.
- One estate, one jurisdiction, one supersession. This is a case study on a synthetic fixture, not a distribution over real estates, and nothing here says how often a real data room produces a superseding document.
- The 5 decision points are the size of the current California pack, not of California probate. Skip share would move with the pack's size and dependency shape, in either direction.
- The soundness trials cover single-key removals and single-key mutations from one base ledger. They do not cover simultaneous multi-key changes, keys that appear for the first time, or edits to the rule pack itself.
- The soundness trial is weaker than its headline count suggests. Only 52 of the 252 skipped-point assertions perturb a key that any decision point reads; the remaining 200 could not have failed however impacted() were written. Zero violations is a failure to falsify over a small informative sample, not a proof of soundness.
- The rule count is mostly generated. 116 of the 123 rules in the pack come from two per-county templates over the 58-county registry, and only 7 are hand-written statewide procedure. "123 rules" is not 123 pieces of researched law.
- The skip guarantee holds only because the evaluator walks the entire predicate tree and records every key it consults. A future short-circuiting evaluator would silently under-record dependencies, and nothing measured here would catch that.
- The fixture is synthetic. Every rule in the pack carries an authority citation, but whether those citations are correctly read is not tested here — and Margaret Hoyt is not a real decedent, so no real client file has been replayed.
- Says nothing about whether the decisions are legally correct — only about which ones moved, which provably did not, and what each names as its cause.
- The audit property measured is that a flipped decision names a changed fact key it read, and that much is partly true by construction of `triggeredBy`. No counterfactual is run: nothing here reverts a named key to confirm the decision goes back, so causation is not established beyond the dependency edge.
- Quarantined facts are excluded from the ledger before any of this runs, so these figures presuppose the verification layer rather than testing it. Derived facts are a second presupposition of the same kind: `derived()` marks them verified without a check, so a warrant count over the moved facts is not a count of verifications performed.

## Coverage — what the engine reaches, and what it declines

_How much jurisdictional and form ground does the engine actually cover, how much of each estate record does it read, and how many forms does it refuse to fill — on what stated basis, and how few of those refusals anyone outside the rule pack has checked?_

| Metric | Value | Provenance |
|---|---|---|
| California counties in the registry | 58 | measured — CA_COUNTIES.length from src/rules/ca-counties.ts, imported and counted |
| Counties whose local probate rules were read | 3 | measured — coverage().verified from src/rules/ca-counties.ts |
| Counties flagged as not researched | 55 | measured — coverage().notResearched from src/rules/ca-counties.ts |
| Counties whose filing fee differs from the statewide figure | 2 | measured — coverage().feeVariances.length from src/rules/ca-counties.ts |
| Statewide California rules | 7 | measured — CA_RULES filtered to rules with no jurisdiction.county, counted |
| County rules generated from the registry | 116 | measured — countyRules().length — the registry expanded into rules at load |
| County rules that exist only to declare the county unread | 55 | measured — countyRules() filtered to rules whose authority.citation === 'Not researched' |
| Form-applicability rules | 6 | measured — FORM_RULES.length from src/rules/form-applicability.ts |
| Rules in the evaluated packs | 129 | derived — ca_statewide + county_generated + form_applicability, cross-checked against the length of the evaluated set |
| Rules carrying a source citation | 74 | measured — CA_RULES ∪ FORM_RULES counted where authority.citation is non-empty and not 'Not researched' |
| Distinct decision points | 9 | measured — distinct rule.decisionPoint across CA_RULES ∪ FORM_RULES |
| State rule packs | 1 | measured — distinct non-'*' rule.jurisdiction.state across CA_RULES ∪ FORM_RULES ('*' is the federal scope) |
| Government forms with a committed field map | 4 | measured — *.json files counted and parsed in src/forms/maps |
| Map entries binding a widget to a record path | 171 | measured — sum of FieldMap.entries.length across src/forms/maps/*.json |
| Widgets left unmapped, each carrying a recorded reason | 85 | measured — sum of FieldMap.unmapped.length across src/forms/maps/*.json — one entry per widget rectangle, as with entries, so repeated boxes are counted twice |
| Mapping proposals refused by the verifier | 2 | measured — sum of FieldMap.rejected.length across src/forms/maps/*.json |
| Distinct form fields a map says something about | 234 | measured — size of the set (FieldMap.entries ∪ unmapped ∪ rejected) by widget name, summed per form |
| Repeated fields whose copies disagree on the record path | 0 | measured — widget names appearing in FieldMap.entries more than once with more than one distinct target |
| Fillable widget rectangles on the mapped forms | 258 | measured — sum of FormGeometry.widgets.length over the 4 committed geometry files in src/forms/geometry that match a field map (generated from the named sourceFile PDF by tools/geometry.py) |
| Distinct fields on the mapped forms | 234 | measured — sum over the 4 forms of the distinct FormGeometry.widgets[].name count — the denominator for mapping disposition |
| Field names the geometry prints more than once | 24 | measured — widget names occurring more than once in FormGeometry.widgets, summed over the forms read |
| Disposed field names the form's geometry does not contain | 0 | measured — names in (FieldMap.entries ∪ unmapped ∪ rejected) with no matching FormGeometry.widgets[].name |
| Fields with an explicit disposition | 100 % | derived — (fields_disposed − disposed_off_form) / fields_distinct × 100, over the forms carrying both a map and geometry — the numerator is the intersection with the geometry, so the share cannot exceed 100% by counting a field the form does not have |
| Alix estate records evaluated | 5 | measured — estate-*.json counted and parsed in samples/track3 |
| (record × form) decisions taken | 20 | derived — records.evaluated × the 4 of 4 mapped forms that have a decision point wired to them — a form the engine is never asked about produces no decision to count |
| Forms filled | 14 | measured — decide(FORM_RULES, …) per record in its own venue; a form is filled when the chosen rule obliges a form |
| Withheld — a rule fired saying the form does not apply | 5 | measured — decisions where a rule was chosen but its then.forms is empty (e.g. form.dl142.out_of_state, form.ss4.not_needed) |
| Withheld — blocked on a fact the record does not hold | 1 | measured — decisions with no chosen rule and at least one rule reporting outcome 'blocked' under three-valued evaluation |
| Withheld — every rule evaluated not-applicable | 0 | measured — decisions with no chosen rule and no blocked rule — the form was skipped with nothing affirmatively said about it |
| Forms withheld | 6 | derived — withheld_rule_says_no + withheld_blocked + withheld_no_rule |
| Share of decisions that were declines | 30 % | derived — withheld_total / pairs.total × 100 |
| Decisions with an Alix-supplied applicability label | 5 | measured — (record × form) pairs where the record's own form block carries an `applicable` boolean |
| Of those, pairs whose outcome matches the label | 5 | measured — whether a form was produced, compared against the record's own `applicable` boolean, per pair |
| Of those, agreements where a rule actually fired | 4 | measured — agreeing pairs where decide() returned a chosen rule — the engine reached a conclusion and it matched |
| Of those, agreements where the engine reached no conclusion | 1 | measured — agreeing pairs with no chosen rule — every rule blocked or was not applicable, so no form was produced and the label happened to say none was due |
| Decisions with no independent check at all | 15 | derived — pairs.total − decline.independently_labelled |
| Form boxes written across all filled forms | 270 | measured — sum of Object.keys(toFillPayload(fillForm(map, record))).length, with the Form 56 rule-pack overrides applied as in tools/fill-forms.ts |
| Mapped boxes left blank because the record held nothing | 55 | measured — sum of FormFilling.gaps.length across every filled (record, form) pair |
| Checkboxes left unticked because their condition evaluated false | 193 | measured — fields with status 'condition_false' across every filled (record, form) pair |
| Mapped boxes whose record path does not exist | 0 | measured — sum of FormFilling.broken.length — a mapping pointing at a path absent from the record schema |
| Form 56 line-1 groups the rule pack refused to decide | 0 | measured — sum of form56Overrides(record).unresolved.length over the records whose Form 56 was filled |
| Leaf paths per record | 380.20 | measured — mean of leafPaths(record).length over the sample records |
| Record paths the importer declares | 54 | measured — importedPaths().length from src/lib/estate.ts |
| Declared import list, sized against an average record | 14.20 % | derived — import.declared_paths / record.leaf_paths_mean × 100 |
| Facts admitted per record | 52.40 | measured — mean of importEstate(record).facts.length over the sample records |
| Declared paths that held nothing, per record | 7.20 | measured — mean of importEstate(record).emptyPaths.length over the sample records |
| Imported facts quarantined | 0 | measured — facts with status !== 'verified' after importEstate — admitRecord re-reads each declared path against the record |
| Distinct record paths actually read, per record | 77.40 | measured — mean size of the union of (record-warrant paths on admitted facts) and (field-map targets that produced a written box), per record |
| Of those, paths that are scalar leaves of the record | 75.40 | measured — mean count of read paths that appear in leafPaths(record) — the subset that is comparable with the leaf-path denominator |
| Share of an average record's leaves that are read | 19.83 % | derived — record.paths_read_leaf_mean / record.leaf_paths_mean × 100 |
| Decision points a full estate settlement poses | **unsourced** | ASSUMED — No figure held. Without it, the decision-point count cannot be expressed as coverage. |
| Distinct government forms a settling estate must file | **unsourced** | ASSUMED — No figure held. 4 forms are mapped; 4 out of what is unknown. |

- **California counties in the registry** — Registered means the county exists as an addressable rule subject with a filing fee backed by a citation. It does not mean its local rules have been read.
- **Counties flagged as not researched** — These are surfaced as a known unknown, not defaulted to 'no local requirements'. That is the honest behaviour, but it is still 55 counties of unread local rules.
- **Counties whose filing fee differs from the statewide figure** — The fee column is complete for all 58 counties because the Judicial Council fee schedule enumerates its own exceptions, so one citation covers the column. That exhaustiveness is the schedule's claim as recorded in src/rules/ca-counties.ts; this benchmark counted the variances in the registry and did not re-read the schedule.
- **County rules generated from the registry** — Generated from 58 data rows, not written 116 times. The count measures reach, not research effort: one filing-fee rule per county plus one local-overlay rule, which for most counties is the 'not researched' flag.
- **County rules that exist only to declare the county unread** — Counted separately so the rule total is not read as legal coverage. These rules carry no local authority; they carry the statement that none was read.
- **Rules in the evaluated packs** — CA_RULES already contains the generated county rules, so this is one set counted by its parts, not three packs added together. Counting reach, not research: 55 of the county rules exist only to record that the county was not read.
- **Rules carrying a source citation** — A citation proves a source was named and read, not that the rule follows from it. No independent lawyer has audited the inference from text to rule.
- **Distinct decision points** — A decision point is a question the engine can answer with competing rules. The denominator — how many questions settling an estate actually poses — is not held here.
- **State rule packs** — One. Three of the five sample estates are administered outside it, which is why the out-of-state licence surrender is named as an obligation with no form behind it.
- **Government forms with a committed field map** — A count of committed map files, and nothing more. Reading a file does not establish that the verifier produced it. 'Verified' is a property of individual entries — see forms.entries_mapped — and not even of all of those: a declined widget's reason never reaches the verifier at all.
- **Map entries binding a widget to a record path** — Entries, one per widget rectangle, so the DL 142's duplicated boxes are counted twice — see forms.fields_disposed for the distinct-field figure. Every entry carries a verbatim printed label that the verifier located on the page. That proves the evidence is real, not that the widget was routed to the right path — two such routing errors are recorded in src/forms/adjudications.json (as three entries, because the line-2c error spans a Yes/No pair) and were found only by rendering the PDF and reading it.
- **Widgets left unmapped, each carrying a recorded reason** — Recorded, not verified, and the distinction is this repo's whole subject. verifyMapping returns the `unmapped` verdict before it ever looks for a printed label, so a decline is the one disposition here that carries no located evidence: the reason is the model's own prose. Many are plainly right — the IRS-completed EIN box on the SS-4 masthead, second designee slots, preparer blocks — but nobody has reviewed all 85, and the count establishes that a reason was written, not that declining was correct.
- **Mapping proposals refused by the verifier** — Refused because the label the model quoted could not be located on the page. A low count over one discovery run is not a measured error rate for the discovery process.
- **Repeated fields whose copies disagree on the record path** — Zero is what makes the distinct-field collapse lossless. Non-zero would mean two copies of one printed box were mapped to different record paths, and the disposition counts below would be hiding a contradiction rather than a duplicate.
- **Fillable widget rectangles on the mapped forms** — Rectangles, not fields. The DL 142 places named fields on the page twice, so this exceeds the number of distinct boxes a filler has to decide about.
- **Field names the geometry prints more than once** — This is the whole gap between the rectangle count and the distinct-field count, and it spans both buckets: some repeated boxes are mapped, some are declined. Any count summed over rectangles rather than names is inflated by exactly this much.
- **Disposed field names the form's geometry does not contain** — Zero is what makes the disposition share below a share. A rejected proposal can carry an `unknown_field` verdict — a widget the model invented — and that name would otherwise inflate a numerator whose denominator cannot contain it. Non-zero means the map and the geometry are describing different forms.
- **Fields with an explicit disposition** — Disposition means every field is either mapped, refused, or declined with a recorded reason — none is silently unaccounted for. It is bookkeeping completeness, not mapping correctness: a field routed to the wrong record path is disposed of just as fully as one routed correctly, and two such fields are known to exist. Declines count as dispositions, because a recorded refusal is a disposition — but see forms.widgets_declined for how little a decline's reason has been checked.
- **Alix estate records evaluated** — Five synthetic records supplied for one hackathon track. Not a sample of estates.
- **Withheld — a rule fired saying the form does not apply** — The strongest kind of decline: a cited rule states positively why not, and names the obligation that moves elsewhere. An out-of-state licence still has to be surrendered.
- **Withheld — blocked on a fact the record does not hold** — Blocked names the missing fact. This is a gap that a human can close, not a refusal.
- **Withheld — every rule evaluated not-applicable** — The weakest decline, separated out on purpose. Nothing here distinguishes 'correctly out of scope' from 'the pack has no rule for this case'. Counted, not credited.
- **Share of decisions that were declines** — A high share is neither good nor bad on its own. It is high here because the sample was chosen to contain forms that should not be filed.
- **Decisions with an Alix-supplied applicability label** — Only the DL 142 block carries one. It is the sole ground truth in this benchmark that we did not also author.
- **Of those, pairs whose outcome matches the label** — Outcome agreement: did we produce a form where the label says one is due. It is never read from the label — the decision comes off the licence's issuing state — but it does not distinguish a reasoned call from a non-call, which is why the next two rows split it. Agreement over a handful of labelled pairs is a smoke test, not an accuracy rate.
- **Of those, agreements where a rule actually fired** — This is the only figure here that is an independent check on a decision. Everything the engine concluded about the DL 142 and was graded on by somebody else lives in this row.
- **Of those, agreements where the engine reached no conclusion** — Counted, not credited. Producing no form because a required fact is missing matches a label of 'not applicable' without concluding anything: the engine did not find the form inapplicable, it reported that it could not tell, and named the fact it wanted. Subtract this from the row above before reading agreement as evidence of a correct decision.
- **Decisions with no independent check at all** — 75% of the decisions in this benchmark are graded only by the rule pack that made them, and not every labelled pair is even a conclusion — see decline.label_agreement_by_silence. This is the number that most needs an outside adjudicator.
- **Form boxes written across all filled forms** — Boxes written, not boxes correct. Read-back proves the bytes are in the file; only reading the rendered form proves a human sees the right thing there.
- **Mapped boxes left blank because the record held nothing** — Each comes back named with the record path that would have supplied it.
- **Checkboxes left unticked because their condition evaluated false** — Not 'correctly unticked'. What was measured is that the mapped condition read the record and came back false — which is only right if the condition points at the question the box actually asks. One of the adjudicated errors is exactly that failure: a Form 56 line-2c box wired to 'does a court case exist' instead of 'are the assets in the court's custody', which ticked on every sample estate and was invisible to label verification.
- **Mapped boxes whose record path does not exist** — Zero is the expected value. Non-zero means the field map and the Alix schema have drifted apart and every form built from that map is quietly wrong.
- **Form 56 line-1 groups the rule pack refused to decide** — An unrecognised authority basis sets no box and says so, rather than guessing between 1b and 1d. A blank gets caught in review; a wrong box misstates legal standing.
- **Leaf paths per record** — Counts scalar leaves, so a long free-text note and a ZIP code weigh the same. Paths are not information. It also counts the leaves a record declares and leaves null, which are unreadable by anything — so as the denominator of record.read_share it is generous to the record and harsh on the engine, not the other way round.
- **Record paths the importer declares** — The declared scalar import list. Assets and identifications are imported by array walk and are not in it, so this both under- and over-states what one record yields.
- **Declared import list, sized against an average record** — A sense of scale, not a coverage figure, and it is not the share of a record that gets read — that is record.read_share. The numerator is a fixed list written into the importer: some of its paths are absent or empty in any given record (see import.declared_paths_empty_mean), and the assets and identifications the importer walks by array are not in it at all.
- **Declared paths that held nothing, per record** — An empty path yields no fact at all, so the rule that wants it reports itself blocked. Writing an empty string instead would make the gap invisible.
- **Imported facts quarantined** — Zero means the importer and the Alix schema agree today. It is a schema-drift alarm, not evidence that the values are correct.
- **Distinct record paths actually read, per record** — The fact ledger and the form filler read the record for different reasons and barely overlap, so neither alone is the answer to 'how much of the record do we touch'.
- **Of those, paths that are scalar leaves of the record** — Smaller than the row above because some map targets name a whole array rather than a scalar. Reading one is a real read of the record, but it is not one of the leaves the denominator counts, so only this subset can go into a share.
- **Share of an average record's leaves that are read** — The rest of the record is not read by anything here. Some of it is genuinely irrelevant to these four forms; nobody has gone through it to say which. Counted over leaves only, so a whole-array read is excluded rather than credited as one path out of hundreds.

**What this does not establish**

- Disposition is bookkeeping, not correctness. Every field on the mapped forms being accounted for says nothing about whether the mapped ones point at the right record path: the two adjudicated routing errors in src/forms/adjudications.json were fully disposed of while being wrong.
- Independently-labelled pairs where the engine reached no conclusion: 1 of 5. Every rule blocked for want of a fact, so no form was produced and the label happened to say none was due. That is counted in the outcome-agreement row and excluded from the credited one, but it means the number of decisions this benchmark can show an outside check on is smaller than the number of labels it holds.
- Counting rules is not covering law. 55 of California's 58 counties carry no researched local overlay, and the rules that represent them exist only to say so.
- One state pack. 3 of the 5 sample estates are administered outside California, where this engine can name an obligation but has no form or threshold behind it.
- A citation on a rule proves a source was read, not that the rule follows from it. No lawyer has audited the step from statutory text to encoded predicate.
- A decline is the least-evidenced disposition in this benchmark. A mapping that fills a box had its printed label located on the page; a mapping that refuses a box is exempted from that check by verifyMapping itself, so every unmapped-widget reason counted here is unverified model prose. Bookkeeping completeness is measured over both.
- Filled is not correct. The box counts measure what was written, not what was right; the two known routing errors in src/forms/adjudications.json passed quote verification and were caught only by rendering the PDF and reading it.
- Withheld is graded almost entirely by the rule pack that did the withholding. Only the DL 142 decisions carry an independent applicability label from Alix; the rest have no outside check.
- 5 synthetic records from one hackathon track are not a sample of estates. Nothing here estimates how the fill/withhold split would move on a real caseload.
- Path coverage counts paths, not information. A single unread path can matter more than a hundred read ones, and nobody has reviewed the unread remainder to say whether it does.
- No baseline. This benchmark contains no measurement of what a human, a paralegal workflow, or any competing system covers, so none of these counts supports a comparative claim.
- No timing and no cost. This is a breadth measurement only.

## Economics — what would this be worth per estate?

_How much of an estate's form work does the engine actually do, and what would have to be true about hours and rates before that could be turned into money?_

| Metric | Value | Provenance |
|---|---|---|
| Government forms with a verified field map | 4 | measured — counted the *.json field maps in src/forms/maps |
| Fillable widget rectangles on those forms | 258 | measured — summed widgets[] across src/forms/geometry/*.json |
| Distinct widget names on those forms | 234 | measured — counted unique widget.name per form in src/forms/geometry |
| Widgets a verified mapping addresses | 156 | measured — distinct entries[].field across src/forms/maps/*.json |
| Widgets with no mapping at all | 78 | measured — distinct unmapped[].field + rejected[].field, minus anything also mapped |
| Estate records the pipeline was run over | 5 | measured — parsed samples/track3/estate-*.json |
| Forms the rules said to file, across all estates | 14 | measured — ran importEstate + decide(FORM_RULES) + fillForm over every (estate, form) pair |
| Forms a rule positively declined | 5 | measured — decisions whose chosen rule is not in the AFFIRMATIVE set |
| Form decisions no rule could reach | 1 | measured — decisions with no chosen rule — a required fact is unknown |
| Boxes mapped to a path the record does not have | 0 boxes | measured — FormFilling.broken (status "path_missing") across every fill |
| Form 56 line-1 groups the rule pack refused to decide | 0 | measured — form56Overrides().unresolved, summed over every Form 56 fill |
| Import, rule evaluation and fill, all estates | 4.09 ms | measured — performance.now() around the loop in this module |
| Boxes the engine writes, per estate | 54 boxes | measured — distinct keys of toFillPayload() (plus rule-pack Form 56 overrides), summed over each estate's applicable forms, divided by 5 estates |
| Boxes the engine writes, per generated form | 19.29 boxes | measured — same payload keys, divided by the 14 generated forms |
| Gaps surfaced, per generated form | 3.93 boxes | measured — FormFilling.gaps (status "empty_in_record") from src/lib/fill.ts, deduplicated by widget name |
| Gaps surfaced, per estate | 11 boxes | measured — same gaps, divided by 5 estates |
| Unmapped widgets on the forms generated for an estate | 60.60 boxes | measured — per generated form, its map's untriaged unmapped+rejected widget count, summed and divided by 5 estates |
| Mapped checkboxes the engine deliberately left unticked, per estate | 37.40 boxes | measured — FormFilling.fields with status "condition_false", deduplicated by widget name against the written, empty and broken sets, divided by 5 estates |
| Mapped widgets on the forms generated for an estate | 103.20 boxes | measured — per generated form, its map's distinct entries[].field count, summed and divided by 5 estates |
| Widget names printed on the forms generated for an estate | 163.80 boxes | measured — per generated form, its geometry's distinct widget-name count, summed and divided by 5 estates |
| Share of the boxes fill.ts reported on that the engine populates | 0.83 | derived — written / (written + empty + broken). The first two are per estate; boxes.broken is a run total, so divide it by the estate count before combining — at zero that changes nothing, but the formula is only reproducible as written once it stops being zero |
| Share of the mapped widgets on those forms the engine populates | 0.52 | derived — written / mapped, both per estate — the denominator is every widget a verified map addresses on the forms this run actually generated, taken from the maps rather than from the fill result |
| Share of all widget names on those forms the engine populates | 0.33 | derived — written / every distinct widget name on the generated forms, both per estate, the denominator taken from the geometry |
| Model input tokens, recorded extraction run | 12,471 tokens | measured — read inputTokens from src/fixtures/recorded-extraction.json |
| Model output tokens, recorded extraction run | 3,651 tokens | measured — read outputTokens from src/fixtures/recorded-extraction.json |
| Baseline hours per estate (PLACEHOLDER) | **10 hours** | ASSUMED — PLACEHOLDER. Not sourced, not researched, not an estimate. A round number chosen precisely because it is obviously round, so that nobody can mistake it for a finding. |
| Share of those hours spent on form preparation (PLACEHOLDER) | **0.25** | ASSUMED — PLACEHOLDER. Nobody has measured how estate-administration time splits between paperwork and everything else. |
| Loaded cost of a specialist hour (PLACEHOLDER) | **100 USD/hour** | ASSUMED — PLACEHOLDER. Not a market rate, not a survey, not a quote. A round number standing in for a figure only the team holds. |
| Form-preparation hours per estate (modelled) | **2.50 hours** | derived from an assumption — hoursPerEstate * shareOnForms |
| Modelled value per estate, reported-box denominator | **207.69 USD** | derived from an assumption — formHoursPerEstate * ratio.ofReportedBoxes * costPerHour |
| Modelled value per estate, all-widget denominator | **82.42 USD** | derived from an assumption — formHoursPerEstate * ratio.ofAllWidgets * costPerHour |

- **Government forms with a verified field map** — Four forms. A real estate touches more than four, so every per-estate figure below is per estate restricted to these four.
- **Distinct widget names on those forms** — Lower than the rectangle count because DL 142 renders one field in several places. Everything below counts names, so one value is not credited as three filled boxes.
- **Widgets a verified mapping addresses** — Verification proves the model quoted a label that is really printed next to the box. It does not prove the box is the right destination.
- **Widgets with no mapping at all** — NOT TRIAGED. Some of these are Print and Clear Form buttons and For-IRS-Use-Only boxes that no human fills either; some may be boxes a human must fill by hand. Nobody has gone through them. This is one of the two reasons the automation ratio is reported three times below rather than once.
- **Estate records the pipeline was run over** — Alix's Track 3 samples. 5 records is a sample, not a distribution, and 2 of the 5 are California — the only state this rule pack covers.
- **Forms a rule positively declined** — Composition, counted rather than asserted: 2x ca-dl142, 3x irs-ss4. Not filling a form is work too, and a filler that produced one anyway would look like it was working. No value is claimed for these below. A positive decline is not the same thing as the blocked row that follows: declined means a rule fired and said no, blocked means no rule could tell — so a form absent from an estate's output may be either.
- **Form decisions no rule could reach** — Composition: 1x ca-dl142. Three-valued logic refusing to guess: the record does not state a licence state, so the pack will neither produce a DL 142 nor rule one out. Counted here because it is a form the system did not produce, and any honest per-estate figure has to show that residue rather than drop it.
- **Boxes mapped to a path the record does not have** — Map-versus-schema drift. Zero is the expected value and means only that these maps match these five records; it says nothing about the next schema version.
- **Form 56 line-1 groups the rule pack refused to decide** — Zero across these five estates. The refusal path exists — an unrecognised authority basis ticks nothing — it just was not exercised here, so this measures the sample, not the safeguard.
- **Import, rule evaluation and fill, all estates** — Not the cost of operating the system. Excludes the Python geometry pass, the paid model run that discovered the maps, and PDF writing. Machine-dependent.
- **Boxes the engine writes, per estate** — Boxes written, not boxes correct. fill.ts reports what it populated; two verified, plausible mappings in adjudications.json were wrong and were caught only by rendering the PDF and reading it.
- **Gaps surfaced, per generated form** — Over-counts human work. This bucket mixes a box a human must chase — Form 56's docket number — with a box that is simply blank on a valid form, such as Form 8821's second designee slot for an estate with one adviser. fill.ts distinguishes them in the note; this count does not.
- **Unmapped widgets on the forms generated for an estate** — Inherits the untriaged problem from widgets.unmapped. Larger than the number of boxes written, which is exactly why it must not be omitted.
- **Mapped checkboxes the engine deliberately left unticked, per estate** — A mapped box the engine read a fact for and decided not to tick — the 'No' half of a yes/no pair, a filing-status box for a status this estate does not have. It is neither populated nor a gap, so any ratio of written/(written+gaps) drops it silently. It is bigger than the gap count, and it is the main reason three ratios follow instead of one.
- **Widget names printed on the forms generated for an estate** — Every box, tick and button on the pages the engine produced. The mapped and unmapped rows above sum to exactly this, which is the arithmetic check that no widget is double-counted or lost between the two.
- **Share of the boxes fill.ts reported on that the engine populates** — The narrowest and most flattering denominator here, and narrower than any phrase containing "mapped": it counts only the widgets fill.ts wrote or named as a gap. The 37.4 deliberately-unticked checkboxes per estate are in neither the numerator nor the denominator, and neither are the 0.8 per estate the Form 56 rule pack clears after the map filled them. Do not read this as the share of the mapped boxes — that is the next row, and it is much lower.
- **Share of the mapped widgets on those forms the engine populates** — This is what 'share of mapped boxes' means when the denominator is actually the mapped boxes. The difference from the row above is not failure: most of the shortfall is checkboxes correctly left unticked. It is reported because a reader told only the higher number would believe the engine had populated four in five mapped boxes.
- **Share of all widget names on those forms the engine populates** — The punishing denominator, and now genuinely punishing: every widget printed on those pages, including Print and Clear Form buttons nobody fills. The number a reader actually wants is somewhere between this row and the one above it, and this benchmark cannot say where, because the 78 unmapped widgets have never been triaged.
- **Model input tokens, recorded extraction run** — One real run of gpt-5.6-terra over 9 documents for one synthetic estate. This is Track 1 fact extraction, not the form pipeline — the form fill path above makes no model call at run time, because the maps were discovered once, offline.
- **Model output tokens, recorded extraction run** — Deliberately not converted to dollars. See limits: the catalog price for this provider is documented as stale and under-counting, so a dollar figure here would be a number we already know is wrong.
- **Baseline hours per estate (PLACEHOLDER)** — Change this and every dollar figure below moves in proportion.
- **Form-preparation hours per estate (modelled)** — Both inputs are placeholders, so this is a placeholder times a placeholder.
- **Modelled value per estate, reported-box denominator** — NOT EVIDENCE. Every dollar of this comes from three placeholders, and the step from 'share of boxes populated' to 'share of hours removed' is an equivalence nobody has tested. It also uses the most flattering of the three ratios, so it is the highest number this module can honestly print and should be read as the ceiling of a worked example.
- **Modelled value per estate, all-widget denominator** — Same model, other end of the ladder. The distance between this row and the one above is not uncertainty about the software — the software did the same thing in both — it is two pieces of missing bookkeeping: the untriaged unmapped widgets, and the checkboxes correctly left unticked that the higher ratio excludes from its denominator.

**What this does not establish**

- No dollar figure here is evidence. All three inputs the money rests on — hours per estate, the share of those hours spent on forms, and the cost of an hour — are unsourced placeholders. They are marked ASSUMED, and every figure computed from them is marked as derived from an assumption. Read those rows as a worked example of the arithmetic, not as a result.
- No industry baseline appears here, cited or otherwise. We have not read an Alix figure for hours per estate and have not looked one up elsewhere. Nothing in this module may be quoted as an industry comparison, and the absence of a `cited` row anywhere in it is the point.
- The measured ratios count boxes, not time. Nobody has established that populating a box removes a proportional share of the work. It plausibly does not: the boxes Form 56 leaves empty include the court address, the court room or suite, the docket number and whether assets are under court control — the ones that require a phone call, not a lookup. They are not the only ones (the same list holds the fiduciary's address line 2, which costs nobody anything), so this is a counter-example to box-share being hour-share, not a tally of the hard boxes. The step from box-share to hour-share is the weakest joint in this module and it is an assumption wearing a measurement's clothes.
- Boxes written is not boxes correct. `fill.ts` reports what it populated, not whether the value belongs where it went. Two mappings now in `adjudications.json` were verified, plausible and wrong, and were caught only by rendering the PDF and reading it. This benchmark counts ink.
- n = 5 estates and 4 forms, all Alix samples. 2 of them are California. The fill rate on a state this rule pack does not cover is unknown, and the engine would decline or block rather than fill — which is safe but is not value.
- The automation ratio is reported against three denominators, for two separate reasons, and a single headline percentage would have to suppress one of them. First, the 78 widgets these maps leave unmapped have never been triaged: some are Print and Clear Form buttons and For-IRS-Use-Only boxes no human fills either, some may be real manual work, and nobody has classified them. Second, a mapped checkbox the engine deliberately leaves unticked is neither a populated box nor a gap, and whether it belongs in the denominator is a judgement, not a measurement — so it is excluded from the narrowest ratio, included in the other two, and counted on its own row so the choice is visible. Until the triage exists, none of the three is the number a reader wants and this module cannot narrow the range.
- The gap count over-states human work in the other direction: it does not separate a box that must be chased from a box that is correctly blank on a valid form, such as Form 8821's second designee slot.
- Model cost is reported in tokens, not dollars. `CLAUDE.md` documents the catalog price for non-Anthropic providers as known-stale and under-counting, and the recorded run used one. A dollar figure computed from a price table we already know is wrong would be worse than no figure.
- No extrapolation to a portfolio. This module deliberately does not multiply a per-estate number by a number of estates. With three unsourced inputs, scaling multiplies the error and nothing else.
- Nothing here prices the failure modes the system prevents — a second EIN issued because SS-4 was filed twice, a DL 142 sent to California for an Indiana licence while the Indiana surrender goes undone. Those are the expensive events and this benchmark does not touch them, because their frequency and cost are both unknown to us.
- The 5 forms positively declined and the 1 decision(s) left blocked produced no boxes and therefore contribute nothing to any figure above, even though deciding not to file is real work the engine did. 'Declined' here means a rule fired and said no — it is not a claim that the decline was the right answer, which nobody has checked against ground truth.

## Assumptions still to be sourced

These are the numbers somebody could argue with. Each needs a source
before it goes in front of anyone.

- **End-to-end onboarding wall clock** = not recorded — no committed artefact contains a duration; discover-maps.ts prints per-chunk latency to stdout and persists none of it, and no run log was kept _(ask: re-run tools/discover-maps.ts with WK_KEY set and capture stdout, or have it write elapsed ms into the map file so the figure survives the run)_
- **API cost to onboard all four forms** = not recorded — discover-maps.ts totals input and output tokens and prints a dollar figure at the end of a run, using a hardcoded price; neither the tokens nor the total is written to disk _(ask: re-run tools/discover-maps.ts with WK_KEY set and capture the final line, and confirm the hardcoded per-token price against current published pricing before quoting it)_
- **Human time to map the same 234 fields** = not measured — nobody has been timed hand-mapping these forms, and no published figure for the task has been read; without it, no speedup can be stated at all _(ask: time a paralegal or forms specialist hand-mapping one of these four forms from the PDF, or ask Alix for the internal figure for onboarding a new form)_
- **Catalog input price, gpt-5.6-terra** = 3 USD/Mtok — Read at run time from CATALOG in src/lib/catalog.ts, whose own header states non-Anthropic prices are unconfirmed and set at or above the nearest known tier _(ask: the provider's published price list for this model id)_
- **Catalog output price, gpt-5.6-terra** = 12 USD/Mtok — Read at run time from CATALOG in src/lib/catalog.ts; same caveat as the input price _(ask: the provider's published price list for this model id)_
- **Human review minutes a skipped decision point saves** = unsourced — No figure is offered. Nobody has measured how long a settlement specialist spends re-checking one decision point after a document lands, so no number is invented here. _(ask: Alix operations — time-and-motion data from specialists re-reviewing decisions after a supplemental document arrives, or timesheet data broken down per decision point.)_
- **Decision points a full estate settlement poses** = unsourced — No figure held. Without it, the decision-point count cannot be expressed as coverage. _(ask: Alix's own process taxonomy, or an end-to-end checklist from a probate practitioner, counted the same way this engine counts a decision point)_
- **Distinct government forms a settling estate must file** = unsourced — No figure held. 4 forms are mapped; 4 out of what is unknown. _(ask: A form inventory for a representative estate from Alix, or a state bar probate checklist enumerating the federal, state and county filings)_
- **Baseline hours per estate (PLACEHOLDER)** = 10 hours — PLACEHOLDER. Not sourced, not researched, not an estimate. A round number chosen precisely because it is obviously round, so that nobody can mistake it for a finding. _(ask: Alix. The team's understanding is that Alix has published a figure for administrative hours per estate — somebody must retrieve that publication and cite it. We have not read it, and guessing a number that a real published figure would contradict is worse than leaving this blank.)_
- **Share of those hours spent on form preparation (PLACEHOLDER)** = 0.25 — PLACEHOLDER. Nobody has measured how estate-administration time splits between paperwork and everything else. _(ask: Alix, from time-tracking or matter-billing data. Present as its own assumption rather than folded into the hours figure, because the engine only touches forms: it cannot shorten asset discovery, creditor notice or a call with a beneficiary, and a model that hides this factor silently claims it can.)_
- **Loaded cost of a specialist hour (PLACEHOLDER)** = 100 USD/hour — PLACEHOLDER. Not a market rate, not a survey, not a quote. A round number standing in for a figure only the team holds. _(ask: The team — Alix's internal loaded cost for whoever does this work. A rate looked up on the internet would be a different company's number wearing this one's name.)_
