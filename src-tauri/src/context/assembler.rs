use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use serde::Serialize;
use crate::error::AppError;
use crate::commands::config::get_config;
use super::skills::SkillDefinition;
use super::tokens::estimate_tokens;
use super::vector;

/// Normalize a relative path to always use forward slashes for display consistency.
fn normalize_rel_path(rel: &std::path::Path) -> String {
    rel.display().to_string().replace('\\', "/")
}

#[derive(Debug, Clone, Serialize)]
pub struct AssembledContext {
    pub system_prompt: String,
    pub context_block: String,
    pub total_tokens: u64,
    pub files_loaded: Vec<LoadedFile>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LoadedFile {
    pub path: String,
    pub mode: String,
    pub tokens: u64,
}

/// Resolve a context path pattern against the project directory.
/// Supports `{book}` placeholder, `**` recursive glob, and simple `*` glob in the last segment.
fn resolve_paths(pattern: &str, project_dir: &PathBuf, book_id: Option<&str>) -> Vec<PathBuf> {
    let resolved = if let Some(bid) = book_id {
        pattern.replace("{book}", &format!("books/{}", bid))
    } else {
        pattern.replace("{book}", "books/_default")
    };

    // Handle ** recursive glob (e.g. "world/**/entry.md" or "characters/**/profile.md")
    if resolved.contains("**") {
        return resolve_recursive_glob(&resolved, project_dir);
    }

    let full = project_dir.join(&resolved);

    // Handle simple glob in last segment (e.g. "characters/*.md")
    if let Some(file_name) = full.file_name().and_then(|f| f.to_str()) {
        if file_name.contains('*') {
            if let Some(parent) = full.parent() {
                if parent.is_dir() {
                    let glob_pattern = file_name.to_string();
                    let mut results = Vec::new();
                    if let Ok(entries) = std::fs::read_dir(parent) {
                        for entry in entries.flatten() {
                            let name = entry.file_name().to_string_lossy().to_string();
                            if matches_simple_glob(&glob_pattern, &name) {
                                results.push(entry.path());
                            }
                        }
                    }
                    results.sort();
                    return results;
                }
            }
            return Vec::new();
        }
    }

    if full.exists() {
        vec![full]
    } else {
        Vec::new()
    }
}

/// Resolve a pattern containing `**` by walking the directory tree recursively.
/// Example: "world/**/entry.md" — find all files named "entry.md" under "world/".
/// Example: "characters/**/profile.md" — find all "profile.md" under "characters/".
fn resolve_recursive_glob(pattern: &str, project_dir: &PathBuf) -> Vec<PathBuf> {
    // Split on the first "**" occurrence
    let parts: Vec<&str> = pattern.splitn(2, "**").collect();
    if parts.len() != 2 {
        return Vec::new();
    }

    let base_rel = parts[0].trim_end_matches('/').trim_end_matches('\\');
    let suffix = parts[1].trim_start_matches('/').trim_start_matches('\\');

    let base_dir = if base_rel.is_empty() {
        project_dir.clone()
    } else {
        project_dir.join(base_rel)
    };

    if !base_dir.is_dir() {
        return Vec::new();
    }

    let mut results = Vec::new();
    walk_dir_recursive(&base_dir, suffix, &mut results);
    results.sort();
    results
}

/// Recursively walk a directory and collect files whose name matches the suffix pattern.
fn walk_dir_recursive(dir: &PathBuf, suffix: &str, results: &mut Vec<PathBuf>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            walk_dir_recursive(&path, suffix, results);
        } else if path.is_file() {
            // Check if the file name matches the suffix (e.g. "entry.md", "*.md")
            let file_name = path.file_name().and_then(|f| f.to_str()).unwrap_or("");
            if suffix.contains('*') {
                if matches_simple_glob(suffix, file_name) {
                    results.push(path);
                }
            } else if file_name == suffix {
                results.push(path);
            }
        }
    }
}

/// Simple glob matching: only supports `*` as a wildcard segment.
fn matches_simple_glob(pattern: &str, name: &str) -> bool {
    if let Some(suffix) = pattern.strip_prefix('*') {
        name.ends_with(suffix)
    } else if let Some(prefix) = pattern.strip_suffix('*') {
        name.starts_with(prefix)
    } else {
        pattern == name
    }
}

/// Load a file's content and estimate its tokens.
fn load_file(path: &PathBuf, max_remaining: u64) -> Option<(String, u64)> {
    let content = std::fs::read_to_string(path).ok()?;
    let tokens = estimate_tokens(&content).unwrap_or(content.len() / 4) as u64;
    if tokens > max_remaining {
        // Truncate to fit within budget (rough: take proportional substring)
        let ratio = max_remaining as f64 / tokens as f64;
        let chars_to_take = (content.len() as f64 * ratio) as usize;
        let truncated = &content[..chars_to_take.min(content.len())];
        let trunc_tokens = estimate_tokens(truncated).unwrap_or(truncated.len() / 4) as u64;
        Some((truncated.to_string(), trunc_tokens))
    } else {
        Some((content, tokens))
    }
}

/// Load context settings from .context_settings.json.
/// Returns a map of relative path (forward slashes) → mode ("auto", "exclude", "force").
/// Keys in the JSON are absolute paths; we normalize them to relative forward-slash paths.
pub fn load_context_settings(project_dir: &PathBuf) -> HashMap<String, String> {
    let settings_path = project_dir.join(".context_settings.json");
    if let Ok(content) = std::fs::read_to_string(&settings_path) {
        if let Ok(raw_map) = serde_json::from_str::<HashMap<String, String>>(&content) {
            let prefix = project_dir.to_string_lossy().to_string();
            let mut normalized = HashMap::new();
            for (path, mode) in raw_map {
                let rel = if path.starts_with(&prefix) {
                    path[prefix.len()..].trim_start_matches('\\').trim_start_matches('/')
                } else {
                    &path
                };
                let key = rel.replace('\\', "/");
                normalized.insert(key, mode);
            }
            return normalized;
        }
    }
    HashMap::new()
}

/// Check if a file should be excluded based on context settings.
/// Returns true if the file is explicitly excluded.
pub fn is_excluded(rel_path: &str, settings: &HashMap<String, String>) -> bool {
    settings.get(rel_path).map(|m| m == "exclude").unwrap_or(false)
}

/// Assemble context files based on a skill's context definition.
/// Respects .context_settings.json: "exclude" files are skipped, "force" files are always added.
pub fn assemble_context(
    skill: &SkillDefinition,
    project_dir: &PathBuf,
    book_id: Option<&str>,
    _chapter_id: Option<&str>,
    _scene_id: Option<&str>,
) -> Result<AssembledContext, AppError> {
    let max_tokens = skill.context.max_context_tokens;
    let mut total_tokens: u64 = 0;
    let mut files_loaded = Vec::new();
    let mut context_parts: Vec<String> = Vec::new();
    let mut loaded_canonical: HashSet<PathBuf> = HashSet::new();
    let ctx_settings = load_context_settings(project_dir);

    // Helper closure to load a file respecting context settings
    let try_load = |path: &PathBuf, total: &mut u64, max: u64,
                        loaded: &mut HashSet<PathBuf>,
                        parts: &mut Vec<String>,
                        files: &mut Vec<LoadedFile>| -> bool {
        if *total >= max {
            return false;
        }
        let canonical = path.canonicalize().unwrap_or_else(|_| path.clone());
        if loaded.contains(&canonical) {
            return false;
        }
        let rel = path.strip_prefix(project_dir).unwrap_or(path);
        let rel_str = normalize_rel_path(rel);
        if is_excluded(&rel_str, &ctx_settings) {
            return false;
        }
        if let Some((content, tokens)) = load_file(path, max - *total) {
            parts.push(format!("--- {} ---\n{}", rel_str, content));
            files.push(LoadedFile {
                path: rel_str,
                mode: "full".to_string(),
                tokens,
            });
            *total += tokens;
            loaded.insert(canonical);
            return true;
        }
        false
    };

    // 1. Always-include files
    for pattern in &skill.context.always_include {
        let paths = resolve_paths(pattern, project_dir, book_id);
        for path in paths {
            try_load(&path, &mut total_tokens, max_tokens, &mut loaded_canonical, &mut context_parts, &mut files_loaded);
        }
    }

    // 2. When-book files (only if a book is in scope)
    if book_id.is_some() {
        if let Some(when_book) = &skill.context.when_book {
            for pattern in &when_book.include {
                let paths = resolve_paths(pattern, project_dir, book_id);
                for path in paths {
                    try_load(&path, &mut total_tokens, max_tokens, &mut loaded_canonical, &mut context_parts, &mut files_loaded);
                }
            }
        }
    }

    // 3. Optional files (include if they exist)
    if let Some(optional) = &skill.context.optional {
        for pattern in &optional.include_if_exists {
            let paths = resolve_paths(pattern, project_dir, book_id);
            for path in paths {
                try_load(&path, &mut total_tokens, max_tokens, &mut loaded_canonical, &mut context_parts, &mut files_loaded);
            }
        }
    }

    // 4. Force-include: load any files marked "force" in context settings that haven't been loaded yet
    for (rel_path, mode) in &ctx_settings {
        if mode != "force" {
            continue;
        }
        let full_path = project_dir.join(rel_path.replace('/', "\\"));
        if !full_path.exists() {
            continue;
        }
        try_load(&full_path, &mut total_tokens, max_tokens, &mut loaded_canonical, &mut context_parts, &mut files_loaded);
    }

    // Build the context block
    let context_block = if context_parts.is_empty() {
        String::new()
    } else {
        format!("<project_context>\n{}\n</project_context>", context_parts.join("\n\n"))
    };

    // Build system prompt with context injected
    let system_prompt = if context_block.is_empty() {
        skill.system_prompt.template.clone()
    } else {
        format!("{}\n\n{}", skill.system_prompt.template, context_block)
    };

    let prompt_tokens = estimate_tokens(&system_prompt).unwrap_or(system_prompt.len() / 4) as u64;

    Ok(AssembledContext {
        system_prompt,
        context_block,
        total_tokens: prompt_tokens,
        files_loaded,
    })
}

/// Enrich an already-assembled context with vector search results.
/// Returns the search results found (empty if vector search is disabled or unavailable).
/// Also modifies the AssembledContext to append search result content to the prompt.
pub async fn enrich_with_search(
    assembled: &mut AssembledContext,
    skill: &SkillDefinition,
    project_dir: &PathBuf,
    query: &str,
    book_id: Option<&str>,
) -> Vec<vector::SearchResult> {
    // Check global config
    let config = match get_config() {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    if !config.vector_search.enabled || config.vector_search.embedding_api_key_encrypted.is_empty() {
        return Vec::new();
    }

    // Check skill-level config
    let skill_vs = skill.context.vector_search.as_ref();
    let skill_enabled = skill_vs.map(|vs| vs.enabled).unwrap_or(false);
    if !skill_enabled {
        return Vec::new();
    }

    // Check mode: "never" skips, "always" always searches, "auto" searches
    // (true agent-decision logic for "auto" is future work — for now, always search)
    let mode = skill_vs.map(|vs| vs.mode.as_str()).unwrap_or("auto");
    if mode == "never" {
        return Vec::new();
    }

    // Resolve search parameters from skill config (with global defaults as fallback)
    let max_results = skill_vs.map(|vs| vs.max_results).unwrap_or(config.vector_search.max_results_default);
    let max_search_tokens = skill_vs.map(|vs| vs.max_search_tokens).unwrap_or(config.vector_search.max_search_tokens_default);
    let filter_entity_types = skill_vs.map(|vs| vs.filter_entity_types.clone()).unwrap_or_default();

    // Decode API key
    let api_key = match decode_base64_key(&config.vector_search.embedding_api_key_encrypted) {
        Some(k) => k,
        None => return Vec::new(),
    };

    let client = vector::embeddings::VoyageClient::new(
        api_key,
        config.vector_search.embedding_model.clone(),
    );

    // Build the set of already-loaded file paths for deduplication
    let already_loaded: HashSet<String> = assembled.files_loaded.iter()
        .map(|f| f.path.clone())
        .collect();

    // Load context settings for exclusion filtering
    let ctx_settings = load_context_settings(project_dir);

    // Run the search
    let results = match vector::search::search(
        project_dir,
        query,
        &client,
        max_results,
        &filter_entity_types,
        book_id,
        &ctx_settings,
        &already_loaded,
    ).await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("Vector search enrichment failed: {}", e);
            return Vec::new();
        }
    };

    if results.is_empty() {
        return results;
    }

    // Append search results to the context within the search token budget
    let mut search_parts: Vec<String> = Vec::new();
    let mut search_tokens: u64 = 0;
    let mut included_results: Vec<vector::SearchResult> = Vec::new();

    for result in &results {
        if search_tokens >= max_search_tokens {
            break;
        }
        let section_label = result.section_heading.as_deref().unwrap_or("full file");
        let header = format!("--- {} (SEARCH: {}) ---", result.file_path, section_label);
        let part = format!("{}\n{}", header, result.content_preview);
        let part_tokens = estimate_tokens(&part).unwrap_or(part.len() / 4) as u64;

        if search_tokens + part_tokens > max_search_tokens {
            break;
        }

        search_parts.push(part);
        search_tokens += part_tokens;
        included_results.push(result.clone());
    }

    // Token budget shedding: if combined total exceeds max_context_tokens,
    // shed search results (lowest similarity = last in list) first
    let max_context = skill.context.max_context_tokens;
    while !search_parts.is_empty() && assembled.total_tokens + search_tokens > max_context {
        // Remove the last (least relevant) search result
        if let Some(removed) = search_parts.pop() {
            let removed_tokens = estimate_tokens(&removed).unwrap_or(removed.len() / 4) as u64;
            search_tokens = search_tokens.saturating_sub(removed_tokens);
            included_results.pop();
        }
    }

    if !search_parts.is_empty() {
        let search_block = format!(
            "\n\n<search_context>\nThe following additional context was found via semantic search and may be relevant:\n\n{}\n</search_context>",
            search_parts.join("\n\n")
        );
        assembled.system_prompt.push_str(&search_block);
        assembled.total_tokens += search_tokens;
    }

    included_results
}

/// Decode a base64-encoded API key string.
fn decode_base64_key(encoded: &str) -> Option<String> {
    let trimmed = encoded.trim();
    if trimmed.is_empty() {
        return None;
    }
    // Use the same base64 decoding as the general crate approach
    let decoded = trimmed.as_bytes();
    if decoded.len() % 4 != 0 {
        return None;
    }
    let mut output = Vec::with_capacity(decoded.len() * 3 / 4);
    for chunk in decoded.chunks(4) {
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
    String::from_utf8(output).ok()
}
