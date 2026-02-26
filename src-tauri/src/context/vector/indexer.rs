use std::path::PathBuf;
use std::collections::HashMap;
use std::time::Instant;
use once_cell::sync::Lazy;
use std::sync::Mutex;

use crate::error::AppError;
use super::db;
use super::chunker;
use super::embeddings::{self, EmbeddingClient};

const MAX_BATCH_SIZE: usize = 128;

/// Tracks files that have been modified but not yet re-embedded.
/// Key: relative file path, Value: timestamp of most recent modification.
pub static PENDING_FILES: Lazy<Mutex<HashMap<String, Instant>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Files that have been deleted and need their index entries removed.
pub static DELETED_FILES: Lazy<Mutex<Vec<String>>> =
    Lazy::new(|| Mutex::new(Vec::new()));

/// Whether a full re-index is currently in progress.
pub static IS_INDEXING: Lazy<Mutex<bool>> =
    Lazy::new(|| Mutex::new(false));

/// Index a single file: chunk it, embed changed chunks, store in SQLite.
pub async fn index_file(
    project_dir: &PathBuf,
    rel_path: &str,
    client: &dyn EmbeddingClient,
) -> Result<IndexFileResult, AppError> {
    let full_path = project_dir.join(rel_path.replace('/', "\\"));
    if !full_path.exists() {
        return Err(AppError::FileNotFound(format!("File not found: {}", rel_path)));
    }

    let content = std::fs::read_to_string(&full_path)
        .map_err(|e| AppError::IndexError(format!("Failed to read {}: {}", rel_path, e)))?;

    let file_hash = chunker::sha256(&content);

    let conn = db::open_index(project_dir)?;
    db::init_schema(&conn)?;

    // Check if file is unchanged
    if let Some(existing_hash) = db::get_file_hash(&conn, rel_path)? {
        if existing_hash == file_hash {
            return Ok(IndexFileResult {
                chunks_total: 0,
                chunks_embedded: 0,
                tokens_used: 0,
            });
        }
    }

    // Chunk the file
    let chunks = chunker::chunk_file(&content, rel_path);
    if chunks.is_empty() {
        return Ok(IndexFileResult {
            chunks_total: 0,
            chunks_embedded: 0,
            tokens_used: 0,
        });
    }

    // Get existing chunk hashes to skip unchanged chunks
    let existing_hashes = db::get_chunk_hashes(&conn, rel_path)?;

    // Determine which chunks need new embeddings
    let mut chunks_to_embed: Vec<(usize, &chunker::Chunk)> = Vec::new();
    for (i, chunk) in chunks.iter().enumerate() {
        let needs_embed = match existing_hashes.get(&chunk.chunk_index) {
            Some(old_hash) => old_hash != &chunk.content_hash,
            None => true,
        };
        if needs_embed {
            chunks_to_embed.push((i, chunk));
        }
    }

    // Delete old chunks and re-insert all (simpler than partial updates)
    db::delete_chunks_for_file(&conn, rel_path)?;

    // Batch embed changed chunks
    let mut all_embeddings: HashMap<usize, Vec<f32>> = HashMap::new();

    for batch in chunks_to_embed.chunks(MAX_BATCH_SIZE) {
        let texts: Vec<String> = batch.iter().map(|(_, c)| c.content.clone()).collect();
        let batch_embeddings = client.embed_batch(&texts).await?;
        for (j, (orig_idx, _)) in batch.iter().enumerate() {
            if j < batch_embeddings.len() {
                all_embeddings.insert(*orig_idx, batch_embeddings[j].clone());
            }
        }
    }

    // Upsert the indexed_files record FIRST (chunks have FK to this)
    let file_type = chunks.first().map(|c| c.metadata.file_type.as_str()).unwrap_or("unknown");
    db::upsert_indexed_file(&conn, rel_path, &file_hash, file_type, chunks.len() as u32)?;

    // Insert all chunks (with embeddings for changed ones, placeholder for unchanged)
    let mut total_tokens: u64 = 0;

    for (i, chunk) in chunks.iter().enumerate() {
        // Get embedding: either freshly computed or we need to embed it
        let embedding_vec = if let Some(emb) = all_embeddings.get(&i) {
            emb.clone()
        } else {
            // This chunk was unchanged but we deleted all chunks above,
            // so we need to re-embed it too. This only happens if the file changed
            // but some individual chunks didn't.
            let single = client.embed_batch(&[chunk.content.clone()]).await?;
            single.into_iter().next().unwrap_or_default()
        };

        let embedding_bytes = embeddings::embedding_to_bytes(&embedding_vec);

        let chunk_id = db::insert_chunk(
            &conn,
            rel_path,
            chunk.chunk_index,
            chunk.section_heading.as_deref(),
            &chunk.content_hash,
            &chunk.content_preview,
            chunk.token_count,
            &embedding_bytes,
        )?;

        db::insert_chunk_metadata(
            &conn,
            chunk_id,
            chunk.metadata.book_id.as_deref(),
            chunk.metadata.chapter_id.as_deref(),
            chunk.metadata.entity_type.as_deref(),
            chunk.metadata.entity_name.as_deref(),
        )?;

        total_tokens += chunk.token_count as u64;
    }

    // Log embedding cost
    let chunks_embedded_count = all_embeddings.len() as u32;
    if chunks_embedded_count > 0 {
        let cost = (total_tokens as f64 / 1_000_000.0) * client.cost_per_million_tokens();
        db::log_embedding_call(&conn, total_tokens, chunks_embedded_count, cost)?;
    }

    Ok(IndexFileResult {
        chunks_total: chunks.len() as u32,
        chunks_embedded: chunks_embedded_count,
        tokens_used: total_tokens,
    })
}

/// Remove all index entries for a file.
pub fn deindex_file(project_dir: &PathBuf, rel_path: &str) -> Result<(), AppError> {
    let conn = db::open_index(project_dir)?;
    db::init_schema(&conn)?;
    db::delete_file_data(&conn, rel_path)?;
    Ok(())
}

/// Result of indexing a single file
pub struct IndexFileResult {
    pub chunks_total: u32,
    pub chunks_embedded: u32,
    pub tokens_used: u64,
}

/// Collect all indexable .md files in the project directory.
pub fn collect_indexable_files(project_dir: &PathBuf) -> Vec<String> {
    let mut files = Vec::new();
    collect_files_recursive(project_dir, project_dir, &mut files);
    files
}

fn collect_files_recursive(root: &PathBuf, dir: &PathBuf, files: &mut Vec<String>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden directories and non-indexable paths
        if name.starts_with('.') || name == "exports" || name == "node_modules" {
            continue;
        }

        if path.is_dir() {
            collect_files_recursive(root, &path, files);
        } else if path.extension().map(|e| e == "md").unwrap_or(false) {
            if let Ok(rel) = path.strip_prefix(root) {
                let rel_str = rel.to_string_lossy().replace('\\', "/");
                files.push(rel_str);
            }
        }
    }
}
