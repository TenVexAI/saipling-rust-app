use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use chrono::Utc;
use crate::error::AppError;
use super::project::{BookRef, create_book_dirs};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookMetadata {
    pub version: String,
    pub id: String,
    pub title: String,
    pub sort_order: u32,
    pub created: String,
    pub modified: String,
    pub target_word_count: u64,
    pub current_word_count: u64,
    pub phase_progress: serde_json::Value,
    #[serde(default)]
    pub front_matter: serde_json::Value,
    #[serde(default)]
    pub back_matter: serde_json::Value,
    #[serde(default)]
    pub chapters: Vec<serde_json::Value>,
}

#[tauri::command]
pub fn create_book(project_dir: PathBuf, title: String) -> Result<BookMetadata, AppError> {
    // Read project.json to determine next book number
    let project_json_path = project_dir.join("project.json");
    let project_data: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&project_json_path)?)?;

    let existing_books = project_data.get("books")
        .and_then(|v| v.as_array())
        .map(|a| a.len())
        .unwrap_or(0);

    let book_num = existing_books + 1;
    let book_id = format!("book-{:02}", book_num);
    let book_dir = project_dir.join("books").join(&book_id);

    create_book_dirs(&book_dir, &title, book_num as u32)?;

    // Update project.json with new book ref
    let mut project_data: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&project_json_path)?)?;

    let book_ref = serde_json::to_value(BookRef {
        id: book_id.clone(),
        title: title.clone(),
        sort_order: book_num as u32,
    })?;

    if let Some(books) = project_data.get_mut("books").and_then(|v| v.as_array_mut()) {
        books.push(book_ref);
    }
    project_data["modified"] = serde_json::Value::String(Utc::now().to_rfc3339());

    std::fs::write(&project_json_path, serde_json::to_string_pretty(&project_data)?)?;

    // Read and return the book metadata
    let book_json = std::fs::read_to_string(book_dir.join("book.json"))?;
    let meta: BookMetadata = serde_json::from_str(&book_json)?;
    Ok(meta)
}

#[tauri::command]
pub fn get_book_metadata(project_dir: PathBuf, book_id: String) -> Result<BookMetadata, AppError> {
    let book_json_path = project_dir.join("books").join(&book_id).join("book.json");
    if !book_json_path.exists() {
        return Err(AppError::BookNotFound(book_id));
    }
    let data = std::fs::read_to_string(&book_json_path)?;
    let meta: BookMetadata = serde_json::from_str(&data)?;
    Ok(meta)
}

#[tauri::command]
pub fn update_book_metadata(
    project_dir: PathBuf,
    book_id: String,
    metadata: BookMetadata,
) -> Result<(), AppError> {
    let book_json_path = project_dir.join("books").join(&book_id).join("book.json");
    std::fs::write(&book_json_path, serde_json::to_string_pretty(&metadata)?)?;
    Ok(())
}

#[tauri::command]
pub fn reorder_books(project_dir: PathBuf, book_ids: Vec<String>) -> Result<(), AppError> {
    let project_json_path = project_dir.join("project.json");
    let mut project_data: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&project_json_path)?)?;

    if let Some(books) = project_data.get_mut("books").and_then(|v| v.as_array_mut()) {
        let mut reordered = Vec::new();
        for (i, id) in book_ids.iter().enumerate() {
            if let Some(book) = books.iter().find(|b| {
                b.get("id").and_then(|v| v.as_str()) == Some(id)
            }) {
                let mut book = book.clone();
                book["sort_order"] = serde_json::Value::Number((i as u32 + 1).into());
                reordered.push(book);
            }
        }
        *books = reordered;
    }

    std::fs::write(&project_json_path, serde_json::to_string_pretty(&project_data)?)?;
    Ok(())
}
