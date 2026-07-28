// Form filling, with provenance carried all the way onto the paper.
//
// The rules engine already decides *which* forms an estate needs. This module
// decides what goes in each box — and refuses to write a box whose value is not
// backed by a verified fact.
//
// That refusal is the point. A form filler that guesses is worse than no form
// filler at all: a wrong figure on a DE-310 is a rejected petition and another
// month of the family's life. So a field is only emitted when a fact with a
// warrant supports it; everything else is reported as a gap, by field, with the
// document you would need to go and find.

import { ledger, type Fact, type FactKey } from "./facts";

export type FieldFormat = "text" | "usd" | "date" | "yesno";

export interface FieldBinding {
  /** Field alias as configured on the Anvil template. */
  alias: string;
  label: string;
  /** Which fact supplies the value. */
  factKey?: FactKey;
  /** A fixed value, for boxes that do not vary (form title, court name). */
  constant?: string;
  /** Several facts joined by a template, e.g. "{a}, {b} County". */
  template?: { pattern: string; keys: FactKey[] };
  required: boolean;
  format?: FieldFormat;
  /** Item number on the paper form, so a reviewer can find the box. */
  item?: string;
}

export interface FormTemplate {
  code: string;
  title: string;
  /** Anvil template (cast) eid. Set once the PDF is uploaded to Anvil. */
  anvilTemplateId?: string;
  authority: string;
  fields: FieldBinding[];
}

export type FieldStatus = "filled" | "missing" | "constant";

export interface FieldFill {
  alias: string;
  label: string;
  item?: string;
  status: FieldStatus;
  value: string | null;
  provenance?: {
    factKey: FactKey;
    document: string;
    quote: string;
    derivation?: string;
  };
  /** Set when the field could not be filled. */
  needs?: FactKey[];
}

export interface FormFill {
  form: FormTemplate;
  fields: FieldFill[];
  /** True when every required field has a value. */
  complete: boolean;
  missingRequired: FactKey[];
  /** Exactly the object to send as Anvil's `data`. */
  payload: Record<string, string>;
}

function fmt(value: Fact["value"], format: FieldFormat | undefined): string {
  if (format === "usd" && typeof value === "number") {
    return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }
  if (format === "yesno") return value === true ? "Yes" : "No";
  if (format === "date" && typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  }
  if (typeof value === "number") return value.toLocaleString("en-US");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function provenanceOf(fact: Fact) {
  const w = fact.warrant;
  if (w.kind === "quote") {
    return {
      factKey: fact.key,
      document: w.matchedDocument ?? w.document,
      quote: w.quote,
    };
  }
  if (w.kind === "record") {
    // Provenance for an imported fact is the system, record and field it came
    // from. That is what a reviewer needs to go and look at the source.
    return {
      factKey: fact.key,
      document: `${w.system}:${w.recordId}`,
      quote: w.raw,
      derivation: `field ${w.path}`,
    };
  }
  return {
    factKey: fact.key,
    document: "computed",
    quote: w.formula,
    derivation: w.formula,
  };
}

/**
 * Resolve one form against the verified ledger.
 *
 * Only `ledger()` is consulted, so a quarantined fact is invisible here exactly
 * as it is to the rules engine. A fabricated value cannot reach a PDF.
 */
export function buildFill(form: FormTemplate, facts: Fact[]): FormFill {
  const current = ledger(facts);
  const fields: FieldFill[] = [];
  const payload: Record<string, string> = {};
  const missingRequired: FactKey[] = [];

  for (const binding of form.fields) {
    if (binding.constant !== undefined) {
      fields.push({
        alias: binding.alias,
        label: binding.label,
        item: binding.item,
        status: "constant",
        value: binding.constant,
      });
      payload[binding.alias] = binding.constant;
      continue;
    }

    if (binding.template) {
      const parts = binding.template.keys.map((k) => current.get(k));
      if (parts.some((p) => p === undefined)) {
        const needs = binding.template.keys.filter((k) => !current.has(k));
        if (binding.required) missingRequired.push(...needs);
        fields.push({
          alias: binding.alias,
          label: binding.label,
          item: binding.item,
          status: "missing",
          value: null,
          needs,
        });
        continue;
      }
      let text = binding.template.pattern;
      binding.template.keys.forEach((_key, i) => {
        text = text.replace(`{${i}}`, fmt(parts[i]!.value, binding.format));
      });
      fields.push({
        alias: binding.alias,
        label: binding.label,
        item: binding.item,
        status: "filled",
        value: text,
        provenance: provenanceOf(parts[0]!),
      });
      payload[binding.alias] = text;
      continue;
    }

    const fact = binding.factKey ? current.get(binding.factKey) : undefined;
    if (!fact) {
      if (binding.required && binding.factKey) missingRequired.push(binding.factKey);
      fields.push({
        alias: binding.alias,
        label: binding.label,
        item: binding.item,
        status: "missing",
        value: null,
        needs: binding.factKey ? [binding.factKey] : [],
      });
      continue;
    }

    const value = fmt(fact.value, binding.format);
    fields.push({
      alias: binding.alias,
      label: binding.label,
      item: binding.item,
      status: "filled",
      value,
      provenance: provenanceOf(fact),
    });
    payload[binding.alias] = value;
  }

  return {
    form,
    fields,
    complete: missingRequired.length === 0,
    missingRequired: [...new Set(missingRequired)].sort(),
    payload,
  };
}

/**
 * Summary line for the UI.
 *
 * Says "bound fields" rather than "fields", because the denominator is the
 * number of bindings this template declares, not the number of boxes on the
 * printed form. Those differ by a lot: the SS-4 template here binds 8 fields
 * and the actual PDF has 89 widgets, of which the discovered map covers 71.
 * "7 of 8 fields resolved" is true of our bindings and wildly flattering as a
 * statement about the form, and a reader has no way to tell which was meant.
 */
export function fillSummary(fill: FormFill): string {
  const filled = fill.fields.filter((f) => f.status !== "missing").length;
  const n = fill.fields.length;
  return `${filled} of ${n} bound field${n === 1 ? "" : "s"} resolved from verified facts`;
}

// ---------------------------------------------------------------------------
// Reconciliation against the live template
// ---------------------------------------------------------------------------

/** A field as Anvil's detection actually recorded it. */
export interface AnvilField {
  id: string;
  name?: string;
  type?: string;
  pageNum?: number;
}

export interface Reconciliation {
  formCode: string;
  matched: string[];
  /** Bound by us, absent from the template — these values are silently dropped. */
  missingInAnvil: string[];
  /** Present on the template, unbound by us — blank boxes on the filed form. */
  unboundInAnvil: string[];
  ok: boolean;
}

/**
 * Anvil returns `fieldInfo` as a loosely-typed blob whose shape has varied.
 * Accept the plausible variants rather than crashing on one of them.
 */
export function parseFieldInfo(raw: unknown): AnvilField[] {
  const rows: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === "object" && raw !== null && Array.isArray((raw as { fields?: unknown[] }).fields)
      ? ((raw as { fields: unknown[] }).fields)
      : [];

  const out: AnvilField[] = [];
  for (const r of rows) {
    if (typeof r === "string") {
      out.push({ id: r });
      continue;
    }
    if (typeof r === "object" && r !== null) {
      const o = r as Record<string, unknown>;
      const id = o.id ?? o.aliasId ?? o.name;
      if (typeof id === "string") {
        out.push({
          id,
          name: typeof o.name === "string" ? o.name : undefined,
          type: typeof o.type === "string" ? o.type : undefined,
          pageNum: typeof o.pageNum === "number" ? o.pageNum : undefined,
        });
      }
    }
  }
  return out;
}

/**
 * Compare our bindings against the template Anvil actually holds.
 *
 * This exists because the fill endpoint fails silently: a value written to a
 * field alias that does not exist is dropped, and you get back a PDF that looks
 * fine with an empty box in the middle of it. On a probate petition that is a
 * rejected filing and another month gone, so drift has to be detectable
 * *before* anyone files.
 */
export function reconcile(form: FormTemplate, anvilFields: AnvilField[]): Reconciliation {
  const ours = new Set(form.fields.map((f) => f.alias));
  const theirs = new Set(anvilFields.map((f) => f.id));

  const matched = [...ours].filter((a) => theirs.has(a)).sort();
  const missingInAnvil = [...ours].filter((a) => !theirs.has(a)).sort();
  const unboundInAnvil = [...theirs].filter((a) => !ours.has(a)).sort();

  return {
    formCode: form.code,
    matched,
    missingInAnvil,
    unboundInAnvil,
    ok: missingInAnvil.length === 0,
  };
}

/** The alias list to hand `createCast`, so detection maps onto our bindings. */
export function aliasIds(form: FormTemplate): string[] {
  return form.fields.map((f) => f.alias);
}

export interface AnvilFillRequest {
  templateId: string;
  title: string;
  data: Record<string, string>;
}

/**
 * Hand off to Rust to perform the call. The Anvil key follows the same rule as
 * every model key in this codebase: it lives in an owner-only file and the
 * frontend never sees it.
 */
export function toAnvilRequest(fill: FormFill, estateName: string): AnvilFillRequest | null {
  if (!fill.form.anvilTemplateId) return null;
  return {
    templateId: fill.form.anvilTemplateId,
    title: `${fill.form.code} — ${estateName}`,
    data: fill.payload,
  };
}
