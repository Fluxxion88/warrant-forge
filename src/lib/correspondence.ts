// Correspondence.
//
// A settlement specialist spends a large share of their week writing the same
// letters: notifying an institution of a death, chasing a claim, and sending
// the family their weekly update. Each one is assembled by hand from facts that
// already exist in a case file, and each one needs the right enclosures or it
// comes back.
//
// So correspondence is generated the same way a form is filled: merge fields
// resolve only from the verified ledger, enclosures are computed from what the
// recipient actually requires, and a letter with an unresolved required field
// is refused rather than sent with a gap in it.
//
// No model writes these. The wording is a reviewed template; the facts are
// warranted; the specialist reads it and presses send. That is the difference
// between "AI wrote your letter" and "the letter is correct".

import { ledger, type Fact, type FactKey } from "./facts";
import type { AuthorityDoc } from "./leads";

export type LetterChannel = "email" | "postal" | "fax" | "portal";

export interface EnclosureSpec {
  id: AuthorityDoc | "filled_form" | "inventory";
  label: string;
  /** Certified copies cost money and take days; say when one is needed. */
  certified: boolean;
}

export interface LetterTemplate {
  id: string;
  purpose: string;
  /** Who this is written to, in the abstract. */
  audience: "institution" | "family" | "court" | "professional" | "creditor";
  subject: string;
  /** Paragraphs. `{fact.key}` placeholders resolve from the ledger. */
  body: string[];
  /** Facts that must be verified before the letter may be produced. */
  requires: FactKey[];
  enclosures: EnclosureSpec[];
  channels: LetterChannel[];
  signOff: string;
  /** Minutes a specialist would spend drafting and assembling this by hand. */
  manualMinutes: number;
}

export interface MergeGap {
  key: FactKey;
  placeholder: string;
}

export interface Letter {
  templateId: string;
  purpose: string;
  subject: string;
  paragraphs: string[];
  enclosures: EnclosureSpec[];
  channels: LetterChannel[];
  recipient: string;
  /** Fact keys used, so every statement in the letter is traceable. */
  citedFacts: FactKey[];
  /** Required facts we do not hold. Non-empty means the letter is refused. */
  gaps: MergeGap[];
  ready: boolean;
  manualMinutes: number;
}

const PLACEHOLDER = /\{([a-z0-9_.]+)\}/gi;

function fmt(v: Fact["value"], unit?: string): string {
  if (typeof v === "number") {
    return unit === "USD" ? `$${v.toLocaleString("en-US")}` : v.toLocaleString("en-US");
  }
  if (typeof v === "boolean") return v ? "yes" : "no";
  // Dates read better spelled out in a letter than as an ISO string.
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
  if (iso) {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    return `${Number(iso[3])} ${months[Number(iso[2]) - 1]} ${iso[1]}`;
  }
  return String(v);
}

/**
 * Render one letter against the ledger.
 *
 * Every placeholder is resolved from a verified fact or reported as a gap.
 * Nothing is invented, and no placeholder is silently left in the text — a
 * letter that reaches a bank with `{decedent.full_name}` in it is worse than
 * no letter at all.
 */
export function renderLetter(
  template: LetterTemplate,
  facts: Fact[],
  recipient: string,
): Letter {
  const current = ledger(facts);
  const gaps: MergeGap[] = [];
  const cited = new Set<FactKey>();

  const resolve = (text: string): string =>
    text.replace(PLACEHOLDER, (whole, key: string) => {
      const fact = current.get(key);
      if (!fact) {
        if (!gaps.some((g) => g.key === key)) gaps.push({ key, placeholder: whole });
        return whole;
      }
      cited.add(key);
      return fmt(fact.value, fact.unit);
    });

  const subject = resolve(template.subject);
  const paragraphs = template.body.map(resolve).map((s) => s.replace(/\s+/g, " ").trim());

  for (const key of template.requires) {
    if (!current.has(key) && !gaps.some((g) => g.key === key)) {
      gaps.push({ key, placeholder: `{${key}}` });
    }
  }

  return {
    templateId: template.id,
    purpose: template.purpose,
    subject,
    paragraphs,
    enclosures: template.enclosures,
    channels: template.channels,
    recipient,
    citedFacts: [...cited].sort(),
    gaps,
    ready: gaps.length === 0,
    manualMinutes: template.manualMinutes,
  };
}

/** Plain text, ready to paste into an email client or print. */
export function toPlainText(letter: Letter): string {
  const lines: string[] = [];
  lines.push(`To: ${letter.recipient}`);
  lines.push(`Subject: ${letter.subject}`);
  lines.push("");
  lines.push(...letter.paragraphs.flatMap((p) => [p, ""]));
  if (letter.enclosures.length > 0) {
    lines.push("Enclosures:");
    for (const e of letter.enclosures) {
      lines.push(`  - ${e.label}${e.certified ? " (certified copy)" : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export interface CorrespondencePlan {
  letters: Letter[];
  ready: number;
  blocked: number;
  /** Specialist minutes this run would replace, if every ready letter is used. */
  minutesSaved: number;
}

export function planCorrespondence(
  items: { template: LetterTemplate; recipient: string }[],
  facts: Fact[],
): CorrespondencePlan {
  const letters = items.map((i) => renderLetter(i.template, facts, i.recipient));
  const ready = letters.filter((l) => l.ready);
  return {
    letters,
    ready: ready.length,
    blocked: letters.length - ready.length,
    minutesSaved: ready.reduce((sum, l) => sum + l.manualMinutes, 0),
  };
}
