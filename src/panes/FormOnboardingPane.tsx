// Track 3, made visible.
//
// The field maps, the refusals and the Anvil chain are the strongest work in
// this build and none of it was on screen. That is a real failure of the app,
// not a cosmetic one: the argument this pane makes is that a mapping is only
// trustworthy because it can show the printed words it rests on, and an
// argument nobody can see is not being made.
//
// So this pane leads with the evidence rather than the coverage. The column
// that matters is not "171 fields mapped" — it is the printed label beside each
// one, and the three proposals that were refused because their label was not on
// the page.

import { useMemo, useState } from "react";
import { AlertTriangle, Check, FileText, Quote, ShieldCheck, X } from "lucide-react";
import { Badge, Card, Cite, Label, Pane } from "../components/ui";
import { FIELD_MAPS } from "../forms/maps";
import type { FieldMap } from "../lib/formmap";

const TITLES: Record<string, string> = {
  "ca-dl142": "CA DMV DL 142 — Notice of Cancellation",
  "irs-56": "IRS Form 56 — Notice Concerning Fiduciary Relationship",
  "irs-8821": "IRS Form 8821 — Tax Information Authorization",
  "irs-ss4": "IRS Form SS-4 — Application for EIN",
};

/**
 * Results of the live Anvil runs on 2026-07-28, via `tools/anvil-live.ts`.
 *
 * Transcribed rather than read from disk, because the run output lands in
 * `out/` which is not committed. That makes these numbers the one thing on this
 * pane that can silently go stale, so `formonboarding.test.ts` asserts the
 * joined count never exceeds the map's own entry count — which catches the
 * failure that matters, a form being claimed as more complete than it is.
 */
export const ANVIL_RUN_AT = "2026-07-28";
export const ANVIL_RUN: Record<string, { joined: number; of: number; note?: string }> = {
  "irs-56": { joined: 53, of: 53 },
  "irs-8821": { joined: 15, of: 15 },
  "irs-ss4": { joined: 71, of: 71 },
  "ca-dl142": {
    joined: 2,
    of: 32,
    note:
      "Anvil cannot take this form automatically, and the reason is a property of the tool " +
      "rather than of our map. With field detection on it finds 38 fields against the PDF's " +
      "real 52, mostly collapsed into radio groups and named \"0\". With detection off it " +
      "returns none at all — it does not read the existing AcroForm. Either way there is " +
      "nothing stable to join to, so DL 142 is filled locally, where all 26 boxes land " +
      "correctly and were read back.",
  },
};

function FormCard({ map }: { map: FieldMap }) {
  const [open, setOpen] = useState(false);
  const run = ANVIL_RUN[map.form];
  const checkboxes = map.entries.filter((e) => e.type === "/Btn").length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-brand text-base text-ink">{TITLES[map.form] ?? map.form}</h2>
            <Badge tone="verified">
              <ShieldCheck size={10} /> {map.entries.length} verified
            </Badge>
            {map.rejected.length > 0 && (
              <Badge tone="warn">
                <X size={10} /> {map.rejected.length} refused
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            {map.sourceFile} · {checkboxes} checkboxes · discovered by {map.discoveredBy}
          </p>
        </div>
        {run && (
          <div className="shrink-0 text-right">
            <p className="tabular text-sm font-medium text-ink">
              {run.joined}/{run.of}
            </p>
            <p className="text-[11px] text-ink-faint">joined to Anvil</p>
          </div>
        )}
      </button>

      {run?.note && (
        <p className="border-t border-line-soft bg-warn-soft/50 px-5 py-2.5 text-xs text-ink-soft">
          {run.note}
        </p>
      )}

      {open && (
        <div className="border-t border-line-soft">
          {/*
            The evidence column is the point of the pane. Every row shows the
            words printed beside that box on the page, because that quote is the
            only reason to believe the mapping.
          */}
          <div className="max-h-96 overflow-y-auto divide-y divide-line-soft">
            {map.entries.map((e) => (
              <div key={e.field} className="grid grid-cols-[1fr_1.1fr] gap-4 px-5 py-2">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[11px] text-ink-soft">{e.target}</p>
                  <p className="truncate text-[10px] text-ink-faint">
                    p{e.page} · {e.field.split(".").pop()}
                    {e.condition ? ` · when ${e.condition}` : ""}
                  </p>
                </div>
                <p className="flex min-w-0 items-start gap-1.5 text-xs text-ink">
                  <Quote size={11} className="mt-0.5 shrink-0 text-alix-mid" />
                  <span className="truncate italic">{e.labelQuote}</span>
                </p>
              </div>
            ))}
          </div>

          {map.rejected.length > 0 && (
            <div className="border-t border-line-soft bg-sunk px-5 py-3">
              <Label>Refused</Label>
              <p className="mt-1 text-xs text-ink-soft">
                The model proposed these and could not show the label it claimed to read.
              </p>
              <ul className="mt-2 space-y-1.5">
                {map.rejected.map((r) => (
                  <li key={r.field + r.note} className="text-xs">
                    <span className="font-mono text-rejected">{r.verdict}</span>{" "}
                    <span className="text-ink-soft">{r.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function FormOnboardingPane() {
  const stats = useMemo(() => {
    const verified = FIELD_MAPS.reduce((n, m) => n + m.entries.length, 0);
    const refused = FIELD_MAPS.reduce((n, m) => n + m.rejected.length, 0);
    const unmapped = FIELD_MAPS.reduce((n, m) => n + m.unmapped.length, 0);
    const joined = Object.values(ANVIL_RUN).reduce((n, r) => n + r.joined, 0);
    return { verified, refused, unmapped, joined, forms: FIELD_MAPS.length };
  }, []);

  return (
    <Pane
      title="Form onboarding"
      lede="Government forms name their fields f1_01 through f1_89, which says nothing. We read the words actually printed around each box off the page, and the model must quote the label it relied on — checked by the same matcher that verifies factual claims. A label it cannot show is refused, and the mapping goes with it."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <Card className="px-5 py-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Forms", stats.forms],
              ["Verified mappings", stats.verified],
              ["Refused", stats.refused],
              ["Joined to Anvil", stats.joined],
            ].map(([label, n]) => (
              <div key={String(label)}>
                <p className="tabular font-brand text-2xl text-ink">{n}</p>
                <p className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">
            Nobody placed a field by hand. Onboarding a form the system has never seen is:
            extract the widget geometry, discover the mapping, generate the Anvil Cast. The
            refusals matter more than the count — a mapping that cannot point at printed text
            never reaches a filed document.
          </p>
        </Card>

        {FIELD_MAPS.map((m) => (
          <FormCard key={m.form} map={m} />
        ))}

        <Card tone="warn" className="px-5 py-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warn" />
            <div>
              <Label>What verification does not prove</Label>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                Locating the quote proves the model did not invent its evidence. It does not
                prove the mapping is right. Two mappings passed this check and were still
                wrong — one put the signer's name in “Title, if applicable”, the other answered
                “are the assets in the custody of the court?” from a field meaning “does a court
                case exist”. Both cited labels genuinely printed on the form. They were caught by
                rendering the filled PDF and reading it, and are recorded as adjudications.
              </p>
              <p className="mt-2">
                <Cite>src/forms/adjudications.json</Cite>
              </p>
            </div>
          </div>
        </Card>

        <Card className="px-5 py-4">
          <div className="flex items-start gap-2.5">
            <FileText size={16} className="mt-0.5 shrink-0 text-alix-deep" />
            <div>
              <Label>The Anvil chain, run live</Label>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                Geometry → discovered map → Cast → Anvil field detection → join → filled PDF.
                Three of four forms join completely and the values were read back off the
                returned page. Anvil detects where the boxes are; this pipeline decides what
                they mean, which is the half Anvil cannot do.
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-verified">
                <Check size={12} /> 139 of 139 bindings on IRS 56, 8821 and SS-4
              </p>
            </div>
          </div>
        </Card>
      </div>
    </Pane>
  );
}
