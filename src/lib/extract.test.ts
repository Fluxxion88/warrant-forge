import { describe, expect, it, beforeEach } from "vitest";
import { _resetIds, admitAll } from "./facts";
import {
  buildUserPrompt,
  coerceValue,
  extractAll,
  isRecorded,
  parseFacts,
  record,
  type CompleteFn,
} from "./extract";
import { chooseExtractor, estimateCost } from "./extractRun";
import { modelById } from "./catalog";
import { HOYT_DOCS } from "../fixtures/hoyt-estate";

beforeEach(() => _resetIds());

const APPRAISAL = HOYT_DOCS.find((d) => d.name.startsWith("Appraisal"))!;

/** A model that answers with whatever script the test hands it. */
function scripted(replies: string[]): CompleteFn {
  let i = 0;
  return async () => ({
    text: replies[Math.min(i++, replies.length - 1)],
    inputTokens: 1200,
    outputTokens: 180,
    model: "claude-opus-4-8",
  });
}

describe("prompt construction", () => {
  it("fences the document so its text cannot read as instructions", () => {
    const prompt = buildUserPrompt(APPRAISAL);
    expect(prompt).toContain("<UNTRUSTED_DOCUMENT");
    expect(prompt).toContain("</UNTRUSTED_DOCUMENT>");
    expect(prompt).toContain(APPRAISAL.name);
  });

  it("supplies the fact key conventions", () => {
    const prompt = buildUserPrompt(APPRAISAL);
    expect(prompt).toContain("asset.<id>.value");
    expect(prompt).toContain("decedent.date_of_death");
  });
});

describe("value coercion", () => {
  it("reads numbers, booleans and text", () => {
    expect(coerceValue("740000")).toBe(740_000);
    expect(coerceValue("true")).toBe(true);
    expect(coerceValue("FALSE")).toBe(false);
    expect(coerceValue("San Mateo")).toBe("San Mateo");
    expect(coerceValue("2026-01-04")).toBe("2026-01-04");
  });

  it("tolerates a model that ignores the formatting instruction", () => {
    expect(coerceValue("$740,000")).toBe(740_000);
    expect(coerceValue(" 18,400.00 ")).toBe(18_400);
  });
});

describe("parsing", () => {
  const good = `<<<FACT
key: asset.residence.value
label: Residence
value: 740000
unit: USD
asOf: 2026-01-04
document: Appraisal - 1412 Bayberry Lane.pdf
quote: opinion of market value as of the effective date is $740,000
FACT>>>`;

  it("parses a well-formed block", () => {
    const { candidates, errors } = parseFacts(good, { extractedBy: "test" });
    expect(errors).toEqual([]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      key: "asset.residence.value",
      value: 740_000,
      unit: "USD",
      asOf: "2026-01-04",
      extractedBy: "test",
    });
  });

  it("keeps a multi-line quotation intact", () => {
    const multi = `<<<FACT
key: asset.residence.is_primary_residence
label: Primary residence
value: true
document: Will.pdf
quote: My residence at 1412 Bayberry Lane, San Mateo, California has
been my primary residence continuously since 1978
FACT>>>`;
    const { candidates } = parseFacts(multi);
    expect(candidates[0].quote).toContain("\n");
    expect(candidates[0].quote).toContain("since 1978");
  });

  it("ignores preamble and markdown fences a model might add", () => {
    const noisy = "Here are the facts I found:\n\n```\n" + good + "\n```\nThat is all.";
    const { candidates, errors } = parseFacts(noisy);
    expect(candidates).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  it("recovers every complete block from a truncated response", () => {
    const truncated = good + "\n\n<<<FACT\nkey: asset.checking.value\nlabel: Chec";
    const { candidates, errors } = parseFacts(truncated);
    expect(candidates).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].reason).toMatch(/no value|no usable quotation/);
  });

  it("rejects a block with no quotation rather than admitting it", () => {
    const noQuote = `<<<FACT
key: asset.checking.value
label: Checking
value: 18400
document: Statement.pdf
FACT>>>`;
    const { candidates, errors } = parseFacts(noQuote);
    expect(candidates).toEqual([]);
    expect(errors[0].reason).toMatch(/no usable quotation/);
  });

  it("rejects a malformed fact key", () => {
    const badKey = `<<<FACT
key: The House Value
label: House
value: 1
document: D.pdf
quote: something long enough to pass
FACT>>>`;
    const { errors } = parseFacts(badKey);
    expect(errors[0].reason).toMatch(/not a dotted fact key/);
  });

  it("falls back to the expected document when the model omits it", () => {
    const noDoc = `<<<FACT
key: decedent.full_name
label: Name
value: Margaret Ellen Hoyt
quote: Name of decedent: MARGARET ELLEN HOYT.
FACT>>>`;
    const { candidates } = parseFacts(noDoc, { expectDocument: "Certificate of Death.pdf" });
    expect(candidates[0].document).toBe("Certificate of Death.pdf");
  });

  it("returns nothing for an empty response", () => {
    expect(parseFacts("").candidates).toEqual([]);
    expect(parseFacts("I could not find any facts.").candidates).toEqual([]);
  });
});

describe("orchestration", () => {
  const reply = `<<<FACT
key: asset.residence.value
label: Residence
value: 740000
unit: USD
document: DOC
quote: opinion of market value as of the effective date is $740,000
FACT>>>`;

  it("calls once per document and aggregates", async () => {
    const docs = HOYT_DOCS.slice(0, 3);
    const run = await extractAll(docs, scripted([reply]), { now: () => 0 });
    expect(run.perDocument).toHaveLength(3);
    expect(run.candidates).toHaveLength(3);
    expect(run.inputTokens).toBe(3600);
  });

  it("stamps each candidate with the document it came from", async () => {
    const run = await extractAll([APPRAISAL], scripted([reply]), { now: () => 0 });
    // The scripted reply says "DOC"; the model is trusted for the name it gives,
    // and verification downstream is what catches a wrong one.
    expect(run.candidates[0].document).toBe("DOC");
  });

  it("contains a failed document rather than losing the run", async () => {
    // Match the document *name*, not its content — "Schwab" also appears in
    // the will, which is exactly the kind of over-broad match worth avoiding.
    const target = "Schwab brokerage statement.pdf";
    const flaky: CompleteFn = async ({ user }) =>
      user.includes(`Use exactly "${target}"`)
        ? Promise.reject(new Error("provider 503"))
        : { text: reply, inputTokens: 10, outputTokens: 10, model: "m" };

    const run = await extractAll(HOYT_DOCS, flaky, { now: () => 0 });
    expect(run.failed).toEqual([target]);
    expect(run.candidates.length).toBeGreaterThan(0);
  });

  it("reports progress per document", async () => {
    const seen: string[] = [];
    await extractAll(HOYT_DOCS.slice(0, 2), scripted([reply]), {
      now: () => 0,
      onProgress: (_d, _t, name) => seen.push(name),
    });
    expect(seen).toHaveLength(2);
  });
});

describe("verification is not optional", () => {
  it("quarantines an invented quotation even though it parsed cleanly", async () => {
    const fabricated = `<<<FACT
key: asset.phantom.value
label: Phantom account
value: 50000
document: Appraisal - 1412 Bayberry Lane.pdf
quote: The decedent also held a numbered account in Liechtenstein worth $50,000.
FACT>>>`;
    const run = await extractAll([APPRAISAL], scripted([fabricated]), { now: () => 0 });
    expect(run.candidates).toHaveLength(1);

    const facts = admitAll(run.candidates, [APPRAISAL]);
    expect(facts[0].status).toBe("quarantined");
  });

  it("admits a genuine quotation copied from the source", async () => {
    const genuine = `<<<FACT
key: asset.residence.value
label: Residence
value: 740000
unit: USD
document: ${APPRAISAL.name}
quote: opinion of market value as of the effective date is $740,000
FACT>>>`;
    const run = await extractAll([APPRAISAL], scripted([genuine]), { now: () => 0 });
    const facts = admitAll(run.candidates, [APPRAISAL]);
    expect(facts[0].status).toBe("verified");
  });
});

describe("recording", () => {
  it("freezes a run so a demonstration replays rather than re-calls", async () => {
    const run = await extractAll([APPRAISAL], scripted([
      `<<<FACT
key: asset.residence.value
label: Residence
value: 740000
document: ${APPRAISAL.name}
quote: opinion of market value as of the effective date is $740,000
FACT>>>`,
    ]), { now: () => 0 });

    const rec = record(run, [APPRAISAL]);
    expect(isRecorded(rec)).toBe(true);
    expect(rec.model).toBe("claude-opus-4-8");
    expect(rec.candidates).toHaveLength(1);
    expect(rec.documents).toEqual([APPRAISAL.name]);
    // Round-trips through JSON, which is how it reaches the demo.
    expect(isRecorded(JSON.parse(JSON.stringify(rec)))).toBe(true);
  });

  it("rejects anything that is not a recording", () => {
    expect(isRecorded(null)).toBe(false);
    expect(isRecorded({ version: 2, candidates: [] })).toBe(false);
  });
});

describe("provider selection and pricing", () => {
  it("returns nothing when no provider is connected", () => {
    expect(chooseExtractor([])).toBeNull();
    expect(
      chooseExtractor([
        { id: "a", kind: "anthropic", label: "A", base_url: null, has_key: false, enabled: true },
      ]),
    ).toBeNull();
  });

  it("picks a model from a connected provider", () => {
    const choice = chooseExtractor([
      { id: "a1", kind: "anthropic", label: "Anthropic", base_url: null, has_key: true, enabled: true },
    ]);
    expect(choice).not.toBeNull();
    expect(choice!.providerId).toBe("a1");
    expect(modelById(choice!.model.id)?.provider).toBe("anthropic");
  });

  it("prices a run before it is authorised", () => {
    const model = modelById("claude-opus-4-8")!;
    const est = estimateCost(HOYT_DOCS, model);
    expect(est.tokens).toBeGreaterThan(0);
    expect(est.usd).toBeGreaterThan(0);
    // A data room this size should cost cents, not dollars.
    expect(est.usd).toBeLessThan(1);
  });
});
