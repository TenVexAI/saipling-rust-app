use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileContent {
    pub frontmatter: serde_json::Value,
    pub body: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub file_type: Option<String>,
    pub size: Option<u64>,
}

fn parse_frontmatter(content: &str) -> (serde_json::Value, String) {
    if content.starts_with("---\n") || content.starts_with("---\r\n") {
        let rest = &content[4..];
        if let Some(end) = rest.find("\n---") {
            let yaml_str = &rest[..end];
            let body = rest[end + 4..].trim_start_matches('\n').trim_start_matches('\r');
            if let Ok(yaml_val) = serde_yaml::from_str::<serde_yaml::Value>(yaml_str) {
                let json_val = serde_json::to_value(&yaml_val).unwrap_or(serde_json::Value::Null);
                return (json_val, body.to_string());
            }
        }
    }
    (serde_json::Value::Null, content.to_string())
}

fn serialize_frontmatter(frontmatter: &serde_json::Value, body: &str) -> String {
    if frontmatter.is_null() || (frontmatter.is_object() && frontmatter.as_object().unwrap().is_empty()) {
        return body.to_string();
    }
    let yaml_val: serde_yaml::Value = serde_json::from_value(frontmatter.clone()).unwrap_or(serde_yaml::Value::Null);
    let yaml_str = serde_yaml::to_string(&yaml_val).unwrap_or_default();
    format!("---\n{}---\n\n{}", yaml_str, body)
}

fn infer_file_type(path: &PathBuf) -> Option<String> {
    let name = path.file_name()?.to_string_lossy();
    let name_lower = name.to_lowercase();

    if name_lower == "project.json" || name_lower == "book.json" {
        return Some("metadata".to_string());
    }

    // Read frontmatter type if it's a .md file
    if path.extension().map(|e| e == "md").unwrap_or(false) {
        if let Ok(content) = std::fs::read_to_string(path) {
            let (fm, _) = parse_frontmatter(&content);
            if let Some(t) = fm.get("type").and_then(|v| v.as_str()) {
                return Some(t.to_string());
            }
        }
        // Infer from path/name
        if name_lower.contains("foundation") { return Some("story-foundation".to_string()); }
        if name_lower.contains("beat") || name_lower.contains("outline") { return Some("beat-outline".to_string()); }
        if name_lower.contains("journey") { return Some("character-journey".to_string()); }
        if name_lower == "_relationships.md" { return Some("relationships".to_string()); }
        if name_lower.contains("world-bible") { return Some("world-bible".to_string()); }
        if name_lower == "draft.md" { return Some("scene-draft".to_string()); }
    }
    None
}

#[tauri::command]
pub fn read_file(path: PathBuf) -> Result<FileContent, AppError> {
    if !path.exists() {
        return Err(AppError::FileNotFound(path.to_string_lossy().to_string()));
    }
    let content = std::fs::read_to_string(&path)?;
    let (frontmatter, body) = parse_frontmatter(&content);
    Ok(FileContent {
        frontmatter,
        body,
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn write_file(path: PathBuf, frontmatter: serde_json::Value, body: String) -> Result<(), AppError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let content = serialize_frontmatter(&frontmatter, &body);
    std::fs::write(&path, content)?;
    Ok(())
}

#[tauri::command]
pub fn create_from_template(
    path: PathBuf,
    template: String,
    variables: std::collections::HashMap<String, String>,
) -> Result<(), AppError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut content = template;
    for (key, value) in &variables {
        content = content.replace(&format!("{{{{{}}}}}", key), value);
    }
    std::fs::write(&path, content)?;
    Ok(())
}

#[tauri::command]
pub fn list_directory(path: PathBuf) -> Result<Vec<FileEntry>, AppError> {
    if !path.exists() {
        return Err(AppError::FileNotFound(path.to_string_lossy().to_string()));
    }
    let mut entries = Vec::new();
    for entry in std::fs::read_dir(&path)? {
        let entry = entry?;
        let entry_path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/dirs (starting with .)
        if name.starts_with('.') {
            continue;
        }

        let is_dir = entry_path.is_dir();
        let file_type = if !is_dir { infer_file_type(&entry_path) } else { None };
        let size = if !is_dir {
            entry.metadata().ok().map(|m| m.len())
        } else {
            None
        };

        entries.push(FileEntry {
            name,
            path: entry_path.to_string_lossy().to_string(),
            is_dir,
            file_type,
            size,
        });
    }
    entries.sort_by(|a, b| {
        // Dirs first, then alphabetical
        b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name))
    });
    Ok(entries)
}

#[tauri::command]
pub fn create_directory(path: PathBuf) -> Result<(), AppError> {
    std::fs::create_dir_all(&path)?;
    Ok(())
}

#[tauri::command]
pub fn rename_entry(from: PathBuf, to: PathBuf) -> Result<(), AppError> {
    if !from.exists() {
        return Err(AppError::FileNotFound(from.to_string_lossy().to_string()));
    }
    std::fs::rename(&from, &to)?;
    Ok(())
}

#[tauri::command]
pub fn delete_entry(path: PathBuf) -> Result<(), AppError> {
    if !path.exists() {
        return Err(AppError::FileNotFound(path.to_string_lossy().to_string()));
    }
    // Move to recycle bin would require a platform-specific crate
    // For now, do a regular delete with a warning
    if path.is_dir() {
        std::fs::remove_dir_all(&path)?;
    } else {
        std::fs::remove_file(&path)?;
    }
    Ok(())
}

#[tauri::command]
pub fn move_entry(from: PathBuf, to: PathBuf) -> Result<(), AppError> {
    if !from.exists() {
        return Err(AppError::FileNotFound(from.to_string_lossy().to_string()));
    }
    if let Some(parent) = to.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::rename(&from, &to)?;
    Ok(())
}

#[tauri::command]
pub fn get_word_count(path: PathBuf) -> Result<u64, AppError> {
    if !path.exists() {
        return Err(AppError::FileNotFound(path.to_string_lossy().to_string()));
    }
    let content = std::fs::read_to_string(&path)?;
    let (_, body) = parse_frontmatter(&content);
    let count = body.split_whitespace().count() as u64;
    Ok(count)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WordCountSummary {
    pub book_total: u64,
    pub target: u64,
    pub chapters: Vec<ChapterWordCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChapterWordCount {
    pub chapter_id: String,
    pub chapter_title: String,
    pub word_count: u64,
    pub scenes: Vec<SceneWordCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneWordCount {
    pub scene_id: String,
    pub word_count: u64,
}

#[tauri::command]
pub fn get_book_word_count(project_dir: PathBuf, book_id: String) -> Result<WordCountSummary, AppError> {
    let book_dir = project_dir.join("books").join(&book_id);
    let book_json_path = book_dir.join("book.json");
    if !book_json_path.exists() {
        return Err(AppError::BookNotFound(book_id));
    }

    let book_data: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&book_json_path)?)?;
    let target = book_data.get("target_word_count")
        .and_then(|v| v.as_u64())
        .unwrap_or(80000);

    let chapters_dir = book_dir.join("chapters");
    let mut chapters = Vec::new();
    let mut book_total: u64 = 0;

    if chapters_dir.exists() {
        let mut ch_entries: Vec<_> = std::fs::read_dir(&chapters_dir)?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_dir())
            .collect();
        ch_entries.sort_by_key(|e| e.file_name());

        for ch_entry in ch_entries {
            let ch_path = ch_entry.path();
            let ch_id = ch_entry.file_name().to_string_lossy().to_string();
            let ch_title = ch_id.clone(); // Could read from _chapter.md
            let mut ch_wc: u64 = 0;
            let mut scenes = Vec::new();

            let mut sc_entries: Vec<_> = std::fs::read_dir(&ch_path)?
                .filter_map(|e| e.ok())
                .filter(|e| e.path().is_dir() && e.file_name().to_string_lossy().starts_with("scene-"))
                .collect();
            sc_entries.sort_by_key(|e| e.file_name());

            for sc_entry in sc_entries {
                let sc_id = sc_entry.file_name().to_string_lossy().to_string();
                let draft_path = sc_entry.path().join("draft.md");
                let wc = if draft_path.exists() {
                    let content = std::fs::read_to_string(&draft_path)?;
                    let (_, body) = parse_frontmatter(&content);
                    body.split_whitespace().count() as u64
                } else {
                    0
                };
                ch_wc += wc;
                scenes.push(SceneWordCount { scene_id: sc_id, word_count: wc });
            }

            book_total += ch_wc;
            chapters.push(ChapterWordCount {
                chapter_id: ch_id,
                chapter_title: ch_title,
                word_count: ch_wc,
                scenes,
            });
        }
    }

    Ok(WordCountSummary { book_total, target, chapters })
}
