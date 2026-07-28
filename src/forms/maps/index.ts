// The four discovered field maps, as modules.
//
// Loaded by import rather than by reading the directory so the same code runs
// in the browser and in node. A `fs.readdirSync` here would work in tools and
// tests and fail silently in the app, which is the worst way to discover a
// portability problem.

import caDl142 from "./ca-dl142.json";
import irs56 from "./irs-56.json";
import irs8821 from "./irs-8821.json";
import irsSs4 from "./irs-ss4.json";
import type { FieldMap } from "../../lib/formmap";

export const FIELD_MAPS: FieldMap[] = [
  caDl142 as FieldMap,
  irs56 as FieldMap,
  irs8821 as FieldMap,
  irsSs4 as FieldMap,
];

export function mapFor(form: string): FieldMap | undefined {
  return FIELD_MAPS.find((m) => m.form === form);
}

/** Which decision point governs each form. */
export const GOVERNED_BY: Record<string, string> = {
  "ca-dl142": "form_dl142",
  "irs-ss4": "form_ss4",
  "irs-56": "form_56",
  "irs-8821": "form_8821",
};

/** Rule ids that mean "this form is required". */
export const AFFIRMATIVE_RULES = new Set([
  "form.dl142.applies",
  "form.ss4.needed",
  "form.56.needed",
  "form.8821.needed",
]);
