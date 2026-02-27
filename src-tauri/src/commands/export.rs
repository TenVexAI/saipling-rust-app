// Changes from previous version:
//   • Pandoc & Typst resolved as bundled sidecars (no PATH dependency)
//   • check_pandoc() exposed as a Tauri command
//   • ExportOptions gains `template: String`
//   • PDF uses Typst engine (bundled) instead of XeLaTeX
//   • Template files resolved from app resource directory
//   • Appendices included in back-matter assembly
//   • reveal_export_folder command added

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;
use crate::error::AppError;


// ── Enums & Options ───────────────────────────────────────────────────────────

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
    pub page_size: String,  // "letter" | "a4"
    pub template: String,   // template id, e.g. "standard-manuscript"
}

impl Default for ExportOptions {
    fn default() -> Self {
        Self {
            include_front_matter: true,
            include_back_matter: true,
            include_chapter_headings: true,
            page_size: "letter".to_string(),
            template: String::new(),
        }
    }
}

// ── Sidecar resolution ────────────────────────────────────────────────────────
// Pandoc and Typst are bundled as resources (Windows-only).
// At build time they live in src-tauri/binaries/ as pandoc.exe / typst.exe.
// At runtime they are in the app resource directory under binaries/.

fn find_sidecar(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, AppError> {
    let bin_name = format!("{}.exe", name);

    // Production: resource_dir()/binaries/
    if let Ok(resource_dir) = app.path().resource_dir() {
        let path = resource_dir.join("binaries").join(&bin_name);
        if path.exists() {
            return Ok(path);
        }
    }

    // Development: CARGO_MANIFEST_DIR/binaries/
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join(&bin_name);
    if dev_path.exists() {
        return Ok(dev_path);
    }

    // Last resort: system PATH
    if let Ok(output) = std::process::Command::new(&bin_name).arg("--version").output() {
        if output.status.success() {
            return Ok(PathBuf::from(bin_name));
        }
    }

    Err(AppError::ExportError(format!(
        "Cannot find bundled {}.exe", name
    )))
}

fn sidecar_pandoc(app: &tauri::AppHandle) -> Result<std::process::Command, AppError> {
    let path = find_sidecar(app, "pandoc")?;
    Ok(std::process::Command::new(path))
}

fn sidecar_typst(app: &tauri::AppHandle) -> Result<std::process::Command, AppError> {
    let path = find_sidecar(app, "typst")?;
    Ok(std::process::Command::new(path))
}

/// Resolve a template file from app resources.
/// Template files live in resources/export-templates/<format>/<template-id>.<ext>
fn resolve_template(
    app: &tauri::AppHandle,
    format_subdir: &str,
    template_id: &str,
    extension: &str,
) -> Option<PathBuf> {
    if template_id.is_empty() {
        return None;
    }

    let rel = format!("export-templates/{}/{}.{}", format_subdir, template_id, extension);

    // Production: resource_dir()
    if let Ok(resource_dir) = app.path().resource_dir() {
        let path = resource_dir.join(&rel);
        if path.exists() {
            return Some(path);
        }
    }

    // Development: relative to Cargo manifest
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join(&rel);
    if dev_path.exists() {
        return Some(dev_path);
    }

    None
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Returns true if the bundled pandoc binary is accessible.
#[tauri::command]
pub fn check_pandoc(app: tauri::AppHandle) -> bool {
    sidecar_pandoc(&app)
        .and_then(|mut cmd| {
            cmd.arg("--version")
                .output()
                .map_err(|e| AppError::ExportError(e.to_string()))
        })
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Reveal the project's exports/ folder in Finder / Explorer.
#[tauri::command]
pub fn reveal_export_folder(project_dir: PathBuf, _book_id: String) -> Result<(), AppError> {
    let exports_dir = project_dir.join("exports");
    std::fs::create_dir_all(&exports_dir)?;

    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(&exports_dir)
        .spawn()?;

    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(&exports_dir)
        .spawn()?;

    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(&exports_dir)
        .spawn()?;

    Ok(())
}

/// Main export command.
#[tauri::command]
pub fn export_book(
    app: tauri::AppHandle,
    project_dir: PathBuf,
    book_id: String,
    format: ExportFormat,
    options: ExportOptions,
    output_path: PathBuf,
) -> Result<String, AppError> {
    let book_dir = project_dir.join("books").join(&book_id);
    if !book_dir.exists() {
        return Err(AppError::BookNotFound(book_id.clone()));
    }

    // ── Assemble content ──────────────────────────────────────────────────────
    let mut parts: Vec<String> = Vec::new();

    // Front matter
    if options.include_front_matter {
        let fm_dir = book_dir.join("front-matter");
        let fm_order = [
            "title-page", "copyright", "dedication", "epigraph",
            "acknowledgments", "foreword", "preface", "prologue",
        ];
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

    // Chapters & scenes
    let book_json_path = book_dir.join("book.json");
    let book_data: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&book_json_path)?)?;

    if let Some(chapters) = book_data.get("chapters").and_then(|v| v.as_array()) {
        let mut sorted_chapters: Vec<_> = chapters.iter().collect();
        sorted_chapters
            .sort_by_key(|ch| ch.get("sort_order").and_then(|v| v.as_u64()).unwrap_or(0));

        for ch in sorted_chapters {
            let ch_id = ch.get("id").and_then(|v| v.as_str()).unwrap_or("");
            let ch_title = ch.get("title").and_then(|v| v.as_str()).unwrap_or("");

            if options.include_chapter_headings && !ch_title.is_empty() {
                parts.push(format!("# {}\n\n", ch_title));
            }

            if let Some(scenes) = ch.get("scenes").and_then(|v| v.as_array()) {
                let mut sorted_scenes: Vec<_> = scenes.iter().collect();
                sorted_scenes
                    .sort_by_key(|sc| sc.get("sort_order").and_then(|v| v.as_u64()).unwrap_or(0));

                for sc in sorted_scenes {
                    let sc_id = sc.get("id").and_then(|v| v.as_str()).unwrap_or("");
                    let draft_path =
                        book_dir.join("chapters").join(ch_id).join(sc_id).join("draft.md");
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

    // Back matter (including appendices)
    if options.include_back_matter {
        let bm_dir = book_dir.join("back-matter");
        let bm_order = ["epilogue", "afterword", "about-the-author"];

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

        // Acknowledgments (back matter version)
        let ack_path = bm_dir.join("acknowledgments.md");
        if ack_path.exists() {
            let content = std::fs::read_to_string(&ack_path)?;
            let (_, body) = parse_frontmatter_simple(&content);
            if !body.trim().is_empty() {
                parts.push("\n\n---\n\n".to_string());
                parts.push(body);
            }
        }

        // Appendices — numbered: appendix-1.md, appendix-2.md, ...
        let mut appendix_num = 1u32;
        loop {
            let path = bm_dir.join(format!("appendix-{}.md", appendix_num));
            if !path.exists() {
                break;
            }
            let content = std::fs::read_to_string(&path)?;
            let (_, body) = parse_frontmatter_simple(&content);
            if !body.trim().is_empty() {
                parts.push("\n\n---\n\n".to_string());
                parts.push(body);
            }
            appendix_num += 1;
        }
    }

    let combined = parts.join("");

    // ── Output path ───────────────────────────────────────────────────────────
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

    // ── Format-specific export ────────────────────────────────────────────────
    match format {
        // ── Markdown: just write the file
        ExportFormat::Markdown => {
            std::fs::write(&final_output, &combined)?;
        }

        // ── LaTeX: write .tex via Pandoc with optional template
        ExportFormat::LaTeX => {
            let mut cmd = sidecar_pandoc(&app)?;
            let temp_md = exports_dir.join(format!("{}-temp.md", book_id));
            std::fs::write(&temp_md, &combined)?;

            cmd.arg(&temp_md)
                .arg("-o")
                .arg(&final_output)
                .arg("-f")
                .arg("markdown")
                .arg("-t")
                .arg("latex");

            if let Some(tpl) = resolve_template(&app, "latex", &options.template, "tex") {
                cmd.arg(format!("--template={}", tpl.display()));
            }

            let output = cmd
                .output()
                .map_err(|e| AppError::ExportError(format!("Failed to run pandoc: {}", e)))?;
            let _ = std::fs::remove_file(&temp_md);
            if !output.status.success() {
                return Err(AppError::ExportError(format!(
                    "Pandoc error: {}",
                    String::from_utf8_lossy(&output.stderr)
                )));
            }
        }

        // ── DOCX: Pandoc with reference-doc template
        ExportFormat::Docx => {
            let mut cmd = sidecar_pandoc(&app)?;
            let temp_md = exports_dir.join(format!("{}-temp.md", book_id));
            std::fs::write(&temp_md, &combined)?;

            cmd.arg(&temp_md)
                .arg("-o")
                .arg(&final_output)
                .arg("-f")
                .arg("markdown")
                .arg("-t")
                .arg("docx");

            if let Some(tpl) = resolve_template(&app, "docx", &options.template, "docx") {
                cmd.arg(format!("--reference-doc={}", tpl.display()));
            }

            let output = cmd
                .output()
                .map_err(|e| AppError::ExportError(format!("Failed to run pandoc: {}", e)))?;
            let _ = std::fs::remove_file(&temp_md);
            if !output.status.success() {
                return Err(AppError::ExportError(format!(
                    "Pandoc error: {}",
                    String::from_utf8_lossy(&output.stderr)
                )));
            }
        }

        // ── ePub: Pandoc with epub-stylesheet and metadata
        ExportFormat::Epub => {
            let mut cmd = sidecar_pandoc(&app)?;
            let temp_md = exports_dir.join(format!("{}-temp.md", book_id));
            std::fs::write(&temp_md, &combined)?;

            // Pull title & author from book.json for ePub metadata
            let epub_title =
                book_data.get("title").and_then(|v| v.as_str()).unwrap_or("Untitled");
            let epub_author = book_data.get("author").and_then(|v| v.as_str()).unwrap_or("");

            cmd.arg(&temp_md)
                .arg("-o")
                .arg(&final_output)
                .arg("-f")
                .arg("markdown")
                .arg("-t")
                .arg("epub")
                .arg(format!("--metadata=title:{}", epub_title))
                .arg(format!("--metadata=author:{}", epub_author));

            if let Some(css) = resolve_template(&app, "epub", &options.template, "css") {
                cmd.arg(format!("--epub-stylesheet={}", css.display()));
            }

            // Cover image if present
            let cover_path = book_dir.join("cover.jpg");
            if cover_path.exists() {
                cmd.arg(format!("--epub-cover-image={}", cover_path.display()));
            }

            let output = cmd
                .output()
                .map_err(|e| AppError::ExportError(format!("Failed to run pandoc: {}", e)))?;
            let _ = std::fs::remove_file(&temp_md);
            if !output.status.success() {
                return Err(AppError::ExportError(format!(
                    "Pandoc error: {}",
                    String::from_utf8_lossy(&output.stderr)
                )));
            }
        }

        // ── PDF: Pandoc → Typst (bundled, no LaTeX needed)
        ExportFormat::Pdf => {
            let temp_md = exports_dir.join(format!("{}-temp.md", book_id));
            let temp_typ = exports_dir.join(format!("{}-temp.typ", book_id));
            std::fs::write(&temp_md, &combined)?;

            // Step 1: Pandoc markdown → Typst source
            let mut pandoc_cmd = sidecar_pandoc(&app)?;
            pandoc_cmd
                .arg(&temp_md)
                .arg("-o")
                .arg(&temp_typ)
                .arg("-f")
                .arg("markdown")
                .arg("-t")
                .arg("typst");

            if let Some(tpl) = resolve_template(&app, "typst", &options.template, "typ") {
                pandoc_cmd.arg(format!("--template={}", tpl.display()));
            }

            // Pass page size as a Pandoc variable for the template
            let paper = if options.page_size == "a4" {
                "a4"
            } else {
                "us-letter"
            };
            pandoc_cmd.arg(format!("--variable=papersize:{}", paper));

            // Pull title & author
            let pdf_title =
                book_data.get("title").and_then(|v| v.as_str()).unwrap_or("Untitled");
            let pdf_author = book_data.get("author").and_then(|v| v.as_str()).unwrap_or("");
            pandoc_cmd
                .arg(format!("--metadata=title:{}", pdf_title))
                .arg(format!("--metadata=author:{}", pdf_author));

            let pandoc_out = pandoc_cmd
                .output()
                .map_err(|e| AppError::ExportError(format!("Failed to run pandoc: {}", e)))?;
            if !pandoc_out.status.success() {
                let _ = std::fs::remove_file(&temp_md);
                return Err(AppError::ExportError(format!(
                    "Pandoc error: {}",
                    String::from_utf8_lossy(&pandoc_out.stderr)
                )));
            }

            // Step 2: Typst compile .typ → .pdf
            let mut typst_cmd = sidecar_typst(&app)?;
            typst_cmd
                .arg("compile")
                .arg(&temp_typ)
                .arg(&final_output);

            let typst_out = typst_cmd
                .output()
                .map_err(|e| AppError::ExportError(format!("Failed to run typst: {}", e)))?;

            let _ = std::fs::remove_file(&temp_md);
            let _ = std::fs::remove_file(&temp_typ);

            if !typst_out.status.success() {
                return Err(AppError::ExportError(format!(
                    "Typst error: {}",
                    String::from_utf8_lossy(&typst_out.stderr)
                )));
            }
        }
    }

    Ok(final_output.to_string_lossy().to_string())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn parse_frontmatter_simple(content: &str) -> ((), String) {
    if content.starts_with("---\n") || content.starts_with("---\r\n") {
        let rest = &content[4..];
        if let Some(end) = rest.find("\n---") {
            let body = rest[end + 4..]
                .trim_start_matches('\n')
                .trim_start_matches('\r');
            return ((), body.to_string());
        }
    }
    ((), content.to_string())
}
