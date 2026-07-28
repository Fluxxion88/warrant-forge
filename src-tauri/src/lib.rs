mod anvil;
mod docs;
mod forge;
mod providers;

use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "deals, data room, findings, runs, memos, playbook",
        sql: "CREATE TABLE deals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code_name TEXT NOT NULL,
                target TEXT NOT NULL,
                sector TEXT NOT NULL DEFAULT '',
                geography TEXT NOT NULL DEFAULT '',
                deal_type TEXT NOT NULL DEFAULT '',
                consideration TEXT NOT NULL DEFAULT '',
                stage TEXT NOT NULL DEFAULT 'Preliminary',
                thesis TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'Active',
                created_at INTEGER NOT NULL
              );
              CREATE TABLE documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                deal_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                workstream TEXT NOT NULL DEFAULT 'General',
                content TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL
              );
              CREATE INDEX idx_documents_deal ON documents(deal_id);
              CREATE TABLE runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                deal_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'running',
                mandate TEXT NOT NULL DEFAULT '',
                transcript TEXT NOT NULL DEFAULT '',
                memo TEXT NOT NULL DEFAULT '',
                input_tokens INTEGER NOT NULL DEFAULT 0,
                output_tokens INTEGER NOT NULL DEFAULT 0,
                cost_usd REAL NOT NULL DEFAULT 0,
                started_at INTEGER NOT NULL,
                ended_at INTEGER
              );
              CREATE INDEX idx_runs_deal ON runs(deal_id);
              CREATE TABLE findings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                deal_id INTEGER NOT NULL,
                run_id INTEGER,
                workstream TEXT NOT NULL,
                severity TEXT NOT NULL,
                title TEXT NOT NULL,
                detail TEXT NOT NULL DEFAULT '',
                evidence TEXT NOT NULL DEFAULT '',
                verification TEXT NOT NULL DEFAULT 'unverified',
                disputed INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
              );
              CREATE INDEX idx_findings_deal ON findings(deal_id);
              CREATE TABLE memos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                deal_id INTEGER NOT NULL,
                run_id INTEGER,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                recommendation TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL
              );
              CREATE INDEX idx_memos_deal ON memos(deal_id);
              CREATE TABLE playbook (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'Standard',
                content TEXT NOT NULL,
                created_at INTEGER NOT NULL
              );",
        kind: MigrationKind::Up,
    },
    Migration {
        version: 2,
        description: "human review of findings, citation spans, audit log",
        sql: "ALTER TABLE findings ADD COLUMN review TEXT NOT NULL DEFAULT 'pending';
              ALTER TABLE findings ADD COLUMN reviewer_note TEXT NOT NULL DEFAULT '';
              ALTER TABLE findings ADD COLUMN reviewed_at INTEGER;
              ALTER TABLE findings ADD COLUMN locations TEXT NOT NULL DEFAULT '[]';
              CREATE TABLE audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                deal_id INTEGER,
                run_id INTEGER,
                actor TEXT NOT NULL DEFAULT 'system',
                action TEXT NOT NULL,
                detail TEXT NOT NULL DEFAULT '',
                model TEXT NOT NULL DEFAULT '',
                provider TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL
              );
              CREATE INDEX idx_audit_deal ON audit(deal_id);",
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:warrant.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            providers::providers_list,
            providers::providers_save,
            providers::providers_delete,
            providers::agent_complete,
            providers::provider_test,
            docs::read_text_file,
            docs::extract_document,
            docs::write_text_file,
            anvil::anvil_status,
            anvil::anvil_save,
            anvil::anvil_fill,
            anvil::anvil_register_form,
            anvil::anvil_cast_fields,
            anvil::anvil_create_signature_packet,
            anvil::anvil_sign_url,
            anvil::anvil_download_signed,
            forge::forge_status,
            forge::forge_inspect_all,
            forge::forge_fill,
            forge::forge_bench,
            forge::forge_artifacts,
            forge::forge_read_artifact,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
