use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use chrono::{DateTime, Utc};
use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookRef {
    pub id: String,
    pub title: String,
    pub sort_order: u32,
    #[serde(default)]
    pub genre: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMetadata {
    pub version: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub created: DateTime<Utc>,
    pub modified: DateTime<Utc>,
    #[serde(default)]
    pub books: Vec<BookRef>,
    #[serde(default = "default_world_sections")]
    pub world_sections: Vec<String>,
    #[serde(skip)]
    pub directory: PathBuf,
}

fn default_world_sections() -> Vec<String> {
    vec!["locations".to_string(), "items".to_string()]
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
    Ok(docs.join("SAiPLING").join(".saipling").join("recent-projects.json"))
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
    description: Option<String>,
    directory: PathBuf,
) -> Result<ProjectMetadata, AppError> {
    std::fs::create_dir_all(&directory)?;

    // Create directory structure per filesystem spec v2
    let dirs = [
        "overview",
        "characters",
        "world",
        "world/locations",
        "world/items",
        "books",
        "notes",
        "timeline",
        "exports",
    ];
    for d in &dirs {
        std::fs::create_dir_all(directory.join(d))?;
    }

    let now = Utc::now();
    let date_str = now.format("%Y-%m-%d").to_string();
    let desc = description.clone().unwrap_or_default();
    let metadata = ProjectMetadata {
        version: "1.0.0".to_string(),
        name: name.clone(),
        description: desc.clone(),
        created: now,
        modified: now,
        books: Vec::new(),
        world_sections: default_world_sections(),
        directory: directory.clone(),
    };

    let project_json = directory.join("project.json");
    std::fs::write(&project_json, serde_json::to_string_pretty(&metadata)?)?;

    // Create overview/brainstorm.md with frontmatter template
    let brainstorm_content = format!(
        "---\ntype: brainstorm\nscope: series\nsubject: project\ncreated: {}\nmodified: {}\nstatus: empty\n---\n\n\
# Project Brainstorm\n\n\
This is your space to brain-dump everything about your project — the big ideas,\n\
the vague feelings, the \"what if\" questions, the scenes you can already see in\n\
your head. Don't worry about structure or consistency here. Just get your ideas\n\
down.\n\n\
Think about:\n\
- What's the core idea that excites you?\n\
- What kind of story is this? (series, standalone, universe?)\n\
- What genre(s) does it live in?\n\
- What tone or feeling are you going for?\n\
- Any characters, settings, or scenes that are already forming?\n\
- What themes or questions do you want to explore?\n\
- What books, movies, or stories inspire this project?\n\n\
Write freely below — this document is your starting point, not your final answer.\n\n\
---\n\n",
        date_str, date_str
    );
    std::fs::write(
        directory.join("overview/brainstorm.md"),
        brainstorm_content,
    )?;

    // Create empty timeline config
    std::fs::write(
        directory.join("timeline/timelines.json"),
        "{\n  \"timelines\": []\n}\n",
    )?;

    // Create helper JSON files
    std::fs::write(directory.join(".ai_chat.json"), "[]")?;
    std::fs::write(directory.join(".ai_cost.json"), "{\"total\": 0}")?;
    std::fs::write(directory.join(".context_settings.json"), "{}")?;

    update_recent(&name, &directory)?;
    Ok(metadata)
}

pub fn create_book_dirs(
    book_dir: &PathBuf,
    title: &str,
    author: &str,
    genre: &str,
    sort_order: u32,
) -> Result<(), AppError> {
    let subdirs = [
        "overview",
        "phase-1-seed",
        "phase-2-root",
        "phase-3-sprout",
        "phase-4-flourish",
        "phase-4-flourish/act-1",
        "phase-4-flourish/act-2",
        "phase-4-flourish/act-3",
        "phase-5-bloom",
        "front-matter",
        "back-matter",
        "notes",
    ];
    for d in &subdirs {
        std::fs::create_dir_all(book_dir.join(d))?;
    }

    let now = Utc::now();
    let date_str = now.format("%Y-%m-%d").to_string();
    let book_id = book_dir.file_name().unwrap().to_string_lossy().to_string();

    let book_meta = serde_json::json!({
        "version": "1.0.0",
        "id": book_id,
        "title": title,
        "author": author,
        "genre": genre,
        "sort_order": sort_order,
        "created": now,
        "modified": now,
        "target_word_count": 80000,
        "current_word_count": 0,
        "phase_progress": {
            "seed": {
                "status": "not_started",
                "elements": {
                    "premise": false,
                    "theme": false,
                    "protagonist": false,
                    "central_conflict": false,
                    "story_world": false,
                    "emotional_promise": false
                },
                "deliverables": {
                    "logline": false,
                    "story_foundation": false
                }
            },
            "root": {
                "status": "not_started",
                "beats_drafted": 0,
                "beats_total": 21,
                "deliverables": {
                    "story_structure_outline": false
                }
            },
            "sprout": {
                "status": "not_started",
                "characters": {},
                "deliverables": {
                    "relationship_dynamics": false
                }
            },
            "flourish": {
                "status": "not_started",
                "scenes_outlined": 0
            },
            "bloom": {
                "status": "not_started",
                "scenes_drafted": 0,
                "scenes_total": 0
            }
        },
        "chapters": [],
        "front_matter": {},
        "back_matter": {},
        "settings": {
            "pov": "",
            "tense": ""
        }
    });
    std::fs::write(
        book_dir.join("book.json"),
        serde_json::to_string_pretty(&book_meta)?,
    )?;

    // Create book overview brainstorm.md
    let scope = book_id;
    let brainstorm_content = format!(
        "---\ntype: brainstorm\nscope: {}\nsubject: book\ncreated: {}\nmodified: {}\nstatus: empty\n---\n\n\
# Book Brainstorm\n\n\
This is your space to brain-dump everything about this specific book. If you've\n\
already created a project overview, think about what makes THIS book unique within\n\
the larger project.\n\n\
Think about:\n\
- What's the core story of this book?\n\
- Who is the main character and what do they want?\n\
- What's the central conflict or problem?\n\
- Where and when does this book take place?\n\
- How does this book fit into the larger series (if applicable)?\n\
- What should the reader feel by the end?\n\
- Any specific scenes, moments, or images you already have in mind?\n\n\
Write freely below.\n\n\
---\n\n",
        scope, date_str, date_str
    );
    std::fs::write(
        book_dir.join("overview/brainstorm.md"),
        brainstorm_content,
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
pub fn delete_project(directory: PathBuf) -> Result<(), AppError> {
    // Remove from recent projects
    let rp_path = recent_projects_path()?;
    if rp_path.exists() {
        let data = std::fs::read_to_string(&rp_path)?;
        let mut recents: Vec<RecentProject> = serde_json::from_str(&data)?;
        let path_str = directory.to_string_lossy().to_string();
        recents.retain(|r| r.path != path_str);
        std::fs::write(&rp_path, serde_json::to_string_pretty(&recents)?)?;
    }

    // Delete the project directory
    if directory.exists() {
        std::fs::remove_dir_all(&directory)?;
    }

    Ok(())
}

#[tauri::command]
pub fn start_file_watcher(
    app: tauri::AppHandle,
    project_dir: PathBuf,
) -> Result<(), AppError> {
    crate::watcher::start_watcher(app, project_dir)
}
