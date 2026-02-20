use std::path::PathBuf;
use serde::Serialize;
use crate::error::AppError;
use super::skills::SkillDefinition;
use super::tokens::estimate_tokens;

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
/// Supports `{book}` placeholder and simple glob `*.md` in the last segment.
fn resolve_paths(pattern: &str, project_dir: &PathBuf, book_id: Option<&str>) -> Vec<PathBuf> {
    let resolved = if let Some(bid) = book_id {
        pattern.replace("{book}", &format!("books/{}", bid))
    } else {
        pattern.replace("{book}", "books/_default")
    };

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

    // 1. Always-include files
    for pattern in &skill.context.always_include {
        let paths = resolve_paths(pattern, project_dir, book_id);
        for path in paths {
            if total_tokens >= max_tokens {
                break;
            }
            if let Some((content, tokens)) = load_file(&path, max_tokens - total_tokens) {
                let rel = path.strip_prefix(project_dir).unwrap_or(&path);
                context_parts.push(format!("--- {} ---\n{}", rel.display(), content));
                files_loaded.push(LoadedFile {
                    path: rel.display().to_string(),
                    mode: "full".to_string(),
                    tokens,
                });
                total_tokens += tokens;
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
                    if let Some((content, tokens)) = load_file(&path, max_tokens - total_tokens) {
                        let rel = path.strip_prefix(project_dir).unwrap_or(&path);
                        context_parts.push(format!("--- {} ---\n{}", rel.display(), content));
                        files_loaded.push(LoadedFile {
                            path: rel.display().to_string(),
                            mode: "full".to_string(),
                            tokens,
                        });
                        total_tokens += tokens;
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
                if let Some((content, tokens)) = load_file(&path, max_tokens - total_tokens) {
                    let rel = path.strip_prefix(project_dir).unwrap_or(&path);
                    context_parts.push(format!("--- {} ---\n{}", rel.display(), content));
                    files_loaded.push(LoadedFile {
                        path: rel.display().to_string(),
                        mode: "full".to_string(),
                        tokens,
                    });
                    total_tokens += tokens;
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
