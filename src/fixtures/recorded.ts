// A real extraction run, frozen.
//
// `recorded-extraction.json` was produced by running the live extraction path
// against the nine fixture documents on 2026-07-28. It is committed so the
// demonstration replays a genuine model run rather than making an API call on
// stage — a live call inside a three-minute slot is a coin flip on someone
// else's network, and the honest framing is stronger anyway: these are the
// facts a real model proposed, and this is what verification did with them.
//
// The candidates are stored exactly as the model emitted them, quotations
// included. They still go through `admitAll` like anything else, so replaying
// the recording exercises the same verification path a live run would.

import raw from "./recorded-extraction.json";
import { isRecorded, type RecordedExtraction } from "../lib/extract";
import type { FactCandidate } from "../lib/facts";

const parsed = raw as unknown;
if (!isRecorded(parsed)) {
  throw new Error("recorded-extraction.json is not a valid recording");
}

export const RECORDED: RecordedExtraction = parsed;

export const RECORDED_CANDIDATES: FactCandidate[] = RECORDED.candidates;

export const RECORDED_SUMMARY = {
  model: RECORDED.model,
  recordedAt: RECORDED.recordedAt,
  documents: RECORDED.documents.length,
  candidates: RECORDED.candidates.length,
  parseErrors: RECORDED.errorCount,
  inputTokens: RECORDED.inputTokens,
  outputTokens: RECORDED.outputTokens,
};
