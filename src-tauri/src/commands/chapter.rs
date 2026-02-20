use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use chrono::Utc;
use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChapterMetadata {
    pub id: String,
    pub title: String,
    pub sort_order: u32,
    pub scenes: Vec<SceneMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneMetadata {
    pub id: String,
    pub title: String,
    pub sort_order: u32,
    pub scene_type: String, // "action" or "reaction"
    pub status: String,     // "not_started", "outlined", "drafted", "revised"
    pub word_count: u64,
}

#[tauri::command]
pub fn create_chapter(
    project_dir: PathBuf,
    book_id: String,
    title: String,
) -> Result<ChapterMetadata, AppError> {
    let book_dir = project_dir.join("books").join(&book_id);
    let book_json_path = book_dir.join("book.json");
    if !book_json_path.exists() {
        return Err(AppError::BookNotFound(book_id));
    }

    let mut book_data: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&book_json_path)?)?;

    let chapters = book_data.get("chapters")
        .and_then(|v| v.as_array())
        .map(|a| a.len())
        .unwrap_or(0);

    let ch_num = chapters + 1;
    let ch_id = format!("ch-{:02}", ch_num);
    let ch_dir = book_dir.join("chapters").join(&ch_id);
    std::fs::create_dir_all(&ch_dir)?;

    let now = Utc::now();
    // Create _chapter.md
    std::fs::write(
        ch_dir.join("_chapter.md"),
        format!(
            "---\ntype: chapter\nbook: {}\nchapter: {}\ntitle: \"{}\"\nsort_order: {}\ncreated: {}\nmodified: {}\n---\n\n# {}\n\n",
            book_id, ch_id, title, ch_num, now.format("%Y-%m-%d"), now.format("%Y-%m-%d"), title
        ),
    )?;

    let chapter_meta = ChapterMetadata {
        id: ch_id.clone(),
        title: title.clone(),
        sort_order: ch_num as u32,
        scenes: Vec::new(),
    };

    // Update book.json
    let ch_json = serde_json::json!({
        "id": ch_id,
        "title": title,
        "sort_order": ch_num,
        "scenes": []
    });
    if let Some(ch_arr) = book_data.get_mut("chapters").and_then(|v| v.as_array_mut()) {
        ch_arr.push(ch_json);
    }
    book_data["modified"] = serde_json::Value::String(now.to_rfc3339());
    std::fs::write(&book_json_path, serde_json::to_string_pretty(&book_data)?)?;

    Ok(chapter_meta)
}

#[tauri::command]
pub fn create_scene(
    project_dir: PathBuf,
    book_id: String,
    chapter_id: String,
    title: String,
    scene_type: String,
) -> Result<SceneMetadata, AppError> {
    let book_dir = project_dir.join("books").join(&book_id);
    let book_json_path = book_dir.join("book.json");
    if !book_json_path.exists() {
        return Err(AppError::BookNotFound(book_id.clone()));
    }

    let mut book_data: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&book_json_path)?)?;

    // Find the chapter
    let chapters = book_data.get("chapters")
        .and_then(|v| v.as_array())
        .ok_or_else(|| AppError::ChapterNotFound(chapter_id.clone()))?;

    let ch_idx = chapters.iter().position(|ch| {
        ch.get("id").and_then(|v| v.as_str()) == Some(&chapter_id)
    }).ok_or_else(|| AppError::ChapterNotFound(chapter_id.clone()))?;

    let existing_scenes = chapters[ch_idx].get("scenes")
        .and_then(|v| v.as_array())
        .map(|a| a.len())
        .unwrap_or(0);

    let sc_num = existing_scenes + 1;
    let sc_id = format!("scene-{:02}", sc_num);
    let sc_dir = book_dir.join("chapters").join(&chapter_id).join(&sc_id);
    std::fs::create_dir_all(&sc_dir)?;
    std::fs::create_dir_all(sc_dir.join(".drafts"))?;
    std::fs::create_dir_all(sc_dir.join("attachments"))?;

    let now = Utc::now();
    // Create outline.md
    std::fs::write(
        sc_dir.join("outline.md"),
        format!(
            "---\ntype: scene-outline\nbook: {}\nchapter: {}\nscene: {}\ntitle: \"{}\"\nscene_type: {}\npov_character: \"\"\nlocation: \"\"\nbeats: []\ncreated: {}\nmodified: {}\nstatus: not_started\n---\n\n# {} — {}\n\n## Scene Type: {}\n\n### Character Goal\n\n\n### Mounting Conflict\n\n\n### Outcome Crisis\n\n\n## Setting Details\n\n\n## Characters Present\n\n\n## Advances Plot By\n\n\n## Advances Character Arc By\n\n\n## Notes / Attachments\n\n",
            book_id, chapter_id, sc_id, title,
            scene_type.to_uppercase(),
            now.format("%Y-%m-%d"), now.format("%Y-%m-%d"),
            format!("Scene {}.{}", chapter_id.replace("ch-", ""), sc_num),
            title,
            scene_type.to_uppercase()
        ),
    )?;

    // Create empty draft.md
    std::fs::write(
        sc_dir.join("draft.md"),
        format!(
            "---\ntype: scene-draft\nbook: {}\nchapter: {}\nscene: {}\ndraft_number: 1\nword_count: 0\ncreated: {}\nmodified: {}\nstatus: not_started\n---\n\n",
            book_id, chapter_id, sc_id,
            now.format("%Y-%m-%d"), now.format("%Y-%m-%d")
        ),
    )?;

    let scene_meta = SceneMetadata {
        id: sc_id.clone(),
        title: title.clone(),
        sort_order: sc_num as u32,
        scene_type: scene_type.clone(),
        status: "not_started".to_string(),
        word_count: 0,
    };

    // Update book.json
    let sc_json = serde_json::json!({
        "id": sc_id,
        "title": title,
        "sort_order": sc_num,
        "type": scene_type,
        "status": "not_started",
        "word_count": 0
    });
    if let Some(ch_arr) = book_data.get_mut("chapters").and_then(|v| v.as_array_mut()) {
        if let Some(scenes) = ch_arr[ch_idx].get_mut("scenes").and_then(|v| v.as_array_mut()) {
            scenes.push(sc_json);
        }
    }
    book_data["modified"] = serde_json::Value::String(now.to_rfc3339());
    std::fs::write(&book_json_path, serde_json::to_string_pretty(&book_data)?)?;

    Ok(scene_meta)
}

#[tauri::command]
pub fn reorder_chapters(
    project_dir: PathBuf,
    book_id: String,
    chapter_ids: Vec<String>,
) -> Result<(), AppError> {
    let book_json_path = project_dir.join("books").join(&book_id).join("book.json");
    let mut book_data: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&book_json_path)?)?;

    if let Some(chapters) = book_data.get_mut("chapters").and_then(|v| v.as_array_mut()) {
        let mut reordered = Vec::new();
        for (i, id) in chapter_ids.iter().enumerate() {
            if let Some(ch) = chapters.iter().find(|c| {
                c.get("id").and_then(|v| v.as_str()) == Some(id)
            }) {
                let mut ch = ch.clone();
                ch["sort_order"] = serde_json::Value::Number((i as u32 + 1).into());
                reordered.push(ch);
            }
        }
        *chapters = reordered;
    }

    std::fs::write(&book_json_path, serde_json::to_string_pretty(&book_data)?)?;
    Ok(())
}

#[tauri::command]
pub fn reorder_scenes(
    project_dir: PathBuf,
    book_id: String,
    chapter_id: String,
    scene_ids: Vec<String>,
) -> Result<(), AppError> {
    let book_json_path = project_dir.join("books").join(&book_id).join("book.json");
    let mut book_data: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&book_json_path)?)?;

    if let Some(chapters) = book_data.get_mut("chapters").and_then(|v| v.as_array_mut()) {
        if let Some(ch) = chapters.iter_mut().find(|c| {
            c.get("id").and_then(|v| v.as_str()) == Some(&chapter_id)
        }) {
            if let Some(scenes) = ch.get_mut("scenes").and_then(|v| v.as_array_mut()) {
                let mut reordered = Vec::new();
                for (i, id) in scene_ids.iter().enumerate() {
                    if let Some(sc) = scenes.iter().find(|s| {
                        s.get("id").and_then(|v| v.as_str()) == Some(id)
                    }) {
                        let mut sc = sc.clone();
                        sc["sort_order"] = serde_json::Value::Number((i as u32 + 1).into());
                        reordered.push(sc);
                    }
                }
                *scenes = reordered;
            }
        }
    }

    std::fs::write(&book_json_path, serde_json::to_string_pretty(&book_data)?)?;
    Ok(())
}

#[tauri::command]
pub fn move_scene(
    project_dir: PathBuf,
    book_id: String,
    scene_id: String,
    from_chapter: String,
    to_chapter: String,
    position: usize,
) -> Result<(), AppError> {
    let book_dir = project_dir.join("books").join(&book_id);
    let book_json_path = book_dir.join("book.json");
    let mut book_data: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&book_json_path)?)?;

    // Move the physical directory
    let from_dir = book_dir.join("chapters").join(&from_chapter).join(&scene_id);
    let to_dir = book_dir.join("chapters").join(&to_chapter).join(&scene_id);
    if from_dir.exists() {
        if let Some(parent) = to_dir.parent() {
            std::fs::create_dir_all(parent)?;
        }
        // Use copy + delete since rename may fail across drives
        copy_dir_recursive(&from_dir, &to_dir)?;
        std::fs::remove_dir_all(&from_dir)?;
    }

    // Update book.json: remove from source chapter, insert in target
    if let Some(chapters) = book_data.get_mut("chapters").and_then(|v| v.as_array_mut()) {
        let mut scene_data = None;

        // Remove from source
        if let Some(src_ch) = chapters.iter_mut().find(|c| {
            c.get("id").and_then(|v| v.as_str()) == Some(&from_chapter)
        }) {
            if let Some(scenes) = src_ch.get_mut("scenes").and_then(|v| v.as_array_mut()) {
                if let Some(idx) = scenes.iter().position(|s| {
                    s.get("id").and_then(|v| v.as_str()) == Some(&scene_id)
                }) {
                    scene_data = Some(scenes.remove(idx));
                }
            }
        }

        // Insert in target
        if let Some(scene) = scene_data {
            if let Some(dst_ch) = chapters.iter_mut().find(|c| {
                c.get("id").and_then(|v| v.as_str()) == Some(&to_chapter)
            }) {
                if let Some(scenes) = dst_ch.get_mut("scenes").and_then(|v| v.as_array_mut()) {
                    let pos = position.min(scenes.len());
                    scenes.insert(pos, scene);
                    // Re-number sort_order
                    for (i, sc) in scenes.iter_mut().enumerate() {
                        sc["sort_order"] = serde_json::Value::Number((i as u32 + 1).into());
                    }
                }
            }
        }
    }

    std::fs::write(&book_json_path, serde_json::to_string_pretty(&book_data)?)?;
    Ok(())
}

fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<(), AppError> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}
