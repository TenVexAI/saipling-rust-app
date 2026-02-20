use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
}

#[tauri::command]
pub fn add_attachment(target_dir: PathBuf, source_path: PathBuf) -> Result<String, AppError> {
    let attachments_dir = target_dir.join("attachments");
    std::fs::create_dir_all(&attachments_dir)?;

    let file_name = source_path.file_name()
        .ok_or_else(|| AppError::InvalidPath("Source path has no filename".into()))?
        .to_string_lossy()
        .to_string();

    let dest = attachments_dir.join(&file_name);
    std::fs::copy(&source_path, &dest)?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub fn list_attachments(target_dir: PathBuf) -> Result<Vec<AttachmentEntry>, AppError> {
    let attachments_dir = target_dir.join("attachments");
    if !attachments_dir.exists() {
        return Ok(Vec::new());
    }

    let mut entries = Vec::new();
    for entry in std::fs::read_dir(&attachments_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() {
            let name = entry.file_name().to_string_lossy().to_string();
            let size = entry.metadata()?.len();
            entries.push(AttachmentEntry {
                name,
                path: path.to_string_lossy().to_string(),
                size,
            });
        }
    }
    entries.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(entries)
}

#[tauri::command]
pub fn remove_attachment(attachment_path: PathBuf) -> Result<(), AppError> {
    if !attachment_path.exists() {
        return Err(AppError::FileNotFound(attachment_path.to_string_lossy().to_string()));
    }
    std::fs::remove_file(&attachment_path)?;
    Ok(())
}
