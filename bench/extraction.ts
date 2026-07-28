// Benchmark: live fact extraction, and whether verification actually rejects.
//
// The first half of this module is the easy half: replay the recorded model run
// through `admitAll` and count what came out. Those numbers flatter the system,
// and on their own they are worthless — a verifier that stamps everything
// "verified" would produce exactly the same table.
//
// So the second half attacks it. A verifier only means something if it can be
// shown failing to accept things, and there are three separate questions hiding
// inside "does it reject":
//
//   1. A wholly fabricated citation.       The planted Prudential policy.
//   2. A real sentence with one token
//      altered — a number or a name.       Three corruption sweeps.
//   3. A real, correctly-quoted sentence
//      with the wrong value attached.      The value-tamper sweep.
//
// Only the first is caught with certainty. The second is caught most but not all
// of the time, and this module measures where the edge is rather than asserting
// there isn't one. The third is not caught at all, by construction — quote
// verification never compares the asserted value to the quotation, and the
// measured value-tamper row is the honest bound on what "verified" is worth.
//
// Everything below is computed at import time from the committed artefacts. No
// figure in this file was typed in from a commit message.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { RECORDED, RECORDED_CANDIDATES } from "../src/fixtures/recorded";
import { HOYT_DOCS, INITIAL_CANDIDATES } from "../src/fixtures/hoyt-estate";
import {
  admit,
  admitAll,
  integrity,
  ledger,
  quarantined,
  type Fact,
  type FactCandidate,
} from "../src/lib/facts";
import { CATALOG } from "../src/lib/catalog";
import { normalise } from "../src/lib/verify";

import {
  assumed,
  derived,
  measured,
  print,
  type Benchmark,
  type Metric,
} from "./harness";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const pct = (x: number) => Number((x * 100).toFixed(1));
const round = (x: number, dp: number) => Number(x.toFixed(dp));

/** The verdict/similarity off a quote warrant, or null for other warrant kinds. */
function quoteWarrant(f: Fact) {
  return f.warrant.kind === "quote" ? f.warrant : null;
}

/**
 * Token count under the verifier's own `normalise`, so a quote length quoted in
 * a caveat is the length the verifier sees rather than this file's guess at it.
 * Deliberately does NOT restate verify.ts's n-gram window size: that is a
 * constant in another file, and a caveat asserting "broke four n-grams" would be
 * arithmetic this module cannot check. The caveats report measured coverage
 * instead.
 */
const tokenCount = (q: string) => normalise(q).split(" ").filter(Boolean).length;

/**
 * The verifier's accept threshold, read out of its own source rather than
 * restated here — a constant copied into a benchmark is a constant that goes
 * stale the first time somebody tunes it.
 */
function readVerifiedThreshold(): number | null {
  try {
    const src = readFileSync(fileURLToPath(new URL("../src/lib/verify.ts", import.meta.url)), "utf8");
    const m = /const\s+VERIFIED_THRESHOLD\s*=\s*([0-9.]+)/.exec(src);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}
const VERIFIED_THRESHOLD = readVerifiedThreshold();

// ---------------------------------------------------------------------------
// 1. The recorded run, replayed through the real verification path
// ---------------------------------------------------------------------------

const liveFacts = admitAll(RECORDED_CANDIDATES, HOYT_DOCS);
const liveIntegrity = integrity(liveFacts);
const liveLedger = ledger(liveFacts);

const docChars = HOYT_DOCS.reduce((s, d) => s + d.content.length, 0);

// Does the recording still name the document set we are replaying it against?
//
// Names only. `RecordedExtraction` stores `documents: string[]` and no content
// hash, so this cannot detect a document whose *text* was edited after the
// recording was made — that would silently change what the replay is verified
// against and this check would still say "yes". The row is labelled for what it
// actually proves.
const recordedDocNames = [...RECORDED.documents].sort().join("|");
const fixtureDocNames = HOYT_DOCS.map((d) => d.name)
  .slice()
  .sort()
  .join("|");
const docsetMatches = recordedDocNames === fixtureDocNames;

// Why there are more verified citations than distinct keys. Counted rather than
// asserted: "the model cited several documents for the same key" is a claim about
// this run, and a claim about a run belongs in the arithmetic, not in prose.
const verifiedByKey = new Map<string, Fact[]>();
for (const f of liveFacts) {
  if (f.status !== "verified") continue;
  const held = verifiedByKey.get(f.key) ?? [];
  held.push(f);
  verifiedByKey.set(f.key, held);
}
const multiCited = [...verifiedByKey.values()].filter((a) => a.length > 1);
const multiCitedCrossDoc = multiCited.filter(
  (a) => new Set(a.map((f) => quoteWarrant(f)?.matchedDocument ?? quoteWarrant(f)?.document)).size > 1,
).length;

/** Documents that contributed at least one verified fact. */
const contributingDocs = new Set(
  liveFacts
    .filter((f) => f.status === "verified")
    .map((f) => quoteWarrant(f)?.matchedDocument ?? quoteWarrant(f)?.document)
    .filter(Boolean) as string[],
);

// Catalog price for the model that produced the recording. The catalog is a
// real repo artefact and this is really read out of it at run time — but the
// file's own header says non-Anthropic prices are unconfirmed and deliberately
// set at or above the nearest known tier, so the number is a stand-in, not a
// measurement of what the run cost. It is declared `assumed` so that the dollar
// figure computed from it renders as assumption-tainted, which it is.
const spec = CATALOG.find((m) => m.id === RECORDED.model);
const priceMetrics: Metric[] = spec
  ? [
      {
        id: "price.input",
        label: `Catalog input price, ${RECORDED.model}`,
        value: spec.inputCost,
        unit: "USD/Mtok",
        provenance: assumed(
          `Read at run time from CATALOG in src/lib/catalog.ts, whose own header states non-Anthropic prices are unconfirmed and set at or above the nearest known tier`,
          "the provider's published price list for this model id",
        ),
      },
      {
        id: "price.output",
        label: `Catalog output price, ${RECORDED.model}`,
        value: spec.outputCost,
        unit: "USD/Mtok",
        provenance: assumed(
          `Read at run time from CATALOG in src/lib/catalog.ts; same caveat as the input price`,
          "the provider's published price list for this model id",
        ),
      },
      {
        id: "run.cost",
        label: "Cost of the recorded run",
        value: round(
          (RECORDED.inputTokens / 1e6) * spec.inputCost + (RECORDED.outputTokens / 1e6) * spec.outputCost,
          4,
        ),
        unit: "USD",
        provenance: derived(
          ["run.input_tokens", "run.output_tokens", "price.input", "price.output"],
          "(input/1e6)*price.input + (output/1e6)*price.output",
        ),
        caveat:
          "Assumption-tainted: the token counts are real, the prices are not sourced. Treat the order of magnitude, not the figure.",
      },
    ]
  : [];

// ---------------------------------------------------------------------------
// 2. Does verification reject? The planted fabrication
// ---------------------------------------------------------------------------

const FABRICATION_KEY = "asset.prudential_policy.value";

const fixtureFacts = admitAll(INITIAL_CANDIDATES, HOYT_DOCS);
const fixtureIntegrity = integrity(fixtureFacts);
const fixtureLedger = ledger(fixtureFacts);
const fixtureQuarantined = quarantined(fixtureFacts);

const fabricated = fixtureFacts.find((f) => f.key === FABRICATION_KEY) ?? null;
const fabricatedWarrant = fabricated ? quoteWarrant(fabricated) : null;
const fabricationCandidate = INITIAL_CANDIDATES.find((c) => c.key === FABRICATION_KEY) ?? null;

// ---------------------------------------------------------------------------
// 3. Negative controls — deterministic corruption of quotations that DO verify
// ---------------------------------------------------------------------------

const splice = (q: string, at: number, len: number, rep: string) => q.slice(0, at) + rep + q.slice(at + len);

/** Change the first run of digits: "$740,000" -> "$295,000". */
function corruptFirstNumber(q: string): string | null {
  const d = /\d+/.exec(q);
  if (!d) return null;
  return splice(q, d.index, d[0].length, d[0].replace(/\d/g, (c) => String((Number(c) + 5) % 10)));
}

/** Replace the token nearest the middle of the quote with a word found nowhere. */
function corruptMiddleToken(q: string): string | null {
  const ws = [...q.matchAll(/[A-Za-z0-9$,.']{3,}/g)];
  if (ws.length < 3) return null;
  const m = ws[Math.floor(ws.length / 2)];
  if (m.index === undefined) return null;
  return splice(q, m.index, m[0].length, "Blackwood");
}

/** Rewrite every number and the head of every long word — a paraphrase, not a quote. */
function corruptWholesale(q: string): string | null {
  const out = q
    .replace(/\d/g, (c) => String((Number(c) + 5) % 10))
    .replace(/[A-Za-z]{4,}/g, (w) => "Zorn" + w.slice(4));
  return out === q ? null : out;
}

/** Keep the genuine quotation; change only the value the model attached to it. */
function tamperValue(c: FactCandidate): FactCandidate {
  const v =
    typeof c.value === "number"
      ? c.value * 3 + 1
      : typeof c.value === "boolean"
        ? !c.value
        : `${c.value} (tampered)`;
  return { ...c, value: v };
}

const verifiedCandidates = RECORDED_CANDIDATES.filter((c) => admit(c, HOYT_DOCS).status === "verified");

interface SweepResult {
  applicable: number;
  caught: number;
  survived: number;
  skipped: number;
  /** Which corruptions got through, with the length of the quote that hid them. */
  survivors: { key: string; tokens: number }[];
}

function sweep(mutate: (q: string) => string | null): SweepResult {
  let caught = 0;
  let skipped = 0;
  const survivors: { key: string; tokens: number }[] = [];
  for (const c of verifiedCandidates) {
    const q = mutate(c.quote);
    if (q === null || q === c.quote) {
      skipped += 1;
      continue;
    }
    if (admit({ ...c, quote: q }, HOYT_DOCS).status === "verified")
      survivors.push({ key: c.key, tokens: tokenCount(c.quote) });
    else caught += 1;
  }
  return {
    applicable: caught + survivors.length,
    caught,
    survived: survivors.length,
    skipped,
    survivors,
  };
}

/** "key (n tokens), key (n tokens)" — for naming survivors instead of characterising them. */
const listSurvivors = (s: SweepResult) =>
  s.survivors
    .slice()
    .sort((a, b) => b.tokens - a.tokens)
    .map((x) => `${x.key} (${x.tokens} tokens)`)
    .join(", ");

/** Longest verified quote in the run, so "the long ones survive" can be checked. */
const maxVerifiedTokens = verifiedCandidates.reduce((m, c) => Math.max(m, tokenCount(c.quote)), 0);
const medianVerifiedTokens = (() => {
  const ns = verifiedCandidates.map((c) => tokenCount(c.quote)).sort((a, b) => a - b);
  if (ns.length === 0) return 0;
  const mid = Math.floor(ns.length / 2);
  return ns.length % 2 ? ns[mid] : Math.round((ns[mid - 1] + ns[mid]) / 2);
})();

const sweepWholesale = sweep(corruptWholesale);
const sweepMiddle = sweep(corruptMiddleToken);
const sweepNumber = sweep(corruptFirstNumber);

let valueTamperCaught = 0;
for (const c of verifiedCandidates) {
  if (admit(tamperValue(c), HOYT_DOCS).status !== "verified") valueTamperCaught += 1;
}

// The named single control the demo actually leans on: the residence appraisal,
// because that is the number the whole § 13151 / § 13100 decision turns on.
const NAMED_KEY = "asset.residence.value";
const namedCandidate = verifiedCandidates.find((c) => c.key === NAMED_KEY) ?? null;

function namedControl(mutate: (q: string) => string | null) {
  if (!namedCandidate) return null;
  const q = mutate(namedCandidate.quote);
  if (q === null || q === namedCandidate.quote) return null;
  const f = admit({ ...namedCandidate, quote: q }, HOYT_DOCS);
  const w = quoteWarrant(f);
  return {
    quote: q,
    status: f.status,
    verdict: w?.verdict ?? "n/a",
    similarity: w ? round(w.similarity, 3) : 0,
    flipped: f.status !== "verified",
  };
}

// The clean baseline, so the caveats can show the drop rather than assert it.
const namedClean = namedCandidate
  ? round(quoteWarrant(admit(namedCandidate, HOYT_DOCS))?.similarity ?? 0, 3)
  : 0;
const namedTokens = namedCandidate ? tokenCount(namedCandidate.quote) : 0;

const namedNumber = namedControl(corruptFirstNumber);
const namedMiddle = namedControl(corruptMiddleToken);

// ---------------------------------------------------------------------------
// 4. Agreement with the hand-written fixture
// ---------------------------------------------------------------------------

const liveKeys = new Set(liveLedger.keys());
const fixtureKeys = new Set(fixtureLedger.keys());
const sharedKeys = [...fixtureKeys].filter((k) => liveKeys.has(k));
const fixtureOnly = [...fixtureKeys].filter((k) => !liveKeys.has(k));
const liveOnly = [...liveKeys].filter((k) => !fixtureKeys.has(k));
const valueConflicts = sharedKeys.filter((k) => {
  const a = String(fixtureLedger.get(k)?.value ?? "").trim().toLowerCase();
  const b = String(liveLedger.get(k)?.value ?? "").trim().toLowerCase();
  return a !== b;
});

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

const HOW_REPLAY = `admitAll(RECORDED_CANDIDATES, HOYT_DOCS) at module load — the same verify.ts path a live run uses`;

const metrics: Metric[] = [
  // -- the run ------------------------------------------------------------
  {
    id: "run.model",
    label: "Model that produced the recording",
    value: RECORDED.model,
    provenance: measured(`RECORDED.model from src/fixtures/recorded-extraction.json`),
    caveat: `One model, one run, recorded ${RECORDED.recordedAt.slice(0, 10)}. Nothing here is a comparison between models.`,
  },
  {
    id: "run.documents",
    label: "Source documents extracted from",
    value: RECORDED.documents.length,
    provenance: measured("RECORDED.documents.length"),
    caveat: "Synthetic fixture documents authored in this repo — clean machine-set prose, no OCR, no scans, no handwriting.",
  },
  {
    id: "run.document_chars",
    label: "Characters of source text",
    value: docChars,
    unit: "chars",
    provenance: measured("sum of HOYT_DOCS[].content.length"),
    caveat: "A small data room. Real estates arrive with hundreds of pages, and nothing here says how the pipeline scales to them.",
  },
  {
    id: "run.docset_matches_fixture",
    label: "Recorded document names still match the fixture",
    value: docsetMatches ? "yes" : "NO — document set has drifted",
    provenance: measured("sorted RECORDED.documents compared to sorted HOYT_DOCS names"),
    caveat:
      "A name-set comparison, and that is all it is: the recording stores document names and no content hash, so a document whose text was edited after the recording would still pass this row. What partially covers that gap is the quarantine count below — every recorded quote still being locatable is evidence the text has not moved under it.",
  },
  {
    id: "run.proposed",
    label: "Fact candidates the model proposed",
    value: RECORDED_CANDIDATES.length,
    provenance: measured("RECORDED_CANDIDATES.length"),
  },
  {
    id: "run.parse_errors",
    label: "Malformed blocks in the model's output",
    value: RECORDED.errorCount,
    provenance: measured("RECORDED.errorCount, recorded by extract.ts at run time"),
    caveat: "Counts blocks the parser could not read. A block the model never emitted is not an error here — omissions are invisible to this number.",
  },
  {
    id: "run.input_tokens",
    label: "Input tokens",
    value: RECORDED.inputTokens,
    unit: "tok",
    provenance: measured("RECORDED.inputTokens, reported by the provider during the run"),
  },
  {
    id: "run.output_tokens",
    label: "Output tokens",
    value: RECORDED.outputTokens,
    unit: "tok",
    provenance: measured("RECORDED.outputTokens, reported by the provider during the run"),
  },
  ...priceMetrics,

  // -- verification of the run --------------------------------------------
  {
    id: "live.verified",
    label: "Candidates that earned a warrant",
    value: liveIntegrity.verified,
    provenance: measured(HOW_REPLAY),
  },
  {
    id: "live.quarantined",
    label: "Candidates quarantined",
    value: liveIntegrity.quarantined,
    provenance: measured(HOW_REPLAY),
    caveat: "Zero here is a statement about this model on these documents, not about the verifier. See the corruption sweeps below for what the verifier does when there is something to reject.",
  },
  {
    id: "live.integrity",
    label: "Ledger integrity on the recorded run",
    value: pct(liveIntegrity.integrityScore),
    unit: "%",
    provenance: measured(`integrity() over the replayed facts — verified / proposed`),
    caveat:
      "Read the definition, not the number. `integrity()` is the share of proposed facts whose quotation was located — it is not an accuracy, a correctness or a recall figure, and 100% here means the model quoted faithfully, not that it read the sentences right or found everything there was to find. The value-tamper row below is what this percentage cannot see.",
  },
  {
    id: "live.distinct_keys",
    label: "Distinct fact keys admitted",
    value: liveLedger.size,
    provenance: measured("ledger() size after replay — verified facts only, latest per key"),
  },
  {
    id: "live.citations_per_key",
    label: "Verified citations per distinct key",
    value: round(liveIntegrity.verified / Math.max(1, liveLedger.size), 2),
    provenance: derived(["live.verified", "live.distinct_keys"], "live.verified / live.distinct_keys"),
    caveat: `Above 1 because ${multiCited.length} keys carry more than one verified citation (${multiCitedCrossDoc} of them citing more than one document). Independent documents agreeing is corroboration, but ledger() keeps only the last citation per key, so the surplus is discarded rather than cross-checked — nothing here has checked that the corroborating citations agree on the value.`,
  },
  {
    id: "live.contributing_documents",
    label: "Documents that yielded at least one verified fact",
    value: contributingDocs.size,
    provenance: measured("distinct matchedDocument across verified quote warrants after replay"),
  },
  ...(VERIFIED_THRESHOLD !== null
    ? [
        {
          id: "verifier.threshold",
          label: "Accept threshold (n-gram coverage)",
          value: VERIFIED_THRESHOLD,
          provenance: measured("VERIFIED_THRESHOLD parsed out of src/lib/verify.ts with node:fs at module load"),
          caveat: "Not a tuned parameter — no calibration set exists. The corruption sweeps below are what this number costs.",
        } satisfies Metric,
      ]
    : []),

  // -- rejection: the planted fabrication ---------------------------------
  {
    id: "fixture.proposed",
    label: "Hand-written fixture candidates",
    value: fixtureIntegrity.proposed,
    provenance: measured("integrity(admitAll(INITIAL_CANDIDATES, HOYT_DOCS)).proposed"),
  },
  {
    id: "fixture.quarantined",
    label: "Fixture candidates quarantined",
    value: fixtureIntegrity.quarantined,
    provenance: measured("integrity(admitAll(INITIAL_CANDIDATES, HOYT_DOCS)).quarantined"),
    caveat: `Quarantined keys: ${fixtureQuarantined.map((f) => f.key).join(", ") || "none"}.`,
  },
  {
    id: "fixture.integrity",
    label: "Ledger integrity on the fixture",
    value: pct(fixtureIntegrity.integrityScore),
    unit: "%",
    provenance: measured("integrity() over the fixture facts"),
    caveat: "Lower than the live run by exactly the one planted fabrication. A perfect score here would mean the fixture had stopped testing anything.",
  },
  {
    id: "fabrication.verdict",
    label: "Verdict on the fabricated Prudential citation",
    value: fabricatedWarrant?.verdict ?? "not present in fixture",
    provenance: measured(`verdict on the ${FABRICATION_KEY} warrant after admitAll over INITIAL_CANDIDATES`),
  },
  {
    id: "fabrication.similarity",
    label: "Best match for the fabricated quote, anywhere in the data room",
    value: fabricatedWarrant ? round(fabricatedWarrant.similarity, 3) : "n/a",
    provenance: measured("similarity on the fabricated fact's quote warrant"),
    caveat:
      (fabricatedWarrant && fabricatedWarrant.similarity === 0
        ? `Zero, not merely under the threshold: the ${tokenCount(fabricatedWarrant.quote)}-token sentence shares no n-gram window with any of the ${HOYT_DOCS.length} documents.`
        : `Best match across the ${HOYT_DOCS.length} documents.`) +
      " An invented citation is caught with room to spare. An altered one is not, which is the finding two rows down — and the easy case is the one this benchmark is least entitled to be pleased about.",
  },
  {
    id: "fabrication.reaches_ledger",
    label: "Fabricated fact reaches the decision-visible ledger",
    value: fixtureLedger.has(FABRICATION_KEY) ? "YES — invariant broken" : "no",
    provenance: measured(`ledger(admitAll(INITIAL_CANDIDATES, HOYT_DOCS)).has("${FABRICATION_KEY}")`),
    caveat: "This is the invariant that matters. Quarantine is only meaningful if the rules engine cannot read the quarantined fact, and ledger() is the only view the engine gets.",
  },
  ...(fabricationCandidate && typeof fabricationCandidate.value === "number"
    ? [
        {
          id: "fabrication.dollars_withheld",
          label: "Dollars the fabrication would have added to the estate",
          value: fabricationCandidate.value,
          unit: "USD",
          provenance: measured(`value of the ${FABRICATION_KEY} candidate in src/fixtures/hoyt-estate.ts`),
          caveat: "The amount the fixture author planted, not a figure with any real-world meaning. It is here to show the size of what quarantine kept out of the § 13100 sum.",
        } satisfies Metric,
      ]
    : []),

  // -- negative controls ---------------------------------------------------
  {
    id: "negctl.residence.number_swap",
    label: "Control: residence appraisal, first number altered",
    value: namedNumber ? (namedNumber.flipped ? "pass — quarantined" : "FAIL — still verified") : "not runnable",
    provenance: measured(
      `re-admitted the recorded ${NAMED_KEY} candidate with the first digit run rewritten, then read the resulting status`,
    ),
    caveat: namedNumber
      ? `Coverage fell from ${namedClean} to ${namedNumber.similarity} against a ${VERIFIED_THRESHOLD ?? "?"} threshold, so the altered figure was still accepted; verdict "${namedNumber.verdict}". Corrupted quote as re-admitted: ${JSON.stringify(namedNumber.quote)} (${namedTokens} tokens under the verifier's own tokenisation). One rewritten figure at the end of a short quote leaves most of its n-gram windows intact. This is the load-bearing number in the whole demo — it decides § 13151 against formal probate — and quote verification does not protect it.`
      : "The recorded run contains no verified candidate for this key.",
  },
  {
    id: "negctl.residence.middle_token",
    label: "Control: residence appraisal, middle token altered",
    value: namedMiddle ? (namedMiddle.flipped ? "pass — quarantined" : "FAIL — still verified") : "not runnable",
    provenance: measured(
      `re-admitted the recorded ${NAMED_KEY} candidate with the token nearest the middle replaced by a word absent from every document`,
    ),
    caveat: namedMiddle
      ? `Coverage fell from ${namedClean} to ${namedMiddle.similarity}; verdict "${namedMiddle.verdict}". Same quote, same one-token edit as the row above, opposite outcome: the only difference is where in the sentence the edit landed, and a mid-sentence token sits inside more n-gram windows than a trailing one. Detection here is a property of edit position, not of the verifier knowing anything about money.`
      : "The recorded run contains no verified candidate for this key.",
  },
  {
    id: "sweep.wholesale_caught",
    label: "Wholesale rewrite caught",
    value: sweepWholesale.caught,
    provenance: measured(
      `every verified recorded quote rewritten (all digits shifted, head of every 4+ letter word replaced) and re-admitted; count of those that flipped to quarantined`,
    ),
    caveat:
      `Out of ${sweepWholesale.applicable} applicable; ${sweepWholesale.survived} still verified.` +
      (sweepWholesale.survived === 0
        ? ` Every paraphrase in this sweep was rejected — the case the design was built for. One sweep on ${verifiedCandidates.length} quotes is not a guarantee about paraphrase in general.`
        : ` Survivors: ${listSurvivors(sweepWholesale)}.`),
  },
  {
    id: "sweep.middle_token_caught",
    label: "Single middle-token substitution caught",
    value: sweepMiddle.caught,
    provenance: measured(
      `every verified recorded quote re-admitted with the token nearest its middle replaced by "Blackwood"; count that flipped to quarantined`,
    ),
    caveat:
      `Out of ${sweepMiddle.applicable} applicable; ${sweepMiddle.survived} still verified.` +
      (sweepMiddle.survived
        ? ` Survivors: ${listSurvivors(sweepMiddle)} — against a median verified quote of ${medianVerifiedTokens} tokens and a longest of ${maxVerifiedTokens}, so what survives here is length: one broken token is a smaller share of a long quote's n-grams.`
        : ""),
  },
  {
    id: "sweep.number_swap_caught",
    label: "Single number substitution caught",
    value: sweepNumber.caught,
    provenance: measured(
      `every verified recorded quote containing digits re-admitted with its first digit run rewritten; count that flipped to quarantined`,
    ),
    caveat:
      `Out of ${sweepNumber.applicable} applicable (${sweepNumber.skipped} of the ${verifiedCandidates.length} verified quotes contain no digits and were skipped, not counted as passes). ${sweepNumber.survived} altered figures were accepted as verified` +
      (sweepNumber.survived ? `: ${listSurvivors(sweepNumber)}.` : ".") +
      " These are the survivors that matter: an altered figure that still verifies is a wrong number wearing a warrant.",
  },
  {
    id: "sweep.number_swap_applicable",
    label: "Verified quotes that contain a number at all",
    value: sweepNumber.applicable,
    provenance: measured(`count of verified recorded quotes matching /\\d+/, the only ones this mutation can be applied to`),
  },
  {
    id: "sweep.number_swap_rate",
    label: "Number-substitution detection rate",
    value: sweepNumber.applicable === 0 ? 0 : pct(sweepNumber.caught / sweepNumber.applicable),
    unit: "%",
    provenance: derived(
      ["sweep.number_swap_caught", "sweep.number_swap_applicable"],
      "sweep.number_swap_caught / sweep.number_swap_applicable",
    ),
    caveat: "The weakest of the three sweeps, and the one that matters most: in this domain the tokens worth falsifying are the money.",
  },
  {
    id: "sweep.value_tamper_caught",
    label: "Wrong value attached to a genuine quote — caught",
    value: valueTamperCaught,
    provenance: measured(
      `every verified recorded candidate re-admitted with its quote untouched and only its asserted value changed; count that flipped to quarantined`,
    ),
    caveat: `${valueTamperCaught} of ${verifiedCandidates.length}, and this is not a bug — verify.ts compares the quotation to the document and never compares the value to the quotation, so nothing in this path could have caught it. It is the exact boundary of what a green "verified" badge means, and it is measured rather than argued.`,
  },

  // -- agreement with the hand-written fixture -----------------------------
  {
    id: "agreement.shared_keys",
    label: "Keys found by both the model and the fixture author",
    value: sharedKeys.length,
    provenance: measured("intersection of ledger() key sets from the two replays"),
    caveat: "Agreement, not recall. The fixture was hand-written by the same author as the demo and nobody has annotated these documents with the complete set of facts they contain.",
  },
  {
    id: "agreement.fixture_only",
    label: "Keys the fixture has that the model did not produce",
    value: fixtureOnly.length,
    provenance: measured("fixture ledger keys absent from the live ledger"),
    caveat: fixtureOnly.length
      ? `Absent from the live run: ${fixtureOnly.join(", ")}. "Missed" would be the wrong word — the fixture is one author's list, not an adjudicated answer key, so a key only it has could equally be a key it invented.`
      : "None.",
  },
  {
    id: "agreement.live_only",
    label: "Keys the model found that the fixture does not have",
    value: liveOnly.length,
    provenance: measured("live ledger keys absent from the fixture ledger"),
    caveat: liveOnly.length
      ? `Extra: ${liveOnly.join(", ")}. Each is verified against a real document, but "extra" does not mean "useful" — no rule currently reads several of these.`
      : "None.",
  },
  {
    id: "agreement.value_conflicts",
    label: "Shared keys where the two runs disagree on the value",
    value: valueConflicts.length,
    provenance: measured("case-insensitive string comparison of values on the shared keys"),
    caveat: valueConflicts.length
      ? `Conflicts: ${valueConflicts.join(", ")}.`
      : "None — but the comparison is a normalised string equality, so it would not notice two spellings of the same address being materially different.",
  },
];

export const BENCHMARK: Benchmark = {
  id: "extraction",
  title: "Extraction and rejection",
  question:
    "On a recorded real model run, how many proposed facts earn a warrant — and, more importantly, what does verification actually reject when something is wrong?",
  metrics,
  limits: [
    `${HOYT_DOCS.length} synthetic documents authored in this repository, ${docChars.toLocaleString("en-US")} characters in total. They are clean, machine-set prose with no OCR noise, no scans, no handwriting and no adversarial formatting, so nothing here predicts behaviour on a real data room.`,
    "One model, one prompt version, one run, one estate. No variance is measured: re-running, re-prompting or swapping models could produce a different yield and this benchmark would not know.",
    `Verified is not correct. A warrant proves the quoted sentence exists in a document we hold; it says nothing about whether the value attached to it is the right reading of that sentence. The value-tamper sweep measures that gap directly and catches ${valueTamperCaught} of ${verifiedCandidates.length}.`,
    `Not a recall figure. Nobody has annotated these documents with the facts they actually contain, so "${liveIntegrity.verified} verified" cannot be turned into a percentage of what was there. The agreement rows compare the model to a hand-written fixture by the same author, which is not an independent gold standard — and the ledger-integrity percentage is a share of what was proposed, never a share of what was there.`,
    "Rejection is measured on one planted fabrication plus synthetic mutations of real quotes. One caught fabrication is not a false-negative rate, and the mutations are not errors a model was observed making — they bound the verifier's sensitivity, not its field performance.",
    "No false-positive rate. Nothing here measures genuine quotations wrongly quarantined, which is the failure mode that would actually annoy a user: line-wrapping, ligatures, OCR substitutions and PDF hyphenation all attack the same n-gram coverage the sweeps attack.",
    `The corruption sweeps show detection depends on quote length and on where in the sentence the edit falls. That dependency is characterised here on ${verifiedCandidates.length} quotes from one run, one mutation per quote; the shape of the curve is not established, and no mutation combines two edits.`,
    "The document-set guard compares names only. The recording stores no hash of the document text, so this module cannot prove the fixture documents still say what they said when the run was recorded.",
    "Token counts are real and provider-reported; the price used to turn them into dollars is unconfirmed catalog data, so the cost row is assumption-tainted and is not evidence of anything.",
    "Nothing downstream is tested. Whether the rules engine reaches the right legal conclusion from these facts, and whether the fact keys are the right ones to have extracted, are separate questions this module does not touch.",
  ],
};

// `npx vite-node bench/extraction.ts` prints the table. vite-node strips the
// entry path out of process.argv, so there is no reliable is-this-the-entry
// test; a suite that imports this module should set BENCH_QUIET=1.
if (process.env.BENCH_QUIET !== "1") print(BENCHMARK);
