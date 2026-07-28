use serde::Serialize;
use std::io::Read;
use std::path::Path;

/// One imported document plus what we know about how cleanly it converted.
/// `warning` is surfaced in the UI so a reviewer knows when extraction was
/// lossy — silently importing an empty scan is worse than refusing it.
#[derive(Serialize, Debug)]
pub struct Extracted {
    pub name: String,
    pub content: String,
    pub kind: String,
    pub warning: Option<String>,
}

const MAX_BYTES: u64 = 200 * 1024 * 1024;

fn ext_of(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase()
}

fn file_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or(path)
        .to_string()
}

/// Extract readable text from a data-room document.
///
/// Supports PDF, Excel (xlsx/xlsm/xls), Word (docx), PowerPoint (pptx) and
/// plain text. Spreadsheets keep their sheet and row structure, because a
/// flattened workbook loses the relationships diligence depends on.
#[tauri::command]
pub fn extract_document(path: String) -> Result<Extracted, String> {
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > MAX_BYTES {
        return Err(format!("{} exceeds the 200 MB import limit.", file_name(&path)));
    }
    let name = file_name(&path);
    let ext = ext_of(&path);

    let (content, kind, warning) = match ext.as_str() {
        "pdf" => extract_pdf(&path)?,
        "xlsx" | "xlsm" | "xls" | "xlsb" | "ods" => extract_spreadsheet(&path)?,
        "docx" => (extract_ooxml(&path, "word/document.xml")?, "Word".to_string(), None),
        "pptx" => (extract_pptx(&path)?, "PowerPoint".to_string(), None),
        "txt" | "md" | "csv" | "tsv" | "json" | "log" | "text" => {
            let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
            (String::from_utf8_lossy(&bytes).to_string(), "Text".to_string(), None)
        }
        other => {
            return Err(format!(
                "{name}: .{other} files are not supported. Supported: PDF, XLSX, DOCX, PPTX, CSV, TXT, MD."
            ))
        }
    };

    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Err(format!(
            "{name}: no text could be extracted. If this is a scanned document it needs OCR before import."
        ));
    }

    Ok(Extracted { name, content: trimmed.to_string(), kind, warning })
}

fn extract_pdf(path: &str) -> Result<(String, String, Option<String>), String> {
    // pdf-extract panics on some malformed files; contain it so one bad
    // document cannot take down an import batch.
    let path_owned = path.to_string();
    let result = std::panic::catch_unwind(move || pdf_extract::extract_text(&path_owned));
    let text = match result {
        Ok(Ok(t)) => t,
        Ok(Err(e)) => return Err(format!("PDF could not be read: {e}")),
        Err(_) => return Err("PDF is malformed and could not be parsed.".into()),
    };

    // A PDF yielding almost no text is a scan, not a text document.
    let warning = if text.trim().len() < 200 {
        Some("Very little text extracted — this is likely a scanned document requiring OCR.".to_string())
    } else {
        None
    };
    Ok((normalise_ws(&text), "PDF".to_string(), warning))
}

fn extract_spreadsheet(path: &str) -> Result<(String, String, Option<String>), String> {
    use calamine::{open_workbook_auto, Data, Reader};
    let mut wb = open_workbook_auto(path).map_err(|e| format!("workbook could not be opened: {e}"))?;
    let mut out = String::new();
    let mut truncated = false;

    let sheets: Vec<String> = wb.sheet_names().to_vec();
    for sheet in sheets {
        let Ok(range) = wb.worksheet_range(&sheet) else { continue };
        if range.is_empty() {
            continue;
        }
        out.push_str(&format!("\n### SHEET: {sheet}\n"));
        for (i, row) in range.rows().enumerate() {
            // Guard against a 100k-row export blowing the context budget.
            if i >= 5000 {
                truncated = true;
                out.push_str("… [sheet truncated at 5000 rows]\n");
                break;
            }
            let cells: Vec<String> = row
                .iter()
                .map(|c| match c {
                    Data::Empty => String::new(),
                    Data::String(s) => s.trim().to_string(),
                    Data::Float(f) => {
                        if f.fract() == 0.0 && f.abs() < 1e15 {
                            format!("{}", *f as i64)
                        } else {
                            format!("{f}")
                        }
                    }
                    Data::Int(i) => i.to_string(),
                    Data::Bool(b) => b.to_string(),
                    Data::DateTime(d) => d.to_string(),
                    Data::DateTimeIso(s) => s.clone(),
                    Data::DurationIso(s) => s.clone(),
                    Data::Error(e) => format!("#ERR:{e:?}"),
                })
                .collect();
            if cells.iter().all(|c| c.is_empty()) {
                continue;
            }
            out.push_str(&cells.join(" | "));
            out.push('\n');
        }
    }
    let warning =
        truncated.then(|| "One or more sheets exceeded 5000 rows and were truncated.".to_string());
    Ok((out, "Spreadsheet".to_string(), warning))
}

/// Pull the text runs out of an OOXML part inside a zip container.
fn extract_ooxml(path: &str, part: &str) -> Result<String, String> {
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("not a valid Office file: {e}"))?;
    let mut xml = String::new();
    zip.by_name(part)
        .map_err(|_| format!("{part} not found — the file may be corrupt or an older format"))?
        .read_to_string(&mut xml)
        .map_err(|e| e.to_string())?;
    Ok(xml_text(&xml))
}

fn extract_pptx(path: &str) -> Result<String, String> {
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut zip =
        zip::ZipArchive::new(file).map_err(|e| format!("not a valid PowerPoint file: {e}"))?;
    // Keep slides in numeric order — lexicographic puts slide10 before slide2.
    let mut slides: Vec<(usize, String)> = Vec::new();
    for i in 0..zip.len() {
        let name = { zip.by_index(i).map_err(|e| e.to_string())?.name().to_string() };
        if name.starts_with("ppt/slides/slide") && name.ends_with(".xml") {
            let n: usize = name
                .trim_start_matches("ppt/slides/slide")
                .trim_end_matches(".xml")
                .parse()
                .unwrap_or(usize::MAX);
            slides.push((n, name));
        }
    }
    slides.sort_by_key(|(n, _)| *n);

    let mut out = String::new();
    for (n, name) in slides {
        let mut xml = String::new();
        zip.by_name(&name)
            .map_err(|e| e.to_string())?
            .read_to_string(&mut xml)
            .map_err(|e| e.to_string())?;
        let text = xml_text(&xml);
        if !text.trim().is_empty() {
            out.push_str(&format!("\n### SLIDE {n}\n{text}\n"));
        }
    }
    Ok(out)
}

/// Concatenate the character data of an OOXML part, breaking at paragraph
/// boundaries so the output keeps its line structure.
fn xml_text(xml: &str) -> String {
    use quick_xml::events::Event;
    use quick_xml::Reader;

    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(false);
    let mut out = String::new();
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Text(e)) => {
                if let Ok(t) = e.unescape() {
                    out.push_str(t.as_ref());
                }
            }
            Ok(Event::End(e)) => {
                // </w:p> ends a Word paragraph; </a:p> a PowerPoint one.
                if e.name().local_name().as_ref() == b"p" {
                    out.push('\n');
                }
            }
            Ok(Event::Empty(e)) => {
                let name = e.name();
                let local = name.local_name();
                if local.as_ref() == b"br" || local.as_ref() == b"tab" {
                    out.push(' ');
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    normalise_ws(&out)
}

/// Collapse runaway blank lines and trailing spaces left by extraction.
fn normalise_ws(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut blank_run = 0;
    for line in text.lines() {
        let trimmed = line.trim_end();
        if trimmed.trim().is_empty() {
            blank_run += 1;
            if blank_run > 1 {
                continue;
            }
            out.push('\n');
        } else {
            blank_run = 0;
            out.push_str(trimmed);
            out.push('\n');
        }
    }
    out
}

/// Read a plain-text file the user picked.
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > 20 * 1024 * 1024 {
        return Err("File is over 20 MB of text.".into());
    }
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    String::from_utf8(bytes).map_err(|_| "This is not a plain-text file.".to_string())
}

/// Write to a path the user chose in the native save dialog.
#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp() -> std::path::PathBuf {
        let d = std::env::temp_dir().join("concord_docs_test");
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn xml_text_extracts_word_paragraphs_in_order() {
        let xml = r#"<w:document><w:body>
            <w:p><w:r><w:t>Revenue for FY24 was $48.2M</w:t></w:r></w:p>
            <w:p><w:r><w:t>Gross margin declined to 22%</w:t></w:r></w:p>
        </w:body></w:document>"#;
        let out = xml_text(xml);
        assert!(out.contains("Revenue for FY24 was $48.2M"));
        assert!(out.contains("Gross margin declined to 22%"));
        assert!(out.find("Revenue").unwrap() < out.find("Gross margin").unwrap());
    }

    #[test]
    fn xml_text_joins_runs_split_mid_sentence() {
        // Word splits a sentence across runs when formatting changes.
        let xml = r#"<w:p><w:r><w:t>change of </w:t></w:r><w:r><w:t>control</w:t></w:r></w:p>"#;
        assert!(xml_text(xml).contains("change of control"));
    }

    #[test]
    fn normalise_ws_collapses_blank_runs_and_trailing_space() {
        assert_eq!(normalise_ws("a   \n\n\n\nb\n"), "a\n\nb\n");
    }

    #[test]
    fn unsupported_extension_is_rejected() {
        let p = tmp().join("model.pptxx");
        std::fs::write(&p, b"x").unwrap();
        let err = extract_document(p.to_string_lossy().to_string()).unwrap_err();
        assert!(err.contains("not supported"), "{err}");
    }

    #[test]
    fn blank_file_is_rejected_rather_than_imported_empty() {
        let p = tmp().join("empty.txt");
        std::fs::write(&p, b"   \n  \n").unwrap();
        let err = extract_document(p.to_string_lossy().to_string()).unwrap_err();
        assert!(err.contains("no text could be extracted"), "{err}");
    }

    #[test]
    fn plain_text_import_round_trips() {
        let p = tmp().join("accounts.txt");
        std::fs::write(&p, b"Revenue FY24: $48.2M\nGross margin 22%\n").unwrap();
        let e = extract_document(p.to_string_lossy().to_string()).unwrap();
        assert_eq!(e.kind, "Text");
        assert!(e.content.contains("48.2M"));
        assert!(e.warning.is_none());
    }
}

#[cfg(test)]
mod realfiles {
    use super::*;

    /// Fixtures are committed under src-tauri/tests/fixtures so extraction is
    /// verified against genuine Office/PDF binaries, not synthetic XML.
    fn room(name: &str) -> String {
        format!("{}/tests/fixtures/{name}", env!("CARGO_MANIFEST_DIR"))
    }

    #[test]
    fn extracts_real_xlsx_with_sheets_and_figures() {
        let e = extract_document(room("FY24 Management Accounts.xlsx")).unwrap();
        assert_eq!(e.kind, "Spreadsheet");
        assert!(e.content.contains("SHEET: P&L"), "{}", e.content);
        assert!(e.content.contains("SHEET: Customers"));
        assert!(e.content.contains("48200000"), "figures must survive: {}", e.content);
        assert!(e.content.contains("Apex Retail"));
    }

    #[test]
    fn extracts_real_docx_joining_split_runs() {
        let e = extract_document(room("MSA - Apex Retail.docx")).unwrap();
        assert_eq!(e.kind, "Word");
        // The clause was authored across three runs; it must read as one sentence.
        assert!(
            e.content.contains("change of control of the Supplier"),
            "runs must join: {}",
            e.content
        );
        assert!(e.content.contains("thirty (30) days written notice"));
    }

    #[test]
    fn extracts_real_pdf_text() {
        let e = extract_document(room("Board Minutes 2026-02.pdf")).unwrap();
        assert_eq!(e.kind, "PDF");
        assert!(e.content.contains("44 to 71 days"), "{}", e.content);
        assert!(e.content.contains("related party loan"));
    }
}
