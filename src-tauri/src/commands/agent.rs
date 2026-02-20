use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use crate::error::AppError;
use crate::commands::config::{get_config, get_api_key_internal};
use crate::context::skills::load_skill;
use crate::agent::claude::{stream_claude, ClaudeMessage};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextScope {
    #[serde(default)]
    pub book: Option<String>,
    #[serde(default)]
    pub chapter: Option<String>,
    #[serde(default)]
    pub scene: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextFileInfo {
    pub path: String,
    pub mode: String, // "full" or "summary"
    pub tokens_est: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentPlan {
    pub plan_id: String,
    pub skills: Vec<String>,
    pub model: String,
    pub context_files: Vec<ContextFileInfo>,
    pub total_tokens_est: u64,
    pub estimated_cost: String,
    pub approach: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String, // "user" or "assistant"
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenEstimate {
    pub system_tokens: u64,
    pub context_tokens: u64,
    pub total_tokens: u64,
    pub estimated_cost: String,
}

/// Resolve the skills directory (built-in skills bundled with the app)
fn skills_dir() -> PathBuf {
    // In development, skills are relative to the src-tauri directory
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("skills");
    if dev_path.exists() {
        return dev_path;
    }
    // Fallback: look next to the executable
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let path = dir.join("skills");
            if path.exists() {
                return path;
            }
        }
    }
    dev_path
}

/// Build a system prompt from a skill template, substituting context variables
fn build_system_prompt(
    template: &str,
    project_dir: &PathBuf,
    scope: &ContextScope,
) -> String {
    let mut prompt = template.to_string();

    // Load genre context from project
    let genre_context = if let Ok(data) = std::fs::read_to_string(project_dir.join("project.json")) {
        if let Ok(meta) = serde_json::from_str::<serde_json::Value>(&data) {
            if let Some(genre) = meta.get("genre").and_then(|g| g.as_str()) {
                format!("The story's genre is: {}", genre)
            } else {
                String::new()
            }
        } else {
            String::new()
        }
    } else {
        String::new()
    };

    // Load existing foundation context
    let foundation_context = if let Some(book_id) = &scope.book {
        let path = project_dir.join("books").join(book_id).join("foundation").join("story-foundation.md");
        if let Ok(content) = std::fs::read_to_string(&path) {
            format!("Current story foundation:\n{}", content)
        } else {
            String::new()
        }
    } else {
        let path = project_dir.join("series").join("foundation.md");
        if let Ok(content) = std::fs::read_to_string(&path) {
            format!("Series foundation:\n{}", content)
        } else {
            String::new()
        }
    };

    // Load writing style notes from project settings
    let style_notes = if let Ok(data) = std::fs::read_to_string(project_dir.join("project.json")) {
        if let Ok(meta) = serde_json::from_str::<serde_json::Value>(&data) {
            let pov = meta.pointer("/settings/pov").and_then(|v| v.as_str()).unwrap_or("third person limited");
            let tense = meta.pointer("/settings/tense").and_then(|v| v.as_str()).unwrap_or("past");
            let notes = meta.pointer("/settings/writing_style_notes").and_then(|v| v.as_str()).unwrap_or("");
            format!("POV: {}\nTense: {}\n{}", pov, tense, if notes.is_empty() { "" } else { notes })
        } else {
            String::new()
        }
    } else {
        String::new()
    };

    prompt = prompt.replace("{genre_context}", &genre_context);
    prompt = prompt.replace("{existing_foundation_context}", &foundation_context);
    prompt = prompt.replace("{writing_style_notes}", &style_notes);
    prompt = prompt.replace("{pov}", "third person limited");
    prompt = prompt.replace("{tense}", "past");

    prompt
}

#[tauri::command]
pub async fn agent_plan(
    project_dir: PathBuf,
    intent: String,
    scope: ContextScope,
    message: String,
) -> Result<AgentPlan, AppError> {
    let plan_id = uuid::Uuid::new_v4().to_string();

    // Determine skill from intent or default
    let skill_name = if intent.is_empty() { "brainstorm" } else { &intent };
    let skills_path = skills_dir();
    let (model, _temperature) = if let Ok(skill) = load_skill(skill_name, &skills_path) {
        (skill.skill.default_model.clone(), skill.skill.temperature)
    } else {
        ("claude-sonnet-4-5-20250929".to_string(), 0.7)
    };

    // Gather context files that exist
    let mut context_files = Vec::new();
    let foundation = project_dir.join("series").join("foundation.md");
    if foundation.exists() {
        context_files.push(ContextFileInfo {
            path: foundation.to_string_lossy().to_string(),
            mode: "full".to_string(),
            tokens_est: 500,
        });
    }
    if let Some(book_id) = &scope.book {
        let book_foundation = project_dir.join("books").join(book_id).join("foundation").join("story-foundation.md");
        if book_foundation.exists() {
            context_files.push(ContextFileInfo {
                path: book_foundation.to_string_lossy().to_string(),
                mode: "full".to_string(),
                tokens_est: 1000,
            });
        }
    }

    let total_tokens: u64 = context_files.iter().map(|f| f.tokens_est).sum();

    Ok(AgentPlan {
        plan_id,
        skills: vec![skill_name.to_string()],
        model,
        context_files,
        total_tokens_est: total_tokens,
        estimated_cost: format!("~${:.3}", total_tokens as f64 * 0.000003),
        approach: format!("Using {} skill to process: {}", skill_name, message),
    })
}

#[tauri::command]
pub async fn agent_execute(
    app: tauri::AppHandle,
    plan_id: String,
    conversation_history: Vec<Message>,
) -> Result<String, AppError> {
    let config = get_config()?;
    let api_key = get_api_key_internal(&config)?;
    if api_key.is_empty() {
        return Err(AppError::ApiKeyNotSet);
    }

    // Use brainstorm as default skill for now
    let skills_path = skills_dir();
    let skill = load_skill("brainstorm", &skills_path)
        .unwrap_or_else(|_| {
            // Fallback if skill file not found
            crate::context::skills::SkillDefinition {
                skill: crate::context::skills::SkillMeta {
                    name: "brainstorm".to_string(),
                    display_name: "Brainstorm".to_string(),
                    description: "Creative brainstorming".to_string(),
                    default_model: "claude-sonnet-4-5-20250929".to_string(),
                    temperature: 0.9,
                },
                context: crate::context::skills::SkillContext {
                    always_include: vec![],
                    when_book: None,
                    optional: None,
                    max_context_tokens: 20000,
                },
                system_prompt: crate::context::skills::SkillPrompt {
                    template: "You are a creative writing assistant.".to_string(),
                },
            }
        });

    let system_prompt = &skill.system_prompt.template;
    let messages: Vec<ClaudeMessage> = conversation_history
        .iter()
        .map(|m| ClaudeMessage {
            role: m.role.clone(),
            content: m.content.clone(),
        })
        .collect();

    let result = stream_claude(
        &app,
        &api_key,
        &skill.skill.default_model,
        system_prompt,
        messages,
        Some(skill.skill.temperature),
        &plan_id,
    )
    .await?;

    Ok(result)
}

#[tauri::command]
pub async fn agent_quick(
    app: tauri::AppHandle,
    project_dir: PathBuf,
    skill: String,
    scope: ContextScope,
    selected_text: Option<String>,
    action: String,
    message: String,
) -> Result<String, AppError> {
    let config = get_config()?;
    let api_key = get_api_key_internal(&config)?;
    if api_key.is_empty() {
        return Err(AppError::ApiKeyNotSet);
    }

    let skills_path = skills_dir();
    let skill_def = load_skill(&skill, &skills_path)?;

    let system_prompt = build_system_prompt(&skill_def.system_prompt.template, &project_dir, &scope);

    let mut user_message = format!("Action: {}\n", action);
    if let Some(text) = &selected_text {
        user_message.push_str(&format!("\nSelected text:\n{}\n", text));
    }
    user_message.push_str(&format!("\n{}", message));

    let conversation_id = uuid::Uuid::new_v4().to_string();
    let messages = vec![ClaudeMessage {
        role: "user".to_string(),
        content: user_message,
    }];

    let result = stream_claude(
        &app,
        &api_key,
        &skill_def.skill.default_model,
        &system_prompt,
        messages,
        Some(skill_def.skill.temperature),
        &conversation_id,
    )
    .await?;

    Ok(result)
}

#[tauri::command]
pub fn agent_cancel(conversation_id: String) -> Result<(), AppError> {
    // TODO: Implement cancellation via shared state / CancellationToken
    let _ = conversation_id;
    Ok(())
}

#[tauri::command]
pub fn estimate_context_tokens(
    project_dir: PathBuf,
    skill: String,
    scope: ContextScope,
) -> Result<TokenEstimate, AppError> {
    let skills_path = skills_dir();
    let _ = &scope;

    let skill_def = load_skill(&skill, &skills_path).ok();
    let max_tokens = skill_def.as_ref().map(|s| s.context.max_context_tokens).unwrap_or(30000);

    // Estimate based on context files that exist
    let mut context_tokens: u64 = 0;
    let foundation = project_dir.join("series").join("foundation.md");
    if foundation.exists() {
        if let Ok(content) = std::fs::read_to_string(&foundation) {
            context_tokens += (content.len() as u64) / 4; // rough estimate
        }
    }

    let system_tokens = skill_def
        .as_ref()
        .map(|s| (s.system_prompt.template.len() as u64) / 4)
        .unwrap_or(200);

    let total = system_tokens + context_tokens;

    Ok(TokenEstimate {
        system_tokens,
        context_tokens,
        total_tokens: total.min(max_tokens),
        estimated_cost: format!("~${:.4}", total as f64 * 0.000003),
    })
}
