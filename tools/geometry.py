"""Emit, for every AcroForm widget, the printed words that surround it.

This is the evidence base for form-field mapping. A field named f1_10 means
nothing; "the words immediately above it are 'Fiduciary's name'" means a great
deal, and unlike a mapping typed from memory it can be checked by anyone with
the PDF. Nothing here interprets the form - it only records what is printed
where, so that a later mapping step has something to be right or wrong against.
"""
import sys, os, glob, json
import pdfplumber
from pypdf import PdfReader

root = r"C:\Users\mitan\Downloads\TRACK 3 RESOURCES-20260728T110615Z-1-001\TRACK 3 RESOURCES\TRACK 3 FORMS"
outdir = sys.argv[1]
os.makedirs(outdir, exist_ok=True)

SLUG = {
    "Form 56 June 2026.pdf": "irs-56",
    "Form 8821 Jan 2021.pdf": "irs-8821",
    "Form SS-4 Dec 2025.pdf": "irs-ss4",
    "DL 142 R7 93.pdf": "ca-dl142",
}


def widgets_of(path):
    reader = PdfReader(path)
    out = []
    for pi, page in enumerate(reader.pages):
        for annot in page.get("/Annots") or []:
            o = annot.get_object()
            if o.get("/Subtype") != "/Widget":
                continue
            node, parts = o, []
            while node is not None:
                t = node.get("/T")
                if t:
                    parts.append(str(t))
                node = node.get("/Parent")
            name = ".".join(reversed(parts))
            ft = o.get("/FT")
            p = o.get("/Parent")
            if ft is None and p is not None:
                ft = p.get_object().get("/FT")
            tu = o.get("/TU") or (p.get_object().get("/TU") if p else None)
            states = None
            ap = o.get("/AP")
            if ap and "/N" in ap:
                try:
                    states = [str(k) for k in ap["/N"].keys()]
                except Exception:
                    states = None
            out.append({
                "name": name,
                "page": pi + 1,
                "type": str(ft),
                "rect": [round(float(x), 1) for x in o["/Rect"]],
                "tip": str(tu) if tu else None,
                "states": states,
            })
    return out


for path in sorted(glob.glob(os.path.join(root, "*.pdf"))):
    base = os.path.basename(path)
    slug = SLUG[base]
    ws = widgets_of(path)
    pl = pdfplumber.open(path)
    words_by_page = {i + 1: pl.pages[i].extract_words() for i in range(len(pl.pages))}
    heights = {i + 1: float(pl.pages[i].height) for i in range(len(pl.pages))}

    for w in ws:
        ph = heights[w["page"]]
        x0, y0, x1, y1 = w["rect"]
        top, bottom = ph - y1, ph - y0
        cy = (top + bottom) / 2
        left, above, right, below = [], [], [], []
        for t in words_by_page[w["page"]]:
            ty = (t["top"] + t["bottom"]) / 2
            if abs(ty - cy) < max(6, (bottom - top) * 0.7):
                if t["x1"] <= x0 + 2:
                    left.append((x0 - t["x1"], t["text"]))
                elif t["x0"] >= x1 - 2:
                    right.append((t["x0"] - x1, t["text"]))
            elif 0 < top - ty < 26 and t["x1"] > x0 - 40 and t["x0"] < x1 + 40:
                above.append((top - ty, t["x0"], t["text"]))
            elif 0 < ty - bottom < 14 and t["x1"] > x0 - 40 and t["x0"] < x1 + 40:
                below.append((ty - bottom, t["x0"], t["text"]))
        # Same-line context: nearest-first by distance, then emitted in reading
        # order so the result is quotable verbatim.
        left.sort(key=lambda p: p[0])
        right.sort(key=lambda p: p[0])
        w["left"] = " ".join(t for _, t in reversed(left[:12]))
        w["right"] = " ".join(t for _, t in right[:12])

        # Stacked context spans several printed lines. Sorting the whole set by
        # vertical distance scrambles each line internally, because every word
        # on a line shares one distance. Group into lines first, order the lines
        # top-to-bottom, then order words within a line left-to-right.
        def stack(items, limit):
            lines = {}
            for dist, x, text in items:
                lines.setdefault(round(dist / 3), []).append((x, text))
            ordered = []
            for key in sorted(lines, reverse=True):
                ordered.extend(t for _, t in sorted(lines[key]))
            return " ".join(ordered[-limit:])

        w["above"] = stack(above, 12)
        w["below"] = stack(below, 8)

    ws.sort(key=lambda d: (d["page"], -d["rect"][3], d["rect"][0]))
    doc = {
        "form": slug,
        "sourceFile": base,
        "pages": len(words_by_page),
        # Page boxes are needed to convert PDF coordinates (origin bottom-left)
        # into the top-left origin that Anvil and most form APIs expect. Storing
        # them here keeps that conversion out of the consumer's guesswork.
        "pageSizes": [
            {"page": i + 1, "width": round(float(pl.pages[i].width), 2),
             "height": round(float(pl.pages[i].height), 2)}
            for i in range(len(pl.pages))
        ],
        "widgets": ws,
    }
    dest = os.path.join(outdir, slug + ".json")
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=1, ensure_ascii=False)
    print(f"{slug:<10} {len(ws):>3} widgets -> {dest}")

