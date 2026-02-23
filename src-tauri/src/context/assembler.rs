use std::collections::HashSet;
use std::path::PathBuf;
use serde::Serialize;
use crate::error::AppError;
use super::skills::SkillDefinition;
use super::tokens::estimate_tokens;

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

/// Assemble context files based on a skill's context definition.
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

    // 1. Always-include files
    for pattern in &skill.context.always_include {
        let paths = resolve_paths(pattern, project_dir, book_id);
        for path in paths {
            if total_tokens >= max_tokens {
                break;
            }
            let canonical = path.canonicalize().unwrap_or_else(|_| path.clone());
            if loaded_canonical.contains(&canonical) {
                continue;
            }
            if let Some((content, tokens)) = load_file(&path, max_tokens - total_tokens) {
                let rel = path.strip_prefix(project_dir).unwrap_or(&path);
                let rel_str = normalize_rel_path(rel);
                context_parts.push(format!("--- {} ---\n{}", rel_str, content));
                files_loaded.push(LoadedFile {
                    path: rel_str,
                    mode: "full".to_string(),
                    tokens,
                });
                total_tokens += tokens;
                loaded_canonical.insert(canonical);
            }
        }
    }

    // 2. When-book files (only if a book is in scope)
    if book_id.is_some() {
        if let Some(when_book) = &skill.context.when_book {
            for pattern in &when_book.include {
                let paths = resolve_paths(pattern, project_dir, book_id);
                for path in paths {
                    if total_tokens >= max_tokens {
                        break;
                    }
                    let canonical = path.canonicalize().unwrap_or_else(|_| path.clone());
                    if loaded_canonical.contains(&canonical) {
                        continue;
                    }
                    if let Some((content, tokens)) = load_file(&path, max_tokens - total_tokens) {
                        let rel = path.strip_prefix(project_dir).unwrap_or(&path);
                        let rel_str = normalize_rel_path(rel);
                        context_parts.push(format!("--- {} ---\n{}", rel_str, content));
                        files_loaded.push(LoadedFile {
                            path: rel_str,
                            mode: "full".to_string(),
                            tokens,
                        });
                        total_tokens += tokens;
                        loaded_canonical.insert(canonical);
                    }
                }
            }
        }
    }

    // 3. Optional files (include if they exist)
    if let Some(optional) = &skill.context.optional {
        for pattern in &optional.include_if_exists {
            let paths = resolve_paths(pattern, project_dir, book_id);
            for path in paths {
                if total_tokens >= max_tokens {
                    break;
                }
                let canonical = path.canonicalize().unwrap_or_else(|_| path.clone());
                if loaded_canonical.contains(&canonical) {
                    continue;
                }
                if let Some((content, tokens)) = load_file(&path, max_tokens - total_tokens) {
                    let rel = path.strip_prefix(project_dir).unwrap_or(&path);
                    let rel_str = normalize_rel_path(rel);
                    context_parts.push(format!("--- {} ---\n{}", rel_str, content));
                    files_loaded.push(LoadedFile {
                        path: rel_str,
                        mode: "full".to_string(),
                        tokens,
                    });
                    total_tokens += tokens;
                    loaded_canonical.insert(canonical);
                }
            }
        }
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
