use std::path::PathBuf;
use std::collections::HashMap;

use crate::error::AppError;
use super::db;
use super::embeddings::{self, EmbeddingClient, cosine_similarity};
use super::SearchResult;

/// Perform a semantic search across the project index.
///
/// Steps:
/// 1. Embed the query via the EmbeddingClient
/// 2. Load all chunk embeddings from SQLite
/// 3. Compute cosine similarity (brute-force for now; sqlite-vec ANN later)
/// 4. Apply filters (entity_type, book_id)
/// 5. Return top-K results sorted by similarity
pub async fn search(
    project_dir: &PathBuf,
    query: &str,
    client: &dyn EmbeddingClient,
    max_results: u32,
    filter_entity_types: &[String],
    filter_book_id: Option<&str>,
    excluded_files: &HashMap<String, String>,
    already_loaded: &std::collections::HashSet<String>,
) -> Result<Vec<SearchResult>, AppError> {
    // 1. Embed the query
    let query_embedding = client.embed_query(query).await?;

    // 2. Load all chunks
    let conn = db::open_index(project_dir)?;
    db::init_schema(&conn)?;
    let all_chunks = db::get_all_chunks_for_search(&conn)?;

    if all_chunks.is_empty() {
        return Ok(Vec::new());
    }

    // 3. Score each chunk
    let mut scored: Vec<(f32, &db::ChunkRow)> = Vec::with_capacity(all_chunks.len());

    for chunk in &all_chunks {
        // Filter: excluded files
        let rel_path_fwd = chunk.file_path.replace('\\', "/");
        if is_excluded_by_settings(&rel_path_fwd, excluded_files) {
            continue;
        }

        // Filter: already loaded by deterministic assembler
        if already_loaded.contains(&rel_path_fwd) {
            continue;
        }

        // Filter: entity type
        if !filter_entity_types.is_empty() {
            if let Some(ref et) = chunk.entity_type {
                if !filter_entity_types.iter().any(|f| f == et) {
                    continue;
                }
            } else {
                continue;
            }
        }

        // Filter: book scope
        if let Some(book_filter) = filter_book_id {
            if chunk.book_id.as_deref() != Some(book_filter) {
                continue;
            }
        }

        // Compute similarity
        let chunk_embedding = embeddings::bytes_to_embedding(&chunk.embedding);
        let score = cosine_similarity(&query_embedding, &chunk_embedding);
        scored.push((score, chunk));
    }

    // 4. Sort by similarity descending
    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

    // 5. Take top-K
    let results: Vec<SearchResult> = scored
        .into_iter()
        .take(max_results as usize)
        .map(|(score, chunk)| SearchResult {
            file_path: chunk.file_path.replace('\\', "/"),
            section_heading: chunk.section_heading.clone(),
            similarity_score: score,
            content_preview: chunk.content_preview.clone(),
            token_count: chunk.token_count as u64,
            entity_type: chunk.entity_type.clone(),
            entity_name: chunk.entity_name.clone(),
            book_id: chunk.book_id.clone(),
        })
        .collect();

    Ok(results)
}

/// Check if a file path is excluded by context settings.
fn is_excluded_by_settings(rel_path: &str, settings: &HashMap<String, String>) -> bool {
    settings.get(rel_path).map(|v| v == "exclude").unwrap_or(false)
}
