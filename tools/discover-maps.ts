/**
 * Discover field mappings for every form under src/forms/geometry.
 *
 * Run:  WK_KEY=... npx vite-node tools/discover-maps.ts
 *
 * Writes src/forms/maps/<form>.json. Only mappings whose printed label was
 * located on the page are written; the rest are recorded as rejections in the
 * same file so a reviewer can see what the model tried and why it was refused.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  MAPPING_SYSTEM,
  adjudicate,
  admitMappings,
  buildMappingPrompt,
  parseMappings,
  toFieldMap,
  type Adjudication,
  type FormGeometry,
} from "../src/lib/formmap";
import { importedPaths } from "../src/lib/estate";

const ADJUDICATIONS: Adjudication[] = (
  JSON.parse(readFileSync("src/forms/adjudications.json", "utf8")) as {
    adjudications: Adjudication[];
  }
).adjudications;

const KEY = process.env.WK_KEY ?? "";
const MODEL = process.env.WK_MODEL ?? "claude-opus-5";
if (!KEY) throw new Error("set WK_KEY");

const GEO = "src/forms/geometry";
// Overridable so the same discovery can be re-run by a second model into a
// second directory, and the two compared. Agreement between independent runs
// is the only confidence signal available short of a human reading the form.
const OUT = process.env.WK_OUT ?? "src/forms/maps";

/** Paths the importer already reads, plus the per-form blocks in Alix's export. */
function schemaPaths(): string[] {
  return [
    ...importedPaths(),
    "decedent.name.first",
    "decedent.name.middle",
    "decedent.name.last",
    "decedent.identifications.0.number",
    "decedent.identifications.0.issuingState",
    "decedent.placeOfDeath.name",
    "estateEntity.identifyingNumber",
    "estateEntity.trust.grantorTin",
    "fiduciary.name.full",
    "fiduciary.address.line2",
    "fiduciary.faxNumber",
    "taxMatters.taxTypes",
    "taxMatters.federalFormNumbers",
    "taxMatters.specificPeriods",
    "taxMatters.authorizationRows.0.taxFormNumber",
    "taxMatters.authorizationRows.0.yearsOrPeriods",
    "taxMatters.authorizationRows.0.typeOfTaxInformation",
    "taxMatters.authorizationRows.0.specificTaxMatters",
    "form56.isNewNotice",
    "form56.totalRevocation.revokeAllPriorNotices",
    "form56.partialRevocation.revokeEarlierNotices",
    "form56.substituteFiduciary.hasSubstitute",
    "form56.signature.signerName",
    "form56.signature.title",
    "form56.signature.date",
    "form8821.taxpayerNameAndAddressBlock",
    "form8821.taxpayerIdentificationNumbers",
    "form8821.designees.0.name",
    "form8821.designees.0.firmName",
    "form8821.designees.0.address.line1",
    "form8821.designees.0.address.city",
    "form8821.designees.0.address.state",
    "form8821.designees.0.address.zip",
    "form8821.designees.0.cafNumber",
    "form8821.designees.0.ptin",
    "form8821.designees.0.phone.number",
    "form8821.designees.0.faxNumber",
    "form8821.designees.1.name",
    "form8821.designees.1.address.line1",
    "form8821.designees.1.cafNumber",
    "form8821.designees.1.ptin",
    "form8821.retainPriorAuthorizations",
    "form8821.signature.printName",
    "form8821.signature.title",
    "form8821.signature.date",
    "formSS4.entityType",
    "formSS4.entityTypeQualifier",
    "formSS4.reasonForApplying",
    "formSS4.reasonSpecify",
    "formSS4.businessStartOrAcquiredDate",
    "formSS4.closingMonthOfAccountingYear",
    "formSS4.expectedEmployees.agricultural",
    "formSS4.expectedEmployees.household",
    "formSS4.expectedEmployees.other",
    "formSS4.principalActivity",
    "formSS4.principalActivityOther",
    "formSS4.principalLineOfMerchandiseOrServices",
    "formSS4.hasEverAppliedForEin",
    "formSS4.previousEin",
    "formSS4.thirdPartyDesignee.name",
    "formSS4.thirdPartyDesignee.address.line1",
    "formSS4.thirdPartyDesignee.phone.number",
    "formSS4.thirdPartyDesignee.faxNumber",
    "formSS4.applicant.nameAndTitle",
    "formSS4.applicant.phone.number",
    "formSS4.applicant.signatureDate",
    "formDL142.documentHolderName",
    "formDL142.documentHolderAddress.line1",
    "formDL142.documentHolderAddress.city",
    "formDL142.documentHolderAddress.state",
    "formDL142.documentHolderAddress.zip",
    "formDL142.documentNumber",
    "formDL142.documentType",
    "formDL142.dateOfBirth",
    "formDL142.locationOfLicense",
    "formDL142.locationOfLicenseOtherExplanation",
    "formDL142.reasonForCancellation",
    "formDL142.completedBy.printedName",
    "formDL142.completedBy.address.line1",
    "formDL142.completedBy.signatureDate",
  ];
}

async function ask(system: string, user: string): Promise<{ text: string; stop: string }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const body = (await res.json()) as {
    content: { type: string; text?: string }[];
    stop_reason: string;
    usage: { input_tokens: number; output_tokens: number };
  };
  totalIn += body.usage.input_tokens;
  totalOut += body.usage.output_tokens;
  return {
    text: body.content
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join(""),
    stop: body.stop_reason,
  };
}

let totalIn = 0;
let totalOut = 0;

const paths = schemaPaths();
mkdirSync(OUT, { recursive: true });

for (const file of readdirSync(GEO).filter((f) => f.endsWith(".json"))) {
  const geometry = JSON.parse(readFileSync(join(GEO, file), "utf8")) as FormGeometry;
  console.log(`\n=== ${geometry.form}  (${geometry.widgets.length} widgets, ${geometry.pages}pp)`);

  // Chunked by widget count, not by page. SS-4 puts all 89 fields on one page;
  // asking for all of them at once ran past the output cap and returned nothing
  // parseable at all — the worst failure mode, because it looks like the model
  // declined rather than like the request was too big.
  const CHUNK = 26;
  const all = [];
  // Per-form cost, persisted into the map. Printing it and dropping it meant
  // "how long does onboarding a form take?" could only be answered from memory.
  const formStart = Date.now();
  const before = { in: totalIn, out: totalOut };
  let calls = 0;
  for (let page = 1; page <= geometry.pages; page++) {
    const onPage = geometry.widgets.filter((w) => w.page === page);
    for (let i = 0; i < onPage.length; i += CHUNK) {
      const slice = onPage.slice(i, i + CHUNK);
      const sub: FormGeometry = { ...geometry, widgets: slice };
      const t0 = Date.now();
      const { text, stop } = await ask(MAPPING_SYSTEM, buildMappingPrompt(sub, page, paths));
      calls++;
      const proposals = parseMappings(text);
      all.push(...proposals);
      const flag = stop === "max_tokens" ? "  TRUNCATED" : "";
      console.log(
        `  page ${page} [${i + 1}-${i + slice.length}]: ${slice.length} widgets -> ` +
          `${proposals.length} proposals  ${Date.now() - t0}ms${flag}`,
      );
      if (!proposals.length) console.log(`    raw head: ${JSON.stringify(text.slice(0, 200))}`);
    }
  }

  const raw = admitMappings(geometry, all);
  const { run, applied, refused } = adjudicate(raw, geometry, ADJUDICATIONS);
  for (const a of applied) {
    console.log(`  adjudicated ${a.field.split(".").pop()} -> ${a.target} (${a.decidedBy})`);
  }
  for (const r of refused) {
    console.log(`  ADJUDICATION REFUSED ${r.field.split(".").pop()}: ${r.note.slice(0, 100)}`);
  }
  const map = toFieldMap(run, geometry, {
    model: MODEL,
    at: new Date().toISOString(),
    run: {
      elapsedMs: Date.now() - formStart,
      inputTokens: totalIn - before.in,
      outputTokens: totalOut - before.out,
      calls,
    },
  });
  writeFileSync(join(OUT, `${geometry.form}.json`), JSON.stringify(map, null, 1));

  const mapped = run.verified.filter((m) => m.target).length;
  console.log(
    `  verified ${mapped}   unmapped ${map.unmapped.length}   ` +
      `rejected ${run.rejected.length}   unaddressed ${run.unaddressed.length}`,
  );
  for (const r of run.rejected.slice(0, 6)) {
    console.log(`    ! ${r.verdict.padEnd(18)} ${r.field.split(".").pop()}  ${r.note.slice(0, 110)}`);
  }
}

const cost = (totalIn / 1e6) * 5 + (totalOut / 1e6) * 25;
console.log(`\ntokens ${totalIn} in / ${totalOut} out   cost $${cost.toFixed(2)}`);
