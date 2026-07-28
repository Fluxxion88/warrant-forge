import Database from "@tauri-apps/plugin-sql";

export interface Deal {
  id: number;
  code_name: string;
  target: string;
  sector: string;
  geography: string;
  deal_type: string;
  consideration: string;
  stage: string;
  thesis: string;
  status: string;
  created_at: number;
}

export interface DealDocument {
  id: number;
  deal_id: number;
  name: string;
  workstream: string;
  content: string;
  created_at: number;
}

export interface FindingRow {
  id: number;
  deal_id: number;
  run_id: number | null;
  workstream: string;
  severity: string;
  title: string;
  detail: string;
  evidence: string;
  verification: string;
  disputed: number;
  created_at: number;
  /** pending | accepted | rejected — the deal team's own decision. */
  review: string;
  reviewer_note: string;
  reviewed_at: number | null;
  locations: string;
}

export type ReviewState = "pending" | "accepted" | "rejected";

export async function setFindingReview(
  id: number,
  review: ReviewState,
  note = "",
): Promise<void> {
  await (await db()).execute(
    "UPDATE findings SET review = $1, reviewer_note = $2, reviewed_at = $3 WHERE id = $4",
    [review, note, Date.now(), id],
  );
}

export interface AuditRow {
  id: number;
  deal_id: number | null;
  run_id: number | null;
  actor: string;
  action: string;
  detail: string;
  model: string;
  provider: string;
  created_at: number;
}

/** Append-only record of everything that happened on a deal. */
export async function audit(entry: {
  dealId?: number | null;
  runId?: number | null;
  actor?: string;
  action: string;
  detail?: string;
  model?: string;
  provider?: string;
}): Promise<void> {
  await (await db()).execute(
    `INSERT INTO audit (deal_id, run_id, actor, action, detail, model, provider, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      entry.dealId ?? null,
      entry.runId ?? null,
      entry.actor ?? "system",
      entry.action,
      entry.detail ?? "",
      entry.model ?? "",
      entry.provider ?? "",
      Date.now(),
    ],
  );
}

export async function listAudit(dealId: number, limit = 500): Promise<AuditRow[]> {
  return (await db()).select<AuditRow[]>(
    "SELECT * FROM audit WHERE deal_id = $1 ORDER BY created_at DESC LIMIT $2",
    [dealId, limit],
  );
}

export interface RunRow {
  id: number;
  deal_id: number;
  status: string;
  mandate: string;
  transcript: string;
  memo: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  started_at: number;
  ended_at: number | null;
}

export interface MemoRow {
  id: number;
  deal_id: number;
  run_id: number | null;
  title: string;
  content: string;
  recommendation: string;
  created_at: number;
}

export interface PlaybookRow {
  id: number;
  title: string;
  category: string;
  content: string;
  created_at: number;
}

let dbPromise: Promise<Database> | null = null;
export function db(): Promise<Database> {
  if (!dbPromise) dbPromise = Database.load("sqlite:warrant.db");
  return dbPromise;
}

export async function listDeals(): Promise<Deal[]> {
  return (await db()).select<Deal[]>("SELECT * FROM deals ORDER BY created_at DESC");
}

export async function getDeal(id: number): Promise<Deal | null> {
  const rows = await (await db()).select<Deal[]>("SELECT * FROM deals WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function listDocuments(dealId: number): Promise<DealDocument[]> {
  return (await db()).select<DealDocument[]>(
    "SELECT * FROM documents WHERE deal_id = $1 ORDER BY workstream, name",
    [dealId],
  );
}

export async function listFindings(dealId: number): Promise<FindingRow[]> {
  return (await db()).select<FindingRow[]>(
    "SELECT * FROM findings WHERE deal_id = $1 ORDER BY created_at DESC",
    [dealId],
  );
}

export async function listMemos(dealId: number): Promise<MemoRow[]> {
  return (await db()).select<MemoRow[]>(
    "SELECT * FROM memos WHERE deal_id = $1 ORDER BY created_at DESC",
    [dealId],
  );
}

export async function listRuns(dealId: number): Promise<RunRow[]> {
  return (await db()).select<RunRow[]>(
    "SELECT * FROM runs WHERE deal_id = $1 ORDER BY started_at DESC",
    [dealId],
  );
}

export async function listPlaybook(): Promise<PlaybookRow[]> {
  return (await db()).select<PlaybookRow[]>("SELECT * FROM playbook ORDER BY category, title");
}

/** The firm's own standards, concatenated for injection into every analyst. */
export async function playbookText(): Promise<string> {
  const rows = await listPlaybook();
  if (rows.length === 0) return "";
  return rows.map((r) => `## ${r.title} (${r.category})\n${r.content}`).join("\n\n");
}
