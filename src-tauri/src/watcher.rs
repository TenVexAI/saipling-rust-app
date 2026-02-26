// File System Watcher — monitors project directory for external changes
// Emits events to the frontend via Tauri events

use std::path::PathBuf;
use std::time::{Duration, Instant};
use tauri::Emitter;
use crate::context::vector::indexer::{PENDING_FILES, DELETED_FILES};

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

            // Queue indexable files for vector search
            let is_md = path.ends_with(".md");
            let is_hidden = path.contains("/.saipling/") || path.contains("\\.saipling\\");

            match event.kind {
                EventKind::Modify(_) => {
                    let _ = app_handle.emit("fs:file_changed", serde_json::json!({
                        "path": path,
                        "change_type": "modified"
                    }));
                    if is_md && !is_hidden {
                        if let Ok(mut pending) = PENDING_FILES.lock() {
                            pending.insert(path.clone(), Instant::now());
                        }
                    }
                }
                EventKind::Create(_) => {
                    let _ = app_handle.emit("fs:file_created", serde_json::json!({
                        "path": path
                    }));
                    if is_md && !is_hidden {
                        if let Ok(mut pending) = PENDING_FILES.lock() {
                            pending.insert(path.clone(), Instant::now());
                        }
                    }
                }
                EventKind::Remove(_) => {
                    let _ = app_handle.emit("fs:file_deleted", serde_json::json!({
                        "path": path
                    }));
                    if is_md && !is_hidden {
                        // Remove from pending (if queued) and add to deleted
                        if let Ok(mut pending) = PENDING_FILES.lock() {
                            pending.remove(path);
                        }
                        if let Ok(mut deleted) = DELETED_FILES.lock() {
                            deleted.push(path.clone());
                        }
                    }
                }
                _ => {}
            }
        }
    }).map_err(|e| crate::error::AppError::General(format!("Watcher error: {}", e)))?;

    watcher.watch(&project_dir, RecursiveMode::Recursive)
        .map_err(|e| crate::error::AppError::General(format!("Watch error: {}", e)))?;

    // Keep watcher alive by leaking it (it lives for the app's lifetime)
    std::mem::forget(watcher);

    // Start the background indexer task for vector search (only if enabled)
    let vs_enabled = crate::commands::config::get_config()
        .map(|c| c.vector_search.enabled)
        .unwrap_or(false);
    if vs_enabled {
        if let Ok(handle) = tokio::runtime::Handle::try_current() {
            let app_clone = app;
            let dir_clone = project_dir;
            handle.spawn(background_indexer_loop(app_clone, dir_clone));
        }
    }

    Ok(())
}

/// Spawns a background tokio task that processes the pending/deleted file queues
/// for vector search indexing. Runs every TICK_INTERVAL seconds.
/// Files are only embedded after being quiet (unmodified) for QUIET_PERIOD.
async fn background_indexer_loop(app: tauri::AppHandle, project_dir: PathBuf) {
    const TICK_INTERVAL: Duration = Duration::from_secs(10);
    const QUIET_PERIOD: Duration = Duration::from_secs(120); // 2 minutes

    loop {
        tokio::time::sleep(TICK_INTERVAL).await;

        // Check if vector search is enabled
        let config = match crate::commands::config::get_config() {
            Ok(c) => c,
            Err(_) => continue,
        };
        if !config.vector_search.enabled || config.vector_search.embedding_api_key_encrypted.is_empty() {
            continue;
        }

        // Process deleted files immediately
        let deleted: Vec<String> = {
            match DELETED_FILES.lock() {
                Ok(mut d) => d.drain(..).collect(),
                Err(_) => Vec::new(),
            }
        };
        for abs_path in &deleted {
            let rel_path = match abs_to_rel(abs_path, &project_dir) {
                Some(r) => r,
                None => continue,
            };
            let _ = crate::context::vector::indexer::deindex_file(&project_dir, &rel_path);
        }

        // Check pending files — only process those past the quiet period
        let now = Instant::now();
        let ready: Vec<String> = {
            match PENDING_FILES.lock() {
                Ok(mut pending) => {
                    let mut ready_paths = Vec::new();
                    let mut to_remove = Vec::new();
                    for (path, last_modified) in pending.iter() {
                        if now.duration_since(*last_modified) >= QUIET_PERIOD {
                            ready_paths.push(path.clone());
                            to_remove.push(path.clone());
                        }
                    }
                    for path in &to_remove {
                        pending.remove(path);
                    }
                    ready_paths
                }
                Err(_) => Vec::new(),
            }
        };

        if ready.is_empty() {
            continue;
        }

        // Decode the Voyage API key
        let api_key = match decode_voyage_key(&config.vector_search.embedding_api_key_encrypted) {
            Ok(k) => k,
            Err(_) => continue,
        };
        let client = crate::context::vector::embeddings::VoyageClient::new(
            api_key,
            config.vector_search.embedding_model.clone(),
        );

        for abs_path in &ready {
            let rel_path = match abs_to_rel(abs_path, &project_dir) {
                Some(r) => r,
                None => continue,
            };
            match crate::context::vector::indexer::index_file(&project_dir, &rel_path, &client).await {
                Ok(_) => {
                    let _ = app.emit("vector:file_indexed", serde_json::json!({
                        "file": rel_path,
                    }));
                }
                Err(e) => {
                    eprintln!("Background indexer: failed to index {}: {}", rel_path, e);
                }
            }
        }
    }
}

/// Convert an absolute path to a project-relative forward-slash path.
fn abs_to_rel(abs_path: &str, project_dir: &PathBuf) -> Option<String> {
    let abs = PathBuf::from(abs_path);
    abs.strip_prefix(project_dir)
        .ok()
        .map(|rel| rel.to_string_lossy().replace('\\', "/"))
}

/// Decode the base64-encoded Voyage API key.
fn decode_voyage_key(encoded: &str) -> Result<String, ()> {
    let input = encoded.trim().as_bytes();
    if input.is_empty() || input.len() % 4 != 0 {
        return Err(());
    }
    let mut output = Vec::with_capacity(input.len() * 3 / 4);
    for chunk in input.chunks(4) {
        let vals: Vec<u8> = chunk.iter().map(|&c| match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => 0,
        }).collect();
        output.push((vals[0] << 2) | (vals[1] >> 4));
        if chunk[2] != b'=' {
            output.push((vals[1] << 4) | (vals[2] >> 2));
        }
        if chunk[3] != b'=' {
            output.push((vals[2] << 6) | vals[3]);
        }
    }
    String::from_utf8(output).map_err(|_| ())
}
