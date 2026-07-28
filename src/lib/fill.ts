// Turning a verified field map plus an estate record into a filled form.
//
// The map says which widget holds which record path. This module walks that
// map, reads each path, formats the value for the box it is going into, and
// reports what it could not fill and why. It does not decide *whether* a form
// should be filed — that is a rule, and rules live in src/rules. It only fills.
//
// The governing principle is that an unfilled box is a finding, not a failure.
// Half of what makes estate paperwork slow is discovering, three weeks after
// filing, that line 7b was blank. A filler that silently leaves gaps has moved
// the discovery later; a filler that invents plausible values has moved it
// later still and made it worse. So every unfilled box comes back named, with
// the record path that would have supplied it.

import { readPath } from "./facts";
import { parseCondition, type FieldMap } from "./formmap";

/**
 * Why a path yielded nothing.
 *
 * The distinction between these two is the difference between an alarm and a
 * shrug, and collapsing them makes the alarm worthless. Form 8821 prints two
 * designee slots; an estate with one adviser leaves the second slot empty, and
 * that is simply how the form works — `absent_index`. But a map pointing at
 * `form8821.designees.0.cafNumbre` means the map and the schema have drifted
 * apart and every form built from it is quietly wrong — `missing`.
 *
 * The first is expected on most records. The second should never happen, which
 * is exactly why it has to be loud when it does.
 */
type Probe =
  | { kind: "value"; value: unknown }
  | { kind: "absent_index" }
  | { kind: "absent_branch" }
  | { kind: "missing" };

function probePath(source: unknown, path: string): Probe {
  let node: unknown = source;
  for (const seg of path.split(".")) {
    // Reaching a null mid-walk means the parent key existed and held null —
    // "this estate has no third-party designee", not "the schema changed".
    // Records in this format use explicit nulls everywhere, so treating them
    // as drift would flag most of a healthy record as broken.
    if (node === null) return { kind: "absent_branch" };
    if (node === undefined) return { kind: "missing" };
    if (Array.isArray(node)) {
      const idx = Number(seg);
      if (!Number.isInteger(idx)) return { kind: "missing" };
      // An index past the end is an empty slot, not a broken mapping.
      if (idx >= node.length) return { kind: "absent_index" };
      node = node[idx];
      continue;
    }
    if (typeof node !== "object") return { kind: "missing" };
    if (!(seg in (node as Record<string, unknown>))) return { kind: "missing" };
    node = (node as Record<string, unknown>)[seg];
  }
  return { kind: "value", value: node };
}

export type FillStatus = "filled" | "empty_in_record" | "path_missing" | "condition_false";

export interface FilledField {
  field: string;
  target: string;
  page: number;
  type: string;
  /** The value to write, formatted for the widget. Absent when not filled. */
  value?: string;
  /** For a checkbox, the appearance state to set. */
  onState?: string;
  status: FillStatus;
  note?: string;
}

export interface FormFilling {
  form: string;
  sourceFile: string;
  fields: FilledField[];
  filled: number;
  /** Boxes with a mapping whose record path held nothing. */
  gaps: FilledField[];
  /** Boxes whose mapped path does not exist in this record at all. */
  broken: FilledField[];
}

/** Format a scalar for a printed box. */
export function formatForBox(value: unknown, target: string): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    // Money fields on these forms are whole-dollar; counts are not money.
    if (/value|amount|bond/i.test(target)) {
      return Number.isInteger(value) ? String(value) : value.toFixed(2);
    }
    return String(value);
  }
  const s = String(value);
  // ISO dates are how Alix stores them and are not how any of these forms want
  // them. Every one of the four uses US month/day/year.
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;
  return s;
}

/**
 * Evaluate a checkbox condition of the form `path == Value` or `path != Value`,
 * plus the bare `path` form for booleans.
 *
 * Deliberately tiny. A checkbox condition that needs more than this is a rule,
 * and belongs in the rule pack where it can carry a citation — not buried in a
 * field map where nobody will ever audit it.
 */
export function evaluateCondition(condition: string, record: unknown): boolean | null {
  const parsed = parseCondition(condition);
  // Unparseable is *unknown*, never false — and mappings carrying such a
  // condition are refused at verification time, so one should never reach here.
  if (!parsed) return null;

  const actual = readPath(record, parsed.path);
  if (actual === undefined || actual === null) return null;

  if (parsed.op === "truthy") {
    return Array.isArray(actual) ? actual.length > 0 : Boolean(actual);
  }

  if (parsed.op === "includes") {
    // Membership of a list — how these forms model "check all that apply".
    if (!Array.isArray(actual)) return null;
    const want = norm(parsed.value ?? "");
    return actual.some((x) => norm(String(x)) === want);
  }

  let want: unknown = parsed.value ?? "";
  if (want === "true") want = true;
  else if (want === "false") want = false;
  else if (want === "null") want = null;

  const eq =
    typeof want === "string" && typeof actual === "string"
      ? norm(actual) === norm(want)
      : actual === want;
  return parsed.op === "==" ? eq : !eq;
}

/**
 * Compare loosely enough to survive the record's own inconsistencies. Alix's
 * enums arrive as "1040_or_1040SR" in one field and "1040" in another, and
 * cities are stored ALL-CAPS where the source system had them that way.
 */
function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function fillForm(map: FieldMap, record: unknown): FormFilling {
  const fields: FilledField[] = [];

  for (const e of map.entries) {
    const base = { field: e.field, target: e.target, page: e.page, type: e.type };

    if (e.type === "/Btn") {
      // A checkbox with a condition ticks only when the condition holds. A
      // checkbox without one ticks on a truthy value at its target path.
      const verdict = e.condition
        ? evaluateCondition(e.condition, record)
        : evaluateCondition(e.target, record);

      if (verdict === null) {
        fields.push({
          ...base,
          status: "empty_in_record",
          note: e.condition ? `Condition "${e.condition}" is unknown.` : "No value at path.",
        });
      } else if (verdict) {
        fields.push({ ...base, status: "filled", onState: e.onState ?? "/1" });
      } else {
        fields.push({ ...base, status: "condition_false" });
      }
      continue;
    }

    const probe = probePath(record, e.target);
    if (probe.kind === "missing") {
      fields.push({
        ...base,
        status: "path_missing",
        note: `Record has no path "${e.target}".`,
      });
      continue;
    }
    if (probe.kind === "absent_index" || probe.kind === "absent_branch") {
      fields.push({
        ...base,
        status: "empty_in_record",
        note:
          probe.kind === "absent_index"
            ? "Form provides this slot; the record has no entry for it."
            : "This branch of the record is null for this estate.",
      });
      continue;
    }
    if (probe.value === null || probe.value === "") {
      fields.push({ ...base, status: "empty_in_record" });
      continue;
    }
    fields.push({ ...base, status: "filled", value: formatForBox(probe.value, e.target) });
  }

  return {
    form: map.form,
    sourceFile: map.sourceFile,
    fields,
    filled: fields.filter((f) => f.status === "filled").length,
    gaps: fields.filter((f) => f.status === "empty_in_record"),
    broken: fields.filter((f) => f.status === "path_missing"),
  };
}

/**
 * The payload a PDF filler consumes: widget name → value or tick state.
 * Only filled fields appear, so an unmapped or empty box is left untouched
 * rather than written blank.
 */
export function toFillPayload(filling: FormFilling): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of filling.fields) {
    if (f.status !== "filled") continue;
    out[f.field] = f.type === "/Btn" ? (f.onState ?? "/1") : (f.value ?? "");
  }
  return out;
}

export function fillReport(filling: FormFilling): string {
  const total = filling.fields.length;
  const lines = [
    `${filling.form} (${filling.sourceFile})`,
    `  ${filling.filled}/${total} mapped boxes filled`,
  ];
  if (filling.gaps.length) {
    lines.push(`  ${filling.gaps.length} empty in this record:`);
    for (const g of filling.gaps.slice(0, 12)) lines.push(`    ${g.target || g.field}`);
    if (filling.gaps.length > 12) lines.push(`    ... and ${filling.gaps.length - 12} more`);
  }
  if (filling.broken.length) {
    lines.push(`  ${filling.broken.length} MAPPED TO A PATH THIS RECORD DOES NOT HAVE:`);
    for (const b of filling.broken) lines.push(`    ${b.field} -> ${b.target}`);
  }
  return lines.join("\n");
}
