// File System Watcher — monitors project directory for external changes
// Emits events to the frontend via Tauri events

use std::path::PathBuf;
use tauri::Emitter;

pub fn start_watcher(app: tauri::AppHandle, project_dir: PathBuf) -> Result<(), crate::error::AppError> {
    use notify::{Watcher, RecursiveMode, Event, EventKind};

    let app_handle = app.clone();

    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        if let Ok(event) = res {
            let paths: Vec<String> = event.paths.iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect();

            if paths.is_empty() {
                return;
            }

            let path = &paths[0];

            match event.kind {
                EventKind::Modify(_) => {
                    let _ = app_handle.emit("fs:file_changed", serde_json::json!({
                        "path": path,
                        "change_type": "modified"
                    }));
                }
                EventKind::Create(_) => {
                    let _ = app_handle.emit("fs:file_created", serde_json::json!({
                        "path": path
                    }));
                }
                EventKind::Remove(_) => {
                    let _ = app_handle.emit("fs:file_deleted", serde_json::json!({
                        "path": path
                    }));
                }
                _ => {}
            }
        }
    }).map_err(|e| crate::error::AppError::General(format!("Watcher error: {}", e)))?;

    watcher.watch(&project_dir, RecursiveMode::Recursive)
        .map_err(|e| crate::error::AppError::General(format!("Watch error: {}", e)))?;

    // Keep watcher alive by leaking it (it lives for the app's lifetime)
    std::mem::forget(watcher);

    Ok(())
}
