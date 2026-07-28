// Settle an arbitrary estate, end to end.
//
// Everything else in this codebase is a stage: extract, verify, derive, decide,
// fill. This composes them into one call that takes a scenario and returns
// everything a settlement specialist needs to act on — and, just as
// importantly, everything the engine could not work out and exactly why.
//
// Two design commitments shape the output.
//
// **The deliverable is a work plan, not a verdict.** A specialist does not need
// to be told "this estate routes to § 13151". They need an ordered list of what
// to do, what it depends on, what it costs, and which items are waiting on
// something. So `actions` is the primary output and the decisions are the
// reasoning behind it.
//
// **Nothing is dropped silently.** Every scenario produces an `unresolved` list.
// A rule that could not fire, a form we hold no template for, a jurisdiction
// with no rule pack, a fact a decision needed and did not get — each appears
// there with the reason. An empty section in a report should mean "nothing to
// do", never "we did not look", and the only way to keep that true is to make
// not-looking as visible as looking.
//
// The jurisdiction handling is the part worth reading. Three of the five sample
// estates are administered outside California, where the state rule pack simply
// does not apply. The engine does not pretend otherwise and does not fall back
// to California: it reports that federal obligations still attach, that the
// state-level questions are unanswered, and that a rule pack for that state is
// what would answer them.

import { integrity, quarantined, values, type Fact, type LedgerIntegrity } from "./facts";
import { decide, type Decision } from "./rules";
import { findGaps, readiness, type Gap } from "./gaps";
import { gates, type Gate } from "./risk";
import { blockingLeads, detectLeads, type Lead } from "./leads";
import { computeDeadlines, resolveTasks, type Deadline, type Task } from "./tasks";
import { detectRecurring, summariseBleed, type BleedSummary, type TransactionBatch } from "./transactions";
import { discoverAssets, type AssetHypothesis, type Suppressed } from "./discovery";
import { fillForm, toFillPayload, type FormFilling } from "./fill";
import { importEstate, type EstateRecord } from "./estate";
import { CA_OBTAIN_HINTS, CA_RULES, CA_THRESHOLDS, deriveCaFacts } from "../rules/ca-probate";
import { NY_OBTAIN_HINTS, NY_RULES, deriveNyFacts } from "../rules/ny-probate";
import { PA_OBTAIN_HINTS, PA_RULES, derivePaFacts } from "../rules/pa-probate";
import { TX_OBTAIN_HINTS, TX_RULES, deriveTxFacts } from "../rules/tx-probate";
import { appraisalAdvice, type AppraisalAdvice } from "./appraisal";
import { CA_COUNTIES, type CountyProfile } from "../rules/ca-counties";
import { FORM_RULES, form56Overrides } from "../rules/form-applicability";
import { AFFIRMATIVE_RULES, FIELD_MAPS, GOVERNED_BY } from "../forms/maps";
import type { SourceDoc } from "./verify";

export interface Scenario {
  id: string;
  label: string;
  /** An estate exported from a case-management system. */
  record: EstateRecord;
  /** Source documents, when we hold them. Optional: many estates arrive as data. */
  docs?: SourceDoc[];
  /** Bank data, for discovering assets nobody mentioned. */
  transactions?: TransactionBatch[];
  /** Date the analysis is as of. Deadlines are relative to it. */
  asOf?: string;
}

export type ActionKind =
  | "file_form"
  | "obtain_fact"
  | "investigate"
  | "contact"
  | "decide"
  | "wait";

export interface Action {
  id: string;
  kind: ActionKind;
  title: string;
  detail: string;
  /** Lower sorts first. */
  priority: number;
  /** What must happen before this can be done. */
  blockedBy?: string[];
  /** The rule or lead that generated it, for audit. */
  because: string;
  authority?: string;
  /** True when a human must sign or decide, not merely execute. */
  needsHuman: boolean;
}

export type UnresolvedKind =
  | "no_rule_pack"
  | "decision_blocked"
  | "form_unmodelled"
  | "fact_missing"
  | "hypothesis_unconfirmed"
  | "condition_unknown";

export interface Unresolved {
  kind: UnresolvedKind;
  what: string;
  why: string;
  /** What would resolve it. */
  needs: string[];
}

export interface FormOutcome {
  form: string;
  sourceFile: string;
  status: "fill" | "withheld" | "blocked" | "unmodelled";
  /** Why, in words a specialist can act on. */
  reason: string;
  ruleId?: string;
  authority?: string;
  filling?: FormFilling;
  payload?: Record<string, string>;
  /** Boxes the form has that this record cannot fill. */
  gaps?: string[];
}

export interface Resolution {
  scenario: { id: string; label: string; recordId: string };
  jurisdiction: {
    state: string;
    county?: string;
    /** Present only for a state we hold a pack for. */
    countyProfile?: CountyProfile;
    hasStatePack: boolean;
    note: string;
  };
  facts: Fact[];
  integrity: LedgerIntegrity;
  quarantined: Fact[];
  decisions: Decision[];
  gates: Gate[];
  gaps: Gap[];
  readiness: string;
  leads: Lead[];
  tasks: Task[];
  deadlines: Deadline[];
  discovery: { hypotheses: AssetHypothesis[]; suppressed: Suppressed[]; bleed?: BleedSummary };
  forms: FormOutcome[];
  actions: Action[];
  unresolved: Unresolved[];
  distribution: { safe: boolean; reasons: string[] };
}

/** Every asset value in the ledger. */
function assetTotal(v: Record<string, string | number | boolean>): number {
  return Object.entries(v)
    .filter(([k]) => /^asset\..+\.value$/.test(k))
    .reduce((n, [, val]) => n + (typeof val === "number" ? val : 0), 0);
}

/**
 * Cash and financial accounts — the property § 8901 lets the personal
 * representative appraise, and § 8961(a) therefore excludes from the referee's
 * commission base.
 */
function cashTotal(v: Record<string, string | number | boolean>): number {
  return Object.entries(v)
    .filter(([k]) => /^asset\.(bank|checking|savings|money_market)[^.]*\.value$/.test(k))
    .reduce((n, [, val]) => n + (typeof val === "number" ? val : 0), 0);
}

/**
 * States for which this build carries a rule pack.
 *
 * Each was researched against the state's own legislature — leginfo for
 * California, the NY Senate for the SCPA, the Texas Estates Code — and each
 * carries an explicit list of what could not be sourced. A state absent from
 * this table produces "no rule pack" and an honest hold, never a fallback to
 * California's answers.
 */
const STATE_PACKS: Record<
  string,
  {
    rules: typeof CA_RULES;
    hints: Record<string, string>;
    derive?: (facts: Fact[], asOf: string, now?: number) => Fact[];
  }
> = {
  CA: { rules: CA_RULES, hints: CA_OBTAIN_HINTS, derive: deriveCaFacts },
  NY: { rules: NY_RULES, hints: NY_OBTAIN_HINTS, derive: deriveNyFacts },
  PA: { rules: PA_RULES, hints: PA_OBTAIN_HINTS, derive: derivePaFacts },
  TX: { rules: TX_RULES, hints: TX_OBTAIN_HINTS, derive: deriveTxFacts },
};

export function resolve(scenario: Scenario): Resolution {
  const { record } = scenario;
  const asOf = scenario.asOf ?? new Date().toISOString().slice(0, 10);

  // ---- facts -------------------------------------------------------------
  const imported = importEstate(record, { now: 1 });
  const state = (record.estateEntity.principalState ?? "").toUpperCase();
  const county = record.estateEntity.principalCounty ?? undefined;

  const pack = STATE_PACKS[state];
  // Derivations are jurisdiction-specific — a "gross value" total means whatever
  // that state's statute says it means, including which property is excluded
  // from it. Running California's arithmetic on a Texas estate would produce a
  // number that looks authoritative and answers a question nobody asked.
  const derived = pack?.derive ? pack.derive(imported.facts, asOf, 1) : [];
  const facts = [...imported.facts, ...derived];
  const factValues = values(facts);

  const unresolved: Unresolved[] = [];

  if (!pack) {
    unresolved.push({
      kind: "no_rule_pack",
      what: `State-level procedure for ${state || "an unnamed state"}`,
      why:
        `This build carries a rule pack for ${Object.keys(STATE_PACKS).join(", ")} only. ` +
        `Federal obligations still attach and are evaluated; every state-level ` +
        `question for this estate is unanswered rather than answered wrongly.`,
      needs: [`A ${state || "state"} probate rule pack with cited thresholds`],
    });
  }

  // ---- decisions ---------------------------------------------------------
  // Federal form rules always apply. State rules only where we hold a pack.
  const ruleSet = [...FORM_RULES, ...(pack ? pack.rules : [])];
  const decisions = decide(ruleSet, factValues, { state: state || "*", county });
  const hints = pack ? pack.hints : {};
  const gaps = findGaps(decisions, hints);

  for (const d of decisions) {
    if (d.chosen || d.blocked.length === 0) continue;
    unresolved.push({
      kind: "decision_blocked",
      what: d.decisionPoint,
      why: `Every candidate rule is waiting on a fact this estate does not carry.`,
      needs: d.needs,
    });
  }

  // ---- leads, tasks, deadlines -------------------------------------------
  const { leads } = detectLeads(factValues);
  const withForeign = { ...factValues, "estate.has_foreign_indicators": leads.some((l) => l.foreign) };
  const tasks = resolveTasks(withForeign);
  const deadlines = computeDeadlines(withForeign, asOf);

  // ---- discovery ---------------------------------------------------------
  const charges = scenario.transactions?.length
    ? detectRecurring(scenario.transactions, { dateOfDeath: record.decedent.dateOfDeath ?? undefined })
    : [];
  const discovery = charges.length
    ? {
        ...discoverAssets(charges, facts, scenario.transactions!, {
          dateOfDeath: record.decedent.dateOfDeath ?? undefined,
        }),
        bleed: summariseBleed(charges),
      }
    : { hypotheses: [], suppressed: [], notAssetBearing: [], bleed: undefined };

  for (const h of discovery.hypotheses) {
    unresolved.push({
      kind: "hypothesis_unconfirmed",
      what: `${h.implies} implied by payments to ${h.merchant}`,
      why:
        `Inferred from ${h.evidence.length} debits, not read from a document. ` +
        `An inference is not a fact and cannot enter the ledger.`,
      needs: [`${h.nextStep.channel} to ${h.nextStep.recipient}: ${h.nextStep.asks}`],
    });
  }

  // ---- forms -------------------------------------------------------------
  const forms = resolveForms(record, decisions, unresolved);

  // ---- appraisal economics -----------------------------------------------
  // Only meaningful in California, where the referee commission and the
  // date-of-death rule are the ones cited. Elsewhere this is left off rather
  // than shown with California's numbers attached to another state's procedure.
  const advice =
    state === "CA"
      ? appraisalAdvice({
          totalEstateUsd: assetTotal(factValues),
          cashAndAccountsUsd: cashTotal(factValues),
          valued: {
            valueUsd: Number(factValues["asset.residence.value"] ?? 0),
            thresholds: [
              {
                usd: CA_THRESHOLDS.primaryResidence,
                label: "§ 13151 primary-residence petition",
                authority: "Cal. Prob. Code §§ 13151–13154",
              },
              {
                usd: CA_THRESHOLDS.smallEstateAffidavit,
                label: "§ 13100 small-estate affidavit",
                authority: "Cal. Prob. Code §§ 13100, 13101",
              },
            ],
          },
        })
      : undefined;

  // ---- actions -----------------------------------------------------------
  const actions = buildActions({ state, forms, gaps, leads, tasks, deadlines, discovery, advice });

  const caTasks = tasks.filter(
    (t) =>
      t.status !== "not_applicable" &&
      (/^Cal\./.test(t.authority?.citation ?? "") || /\bCalifornia\b/.test(t.guidance)),
  );
  if (state !== "CA" && caTasks.length) {
    unresolved.push({
      kind: "no_rule_pack",
      what: `${caTasks.length} administration steps carry California authority`,
      why:
        `The task graph was written against California practice. The obligations are ` +
        `probably universal; the citations, deadlines and procedures are not, and ` +
        `${state} equivalents have not been researched.`,
      needs: [`${state} equivalents for: ${caTasks.map((t) => t.id).join(", ")}`],
    });
  }

  // ---- distribution ------------------------------------------------------
  const open = blockingLeads(leads);
  const reasons: string[] = [];
  if (open.length) reasons.push(`${open.length} critical lead(s) still open.`);
  if (discovery.hypotheses.length) {
    reasons.push(
      `${discovery.hypotheses.length} asset hypothes${discovery.hypotheses.length === 1 ? "is" : "es"} from payment traces are unconfirmed.`,
    );
  }
  const blocking = gaps.filter((g) => g.severity === "blocking");
  if (blocking.length) reasons.push(`${blocking.length} fact(s) a pending decision needs are missing.`);
  if (!pack) reasons.push(`No rule pack for ${state}; state-level requirements are unknown.`);

  return {
    scenario: { id: scenario.id, label: scenario.label, recordId: record.meta.recordId },
    jurisdiction: {
      state,
      county,
      countyProfile:
        state === "CA" && county
          ? CA_COUNTIES.find((c) => c.name.toLowerCase() === county.toLowerCase())
          : undefined,
      hasStatePack: Boolean(pack),
      note: pack
        ? `${state} rule pack applied.`
        : `No ${state} pack. Federal obligations evaluated; state questions left open.`,
    },
    facts,
    integrity: integrity(facts),
    quarantined: quarantined(facts),
    decisions,
    gates: gates(decisions, facts),
    gaps,
    readiness: readiness(decisions, gaps),
    leads,
    tasks,
    deadlines,
    discovery,
    forms,
    actions,
    unresolved,
    distribution: { safe: reasons.length === 0, reasons },
  };
}

function resolveForms(
  record: EstateRecord,
  decisions: Decision[],
  unresolved: Unresolved[],
): FormOutcome[] {
  const out: FormOutcome[] = [];

  for (const map of FIELD_MAPS) {
    const point = GOVERNED_BY[map.form];
    const d = decisions.find((x) => x.decisionPoint === point);
    const chosen = d?.chosen;

    if (!chosen) {
      const needs = d?.needs ?? [];
      out.push({
        form: map.form,
        sourceFile: map.sourceFile,
        status: "blocked",
        reason: needs.length
          ? `Cannot decide whether this form applies without ${needs.join(", ")}.`
          : `No rule reached a conclusion for ${point}.`,
      });
      unresolved.push({
        kind: "condition_unknown",
        what: `Whether ${map.sourceFile} applies`,
        why: "Applicability turns on a fact this estate does not carry.",
        needs,
      });
      continue;
    }

    if (!AFFIRMATIVE_RULES.has(chosen.ruleId)) {
      out.push({
        form: map.form,
        sourceFile: map.sourceFile,
        status: "withheld",
        reason: chosen.rule.then.conclusion,
        ruleId: chosen.ruleId,
        authority: chosen.rule.authority.citation,
      });
      continue;
    }

    const filling = fillForm(map, record);
    const payload = toFillPayload(filling);

    // Form 56's line-1 group and its two date lines are owned by the rule pack,
    // not by the field map — a structural mapping fills both date boxes.
    if (map.form === "irs-56") {
      const ov = form56Overrides(record);
      for (const k of ov.clear) delete payload[k];
      Object.assign(payload, ov.set);
      for (const u of ov.unresolved) {
        unresolved.push({
          kind: "condition_unknown",
          what: "Form 56 line 1",
          why: u,
          needs: ["A human must choose the correct authority box."],
        });
      }
    }

    out.push({
      form: map.form,
      sourceFile: map.sourceFile,
      status: "fill",
      reason: chosen.rule.then.conclusion,
      ruleId: chosen.ruleId,
      authority: chosen.rule.authority.citation,
      filling,
      payload,
      gaps: filling.gaps.map((g) => g.target).filter(Boolean),
    });
  }

  // Forms the decisions demand for which no template exists.
  const held = new Set(FIELD_MAPS.map((m) => m.sourceFile));
  for (const d of decisions) {
    for (const f of d.chosen?.rule.then.forms ?? []) {
      if (f.code === "—") continue;
      if ([...held].some((h) => h.includes(f.code))) continue;
      if (out.some((o) => o.form === f.code)) continue;
      out.push({
        form: f.code,
        sourceFile: "—",
        status: "unmodelled",
        reason: `${f.title} — required by ${d.decisionPoint}, no template held.`,
        ruleId: d.chosen?.ruleId,
      });
      unresolved.push({
        kind: "form_unmodelled",
        what: `${f.code} — ${f.title}`,
        why: "The rules require it and this build holds no template to fill it.",
        needs: [`A field map for ${f.code}`],
      });
    }
  }

  return out;
}

function buildActions(input: {
  state: string;
  forms: FormOutcome[];
  gaps: Gap[];
  leads: Lead[];
  tasks: Task[];
  deadlines: Deadline[];
  discovery: { hypotheses: AssetHypothesis[] };
  advice?: AppraisalAdvice;
}): Action[] {
  const actions: Action[] = [];

  // A value sitting on a procedural threshold outranks almost everything: the
  // appraisal is cheap, and being on the wrong side of the line costs months.
  for (const r of input.advice?.risks ?? []) {
    if (r.band !== "on_the_line") continue;
    actions.push({
      id: `appraisal.risk.${r.thresholdUsd}`,
      kind: "decide",
      title: `Appraisal accuracy decides the route — ${r.label}`,
      detail: r.advice,
      priority: 5,
      because: `${r.marginPct}% from the ${r.label} threshold`,
      authority: r.authority,
      needsHuman: true,
    });
  }

  for (const s of input.advice?.savings ?? []) {
    actions.push({
      id: `saving.${s.what.slice(0, 24).replace(/\W+/g, "_")}`,
      kind: "decide",
      title: s.amountUsd ? `${s.what} — saves ~$${s.amountUsd}` : s.what,
      detail: s.because,
      priority: 15,
      because: "appraisal economics",
      needsHuman: false,
    });
  }

  // Missing facts come first: they gate everything downstream.
  for (const g of input.gaps) {
    if (g.severity !== "blocking") continue;
    actions.push({
      id: `obtain.${g.key}`,
      kind: "obtain_fact",
      title: `Obtain ${g.key}`,
      detail: g.howToObtain ?? "No guidance recorded for obtaining this fact.",
      priority: 10,
      because: `Blocks ${g.blocks.join(", ")}`,
      needsHuman: true,
    });
  }

  // Discovered assets: unconfirmed money, and the letter that confirms it.
  for (const h of input.discovery.hypotheses) {
    actions.push({
      id: h.id,
      kind: "contact",
      title: `Write to ${h.merchant} — possible ${h.implies}`,
      detail: h.nextStep.asks,
      priority: 20,
      because: `${h.evidence.length} recurring debits, $${h.annualisedUsd}/yr, no matching asset in the ledger`,
      needsHuman: true,
    });
  }

  for (const l of input.leads) {
    if (l.status !== "open") continue;
    actions.push({
      id: `lead.${l.patternId}`,
      kind: "investigate",
      title: l.title,
      detail: `${l.implies} ${l.rationale}`.trim(),
      priority: l.priority === "critical" ? 25 : 40,
      because: `${l.patternId} — raised by ${l.evidence.join(", ")}`,
      needsHuman: l.priority === "critical",
    });
  }

  for (const f of input.forms) {
    if (f.status === "fill") {
      const filled = f.filling?.filled ?? 0;
      const gapCount = f.gaps?.length ?? 0;
      actions.push({
        id: `file.${f.form}`,
        kind: "file_form",
        title: `File ${f.sourceFile}`,
        detail:
          `${filled} boxes filled automatically` +
          (gapCount ? `, ${gapCount} need a human` : "") +
          `. ${f.reason}`,
        priority: 30,
        because: f.ruleId ?? "",
        authority: f.authority,
        needsHuman: true,
      });
    } else if (f.status === "unmodelled") {
      actions.push({
        id: `file.${f.form}`,
        kind: "file_form",
        title: `File ${f.form} by hand`,
        detail: f.reason,
        priority: 35,
        because: f.ruleId ?? "",
        needsHuman: true,
      });
    }
  }

  for (const t of input.tasks) {
    if (t.status === "not_applicable") continue;

    // The administration task graph was written against California practice and
    // most of its steps cite the California Probate Code. The *obligation* is
    // usually universal — every state makes an executor notice creditors — but
    // the citation, the deadline and the procedure are not. Showing an Indiana
    // executor the sentence "California requires notice to creditors" as though
    // it were their instruction is worse than showing them nothing.
    const caSpecific =
      /^Cal\./.test(t.authority?.citation ?? "") || /\bCalifornia\b/.test(t.guidance);
    const foreign = caSpecific && input.state !== "CA";

    let detail = t.caution ? `${t.guidance} Caution: ${t.caution}` : t.guidance;
    if (foreign) {
      detail =
        `${detail}\n\n  NOTE: this step and its authority are California-specific. ` +
        `The obligation very likely has an ${input.state} equivalent, but this build ` +
        `has not researched it — treat the detail above as background, not instruction.`;
    }

    actions.push({
      id: `task.${t.id}`,
      kind: t.blockedBy.length ? "wait" : "decide",
      title: foreign ? `${t.title} — confirm the ${input.state} equivalent` : t.title,
      detail,
      priority: t.status === "blocked" ? 60 : 50,
      blockedBy: t.blockedBy,
      because: t.id,
      authority: foreign ? undefined : t.authority?.citation,
      needsHuman: foreign || t.requiresAuthority.length > 0,
    });
  }

  return actions.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
}

/** A resolution as a specialist would read it. */
export function resolutionReport(r: Resolution): string {
  const L: string[] = [];
  const pct = Math.round(r.integrity.integrityScore * 100);

  L.push(`# ${r.scenario.label}`);
  L.push(``);
  L.push(`${r.jurisdiction.state}${r.jurisdiction.county ? ` · ${r.jurisdiction.county} County` : ""} — ${r.jurisdiction.note}`);
  if (r.jurisdiction.countyProfile) {
    const c = r.jurisdiction.countyProfile;
    L.push(
      `Local: ${c.court}. First-paper fee $${c.firstPaperFeeUsd}. ` +
        `Local rules ${c.status === "verified" ? `read ${c.localRulesEffective ?? ""}`.trim() : "not researched"}.`,
    );
  }
  L.push(``);
  L.push(`${r.integrity.verified}/${r.integrity.proposed} facts substantiated (${pct}%). ${r.readiness}`);
  L.push(``);

  L.push(`## Do this (${r.actions.length})`);
  L.push(``);
  for (const a of r.actions) {
    const flag = a.needsHuman ? " [needs a human]" : "";
    L.push(`- **${a.title}**${flag}`);
    if (a.detail) L.push(`  ${a.detail}`);
    if (a.blockedBy?.length) L.push(`  _waiting on: ${a.blockedBy.join(", ")}_`);
  }
  L.push(``);

  const fill = r.forms.filter((f) => f.status === "fill");
  const withheld = r.forms.filter((f) => f.status === "withheld");
  const blocked = r.forms.filter((f) => f.status === "blocked");
  const unmodelled = r.forms.filter((f) => f.status === "unmodelled");

  L.push(`## Forms — ${fill.length} to fill, ${withheld.length} withheld, ${blocked.length} blocked, ${unmodelled.length} unmodelled`);
  L.push(``);
  for (const f of fill) {
    L.push(`- **${f.sourceFile}** — ${f.filling?.filled} boxes filled, ${f.gaps?.length ?? 0} gaps · ${f.authority ?? ""}`);
  }
  for (const f of withheld) L.push(`- ~~${f.sourceFile}~~ — ${f.reason}`);
  for (const f of blocked) L.push(`- **${f.sourceFile}** — BLOCKED. ${f.reason}`);
  for (const f of unmodelled) L.push(`- ${f.form} — ${f.reason}`);
  L.push(``);

  if (r.discovery.hypotheses.length) {
    L.push(`## Assets nobody mentioned (${r.discovery.hypotheses.length})`);
    L.push(``);
    for (const h of r.discovery.hypotheses) {
      L.push(`- **${h.merchant}** — ${h.implies}, $${h.annualisedUsd}/yr, ${h.confidence} confidence`);
    }
    if (r.discovery.suppressed.length) {
      L.push(``);
      L.push(`Suppressed as already known: ${r.discovery.suppressed.map((s) => s.merchant).join(", ")}`);
    }
    L.push(``);
  }

  L.push(`## Not resolved (${r.unresolved.length})`);
  L.push(``);
  L.push(`An empty section here would mean nothing was left open. It is never empty by accident.`);
  L.push(``);
  for (const u of r.unresolved) {
    L.push(`- **${u.what}** — ${u.why}`);
    for (const n of u.needs) L.push(`  - needs: ${n}`);
  }
  L.push(``);

  L.push(`## Distribution`);
  L.push(``);
  L.push(r.distribution.safe ? `No hold identified.` : `**HOLD.** ${r.distribution.reasons.join(" ")}`);
  return L.join("\n");
}

