// Generating Anvil Casts from a form we have already understood.
//
// Anvil fills PDFs through a *Cast*: an uploaded template plus a description of
// where every field sits and what kind of field it is. Building a Cast by hand
// means dragging boxes onto a PDF in a web UI â€” perfectly reasonable for a
// handful of forms, and completely unworkable for the several hundred a
// nationwide estate practice touches. Alix's own framing of Track 3 is the
// volume problem, not the single-form problem.
//
// Everything a Cast needs, we already have. `tools/geometry.py` read each
// widget's rectangle straight out of the PDF, and the verified field map says
// what each widget means. So a Cast is a projection of two artefacts we built
// for other reasons, and onboarding a new form becomes: extract geometry,
// discover the map, generate the Cast.
//
// The one real subtlety is the coordinate flip. PDF puts the origin at the
// bottom-left of the page; Anvil, like most form APIs, measures from the top.
// Getting this wrong does not error â€” it silently places every field a
// mirror-image distance down the page, which looks like a rendering bug and is
// arithmetic. Page heights are carried in the geometry file precisely so this
// conversion never has to be guessed.

import type { FieldMap, FormGeometry, Widget } from "./formmap";
import { evaluateCondition } from "./fill";
import { readPath } from "./facts";

/** Anvil field kinds this generator emits. */
export type AnvilFieldType = "shortText" | "longText" | "checkbox" | "date" | "ssn" | "ein" | "phone";

export interface AnvilCastField {
  /** Stable, human-readable id used when filling. */
  id: string;
  type: AnvilFieldType;
  /** Zero-based, as Anvil expects. */
  pageNum: number;
  rect: { x: number; y: number; width: number; height: number };
  /** The record path this field is fed from. Not sent to Anvil; kept for us. */
  sourcePath: string;
  /** The printed label that justified the mapping. Also ours, not Anvil's. */
  label: string;
  /** Checkbox condition, in the grammar `parseCondition` accepts. */
  condition?: string;
  /**
   * The AcroForm widget name this came from.
   *
   * Carried so a consumer can join to a filler by name instead of by position.
   * Position is fragile here: `buildCast` skips any map entry whose widget is
   * missing from the geometry, so bindings and map entries can differ in
   * length, and an index-based join would then place every subsequent value in
   * the wrong box with nothing to signal it.
   */
  field: string;
}

export interface AnvilCast {
  title: string;
  /** The PDF to upload. */
  sourceFile: string;
  fieldInfo: { fields: Omit<AnvilCastField, "sourcePath" | "label" | "field" | "condition">[] };
  /** Our side of the mapping, so a fill payload can be built by id. */
  bindings: {
    id: string;
    /** The AcroForm widget this binding came from â€” the join key to Anvil. */
    field: string;
    sourcePath: string;
    label: string;
    type: AnvilFieldType;
    /** Checkbox condition, in the grammar `parseCondition` accepts. */
    condition?: string;
  }[];
}

/**
 * Choose a field type from the record path and the widget's shape.
 *
 * Typing matters beyond cosmetics: Anvil validates and formats by type, so an
 * SSN typed as `ssn` is checked and rendered in the boxes the form expects,
 * where the same value as `shortText` is written raw and may overflow. The
 * cheap win is that these government forms name their concepts consistently
 * enough for the path to carry the type.
 */
export function inferType(path: string, w: Widget): AnvilFieldType {
  if (w.type === "/Btn") return "checkbox";
  const p = path.toLowerCase();
  if (/\bssn\b|socialsecurity|responsiblepartytin|grantortin/.test(p)) return "ssn";
  if (/\bein\b/.test(p)) return "ein";
  if (/phone|faxnumber/.test(p)) return "phone";
  if (/date|dateof/.test(p)) return "date";

  // A tall or very wide box is a paragraph field. The threshold is the height
  // of roughly two lines of 10pt text, which is what these forms use for
  // free-text explanations.
  const height = Math.abs(w.rect[3] - w.rect[1]);
  const width = Math.abs(w.rect[2] - w.rect[0]);
  if (height > 26 || (width > 400 && height > 18)) return "longText";
  return "shortText";
}

/**
 * Turn a dotted record path into a camelCase id, disambiguating collisions.
 *
 * Two widgets can legitimately share a source path â€” a value printed twice on
 * one form, or a name repeated in a signature block. Anvil ids must be unique,
 * so later occurrences get a numeric suffix rather than silently overwriting.
 */
export function toFieldId(path: string, taken: Set<string>): string {
  const camel = path
    .split(".")
    .filter((s) => s && !/^\d+$/.test(s))
    .map((s, i) => (i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)))
    .join("")
    .replace(/[^A-Za-z0-9]/g, "");

  // Array indices carry meaning on these forms â€” designee 0 and designee 1 are
  // different people â€” so fold the index back in rather than dropping it.
  const idx = path.split(".").filter((s) => /^\d+$/.test(s));
  let base = camel + (idx.length ? idx.map((n) => String(Number(n) + 1)).join("") : "");
  if (!base) base = "field";

  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}${n++}`;
  taken.add(id);
  return id;
}

/**
 * Build the Cast. Only verified mappings become fields: an unmapped widget has
 * no source, and a rejected one failed its evidence check, so neither belongs
 * in a template that will be filled unattended.
 */
export function buildCast(
  geometry: FormGeometry,
  map: FieldMap,
  title: string,
): AnvilCast {
  const byName = new Map(geometry.widgets.map((w) => [w.name, w]));
  const heights = new Map((geometry.pageSizes ?? []).map((p) => [p.page, p.height]));
  const taken = new Set<string>();
  const fields: AnvilCastField[] = [];

  for (const e of map.entries) {
    const w = byName.get(e.field);
    if (!w) continue;
    const pageHeight = heights.get(w.page);
    if (pageHeight === undefined) {
      throw new Error(`geometry for ${geometry.form} has no page size for page ${w.page}`);
    }

    const [x0, y0, x1, y1] = w.rect;
    fields.push({
      id: toFieldId(e.target, taken),
      type: inferType(e.target, w),
      pageNum: w.page - 1,
      rect: {
        x: round(Math.min(x0, x1)),
        // The flip: PDF measures y up from the bottom, Anvil down from the top.
        y: round(pageHeight - Math.max(y0, y1)),
        width: round(Math.abs(x1 - x0)),
        height: round(Math.abs(y1 - y0)),
      },
      sourcePath: e.target,
      label: e.labelQuote,
      condition: e.condition,
      field: e.field,
    });
  }

  return {
    title,
    sourceFile: map.sourceFile,
    fieldInfo: {
      fields: fields.map(({ id, type, pageNum, rect }) => ({ id, type, pageNum, rect })),
    },
    bindings: fields.map(({ id, sourcePath, label, type, condition, field }) => ({
      id,
      field,
      sourcePath,
      label,
      type,
      ...(condition ? { condition } : {}),
    })),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Build the payload for Anvil's fill endpoint from a Cast's bindings and an
 * estate record. Mirrors `fill.ts` but keys by Anvil id instead of by widget
 * name, and reports the same gaps â€” a box Anvil leaves empty is still a box
 * somebody has to chase.
 */
export function castPayload(
  cast: AnvilCast,
  record: unknown,
): { data: Record<string, unknown>; gaps: string[] } {
  const data: Record<string, unknown> = {};
  const gaps: string[] = [];

  for (const b of cast.bindings) {
    if (b.type === "checkbox") {
      // A checkbox is decided by its condition, never by whether its target
      // path happens to hold something truthy. Seven of Form 56's line-1 boxes
      // share the single target `authority.basis`; a truthiness test ticks all
      // seven at once and tells the IRS the fiduciary's authority arises from
      // every provision on the form simultaneously.
      const verdict = b.condition ? evaluateCondition(b.condition, record) : null;
      if (verdict === null) {
        gaps.push(
          `${b.sourcePath} (checkbox â€” ${b.condition ? "condition unknown" : "no condition"})`,
        );
        continue;
      }
      // Only a ticked box is sent. Sending `false` printed the literal word
      // "false" onto page 2 of a filed IRS form â€” the renderer draws whatever
      // value it is given, and an unticked box is the absence of a value rather
      // than the presence of a negative one.
      if (verdict) data[b.id] = true;
      continue;
    }

    const v = readPath(record, b.sourcePath);
    if (v === undefined || v === null || v === "") {
      gaps.push(b.sourcePath);
      continue;
    }
    // Anvil takes ISO for date fields and renders per the form's locale.
    if (b.type === "date" && typeof v === "string") {
      data[b.id] = v;
      continue;
    }
    data[b.id] = typeof v === "boolean" ? (v ? "Yes" : "No") : String(v);
  }

  return { data, gaps };
}

/**
 * Sanity checks that must hold before a Cast is uploaded.
 *
 * These are cheap and they catch the failures that are invisible once a
 * template is live: a field placed off the page renders nowhere, a zero-sized
 * rect swallows its value, and duplicate ids mean one field silently wins.
 */
export function validateCast(cast: AnvilCast, geometry: FormGeometry): string[] {
  const problems: string[] = [];
  const sizes = new Map((geometry.pageSizes ?? []).map((p) => [p.page - 1, p]));
  const seen = new Set<string>();

  for (const f of cast.fieldInfo.fields) {
    if (seen.has(f.id)) problems.push(`duplicate field id "${f.id}"`);
    seen.add(f.id);

    const page = sizes.get(f.pageNum);
    if (!page) {
      problems.push(`${f.id}: page ${f.pageNum} is not in the geometry`);
      continue;
    }
    if (f.rect.width <= 0 || f.rect.height <= 0) {
      problems.push(`${f.id}: zero-sized rect`);
    }
    if (f.rect.x < 0 || f.rect.y < 0) {
      problems.push(`${f.id}: negative origin (${f.rect.x}, ${f.rect.y})`);
    }
    if (f.rect.x + f.rect.width > page.width + 1) {
      problems.push(`${f.id}: extends past the right edge`);
    }
    if (f.rect.y + f.rect.height > page.height + 1) {
      problems.push(`${f.id}: extends past the bottom edge â€” check the coordinate flip`);
    }
  }
  return problems;
}

