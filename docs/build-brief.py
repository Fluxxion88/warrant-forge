"""Build the Warrant brief — the document you hand somebody.

    python docs/build-brief.py

Every figure in here is either measured by a command in this repo, derived from
one, or explicitly labelled as an assumption. That distinction is the product's
whole argument, so the document holds itself to it: assumptions are marked in
the table they appear in, not relegated to a footnote.
"""
import os
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate, Frame, KeepTogether, PageBreak, PageTemplate,
    Paragraph, Spacer, Table, TableStyle,
)

OUT = os.path.join(os.path.dirname(__file__), "Warrant-Brief.pdf")

INK = colors.HexColor("#12211F")
SOFT = colors.HexColor("#3F5654")
FAINT = colors.HexColor("#7A908E")
TEAL = colors.HexColor("#2C7A87")
LINE = colors.HexColor("#DDE8E8")
BAND = colors.HexColor("#EDF4F4")
GOOD = colors.HexColor("#1C7A5E")
GOOD_BG = colors.HexColor("#E9F5F0")
BAD = colors.HexColor("#B0432E")
BAD_BG = colors.HexColor("#FBECE8")
WARN = colors.HexColor("#8F6118")
WARN_BG = colors.HexColor("#FDF4E4")

PW, PH = LETTER
MARGIN = 0.85 * inch
CW = PW - 2 * MARGIN

SANS, SANSB, SANSI = "Helvetica", "Helvetica-Bold", "Helvetica-Oblique"
SERIF, SERIFB = "Times-Roman", "Times-Bold"
MONO = "Courier"

S = {
    "title": ParagraphStyle("t", fontName=SERIFB, fontSize=42, leading=46, textColor=INK),
    "sub": ParagraphStyle("s", fontName=SERIF, fontSize=16, leading=21, textColor=TEAL, spaceBefore=8),
    "meta": ParagraphStyle("m", fontName=SANS, fontSize=9.5, leading=15, textColor=SOFT),
    "H1": ParagraphStyle("h1", fontName=SERIFB, fontSize=20, leading=24, textColor=INK,
                         spaceBefore=18, spaceAfter=8),
    "H2": ParagraphStyle("h2", fontName=SANSB, fontSize=11, leading=14, textColor=TEAL,
                         spaceBefore=13, spaceAfter=4),
    "H3": ParagraphStyle("h3", fontName=SANSB, fontSize=9.4, leading=12.6, textColor=INK,
                         spaceBefore=8, spaceAfter=2),
    "body": ParagraphStyle("b", fontName=SANS, fontSize=9.3, leading=13.8, textColor=SOFT,
                           spaceAfter=6, alignment=TA_JUSTIFY),
    "lede": ParagraphStyle("l", fontName=SANS, fontSize=10.4, leading=15.6, textColor=SOFT, spaceAfter=9),
    "bul": ParagraphStyle("bu", fontName=SANS, fontSize=9.3, leading=13.6, textColor=SOFT,
                          leftIndent=15, bulletIndent=3, spaceAfter=3.5),
    "cell": ParagraphStyle("c", fontName=SANS, fontSize=8.2, leading=11.4, textColor=SOFT),
    "cellb": ParagraphStyle("cb", fontName=SANSB, fontSize=8.2, leading=11.4, textColor=INK),
    "cellm": ParagraphStyle("cm", fontName=MONO, fontSize=7.3, leading=10.4, textColor=SOFT),
    "num": ParagraphStyle("n", fontName=SANSB, fontSize=8.4, leading=11.4, textColor=INK),
    "big": ParagraphStyle("bg", fontName=SERIFB, fontSize=23, leading=26, textColor=INK),
    "biglab": ParagraphStyle("bl", fontName=SANS, fontSize=7.4, leading=10, textColor=FAINT),
    "quote": ParagraphStyle("q", fontName="Times-Italic", fontSize=10.6, leading=15.4, textColor=INK,
                            leftIndent=15, rightIndent=10, spaceBefore=5, spaceAfter=4),
    "attrib": ParagraphStyle("a", fontName=SANS, fontSize=8, leading=11, textColor=FAINT,
                             leftIndent=15, spaceAfter=9),
    "call": ParagraphStyle("cl", fontName=SANS, fontSize=9, leading=13.2, textColor=INK, spaceAfter=4),
    "callb": ParagraphStyle("clb", fontName=SANSB, fontSize=9, leading=13.2, textColor=INK, spaceAfter=3),
    "foot": ParagraphStyle("f", fontName=SANS, fontSize=7.3, textColor=FAINT, alignment=TA_CENTER),
}


def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def P(t, s="body"):
    return Paragraph(t, S[s])


def B(t):
    return Paragraph(t, S["bul"], bulletText="•")


def H1(t):
    return Paragraph(esc(t), S["H1"])


def H2(t):
    return Paragraph(esc(t), S["H2"])


def H3(t):
    return Paragraph(esc(t), S["H3"])


def table(rows, widths, header=True, zebra=True, align=None):
    data = []
    for r_i, row in enumerate(rows):
        out = []
        for c_i, cell in enumerate(row):
            if isinstance(cell, Paragraph):
                out.append(cell)
            else:
                st = "cellb" if (header and r_i == 0) else "cell"
                out.append(Paragraph(esc(str(cell)), S[st]))
        data.append(out)

    style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
    ]
    if header:
        style += [("BACKGROUND", (0, 0), (-1, 0), BAND),
                  ("LINEBELOW", (0, 0), (-1, 0), 0.8, TEAL)]
    if zebra:
        for i in range(1 if header else 0, len(data)):
            if i % 2 == (0 if header else 1):
                style.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#FAFCFC")))
    for a in (align or []):
        style.append(a)
    t = Table(data, colWidths=widths, hAlign="LEFT")
    t.setStyle(TableStyle(style))
    return t


def callout(title, body, tone="teal"):
    bg, br = {"teal": (BAND, TEAL), "good": (GOOD_BG, GOOD),
              "bad": (BAD_BG, BAD), "warn": (WARN_BG, WARN)}[tone]
    inner = [Paragraph(esc(title), S["callb"])]
    for para in body:
        inner.append(Paragraph(para, S["call"]))
    t = Table([[inner]], colWidths=[CW], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LINEBEFORE", (0, 0), (0, -1), 2.5, br),
        ("LEFTPADDING", (0, 0), (-1, -1), 11),
        ("RIGHTPADDING", (0, 0), (-1, -1), 11),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return KeepTogether([Spacer(1, 4), t, Spacer(1, 8)])


def stats(pairs):
    cells, w = [], CW / len(pairs)
    for value, label in pairs:
        cells.append([Paragraph(esc(value), S["big"]), Paragraph(esc(label), S["biglab"])])
    t = Table([[c for c in cells]], colWidths=[w] * len(pairs), hAlign="LEFT")
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    inner = []
    for value, label in pairs:
        inner.append([Paragraph(esc(value), S["big"]), Paragraph(esc(label), S["biglab"])])
    grid = Table([[Table([[r[0]], [r[1]]], colWidths=[w - 8]) for r in inner]],
                 colWidths=[w] * len(pairs), hAlign="LEFT")
    grid.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    return KeepTogether([Spacer(1, 4), grid, Spacer(1, 6)])


def quote(text, who):
    return KeepTogether([
        Paragraph("“" + esc(text) + "”", S["quote"]),
        Paragraph("— " + esc(who), S["attrib"]),
    ])


# ---------------------------------------------------------------------------

story = []
A = story.append

# ------------------------------------------------------------------ cover
A(Spacer(1, 1.5 * inch))
A(Paragraph("Warrant", S["title"]))
A(Paragraph("Verified-fact estate settlement, built for Alix", S["sub"]))
A(Spacer(1, 0.5 * inch))
A(Paragraph(
    "Every fact carries the sentence that justifies it. Verification is deterministic — "
    "no model is ever asked whether a model told the truth.", S["lede"]))
A(Spacer(1, 0.4 * inch))
A(table([
    ["Team", "Mitansh and Egor"],
    ["Built for", "Alix — Agents of Administration, Track 3 (with Track 1 intact)"],
    ["Repository", "github.com/mit37/warrant"],
    ["Date", "28 July 2026"],
    ["Status", "463 tests. Anvil live. Extraction run against a real model."],
], [1.3 * inch, CW - 1.3 * inch], header=False, zebra=False))
A(PageBreak())

# ------------------------------------------------------------------ summary
A(H1("What this is, in one page"))
A(P("Warrant is a decision engine for estate settlement in which no claim reaches a "
    "filed document without evidence behind it. A model may propose any fact it likes; "
    "it cannot get that fact into a decision without producing a verbatim quotation "
    "that a deterministic checker locates in a document we actually hold. Facts that "
    "fail are quarantined — visible to a reviewer, unreachable by the rules engine.", "lede"))

A(stats([("463", "TESTS"), ("4", "STATE PACKS"), ("58", "CA COUNTIES"),
         ("171", "FIELD MAPPINGS"), ("41/41", "FACTS VERIFIED")]))

A(H2("The four invariants"))
A(B("<b>No fact without a warrant.</b> A quotation the checker cannot locate is quarantined."))
A(B("<b>No model in the decision path.</b> Models extract. Rules decide. The evaluator is pure."))
A(B("<b>No model arithmetic.</b> Totals are computed in code under a cited statutory rule."))
A(B("<b>Three-valued logic.</b> A predicate over a fact we do not hold is <i>unknown</i>, never "
    "false. A blocked rule names what it needs. Gap detection is free rather than a feature."))

A(callout("The problem in the mentor's own words", [
    "“Dear LLM, when you make a claim, you have to give me the verbatim quote. And then I "
    "have a deterministic system actually go in, check the transcript, and say, I need that "
    "exact quote to be in there. And if it's not, then I can't trust this claim.”",
    "<font color='#7A908E'>Soren, Rules as Data track</font>",
]))

A(H2("What it does that nothing else here does"))
A(B("<b>Onboards a government form it has never seen</b> — reads the words printed around each "
    "field geometrically, has a model propose the mapping, and refuses any mapping whose "
    "claimed label is not on the page."))
A(B("<b>Finds assets nobody mentioned</b> — infers a life policy from a $14.32 monthly debit "
    "that appears in no document."))
A(B("<b>Knows when its own answers expire</b> — every citation carries a re-check horizon, and "
    "where a statute publishes its amendment cycle, the exact date."))
A(B("<b>Declines, with a reason</b> — of twenty form/estate pairs, six are correctly withheld "
    "and one is blocked rather than answered."))

A(PageBreak())

# ------------------------------------------------------------------ functionality
A(H1("Functionality, in full"))

A(H2("1. Extraction and verification"))
A(table([
    ["Capability", "What it does", "State"],
    ["Live extraction", "Documents to candidate facts, each with the sentence it rests on",
     "Run: 9 docs, 41 facts, 41 verified, $0.08"],
    ["Deterministic verifier", "Normalised exact match, then n-gram coverage. No model involved",
     "Inherited, unchanged, load-bearing"],
    ["Numeric guard", "A quote whose figures are not in the document cannot verify",
     "Added after a fabricated fee passed"],
    ["Quarantine", "Failed facts are visible and structurally unreachable by rules",
     "Enforced by type, not convention"],
    ["Record warrants", "Facts imported from a case system cite system, record and field path",
     "Re-read and checked on admission"],
], [1.25 * inch, 2.7 * inch, CW - 3.95 * inch]))

A(H2("2. Jurisdiction"))
A(table([
    ["Capability", "Detail"],
    ["Rule packs", "California, New York, Pennsylvania, Texas — each sourced to the state's own legislature"],
    ["County pack", "All 58 California counties, with fee variation (San Francisco is $450, not $435)"],
    ["Honest gaps", "Each pack carries an explicit list of what could NOT be sourced"],
    ["No fallback", "An estate in an uncovered state gets 'no rule pack' and a hold, never another state's answers"],
    ["Freshness", "Every citation has a re-check horizon; scheduled statutory changes beat observed stability"],
    ["Compiler", "New counties compile from their own published text, model-proposed and quote-verified"],
], [1.25 * inch, CW - 1.25 * inch]))

A(H2("3. Forms — Track 3"))
A(table([
    ["Capability", "Detail"],
    ["Geometry extraction", "Widget rectangles plus the words printed around each, read off the page"],
    ["Discovered mapping", "Model proposes; the same matcher that checks facts checks the cited label"],
    ["Refusal", "Two proposals cited labels not printed where they claimed. Both recorded, not deleted"],
    ["Adjudications", "Human corrections live in an override layer, re-applied and re-verified"],
    ["Applicability", "Which forms apply is a rule with a citation, not a hardcode"],
    ["Local fill", "Real filled PDFs, every field read back"],
    ["Anvil", "Live. 139/139 bindings joined on three forms; values confirmed on the returned page"],
], [1.25 * inch, CW - 1.25 * inch]))

A(H2("4. Discovery and obligations"))
A(table([
    ["Capability", "Detail"],
    ["Recurring detection", "157 transactions to 12 recurring charges, across descriptor drift"],
    ["Asset inference", "Three assets found in no document: a life policy, a property policy, a safe deposit box"],
    ["Suppression", "An insurer already in the ledger is deliberately not re-reported"],
    ["Hypotheses, not facts", "Nothing inferred can enter the ledger. Enforced by a test"],
    ["Shut-down board", "Recurring charges still billing after death, with the cancellation path per vendor"],
], [1.25 * inch, CW - 1.25 * inch]))

A(H2("5. Dispatch"))
A(table([
    ["Capability", "Detail"],
    ["Hold detection", "Classifies the line from audio; transcription starts only when a person speaks"],
    ["Handover", "Pages the specialist the moment a human answers, with the script already resolved"],
    ["Bounded speech", "The agent may state only verified facts within the prepared scope"],
    ["Consent map", "Recording law per state; an unknown stops the call rather than defaulting to permitted"],
    ["Mid-call dispatch", "Documents the institution asks for are prepared and released on one approval"],
], [1.25 * inch, CW - 1.25 * inch]))

A(H2("6. Audit and change"))
A(table([
    ["Capability", "Detail"],
    ["Dependency-tracked replay", "Supersede one fact; only decisions that read it are re-evaluated"],
    ["Provable skips", "Decisions untouched by a change are shown not to have moved"],
    ["Approval gate", "Keyed on reversibility and blast radius, not on a blanket confidence score"],
    ["Distribution hold", "The one irreversible act, gated conservatively and for stated reasons"],
], [1.25 * inch, CW - 1.25 * inch]))

A(PageBreak())

# ------------------------------------------------------------------ evidence
A(H1("What has actually run"))
A(P("The distinction this document holds throughout: <b>measured</b> means a command in the "
    "repository produced it; <b>modelled</b> means it was calculated from assumptions that are "
    "named. Nothing here is an estimate presented as an observation.", "lede"))

A(table([
    ["Result", "Figure", "Evidence"],
    ["Live extraction", "41 proposed, 41 verified, 0 quarantined, 0 malformed",
     "measured — recorded and replayable"],
    ["Extraction cost", "$0.08 for nine documents", "measured"],
    ["Field mappings", "171 verified across 4 forms, 3 refused", "measured"],
    ["Anvil chain", "139/139 bindings, values read back off the page", "measured, live API"],
    ["Filled PDFs", "14 documents, 270 fields, all read back", "measured"],
    ["Forms correctly withheld", "6 of 20 pairs, each with a stated reason", "measured"],
    ["Model agreement", "87 of 94 fields; 3 of 7 disagreements were real errors",
     "measured, two models"],
    ["Recurring bleed found", "$11,963/yr still leaving the estate", "measured"],
    ["Assets discovered", "3, in no document", "measured"],
], [1.55 * inch, 2.15 * inch, CW - 3.7 * inch]))

A(callout("The result we are least comfortable with, stated anyway", [
    "Two mappings passed verification and were still wrong. One put the signer's name in "
    "“Title, if applicable”; the other answered “are the assets in the custody of "
    "the court?” from a field meaning “does a court case exist”. Both cited labels "
    "genuinely printed on the form.",
    "Locating a quote proves the model did not invent its evidence. It does not prove the "
    "reasoning is right. We found these by rendering the filled PDF and reading it — not by "
    "adding another model — and they are recorded as adjudications rather than quietly fixed.",
], "bad"))

A(PageBreak())

# ------------------------------------------------------------------ money
A(H1("Financial model"))

A(callout("A distinction the pitch must not blur", [
    "The widely-quoted 570–900 hours is what the <b>family</b> spends. Alix's P&amp;L turns on "
    "what its <b>specialist</b> spends. Reducing the first is marketing; reducing the second is "
    "margin. This model addresses the second and says so.",
], "warn"))

A(H2("Inputs"))
A(table([
    ["Input", "Value", "Status"],
    ["Fully-loaded specialist hour", "$70",
     "Alix's own figure — salary, benefits and payroll tax. Corroborated: BLS OEWS wages "
     "against the ECEC benefit load give $58 low, $74 central, $102 high, so $70 sits inside "
     "that range and a little below its middle"],
    ["Alix revenue per estate", "$9,000 minimum", "Alix published pricing — 1% of assets, $9,000 floor"],
    ["Probate referee commission (CA)", "0.1%",
     "Cal. Prob. Code 8961(a); minimum $75, maximum $10,000 under 8963"],
    ["Specialist hours to onboard one form today", "4 h",
     "ASSUMPTION. Nobody has been timed doing it — this is the single figure most worth replacing"],
], [1.7 * inch, 0.95 * inch, CW - 2.65 * inch]))

A(H2("Per-estate saving, at $70/hr"))
A(table([
    ["Lever", "Basis", "Hours", "Value"],
    ["Form filling — 270 fields auto-populated", "measured", "2 – 4", "$140 – 280"],
    ["Hold time — 34 min per call, ~6 institution calls", "modelled", "3.4", "$238"],
    ["Jurisdiction lookup instead of research", "modelled", "2 – 5", "$140 – 350"],
    ["Recurring-charge shutdown", "measured", "1 – 2", "$70 – 140"],
    ["Appraisal — cash self-appraised under 8901", "measured", "—", "$460 on the LA sample"],
    ["Total per estate", "", "8 – 14", "$560 – 980"],
], [2.5 * inch, 0.8 * inch, 0.7 * inch, CW - 4.0 * inch],
    align=[("BACKGROUND", (0, 6), (-1, 6), BAND),
           ("FONTNAME", (0, 6), (-1, 6), SANSB)]))

A(P("Against $9,000 of revenue that is <b>6 to 11 points of gross margin</b>, on a business "
    "whose alternative is hiring. And it compounds: the same rule pack and the same field map "
    "serve every subsequent estate in that jurisdiction at no additional cost, so the second "
    "estate in a county is cheaper than the first and the hundredth is nearly free."))

A(H2("The larger number: form onboarding"))
A(P("One-time per form, then amortised across every estate that ever touches that institution. "
    "This is the volume problem Track 3 was written around, and it is where the money actually "
    "is."))
A(table([
    ["Scenario", "New forms", "Specialist time today", "Cost at $70", "With Warrant"],
    ["Pilot", "20", "80 h", "$5,600", "model cost + review"],
    ["Year one", "200", "800 h", "$56,000", "model cost + review"],
    ["At scale", "1,000", "4,000 h", "$280,000", "model cost + review"],
], [0.9 * inch, 0.68 * inch, 1.25 * inch, 0.82 * inch, CW - 3.65 * inch]))
A(P("<i>Four hours per form is an assumption, not a measurement. Ian is the right person to "
    "replace it, and one sentence from him makes this table defensible in a way our own "
    "benchmark never will be.</i>"))

A(H2("Three-year shape"))
A(table([
    ["", "Year 1", "Year 2", "Year 3"],
    ["Estates processed", "250", "1,200", "4,000"],
    ["Per-estate saving at $770 midpoint", "$192,500", "$924,000", "$3,080,000"],
    ["New forms onboarded that year", "200", "400", "900"],
    ["Onboarding saving at $70/hr", "$56,000", "$112,000", "$252,000"],
    ["Total", "$248,500", "$1,036,000", "$3,332,000"],
    ["Jurisdictions covered", "4 states", "15 states", "40 states"],
], [2.25 * inch, (CW - 2.25 * inch) / 3, (CW - 2.25 * inch) / 3, (CW - 2.25 * inch) / 3],
    align=[("BACKGROUND", (0, 5), (-1, 5), BAND),
           ("FONTNAME", (0, 5), (-1, 5), SANSB)]))
A(P("<i>Estate volumes are illustrative. Alix does not publish how many estates it settles and "
    "we will not invent the figure — replace the top row with the real one and every row below "
    "it follows arithmetically. The saving rate and the hourly cost are the parts we stand "
    "behind.</i>"))

A(PageBreak())

# ------------------------------------------------------------------ assessment
A(H1("Honest assessment"))

A(H2("What is genuinely strong"))
A(B("<b>The verification gate is real and load-bearing.</b> It rejects. A fabricated policy is "
    "quarantined; a substituted fee no longer passes; three form mappings were refused."))
A(B("<b>Form onboarding scales the way Alix needs.</b> No human placed a field. 258 widgets "
    "across four forms, and the marginal cost of the next form is a model call and a review."))
A(B("<b>The jurisdiction model is the right shape.</b> Compiled, cited, versioned, diffable, "
    "zero tokens at decision time — and it declines rather than guessing outside its coverage."))
A(B("<b>Asset discovery is genuinely novel.</b> Inference from payment traces, not extraction. "
    "The industry currently tells families to do this by hand."))

A(H2("What is weak, and by how much"))
A(table([
    ["Weakness", "Severity", "Detail"],
    ["Four states of fifty", "High", "Architecture scales; content does not yet. Research-bound, not design-bound"],
    ["Three courts researched", "High", "Lazy acquisition means we only need the counties in the book, but that is still a queue"],
    ["Nobody has used it", "High", "No specialist has touched it. No user testing at all"],
    ["Verification has a ceiling", "Medium", "Catches fabricated evidence, not wrong reasoning. Two confirmed misses"],
    ["Voice never placed a call", "Medium", "Designed, tested, bounded — but no Twilio credentials, so unproven in the field"],
    ["One estate, nine documents", "Medium", "Extraction is proven narrowly. No OCR'd scans in the loop"],
    ["DL 142 does not join Anvil", "Low",
     "A property of the tool, not our map: detection on finds 38 fields against the real 52; "
     "detection off returns none, as it does not read the existing AcroForm. Filled locally, all 26 boxes"],
    ["Economics are modelled", "Medium",
     "Two of five saving levers are calculated rather than observed, and the $70 hour is "
     "Alix's own figure corroborated from outside rather than measured inside"],
], [1.5 * inch, 0.62 * inch, CW - 2.12 * inch]))

A(H2("Is it feasible to put into production?"))
A(P("Yes, in the order below, and the first phase requires nothing from Alix's engineering team "
    "at all. The riskiest work is last on purpose."))

A(table([
    ["Phase", "Scope", "Effort", "Integration risk"],
    ["1. Shadow run", "Point the importer at real estates; produce plans and filled forms", "1–2 weeks", "None — reads their export format"],
    ["2. Form onboarding", "They hand over PDFs, we return verified maps and Anvil Casts", "2–4 weeks", "Low — their Anvil account"],
    ["3. Jurisdiction service", "Rule packs behind an API their system queries", "4–8 weeks", "Medium — a new dependency"],
    ["4. Dispatch", "Hold detection, mid-call document release", "8+ weeks", "High — needs legal sign-off"],
], [1.15 * inch, 2.45 * inch, 0.7 * inch, CW - 4.3 * inch]))

A(callout("Where we would start", [
    "<b>Phase 2 pays for itself and touches nothing.</b> It is the highest return and the lowest "
    "risk, it addresses the deficiency Alix themselves named, and it needs no changes on their "
    "side beyond handing over a folder of PDFs.",
], "good"))

A(H2("How it compares"))
A(table([
    ["", "What they do well", "What is missing", "Our position"],
    ["Anvil", "Excellent PDF fill and e-signature", "Fields are placed by a human, per form",
     "Complementary — we generate and verify the mapping they consume"],
    ["EstateExec, Trust & Will", "Consumer-facing checklists and guidance", "Not specialist tooling; no jurisdiction engine",
     "Different user entirely"],
    ["Generic LLM plus RAG", "Fast to stand up, broad coverage", "No warrant, no effective dates, retrieval by similarity where you need lookup by key",
     "This is the approach we deliberately rejected"],
    ["Alix today", "Real expertise, real clients, real book", "Volume and defensibility, by their own account",
     "Infrastructure underneath, not a replacement"],
], [0.95 * inch, 1.5 * inch, 1.75 * inch, CW - 4.2 * inch]))

A(PageBreak())

# ------------------------------------------------------------------ close
A(H1("What we need"))
A(table([
    ["Item", "Why", "Blocking?"],
    ["Twilio credentials", "The voice agent is built and tested but has never placed a call", "Yes, for dispatch"],
    ["SMTP / fax credentials", "Mid-call document release", "Yes, for dispatch"],
    ["Ian: hours to onboard one form", "Replaces the one assumption the onboarding table rests on", "No, but it is the highest-value sentence available"],
    ["Priority counties", "Lazy acquisition means we only build what the book touches", "No"],
    ["Alix estate volume", "Turns the three-year table from illustrative into real", "No"],
], [1.55 * inch, 2.9 * inch, CW - 4.45 * inch]))

A(H2("Two things we would say out loud"))
A(P("<b>The 900-hour figure does not survive its source.</b> It traces to the founder's own "
    "estate, was later restated as a population average, and is now cited back by journalists "
    "as an industry estimate. It appears on at least six Alix pages with no citation. The "
    "nearest real research says 570, from a survey with a stated sample and error margin. We "
    "would use Alix's published range verbatim — 600 to 900 — because a range cannot be "
    "attacked as a false point estimate, and its low end brackets the survey."))
A(P("<b>We would not claim the verifier makes the system correct.</b> It makes the system "
    "<i>accountable</i>, which is a smaller claim and a more defensible one. Everything this "
    "product does is designed so that when it is wrong, somebody can see exactly where and why."))

A(Spacer(1, 0.3 * inch))
A(quote("Tomorrow, if your system told me that I have to go through formal probate, you need to "
        "track me every decision that was made. You need to tell me where you got your legal "
        "information.", "Soren, Rules as Data track"))
A(P("That is the whole specification, and it is the one we built to."))


# ------------------------------------------------------------------ render
def page(canvas, doc):
    canvas.saveState()
    canvas.setFont(SANS, 7.3)
    canvas.setFillColor(FAINT)
    if doc.page > 1:
        canvas.drawCentredString(PW / 2, 0.5 * inch, f"Warrant  ·  built for Alix  ·  {doc.page}")
    canvas.restoreState()


doc = BaseDocTemplate(OUT, pagesize=LETTER,
                      leftMargin=MARGIN, rightMargin=MARGIN,
                      topMargin=0.8 * inch, bottomMargin=0.8 * inch,
                      title="Warrant — brief", author="Mitansh and Egor")
doc.addPageTemplates([PageTemplate(id="main",
                                   frames=[Frame(MARGIN, 0.8 * inch, CW, PH - 1.6 * inch, id="f")],
                                   onPage=page)])
doc.build(story)
print(f"wrote {OUT}  ({os.path.getsize(OUT) // 1024} KB)")
