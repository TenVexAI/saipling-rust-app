use std::path::PathBuf;
use rusqlite::Connection;
use crate::error::AppError;

const SCHEMA_SQL: &str = r#"
-- Tracks indexed files and their state
CREATE TABLE IF NOT EXISTS indexed_files (
    file_path     TEXT PRIMARY KEY,
    content_hash  TEXT NOT NULL,
    file_type     TEXT NOT NULL,
    last_indexed  TEXT NOT NULL,
    chunk_count   INTEGER NOT NULL DEFAULT 0
);

-- Stores individual chunks with embeddings
CREATE TABLE IF NOT EXISTS chunks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path     TEXT NOT NULL,
    chunk_index   INTEGER NOT NULL,
    section_heading TEXT,
    content_hash  TEXT NOT NULL,
    content_preview TEXT NOT NULL,
    token_count   INTEGER NOT NULL,
    embedding     BLOB NOT NULL,

    FOREIGN KEY (file_path) REFERENCES indexed_files(file_path) ON DELETE CASCADE,
    UNIQUE(file_path, chunk_index)
);

-- Metadata for filtering during search
CREATE TABLE IF NOT EXISTS chunk_metadata (
    chunk_id      INTEGER PRIMARY KEY,
    book_id       TEXT,
    chapter_id    TEXT,
    entity_type   TEXT,
    entity_name   TEXT,

    FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE
);

-- Tracks embedding costs for the user
CREATE TABLE IF NOT EXISTS embedding_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp     TEXT NOT NULL,
    tokens_used   INTEGER NOT NULL,
    chunks_embedded INTEGER NOT NULL,
    cost_usd      REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file_path);
CREATE INDEX IF NOT EXISTS idx_metadata_book ON chunk_metadata(book_id);
CREATE INDEX IF NOT EXISTS idx_metadata_entity ON chunk_metadata(entity_type, entity_name);
"#;

/// Open (or create) the project's vector index database.
/// The DB lives at `{project_dir}/.saipling/index.db`.
pub fn open_index(project_dir: &PathBuf) -> Result<Connection, AppError> {
    let db_dir = project_dir.join(".saipling");
    std::fs::create_dir_all(&db_dir)?;
    let db_path = db_dir.join("index.db");
    let conn = Connection::open(&db_path)?;

    // Enable WAL mode for concurrent reads during writes
    conn.pragma_update(None, "journal_mode", "WAL")?;
    // Enable foreign keys
    conn.pragma_update(None, "foreign_keys", "ON")?;

    Ok(conn)
}

/// Create all tables and indexes if they don't exist.
pub fn init_schema(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(SCHEMA_SQL)?;
    Ok(())
}

/// Insert or update an indexed file record.
pub fn upsert_indexed_file(
    conn: &Connection,
    file_path: &str,
    content_hash: &str,
    file_type: &str,
    chunk_count: u32,
) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO indexed_files (file_path, content_hash, file_type, last_indexed, chunk_count)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(file_path) DO UPDATE SET
           content_hash = excluded.content_hash,
           file_type = excluded.file_type,
           last_indexed = excluded.last_indexed,
           chunk_count = excluded.chunk_count",
        rusqlite::params![file_path, content_hash, file_type, now, chunk_count],
    )?;
    Ok(())
}

/// Delete all data for a given file (chunks + metadata cascade via FK).
pub fn delete_file_data(conn: &Connection, file_path: &str) -> Result<(), AppError> {
    conn.execute("DELETE FROM indexed_files WHERE file_path = ?1", [file_path])?;
    Ok(())
}

/// Delete all chunks for a file (called before re-inserting updated chunks).
pub fn delete_chunks_for_file(conn: &Connection, file_path: &str) -> Result<(), AppError> {
    // chunk_metadata rows cascade-delete via FK on chunk_id
    conn.execute("DELETE FROM chunks WHERE file_path = ?1", [file_path])?;
    Ok(())
}

/// Insert a single chunk and return its row id.
pub fn insert_chunk(
    conn: &Connection,
    file_path: &str,
    chunk_index: u32,
    section_heading: Option<&str>,
    content_hash: &str,
    content_preview: &str,
    token_count: u32,
    embedding: &[u8],
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO chunks (file_path, chunk_index, section_heading, content_hash, content_preview, token_count, embedding)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![file_path, chunk_index, section_heading, content_hash, content_preview, token_count, embedding],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Insert metadata for a chunk.
pub fn insert_chunk_metadata(
    conn: &Connection,
    chunk_id: i64,
    book_id: Option<&str>,
    chapter_id: Option<&str>,
    entity_type: Option<&str>,
    entity_name: Option<&str>,
) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO chunk_metadata (chunk_id, book_id, chapter_id, entity_type, entity_name)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![chunk_id, book_id, chapter_id, entity_type, entity_name],
    )?;
    Ok(())
}

/// Log an embedding API call for cost tracking.
pub fn log_embedding_call(
    conn: &Connection,
    tokens_used: u64,
    chunks_embedded: u32,
    cost_usd: f64,
) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO embedding_log (timestamp, tokens_used, chunks_embedded, cost_usd)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![now, tokens_used, chunks_embedded, cost_usd],
    )?;
    Ok(())
}

/// Get the content hash for a file, if it's already indexed.
pub fn get_file_hash(conn: &Connection, file_path: &str) -> Result<Option<String>, AppError> {
    let mut stmt = conn.prepare("SELECT content_hash FROM indexed_files WHERE file_path = ?1")?;
    let hash = stmt
        .query_row([file_path], |row| row.get::<_, String>(0))
        .ok();
    Ok(hash)
}

/// Get total files, total chunks, last indexed timestamp, and total cost.
pub fn get_index_stats(conn: &Connection) -> Result<(u32, u32, Option<String>, f64), AppError> {
    let total_files: u32 = conn
        .query_row("SELECT COUNT(*) FROM indexed_files", [], |row| row.get(0))
        .unwrap_or(0);

    let total_chunks: u32 = conn
        .query_row("SELECT COUNT(*) FROM chunks", [], |row| row.get(0))
        .unwrap_or(0);

    let last_indexed: Option<String> = conn
        .query_row(
            "SELECT last_indexed FROM indexed_files ORDER BY last_indexed DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .ok();

    let total_cost: f64 = conn
        .query_row("SELECT COALESCE(SUM(cost_usd), 0.0) FROM embedding_log", [], |row| row.get(0))
        .unwrap_or(0.0);

    Ok((total_files, total_chunks, last_indexed, total_cost))
}

/// Get all chunk hashes for a file, keyed by chunk_index.
pub fn get_chunk_hashes(conn: &Connection, file_path: &str) -> Result<std::collections::HashMap<u32, String>, AppError> {
    let mut stmt = conn.prepare("SELECT chunk_index, content_hash FROM chunks WHERE file_path = ?1")?;
    let mut map = std::collections::HashMap::new();
    let rows = stmt.query_map([file_path], |row| {
        Ok((row.get::<_, u32>(0)?, row.get::<_, String>(1)?))
    })?;
    for row in rows {
        let (idx, hash) = row?;
        map.insert(idx, hash);
    }
    Ok(map)
}

/// Retrieve all chunk embeddings and metadata for brute-force similarity search.
/// Returns (chunk_id, file_path, chunk_index, section_heading, content_preview, token_count, embedding_bytes, book_id, entity_type, entity_name).
pub fn get_all_chunks_for_search(
    conn: &Connection,
) -> Result<Vec<ChunkRow>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT c.id, c.file_path, c.chunk_index, c.section_heading, c.content_preview,
                c.token_count, c.embedding, m.book_id, m.entity_type, m.entity_name
         FROM chunks c
         LEFT JOIN chunk_metadata m ON m.chunk_id = c.id"
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(ChunkRow {
            id: row.get(0)?,
            file_path: row.get(1)?,
            chunk_index: row.get(2)?,
            section_heading: row.get(3)?,
            content_preview: row.get(4)?,
            token_count: row.get(5)?,
            embedding: row.get(6)?,
            book_id: row.get(7)?,
            entity_type: row.get(8)?,
            entity_name: row.get(9)?,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

/// Row returned by get_all_chunks_for_search
#[allow(dead_code)]
pub struct ChunkRow {
    pub id: i64,
    pub file_path: String,
    pub chunk_index: u32,
    pub section_heading: Option<String>,
    pub content_preview: String,
    pub token_count: u32,
    pub embedding: Vec<u8>,
    pub book_id: Option<String>,
    pub entity_type: Option<String>,
    pub entity_name: Option<String>,
}

/// Clear the entire index (all tables).
pub fn clear_all(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "DELETE FROM chunk_metadata;
         DELETE FROM chunks;
         DELETE FROM indexed_files;
         DELETE FROM embedding_log;
         VACUUM;"
    )?;
    Ok(())
}
