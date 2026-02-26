use std::path::PathBuf;
use std::collections::{HashMap, HashSet};
use crate::error::AppError;
use crate::context::vector::{self, SearchResult, IndexStatus};
use crate::context::vector::db;
use crate::context::vector::embeddings::VoyageClient;
use crate::context::vector::indexer;
use crate::context::assembler::load_context_settings;

/// Search the project index. Used by chat /search and Context Settings.
/// Respects .context_settings.json exclusions by default.
#[tauri::command]
pub async fn vector_search(
    project_dir: PathBuf,
    query: String,
    max_results: Option<u32>,
    filter_entity_types: Option<Vec<String>>,
    filter_book_id: Option<String>,
    respect_context_settings: Option<bool>,
) -> Result<Vec<SearchResult>, AppError> {
    let config = crate::commands::config::get_config()?;
    if !config.vector_search.enabled {
        return Err(AppError::VectorSearch("Vector search is not enabled".into()));
    }

    let api_key = get_voyage_api_key(&config)?;
    let client = VoyageClient::new(api_key, config.vector_search.embedding_model.clone());

    let max = max_results.unwrap_or(config.vector_search.max_results_default);
    let entity_filters = filter_entity_types.unwrap_or_default();
    let respect = respect_context_settings.unwrap_or(true);

    let excluded: HashMap<String, String> = if respect {
        load_context_settings(&project_dir)
    } else {
        HashMap::new()
    };

    let already_loaded: HashSet<String> = HashSet::new();

    vector::search::search(
        &project_dir,
        &query,
        &client,
        max,
        &entity_filters,
        filter_book_id.as_deref(),
        &excluded,
        &already_loaded,
    )
    .await
}

/// Get the current index status for the Settings UI.
#[tauri::command]
pub async fn get_index_status(
    project_dir: PathBuf,
) -> Result<IndexStatus, AppError> {
    let conn = db::open_index(&project_dir)?;
    db::init_schema(&conn)?;

    let (total_files, total_chunks, last_indexed, total_cost) = db::get_index_stats(&conn)?;

    let is_indexing = indexer::IS_INDEXING
        .lock()
        .map(|g| *g)
        .unwrap_or(false);

    Ok(IndexStatus {
        total_files,
        total_chunks,
        last_indexed,
        total_cost_usd: total_cost,
        is_indexing,
        index_progress: None,
    })
}

/// Trigger a full re-index of the project.
#[tauri::command]
pub async fn reindex_project(
    app: tauri::AppHandle,
    project_dir: PathBuf,
) -> Result<(), AppError> {
    use tauri::Emitter;

    let config = crate::commands::config::get_config()?;
    if !config.vector_search.enabled {
        return Err(AppError::VectorSearch("Vector search is not enabled".into()));
    }

    let api_key = get_voyage_api_key(&config)?;
    let client = VoyageClient::new(api_key, config.vector_search.embedding_model.clone());

    // Set indexing flag
    if let Ok(mut flag) = indexer::IS_INDEXING.lock() {
        *flag = true;
    }

    let files = indexer::collect_indexable_files(&project_dir);
    let total = files.len() as u32;
    let mut total_chunks: u32 = 0;
    let mut total_embedded: u32 = 0;
    let mut total_tokens: u64 = 0;

    for (i, rel_path) in files.iter().enumerate() {
        // Emit progress event
        let _ = app.emit("vector:indexing_progress", serde_json::json!({
            "files_processed": i as u32,
            "files_total": total,
            "current_file": rel_path,
        }));

        match indexer::index_file(&project_dir, rel_path, &client).await {
            Ok(result) => {
                total_chunks += result.chunks_total;
                total_embedded += result.chunks_embedded;
                total_tokens += result.tokens_used;
            }
            Err(e) => {
                eprintln!("Warning: failed to index {}: {}", rel_path, e);
            }
        }
    }

    // Clear indexing flag
    if let Ok(mut flag) = indexer::IS_INDEXING.lock() {
        *flag = false;
    }

    let _ = app.emit("vector:indexing_complete", serde_json::json!({
        "total_files": total,
        "total_chunks": total_chunks,
        "total_embedded": total_embedded,
        "total_tokens": total_tokens,
    }));

    Ok(())
}

/// Clear the index completely.
#[tauri::command]
pub async fn clear_index(
    project_dir: PathBuf,
) -> Result<(), AppError> {
    let conn = db::open_index(&project_dir)?;
    db::init_schema(&conn)?;
    db::clear_all(&conn)?;
    Ok(())
}

// ─── Helpers ───

/// Retrieve the Voyage API key from config, decrypting it.
fn get_voyage_api_key(config: &crate::commands::config::AppConfig) -> Result<String, AppError> {
    let encrypted = &config.vector_search.embedding_api_key_encrypted;
    if encrypted.is_empty() {
        return Err(AppError::Embedding(
            "Voyage API key not set. Enter your Voyage AI API key in Settings → Vector Search.".into()
        ));
    }
    // Reuse the same base64 decode from config module
    // For now, a simple decode — the key is stored with the same obfuscation as the main API key
    // Simple base64 decode inline (matches config.rs pattern)
    decode_api_key(encrypted)
}

fn decode_api_key(encoded: &str) -> Result<String, AppError> {
    let input = encoded.trim().as_bytes();
    if input.is_empty() {
        return Err(AppError::Embedding("Empty API key".into()));
    }
    if input.len() % 4 != 0 {
        return Err(AppError::Embedding("Invalid encoded API key".into()));
    }
    let mut output = Vec::with_capacity(input.len() * 3 / 4);
    for chunk in input.chunks(4) {
        let vals: Vec<u8> = chunk.iter().map(|&c| b64_val(c)).collect();
        output.push((vals[0] << 2) | (vals[1] >> 4));
        if chunk[2] != b'=' {
            output.push((vals[1] << 4) | (vals[2] >> 2));
        }
        if chunk[3] != b'=' {
            output.push((vals[2] << 6) | vals[3]);
        }
    }
    String::from_utf8(output)
        .map_err(|e| AppError::Embedding(format!("Invalid UTF-8 in API key: {}", e)))
}

fn b64_val(c: u8) -> u8 {
    match c {
        b'A'..=b'Z' => c - b'A',
        b'a'..=b'z' => c - b'a' + 26,
        b'0'..=b'9' => c - b'0' + 52,
        b'+' => 62,
        b'/' => 63,
        _ => 0,
    }
}
