use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillDefinition {
    pub skill: SkillMeta,
    pub context: SkillContext,
    pub system_prompt: SkillPrompt,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillMeta {
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub default_model: String,
    pub temperature: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillContext {
    #[serde(default)]
    pub always_include: Vec<String>,
    #[serde(default)]
    pub when_book: Option<SkillContextWhen>,
    #[serde(default)]
    pub optional: Option<SkillContextOptional>,
    #[serde(default)]
    pub max_context_tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillContextWhen {
    #[serde(default)]
    pub include: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillContextOptional {
    #[serde(default)]
    pub include_if_exists: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillPrompt {
    pub template: String,
}

pub fn load_skill(skill_name: &str, app_skills_dir: &PathBuf) -> Result<SkillDefinition, AppError> {
    let path = app_skills_dir.join(format!("{}.toml", skill_name));
    if !path.exists() {
        return Err(AppError::FileNotFound(format!("Skill not found: {}", skill_name)));
    }
    let content = std::fs::read_to_string(&path)?;
    let skill: SkillDefinition = toml::from_str(&content)?;
    Ok(skill)
}

pub fn list_skills(app_skills_dir: &PathBuf) -> Result<Vec<SkillMeta>, AppError> {
    let mut skills = Vec::new();
    if !app_skills_dir.exists() {
        return Ok(skills);
    }
    for entry in std::fs::read_dir(app_skills_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().map(|e| e == "toml").unwrap_or(false) {
            if let Ok(content) = std::fs::read_to_string(&path) {
                if let Ok(skill) = toml::from_str::<SkillDefinition>(&content) {
                    skills.push(skill.skill);
                }
            }
        }
    }
    skills.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(skills)
}
