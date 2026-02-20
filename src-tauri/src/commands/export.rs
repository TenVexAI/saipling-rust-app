use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExportFormat {
    #[serde(rename = "pdf")]
    Pdf,
    #[serde(rename = "docx")]
    Docx,
    #[serde(rename = "epub")]
    Epub,
    #[serde(rename = "markdown")]
    Markdown,
    #[serde(rename = "latex")]
    LaTeX,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportOptions {
    pub include_front_matter: bool,
    pub include_back_matter: bool,
    pub include_chapter_headings: bool,
    pub page_size: String, // "letter" or "a4"
}

impl Default for ExportOptions {
    fn default() -> Self {
        Self {
            include_front_matter: true,
            include_back_matter: true,
            include_chapter_headings: true,
            page_size: "letter".to_string(),
        }
    }
}

fn check_pandoc() -> bool {
    std::process::Command::new("pandoc")
        .arg("--version")
        .output()
        .is_ok()
}

#[tauri::command]
pub fn export_book(
    project_dir: PathBuf,
    book_id: String,
    format: ExportFormat,
    options: ExportOptions,
    output_path: PathBuf,
) -> Result<String, AppError> {
    let book_dir = project_dir.join("books").join(&book_id);
    if !book_dir.exists() {
        return Err(AppError::BookNotFound(book_id));
    }

    // Collect all content in order
    let mut parts: Vec<String> = Vec::new();

    // Front matter
    if options.include_front_matter {
        let fm_dir = book_dir.join("front-matter");
        let fm_order = ["title-page", "copyright", "dedication", "epigraph",
                        "acknowledgments", "foreword", "preface", "prologue"];
        for subtype in &fm_order {
            let path = fm_dir.join(format!("{}.md", subtype));
            if path.exists() {
                let content = std::fs::read_to_string(&path)?;
                let (_, body) = parse_frontmatter_simple(&content);
                if !body.trim().is_empty() {
                    parts.push(body);
                    parts.push("\n\n---\n\n".to_string());
                }
            }
        }
    }

    // Chapters and scenes
    let book_json_path = book_dir.join("book.json");
    let book_data: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&book_json_path)?)?;

    if let Some(chapters) = book_data.get("chapters").and_then(|v| v.as_array()) {
        let mut sorted_chapters: Vec<_> = chapters.iter().collect();
        sorted_chapters.sort_by_key(|ch| {
            ch.get("sort_order").and_then(|v| v.as_u64()).unwrap_or(0)
        });

        for ch in sorted_chapters {
            let ch_id = ch.get("id").and_then(|v| v.as_str()).unwrap_or("");
            let ch_title = ch.get("title").and_then(|v| v.as_str()).unwrap_or("");

            if options.include_chapter_headings && !ch_title.is_empty() {
                parts.push(format!("# {}\n\n", ch_title));
            }

            if let Some(scenes) = ch.get("scenes").and_then(|v| v.as_array()) {
                let mut sorted_scenes: Vec<_> = scenes.iter().collect();
                sorted_scenes.sort_by_key(|sc| {
                    sc.get("sort_order").and_then(|v| v.as_u64()).unwrap_or(0)
                });

                for sc in sorted_scenes {
                    let sc_id = sc.get("id").and_then(|v| v.as_str()).unwrap_or("");
                    let draft_path = book_dir.join("chapters").join(ch_id).join(sc_id).join("draft.md");
                    if draft_path.exists() {
                        let content = std::fs::read_to_string(&draft_path)?;
                        let (_, body) = parse_frontmatter_simple(&content);
                        if !body.trim().is_empty() {
                            parts.push(body);
                            parts.push("\n\n".to_string());
                        }
                    }
                }
            }
        }
    }

    // Back matter
    if options.include_back_matter {
        let bm_dir = book_dir.join("back-matter");
        let bm_order = ["epilogue", "afterword", "acknowledgments", "about-the-author"];
        for subtype in &bm_order {
            let path = bm_dir.join(format!("{}.md", subtype));
            if path.exists() {
                let content = std::fs::read_to_string(&path)?;
                let (_, body) = parse_frontmatter_simple(&content);
                if !body.trim().is_empty() {
                    parts.push("\n\n---\n\n".to_string());
                    parts.push(body);
                }
            }
        }
    }

    let combined = parts.join("");

    // Export based on format
    let exports_dir = project_dir.join("exports");
    std::fs::create_dir_all(&exports_dir)?;

    let final_output = if output_path.as_os_str().is_empty() {
        let ext = match format {
            ExportFormat::Pdf => "pdf",
            ExportFormat::Docx => "docx",
            ExportFormat::Epub => "epub",
            ExportFormat::Markdown => "md",
            ExportFormat::LaTeX => "tex",
        };
        exports_dir.join(format!("{}-export.{}", book_id, ext))
    } else {
        output_path
    };

    match format {
        ExportFormat::Markdown => {
            std::fs::write(&final_output, &combined)?;
        }
        _ => {
            if !check_pandoc() {
                return Err(AppError::ExportError(
                    "Pandoc is not installed or not found on PATH. Install from https://pandoc.org/installing.html".into()
                ));
            }

            let temp_md = exports_dir.join(format!("{}-temp.md", book_id));
            std::fs::write(&temp_md, &combined)?;

            let format_arg = match format {
                ExportFormat::Pdf => "pdf",
                ExportFormat::Docx => "docx",
                ExportFormat::Epub => "epub",
                ExportFormat::LaTeX => "latex",
                ExportFormat::Markdown => unreachable!(),
            };

            let mut cmd = std::process::Command::new("pandoc");
            cmd.arg(&temp_md)
                .arg("-o")
                .arg(&final_output)
                .arg("-f")
                .arg("markdown")
                .arg("-t")
                .arg(format_arg);

            if matches!(format, ExportFormat::Pdf) {
                cmd.arg("--pdf-engine=xelatex");
                if options.page_size == "a4" {
                    cmd.arg("-V").arg("geometry:a4paper");
                } else {
                    cmd.arg("-V").arg("geometry:letterpaper");
                }
            }

            let output = cmd.output()
                .map_err(|e| AppError::ExportError(format!("Failed to run pandoc: {}", e)))?;

            // Clean up temp file
            let _ = std::fs::remove_file(&temp_md);

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(AppError::ExportError(format!("Pandoc error: {}", stderr)));
            }
        }
    }

    Ok(final_output.to_string_lossy().to_string())
}

fn parse_frontmatter_simple(content: &str) -> ((), String) {
    if content.starts_with("---\n") || content.starts_with("---\r\n") {
        let rest = &content[4..];
        if let Some(end) = rest.find("\n---") {
            let body = rest[end + 4..].trim_start_matches('\n').trim_start_matches('\r');
            return ((), body.to_string());
        }
    }
    ((), content.to_string())
}
