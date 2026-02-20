// File summarizer — generates summaries via Claude Haiku for context compression
// Full implementation in Phase 7

use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Instant;

pub struct SummaryCache {
    entries: HashMap<PathBuf, CacheEntry>,
}

struct CacheEntry {
    summary: String,
    source_hash: u64,
    token_count: usize,
    created_at: Instant,
}

impl SummaryCache {
    pub fn new() -> Self {
        Self { entries: HashMap::new() }
    }

    pub fn get(&self, path: &PathBuf, current_hash: u64) -> Option<&str> {
        self.entries.get(path).and_then(|entry| {
            if entry.source_hash == current_hash {
                Some(entry.summary.as_str())
            } else {
                None
            }
        })
    }

    pub fn insert(&mut self, path: PathBuf, summary: String, source_hash: u64, token_count: usize) {
        self.entries.insert(path, CacheEntry {
            summary,
            source_hash,
            token_count,
            created_at: Instant::now(),
        });
    }

    pub fn invalidate(&mut self, path: &PathBuf) {
        self.entries.remove(path);
    }

    pub fn clear(&mut self) {
        self.entries.clear();
    }
}
