// Diligence workstreams as they are actually staffed on a deal, with the scope
// each one owns and the failure modes it exists to catch. This is the domain
// knowledge the analysts operate from — encoded methodology, not model weights.

export interface Workstream {
  id: string;
  name: string;
  /** Who owns this on a real deal team. */
  owner: string;
  /** What this workstream is accountable for finding. */
  charter: string;
  /** Specific things that have killed or repriced deals. */
  redFlags: string[];
  /** What the workstream must request if it isn't in the data room. */
  requests: string[];
  /** Capability profile the router uses to pick a model for this seat. */
  needs: { reasoning: number; longContext: number; structured: number; adversarial: number };
}

export const WORKSTREAMS: Workstream[] = [
  {
    id: "financial",
    name: "Financial & Quality of Earnings",
    owner: "Transaction Services / FDD lead",
    charter:
      "Establish what the business actually earns on a normalised, run-rate basis. Bridge reported EBITDA to Quality of Earnings, test revenue recognition, working capital, and the cash conversion cycle. Determine the debt-like items and the normalised working capital peg that will drive the purchase price adjustment.",
    redFlags: [
      "EBITDA add-backs that are recurring in substance (repeated 'one-off' costs across periods)",
      "Revenue recognised on delivery terms inconsistent with contract or with prior periods",
      "Channel stuffing or quarter-end pull-forward — revenue spikes in the final weeks of a period",
      "Deteriorating DSO or inventory turns masked by a growing top line",
      "Customer concentration above ~20% of revenue, especially with a near-term contract expiry",
      "Gross margin decline attributed to 'mix' without a supporting bridge",
      "Capitalised costs that peers expense; changes in capitalisation policy mid-period",
      "Related-party revenue or expenses not on arm's-length terms",
      "Working capital artificially depressed pre-sale (stretched payables, accelerated collections)",
      "Covenant headroom under 15% on any facility, or covenants tested on adjusted definitions",
      "Deferred revenue that will not survive the transaction",
      "Off-balance-sheet obligations: operating leases, factoring, supply-chain finance",
    ],
    requests: [
      "Monthly P&L, balance sheet and cash flow, trailing 36 months",
      "Management's EBITDA bridge with support for every add-back",
      "Top-20 customer revenue by period with contract expiry dates",
      "Aged receivables and payables listings",
      "Debt schedule with covenant calculations",
      "Deferred revenue roll-forward",
    ],
    needs: { reasoning: 5, longContext: 4, structured: 5, adversarial: 4 },
  },
  {
    id: "legal",
    name: "Legal & Corporate",
    owner: "Deal counsel",
    charter:
      "Confirm the seller can deliver what is being sold: clean title to shares and assets, contracts that survive the transaction, and no undisclosed liabilities. Identify consents required to close and provisions that transfer value away from the buyer.",
    redFlags: [
      "Change-of-control provisions permitting termination or repricing by material counterparties",
      "Assignment restrictions requiring third-party consent to close",
      "Cap table defects: unissued options, unvested promises, missing stock transfer records",
      "Litigation or regulatory proceedings without adequate reserve or disclosure",
      "IP not owned by the target — assigned to a founder, licensed rather than owned, or encumbered",
      "Employee or contractor agreements lacking IP assignment clauses",
      "Non-compete and restrictive covenants unenforceable in the operating jurisdiction",
      "Guarantees, indemnities or comfort letters granted to third parties",
      "Leases with change-of-control, early termination, or above-market renewal terms",
      "Unlimited liability exposure in customer contracts",
      "Data protection breaches or absent processing agreements (GDPR/CCPA exposure)",
    ],
    requests: [
      "Corporate records, cap table, shareholder agreements",
      "Top customer and supplier contracts in full",
      "Litigation schedule with counsel assessments",
      "IP register and assignment documentation",
      "All financing and security documents",
    ],
    needs: { reasoning: 5, longContext: 5, structured: 4, adversarial: 4 },
  },
  {
    id: "commercial",
    name: "Commercial & Market",
    owner: "Commercial diligence lead / strategy advisor",
    charter:
      "Test whether the market and the target's position in it support the business plan. Validate market size and growth independently of management, assess competitive dynamics, and stress-test the revenue build underpinning the valuation.",
    redFlags: [
      "Management's market growth assumption exceeding credible third-party estimates",
      "Share gains assumed without a defensible mechanism",
      "Pipeline conversion rates in the plan exceeding historical actuals",
      "Customer churn or net revenue retention deteriorating beneath aggregate growth",
      "Pricing power eroding — discounting rising, list-to-net widening",
      "Reliance on a single channel, platform, or referral partner",
      "Regulatory or technology shift that structurally impairs the category",
      "Win rates that fall when a specific competitor is in the deal",
    ],
    requests: [
      "Cohort retention and net revenue retention analysis",
      "Win/loss data with reasons",
      "Pipeline by stage with historical conversion",
      "Pricing history and discount analysis",
      "Third-party market studies",
    ],
    needs: { reasoning: 4, longContext: 4, structured: 4, adversarial: 4 },
  },
  {
    id: "operational",
    name: "Operations & Supply Chain",
    owner: "Operational diligence lead",
    charter:
      "Assess whether the operating model can deliver the plan, and what investment is required. Identify capacity constraints, single points of failure, and deferred maintenance or capex that the plan has not funded.",
    redFlags: [
      "Single-source suppliers for critical inputs without qualified alternatives",
      "Deferred maintenance or capex underspend relative to depreciation",
      "Capacity utilisation already near ceiling in the base plan",
      "Key-person dependency in operations, engineering, or key accounts",
      "Quality or safety incidents trending adversely",
      "Manual processes that will not scale with the volume assumed in the plan",
      "Inventory obsolescence risk not reflected in provisions",
    ],
    requests: [
      "Capex history and forward plan with maintenance vs growth split",
      "Supplier concentration and contract terms",
      "Capacity and utilisation by site",
      "Quality metrics and incident log",
    ],
    needs: { reasoning: 4, longContext: 3, structured: 4, adversarial: 3 },
  },
  {
    id: "tax",
    name: "Tax & Structuring",
    owner: "Tax diligence lead",
    charter:
      "Quantify historical tax exposures that survive the transaction and confirm the acquisition structure is efficient. Identify positions likely to be challenged and the indemnity or escrow required.",
    redFlags: [
      "Aggressive transfer pricing without contemporaneous documentation",
      "Permanent establishment exposure from remote employees or agents",
      "Unfiled or late returns in any jurisdiction",
      "R&D or other credits claimed on questionable qualifying activity",
      "Worker classification exposure (contractors who function as employees)",
      "Sales, use, or VAT nexus in jurisdictions where the target is unregistered",
      "NOLs that will not survive the change of control",
      "Uncertain tax positions with inadequate reserve",
    ],
    requests: [
      "Tax returns for all open years in every jurisdiction",
      "Transfer pricing documentation",
      "Correspondence with tax authorities",
      "Analysis of NOL survival under applicable change-of-control rules",
    ],
    needs: { reasoning: 5, longContext: 4, structured: 5, adversarial: 3 },
  },
  {
    id: "hr",
    name: "People, Culture & Organisation",
    owner: "HR diligence lead",
    charter:
      "Assess whether the people who create the value will stay, what they cost, and what liabilities attach to them. Evaluate cultural compatibility where integration is planned.",
    redFlags: [
      "Key employees without retention arrangements or with change-of-control payouts that let them leave",
      "Single-trigger acceleration on equity, creating an incentive to exit at close",
      "Unfunded pension or post-retirement obligations",
      "Pay equity or wage-and-hour exposure",
      "Union agreements with change-of-control consultation obligations",
      "Attrition rising in engineering, sales, or other value-critical functions",
      "Compensation materially below market, implying a cost increase post-close",
      "Culture incompatible with the acquirer's operating model where integration is assumed",
    ],
    requests: [
      "Full census with tenure, compensation, and function",
      "Employment agreements for key personnel",
      "Equity plan and vesting schedule with change-of-control terms",
      "Attrition by function, trailing 24 months",
      "Benefit plan documents and funding status",
    ],
    needs: { reasoning: 4, longContext: 3, structured: 4, adversarial: 3 },
  },
  {
    id: "technology",
    name: "Technology & IP",
    owner: "Technical diligence lead",
    charter:
      "Establish that the technology works, is owned, is maintainable, and can support the plan. Assess architecture, technical debt, security posture, and the true cost of ownership.",
    redFlags: [
      "Copyleft (GPL/AGPL) dependencies in distributed or SaaS code without compliance review",
      "Core IP developed by contractors without written assignment",
      "Single-developer knowledge concentration in critical systems",
      "Architecture that cannot scale to the volumes in the plan without re-platforming",
      "Security posture: no SOC 2 / ISO 27001 where customers require it; unpatched critical CVEs",
      "Prior breach not disclosed or not remediated",
      "Undocumented systems and absent test coverage in revenue-critical paths",
      "Third-party platform dependency with unfavourable or terminable terms",
      "AI/ML models trained on data the target lacks rights to use",
    ],
    requests: [
      "Architecture documentation and system inventory",
      "Open-source dependency scan with licence classification",
      "Security audit reports, penetration tests, incident history",
      "Engineering headcount by system, with bus-factor assessment",
      "Contractor agreements with IP assignment provisions",
    ],
    needs: { reasoning: 4, longContext: 4, structured: 4, adversarial: 3 },
  },
  {
    id: "regulatory",
    name: "Regulatory & Antitrust",
    owner: "Regulatory counsel",
    charter:
      "Identify the approvals required to close, the timeline they impose, and the conditions likely to be attached. Assess licensing and sector-specific compliance.",
    redFlags: [
      "Merger control filings required in multiple jurisdictions with divergent timelines",
      "Combined share in any defined market likely to attract a Phase 2 review",
      "Foreign investment screening exposure (CFIUS or equivalent)",
      "Sector licences that do not transfer, or that require regulator consent",
      "Sanctions or export-control exposure in the customer or supplier base",
      "Anti-bribery exposure in higher-risk jurisdictions or via third-party agents",
      "Pending regulatory change that alters the economics of the category",
    ],
    requests: [
      "Market share data by defined market",
      "All operating licences and permits",
      "Compliance programme documentation and audit findings",
      "Third-party agent and distributor agreements",
    ],
    needs: { reasoning: 5, longContext: 4, structured: 4, adversarial: 3 },
  },
  {
    id: "esg",
    name: "ESG & Environmental",
    owner: "ESG diligence lead",
    charter:
      "Identify environmental liabilities that attach to the assets and ESG factors material to financing, exit, or reputation.",
    redFlags: [
      "Contaminated sites or historical operations with remediation exposure",
      "Environmental permits out of compliance or nearing limits",
      "Climate transition exposure in a carbon-intensive process",
      "Supply chain labour practices inconsistent with buyer's standards",
      "ESG disclosures inconsistent with underlying operational data",
    ],
    requests: [
      "Phase I/II environmental site assessments",
      "Environmental permits and compliance history",
      "Supply chain audit reports",
    ],
    needs: { reasoning: 3, longContext: 3, structured: 4, adversarial: 3 },
  },
  {
    id: "integration",
    name: "Integration & Synergies",
    owner: "Integration lead / corporate development",
    charter:
      "Test whether the synergies underwriting the price are achievable, when they land, and what they cost to deliver. Identify dis-synergies and stranded costs that models routinely omit.",
    redFlags: [
      "Revenue synergies credited in the model without an identified owner or mechanism",
      "Cost synergies double-counted against savings already in the standalone plan",
      "Integration costs excluded from the returns calculation",
      "Stranded costs after carve-out (shared services, corporate overhead)",
      "TSA dependency on the seller with no exit plan or a short expiry",
      "Systems integration complexity underestimated (ERP, CRM consolidation)",
      "Synergy timing assumed at close rather than phased realistically",
      "Customer overlap producing revenue attrition on combination",
    ],
    requests: [
      "Synergy build with owner, mechanism, and timing per line",
      "Integration cost estimate",
      "TSA scope and duration where a carve-out is involved",
      "Systems landscape for both parties",
    ],
    needs: { reasoning: 5, longContext: 3, structured: 4, adversarial: 5 },
  },
  {
    id: "valuation",
    name: "Valuation & Deal Structure",
    owner: "Deal captain / corporate finance",
    charter:
      "Connect the diligence findings to price and structure. Translate each material finding into a valuation impact, a price adjustment, an indemnity, or a walk-away condition.",
    redFlags: [
      "Entry multiple unsupported by comparable transactions in the sector",
      "Plan assumptions in the model diverging from what diligence has established",
      "Working capital peg set on a period unrepresentative of the normal cycle",
      "Debt-like items not deducted from equity value (deferred revenue, accrued bonuses, capex arrears)",
      "Earn-out terms with ambiguous or manipulable measurement",
      "Insufficient escrow or indemnity relative to quantified exposures",
      "Returns dependent on multiple expansion rather than operating improvement",
    ],
    requests: [
      "The operating model and its source assumptions",
      "Comparable transaction analysis",
      "Draft SPA with price adjustment mechanics",
    ],
    needs: { reasoning: 5, longContext: 3, structured: 5, adversarial: 4 },
  },
];

export function workstreamById(id: string): Workstream | undefined {
  return WORKSTREAMS.find((w) => w.id === id);
}
