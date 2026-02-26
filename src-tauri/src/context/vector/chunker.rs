use sha2::{Sha256, Digest};
use std::collections::HashMap;
use std::path::Path;

/// A chunk produced from a single file
#[derive(Debug, Clone)]
pub struct Chunk {
    pub chunk_index: u32,
    pub section_heading: Option<String>,
    pub content: String,
    pub content_hash: String,
    pub content_preview: String,
    pub token_count: u32,
    pub metadata: ChunkMetadata,
}

/// Metadata extracted from frontmatter and file path
#[derive(Debug, Clone)]
pub struct ChunkMetadata {
    pub file_type: String,
    pub book_id: Option<String>,
    pub chapter_id: Option<String>,
    pub entity_type: Option<String>,
    pub entity_name: Option<String>,
}

/// Split a markdown file into chunks based on its structure.
///
/// Chunking rules:
/// 1. YAML frontmatter → its own chunk
/// 2. Each ## heading section → its own chunk
/// 3. If a section exceeds 1000 tokens → split at paragraph boundaries
/// 4. Files with no headings → split at paragraph boundaries (~500 tokens)
pub fn chunk_file(content: &str, rel_path: &str) -> Vec<Chunk> {
    let mut chunks = Vec::new();
    let mut chunk_index: u32 = 0;

    let metadata_base = classify_file(rel_path);

    // Split frontmatter from body
    let (frontmatter, body) = split_frontmatter(content);

    // Extract metadata overrides from frontmatter
    let fm_metadata = parse_frontmatter_metadata(&frontmatter, &metadata_base);

    // Chunk 0: frontmatter (if present)
    if !frontmatter.is_empty() {
        let fm_content = format!("---\n{}\n---", frontmatter.trim());
        chunks.push(make_chunk(
            chunk_index,
            None,
            &fm_content,
            fm_metadata.clone(),
        ));
        chunk_index += 1;
    }

    // Split body into heading sections
    let sections = split_by_headings(&body);

    if sections.is_empty() {
        return chunks;
    }

    // Check if file has any headings at all
    let has_headings = sections.iter().any(|(h, _)| h.is_some());

    if has_headings {
        for (heading, section_content) in &sections {
            if section_content.trim().is_empty() {
                continue;
            }
            let est_tokens = estimate_tokens(section_content);
            if est_tokens > 1000 {
                // Split large sections at paragraph boundaries
                let sub_chunks = split_at_paragraphs(section_content, 500, 50);
                for sub in sub_chunks {
                    if sub.trim().is_empty() {
                        continue;
                    }
                    // Prepend heading to each sub-chunk for context
                    let full_content = if let Some(h) = heading {
                        format!("{}\n\n{}", h, sub.trim())
                    } else {
                        sub.trim().to_string()
                    };
                    chunks.push(make_chunk(
                        chunk_index,
                        heading.as_deref(),
                        &full_content,
                        fm_metadata.clone(),
                    ));
                    chunk_index += 1;
                }
            } else {
                let full_content = if let Some(h) = heading {
                    format!("{}\n\n{}", h, section_content.trim())
                } else {
                    section_content.trim().to_string()
                };
                chunks.push(make_chunk(
                    chunk_index,
                    heading.as_deref(),
                    &full_content,
                    fm_metadata.clone(),
                ));
                chunk_index += 1;
            }
        }
    } else {
        // No headings — split at paragraph boundaries targeting ~500 tokens
        let full_body = body.trim();
        if !full_body.is_empty() {
            let para_chunks = split_at_paragraphs(full_body, 500, 50);
            for sub in para_chunks {
                if sub.trim().is_empty() {
                    continue;
                }
                chunks.push(make_chunk(
                    chunk_index,
                    None,
                    sub.trim(),
                    fm_metadata.clone(),
                ));
                chunk_index += 1;
            }
        }
    }

    chunks
}

/// Compute SHA-256 hash of content
pub fn sha256(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

// ─── Internal helpers ───

fn make_chunk(index: u32, heading: Option<&str>, content: &str, metadata: ChunkMetadata) -> Chunk {
    let hash = sha256(content);
    let preview = if content.len() > 200 {
        format!("{}...", &content[..200])
    } else {
        content.to_string()
    };
    let tokens = estimate_tokens(content);

    Chunk {
        chunk_index: index,
        section_heading: heading.map(|s| s.to_string()),
        content: content.to_string(),
        content_hash: hash,
        content_preview: preview,
        token_count: tokens as u32,
        metadata,
    }
}

/// Split frontmatter from body. Returns (frontmatter_str, body_str).
fn split_frontmatter(content: &str) -> (String, String) {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return (String::new(), content.to_string());
    }
    // Find the closing ---
    if let Some(end) = trimmed[3..].find("\n---") {
        let fm = trimmed[3..3 + end].to_string();
        let body = trimmed[3 + end + 4..].to_string();
        (fm, body)
    } else {
        (String::new(), content.to_string())
    }
}

/// Split body text by ## headings. Returns vec of (Option<heading_line>, section_content).
fn split_by_headings(body: &str) -> Vec<(Option<String>, String)> {
    let mut sections = Vec::new();
    let mut current_heading: Option<String> = None;
    let mut current_content = String::new();

    for line in body.lines() {
        if line.starts_with("## ") {
            // Flush previous section
            if current_heading.is_some() || !current_content.trim().is_empty() {
                sections.push((current_heading.clone(), current_content.clone()));
            }
            current_heading = Some(line.to_string());
            current_content = String::new();
        } else {
            current_content.push_str(line);
            current_content.push('\n');
        }
    }
    // Flush last section
    if current_heading.is_some() || !current_content.trim().is_empty() {
        sections.push((current_heading, current_content));
    }

    sections
}

/// Split text at paragraph boundaries, targeting `target_tokens` per chunk
/// with `overlap_tokens` of overlap between chunks.
fn split_at_paragraphs(text: &str, target_tokens: usize, overlap_tokens: usize) -> Vec<String> {
    let paragraphs: Vec<&str> = text.split("\n\n").collect();
    let mut chunks = Vec::new();
    let mut current = String::new();
    let mut current_tokens = 0usize;

    for para in &paragraphs {
        let para_tokens = estimate_tokens(para);
        if current_tokens + para_tokens > target_tokens && !current.is_empty() {
            chunks.push(current.clone());
            // Overlap: keep the last paragraph if it fits in overlap budget
            if para_tokens <= overlap_tokens {
                current = para.to_string();
                current_tokens = para_tokens;
            } else {
                current = String::new();
                current_tokens = 0;
            }
        }
        if !current.is_empty() {
            current.push_str("\n\n");
        }
        current.push_str(para);
        current_tokens += para_tokens;
    }

    if !current.trim().is_empty() {
        chunks.push(current);
    }

    chunks
}

/// Rough token estimation: ~4 chars per token
fn estimate_tokens(text: &str) -> usize {
    (text.len() + 3) / 4
}

/// Parse frontmatter YAML to extract metadata fields.
fn parse_frontmatter_metadata(frontmatter: &str, base: &ChunkMetadata) -> ChunkMetadata {
    let mut metadata = base.clone();

    if frontmatter.is_empty() {
        return metadata;
    }

    // Simple key-value parsing (avoids full YAML dependency for frontmatter)
    let fm: HashMap<String, String> = frontmatter
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(2, ':').collect();
            if parts.len() == 2 {
                Some((parts[0].trim().to_string(), parts[1].trim().trim_matches('"').to_string()))
            } else {
                None
            }
        })
        .collect();

    if let Some(t) = fm.get("type") {
        metadata.entity_type = Some(t.clone());
    }
    if let Some(n) = fm.get("name") {
        metadata.entity_name = Some(n.to_lowercase().replace(' ', "-"));
    }
    if let Some(s) = fm.get("scope") {
        if s.starts_with("book-") {
            metadata.book_id = Some(s.clone());
        }
    }

    metadata
}

/// Classify a file by its relative path to determine file_type and extract
/// book_id, chapter_id, entity_name from the path structure.
fn classify_file(rel_path: &str) -> ChunkMetadata {
    let path = Path::new(rel_path);
    let components: Vec<&str> = path.components()
        .filter_map(|c| c.as_os_str().to_str())
        .collect();

    let mut metadata = ChunkMetadata {
        file_type: "unknown".to_string(),
        book_id: None,
        chapter_id: None,
        entity_type: None,
        entity_name: None,
    };

    if components.is_empty() {
        return metadata;
    }

    // overview/
    if components[0] == "overview" {
        if components.last() == Some(&"brainstorm.md") {
            metadata.file_type = "brainstorm".to_string();
        } else {
            metadata.file_type = "overview".to_string();
        }
        return metadata;
    }

    // characters/[slug]/profile.md or brainstorm.md
    if components[0] == "characters" {
        if components.len() >= 2 {
            metadata.entity_name = Some(components[1].to_string());
        }
        if components.last() == Some(&"brainstorm.md") {
            metadata.file_type = "brainstorm".to_string();
        } else {
            metadata.file_type = "character".to_string();
            metadata.entity_type = Some("character".to_string());
        }
        return metadata;
    }

    // world/**/entry.md
    if components[0] == "world" {
        metadata.file_type = "world".to_string();
        metadata.entity_type = Some("world".to_string());
        if components.len() >= 3 {
            metadata.entity_name = Some(components[components.len() - 2].to_string());
        }
        return metadata;
    }

    // notes/
    if components[0] == "notes" {
        metadata.file_type = "notes".to_string();
        return metadata;
    }

    // books/{book}/...
    if components[0] == "books" && components.len() >= 2 {
        let book_id = components[1].to_string();
        metadata.book_id = Some(book_id);

        if components.len() >= 3 {
            let phase_dir = components[2];

            if phase_dir == "overview" {
                metadata.file_type = "book_overview".to_string();
            } else if phase_dir == "phase-1-seed" {
                metadata.file_type = "seed".to_string();
            } else if phase_dir == "phase-2-root" {
                metadata.file_type = "structure".to_string();
            } else if phase_dir == "phase-3-sprout" {
                metadata.file_type = "character_arc".to_string();
                metadata.entity_type = Some("character_arc".to_string());
                if components.len() >= 4 {
                    metadata.entity_name = Some(components[3].to_string());
                }
            } else if phase_dir == "phase-4-flourish" {
                metadata.file_type = "scene_outline".to_string();
                metadata.entity_type = Some("scene_outline".to_string());
            } else if phase_dir == "phase-5-bloom" {
                metadata.file_type = "scene_draft".to_string();
                metadata.entity_type = Some("scene_draft".to_string());
                // Extract chapter_id from ch-XX
                if components.len() >= 4 {
                    metadata.chapter_id = Some(components[3].to_string());
                }
                // Build entity_name from chapter + scene
                if components.len() >= 5 {
                    let scene_name = components[4].strip_suffix(".md").unwrap_or(components[4]);
                    metadata.entity_name = Some(format!("{}-{}", components[3], scene_name));
                }
            } else if phase_dir == "front-matter" {
                metadata.file_type = "front_matter".to_string();
            } else if phase_dir == "back-matter" {
                metadata.file_type = "back_matter".to_string();
            } else if phase_dir == "notes" {
                metadata.file_type = "notes".to_string();
            }
        }

        return metadata;
    }

    // JSON config files
    if rel_path.ends_with(".json") {
        metadata.file_type = "config".to_string();
        return metadata;
    }

    metadata
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classify_character() {
        let m = classify_file("characters/marcus-cole/profile.md");
        assert_eq!(m.file_type, "character");
        assert_eq!(m.entity_name.as_deref(), Some("marcus-cole"));
        assert_eq!(m.entity_type.as_deref(), Some("character"));
        assert!(m.book_id.is_none());
    }

    #[test]
    fn test_classify_scene_draft() {
        let m = classify_file("books/book-01/phase-5-bloom/ch-03/scene-02.md");
        assert_eq!(m.file_type, "scene_draft");
        assert_eq!(m.book_id.as_deref(), Some("book-01"));
        assert_eq!(m.chapter_id.as_deref(), Some("ch-03"));
        assert_eq!(m.entity_name.as_deref(), Some("ch-03-scene-02"));
    }

    #[test]
    fn test_classify_world() {
        let m = classify_file("world/locations/neo-detroit/entry.md");
        assert_eq!(m.file_type, "world");
        assert_eq!(m.entity_name.as_deref(), Some("neo-detroit"));
    }

    #[test]
    fn test_classify_seed() {
        let m = classify_file("books/book-01/phase-1-seed/premise/draft.md");
        assert_eq!(m.file_type, "seed");
        assert_eq!(m.book_id.as_deref(), Some("book-01"));
    }

    #[test]
    fn test_split_frontmatter() {
        let content = "---\ntype: character\nname: Marcus Cole\n---\n\n## Background\nSome text.";
        let (fm, body) = split_frontmatter(content);
        assert!(fm.contains("type: character"));
        assert!(body.contains("## Background"));
    }

    #[test]
    fn test_chunk_file_with_headings() {
        let content = "---\ntype: character\n---\n\n## Background\nLong background text.\n\n## Want\nCharacter wants something.";
        let chunks = chunk_file(content, "characters/test/profile.md");
        assert!(chunks.len() >= 3); // frontmatter + 2 sections
        assert!(chunks[0].section_heading.is_none()); // frontmatter
        assert_eq!(chunks[1].section_heading.as_deref(), Some("## Background"));
        assert_eq!(chunks[2].section_heading.as_deref(), Some("## Want"));
    }

    #[test]
    fn test_sha256() {
        let hash = sha256("hello world");
        assert_eq!(hash.len(), 64);
    }
}
