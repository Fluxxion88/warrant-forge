use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::PathBuf;
use tauri::Manager;

/// A cloud model provider. Every provider except Anthropic speaks the
/// OpenAI chat-completions shape, so there are two request paths, not five.
/// API keys live only on disk in an owner-only file and are never returned
/// to the frontend — the UI sees `has_key`, never the value.
#[derive(Serialize, Deserialize, Clone)]
pub struct ProviderConfig {
    pub id: String,
    /// anthropic | openai | google | deepseek | moonshot | openai_compatible
    pub kind: String,
    pub label: String,
    #[serde(default)]
    pub base_url: Option<String>,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub enabled: bool,
}

#[derive(Serialize)]
pub struct ProviderPublic {
    pub id: String,
    pub kind: String,
    pub label: String,
    pub base_url: Option<String>,
    pub has_key: bool,
    pub enabled: bool,
}

fn default_base(kind: &str) -> &'static str {
    match kind {
        "anthropic" => "https://api.anthropic.com",
        "openai" => "https://api.openai.com/v1",
        "google" => "https://generativelanguage.googleapis.com/v1beta/openai",
        "deepseek" => "https://api.deepseek.com/v1",
        "moonshot" => "https://api.moonshot.ai/v1",
        _ => "",
    }
}

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("providers.json"))
}

fn load_configs(app: &tauri::AppHandle) -> Vec<ProviderConfig> {
    let Ok(path) = config_path(app) else { return vec![] };
    let Ok(bytes) = std::fs::read(path) else { return vec![] };
    serde_json::from_slice(&bytes).unwrap_or_default()
}

fn save_configs(app: &tauri::AppHandle, configs: &[ProviderConfig]) -> Result<(), String> {
    let path = config_path(app)?;
    let json = serde_json::to_vec_pretty(configs).map_err(|e| e.to_string())?;
    let mut file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    // Restrict the key file to its owner. On Windows the file inherits the
    // user-profile ACL, which is already user-only on a standard install;
    // tightening it further needs explicit ACL work and is not done here.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = file.set_permissions(std::fs::Permissions::from_mode(0o600));
    }
    file.write_all(&json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn providers_list(app: tauri::AppHandle) -> Vec<ProviderPublic> {
    load_configs(&app)
        .into_iter()
        .map(|c| ProviderPublic {
            has_key: c.api_key.as_deref().map(|k| !k.is_empty()).unwrap_or(false),
            id: c.id,
            kind: c.kind,
            label: c.label,
            base_url: c.base_url,
            enabled: c.enabled,
        })
        .collect()
}

/// Upsert a provider. `api_key: None` preserves the stored key so the UI can
/// toggle or rename without ever handling the secret.
#[tauri::command]
pub fn providers_save(
    app: tauri::AppHandle,
    id: String,
    kind: String,
    label: String,
    base_url: Option<String>,
    api_key: Option<String>,
    enabled: bool,
) -> Result<(), String> {
    let mut configs = load_configs(&app);
    let existing_key = configs.iter().find(|c| c.id == id).and_then(|c| c.api_key.clone());
    let key = match api_key {
        Some(k) if !k.is_empty() => Some(k),
        Some(_) => None,
        None => existing_key,
    };
    let cfg = ProviderConfig {
        id: id.clone(),
        kind,
        label,
        base_url: base_url.filter(|b| !b.is_empty()),
        api_key: key,
        enabled,
    };
    match configs.iter_mut().find(|c| c.id == id) {
        Some(slot) => *slot = cfg,
        None => configs.push(cfg),
    }
    save_configs(&app, &configs)
}

#[tauri::command]
pub fn providers_delete(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut configs = load_configs(&app);
    configs.retain(|c| c.id != id);
    save_configs(&app, &configs)
}

#[derive(Deserialize)]
pub struct ChatMsg {
    pub role: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct Completion {
    pub text: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub model: String,
}

fn http(timeout_secs: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(15))
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| e.to_string())
}

/// One completion from a configured provider — the single call the pipeline
/// makes for every agent turn on every level.
#[tauri::command]
pub async fn agent_complete(
    app: tauri::AppHandle,
    provider_id: String,
    model: String,
    messages: Vec<ChatMsg>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
) -> Result<Completion, String> {
    let cfg = load_configs(&app)
        .into_iter()
        .find(|c| c.id == provider_id)
        .ok_or_else(|| format!("provider '{provider_id}' is not configured"))?;
    let key = cfg
        .api_key
        .clone()
        .filter(|k| !k.is_empty())
        .ok_or_else(|| format!("no API key set for {}", cfg.label))?;
    let base = cfg
        .base_url
        .clone()
        .unwrap_or_else(|| default_base(&cfg.kind).to_string());
    let base = base.trim_end_matches('/').to_string();
    let temp = temperature.unwrap_or(0.3);
    let max_out = max_tokens.unwrap_or(8000);
    let client = http(900)?;

    if cfg.kind == "anthropic" {
        // The Messages API takes `system` separately from the turn list.
        let system: String = messages
            .iter()
            .filter(|m| m.role == "system")
            .map(|m| m.content.as_str())
            .collect::<Vec<_>>()
            .join("\n\n");
        let turns: Vec<_> = messages
            .iter()
            .filter(|m| m.role != "system")
            .map(|m| serde_json::json!({ "role": m.role, "content": m.content }))
            .collect();
        let mut body = serde_json::json!({
            "model": model,
            "system": system,
            "messages": turns,
            "max_tokens": max_out,
        });
        // Adaptive-thinking models reject sampling params. Confirmed against
        // /v1/models on 2026-07-28: opus-5, sonnet-5, fable-5, opus-4-8,
        // opus-4-7, opus-4-6 and sonnet-4-6 all report adaptive support;
        // opus-4-5, sonnet-4-5 and haiku-4-5 do not.
        //
        // "opus-5" does not match "claude-opus-4-5-20251101", whose substring is
        // "opus-4-5" — the dated older models fall through to temperature
        // correctly.
        let modern = model.contains("opus-5")
            || model.contains("sonnet-5")
            || model.contains("fable")
            || model.contains("opus-4-8")
            || model.contains("opus-4-7")
            || model.contains("opus-4-6")
            || model.contains("sonnet-4-6");
        if modern {
            body["thinking"] = serde_json::json!({ "type": "adaptive" });
        } else {
            body["temperature"] = serde_json::json!(temp);
        }
        let resp = client
            .post(format!("{base}/v1/messages"))
            .header("x-api-key", key)
            .header("anthropic-version", "2023-06-01")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("request failed: {e}"))?;
        let status = resp.status();
        let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        if !status.is_success() {
            return Err(format!(
                "{} error {status}: {}",
                cfg.label,
                v["error"]["message"].as_str().unwrap_or("unknown")
            ));
        }
        if v["stop_reason"].as_str() == Some("refusal") {
            return Err("the model declined this request".into());
        }
        // Join text blocks; thinking blocks carry no visible text.
        let text = v["content"]
            .as_array()
            .map(|blocks| {
                blocks
                    .iter()
                    .filter(|b| b["type"] == "text")
                    .filter_map(|b| b["text"].as_str())
                    .collect::<Vec<_>>()
                    .join("")
            })
            .unwrap_or_default();
        if text.trim().is_empty() {
            return Err(format!("empty response from {}", cfg.label));
        }
        return Ok(Completion {
            text,
            input_tokens: v["usage"]["input_tokens"].as_u64().unwrap_or(0),
            output_tokens: v["usage"]["output_tokens"].as_u64().unwrap_or(0),
            model,
        });
    }

    // Everything else speaks OpenAI chat-completions.
    let msgs: Vec<_> = messages
        .iter()
        .map(|m| serde_json::json!({ "role": m.role, "content": m.content }))
        .collect();
    let mut body = serde_json::json!({ "model": model, "messages": msgs });
    // Reasoning-first models reject `temperature` and rename the output cap.
    let reasoning_first = model.starts_with("o1")
        || model.starts_with("o3")
        || model.starts_with("o4")
        || model.contains("gpt-5");
    // Kimi K2.x hard-errors on any temperature but its own pinned value, and Gemini 3.6+
    // deprecated the parameter outright. Both still take `max_tokens`, so they must not be
    // routed through the reasoning_first branch, which renames the output cap.
    let omit_temperature = model.starts_with("kimi-") || cfg.kind == "google";
    if reasoning_first {
        body["max_completion_tokens"] = serde_json::json!(max_out);
    } else {
        if !omit_temperature {
            body["temperature"] = serde_json::json!(temp);
        }
        body["max_tokens"] = serde_json::json!(max_out);
    }

    let resp = client
        .post(format!("{base}/chat/completions"))
        .bearer_auth(key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;
    let status = resp.status();
    let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!(
            "{} error {status}: {}",
            cfg.label,
            v["error"]["message"].as_str().unwrap_or("unknown")
        ));
    }
    let text = v["choices"][0]["message"]["content"]
        .as_str()
        .map(String::from)
        .filter(|t| !t.trim().is_empty())
        .ok_or_else(|| format!("empty or unexpected response from {}", cfg.label))?;
    Ok(Completion {
        text,
        input_tokens: v["usage"]["prompt_tokens"].as_u64().unwrap_or(0),
        output_tokens: v["usage"]["completion_tokens"].as_u64().unwrap_or(0),
        model,
    })
}

/// Cheap round-trip to confirm a key and model work before a run burns budget.
#[tauri::command]
pub async fn provider_test(
    app: tauri::AppHandle,
    provider_id: String,
    model: String,
) -> Result<String, String> {
    let out = agent_complete(
        app,
        provider_id,
        model,
        vec![ChatMsg { role: "user".into(), content: "Reply with the single word: ready".into() }],
        Some(0.0),
        // Reasoning models spend this budget on thinking before emitting any text.
        // A 16-token cap yields empty content and reports a false failure on a good key.
        Some(2000),
    )
    .await?;
    Ok(out.text.trim().to_string())
}
