import { useState } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, MapPin, Scale } from "lucide-react";
import { Badge, Card, Cite, Label, Pane } from "../components/ui";
import { CA_COUNTIES, coverage, county as findCounty } from "../rules/ca-counties";
import { money, type EstateRun } from "../lib/session";

export default function JurisdictionPane({
  run,
  onSelectCounty,
}: {
  run: EstateRun;
  onSelectCounty: (name: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const report = coverage();
  const selected = findCounty(run.county);

  const shown = CA_COUNTIES.filter((c) =>
    c.name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <Pane
      title="Jurisdiction"
      lede="Probate procedure is statewide; the overlay is local. All 58 California counties are modelled as data — switch county and the estate is re-decided with no fact re-extracted."
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Counties modelled", value: report.total, tone: "plain" as const },
            { label: "Local rules read", value: report.verified, tone: "verified" as const },
            { label: "Not yet researched", value: report.notResearched, tone: "warn" as const },
            { label: "Fee variances", value: report.feeVariances.length, tone: "alix" as const },
          ].map((s) => (
            <Card key={s.label} tone={s.tone} className="px-4 py-3">
              <p className="tabular font-brand text-2xl text-ink">{s.value}</p>
              <p className="mt-0.5 text-[11px] text-ink-soft">{s.label}</p>
            </Card>
          ))}
        </div>

        <Card tone="warn" className="px-5 py-4">
          <div className="flex items-start gap-3">
            <HelpCircle size={17} className="mt-0.5 shrink-0 text-warn" />
            <p className="text-sm leading-relaxed text-ink-soft">
              Filing fees are known for <strong className="text-ink">all 58 counties</strong> from a
              single authority — the Judicial Council schedule states that asterisked fees vary{" "}
              <em>only</em> in Riverside, San Bernardino and San Francisco, which is an exhaustive
              negative statement rather than a guess. Local <em>rules</em> are different: three
              counties have been read against their published text, and the remaining 55 are marked
              unverified rather than quietly assumed to have no local requirements.
            </p>
          </div>
        </Card>

        <div className="flex gap-6">
          <aside className="w-64 shrink-0">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter counties…"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-alix-mid"
            />
            <div className="mt-2 max-h-[26rem] space-y-0.5 overflow-y-auto pr-1">
              {shown.map((c) => (
                <button
                  key={c.name}
                  onClick={() => onSelectCounty(c.name)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                    c.name === run.county
                      ? "bg-alix/25 font-medium text-ink"
                      : "text-ink-soft hover:bg-sunk hover:text-ink"
                  }`}
                >
                  {c.status === "verified" ? (
                    <CheckCircle2 size={12} className="shrink-0 text-verified" />
                  ) : (
                    <span className="h-3 w-3 shrink-0 rounded-full border border-warn/40" />
                  )}
                  <span className="flex-1 truncate">{c.name}</span>
                  {c.firstPaperFeeUsd !== 435 && (
                    <span className="tabular text-[10px] text-alix-deep">
                      {money(c.firstPaperFeeUsd)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </aside>

          <section className="min-w-0 flex-1">
            {selected && (
              <Card className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <MapPin size={16} className="text-alix-deep" />
                      <h2 className="font-brand text-xl text-ink">{selected.name} County</h2>
                      {selected.status === "verified" ? (
                        <Badge tone="verified">local rules read</Badge>
                      ) : (
                        <Badge tone="warn">
                          <AlertTriangle size={10} /> not researched
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">{selected.court}</p>
                    {selected.localRulesEffective && (
                      <p className="mt-0.5 text-[11px] text-ink-faint">
                        Local rules effective {selected.localRulesEffective}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular font-brand text-xl text-ink">
                      {money(selected.firstPaperFeeUsd)}
                    </p>
                    <p className="text-[11px] text-ink-soft">first paper</p>
                  </div>
                </div>

                <p className="mt-2">
                  <Cite>{selected.feeAuthority.citation}</Cite>
                </p>

                {selected.status === "not_researched" && (
                  <div className="mt-4 rounded-lg bg-warn-soft px-4 py-3">
                    <p className="text-sm leading-relaxed text-ink-soft">
                      The statewide procedure is fully determined for this county — the fee above is
                      cited and correct. What has not been done is reading{" "}
                      {selected.name}'s own local probate rules. The system reports that as an
                      unknown rather than implying no local requirements exist.
                    </p>
                  </div>
                )}

                {selected.localForms.length > 0 && (
                  <div className="mt-4">
                    <Label>Local forms</Label>
                    <div className="mt-2 space-y-1.5">
                      {selected.localForms.map((f) => (
                        <div key={f.code} className="flex gap-3 text-sm">
                          <Badge tone="alix">{f.code}</Badge>
                          <span className="text-ink-soft">
                            {f.title} — <span className="text-ink-faint">{f.whenRequired}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selected.obligations.length > 0 && (
                  <div className="mt-4">
                    <Label>Local obligations beyond the statewide packet</Label>
                    <ul className="mt-2 space-y-1.5">
                      {selected.obligations.map((o) => (
                        <li key={o} className="flex gap-2 text-sm leading-relaxed text-ink-soft">
                          <Scale size={13} className="mt-1 shrink-0 text-alix-deep" />
                          {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selected.efiling && (
                  <div className="mt-4">
                    <Label>Electronic filing</Label>
                    <p className="mt-1.5 text-sm text-ink-soft">
                      Mandatory for {selected.efiling.mandatoryFor}
                      {selected.efiling.since && ` since ${selected.efiling.since}`}. Cannot be
                      e-filed: {selected.efiling.exclusions.join("; ")}.
                    </p>
                    <p className="mt-1 text-[11px] text-ink-faint">{selected.efiling.authority}</p>
                  </div>
                )}

                {selected.examiner && (
                  <div className="mt-4">
                    <Label>Pre-hearing review</Label>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                      {selected.examiner}
                    </p>
                  </div>
                )}

                {selected.tentativeRulings && (
                  <div className="mt-4">
                    <Label>Tentative rulings</Label>
                    <p className="mt-1.5 text-sm text-ink-soft">{selected.tentativeRulings}</p>
                  </div>
                )}

                {selected.staleDataWarnings && selected.staleDataWarnings.length > 0 && (
                  <div className="mt-4 rounded-lg bg-rejected-soft px-4 py-3">
                    <Label>Where the internet is wrong about this county</Label>
                    <ul className="mt-2 space-y-1.5">
                      {selected.staleDataWarnings.map((w) => (
                        <li key={w} className="flex gap-2 text-sm leading-relaxed text-ink-soft">
                          <AlertTriangle size={13} className="mt-1 shrink-0 text-rejected" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selected.notes && (
                  <p className="mt-4 border-t border-line-soft pt-3 text-[13px] leading-relaxed text-ink-faint">
                    {selected.notes}
                  </p>
                )}
              </Card>
            )}
          </section>
        </div>
      </div>
    </Pane>
  );
}
