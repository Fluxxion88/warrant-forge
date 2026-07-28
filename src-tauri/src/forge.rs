//! Running Forge.
//!
//! Forge is the other half of this system: a Python form compiler living at
//! `./forge`, invoked as a subprocess. It is not ported, wrapped or reimplemented
//! here — the seam between the two halves is JSON on disk (the work order going
//! out, approved bindings and filled PDFs coming back) plus this module, which
//! runs the CLI and hands back everything it said.
//!
//! Three rules this module exists to enforce:
//!
//! 1. **The interpreter is resolved explicitly.** `forge/.venv/bin/forge`, never a
//!    bare `forge` off `PATH`. A demo machine with a stale global install would
//!    otherwise fill forms from the wrong checkout and look like it worked.
//! 2. **Nothing is swallowed.** stdout, stderr, the exit code and the exact argv
//!    all come back to the interface, on success and on failure alike. A form
//!    filler that fails quietly is worse than one that does not run.
//! 3. **Only the cheap subcommands are reachable.** `forge bind` compiles a form
//!    with a model in the loop and takes about five minutes; it is a build-time
//!    operation performed under supervision, and it is deliberately not on the
//!    end of a button. See `ALLOWED`.

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Instant;

/// Subcommands reachable from the interface.
///
/// `bind`, `propose`, `loop` and `calibrate` are absent on purpose: each spends
/// model calls, each takes minutes, and each is a build-time step whose output a
/// human reviews and freezes. They are run from a terminal, not from a pane.
const ALLOWED: &[&str] = &["inspect", "fill", "bench", "reuse-proof"];

/// Everything a subprocess produced. Returned whether it succeeded or not.
#[derive(Serialize, Debug)]
pub struct ForgeRun {
    /// The exact command line, so what ran can be pasted into a terminal.
    pub argv: Vec<String>,
    pub cwd: String,
    pub ok: bool,
    /// `None` when the process was killed by a signal.
    pub code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
}

/// Where Forge lives, and whether it can actually be run.
#[derive(Serialize, Debug)]
pub struct ForgeStatus {
    pub root: String,
    pub binary: String,
    pub binary_exists: bool,
    pub estates: Vec<String>,
}

/// The compile state of one form, read from `forge/artifacts/`.
#[derive(Serialize, Debug)]
pub struct FormArtifacts {
    pub form_id: String,
    /// Highest approved version, or `None` when the form has never been frozen.
    pub approved_version: Option<u32>,
    pub approved_path: Option<String>,
    /// A draft binding exists and is waiting on a human.
    pub has_draft: bool,
    pub draft_path: Option<String>,
    /// Filled PDFs already on disk for this form, newest-agnostic, by estate.
    pub fills: Vec<String>,
}

/// Locate the Forge repository root.
///
/// Walks up from the running process, because the cwd differs between
/// `tauri dev` (which runs from `src-tauri/`) and a bundled app (which may run
/// from anywhere). `WARRANT_FORGE_ROOT` overrides for odd layouts.
fn forge_root() -> Result<PathBuf, String> {
    if let Ok(explicit) = std::env::var("WARRANT_FORGE_ROOT") {
        let p = PathBuf::from(explicit);
        if p.join("pyproject.toml").is_file() {
            return Ok(p);
        }
        return Err(format!("WARRANT_FORGE_ROOT={} is not a Forge checkout", p.display()));
    }

    let mut starts: Vec<PathBuf> = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        starts.push(cwd);
    }
    if let Ok(exe) = std::env::current_exe() {
        starts.push(exe);
    }
    // The dev build knows where it was compiled from; a bundled app does not.
    starts.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")));

    for start in starts {
        let mut dir: Option<&Path> = Some(start.as_path());
        while let Some(d) = dir {
            let candidate = d.join("forge");
            if candidate.join("pyproject.toml").is_file() && candidate.join("inputs").is_dir() {
                return Ok(candidate);
            }
            dir = d.parent();
        }
    }
    Err("could not find the forge/ directory above this process".into())
}

fn forge_binary(root: &Path) -> PathBuf {
    root.join(".venv").join("bin").join("forge")
}

fn run_forge(args: Vec<String>) -> Result<ForgeRun, String> {
    let subcommand = args.first().cloned().unwrap_or_default();
    if !ALLOWED.contains(&subcommand.as_str()) {
        return Err(format!(
            "`forge {subcommand}` is not reachable from the interface. Reachable: {}. \
             Compiling a form (`forge bind`) spends model calls and takes about five \
             minutes — it is run from a terminal, under supervision, and the result is \
             frozen by a human.",
            ALLOWED.join(", ")
        ));
    }

    let root = forge_root()?;
    let binary = forge_binary(&root);
    if !binary.is_file() {
        return Err(format!(
            "no Forge executable at {}. Create it with: python3 -m venv forge/.venv && \
             forge/.venv/bin/pip install -e forge",
            binary.display()
        ));
    }
    // Run from the repository root that contains forge/, so relative paths a
    // human copies out of the log behave the same way in a terminal. Forge
    // resolves its own inputs/ and artifacts/ from its package root regardless.
    let cwd = root.parent().unwrap_or(&root).to_path_buf();

    let mut argv = vec![binary.display().to_string()];
    argv.extend(args.iter().cloned());

    let started = Instant::now();
    let output = Command::new(&binary)
        .args(&args)
        .current_dir(&cwd)
        .env("FORGE_ROOT", &root)
        .output()
        .map_err(|e| format!("could not start {}: {e}", binary.display()))?;

    Ok(ForgeRun {
        argv,
        cwd: cwd.display().to_string(),
        ok: output.status.success(),
        code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        duration_ms: started.elapsed().as_millis() as u64,
    })
}

/// Run a Forge subcommand. Blocking work is moved off the UI thread.
async fn spawn(args: Vec<String>) -> Result<ForgeRun, String> {
    tauri::async_runtime::spawn_blocking(move || run_forge(args))
        .await
        .map_err(|e| format!("forge subprocess join failed: {e}"))?
}

#[tauri::command]
pub async fn forge_status() -> Result<ForgeStatus, String> {
    let root = forge_root()?;
    let binary = forge_binary(&root);
    let mut estates: Vec<String> = std::fs::read_dir(root.join("inputs").join("estates"))
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let p = e.path();
            if p.extension()?.to_str()? == "json" {
                Some(p.file_stem()?.to_str()?.to_string())
            } else {
                None
            }
        })
        .collect();
    estates.sort();

    Ok(ForgeStatus {
        root: root.display().to_string(),
        binary_exists: binary.is_file(),
        binary: binary.display().to_string(),
        estates,
    })
}

/// `forge inspect --all` — enumerate every registered form's fields.
#[tauri::command]
pub async fn forge_inspect_all() -> Result<ForgeRun, String> {
    spawn(vec!["inspect".into(), "--all".into()]).await
}

/// `forge fill <form> --estate <id> [--binding-version <n>]`.
///
/// Deterministic: the binding was compiled and approved earlier, and `fill`
/// asserts at runtime that it made no model calls.
#[tauri::command]
pub async fn forge_fill(
    form: String,
    estate: String,
    binding_version: Option<u32>,
) -> Result<ForgeRun, String> {
    let mut args = vec!["fill".into(), form, "--estate".into(), estate];
    if let Some(v) = binding_version {
        args.push("--binding-version".into());
        args.push(v.to_string());
    }
    spawn(args).await
}

/// `forge bench` — every applicable (estate, form) pair, with a written report.
#[tauri::command]
pub async fn forge_bench() -> Result<ForgeRun, String> {
    spawn(vec!["bench".into()]).await
}

/// What has been compiled, read from `forge/artifacts/` rather than hardcoded.
#[tauri::command]
pub async fn forge_artifacts(form_ids: Vec<String>) -> Result<Vec<FormArtifacts>, String> {
    let root = forge_root()?;
    let approved_dir = root.join("artifacts").join("approved");
    let bindings_dir = root.join("artifacts").join("bindings");
    let fills_dir = root.join("out").join("fills");

    let mut out = Vec::new();
    for form_id in form_ids {
        // artifacts/approved/<formId>.v<N>.json — highest N wins, per the spec.
        let mut best: Option<(u32, PathBuf)> = None;
        if let Ok(entries) = std::fs::read_dir(&approved_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                let name = match path.file_name().and_then(|n| n.to_str()) {
                    Some(n) => n,
                    None => continue,
                };
                let prefix = format!("{form_id}.v");
                if !name.starts_with(&prefix) || !name.ends_with(".json") {
                    continue;
                }
                let version: u32 = match name[prefix.len()..name.len() - 5].parse() {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                if best.as_ref().map_or(true, |(b, _)| version > *b) {
                    best = Some((version, path));
                }
            }
        }

        let draft = bindings_dir.join(format!("{form_id}.json"));
        let mut fills: Vec<String> = Vec::new();
        if let Ok(entries) = std::fs::read_dir(&fills_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                // Fills are named "<estateId>-<formId>[-anvil].pdf".
                if let Some(name) = entry.file_name().to_str() {
                    if name.contains(&form_id) && name.ends_with(".pdf") {
                        fills.push(name.to_string());
                    }
                }
            }
        }
        fills.sort();

        out.push(FormArtifacts {
            form_id,
            approved_version: best.as_ref().map(|(v, _)| *v),
            approved_path: best.as_ref().map(|(_, p)| p.display().to_string()),
            has_draft: draft.is_file(),
            draft_path: draft.is_file().then(|| draft.display().to_string()),
            fills,
        });
    }
    Ok(out)
}

/// Read a JSON artifact from under the Forge root. Path is relative to it, and
/// may not escape it.
#[tauri::command]
pub async fn forge_read_artifact(relative: String) -> Result<String, String> {
    let root = forge_root()?;
    let target = root.join(&relative);
    let canonical = target
        .canonicalize()
        .map_err(|e| format!("{}: {e}", target.display()))?;
    let root_canonical = root.canonicalize().map_err(|e| e.to_string())?;
    if !canonical.starts_with(&root_canonical) {
        return Err(format!("{relative} is outside the Forge root"));
    }
    std::fs::read_to_string(&canonical).map_err(|e| format!("{}: {e}", canonical.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The Block 2 check, as a test: the exact invocation the pane makes, run
    /// through the same code path, proving a real PDF and a sidecar that
    /// records no model calls at fill time.
    #[test]
    fn fill_produces_a_pdf_with_no_model_calls() {
        let run = run_forge(vec![
            "fill".into(),
            "irs-f56".into(),
            "--estate".into(),
            "estate-05-in-formal-probate".into(),
            "--binding-version".into(),
            "3".into(),
        ])
        .expect("forge should be runnable");

        assert!(run.ok, "exit {:?}\nstdout: {}\nstderr: {}", run.code, run.stdout, run.stderr);
        assert!(run.stdout.contains("llmCallsAtRuntime=0"), "stdout: {}", run.stdout);

        let root = forge_root().unwrap();
        let pdf = root.join("out/fills/estate-05-in-formal-probate-irs-f56.pdf");
        let sidecar = root.join("out/fills/estate-05-in-formal-probate-irs-f56.json");
        assert!(pdf.is_file(), "no PDF at {}", pdf.display());
        let json = std::fs::read_to_string(&sidecar).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["llmCallsAtRuntime"], 0);
    }

    /// A failure must be visible. A bad form id comes back as a completed run
    /// carrying a non-zero exit code and the message — not as a silent success,
    /// and not as an error the interface can drop on the floor.
    #[test]
    fn a_bad_form_id_surfaces_rather_than_vanishing() {
        let run = run_forge(vec![
            "fill".into(),
            "irs-f56-does-not-exist".into(),
            "--estate".into(),
            "estate-05-in-formal-probate".into(),
        ])
        .expect("the process should still run");

        assert!(!run.ok, "a nonexistent form id must not report success");
        assert_ne!(run.code, Some(0));
        let said = format!("{}{}", run.stdout, run.stderr);
        assert!(said.contains("irs-f56-does-not-exist"), "said nothing about it: {said}");
    }

    /// Compiling a form spends model calls and takes minutes. It is not on the
    /// end of a button, and the refusal says why.
    #[test]
    fn bind_is_not_reachable_from_the_interface() {
        let err = run_forge(vec!["bind".into(), "irs-f56".into()]).unwrap_err();
        assert!(err.contains("not reachable"), "{err}");
        assert!(err.contains("five minutes"), "{err}");
    }

    #[test]
    fn the_interpreter_is_the_venv_never_the_path() {
        let root = forge_root().unwrap();
        let binary = forge_binary(&root);
        assert!(binary.ends_with("forge/.venv/bin/forge"), "{}", binary.display());
        assert!(binary.is_absolute());
    }

    /// The compile state the pane renders comes off disk.
    #[test]
    fn artifacts_report_the_approved_version_from_disk() {
        let root = forge_root().unwrap();
        let approved = root.join("artifacts/approved");
        let highest = std::fs::read_dir(&approved)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter_map(|e| {
                let name = e.file_name().to_str()?.to_string();
                let rest = name.strip_prefix("irs-f56.v")?.strip_suffix(".json")?.to_string();
                rest.parse::<u32>().ok()
            })
            .max();
        let got = tauri::async_runtime::block_on(forge_artifacts(vec!["irs-f56".into()])).unwrap();
        assert_eq!(got[0].approved_version, highest);
    }
}
