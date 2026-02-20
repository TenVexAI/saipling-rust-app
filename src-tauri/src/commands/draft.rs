use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use chrono::Utc;
use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DraftSnapshot {
    pub name: String,
    pub path: String,
    pub created: String,
    pub word_count: u64,
}

#[tauri::command]
pub fn save_draft(path: PathBuf, content: String) -> Result<(), AppError> {
    let scene_dir = path.parent()
        .ok_or_else(|| AppError::InvalidPath("Cannot determine scene directory".into()))?;
    let drafts_dir = scene_dir.join(".drafts");
    std::fs::create_dir_all(&drafts_dir)?;

    // Snapshot current version before overwriting
    if path.exists() {
        let current = std::fs::read_to_string(&path)?;
        let now = Utc::now();
        let snapshot_name = now.format("%Y-%m-%dT%H-%M-%S").to_string() + ".md";
        std::fs::write(drafts_dir.join(&snapshot_name), &current)?;
    }

    // Write new content
    std::fs::write(&path, &content)?;
    Ok(())
}

#[tauri::command]
pub fn list_drafts(scene_dir: PathBuf) -> Result<Vec<DraftSnapshot>, AppError> {
    let drafts_dir = scene_dir.join(".drafts");
    if !drafts_dir.exists() {
        return Ok(Vec::new());
    }

    let mut snapshots = Vec::new();
    for entry in std::fs::read_dir(&drafts_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().map(|e| e == "md").unwrap_or(false) {
            let name = entry.file_name().to_string_lossy().to_string();
            let content = std::fs::read_to_string(&path)?;
            let word_count = content.split_whitespace().count() as u64;
            let created = entry.metadata()?.modified()
                .map(|t| {
                    let dt: DateTime<Utc> = t.into();
                    dt.to_rfc3339()
                })
                .unwrap_or_default();
            snapshots.push(DraftSnapshot {
                name,
                path: path.to_string_lossy().to_string(),
                created,
                word_count,
            });
        }
    }
    snapshots.sort_by(|a, b| b.name.cmp(&a.name)); // Most recent first
    Ok(snapshots)
}

#[tauri::command]
pub fn restore_draft(scene_dir: PathBuf, snapshot_name: String) -> Result<String, AppError> {
    let snapshot_path = scene_dir.join(".drafts").join(&snapshot_name);
    if !snapshot_path.exists() {
        return Err(AppError::FileNotFound(snapshot_path.to_string_lossy().to_string()));
    }

    let content = std::fs::read_to_string(&snapshot_path)?;

    // Save current draft as a snapshot before restoring
    let draft_path = scene_dir.join("draft.md");
    if draft_path.exists() {
        save_draft(draft_path.clone(), content.clone())?;
    } else {
        std::fs::write(&draft_path, &content)?;
    }

    Ok(content)
}

use chrono::DateTime;
