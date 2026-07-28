import { useMemo, useState } from "react";
import {
  ClipboardList,
  Cpu,
  FileSignature,
  FolderOpen,
  Gauge,
  GitCompareArrows,
  Hammer,
  Home,
  Library,
  ListChecks,
  MapPin,
  Repeat,
  Scale,
  Stamp,
  Telescope,
} from "lucide-react";
import { WarrantLockup } from "./components/WarrantMark";
import OverviewPane from "./panes/OverviewPane";
import DataRoomPane from "./panes/DataRoomPane";
import LedgerPane from "./panes/LedgerPane";
import DecisionsPane from "./panes/DecisionsPane";
import ChangePane from "./panes/ChangePane";
import FormsPane from "./panes/FormsPane";
import FormCompilerPane from "./panes/FormCompilerPane";
import FormOnboardingPane from "./panes/FormOnboardingPane";
import JurisdictionPane from "./panes/JurisdictionPane";
import InvestigationPane from "./panes/InvestigationPane";
import AdminPane from "./panes/AdminPane";
import AnvilPane from "./panes/AnvilPane";
import DocumentStorePane from "./panes/DocumentStorePane";
import ExtractionPane from "./panes/ExtractionPane";
import EfficiencyPane from "./panes/EfficiencyPane";
import ObligationsPane from "./panes/ObligationsPane";
import {
  ESTATE,
  ingestSupplemental,
  initialRun,
  withCounty,
  type EstateRun,
} from "./lib/session";

type PaneId =
  | "overview"
  | "dataroom"
  | "ledger"
  | "extraction"
  | "investigation"
  | "decisions"
  | "forms"
  | "onboarding"
  | "docstore"
  | "anvil"
  | "obligations"
  | "admin"
  | "efficiency"
  | "jurisdiction"
  | "changes"
  | "compiler";

const NAV: { id: PaneId; label: string; icon: typeof Home }[] = [
  { id: "overview", label: "Estate", icon: Home },
  { id: "dataroom", label: "Data room", icon: FolderOpen },
  { id: "ledger", label: "Fact ledger", icon: ListChecks },
  { id: "extraction", label: "Extraction", icon: Cpu },
  { id: "investigation", label: "Investigation", icon: Telescope },
  { id: "decisions", label: "Decisions", icon: Scale },
  { id: "forms", label: "Forms", icon: FileSignature },
  { id: "onboarding", label: "Form onboarding", icon: Stamp },
  { id: "docstore", label: "Document store", icon: Library },
  { id: "anvil", label: "Anvil", icon: Stamp },
  { id: "obligations", label: "Shut-down board", icon: Repeat },
  { id: "admin", label: "Administration", icon: ClipboardList },
  { id: "efficiency", label: "Efficiency", icon: Gauge },
  { id: "jurisdiction", label: "Jurisdiction", icon: MapPin },
  { id: "changes", label: "Change log", icon: GitCompareArrows },
  { id: "compiler", label: "Form compiler", icon: Hammer },
];

export default function App() {
  const [pane, setPane] = useState<PaneId>("overview");
  const [run, setRun] = useState<EstateRun>(() => initialRun());
  const [ingested, setIngested] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);

  const flipped = run.report?.flippedCount ?? 0;
  const rejected = run.integrity.quarantined;

  const badges = useMemo<Partial<Record<PaneId, { text: string; tone: string }>>>(
    () => ({
      ledger: rejected
        ? { text: String(rejected), tone: "bg-rejected-soft text-rejected ring-rejected/25" }
        : undefined,
      investigation: run.distribution.openCriticalLeads
        ? {
            text: String(run.distribution.openCriticalLeads),
            tone: "bg-rejected-soft text-rejected ring-rejected/25",
          }
        : undefined,
      changes: flipped
        ? { text: String(flipped), tone: "bg-rejected-soft text-rejected ring-rejected/25" }
        : undefined,
    }),
    [rejected, flipped],
  );

  function openSource(doc: string, quote: string) {
    setSelectedDoc(doc);
    setHighlight(quote);
    setPane("dataroom");
  }

  function ingest() {
    setRun((prev) => ingestSupplemental(prev));
    setIngested(true);
    setPane("changes");
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-surface">
        <div className="px-6 py-6">
          <WarrantLockup />
        </div>

        <div className="mx-4 mb-4 rounded-lg border border-line bg-paper px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Open matter
          </p>
          <p className="mt-1 font-brand text-[15px] leading-tight text-ink">{ESTATE.decedent}</p>
          <p className="mt-0.5 text-[11px] text-ink-soft">
            {run.county} County · died {ESTATE.dateOfDeath}
          </p>
        </div>

        <nav className="flex flex-col gap-0.5 px-3">
          {NAV.map((n) => {
            const Icon = n.icon;
            const badge = badges[n.id];
            const active = pane === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setPane(n.id)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-alix/25 font-medium text-ink"
                    : "text-ink-soft hover:bg-sunk hover:text-ink"
                }`}
              >
                <Icon size={16} className={active ? "text-alix-deep" : "text-ink-faint"} />
                <span className="flex-1 text-left">{n.label}</span>
                {badge && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${badge.tone}`}
                  >
                    {badge.text}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto px-6 py-5">
          <p className="text-[11px] leading-relaxed text-ink-faint">
            Every fact carries the sentence that justifies it. Verification is deterministic — no
            model is asked whether a model told the truth.
          </p>
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-paper">
        {pane === "overview" && (
          <OverviewPane
            run={run}
            onIngest={ingest}
            ingested={ingested}
            onSeeChanges={() => setPane("changes")}
          />
        )}
        {pane === "dataroom" && (
          <DataRoomPane
            run={run}
            selected={selectedDoc}
            highlight={highlight}
            onSelect={(d) => {
              setSelectedDoc(d);
              setHighlight(null);
            }}
          />
        )}
        {pane === "ledger" && <LedgerPane run={run} onOpenSource={openSource} />}
        {pane === "extraction" && <ExtractionPane run={run} onAdopt={setRun} />}
        {pane === "investigation" && <InvestigationPane run={run} />}
        {pane === "obligations" && <ObligationsPane run={run} />}
        {pane === "admin" && <AdminPane run={run} />}
        {pane === "efficiency" && <EfficiencyPane run={run} />}
        {pane === "decisions" && <DecisionsPane run={run} />}
        {pane === "forms" && <FormsPane run={run} />}
        {pane === "onboarding" && <FormOnboardingPane />}
        {pane === "docstore" && <DocumentStorePane run={run} />}
        {pane === "anvil" && <AnvilPane run={run} />}
        {pane === "jurisdiction" && (
          <JurisdictionPane
            run={run}
            onSelectCounty={(name) => setRun((prev) => withCounty(prev, name))}
          />
        )}
        {pane === "changes" && <ChangePane run={run} />}
        {pane === "compiler" && <FormCompilerPane />}
      </main>
    </div>
  );
}

