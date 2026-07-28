/**
 * Upload a Cast to Anvil, fill it from a real estate record, download the PDF.
 *
 *   ANVIL_KEY=... npx vite-node tools/anvil-live.ts [form]
 *
 * The key is read from the environment and never written to disk. Use a
 * development key: this creates real objects in the organisation.
 *
 * This is the chain that had never run. Geometry, discovered field maps, Cast
 * generation and coordinate validation were all built against Anvil's
 * documented shapes with no key to check them against, so the honest status was
 * "written, never executed". Running it corrected three assumptions:
 *
 * 1. `createCast` does not take field rectangles. Introspection gives
 *    `createCast(file, detectFields, aliasIds, ...)` â€” Anvil detects the field
 *    positions itself. That division of labour is better than the one I
 *    assumed: Anvil is good at finding where the boxes are, and the part it
 *    cannot do is knowing that the box under "Title, if applicable" holds the
 *    fiduciary's title rather than their name. Our verified map supplies that.
 *
 * 2. `aliasIds` is accepted and then silently ignored â€” the returned cast still
 *    carries Anvil's own ids. Two rejected shapes established it wants an array
 *    of strings, the array was accepted, and the ids did not change. So the
 *    fill is keyed by Anvil's ids instead, which needs no undocumented
 *    behaviour to work.
 *
 * 3. Anvil flattens on fill. The returned PDF has no AcroForm fields at all, so
 *    a read-back has to extract page text rather than field values.
 *
 * The join is exact rather than fuzzy: Anvil keeps the original AcroForm name
 * on each detected field, and our map is keyed by the fully-qualified version
 * of that same name, so the last dotted segment matches. Anything that fails to
 * match is reported rather than dropped.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { castPayload } from "../src/lib/anvilcast";
import type { EstateRecord } from "../src/lib/estate";
import { form56Overrides } from "../src/rules/form-applicability";

const KEY = process.env.ANVIL_KEY ?? "";
if (!KEY) throw new Error("set ANVIL_KEY (use the development key)");

const GRAPHQL = "https://graphql.useanvil.com";
const REST = "https://app.useanvil.com/api/v1";
const auth = "Basic " + Buffer.from(`${KEY}:`).toString("base64");

const CASTS = "out/anvil";
const MAPS = "src/forms/maps";
const FORMS = "samples/track3";
const OUT = "out/anvil-live";
mkdirSync(OUT, { recursive: true });

const form = process.argv[2] ?? "irs-56";
const recordId = process.argv[3] ?? "estate-05-in-formal-probate";

interface Cast {
  title: string;
  sourceFile: string;
  fieldInfo: { fields: { id: string; pageNum: number; rect: { x: number; y: number; width: number; height: number } }[] };
  bindings: { id: string; sourcePath: string; label: string; type: string; condition?: string }[];
}

const cast = JSON.parse(readFileSync(join(CASTS, `${form}.cast.json`), "utf8")) as Cast;
const fieldMap = JSON.parse(readFileSync(join(MAPS, `${form}.json`), "utf8")) as {
  entries: { field: string }[];
};
const pdfPath = join(FORMS, cast.sourceFile);
if (!existsSync(pdfPath)) throw new Error(`no source PDF at ${pdfPath}`);

interface Detected {
  id: string;
  name?: string;
  type: string;
  pageNum: number;
  rect?: { x: number; y: number; width: number; height: number };
}

async function createCast(): Promise<{ eid: string; fields: Detected[] }> {
  const operations = {
    query: `
      mutation CreateCast($title: String!, $file: Upload!, $detectFields: Boolean) {
        createCast(title: $title, file: $file, detectFields: $detectFields) {
          eid
          fieldInfo
        }
      }`,
    variables: { title: cast.title, file: null, detectFields: true },
  };

  const fd = new FormData();
  fd.append("operations", JSON.stringify(operations));
  fd.append("map", JSON.stringify({ "0": ["variables.file"] }));
  fd.append("0", new Blob([readFileSync(pdfPath)], { type: "application/pdf" }), cast.sourceFile);

  const res = await fetch(GRAPHQL, { method: "POST", headers: { Authorization: auth }, body: fd });
  const text = await res.text();
  if (!res.ok) throw new Error(`createCast ${res.status}: ${text.slice(0, 500)}`);
  const body = JSON.parse(text) as {
    data?: { createCast?: { eid: string; fieldInfo?: { fields?: Detected[] } } };
    errors?: { message: string }[];
  };
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "));
  const c = body.data?.createCast;
  if (!c) throw new Error(`no cast returned: ${text.slice(0, 300)}`);
  return { eid: c.eid, fields: c.fieldInfo?.fields ?? [] };
}

async function fill(eid: string, data: Record<string, unknown>): Promise<Buffer> {
  const res = await fetch(`${REST}/fill/${eid}.pdf`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`fill ${res.status}: ${(await res.text()).slice(0, 500)}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---------------------------------------------------------------------------

console.log(`\n${cast.title}`);

const t0 = Date.now();
const { eid, fields: detected } = await createCast();
console.log(`  cast ${eid} â€” Anvil detected ${detected.length} fields in ${Date.now() - t0}ms`);
writeFileSync(join(OUT, `${form}.detected.json`), JSON.stringify(detected, null, 1));

// Joined by position, not by name.
//
// Name matching worked for the IRS forms, whose fields keep a unique XFA name,
// and failed silently on DL 142: Anvil collapses its parent/child widgets and
// names most of them "0", so 28 bindings resolved to one radio group and
// overwrote each other. 26 values went in, 4 came out, and nothing was
// reported, because each lookup individually succeeded.
//
// Geometry is the one thing both sides should agree on: we read every rectangle
// out of the PDF and already converted it to Anvil's top-left origin. Each
// detected field can be claimed once, and anything ambiguous or unclaimed is
// reported rather than guessed.
const TOL = 3; // points — allows for rounding on either side, not for a wrong box

const anvilIdByAlias = new Map<string, string>();
const claimed = new Set<string>();
const unmatched: string[] = [];
const collisions: string[] = [];

const rectOf = new Map(cast.fieldInfo.fields.map((f) => [f.id, f]));

for (const b of cast.bindings) {
  const mine = rectOf.get(b.id);
  if (!mine) {
    unmatched.push(`${b.field} (no rect)`);
    continue;
  }
  const near = detected.filter(
    (d) =>
      !claimed.has(d.id) &&
      d.pageNum === mine.pageNum &&
      Math.abs((d.rect?.x ?? -999) - mine.rect.x) <= TOL &&
      Math.abs((d.rect?.y ?? -999) - mine.rect.y) <= TOL,
  );
  if (near.length === 0) {
    unmatched.push(b.field);
    continue;
  }
  if (near.length > 1) {
    collisions.push(`${b.field} matches ${near.length} Anvil fields at the same point`);
    continue;
  }
  claimed.add(near[0].id);
  anvilIdByAlias.set(b.id, near[0].id);
}
console.log(
  `  joined ${anvilIdByAlias.size}/${cast.bindings.length} bindings` +
    (unmatched.length ? `, ${unmatched.length} unmatched` : "") +
    (collisions.length ? `, ${collisions.length} COLLISIONS` : ""),
);
for (const c of collisions.slice(0, 4)) console.log(`    ! ${c}`);
for (const u of unmatched.slice(0, 4)) console.log(`    ? no Anvil field for ${u}`);

// Build the payload against our own aliases, then translate the keys.
const record = JSON.parse(readFileSync(join(FORMS, `${recordId}.json`), "utf8")) as EstateRecord;
const { data, gaps } = castPayload(cast as never, record);
console.log(`  castPayload -> ${Object.keys(data).length} raw values from ${cast.bindings.length} bindings (record ${recordId})`);

// Form 56's line-1 group and its two date lines belong to the rule pack, not to
// the field map — a purely structural mapping fills both date boxes, and only
// the authority basis says which one is live. The local filler already applies
// this; the Anvil path did not, which is why the date of death and the
// signature title came back blank from an otherwise correct fill.
if (form === "irs-56") {
  const ov = form56Overrides(record);
  const byWidget = new Map(cast.bindings.map((b) => [b.field, b.id]));
  for (const widget of ov.clear) {
    const alias = byWidget.get(widget);
    if (alias) delete data[alias];
  }
  for (const [widget, value] of Object.entries(ov.set)) {
    const alias = byWidget.get(widget);
    if (alias) data[alias] = value.startsWith("/") ? true : value;
  }
  for (const u of ov.unresolved) console.log(`    ! ${u}`);
}

const anvilData: Record<string, unknown> = {};
let dropped = 0;
for (const [alias, value] of Object.entries(data)) {
  const id = anvilIdByAlias.get(alias);
  if (!id) {
    dropped++;
    continue;
  }
  anvilData[id] = value;
}
console.log(`  payload ${Object.keys(anvilData).length} values, ${gaps.length} gaps, ${dropped} unroutable`);

const t1 = Date.now();
const pdf = await fill(eid, anvilData);
const dest = join(OUT, `${form}__${recordId}.pdf`);
writeFileSync(dest, pdf);
console.log(`  filled in ${Date.now() - t1}ms -> ${dest} (${Math.round(pdf.length / 1024)}KB)`);

writeFileSync(
  join(OUT, `${form}.run.json`),
  JSON.stringify(
    {
      form,
      recordId,
      castEid: eid,
      detectedFields: detected.length,
      joined: anvilIdByAlias.size,
      valuesSent: Object.keys(anvilData).length,
      ranAt: new Date().toISOString(),
    },
    null,
    1,
  ),
);





