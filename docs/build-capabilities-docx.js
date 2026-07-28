const fs = require("fs");
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} = require("docx");

const OUT = "X:\\PROJECTS\\warrant\\docs\\Warrant-Capabilities.docx";

// US Letter, 0.85" margins -> content width 12240 - 2448 = 9792 DXA
const MARGIN = 1224;
const CONTENT = 12240 - MARGIN * 2;

const INK = "12211F";
const SOFT = "4D6462";
const FAINT = "839997";
const ALIX = "2C7A87";
const LINE = "DDE8E8";
const HEADER_BG = "EAF1F2";
const WARN_BG = "FDF3E2";

// ---------------------------------------------------------------- helpers

const p = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 120, line: 276 },
    alignment: opts.align,
    children: [
      new TextRun({
        text,
        size: opts.size ?? 20,
        color: opts.color ?? SOFT,
        bold: opts.bold,
        italics: opts.italics,
        font: opts.font,
      }),
    ],
    ...(opts.border ? { border: opts.border } : {}),
  });

/** Paragraph from an array of {text, bold?, italics?, mono?} runs. */
const rich = (runs, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 120, line: 276 },
    children: runs.map(
      (r) =>
        new TextRun({
          text: r.text,
          size: opts.size ?? 20,
          color: r.color ?? opts.color ?? SOFT,
          bold: r.bold,
          italics: r.italics,
          font: r.mono ? "Consolas" : undefined,
        }),
    ),
  });

const h1 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    children: [new TextRun({ text, size: 30, bold: true, color: INK, font: "Georgia" })],
  });

const h2 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 120 },
    children: [new TextRun({ text, size: 24, bold: true, color: INK, font: "Georgia" })],
  });

const bullet = (text, level = 0) =>
  new Paragraph({
    numbering: { reference: "dots", level },
    spacing: { after: 80, line: 276 },
    children: [new TextRun({ text, size: 20, color: SOFT })],
  });

const cell = (text, opts = {}) =>
  new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    shading: opts.bg
      ? { type: ShadingType.CLEAR, fill: opts.bg, color: "auto" }
      : undefined,
    margins: { top: 90, bottom: 90, left: 120, right: 120 },
    children: [
      new Paragraph({
        spacing: { after: 0, line: 260 },
        children: [
          new TextRun({
            text,
            size: opts.size ?? 18,
            bold: opts.bold,
            color: opts.color ?? (opts.bold ? INK : SOFT),
            font: opts.mono ? "Consolas" : undefined,
          }),
        ],
      }),
    ],
  });

/** rows[0] is the header. widths must sum to CONTENT. */
const table = (widths, rows, opts = {}) =>
  new Table({
    columnWidths: widths,
    width: { size: CONTENT, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: LINE },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: LINE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: LINE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: rows.map(
      (r, i) =>
        new TableRow({
          tableHeader: i === 0,
          children: r.map((text, c) =>
            cell(text, {
              width: widths[c],
              bold: i === 0,
              bg: i === 0 ? HEADER_BG : undefined,
              mono: i > 0 && opts.monoCols?.includes(c),
            }),
          ),
        }),
    ),
  });

/** A quiet callout box. */
const callout = (lines, bg = WARN_BG) =>
  new Table({
    columnWidths: [CONTENT],
    width: { size: CONTENT, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.SINGLE, size: 12, color: ALIX },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: bg, color: "auto" },
            margins: { top: 160, bottom: 160, left: 200, right: 200 },
            children: lines.map(
              (l, i) =>
                new Paragraph({
                  spacing: { after: i === lines.length - 1 ? 0 : 100, line: 276 },
                  children: [
                    new TextRun({
                      text: l.text,
                      size: 19,
                      color: l.color ?? SOFT,
                      bold: l.bold,
                      italics: l.italics,
                    }),
                  ],
                }),
            ),
          }),
        ],
      }),
    ],
  });

const rule = () =>
  new Paragraph({
    spacing: { before: 80, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE } },
    children: [new TextRun({ text: "", size: 2 })],
  });

// ---------------------------------------------------------------- content

const children = [];

// --- Title page
children.push(
  new Paragraph({ spacing: { before: 2600, after: 0 }, children: [new TextRun({ text: "" })] }),
  new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text: "Warrant", size: 72, bold: true, color: INK, font: "Georgia" })],
  }),
  new Paragraph({
    spacing: { after: 320 },
    children: [
      new TextRun({
        text: "Complete capability reference",
        size: 30,
        color: ALIX,
        font: "Georgia",
      }),
    ],
  }),
  p("Estate settlement decision, investigation and filing engine", { size: 22, color: SOFT }),
  p("Built for the Alix “Agents of Administration” hackathon · 27–28 July 2026", {
    size: 20,
    color: FAINT,
    after: 420,
  }),
  callout(
    [
      { text: "Status at time of writing", bold: true, color: INK },
      { text: "153 TypeScript tests · 11 Rust tests · clean build · twelve UI panes." },
      {
        text: "Verified: all three governing thresholds confirmed against Judicial Council form DE-300 [Rev. April 28, 2025].",
      },
      { text: "Not yet done: no live model call, no live Anvil call.", italics: true },
    ],
    HEADER_BG,
  ),
  new Paragraph({ children: [new PageBreak()] }),
);

// --- TOC
children.push(
  h1("Contents"),
  p("Right-click and choose “Update field” in Word to populate page numbers.", {
    size: 17,
    color: FAINT,
    italics: true,
    after: 200,
  }),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  new Paragraph({ children: [new PageBreak()] }),
);

// --- 0. Summary
children.push(
  h1("0. What it is"),
  p(
    "Warrant turns a pile of estate documents into a defensible answer: which probate procedure applies, what it will cost and take, which forms must be filed and where they must go, what assets probably exist that nobody has found, and what must happen before a penny is distributed.",
  ),
  rich([
    { text: "Every fact it uses carries the verbatim sentence that justifies it", bold: true, color: INK },
    { text: ", checked deterministically. Every rule carries its statute, its effective date, and the date we read it. " },
    { text: "No model runs in the decision path.", bold: true, color: INK },
  ]),
  rule(),
);

// --- 1. Index
children.push(
  h1("1. Capability index"),
  table(
    [520, 3400, 3200, 2672],
    [
      ["#", "Capability", "Module", "Status"],
      ["1", "Document ingestion — PDF, DOCX, XLSX, PPTX, text", "src-tauri/src/docs.rs", "Built, 9 Rust tests"],
      ["2", "Deterministic quote verification", "src/lib/verify.ts", "Built, tested"],
      ["3", "Fact ledger with warrants and quarantine", "src/lib/facts.ts", "Built, tested"],
      ["4", "Derivation — exclusions, sums, elapsed time", "src/lib/derive.ts", "Built, tested"],
      ["5", "Rules as data, three-valued evaluation", "src/lib/rules.ts", "Built, tested"],
      ["6", "Gap detection", "src/lib/gaps.ts", "Built, tested"],
      ["7", "Dependency-tracked re-evaluation", "src/lib/reactor.ts", "Built, tested"],
      ["8", "Reversibility × blast-radius approval gate", "src/lib/risk.ts", "Built, tested"],
      ["9", "Lead engine — assets nobody has found yet", "src/lib/leads.ts", "Built, tested"],
      ["10", "Administration task graph", "src/lib/tasks.ts", "Built, tested"],
      ["11", "Statutory deadline engine", "src/lib/tasks.ts", "Built, tested"],
      ["12", "Distribution gate", "src/lib/session.ts", "Built, tested"],
      ["13", "Universal document store", "src/lib/formstore.ts", "Built, tested"],
      ["14", "Dispatch planning", "src/lib/formstore.ts", "Built, tested"],
      ["15", "Form field binding with provenance", "src/lib/anvil.ts", "Built, tested"],
      ["16", "Anvil register / reconcile / fill / sign / retrieve", "src-tauri/src/anvil.rs", "Built, never run live"],
      ["17", "California rule pack", "src/rules/ca-probate.ts", "Built, single-sourced"],
      ["18", "All 58 California counties", "src/rules/ca-counties.ts", "Built, 3 researched"],
      ["19", "Multi-model provider layer", "src-tauri/src/providers.rs", "Inherited, audited"],
      ["20", "Injection fencing, rate limit, spend cap", "safety / limiter / budget", "Inherited, tested"],
      ["21", "LLM extraction", "—", "Stubbed"],
      ["22", "Voice / phone (Track 2)", "—", "Designed, not built"],
    ],
    { monoCols: [2] },
  ),
  rule(),
);

// --- 2. Evidence
children.push(
  h1("2. Evidence layer"),
  h2("2.1 Document ingestion"),
  p("Extracts text from PDF, XLSX/XLSM/XLS, DOCX, PPTX and plain text, in Rust."),
  bullet("Spreadsheets retain sheet and row structure."),
  bullet(
    "Word runs split mid-sentence are rejoined. This is load-bearing: a quote verifier fails against a document whose sentences the extractor shredded.",
  ),
  bullet("Malformed PDFs are contained rather than crashing the run."),
  bullet("Low-yield PDFs are flagged as probable scans rather than imported blank."),
  p(
    "Tested against committed real Office and PDF fixtures, so a Windows checkout that mangles binaries fails loudly.",
    { after: 200 },
  ),

  h2("2.2 Deterministic quote verification"),
  p("Given a claimed quotation and a document set, locates it or proves it absent."),
  bullet("Normalised exact match first, tolerating whitespace and smart quotes."),
  bullet("Then n-gram coverage, so paraphrase degrades smoothly below verbatim."),
  bullet("Returns a character span for click-through to the source."),
  p(
    "Four verdicts: verified (exact, in the cited document), loose (found elsewhere or partial), unsupported (nowhere), no_citation.",
  ),
  callout([
    {
      text: "No model participates. We never ask a second model whether the first was honest, so fabrication is caught with certainty rather than probability.",
      bold: true,
      color: INK,
    },
  ]),
  new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: "" })] }),

  h2("2.3 Fact ledger"),
  p("Every fact carries a warrant, which is one of two things:"),
  bullet(
    "QuoteWarrant — the verbatim sentence a model cited, the verification verdict, the similarity score, and the character span.",
  ),
  bullet("DerivedWarrant — the formula and the fact keys it consumed."),
  p("Facts also carry asOf dates, supersession, and the model that proposed them."),
  rich([
    { text: "Only exact quotation earns " },
    { text: "verified", mono: true, color: INK },
    {
      text: ". A loose match is deliberately not good enough — in a domain where being wrong costs six months, “probably said something like this” is not evidence.",
    },
  ]),
  rich([
    { text: "ledger()", mono: true, color: INK },
    {
      text: " returns verified facts only, so a quarantined fact is structurally unreachable by the rules engine. It stays visible so a reviewer can see exactly what the model tried to assert and on what basis.",
    },
  ]),
  rule(),
);

// --- 3. Reasoning
children.push(
  h1("3. Reasoning layer"),
  h2("3.1 Derivation"),
  p(
    "No model performs arithmetic anywhere in this system. Models extract individually-quoted values; code sums them under a cited rule.",
  ),
  bullet(
    "Statutory exclusions are data: joint tenancy, named beneficiary, funded trust, registered vehicle, passing to a surviving spouse.",
  ),
  bullet(
    "Asset facts follow asset.<id>.value and asset.<id>.<flag>, so a new asset class needs no code change and no migration.",
  ),
  bullet(
    "Elapsed-time facts recompute every run, so a waiting period expiring is itself a change the reactor notices.",
  ),

  h2("3.2 Rules as data"),
  p("A rule is a JSON-serialisable object carrying its predicate, its consequences and its authority."),
  table(
    [2600, 7192],
    [
      ["Field", "Purpose"],
      ["decisionPoint", "Groups rules that compete to answer the same question"],
      ["jurisdiction", "State, and optionally county — county overlays statewide automatically"],
      ["requires", "Facts that must be held before the rule can even be evaluated"],
      ["when", "Predicate tree: all, any, not, {fact, op, value}, exists, missing"],
      ["then", "Conclusion, forms, obligations, timeline, estimated cost"],
      ["authority", "Citation, source URL, effective date, and the date we read it"],
      ["estimates", "Names any figure that is a practice estimate rather than sourced"],
      ["priority", "Resolves competition when several rules fire"],
      ["blastRadius / reversibility", "Drives the human-approval gate"],
    ],
    { monoCols: [0] },
  ),
  callout([
    {
      text: "An uncited number sitting silently beside cited ones is the failure this project exists to prevent, so labelling estimates is mandatory rather than optional.",
      color: INK,
    },
  ]),
  new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: "" })] }),

  h2("3.3 Three-valued evaluation"),
  rich([
    { text: "A predicate over a fact we do not hold evaluates to " },
    { text: "unknown", bold: true, color: INK },
    { text: ", never false. Kleene logic in and / or / not." },
  ]),
  p(
    "A rule whose condition is unknown does not quietly fail to fire. It reports itself blocked and names the fact keys it needed — so gap detection falls out of the same machinery that decides, rather than being a separate feature.",
  ),
  p("Evaluation records every fact key consulted and produces a step-by-step trace rendered in the interface."),

  h2("3.4 Dependency-tracked re-evaluation"),
  p(
    "Diffs two ledgers, intersects changed fact keys with each decision's recorded dependency set, re-runs only the affected decision points, and carries the rest forward unchanged.",
  ),
  p(
    "Emits a Change Report: the fact that moved, the quotation that moved it, the rules that consequently fired, forms added and removed, obligations gained, and the decision points that were provably untouched.",
  ),

  h2("3.5 Approval gate"),
  table(
    [3200, 6592],
    [
      ["Outcome", "Condition"],
      ["auto", "Reversible and not high blast radius — safe to action automatically"],
      ["review", "Irreversible, costly, or high blast radius — a named human signs"],
      ["blocked", "Cannot conclude, or a supporting fact failed verification"],
    ],
    { monoCols: [0] },
  ),
  rule(),
);

// --- 4. Investigation
children.push(
  h1("4. Investigation layer"),
  h2("4.1 The lead engine"),
  p(
    "A fact ledger records what documents say. An investigation reasons about what they imply. A wire to Geneva is not an asset; it is evidence that an account exists which no document in our possession describes.",
  ),
  p("Seventeen lead patterns, each with rationale, priority, and the requests that would confirm or kill it:"),
  table(
    [2400, 7392],
    [
      ["Group", "Patterns"],
      [
        "Tax-derived",
        "Schedule B foreign account · Form 8938 · Form 3520/3520-A · Form 5471 · Form 8865 · Form 8621 · Form 1116 · foreign pension income",
      ],
      ["Banking", "International wire · safe-deposit box · currency exchange"],
      [
        "Life and documents",
        "Foreign passport, address or residency · business interests and K-1s · cryptocurrency · named professionals · employers · unclaimed property",
      ],
    ],
  ),
  p(
    "Each action records who it goes to, the channel, which authority documents it requires (certified Letters, death certificate, Form 56, apostille, certified translation, court order), the form where one exists, and what a response may reveal.",
    { after: 120 },
  ),
  callout([
    {
      text: "Patterns that do not fire are reported dormant rather than discarded, with the fact key that would trigger them. That list is the executor’s defence if a beneficiary later argues something should have been found.",
      color: INK,
    },
  ]),
  new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: "" })] }),

  h2("4.2 Administration task graph"),
  p("Six phases with enforced dependencies — no bank will speak to you before Letters issue."),
  table(
    [2600, 7192],
    [
      ["Phase", "Covers"],
      ["Establish authority", "Petition and Letters, estate EIN, estate account, Form 56"],
      [
        "Secure",
        "Redirect mail for a full annual cycle, secure property and insurance, preserve devices without accessing them, stop recurring charges",
      ],
      ["Investigate", "IRS transcripts, institution-wide bank searches, public records, master ledger"],
      ["Report", "Final personal return, estate return above $600 gross income, international review"],
      ["Creditors", "Notice to known and reasonably ascertainable creditors, claim period"],
      ["Close", "Inventory, reserves, final distribution and discharge"],
    ],
  ),

  h2("4.3 Statutory deadlines"),
  p("Computed from ledger dates, never from the clock — the as-of date is a parameter, so runs are reproducible."),
  table(
    [3000, 3400, 3392],
    [
      ["Deadline", "Period", "Authority"],
      ["Lodge the will", "30 days from death", "Prob. Code § 8200"],
      ["Inventory and Appraisal", "4 months from Letters", "Prob. Code § 8800"],
      ["Creditor claims", "Later of 4 months from Letters or 60 days from notice", "Prob. Code § 9100"],
      ["First publication", "At least 15 days before hearing", "Prob. Code § 8121"],
      ["Mailed notice", "At least 15 days before hearing", "Prob. Code § 8110"],
      ["Federal estate tax", "9 months from death", "IRC § 6075(a)"],
      ["FBAR", "Where foreign aggregate exceeded $10,000", "31 CFR 1010.350"],
    ],
  ),
  callout([
    {
      text: "A deadline whose anchor is missing reports unknown, never “today”. A missed statutory deadline is exactly the irreversible harm this system exists to prevent.",
      color: INK,
    },
  ]),
  new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: "" })] }),

  h2("4.4 Distribution gate"),
  p("Distribution is the one irreversible act in an estate. It is held by any of:"),
  bullet("An open critical lead — assets may exist that no document describes."),
  bullet("An unclosed creditor claim period."),
  bullet("Facts still required by a pending decision."),
  rule(),
);

// --- 5. Filing
children.push(
  h1("5. Filing layer"),
  h2("5.1 Universal document store"),
  callout([
    {
      text: "The identifier printed on a PDF is not unique. DE-111 means something only within the California Judicial Council; PRO 010 exists only in Los Angeles; almost every brokerage prints its own Affidavit of Domicile.",
      color: INK,
    },
  ]),
  new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: "" })] }),
  p("A record is keyed on issuer, jurisdiction and revision, and carries:"),
  bullet("Parties — preparer, signer, notary, witness, recipient, each optionally bound to a fact key."),
  bullet("Signature placement — type, page number, and rectangle in PDF points."),
  bullet("Delivery — accepted channels, named recipient, operator notes."),
  bullet("Flags — requires notary, requires wet original."),
  bullet("Provenance — source URL and retrieval date."),
  p(
    "Five issuer kinds: Judicial Council, county court, state agency, federal agency, financial institution.",
  ),
  rich([
    { text: "resolveForm", mono: true, color: INK },
    {
      text: " returns ambiguity rather than guessing. Asking for “Affidavit of Domicile” without naming the institution yields both issuers and a reason; asking for PRO 010 in San Mateo yields nothing and explains why. A wrong confident answer here is a returned filing and another round trip for a grieving family.",
    },
  ]),

  h2("5.2 Dispatch planning"),
  p(
    "A filled PDF on a disk has settled nothing. Dispatch chooses a channel from those the recipient accepts, preferring cheapest and fastest — but two things override preference:",
  ),
  bullet(
    "A form requiring a wet original or notarisation cannot go electronically regardless of what the recipient accepts.",
  ),
  bullet(
    "An institution requiring a telephone call first must be called first. Chase’s first step for a decedent account is a call, not paperwork; posting before that call usually gets it returned.",
  ),

  h2("5.3 Field binding"),
  p(
    "Bindings carry the item number on the printed form, so a reviewer holding the paper can check the mapping. Formats: text, USD, date, yes/no.",
  ),
  rich([
    { text: "buildFill", mono: true, color: INK },
    {
      text: " reads only the verified ledger. A quarantined fact cannot reach a filed document — there is a test asserting the fabricated policy never appears in a payload. A field with no supporting fact is left empty and reported with the specific fact needed and where to obtain it.",
    },
  ]),

  h2("5.4 Anvil integration"),
  table(
    [2000, 7792],
    [
      ["Operation", "Mechanism"],
      [
        "Register",
        "createCast with aliasIds set to our own binding aliases, so Anvil’s field detection maps straight onto them. Auto-publishes, since an unpublished cast cannot be filled.",
      ],
      ["Reconcile", "cast query returns fieldInfo; bindings are compared in both directions."],
      ["Fill", "POST /api/v1/fill/{castEid}.pdf, response written as binary."],
      [
        "Sign",
        "createEtchPacket with a castEid reference and the same field-keyed payload as fill; embedded signer via generateEtchSignURL.",
      ],
      ["Retrieve", "Document-group zip download."],
    ],
  ),
  callout([
    { text: "Why reconciliation exists", bold: true, color: INK },
    {
      text: "The fill endpoint fails silently. A value written to an alias the template does not have is dropped, and you get back a PDF that looks fine with an empty box in the middle of it. On a probate petition that is a rejected filing and another month gone. Reconciliation makes drift visible before anyone files.",
    },
  ]),
  rule(),
);

// --- 6. Jurisdiction
children.push(
  h1("6. Jurisdiction layer"),
  h2("6.1 California statewide"),
  p("Thresholds for deaths on or after 1 April 2025, each cited:"),
  table(
    [3800, 2000, 3992],
    [
      ["Procedure", "Cap", "Authority"],
      ["§ 13100 small estate affidavit", "$208,850", "Prob. Code §§ 13100, 13101"],
      ["§ 13151 primary residence petition (DE-310)", "$750,000", "AB 2016, Stats. 2024 ch. 331"],
      ["§ 13200 real property of small value (DE-305)", "$69,625", "Prob. Code § 13200"],
      ["Waiting period — §§ 13100, 13151", "40 days", "Prob. Code § 13100"],
      ["Waiting period — § 13200", "6 months", "Prob. Code § 13200"],
    ],
  ),
  p(
    "Routes modelled: § 13100 affidavit, § 13151 primary-residence petition, § 13200 affidavit, spousal property petition (no dollar limit), formal probate, DMV vehicle transfer.",
  ),
  callout([
    { text: "The interaction that matters", bold: true, color: INK },
    {
      text: "§ 13100 excludes “any property included in a petition filed under Section 13151”. While the residence qualifies under § 13151 it stays out of the § 13100 sum; cross $750,000 and it loses eligibility and falls back into the computation, closing both economical routes at once.",
    },
  ]),
  new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: "" })] }),

  h2("6.2 All 58 counties"),
  p("Two kinds of county knowledge, deliberately distinguished:"),
  bullet(
    "Filing fees are known for every county from one authority. The Judicial Council schedule states asterisked fees vary “only in the counties of Riverside, San Bernardino, and San Francisco” — an exhaustive negative statement. Riverside and San Francisco charge $450; the other 56 charge $435.",
  ),
  bullet(
    "Local rules are not. Los Angeles, San Francisco and San Mateo were read against their published text. The other 55 generate a rule that says they are unverified rather than implying no local requirements exist.",
  ),
  p(
    "Researched counties carry local forms (PRO 010, PR-5, PR-13), e-filing exclusions, examiner and tentative-ruling practice, and stale-data warnings — including that lacourt.ca.gov still serves the superseded 2022 chapter 4 while the operative version lives on a different host.",
  ),
  p(
    "Switching county re-decides the estate with no fact re-extracted, because everything is a pure function of the facts.",
  ),
  rule(),
);

// --- 7. Infrastructure
children.push(
  h1("7. Infrastructure"),
  bullet(
    "Multi-model provider layer — Anthropic, OpenAI, Google, DeepSeek, Moonshot, any OpenAI-compatible endpoint. Model IDs and prices are data. Keys live in Rust; the frontend sees has_key only.",
  ),
  bullet(
    "Injection fencing — third-party documents are fenced as untrusted with forged delimiters neutralised before any model sees them.",
  ),
  bullet(
    "Rate limiting and hard spend cap — per-provider concurrency, exponential backoff with jitter, immediate failure on a bad key, and a USD ceiling that aborts a run.",
  ),
  bullet(
    "Context budgeting — token-aware document selection; documents that do not fit are named in the prompt rather than silently dropped.",
  ),
  p(
    "Interface: twelve panes — Estate, Data room, Fact ledger, Investigation, Decisions, Forms, Document store, Anvil, Administration, Jurisdiction, Change log. The whole demo runs with no network call, so it cannot fail on venue wifi.",
  ),
  rule(),
);

// --- 8. Limitations
children.push(
  h1("8. Honest limitations"),
  p("Stated plainly, because a limitation volunteered is a strength and one extracted is a wound.", {
    italics: true,
    color: FAINT,
  }),
  bullet(
    "No live model call has ever been made from this codebase or its parent. Extraction is stubbed with hand-written candidates in the identical FactCandidate shape.",
  ),
  bullet(
    "No live Anvil call has ever been made. The createCast file encoding and the exact etch input types are the least certain parts.",
  ),
  bullet(
    "Resolved: the governing thresholds are confirmed against form DE-300 [Rev. April 28, 2025] — § 13100 at $208,850, § 13151 at $750,000, § 13200 at $69,625, for deaths on or after 1 April 2025, next adjusted 1 April 2028. The prior figures in the form’s left column, $184,500 and $61,500, are the ones still circulating widely online.",
  ),
  bullet("55 of 58 counties have unread local rules. Flagged, not defaulted."),
  bullet("Heggstad / § 850 is not modelled — the actual remedy for an unfunded trust."),
  bullet("Liabilities are not in the ledger. Assets only; creditor work exists as tasks."),
  bullet("No foreign jurisdiction rule pack. Ancillary probate and resealing appear as lead actions, not rules."),
  bullet("No entity resolution. Whether two references describe the same account is unanswered."),
  bullet("The investigation log is derived, not persisted — recomputed per run rather than append-only."),
  bullet("Track 2 (voice) is designed, not built."),
  bullet(
    "Verification proves a quote exists, not that the conclusion follows. It eliminates fabricated evidence, not bad reasoning from real evidence.",
  ),
  bullet(
    "This is not legal advice. It is analysis support a human owns, reviews and signs — which is Alix’s own product stance.",
  ),
);

// ---------------------------------------------------------------- document

const doc = new Document({
  creator: "Warrant",
  title: "Warrant — Complete capability reference",
  description: "Estate settlement decision, investigation and filing engine",
  numbering: {
    config: [
      {
        reference: "dots",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 360, hanging: 200 } } },
          },
          {
            level: 1,
            format: LevelFormat.BULLET,
            text: "◦",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 200 } } },
          },
        ],
      },
    ],
  },
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 20, color: SOFT } },
    },
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "Warrant · capability reference · ", size: 16, color: FAINT }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: FAINT }),
              ],
            }),
          ],
        }),
      },
      children,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("wrote", OUT, buf.length, "bytes");
});
