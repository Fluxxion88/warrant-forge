"""Write the filled PDFs, then read them back to prove the values landed.

Run:  python tools/fill-pdf.py

Reads the payloads produced by tools/fill-forms.ts, writes one filled PDF per
payload, and then re-opens each written file and compares its field values
against what was requested. The read-back is the point. A PDF writer that
silently drops a field produces a document that looks fine and is missing a
line, and nobody discovers it until the agency rejects the filing.
"""
import json
import os
import sys
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, BooleanObject, DictionaryObject

FORMS = "samples/track3"
FILLS = "out/fills"
OUT = "out/pdf"

SOURCE = {
    "ca-dl142": "DL 142 R7 93.pdf",
    "irs-56": "Form 56 June 2026.pdf",
    "irs-8821": "Form 8821 Jan 2021.pdf",
    "irs-ss4": "Form SS-4 Dec 2025.pdf",
}

os.makedirs(OUT, exist_ok=True)


def set_need_appearances(writer):
    """Ask the viewer to render field values it did not generate itself.

    Without this the text is present in the file but invisible on screen in
    most viewers, which is the worst of both worlds: it passes a programmatic
    read-back and looks blank to the human signing it.
    """
    root = writer._root_object
    if "/AcroForm" not in root:
        root[NameObject("/AcroForm")] = DictionaryObject()
    root["/AcroForm"][NameObject("/NeedAppearances")] = BooleanObject(True)


def fill(payload_path):
    with open(payload_path, encoding="utf-8") as fh:
        payload = json.load(fh)

    src = os.path.join(FORMS, SOURCE[payload["form"]])
    reader = PdfReader(src)
    writer = PdfWriter(clone_from=reader)
    set_need_appearances(writer)

    text_vals, btn_vals = {}, {}
    for name, value in payload["fields"].items():
        (btn_vals if str(value).startswith("/") else text_vals)[name] = value

    for page in writer.pages:
        if text_vals:
            writer.update_page_form_field_values(page, text_vals)
        # Checkboxes need both the value and the appearance state set, and
        # pypdf's helper does not reliably do the second for radio groups.
        for annot in page.get("/Annots") or []:
            obj = annot.get_object()
            node, parts, owner = obj, [], None
            while node is not None:
                # /Parent is an indirect reference; resolve before reading it,
                # or the walk silently sees no /T and every name comes out short.
                if hasattr(node, "get_object"):
                    node = node.get_object()
                t = node.get("/T")
                if t:
                    parts.append(str(t))
                    # The deepest node carrying /T is the field the name refers
                    # to, and therefore the one whose /V decides the value.
                    # Setting /V on its parent instead leaves the box unticked
                    # while the write appears to succeed.
                    if owner is None:
                        owner = node
                node = node.get("/Parent")
            full = ".".join(reversed(parts))
            if full in btn_vals:
                state = NameObject(btn_vals[full])
                # /AS drives what is drawn; /V drives what the value is. Both.
                obj[NameObject("/AS")] = state
                (owner if owner is not None else obj)[NameObject("/V")] = state

    stem = os.path.basename(payload_path).replace(".payload.json", "")
    dest = os.path.join(OUT, stem + ".pdf")
    with open(dest, "wb") as fh:
        writer.write(fh)

    # Read back what we just wrote.
    check = PdfReader(dest)
    got = check.get_fields() or {}
    missing = []
    for name, want in payload["fields"].items():
        entry = got.get(name)
        if entry is None:
            # pypdf keys read-back fields by their leaf name in some documents.
            entry = got.get(name.split(".")[-1])
        actual = "" if entry is None else str(entry.get("/V", ""))
        if str(want).strip() != actual.strip():
            missing.append((name.split(".")[-1], want, actual))

    return dest, len(payload["fields"]), missing


payloads = sorted(f for f in os.listdir(FILLS) if f.endswith(".payload.json"))
if not payloads:
    sys.exit("no payloads — run tools/fill-forms.ts first")

total, bad_total = 0, 0
for p in payloads:
    dest, n, missing = fill(os.path.join(FILLS, p))
    total += n
    bad_total += len(missing)
    size = os.path.getsize(dest) // 1024
    flag = "OK " if not missing else f"{len(missing)} MISMATCH"
    print(f"{os.path.basename(dest):<52} {n:>3} fields  {size:>4}KB  {flag}")
    for name, want, actual in missing[:4]:
        print(f"      {name}: wanted {want!r}, read back {actual!r}")

print(f"\n{len(payloads)} PDFs, {total} fields written, {bad_total} read back wrong")
print(f"-> {OUT}/")
