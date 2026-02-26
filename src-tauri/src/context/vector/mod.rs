pub mod db;
pub mod chunker;
pub mod embeddings;
pub mod indexer;
pub mod search;

use serde::{Deserialize, Serialize};

/// A single search result returned to the assembler / frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub file_path: String,
    pub section_heading: Option<String>,
    pub similarity_score: f32,
    pub content_preview: String,
    pub token_count: u64,
    pub entity_type: Option<String>,
    pub entity_name: Option<String>,
    pub book_id: Option<String>,
}

/// Index status for the settings UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexStatus {
    pub total_files: u32,
    pub total_chunks: u32,
    pub last_indexed: Option<String>,
    pub total_cost_usd: f64,
    pub is_indexing: bool,
    pub index_progress: Option<IndexProgress>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexProgress {
    pub files_processed: u32,
    pub files_total: u32,
    pub current_file: String,
}
