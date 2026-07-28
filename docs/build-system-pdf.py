# -*- coding: utf-8 -*-
"""Generate the complete Warrant system reference as a PDF."""

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

OUT = r"X:\PROJECTS\warrant\docs\Warrant-System-Reference.pdf"

# ---------------------------------------------------------------- palette
INK = colors.HexColor("#12211F")
SOFT = colors.HexColor("#3F5654")
FAINT = colors.HexColor("#7A908E")
ALIX = colors.HexColor("#2C7A87")
ALIX_LT = colors.HexColor("#A0D8E0")
LINE = colors.HexColor("#DDE8E8")
BAND = colors.HexColor("#EDF4F4")
VERIFIED = colors.HexColor("#1C7A5E")
VERIFIED_BG = colors.HexColor("#E9F5F0")
REJECT = colors.HexColor("#B0432E")
REJECT_BG = colors.HexColor("#FBECE8")
WARN = colors.HexColor("#8F6118")
WARN_BG = colors.HexColor("#FDF4E4")

PW, PH = LETTER
MARGIN = 0.85 * inch
CW = PW - 2 * MARGIN

SERIF = "Times-Roman"
SERIF_B = "Times-Bold"
SANS = "Helvetica"
SANS_B = "Helvetica-Bold"
SANS_I = "Helvetica-Oblique"
MONO = "Courier"


def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ---------------------------------------------------------------- styles
ss = getSampleStyleSheet()

S = {
    "title": ParagraphStyle("title", fontName=SERIF_B, fontSize=40, leading=44, textColor=INK, spaceAfter=6),
    "subtitle": ParagraphStyle("subtitle", fontName=SERIF, fontSize=17, leading=22, textColor=ALIX, spaceAfter=18),
    "covermeta": ParagraphStyle("covermeta", fontName=SANS, fontSize=10, leading=15, textColor=SOFT),
    "H1": ParagraphStyle("H1", fontName=SERIF_B, fontSize=19, leading=23, textColor=INK,
                         spaceBefore=20, spaceAfter=9),
    "H2": ParagraphStyle("H2", fontName=SANS_B, fontSize=11.5, leading=15, textColor=ALIX,
                         spaceBefore=14, spaceAfter=5),
    "H3": ParagraphStyle("H3", fontName=SANS_B, fontSize=9.6, leading=13, textColor=INK,
                         spaceBefore=9, spaceAfter=3),
    "body": ParagraphStyle("body", fontName=SANS, fontSize=9.2, leading=13.6, textColor=SOFT,
                           spaceAfter=6, alignment=TA_JUSTIFY),
    "lede": ParagraphStyle("lede", fontName=SANS, fontSize=10, leading=15, textColor=SOFT, spaceAfter=8),
    "bullet": ParagraphStyle("bullet", fontName=SANS, fontSize=9.2, leading=13.4, textColor=SOFT,
                             leftIndent=14, bulletIndent=3, spaceAfter=3.5),
    "quote": ParagraphStyle("quote", fontName="Times-Italic", fontSize=10.4, leading=15, textColor=INK,
                            leftIndent=16, rightIndent=10, spaceBefore=5, spaceAfter=7),
    "attrib": ParagraphStyle("attrib", fontName=SANS, fontSize=8, leading=11, textColor=FAINT,
                             leftIndent=16, spaceAfter=9),
    "cell": ParagraphStyle("cell", fontName=SANS, fontSize=8.1, leading=11.2, textColor=SOFT),
    "cellb": ParagraphStyle("cellb", fontName=SANS_B, fontSize=8.1, leading=11.2, textColor=INK),
    "cellm": ParagraphStyle("cellm", fontName=MONO, fontSize=7.4, leading=10.6, textColor=SOFT),
    "code": ParagraphStyle("code", fontName=MONO, fontSize=7.4, leading=10.4, textColor=INK,
                           leftIndent=8, spaceBefore=4, spaceAfter=7),
    "callout": ParagraphStyle("callout", fontName=SANS, fontSize=9, leading=13.2, textColor=INK, spaceAfter=4),
    "calloutb": ParagraphStyle("calloutb", fontName=SANS_B, fontSize=9, leading=13.2, textColor=INK, spaceAfter=3),
    "toc1": ParagraphStyle("toc1", fontName=SANS_B, fontSize=9.6, leading=17, textColor=INK),
    "toc2": ParagraphStyle("toc2", fontName=SANS, fontSize=9, leading=14, textColor=SOFT, leftIndent=16),
    "foot": ParagraphStyle("foot", fontName=SANS, fontSize=7.4, textColor=FAINT, alignment=TA_CENTER),
}


def P(t, s="body"):
    return Paragraph(t, S[s])


def B(t):
    return Paragraph(t, S["bullet"], bulletText="•")


def H1(t):
    return Paragraph(esc(t), S["H1"])


def H2(t):
    return Paragraph(esc(t), S["H2"])


def H3(t):
    return Paragraph(esc(t), S["H3"])


def quote(text, who):
    return KeepTogether([Paragraph("“" + esc(text) + "”", S["quote"]),
                         Paragraph("— " + esc(who), S["attrib"])])


def callout(lines, tone="alix"):
    bg = {"alix": BAND, "warn": WARN_BG, "reject": REJECT_BG, "ok": VERIFIED_BG}[tone]
    bar = {"alix": ALIX, "warn": WARN, "reject": REJECT, "ok": VERIFIED}[tone]
    flow = []
    for i, (kind, txt) in enumerate(lines):
        flow.append(Paragraph(txt, S["calloutb"] if kind == "b" else S["callout"]))
    t = Table([[flow]], colWidths=[CW])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LINEBEFORE", (0, 0), (0, -1), 2.2, bar),
        ("LEFTPADDING", (0, 0), (-1, -1), 11),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return KeepTogether([t, Spacer(1, 9)])


def table(rows, widths, mono_cols=(), align_right=()):
    data = []
    for r, row in enumerate(rows):
        out = []
        for c, val in enumerate(row):
            if r == 0:
                st = S["cellb"]
            elif c in mono_cols:
                st = S["cellm"]
            else:
                st = S["cell"]
            out.append(Paragraph(val if isinstance(val, str) else str(val), st))
        data.append(out)
    t = Table(data, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), BAND),
        ("LINEBELOW", (0, 0), (-1, 0), 0.7, LINE),
        ("LINEBELOW", (0, 1), (-1, -2), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
    ]
    for c in align_right:
        style.append(("ALIGN", (c, 0), (c, -1), "RIGHT"))
    t.setStyle(TableStyle(style))
    return KeepTogether([t, Spacer(1, 10)])


def code(text):
    t = Table([[Preformatted(text, S["code"])]], colWidths=[CW])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F5F8F8")),
        ("BOX", (0, 0), (-1, -1), 0.4, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return KeepTogether([t, Spacer(1, 8)])


# ---------------------------------------------------------------- template
class Doc(BaseDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph):
            name = flowable.style.name
            if name == "H1":
                self.notify("TOCEntry", (0, flowable.getPlainText(), self.page))
            elif name == "H2":
                self.notify("TOCEntry", (1, flowable.getPlainText(), self.page))


def cover_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(ALIX)
    canvas.rect(0, PH - 0.34 * inch, PW, 0.34 * inch, stroke=0, fill=1)
    canvas.setFillColor(ALIX_LT)
    canvas.rect(0, PH - 0.40 * inch, PW, 0.06 * inch, stroke=0, fill=1)
    canvas.restoreState()


def body_page(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.4)
    canvas.line(MARGIN, PH - MARGIN + 14, PW - MARGIN, PH - MARGIN + 14)
    canvas.setFont(SANS, 7.4)
    canvas.setFillColor(FAINT)
    canvas.drawString(MARGIN, PH - MARGIN + 20, "Warrant — system reference")
    canvas.drawRightString(PW - MARGIN, PH - MARGIN + 20, "Estate settlement engine")
    canvas.line(MARGIN, MARGIN - 16, PW - MARGIN, MARGIN - 16)
    canvas.drawCentredString(PW / 2.0, MARGIN - 28, str(canvas.getPageNumber()))
    canvas.restoreState()


frame = Frame(MARGIN, MARGIN, CW, PH - 2 * MARGIN, id="f", leftPadding=0, rightPadding=0,
              topPadding=0, bottomPadding=0)

doc = Doc(OUT, pagesize=LETTER, leftMargin=MARGIN, rightMargin=MARGIN,
          topMargin=MARGIN, bottomMargin=MARGIN,
          title="Warrant — system reference",
          author="Warrant", subject="Estate settlement decision, investigation and filing engine")
doc.addPageTemplates([
    PageTemplate(id="cover", frames=[frame], onPage=cover_page),
    PageTemplate(id="body", frames=[frame], onPage=body_page),
])

story = []
A = story.append

# ================================================================= COVER
A(Spacer(1, 2.3 * inch))
A(Paragraph("Warrant", S["title"]))
A(Paragraph("Complete system reference", S["subtitle"]))
A(Spacer(1, 6))
A(Paragraph("An estate settlement decision, investigation and filing engine in which "
            "every fact carries the sentence that justifies it, every rule carries its "
            "statute, and no model runs in the decision path.", S["lede"]))
A(Spacer(1, 26))
A(callout([
    ("b", "Build state"),
    ("n", "171 TypeScript tests · 11 Rust tests · clean production build · thirteen interface panes"),
    ("n", "<font color='#1C7A5E'><b>Verified:</b></font> all three governing California thresholds confirmed "
          "against Judicial Council form DE-300 [Rev. April 28, 2025]"),
    ("n", "<font color='#B0432E'><b>Not yet done:</b></font> no live model call, no live Anvil call, "
          "extraction stubbed, 55 of 58 counties unresearched"),
], "alix"))
A(Spacer(1, 20))
A(Paragraph("Built for the Alix “Agents of Administration” hackathon<br/>"
            "Track 1 — Rules as Data, with a Track 3 integration<br/>"
            "San Francisco · 27–28 July 2026", S["covermeta"]))
A(NextPageTemplate("body"))
A(PageBreak())

# ================================================================= TOC
toc = TableOfContents()
toc.levelStyles = [S["toc1"], S["toc2"]]
A(Paragraph("Contents", S["H1"]))
A(Spacer(1, 4))
A(toc)
A(PageBreak())

# ================================================================= 1
A(H1("1. The problem"))
A(P("An executor is handed the largest administrative job of their life at the worst possible "
    "moment. They must work out which of six California probate procedures applies, assemble a "
    "complete picture of what the deceased owned across institutions that will not talk to them "
    "without a court order, file the right forms with the right county in the right sequence, and "
    "avoid distributing a penny before it is safe to do so. Most people do it once, badly, while "
    "holding down a job."))
A(P("Alix exists to do that work for ordinary families at a price ordinary families can pay, by "
    "replacing the twelve-person private-bank back office with agents. The obstacle is not "
    "capability. A model can read a bank statement. The obstacle is <b>trust</b>: an estate "
    "decision that is wrong costs the family six months, and no settlement specialist will hand "
    "work to a system that cannot show where its answer came from."))

A(H2("1.1 What the mentors actually said"))
A(quote("Assume the LLM will be wrong one out of ten times. How do you build a system around "
        "assuming it's going to be wrong?", "Soren, Rules as Data track"))
A(quote("Dear LLM, when you make a claim, you have to give me the verbatim quote. And then I have "
        "a deterministic system actually go in, check the transcript, and say, I need that exact "
        "quote to be in there. And if it's not, then I can't trust this claim.", "Soren"))
A(quote("Tomorrow, if your system told me that I have to go through formal probate, you need to "
        "track me every decision that was made. You need to tell me where you got your legal "
        "information.", "Soren"))
A(quote("The two things I always think about are: how reversible is it, and what's the blast "
        "radius? If I'm telling you that you should email your client, I don't care if the LLM is "
        "wrong. If I'm telling you that you need to file this formal probate form and you're "
        "wrong, it's another six months.", "Soren"))
A(quote("A fun problem is, how do you know what you don't have? The transcript mentioned the car. "
        "But I don't know the value of the car. I don't know the license plate.", "Soren"))
A(quote("There are three thousand counties in America. Each county has their own rules for "
        "probate. You can't just have a Python file for each.", "Soren"))
A(quote("We need a universal document store that captures all the relevant details that make it "
        "unique — not just the form ID that's written on the PDF, but where did it come from, "
        "who are the relevant parties, what the jurisdiction is.", "Ian, Paperwork Killed track"))
A(quote("If someone has to go in and every week write a weekly email to someone, that's a lot of "
        "work. If I can AI generate the email, all I do as a specialist is review that email and "
        "send it.", "Hugh, Alix"))
A(quote("Even the best constructed trust inevitably leaves things dangling.", "Hugh"))
A(P("Every one of those statements is answered by a named component in this system. Section 3 maps "
    "them one to one."))

A(H2("1.2 The one number that proves the point"))
A(P("California's small-estate thresholds moved on 1 April 2025 under AB 2016. The previous "
    "figures — $184,500 and $61,500 — remain on a great many web pages, including some of "
    "California's own self-help material. Every language model's training data contains them."))
A(callout([
    ("b", "A council of five models would have agreed, confidently, and been wrong."),
    ("n", "This is why debate cannot substitute for source verification. On the single most "
          "important number in the system, consensus reproduces the error. Only fetching the "
          "Judicial Council's own form settles it — which is what was done, and the correct "
          "figures are $208,850 and $69,625, with the primary-residence cap at $750,000."),
], "reject"))
A(PageBreak())

# ================================================================= 2
A(H1("2. Architecture"))
A(P("Two rules govern the entire design. Everything else is consequence."))
A(callout([
    ("b", "1. Models propose, code decides."),
    ("n", "No LLM call sits anywhere in the decision path. Models turn prose into candidate facts. "
          "Deterministic code does the arithmetic, applies the rules, and produces the answer."),
    ("b", "2. Nothing enters a decision without a warrant."),
    ("n", "A fact needs either a verbatim quotation located in a source document, or a derivation "
          "naming the facts it came from. There is no third option."),
], "alix"))

A(H2("2.1 Data flow"))
A(code("""  documents          models              deterministic core                output
  ---------          ------              ------------------                ------

  PDF / DOCX  --+
  XLSX / PPTX   |   +------------+   +---------------------------+
  transcripts --+-->| extraction |-->|  verify.ts                |
  scans         |   | (proposes  |   |  quote must exist in the  |
                |   |  facts +   |   |  cited source document    |
  docs.rs ------+   |  quotes)   |   +------------+--------------+
  (Rust)            +------------+       pass     |    fail
                                          v       |      v
                                  +---------------+  +--------------+
                                  | fact ledger   |  | quarantine   |
                                  | facts.ts      |  | visible but  |
                                  +-------+-------+  | unusable     |
                                          |          +--------------+
                                          v
                              +-----------------------+
                              | derive.ts             |  exclusions, sums,
                              | ca-probate.ts         |  elapsed days
                              +-----------+-----------+
                                          v
                              +-----------------------+
                              | rules.ts              |  three-valued
                              | NO MODEL RUNS HERE    |  evaluation
                              +-----------+-----------+
                                          |
        +-----------+--------------+------+------+--------------+-----------+
        v           v              v             v              v           v
   +--------+  +---------+  +-----------+  +----------+  +-----------+  +--------+
   | gaps   |  | risk    |  | leads     |  | tasks    |  | formstore |  | anvil  |
   | what's |  | approval|  | what is   |  | + dead-  |  | + dispatch|  | fill / |
   | missing|  | gate    |  | not found |  | lines    |  |           |  | sign   |
   +--------+  +---------+  +-----------+  +----------+  +-----------+  +--------+
                                          |
                                          v
                              +-----------------------+
                              | reactor.ts            |  when a fact moves,
                              | change propagation    |  re-decide only what
                              +-----------------------+  depended on it"""))

A(H2("2.2 Technology"))
A(table([
    ["Layer", "Choice", "Why"],
    ["Shell", "Tauri 2", "Desktop app; secrets stay in a Rust process the renderer cannot read"],
    ["Engine", "TypeScript, pure functions", "The decision layer is testable offline with no network and no keys"],
    ["Ingestion", "Rust — pdf-extract, calamine, quick-xml", "Binary parsing where it belongs, with real fixtures under test"],
    ["Interface", "React 19, Tailwind 4", "Thirteen panes, all reading precomputed state"],
    ["Forms", "Anvil REST + GraphQL", "Register, reconcile, fill, sign, retrieve"],
    ["Models", "Five providers, IDs as data", "Vendors rename models constantly; a rename is a config edit"],
], [0.9 * inch, 2.1 * inch, CW - 3.0 * inch]))
A(P("The engine is deliberately independent of the shell. Every module below is a pure function "
    "over facts, which is why the whole demonstration runs with no network call and cannot fail on "
    "a venue's wireless."))
A(PageBreak())

# ================================================================= 3
A(H1("3. Answering the brief, point by point"))
A(table([
    ["What was asked for", "Component", "Section"],
    ["Assume the model is wrong 10% of the time", "Fact ledger + quarantine", "4.3"],
    ["Verbatim quote, checked deterministically", "verify.ts", "4.2"],
    ["Track every decision and where the law came from", "Authority on every rule; evaluation trace", "5.2"],
    ["Reversibility and blast radius", "risk.ts approval gate", "5.6"],
    ["How do you know what you don't have?", "Three-valued logic; gaps.ts; leads.ts", "5.3, 6.1"],
    ["How do you determine when this runs?", "reactor.ts dependency tracking", "5.5"],
    ["3,000 counties, no Python file per county", "Rules as data; county registry", "5.2, 8.2"],
    ["Universal document store", "formstore.ts composite identity", "7.1"],
    ["Map our data onto the PDF", "anvil.ts field bindings", "7.3"],
    ["Signature at spot X and Y", "SignatureField rects in PDF points", "7.1"],
    ["Dispatch — email, fax, post, print", "planDispatch", "7.2"],
    ["Generate the weekly email; specialist reviews", "correspondence.ts", "9.1"],
    ["Is this account the one from the will?", "entities.ts", "9.2"],
    ["Take hours out of the system", "effort.ts, measured honestly", "9.3"],
], [2.35 * inch, 2.5 * inch, CW - 4.85 * inch]))
A(PageBreak())

# ================================================================= 4
A(H1("4. Evidence layer"))

A(H2("4.1 Document ingestion"))
A(P("Rust module <font face='Courier'>docs.rs</font>. Extracts text from PDF, XLSX, XLSM, XLS, "
    "DOCX, PPTX and plain text."))
A(B("Spreadsheets retain sheet and row structure rather than collapsing to a blob."))
A(B("Word runs split mid-sentence are rejoined. This is load-bearing rather than cosmetic: a quote "
    "verifier fails against a document whose sentences the extractor shredded, so extraction "
    "quality directly determines how much evidence survives."))
A(B("Malformed PDFs are contained rather than crashing the run."))
A(B("Low-yield PDFs are flagged as probable scans rather than imported blank, so a scanned "
    "document is a known gap instead of a silently empty one."))
A(P("Tested against committed real Office and PDF fixtures, so a checkout that mangles binaries "
    "fails loudly rather than at demonstration time."))

A(H2("4.2 Deterministic quote verification"))
A(P("Module <font face='Courier'>verify.ts</font>. Given a claimed quotation and a document set, "
    "locates it or proves it absent."))
A(B("Normalised exact match first, tolerating whitespace differences and smart quotes."))
A(B("Then n-gram coverage, so paraphrase degrades smoothly below verbatim instead of passing or "
    "failing on a knife edge."))
A(B("Returns a character span, so the interface can open the source and highlight the sentence."))
A(table([
    ["Verdict", "Meaning", "Admitted?"],
    ["verified", "Exact quotation located in the cited document", "Yes"],
    ["loose", "Found in a different document, or only partially matched", "No"],
    ["unsupported", "Does not appear anywhere in the data room", "No"],
    ["no_citation", "The model supplied no usable quotation", "No"],
], [1.1 * inch, CW - 2.1 * inch, 1.0 * inch], mono_cols=(0,)))
A(callout([
    ("b", "No model participates in verification."),
    ("n", "We never ask a second model whether the first was honest. The check is string matching "
          "against the source, so fabrication is caught with certainty rather than probability. "
          "This is the single most important design decision in the system, and it is the one "
          "Soren named as the crux of his track."),
], "ok"))

A(H2("4.3 The fact ledger"))
A(P("Module <font face='Courier'>facts.ts</font>. Every fact carries a warrant, of one of two "
    "kinds."))
A(code("""interface QuoteWarrant {
  kind: "quote";
  document: string;          // the document the model cited
  quote: string;             // the verbatim sentence it relied on
  verdict: Verdict;          // from verify.ts
  similarity: number;        // 0-1, for diagnostics
  span?: { start, end };     // character offsets, for click-through
  matchedDocument?: string;  // where it was really found, if elsewhere
}

interface DerivedWarrant {
  kind: "derivation";
  formula: string;           // human-readable
  inputs: FactKey[];         // every fact consumed
  authority?: { citation, sourceUrl };
}"""))
A(P("Facts also carry an <font face='Courier'>asOf</font> date (a balance is only true on a date), "
    "supersession, and the model that proposed them."))
A(P("<b>Only exact quotation earns admission.</b> A loose match is deliberately not good enough. "
    "In a domain where being wrong costs a family six months, “probably said something like "
    "this” is not evidence."))
A(P("<font face='Courier'>ledger()</font> returns verified facts only, so a quarantined fact is "
    "<b>structurally unreachable</b> by the rules engine — not filtered late, but absent from "
    "the data structure the engine reads. It remains visible in the interface so a reviewer can "
    "see exactly what the model tried to assert and on what basis."))
A(P("<font face='Courier'>integrity()</font> scores only model-proposed facts. Derived totals are "
    "excluded, because counting them would flatter the number."))
A(PageBreak())

# ================================================================= 5
A(H1("5. Reasoning layer"))

A(H2("5.1 Derivation"))
A(P("Module <font face='Courier'>derive.ts</font>, with California specifics in "
    "<font face='Courier'>ca-probate.ts</font>. No model performs arithmetic anywhere in this "
    "system. Models extract individually-quoted values; code sums them under a cited rule."))
A(B("Statutory exclusions are data: joint tenancy, named beneficiary, funded trust, registered "
    "vehicle, property passing to a surviving spouse — each with its citation."))
A(B("Asset facts follow <font face='Courier'>asset.&lt;id&gt;.value</font> and "
    "<font face='Courier'>asset.&lt;id&gt;.&lt;flag&gt;</font>, so a new asset class needs no code "
    "change, no schema migration and no deploy."))
A(B("Elapsed-time facts recompute every run, so a statutory waiting period expiring is itself a "
    "change the reactor notices."))
A(P("The derived total records its formula and every input key, so a sum is as auditable as the "
    "quotations beneath it."))

A(H2("5.2 Rules as data"))
A(P("Module <font face='Courier'>rules.ts</font>. A rule is a JSON-serialisable object."))
A(table([
    ["Field", "Purpose"],
    ["decisionPoint", "Groups rules competing to answer the same question"],
    ["jurisdiction", "State, optionally county — a county rule overlays statewide automatically"],
    ["requires", "Facts that must be held before the rule can be evaluated at all"],
    ["when", "Predicate tree: all, any, not, {fact, op, value}, exists, missing"],
    ["then", "Conclusion, forms, obligations, timeline range, cost range"],
    ["authority", "Citation, source URL, effective date, and the date we read the source"],
    ["estimates", "Names any figure in <i>then</i> that is a practice estimate, not a sourced one"],
    ["priority", "Resolves competition when several rules fire at one decision point"],
    ["blastRadius, reversibility", "Drive the human-approval gate"],
], [1.55 * inch, CW - 1.55 * inch], mono_cols=(0,)))
A(callout([
    ("b", "Provenance decays, so record when you looked."),
    ("n", "<i>retrievedAt</i> is as important as the citation. California's thresholds moved in "
          "April 2025 and most of the internet has not noticed. A rule that cannot say when it was "
          "last checked cannot be trusted a year from now."),
], "warn"))
A(callout([
    ("b", "An uncited number beside cited ones is the worst possible error."),
    ("n", "So <i>estimates</i> is mandatory rather than optional. Where a timeline or a cost is a "
          "practice estimate rather than a statutory figure, the rule says so and the interface "
          "renders the distinction."),
], "warn"))

A(H2("5.3 Three-valued evaluation"))
A(P("A predicate over a fact we do not hold evaluates to <b>unknown</b>, never to false. Kleene "
    "logic in <i>and</i>, <i>or</i> and <i>not</i>."))
A(code("""all:  any false -> false;  else any unknown -> unknown;  else true
any:  any true  -> true;   else any unknown -> unknown;  else false
not:  unknown stays unknown"""))
A(P("A rule whose condition is unknown does not quietly fail to fire. It reports itself "
    "<b>blocked</b> and names the fact keys it needed. Gap detection therefore falls out of the "
    "same machinery that decides, rather than being a separate feature that could drift out of "
    "agreement with it."))
A(P("Evaluation records every fact key consulted, and produces a step-by-step trace rendered in "
    "the Decisions pane so a reviewer can follow the reasoning line by line."))

A(H2("5.4 Decision resolution"))
A(P("Rules are grouped by decision point and scoped by jurisdiction. Within a point, fired rules "
    "resolve on priority; losers are retained as <i>alsoFired</i> so the choice stays auditable. "
    "Blocked and not-applicable rules are reported separately rather than discarded."))

A(H2("5.5 Dependency-tracked re-evaluation"))
A(P("Module <font face='Courier'>reactor.ts</font>. This answers Soren's question about when the "
    "system should run."))
A(B("Diffs two ledgers by decision-visible value."))
A(B("Intersects the changed fact keys with each decision's recorded dependency set."))
A(B("Re-runs only the affected decision points and carries the rest forward unchanged."))
A(B("Emits a Change Report: the fact that moved, the quotation that moved it, the rules that "
    "consequently fired, forms added and removed, obligations gained, and the decision points that "
    "were <i>provably</i> untouched."))
A(P("A blocked decision is not automatically re-run. The evaluator records a key even when that "
    "key was absent, so a missing fact is already part of the dependency set and the intersection "
    "test alone is sound. Treating “blocked” as “always stale” would forfeit "
    "the skip guarantee for nothing."))
A(callout([
    ("b", "Why this matters commercially."),
    ("n", "An estate runs nine to eighteen months and documents arrive throughout. Today each "
          "arrival triggers either an expensive full re-review or nothing at all — and "
          "“nothing” is how a twenty-thousand-dollar appraisal revision silently "
          "invalidates a filing strategy. Bounding re-decision to the dependency closure changes "
          "which errors are possible, not merely how fast they are caught."),
], "alix"))

A(H2("5.6 The approval gate"))
A(P("Module <font face='Courier'>risk.ts</font>. Soren's two axes, encoded on every rule."))
A(table([
    ["Outcome", "Condition", "Example"],
    ["auto", "Reversible and blast radius not high", "Transfer a vehicle at the DMV"],
    ["review", "Irreversible, costly, or high blast radius", "File a petition for formal probate"],
    ["blocked", "Cannot conclude, or a supporting fact failed verification", "No appraisal exists yet"],
], [0.85 * inch, 2.7 * inch, CW - 3.55 * inch], mono_cols=(0,)))
A(P("The gate also re-checks that no supporting fact is unverified. The ledger already guarantees "
    "this, so the check should never fire — and if it ever does, something upstream is broken "
    "and refusing is the correct response."))
A(P("This is also where Alix's product stance is drawn in code. The service stays human-led; the "
    "gate is precisely the boundary at which a specialist's judgement is spent, on the decisions "
    "that warrant it rather than on the ones a machine can safely take."))
A(PageBreak())

# ================================================================= 6
A(H1("6. Investigation layer"))

A(H2("6.1 The lead engine"))
A(P("Module <font face='Courier'>leads.ts</font>. A fact ledger records what documents say. An "
    "investigation reasons about what they <b>imply</b>."))
A(callout([
    ("n", "A wire to Geneva is not an asset. It is evidence that an account exists which no "
          "document in our possession describes. A Form 5471 is not a company; it is proof that a "
          "company exists somewhere. Making that inference explicit — with the request that "
          "would confirm or kill it — is the difference between reading documents and "
          "conducting an investigation."),
], "alix"))
A(P("Seventeen patterns, each carrying a rationale, a priority, and the specific actions that "
    "would resolve it."))
A(table([
    ["Group", "Patterns"],
    ["Tax-derived", "Schedule B foreign-account answer · Form 8938 · Form 3520 / 3520-A "
                    "· Form 5471 · Form 8865 · Form 8621 · Form 1116 · "
                    "foreign pension income"],
    ["Banking", "International wire · safe-deposit box · currency exchange"],
    ["Life and documents", "Foreign passport, address or residency · business interests and "
                           "K-1s · cryptocurrency · named professionals · employers "
                           "· unclaimed property"],
], [1.35 * inch, CW - 1.35 * inch]))
A(P("Each action records who it goes to, the channel, <b>which authority documents it requires</b> "
    "(certified Letters, death certificate, Form 56, apostille, certified translation, court "
    "order), the form where one exists, and what a response may reveal."))
A(P("Detection reuses the rules engine's predicate evaluator, so patterns share the three-valued "
    "semantics rather than growing a second, subtly different evaluator. A pattern that does not "
    "fire is reported <b>dormant</b>, with the fact key that would trigger it."))
A(callout([
    ("b", "The dormant list is the executor's defence."),
    ("n", "If a beneficiary later argues that the offshore account should have been found, the "
          "record shows the pattern was evaluated, what it was waiting for, and that nothing in "
          "the data room triggered it."),
], "ok"))

A(H2("6.2 The administration task graph"))
A(P("Module <font face='Courier'>tasks.ts</font>. Six phases with enforced dependencies."))
A(table([
    ["Phase", "Covers"],
    ["Establish authority", "Petition and certified Letters, estate EIN, estate bank account, Form 56"],
    ["Secure", "Redirect mail for a full annual cycle; secure property, vehicles and valuables; "
               "maintain insurance; preserve devices without accessing them; stop recurring charges"],
    ["Investigate", "IRS transcripts, institution-wide bank searches, public records, master ledger "
                    "and investigation log"],
    ["Report", "Final personal return, estate return above $600 gross income, international review"],
    ["Creditors", "Notice to known and reasonably ascertainable creditors, claim period"],
    ["Close", "Inventory and appraisal, reserves, final distribution, discharge"],
], [1.35 * inch, CW - 1.35 * inch]))
A(P("Dependencies are real, not decorative: no bank will speak to you before Letters issue, so "
    "bank searches are blocked until the petition completes, and the interface says which task is "
    "holding them."))
A(P("Tasks carry cautions where a wrong move is expensive — do not wipe devices, do not "
    "commingle estate funds with your own, and do not file delinquent foreign-account forms before "
    "counsel has reviewed whether prior omissions were innocent, negligent or wilful."))

A(H2("6.3 Statutory deadlines"))
A(P("Computed from dates in the ledger, never from the system clock. The as-of date is a "
    "parameter, so a run is reproducible."))
A(table([
    ["Deadline", "Period", "Authority"],
    ["Lodge the will", "30 days from death", "Prob. Code § 8200"],
    ["Inventory and Appraisal", "4 months from Letters", "Prob. Code § 8800"],
    ["Creditor claims", "Later of 4 months from Letters, or 60 days from notice", "Prob. Code § 9100"],
    ["First publication", "At least 15 days before the hearing", "Prob. Code § 8121"],
    ["Mailed notice", "At least 15 days before the hearing", "Prob. Code § 8110"],
    ["Federal estate tax", "9 months from death", "IRC § 6075(a)"],
    ["FBAR", "Where foreign aggregate exceeded $10,000", "31 CFR 1010.350"],
], [1.6 * inch, 2.35 * inch, CW - 3.95 * inch]))
A(P("Periods running from the later of two anchors compute both and report which governed."))
A(callout([
    ("b", "A deadline whose anchor is missing reports unknown — never “today”."),
    ("n", "A missed statutory deadline is exactly the irreversible, high-blast-radius harm this "
          "system exists to prevent, so silence or a guess is not an acceptable output. In the "
          "demonstration estate, Letters have not issued, and four deadlines honestly report that "
          "they cannot be computed and name the fact they need."),
], "warn"))

A(H2("6.4 The distribution gate"))
A(P("Distribution is the one irreversible act in an estate. Once money reaches beneficiaries it is "
    "practically unrecoverable, and early distribution is the most common route by which an "
    "executor becomes personally liable. The gate is therefore deliberately conservative and is "
    "held by any of:"))
A(B("An open <b>critical</b> lead — assets may exist that no document describes."))
A(B("An unclosed creditor claim period."))
A(B("Any fact still required by a pending decision."))
A(PageBreak())

# ================================================================= 7
A(H1("7. Filing layer"))

A(H2("7.1 The universal document store"))
A(callout([
    ("b", "The identifier printed on a PDF is not unique."),
    ("n", "DE-111 means something only within the California Judicial Council. PRO 010 exists only "
          "in Los Angeles. Almost every brokerage prints its own Affidavit of Domicile. Two "
          "counties can use the same number for different paper, and the same paper changes when a "
          "revision is issued."),
], "reject"))
A(P("Module <font face='Courier'>formstore.ts</font>. A record is keyed on <b>issuer + "
    "jurisdiction + revision</b>, and carries everything an operator needs in order to actually "
    "use the form."))
A(table([
    ["Attribute", "Contents"],
    ["Identity", "Composite key, printed identifier, title, issuer, jurisdiction, revision"],
    ["Parties", "Preparer, signer, notary, witness, recipient — each optionally bound to a fact key"],
    ["Signatures", "Type, page number, and rectangle in PDF points"],
    ["Delivery", "Accepted channels, named recipient, operator notes"],
    ["Constraints", "Requires notary, requires wet original"],
    ["Provenance", "Source URL and retrieval date"],
    ["Binding", "Field bindings, and the Anvil cast identifier once registered"],
], [1.25 * inch, CW - 1.25 * inch]))
A(P("Five issuer kinds are modelled: Judicial Council, county court, state agency, federal agency, "
    "and financial institution."))
A(P("<font face='Courier'>resolveForm()</font> <b>returns ambiguity rather than guessing</b>. "
    "Asking for “Affidavit of Domicile” without naming the institution yields both "
    "issuers and a reason. Asking for PRO 010 in San Mateo yields nothing and explains why. "
    "Sending the wrong institution's affidavit is a returned filing and another round trip for a "
    "grieving family, so a confident wrong answer is worse than no answer."))

A(H2("7.2 Dispatch"))
A(P("A filled PDF sitting on a disk has settled nothing. <font face='Courier'>planDispatch()</font> "
    "chooses a channel from those the recipient accepts, preferring cheapest and fastest — but "
    "two conditions override preference entirely."))
A(B("A form requiring a wet original or notarisation cannot be delivered electronically, whatever "
    "the recipient nominally accepts."))
A(B("An institution that requires a telephone call first must be called first. JPMorgan Chase's "
    "first step for a decedent account is a call, not paperwork; posting before that call usually "
    "results in the paperwork being returned."))
A(P("That second condition is where Mitch's track and Ian's track meet in a single record: the "
    "dispatch plan for the Chase form puts “telephone the institution” as step one, "
    "before anything is printed."))

A(H2("7.3 Field binding"))
A(code("""interface FieldBinding {
  alias: string;      // the Anvil field alias
  label: string;      // human label
  item?: string;      // the item number on the printed form, e.g. "3f(1)"
  factKey?: FactKey;  // where the value comes from
  constant?: string;  // for boxes that never vary
  template?: { pattern, keys };
  required: boolean;
  format?: "text" | "usd" | "date" | "yesno";
}"""))
A(P("<font face='Courier'>item</font> carries the number printed on the paper form, so a reviewer "
    "holding the physical document can check the mapping box by box."))
A(P("<font face='Courier'>buildFill()</font> reads <b>only the verified ledger</b>. A quarantined "
    "fact cannot reach a filed document; there is a test asserting that the fabricated policy in "
    "the demonstration estate never appears in any payload. A field with no supporting fact is "
    "left empty and reported with the specific fact needed and where to obtain it."))

A(H2("7.4 Anvil integration"))
A(table([
    ["Operation", "Mechanism"],
    ["Register", "createCast with aliasIds set to our own binding aliases, so Anvil's field "
                 "detection maps directly onto them. Publishes automatically, since an unpublished "
                 "cast cannot be filled."],
    ["Reconcile", "The cast query returns fieldInfo; bindings are compared in both directions."],
    ["Fill", "POST /api/v1/fill/{castEid}.pdf, response written as binary."],
    ["Sign", "createEtchPacket with a castEid reference and the same field-keyed payload as fill; "
             "embedded signer via generateEtchSignURL."],
    ["Retrieve", "Document-group zip download."],
], [0.95 * inch, CW - 0.95 * inch]))
A(callout([
    ("b", "Why reconciliation exists at all."),
    ("n", "Anvil's fill endpoint fails silently. A value written to a field alias the template does "
          "not have is dropped, and you receive a PDF that looks entirely correct with an empty box "
          "in the middle of it. On a probate petition that is a rejected filing and another month "
          "of the family's life. Reconciliation makes binding drift visible before anyone files, "
          "rather than after."),
], "reject"))
A(P("Registration hands Anvil our own alias list, which is what makes adding the hundredth form "
    "the same amount of work as adding the second — Ian's “thousands of forms, not five "
    "or six”."))
A(P("GraphQL uses the same HTTP Basic authentication as the REST endpoint, with the API key as "
    "username and an empty password. Application errors are inspected on the response body, "
    "because GraphQL reports them with HTTP 200 — a naive status check would treat a failed "
    "mutation as success. The API key never leaves the Rust process."))
A(PageBreak())

# ================================================================= 8
A(H1("8. Jurisdiction layer"))

A(H2("8.1 California statewide"))
A(P("Thresholds for decedents dying on or after 1 April 2025, each verified against Judicial "
    "Council form DE-300 [Rev. April 28, 2025]."))
A(table([
    ["Procedure", "Current", "Superseded", "Authority"],
    ["§ 13100 small estate affidavit", "$208,850", "$184,500", "Prob. Code §§ 13100, 13101"],
    ["§ 13151 primary residence petition", "$750,000", "$184,500", "AB 2016, Stats. 2024 ch. 331"],
    ["§ 13200 real property of small value", "$69,625", "$61,500", "Prob. Code § 13200"],
    ["Waiting period — §§ 13100, 13151", "40 days", "—", "Prob. Code § 13100"],
    ["Waiting period — § 13200", "6 months", "—", "Prob. Code § 13200"],
], [2.15 * inch, 0.85 * inch, 0.95 * inch, CW - 3.95 * inch], align_right=(1, 2)))
A(P("Next adjustment: 1 April 2028. Routes modelled: § 13100 affidavit, § 13151 "
    "primary-residence petition, § 13200 affidavit, spousal property petition (no dollar "
    "limit), formal probate, and DMV vehicle transfer."))
A(callout([
    ("b", "The interaction that drives the demonstration."),
    ("n", "§ 13100 excludes “any property included in a petition filed under Section "
          "13151”. While the residence qualifies under § 13151 it stays outside the "
          "§ 13100 computation. Cross $750,000 and it loses § 13151 eligibility "
          "<i>and</i> falls back into the § 13100 sum — closing both economical routes at "
          "once. That cascade is what the statute says, not a contrivance, and it is why a "
          "twenty-thousand-dollar change in an appraisal can cost a family a year."),
], "alix"))

A(H2("8.2 All 58 counties"))
A(P("Two kinds of county knowledge, deliberately distinguished."))
A(table([
    ["Kind", "Coverage", "Basis"],
    ["Filing fees", "All 58 counties", "The Judicial Council schedule states that asterisked fees "
                                       "vary “only in the counties of Riverside, San Bernardino "
                                       "and San Francisco” — an exhaustive negative "
                                       "statement, so the correct fee is known everywhere from one "
                                       "citation. Riverside and San Francisco charge $450; the "
                                       "other 56 charge $435."],
    ["Local rules", "3 of 58", "Los Angeles, San Francisco and San Mateo were read against their "
                               "published text. The remaining 55 generate a rule that says they "
                               "are unverified."],
], [0.95 * inch, 1.05 * inch, CW - 2.0 * inch]))
A(callout([
    ("b", "An unresearched county is a known unknown, not an absence of requirements."),
    ("n", "Quietly defaulting 55 counties to “nothing special applies” would be exactly "
          "the confident-wrong-answer failure this architecture exists to prevent. So each "
          "generates a rule stating that its local rules have not been read, and telling the "
          "operator to check them before filing."),
], "warn"))
A(P("Researched counties carry their local forms (PRO 010, PR-5, PR-13), e-filing exclusions, "
    "examiner and tentative-ruling practice, and stale-data warnings — including that "
    "lacourt.ca.gov still serves the superseded 2022 chapter four while the operative version is "
    "served from a different host, so a scraper pointed at the obvious URL silently ingests "
    "four-year-old rules."))
A(P("Switching county re-decides the estate with <b>no fact re-extracted</b>, because everything "
    "downstream is a pure function of the facts. That is the concrete demonstration that the "
    "architecture scales to three thousand counties, even though the content does not yet."))
A(PageBreak())

# ================================================================= 9
A(H1("9. Efficiency layer"))

A(H2("9.1 Correspondence"))
A(P("Module <font face='Courier'>correspondence.ts</font>. Seven reviewed templates: institution "
    "notification, institution-wide account search, foreign enquiry, IRS transcript cover, "
    "professional file request, weekly family update, and creditor notice."))
A(B("Merge fields resolve only from the verified ledger."))
A(B("Dates are spelled out for a human reader rather than left as ISO strings."))
A(B("Enclosures are computed from what the recipient actually requires — the foreign enquiry "
    "automatically lists the apostille and the certified translation."))
A(B("A letter with an unresolved required field is <b>refused</b>, not sent with a gap in it. A "
    "letter reaching a bank with a raw placeholder in it is worse than no letter at all."))
A(callout([
    ("b", "No model writes these."),
    ("n", "The wording is a template reviewed once; the facts are warranted; the specialist reads "
          "and presses send. That is the difference between “AI wrote your letter” and "
          "“the letter is correct” — and it is exactly the workflow Hugh described."),
], "ok"))

A(H2("9.2 Entity resolution"))
A(P("Module <font face='Courier'>entities.ts</font>. The same asset appears under different "
    "descriptions in different documents: the will says “my accounts at Wells Fargo”, a "
    "statement says “MARGARET E HOYT, account ending 4471”, a call transcript says "
    "“her checking account”."))
A(P("Matching is deterministic and evidence-bearing, across four signals: account tail, normalised "
    "institution name, holder name, and value. A differing account tail is <b>decisive against</b> "
    "a merge whatever else agrees."))
A(table([
    ["Strength", "Meaning", "Recommendation"],
    ["conclusive", "Account tail and institution both agree", "Safe to merge; record the evidence"],
    ["strong", "One decisive signal, or two corroborating", "Confirm before merging"],
    ["weak", "Some agreement, nothing decisive", "Obtain the account number first"],
    ["conflicting", "Account identifiers differ", "Do not merge — these are two assets"],
], [0.95 * inch, 2.2 * inch, CW - 3.15 * inch], mono_cols=(0,)))
A(callout([
    ("b", "It proposes and never decides, because the cost is asymmetric."),
    ("n", "Merging two accounts silently drops one from the inventory. Failing to merge "
          "double-counts the estate and can push it across a procedural threshold it never actually "
          "crossed. The machine has no way to know which side it is wrong on, so anything short of "
          "conclusive goes to a human."),
], "warn"))

A(H2("9.3 Effort accounting"))
A(P("Module <font face='Courier'>effort.ts</font>. Impact is the largest judging weight, so it "
    "should be measured rather than asserted — and measured honestly, which means being "
    "explicit that these are practice estimates of manual effort, not observations of this system "
    "running."))
A(table([
    ["Bucket", "Definition"],
    ["automated", "The machine produced the output; a human need not touch it"],
    ["assisted", "The machine produced a draft a human reviews — faster, but not free"],
    ["manual", "Still entirely a person's job"],
], [0.95 * inch, CW - 0.95 * inch], mono_cols=(0,)))
A(P("Review time is modelled explicitly and subtracted. Anything that inflated the automated "
    "bucket by treating review as zero would be the same category of dishonesty as an uncited "
    "threshold."))
A(P("Two headline figures are published, and <b>the honest one is smaller</b>: the larger excludes "
    "speaking with the family and waiting on hold, both of which are deliberately left to people "
    "because Alix's product is human-led and that time is not meant to disappear."))
A(P("The single largest line is re-checking the position when a new document arrives — ninety "
    "minutes down to ten. Today that work is either a full re-review or it is skipped."))
A(PageBreak())

# ================================================================= 10
A(H1("10. Infrastructure"))
A(H2("10.1 Provider layer"))
A(P("Five providers plus any OpenAI-compatible endpoint. Model identifiers, prices and capability "
    "profiles are data in <font face='Courier'>catalog.ts</font>, because vendors rename models "
    "constantly and a rename should be a configuration edit rather than an incident. Keys live in "
    "the Rust process; the frontend receives <font face='Courier'>has_key: bool</font> and nothing "
    "else."))
A(P("Audited against live vendor documentation. One genuine defect was found and fixed during that "
    "audit: the connection-test command requested a sixteen-token response, which reasoning models "
    "spend entirely on thinking, returning empty content that the code reported as a failure "
    "— a false failure on a perfectly valid key, on the exact button the documentation tells "
    "you to press first."))

A(H2("10.2 Safety and cost control"))
A(B("<b>Injection fencing.</b> Estate documents come from counterparties. Anything from a document "
    "is fenced as untrusted content with forged delimiters neutralised before a model sees it, and "
    "agents are instructed to report influence attempts as findings rather than obey them."))
A(B("<b>Rate limiting and a hard spend cap.</b> Per-provider concurrency gates, exponential "
    "backoff with jitter, immediate failure on a bad key, and a USD ceiling that aborts the run "
    "— addressing Soren's concern about spending twenty dollars every time the system runs."))
A(B("<b>Context budgeting.</b> Token-aware document selection with priority; documents that do not "
    "fit are named in the prompt rather than silently dropped."))

A(H2("10.3 Interface"))
A(P("Thirteen panes: Estate, Data room, Fact ledger, Investigation, Decisions, Forms, Document "
    "store, Anvil, Administration, Efficiency, Jurisdiction, Change log."))
A(P("Light, quiet and serif-headed, built on the Alix palette sampled from their own deck — "
    "deliberately calm rather than dashboard-like, because it is used by someone whose parent has "
    "just died. The entire demonstration runs with no network call and therefore cannot fail on a "
    "venue's wireless."))
A(PageBreak())

# ================================================================= 11
A(H1("11. The demonstration"))
A(P("Margaret Ellen Hoyt died on 4 January 2026 in San Mateo County. Her daughter Claire is "
    "executor. The estate is synthetic; the law applied to it is not."))
A(table([
    ["Time", "Beat", "What is shown"],
    ["0:00", "The problem", "Six procedures, 58 counties, and an LLM that will hallucinate a threshold"],
    ["0:20", "Extraction", "Seven documents ingested; sixteen facts proposed"],
    ["0:40", "The fabrication", "One claimed $50,000 policy is quarantined — the quote exists "
                                "in no document, and it never reaches the rules engine"],
    ["1:10", "Rules as data", "Exclusions applied, $148,600 personal property derived, DE-310 "
                              "selected against the real $750,000 cap, every figure cited"],
    ["1:50", "The flip", "A supplemental appraisal at $760,000 arrives. Two decision points "
                         "re-evaluated, two flipped, two provably skipped. Both economical routes "
                         "close at once; three weeks becomes nine to eighteen months"],
    ["2:30", "Offshore", "Schedule B, Form 5471 and a Pictet wire raise critical leads; "
                         "distribution is refused"],
    ["2:50", "Governance", "Irreversible actions gated; missing facts named with where to get them"],
], [0.5 * inch, 1.15 * inch, CW - 1.65 * inch]))
A(P("The demonstration is also expressed as a test file. If <font face='Courier'>ca-probate.test.ts"
    "</font> goes red, the demonstration is broken — which is a considerably better alarm than "
    "discovering it on stage."))

A(H2("11.1 Test inventory"))
A(table([
    ["Suite", "Covers", "Tests"],
    ["verify + hardening", "Quote verification, fencing, limiter, budgeting", "inherited"],
    ["engine", "Ledger, derivation, rules, reactor, gate, gaps", "17"],
    ["ca-probate", "The demonstration end to end, with real thresholds", "17"],
    ["ca-counties", "58 counties, fee variance, overlays, rule corrections", "15"],
    ["anvil", "Field binding, provenance, reconciliation, drift detection", "13"],
    ["formstore", "Composite identity, resolution, ambiguity, dispatch", "15"],
    ["investigation", "Leads, deadlines, task graph, distribution gate", "20"],
    ["efficiency", "Correspondence, entity resolution, effort model", "18"],
    ["Rust", "PDF, DOCX, XLSX extraction against real fixtures; base64", "11"],
], [1.35 * inch, CW - 2.05 * inch, 0.7 * inch], align_right=(2,)))
A(P("<b>171 TypeScript tests and 11 Rust tests, all passing.</b>"))
A(PageBreak())

# ================================================================= 12
A(H1("12. Honest limitations"))
A(P("Stated plainly and up front, because a limitation volunteered is a strength and one extracted "
    "under questioning is a wound.", "lede"))
A(table([
    ["Limitation", "Detail"],
    ["No live model call", "Neither this codebase nor its parent has ever made one. Extraction is "
                           "stubbed with hand-written candidates in the identical FactCandidate "
                           "shape, so wiring it is a small job — but it is not wired."],
    ["No live Anvil call", "The shapes come from documentation. The createCast file encoding and "
                           "the exact etch input types are the least certain parts."],
    ["3 of 58 counties", "Local rules read for Los Angeles, San Francisco and San Mateo. The other "
                         "55 are flagged unverified, not defaulted."],
    ["Heggstad / § 850", "Not modelled — and it is the actual remedy for the unfunded "
                              "trust the demonstration is framed around."],
    ["Liabilities", "Not in the ledger. Assets only; creditor work exists as tasks and deadlines."],
    ["Foreign jurisdictions", "No rule pack. Ancillary probate, resealing and letters rogatory "
                              "appear as lead actions rather than as rules."],
    ["Investigation log", "Derived rather than persisted — recomputed each run instead of "
                          "append-only with timestamps, which is what defensibility actually wants."],
    ["Track 2 (voice)", "Designed as an adapter over the same fact pipeline; not built."],
    ["Effort figures", "Practice estimates of manual effort, not measurements of this system."],
    ["What verification proves", "That a quotation exists, not that the conclusion follows. It "
                                 "eliminates fabricated evidence; it does not eliminate bad "
                                 "reasoning from real evidence."],
], [1.35 * inch, CW - 1.35 * inch]))
A(callout([
    ("b", "This is not legal advice."),
    ("n", "It is analysis support that a human owns, reviews and signs — which is also Alix's "
          "own stated product position. The system is built to make a specialist faster and harder "
          "to mislead, not to replace their judgement."),
], "alix"))

A(H2("12.1 What comes next"))
A(table([
    ["Priority", "Work", "Effort"],
    ["1", "Wire live extraction; run once and record the output as a fixture", "1–2 hours"],
    ["2", "Register DE-310 with Anvil and complete one live fill", "45 minutes"],
    ["3", "Model the Heggstad / § 850 petition", "30 minutes"],
    ["4", "Add liabilities and creditor claims to the ledger", "2 hours"],
    ["5", "Persist the investigation log as an append-only record", "2 hours"],
    ["6", "Extraction council with tiered escalation and conflict surfacing", "3 hours"],
    ["7", "Foreign jurisdiction rule pack, starting with Switzerland", "half a day"],
    ["8", "Track 2 voice adapter emitting the same FactCandidate shape", "several days"],
], [0.65 * inch, CW - 1.75 * inch, 1.1 * inch]))

doc.multiBuild(story)
print("wrote", OUT)
