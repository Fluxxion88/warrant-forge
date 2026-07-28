//! Anvil integration — register, reconcile, fill, sign, retrieve.
//!
//! Same secret discipline as `providers.rs`: the API key lives in an owner-only
//! file in the OS config directory and is never returned to the frontend. The
//! renderer sends field data and a form code; Rust adds the credential.
//!
//! Two Anvil surfaces are used. The REST fill endpoint returns a filled PDF as
//! binary. Everything else — creating a template from a PDF, reading back its
//! detected fields, and creating an e-signature packet — is GraphQL.
//!
//! The interesting one is `createCast`: it accepts `aliasIds`, so when we upload
//! a court form we hand Anvil the same field aliases our bindings already use
//! and its detection maps onto them directly. That is what makes adding a form
//! a data change rather than an integration project.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::io::Write;
use std::path::PathBuf;
use tauri::Manager;

const FILL_BASE: &str = "https://app.useanvil.com/api/v1/fill";
const GRAPHQL_URL: &str = "https://graphql.useanvil.com";
const DOCGROUP_BASE: &str = "https://app.useanvil.com/api/document-group";

#[derive(Serialize, Deserialize, Default, Clone)]
struct AnvilConfig {
    #[serde(default)]
    api_key: Option<String>,
    /// Template (cast) eids keyed by form code, e.g. "DE-310".
    #[serde(default)]
    templates: BTreeMap<String, String>,
    /// Etch packet eids keyed by form code, for retrieving signed output.
    #[serde(default)]
    packets: BTreeMap<String, PacketRef>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PacketRef {
    pub packet_eid: String,
    pub document_group_eid: String,
    pub signer_eid: String,
    pub status: String,
}

/// What the frontend is allowed to know: whether a key exists, never its value.
#[derive(Serialize)]
pub struct AnvilStatus {
    pub has_key: bool,
    pub templates: BTreeMap<String, String>,
    pub packets: BTreeMap<String, PacketRef>,
}

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("anvil.json"))
}

fn load(app: &tauri::AppHandle) -> AnvilConfig {
    let Ok(path) = config_path(app) else { return AnvilConfig::default() };
    let Ok(bytes) = std::fs::read(path) else { return AnvilConfig::default() };
    serde_json::from_slice(&bytes).unwrap_or_default()
}

fn save(app: &tauri::AppHandle, cfg: &AnvilConfig) -> Result<(), String> {
    let path = config_path(app)?;
    let json = serde_json::to_vec_pretty(cfg).map_err(|e| e.to_string())?;
    let mut file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = file.set_permissions(std::fs::Permissions::from_mode(0o600));
    }
    file.write_all(&json).map_err(|e| e.to_string())?;
    Ok(())
}

fn key_of(cfg: &AnvilConfig) -> Result<String, String> {
    cfg.api_key
        .clone()
        .filter(|k| !k.is_empty())
        .ok_or_else(|| "No Anvil API key configured.".to_string())
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| e.to_string())
}

/// Anvil authenticates with HTTP Basic where the API key is the username and
/// the password is empty — on the REST endpoint and on GraphQL alike.
async fn graphql(
    key: &str,
    query: &str,
    variables: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let resp = client()?
        .post(GRAPHQL_URL)
        .basic_auth(key, Some(""))
        .json(&serde_json::json!({ "query": query, "variables": variables }))
        .send()
        .await
        .map_err(|e| format!("Anvil GraphQL request failed: {e}"))?;

    let status = resp.status();
    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Anvil returned a non-JSON response: {e}"))?;

    if !status.is_success() {
        return Err(format!("Anvil GraphQL error {status}: {body}"));
    }
    // GraphQL reports application errors with HTTP 200, so the body must be
    // inspected even on success.
    if let Some(errors) = body.get("errors") {
        if !errors.is_null() {
            return Err(format!("Anvil GraphQL error: {errors}"));
        }
    }
    body.get("data")
        .cloned()
        .ok_or_else(|| "Anvil GraphQL response contained no data.".to_string())
}

#[tauri::command]
pub fn anvil_status(app: tauri::AppHandle) -> AnvilStatus {
    let cfg = load(&app);
    AnvilStatus {
        has_key: cfg.api_key.as_deref().map(|k| !k.is_empty()).unwrap_or(false),
        templates: cfg.templates,
        packets: cfg.packets,
    }
}

/// Store the API key. Passing `None` leaves the existing key untouched so the
/// UI can register a template without re-handling the secret.
#[tauri::command]
pub fn anvil_save(
    app: tauri::AppHandle,
    api_key: Option<String>,
    form_code: Option<String>,
    template_id: Option<String>,
) -> Result<(), String> {
    let mut cfg = load(&app);
    if let Some(k) = api_key {
        cfg.api_key = if k.is_empty() { None } else { Some(k) };
    }
    if let (Some(code), Some(tid)) = (form_code, template_id) {
        if tid.is_empty() {
            cfg.templates.remove(&code);
        } else {
            cfg.templates.insert(code, tid);
        }
    }
    save(&app, &cfg)
}

// ---------------------------------------------------------------------------
// Register a form
// ---------------------------------------------------------------------------

const CREATE_CAST: &str = r#"
mutation CreateCast(
  $title: String!,
  $file: Upload!,
  $detectFields: Boolean,
  $advancedDetectFields: Boolean,
  $aliasIds: [String]
) {
  createCast(
    title: $title,
    file: $file,
    detectFields: $detectFields,
    advancedDetectFields: $advancedDetectFields,
    aliasIds: $aliasIds
  ) {
    eid
    name
    title
    fieldInfo
  }
}
"#;

const PUBLISH_CAST: &str = r#"
mutation PublishCast($eid: String!) {
  publishCast(eid: $eid) { eid versionNumber }
}
"#;

#[derive(Serialize)]
pub struct RegisteredCast {
    pub form_code: String,
    pub cast_eid: String,
    pub field_info: serde_json::Value,
}

/// Upload a PDF and register it as a template.
///
/// `alias_ids` are our own binding aliases. Anvil's field detection maps onto
/// them, so a newly registered form arrives already keyed the way the rest of
/// this codebase expects — which is what makes adding the hundredth form the
/// same amount of work as adding the second.
#[tauri::command]
pub async fn anvil_register_form(
    app: tauri::AppHandle,
    form_code: String,
    title: String,
    pdf_path: String,
    alias_ids: Vec<String>,
    advanced_detect: Option<bool>,
) -> Result<RegisteredCast, String> {
    let cfg = load(&app);
    let key = key_of(&cfg)?;

    let bytes = std::fs::read(&pdf_path).map_err(|e| format!("Cannot read {pdf_path}: {e}"))?;
    if bytes.len() < 5 || &bytes[..4] != b"%PDF" {
        return Err(format!("{pdf_path} is not a PDF."));
    }
    let b64 = base64_encode(&bytes);
    let filename = std::path::Path::new(&pdf_path)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| format!("{form_code}.pdf"));

    let data = graphql(
        &key,
        CREATE_CAST,
        serde_json::json!({
            "title": title,
            "file": { "data": b64, "filename": filename, "mimetype": "application/pdf" },
            "detectFields": true,
            "advancedDetectFields": advanced_detect.unwrap_or(true),
            "aliasIds": alias_ids,
        }),
    )
    .await?;

    let cast = data
        .get("createCast")
        .ok_or("Anvil did not return a cast.")?
        .clone();
    let eid = cast
        .get("eid")
        .and_then(|v| v.as_str())
        .ok_or("Anvil cast has no eid.")?
        .to_string();

    // A cast must be published before it can be filled.
    let _ = graphql(&key, PUBLISH_CAST, serde_json::json!({ "eid": eid })).await?;

    let mut cfg = load(&app);
    cfg.templates.insert(form_code.clone(), eid.clone());
    save(&app, &cfg)?;

    Ok(RegisteredCast {
        form_code,
        cast_eid: eid,
        field_info: cast.get("fieldInfo").cloned().unwrap_or(serde_json::Value::Null),
    })
}

// ---------------------------------------------------------------------------
// Read back a template's fields, so bindings can be reconciled
// ---------------------------------------------------------------------------

const CAST_QUERY: &str = r#"
query Cast($eid: String!) {
  cast(eid: $eid) { eid name title fieldInfo }
}
"#;

/// Fetch the field definitions Anvil actually holds for a registered form.
/// Used to detect binding drift — a field we write to that no longer exists is
/// silently dropped by the fill endpoint, which is exactly the kind of quiet
/// failure this project refuses to accept.
#[tauri::command]
pub async fn anvil_cast_fields(
    app: tauri::AppHandle,
    form_code: String,
) -> Result<serde_json::Value, String> {
    let cfg = load(&app);
    let key = key_of(&cfg)?;
    let eid = cfg
        .templates
        .get(&form_code)
        .cloned()
        .ok_or_else(|| format!("No Anvil template registered for {form_code}."))?;

    let data = graphql(&key, CAST_QUERY, serde_json::json!({ "eid": eid })).await?;
    Ok(data
        .get("cast")
        .and_then(|c| c.get("fieldInfo"))
        .cloned()
        .unwrap_or(serde_json::Value::Null))
}

// ---------------------------------------------------------------------------
// Fill
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct FilledForm {
    pub path: String,
    pub bytes: usize,
}

/// Fill a template and write the PDF into the app data directory.
///
/// The response body is raw PDF bytes — it must be written as binary, never
/// through a string, or the file is corrupt.
#[tauri::command]
pub async fn anvil_fill(
    app: tauri::AppHandle,
    form_code: String,
    title: String,
    data: serde_json::Value,
) -> Result<FilledForm, String> {
    let cfg = load(&app);
    let key = key_of(&cfg)?;
    let template_id = cfg
        .templates
        .get(&form_code)
        .cloned()
        .ok_or_else(|| format!("No Anvil template registered for {form_code}."))?;

    let body = serde_json::json!({ "title": title, "data": data });

    let resp = client()?
        .post(format!("{FILL_BASE}/{template_id}.pdf"))
        .basic_auth(&key, Some(""))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anvil request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Anvil error {status}: {text}"));
    }

    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    if bytes.len() < 5 || &bytes[..4] != b"%PDF" {
        return Err("Anvil returned something that is not a PDF.".into());
    }

    write_output(&app, &form_code, "filled", &bytes)
}

// ---------------------------------------------------------------------------
// Sign
// ---------------------------------------------------------------------------

const CREATE_ETCH_PACKET: &str = r#"
mutation CreateEtchPacket(
  $name: String!,
  $isDraft: Boolean,
  $isTest: Boolean,
  $files: [EtchFile!],
  $data: JSON,
  $signers: [JSON!]
) {
  createEtchPacket(
    name: $name,
    isDraft: $isDraft,
    isTest: $isTest,
    files: $files,
    data: $data,
    signers: $signers
  ) {
    eid
    status
    documentGroup {
      eid
      status
      signers { eid aliasId status }
    }
  }
}
"#;

const GENERATE_SIGN_URL: &str = r#"
mutation GenerateEtchSignURL($signerEid: String!, $clientUserId: String!) {
  generateEtchSignURL(signerEid: $signerEid, clientUserId: $clientUserId) { url }
}
"#;

#[derive(Serialize)]
pub struct EtchPacketResult {
    pub packet_eid: String,
    pub document_group_eid: String,
    pub signer_eid: String,
    pub status: String,
}

/// Create an e-signature packet from an already-registered template.
///
/// The payload is the same field-keyed object used for filling, so a form is
/// filled and signed from one data path — the values on the signed document are
/// the values the ledger verified.
#[tauri::command]
pub async fn anvil_create_signature_packet(
    app: tauri::AppHandle,
    form_code: String,
    packet_name: String,
    data: serde_json::Value,
    signer_name: String,
    signer_email: String,
    is_test: Option<bool>,
) -> Result<EtchPacketResult, String> {
    let cfg = load(&app);
    let key = key_of(&cfg)?;
    let cast_eid = cfg
        .templates
        .get(&form_code)
        .cloned()
        .ok_or_else(|| format!("No Anvil template registered for {form_code}."))?;

    let file_id = "form";
    let files = serde_json::json!([{
        "id": file_id,
        "castEid": cast_eid,
        "filename": format!("{form_code}.pdf"),
        "title": form_code,
    }]);

    let payload = serde_json::json!({
        "payloads": { file_id: { "data": data } }
    });

    // Embedded signing keeps the executor inside the application rather than
    // bouncing them through email, which matters for a service Alix wants to
    // stay human-led.
    let signers = serde_json::json!([{
        "id": "executor",
        "name": signer_name,
        "email": signer_email,
        "signerType": "embedded",
        "routingOrder": 1,
        "signatureMode": "draw",
    }]);

    let result = graphql(
        &key,
        CREATE_ETCH_PACKET,
        serde_json::json!({
            "name": packet_name,
            "isDraft": false,
            "isTest": is_test.unwrap_or(true),
            "files": files,
            "data": payload,
            "signers": signers,
        }),
    )
    .await?;

    let packet = result
        .get("createEtchPacket")
        .ok_or("Anvil did not return a packet.")?;
    let dg = packet.get("documentGroup").ok_or("Packet has no document group.")?;
    let signer_eid = dg
        .get("signers")
        .and_then(|s| s.as_array())
        .and_then(|a| a.first())
        .and_then(|s| s.get("eid"))
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();

    let out = EtchPacketResult {
        packet_eid: packet.get("eid").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
        document_group_eid: dg.get("eid").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
        signer_eid,
        status: packet.get("status").and_then(|v| v.as_str()).unwrap_or("unknown").to_string(),
    };

    let mut cfg = load(&app);
    cfg.packets.insert(
        form_code,
        PacketRef {
            packet_eid: out.packet_eid.clone(),
            document_group_eid: out.document_group_eid.clone(),
            signer_eid: out.signer_eid.clone(),
            status: out.status.clone(),
        },
    );
    save(&app, &cfg)?;

    Ok(out)
}

/// Obtain an embedded signing URL for a signer created above.
#[tauri::command]
pub async fn anvil_sign_url(
    app: tauri::AppHandle,
    signer_eid: String,
    client_user_id: String,
) -> Result<String, String> {
    let cfg = load(&app);
    let key = key_of(&cfg)?;
    let data = graphql(
        &key,
        GENERATE_SIGN_URL,
        serde_json::json!({ "signerEid": signer_eid, "clientUserId": client_user_id }),
    )
    .await?;
    data.get("generateEtchSignURL")
        .and_then(|v| v.get("url"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Anvil did not return a signing URL.".to_string())
}

/// Download the completed, signed document set as a zip.
#[tauri::command]
pub async fn anvil_download_signed(
    app: tauri::AppHandle,
    form_code: String,
) -> Result<FilledForm, String> {
    let cfg = load(&app);
    let key = key_of(&cfg)?;
    let packet = cfg
        .packets
        .get(&form_code)
        .cloned()
        .ok_or_else(|| format!("No signature packet recorded for {form_code}."))?;

    let resp = client()?
        .get(format!("{DOCGROUP_BASE}/{}.zip", packet.document_group_eid))
        .basic_auth(&key, Some(""))
        .send()
        .await
        .map_err(|e| format!("Anvil download failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Anvil download error {status}: {text}"));
    }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    write_output(&app, &form_code, "signed", &bytes)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn write_output(
    app: &tauri::AppHandle,
    form_code: &str,
    kind: &str,
    bytes: &[u8],
) -> Result<FilledForm, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(kind);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let safe: String = form_code
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect();
    let ext = if kind == "signed" { "zip" } else { "pdf" };
    let path = dir.join(format!("{safe}.{ext}"));
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(FilledForm {
        path: path.to_string_lossy().to_string(),
        bytes: bytes.len(),
    })
}

/// Minimal base64 encoder — avoids pulling a crate in for one call site.
fn base64_encode(input: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((input.len() + 2) / 3 * 4);
    for chunk in input.chunks(3) {
        let b = [chunk[0], *chunk.get(1).unwrap_or(&0), *chunk.get(2).unwrap_or(&0)];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        out.push(T[(n >> 18) as usize & 63] as char);
        out.push(T[(n >> 12) as usize & 63] as char);
        out.push(if chunk.len() > 1 { T[(n >> 6) as usize & 63] as char } else { '=' });
        out.push(if chunk.len() > 2 { T[n as usize & 63] as char } else { '=' });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::base64_encode;

    #[test]
    fn base64_matches_known_vectors() {
        assert_eq!(base64_encode(b""), "");
        assert_eq!(base64_encode(b"f"), "Zg==");
        assert_eq!(base64_encode(b"fo"), "Zm8=");
        assert_eq!(base64_encode(b"foo"), "Zm9v");
        assert_eq!(base64_encode(b"foob"), "Zm9vYg==");
        assert_eq!(base64_encode(b"fooba"), "Zm9vYmE=");
        assert_eq!(base64_encode(b"foobar"), "Zm9vYmFy");
    }

    #[test]
    fn base64_handles_binary() {
        assert_eq!(base64_encode(&[0x25, 0x50, 0x44, 0x46]), "JVBERg==");
    }
}
