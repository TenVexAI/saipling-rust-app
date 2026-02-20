use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use chrono::Utc;
use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatterEntry {
    pub subtype: String,
    pub path: String,
    pub exists: bool,
}

const FRONT_MATTER_TYPES: &[&str] = &[
    "title-page", "copyright", "dedication", "epigraph",
    "acknowledgments", "foreword", "preface", "prologue",
];

const BACK_MATTER_TYPES: &[&str] = &[
    "epilogue", "afterword", "acknowledgments", "about-the-author",
];

fn matter_template(subtype: &str, book_id: &str, is_front: bool) -> String {
    let now = Utc::now().format("%Y-%m-%d");
    let kind = if is_front { "front-matter" } else { "back-matter" };
    let title = subtype.replace('-', " ");
    let title_case: String = title.split_whitespace()
        .map(|w| {
            let mut c = w.chars();
            match c.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ");

    format!(
        "---\ntype: {}\nsubtype: {}\nbook: {}\ncreated: {}\nmodified: {}\n---\n\n# {}\n\n",
        kind, subtype, book_id, now, now, title_case
    )
}

#[tauri::command]
pub fn create_front_matter(
    project_dir: PathBuf,
    book_id: String,
    subtype: String,
) -> Result<String, AppError> {
    let matter_dir = project_dir.join("books").join(&book_id).join("front-matter");
    std::fs::create_dir_all(&matter_dir)?;

    let filename = format!("{}.md", subtype);
    let path = matter_dir.join(&filename);

    if !path.exists() {
        std::fs::write(&path, matter_template(&subtype, &book_id, true))?;
    }

    // Update book.json
    update_matter_in_book_json(&project_dir, &book_id, &subtype, "front_matter", true)?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_back_matter(
    project_dir: PathBuf,
    book_id: String,
    subtype: String,
) -> Result<String, AppError> {
    let matter_dir = project_dir.join("books").join(&book_id).join("back-matter");
    std::fs::create_dir_all(&matter_dir)?;

    let filename = if subtype == "appendices" {
        // Appendices go in a subdirectory
        std::fs::create_dir_all(matter_dir.join("appendices"))?;
        return Ok(matter_dir.join("appendices").to_string_lossy().to_string());
    } else {
        format!("{}.md", subtype)
    };

    let path = matter_dir.join(&filename);
    if !path.exists() {
        std::fs::write(&path, matter_template(&subtype, &book_id, false))?;
    }

    update_matter_in_book_json(&project_dir, &book_id, &subtype, "back_matter", true)?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn remove_front_matter(
    project_dir: PathBuf,
    book_id: String,
    subtype: String,
) -> Result<(), AppError> {
    let path = project_dir.join("books").join(&book_id).join("front-matter").join(format!("{}.md", subtype));
    if path.exists() {
        std::fs::remove_file(&path)?;
    }
    update_matter_in_book_json(&project_dir, &book_id, &subtype, "front_matter", false)?;
    Ok(())
}

#[tauri::command]
pub fn remove_back_matter(
    project_dir: PathBuf,
    book_id: String,
    subtype: String,
) -> Result<(), AppError> {
    let path = project_dir.join("books").join(&book_id).join("back-matter").join(format!("{}.md", subtype));
    if path.exists() {
        std::fs::remove_file(&path)?;
    }
    update_matter_in_book_json(&project_dir, &book_id, &subtype, "back_matter", false)?;
    Ok(())
}

#[tauri::command]
pub fn list_front_matter(
    project_dir: PathBuf,
    book_id: String,
) -> Result<Vec<MatterEntry>, AppError> {
    let matter_dir = project_dir.join("books").join(&book_id).join("front-matter");
    Ok(FRONT_MATTER_TYPES.iter().map(|&subtype| {
        let path = matter_dir.join(format!("{}.md", subtype));
        MatterEntry {
            subtype: subtype.to_string(),
            path: path.to_string_lossy().to_string(),
            exists: path.exists(),
        }
    }).collect())
}

#[tauri::command]
pub fn list_back_matter(
    project_dir: PathBuf,
    book_id: String,
) -> Result<Vec<MatterEntry>, AppError> {
    let matter_dir = project_dir.join("books").join(&book_id).join("back-matter");
    Ok(BACK_MATTER_TYPES.iter().map(|&subtype| {
        let path = matter_dir.join(format!("{}.md", subtype));
        MatterEntry {
            subtype: subtype.to_string(),
            path: path.to_string_lossy().to_string(),
            exists: path.exists(),
        }
    }).collect())
}

fn update_matter_in_book_json(
    project_dir: &PathBuf,
    book_id: &str,
    subtype: &str,
    field: &str, // "front_matter" or "back_matter"
    value: bool,
) -> Result<(), AppError> {
    let book_json_path = project_dir.join("books").join(book_id).join("book.json");
    if !book_json_path.exists() {
        return Ok(());
    }
    let mut book_data: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&book_json_path)?)?;

    let key = subtype.replace('-', "_");
    if let Some(matter) = book_data.get_mut(field) {
        matter[&key] = serde_json::Value::Bool(value);
    } else {
        book_data[field] = serde_json::json!({ key: value });
    }

    std::fs::write(&book_json_path, serde_json::to_string_pretty(&book_data)?)?;
    Ok(())
}
