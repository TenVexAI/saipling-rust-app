// Context Assembler — determines which files to load and how
// Full implementation will be built in Phase 7 (AI Agent system)

use std::path::PathBuf;
use crate::error::AppError;
use super::skills::SkillDefinition;

pub struct AssembledContext {
    pub system_prompt: String,
    pub context_block: String,
    pub total_tokens: u64,
    pub files_loaded: Vec<LoadedFile>,
}

pub struct LoadedFile {
    pub path: String,
    pub mode: String, // "full" or "summary"
    pub tokens: u64,
}

pub fn assemble_context(
    _skill: &SkillDefinition,
    _project_dir: &PathBuf,
    _book_id: Option<&str>,
    _chapter_id: Option<&str>,
    _scene_id: Option<&str>,
) -> Result<AssembledContext, AppError> {
    // TODO: Implement full context assembly logic per spec section 6.3
    Ok(AssembledContext {
        system_prompt: String::new(),
        context_block: String::new(),
        total_tokens: 0,
        files_loaded: Vec::new(),
    })
}
