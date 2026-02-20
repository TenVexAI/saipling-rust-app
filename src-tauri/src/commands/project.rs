use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use chrono::{DateTime, Utc};
use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhaseElementProgress {
    #[serde(flatten)]
    pub elements: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhaseProgress {
    pub status: String, // "not_started", "in_progress", "complete"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<DateTime<Utc>>,
    #[serde(flatten)]
    pub extra: std::collections::HashMap<String, serde_json::Value>,
}

impl Default for PhaseProgress {
    fn default() -> Self {
        Self {
            status: "not_started".to_string(),
            completed_at: None,
            extra: std::collections::HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookRef {
    pub id: String,
    pub title: String,
    pub sort_order: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSettings {
    #[serde(default = "default_model")]
    pub preferred_model: String,
    #[serde(default)]
    pub writing_style_notes: String,
    #[serde(default)]
    pub pov: String,
    #[serde(default)]
    pub tense: String,
}

fn default_model() -> String {
    "claude-sonnet-4-5-20250929".to_string()
}

impl Default for ProjectSettings {
    fn default() -> Self {
        Self {
            preferred_model: default_model(),
            writing_style_notes: String::new(),
            pov: String::new(),
            tense: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMetadata {
    pub version: String,
    pub name: String,
    pub author: String,
    pub genre: String,
    pub created: DateTime<Utc>,
    pub modified: DateTime<Utc>,
    #[serde(default)]
    pub series_phase_progress: std::collections::HashMap<String, PhaseProgress>,
    #[serde(default)]
    pub books: Vec<BookRef>,
    #[serde(default)]
    pub settings: ProjectSettings,
    #[serde(skip)]
    pub directory: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentProject {
    pub name: String,
    pub path: String,
    pub last_opened: DateTime<Utc>,
}

fn recent_projects_path() -> Result<PathBuf, AppError> {
    let docs = dirs::document_dir()
        .ok_or_else(|| AppError::Config("Cannot find Documents directory".into()))?;
    Ok(docs.join("sAIpling").join(".saipling").join("recent-projects.json"))
}

fn update_recent(name: &str, path: &PathBuf) -> Result<(), AppError> {
    let rp_path = recent_projects_path()?;
    let mut recents: Vec<RecentProject> = if rp_path.exists() {
        serde_json::from_str(&std::fs::read_to_string(&rp_path)?)?
    } else {
        Vec::new()
    };

    let path_str = path.to_string_lossy().to_string();
    recents.retain(|r| r.path != path_str);
    recents.insert(0, RecentProject {
        name: name.to_string(),
        path: path_str,
        last_opened: Utc::now(),
    });
    recents.truncate(20);

    if let Some(parent) = rp_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&rp_path, serde_json::to_string_pretty(&recents)?)?;
    Ok(())
}

#[tauri::command]
pub fn create_project(
    name: String,
    is_series: bool,
    genre: Option<String>,
    directory: PathBuf,
) -> Result<ProjectMetadata, AppError> {
    std::fs::create_dir_all(&directory)?;

    // Create directory structure
    let dirs = [
        "series",
        "world",
        "world/locations",
        "world/factions",
        "world/technology",
        "world/history",
        "world/magic-systems",
        "world/rules",
        "characters",
        "books",
        "notes",
        "timeline",
        "exports",
    ];
    for d in &dirs {
        std::fs::create_dir_all(directory.join(d))?;
    }

    let now = Utc::now();
    let metadata = ProjectMetadata {
        version: "1.0.0".to_string(),
        name: name.clone(),
        author: String::new(),
        genre: genre.unwrap_or_default(),
        created: now,
        modified: now,
        series_phase_progress: std::collections::HashMap::new(),
        books: Vec::new(),
        settings: ProjectSettings::default(),
        directory: directory.clone(),
    };

    let project_json = directory.join("project.json");
    std::fs::write(&project_json, serde_json::to_string_pretty(&metadata)?)?;

    // Create empty series foundation
    std::fs::write(
        directory.join("series/foundation.md"),
        format!(
            "---\ntype: series-foundation\nscope: series\ncreated: {}\nmodified: {}\nstatus: not_started\n---\n\n# Series Foundation — {}\n\n",
            now.format("%Y-%m-%d"),
            now.format("%Y-%m-%d"),
            name
        ),
    )?;

    // Create empty relationships file
    std::fs::write(
        directory.join("characters/_relationships.md"),
        format!(
            "---\ntype: relationships\nscope: series\ncreated: {}\nmodified: {}\n---\n\n# Character Relationships\n\n",
            now.format("%Y-%m-%d"),
            now.format("%Y-%m-%d"),
        ),
    )?;

    // If standalone, create book-01 automatically
    if !is_series {
        let book_dir = directory.join("books/book-01");
        create_book_dirs(&book_dir, "Untitled Novel", 1)?;
        // Re-read and update metadata with book ref
        let mut meta = metadata.clone();
        meta.books.push(BookRef {
            id: "book-01".to_string(),
            title: "Untitled Novel".to_string(),
            sort_order: 1,
        });
        std::fs::write(&project_json, serde_json::to_string_pretty(&meta)?)?;
        update_recent(&name, &directory)?;
        return Ok(meta);
    }

    update_recent(&name, &directory)?;
    Ok(metadata)
}

pub fn create_book_dirs(book_dir: &PathBuf, title: &str, sort_order: u32) -> Result<(), AppError> {
    let subdirs = [
        "front-matter",
        "foundation",
        "structure",
        "characters",
        "chapters",
        "back-matter",
        "notes",
    ];
    for d in &subdirs {
        std::fs::create_dir_all(book_dir.join(d))?;
    }

    let now = Utc::now();
    let book_meta = serde_json::json!({
        "version": "1.0.0",
        "id": book_dir.file_name().unwrap().to_string_lossy(),
        "title": title,
        "sort_order": sort_order,
        "created": now,
        "modified": now,
        "target_word_count": 80000,
        "current_word_count": 0,
        "phase_progress": {
            "seed": { "status": "not_started" },
            "root": { "status": "not_started" },
            "sprout": { "status": "not_started" },
            "flourish": { "status": "not_started" },
            "bloom": { "status": "not_started" }
        },
        "front_matter": {},
        "back_matter": {},
        "chapters": []
    });
    std::fs::write(
        book_dir.join("book.json"),
        serde_json::to_string_pretty(&book_meta)?,
    )?;
    Ok(())
}

#[tauri::command]
pub fn open_project(directory: PathBuf) -> Result<ProjectMetadata, AppError> {
    let project_json = directory.join("project.json");
    if !project_json.exists() {
        return Err(AppError::ProjectNotFound(
            directory.to_string_lossy().to_string(),
        ));
    }

    let data = std::fs::read_to_string(&project_json)?;
    let mut metadata: ProjectMetadata = serde_json::from_str(&data)?;
    metadata.directory = directory.clone();

    update_recent(&metadata.name, &directory)?;
    Ok(metadata)
}

#[tauri::command]
pub fn get_recent_projects() -> Result<Vec<RecentProject>, AppError> {
    let path = recent_projects_path()?;
    if path.exists() {
        let data = std::fs::read_to_string(&path)?;
        let recents: Vec<RecentProject> = serde_json::from_str(&data)?;
        Ok(recents)
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub fn get_project_metadata(project_dir: PathBuf) -> Result<ProjectMetadata, AppError> {
    let project_json = project_dir.join("project.json");
    if !project_json.exists() {
        return Err(AppError::ProjectNotFound(
            project_dir.to_string_lossy().to_string(),
        ));
    }
    let data = std::fs::read_to_string(&project_json)?;
    let mut metadata: ProjectMetadata = serde_json::from_str(&data)?;
    metadata.directory = project_dir;
    Ok(metadata)
}

#[tauri::command]
pub fn update_project_metadata(
    project_dir: PathBuf,
    metadata: ProjectMetadata,
) -> Result<(), AppError> {
    let project_json = project_dir.join("project.json");
    std::fs::write(&project_json, serde_json::to_string_pretty(&metadata)?)?;
    Ok(())
}

#[tauri::command]
pub fn start_file_watcher(
    app: tauri::AppHandle,
    project_dir: PathBuf,
) -> Result<(), AppError> {
    crate::watcher::start_watcher(app, project_dir)
}
