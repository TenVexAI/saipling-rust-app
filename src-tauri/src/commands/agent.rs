use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};
use once_cell::sync::Lazy;
use crate::error::AppError;
use crate::commands::config::{get_config, get_api_key_internal};
use crate::context::skills::{load_skill, list_skills, SkillMeta};
use crate::context::assembler::assemble_context;
use crate::context::tokens::{estimate_tokens, estimate_cost, format_cost};
use crate::agent::claude::{stream_claude, ClaudeMessage};

// ─── Resolve effective model for a skill (override → config default → skill default) ───

fn resolve_skill_model(skill_name: &str, skill_default_model: &str) -> String {
    let config = match get_config() {
        Ok(c) => c,
        Err(_) => return skill_default_model.to_string(),
    };
    if let Some(ov) = config.skill_overrides.get(skill_name) {
        if ov.model != "auto" && !ov.model.is_empty() {
            return ov.model.clone();
        }
    }
    config.default_model
}

fn resolve_skill_max_tokens(skill_name: &str, skill_default: u64) -> u64 {
    if let Ok(config) = get_config() {
        if let Some(ov) = config.skill_overrides.get(skill_name) {
            if let Some(max_tokens) = ov.max_context_tokens {
                return max_tokens;
            }
        }
    }
    skill_default
}

// ─── Shared state for plans and cancellation ───

#[derive(Debug, Clone)]
#[allow(dead_code)]
struct PlanState {
    skill_name: String,
    project_dir: PathBuf,
    scope: ContextScope,
    system_prompt: String,
    model: String,
    temperature: f64,
}

static ACTIVE_PLANS: Lazy<Mutex<HashMap<String, PlanState>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

static CANCEL_FLAGS: Lazy<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

// ─── Data types ───

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
    pub mode: String,
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
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenEstimate {
    pub system_tokens: u64,
    pub context_tokens: u64,
    pub total_tokens: u64,
    pub estimated_cost: String,
}

// ─── Helpers ───

/// Resolve the skills directory (built-in skills bundled with the app)
fn skills_dir() -> PathBuf {
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("skills");
    if dev_path.exists() {
        return dev_path;
    }
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

/// Substitute template variables in a system prompt
fn substitute_prompt_vars(template: &str, project_dir: &PathBuf, scope: &ContextScope) -> String {
    let mut prompt = template.to_string();

    // Genre comes from book.json if a book is in scope
    let genre_context = if let Some(book_id) = &scope.book {
        let book_path = project_dir.join("books").join(book_id).join("book.json");
        std::fs::read_to_string(&book_path)
            .ok()
            .and_then(|data| serde_json::from_str::<serde_json::Value>(&data).ok())
            .and_then(|meta| meta.get("genre").and_then(|g| g.as_str()).filter(|g| !g.is_empty()).map(|g| format!("The story's genre is: {}", g)))
            .unwrap_or_default()
    } else {
        String::new()
    };

    let foundation_context = if let Some(book_id) = &scope.book {
        let path = project_dir.join("books").join(book_id).join("phase-1-seed").join("story-foundation.md");
        std::fs::read_to_string(&path).ok().map(|c| format!("Current story foundation:\n{}", c))
    } else {
        let path = project_dir.join("overview").join("overview.md");
        std::fs::read_to_string(&path).ok().map(|c| format!("Project overview:\n{}", c))
    }.unwrap_or_default();

    // POV and tense now come from book.json settings
    let (pov, tense, style_notes) = if let Some(book_id) = &scope.book {
        let book_path = project_dir.join("books").join(book_id).join("book.json");
        std::fs::read_to_string(&book_path)
            .ok()
            .and_then(|data| serde_json::from_str::<serde_json::Value>(&data).ok())
            .map(|meta| {
                let pov = meta.pointer("/settings/pov").and_then(|v| v.as_str()).filter(|s| !s.is_empty()).unwrap_or("third person limited").to_string();
                let tense = meta.pointer("/settings/tense").and_then(|v| v.as_str()).filter(|s| !s.is_empty()).unwrap_or("past").to_string();
                let notes = meta.pointer("/settings/writing_style_notes").and_then(|v| v.as_str()).unwrap_or("").to_string();
                (pov, tense, notes)
            })
            .unwrap_or_else(|| ("third person limited".into(), "past".into(), String::new()))
    } else {
        ("third person limited".into(), "past".into(), String::new())
    };

    let style_block = format!("POV: {}\nTense: {}\n{}", pov, tense, style_notes);
    prompt = prompt.replace("{genre_context}", &genre_context);
    prompt = prompt.replace("{existing_foundation_context}", &foundation_context);
    prompt = prompt.replace("{writing_style_notes}", &style_block);
    prompt = prompt.replace("{pov}", &pov);
    prompt = prompt.replace("{tense}", &tense);

    prompt
}

// ─── Commands ───

#[tauri::command]
pub async fn agent_plan(
    project_dir: PathBuf,
    intent: String,
    scope: ContextScope,
    message: String,
) -> Result<AgentPlan, AppError> {
    let plan_id = uuid::Uuid::new_v4().to_string();
    let skill_name = if intent.is_empty() { "brainstorm".to_string() } else { intent };
    let skills_path = skills_dir();

    let mut skill_def = load_skill(&skill_name, &skills_path).unwrap_or_else(|_| {
        crate::context::skills::SkillDefinition {
            skill: crate::context::skills::SkillMeta {
                name: "brainstorm".to_string(),
                display_name: "Brainstorm".to_string(),
                description: "Creative brainstorming".to_string(),
                default_model: "claude-sonnet-4-6".to_string(),
                temperature: 0.9,
            },
            context: crate::context::skills::SkillContext {
                always_include: vec![],
                when_book: None,
                optional: None,
                max_context_tokens: 20000,
            },
            system_prompt: crate::context::skills::SkillPrompt {
                template: "You are a creative writing assistant. Help the author brainstorm ideas.".to_string(),
            },
        }
    });

    // Apply max_context_tokens override if set
    skill_def.context.max_context_tokens = resolve_skill_max_tokens(&skill_name, skill_def.context.max_context_tokens);

    // Assemble context using the skill definition
    let assembled = assemble_context(
        &skill_def,
        &project_dir,
        scope.book.as_deref(),
        scope.chapter.as_deref(),
        scope.scene.as_deref(),
    )?;

    let context_files: Vec<ContextFileInfo> = assembled.files_loaded.iter().map(|f| {
        ContextFileInfo {
            path: f.path.clone(),
            mode: f.mode.clone(),
            tokens_est: f.tokens,
        }
    }).collect();

    // Resolve effective model: skill override → config default → skill default
    let preferred_model = resolve_skill_model(&skill_name, &skill_def.skill.default_model);

    // Substitute template variables in the system prompt
    let system_prompt = substitute_prompt_vars(&assembled.system_prompt, &project_dir, &scope);
    let total_tokens = estimate_tokens(&system_prompt).unwrap_or(system_prompt.len() / 4) as u64;
    let cost = estimate_cost(total_tokens, 4096, &preferred_model);

    // Store the plan state so agent_execute can retrieve it
    let plan_state = PlanState {
        skill_name: skill_def.skill.name.clone(),
        project_dir: project_dir.clone(),
        scope: scope.clone(),
        system_prompt,
        model: preferred_model.clone(),
        temperature: skill_def.skill.temperature,
    };

    if let Ok(mut plans) = ACTIVE_PLANS.lock() {
        plans.insert(plan_id.clone(), plan_state);
    }

    // Create a cancellation flag for this plan
    if let Ok(mut flags) = CANCEL_FLAGS.lock() {
        flags.insert(plan_id.clone(), Arc::new(AtomicBool::new(false)));
    }

    Ok(AgentPlan {
        plan_id,
        skills: vec![skill_def.skill.name],
        model: preferred_model,
        context_files,
        total_tokens_est: total_tokens,
        estimated_cost: format!("~{}", format_cost(cost)),
        approach: format!("Using {} skill to process: {}", skill_def.skill.display_name, message),
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

    // Retrieve the plan state
    let plan_state = ACTIVE_PLANS.lock()
        .ok()
        .and_then(|plans| plans.get(&plan_id).cloned())
        .ok_or_else(|| AppError::AgentError(format!("Plan {} not found — it may have expired", plan_id)))?;

    // Get the cancellation flag
    let cancel_flag = CANCEL_FLAGS.lock()
        .ok()
        .and_then(|flags| flags.get(&plan_id).cloned());

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
        &plan_state.model,
        &plan_state.system_prompt,
        messages,
        Some(plan_state.temperature),
        &plan_id,
        cancel_flag,
    )
    .await;

    // Clean up plan state
    if let Ok(mut plans) = ACTIVE_PLANS.lock() {
        plans.remove(&plan_id);
    }
    if let Ok(mut flags) = CANCEL_FLAGS.lock() {
        flags.remove(&plan_id);
    }

    result.map(|r| r.text)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickResult {
    pub text: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub model: String,
    pub cost: f64,
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
) -> Result<QuickResult, AppError> {
    let config = get_config()?;
    let api_key = get_api_key_internal(&config)?;
    if api_key.is_empty() {
        return Err(AppError::ApiKeyNotSet);
    }

    let skills_path = skills_dir();
    let mut skill_def = load_skill(&skill, &skills_path)?;
    skill_def.context.max_context_tokens = resolve_skill_max_tokens(&skill, skill_def.context.max_context_tokens);

    let assembled = assemble_context(
        &skill_def,
        &project_dir,
        scope.book.as_deref(),
        scope.chapter.as_deref(),
        scope.scene.as_deref(),
    )?;

    let system_prompt = substitute_prompt_vars(&assembled.system_prompt, &project_dir, &scope);

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

    let preferred_model = resolve_skill_model(&skill, &skill_def.skill.default_model);

    let result = stream_claude(
        &app,
        &api_key,
        &preferred_model,
        &system_prompt,
        messages,
        Some(skill_def.skill.temperature),
        &conversation_id,
        None,
    )
    .await?;

    let cost = estimate_cost(result.input_tokens, result.output_tokens, &result.model);

    Ok(QuickResult {
        text: result.text,
        input_tokens: result.input_tokens,
        output_tokens: result.output_tokens,
        model: result.model,
        cost,
    })
}

#[tauri::command]
pub fn agent_cancel(conversation_id: String) -> Result<(), AppError> {
    if let Ok(flags) = CANCEL_FLAGS.lock() {
        if let Some(flag) = flags.get(&conversation_id) {
            flag.store(true, Ordering::Relaxed);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn estimate_context_tokens(
    project_dir: PathBuf,
    skill: String,
    scope: ContextScope,
) -> Result<TokenEstimate, AppError> {
    let skills_path = skills_dir();
    let skill_def = load_skill(&skill, &skills_path).ok().map(|mut sd| {
        sd.context.max_context_tokens = resolve_skill_max_tokens(&skill, sd.context.max_context_tokens);
        sd
    });

    // Use the assembler to get actual context
    let assembled = if let Some(ref sd) = skill_def {
        assemble_context(sd, &project_dir, scope.book.as_deref(), scope.chapter.as_deref(), scope.scene.as_deref()).ok()
    } else {
        None
    };

    let context_tokens = assembled.as_ref().map(|a| a.total_tokens).unwrap_or(0);
    let system_tokens = skill_def.as_ref()
        .map(|s| estimate_tokens(&s.system_prompt.template).unwrap_or(s.system_prompt.template.len() / 4) as u64)
        .unwrap_or(200);

    let total = system_tokens + context_tokens;
    let skill_default = skill_def.as_ref().map(|s| s.skill.default_model.as_str()).unwrap_or("claude-sonnet-4-6");
    let preferred_model = resolve_skill_model(&skill, skill_default);
    let cost = estimate_cost(total, 4096, &preferred_model);

    Ok(TokenEstimate {
        system_tokens,
        context_tokens,
        total_tokens: total,
        estimated_cost: format!("~{}", format_cost(cost)),
    })
}

#[tauri::command]
pub fn list_available_skills() -> Result<Vec<SkillMeta>, AppError> {
    let skills_path = skills_dir();
    list_skills(&skills_path)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillSettingsEntry {
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub default_model: String,
    pub effective_model: String,
    pub default_max_context_tokens: u64,
    pub effective_max_context_tokens: u64,
    pub temperature: f64,
}

#[tauri::command]
pub fn get_skill_settings() -> Result<Vec<SkillSettingsEntry>, AppError> {
    let skills_path = skills_dir();
    let skills = list_skills(&skills_path)?;
    let config = get_config().unwrap_or_default();

    let mut entries = Vec::new();
    for skill_meta in &skills {
        // Load full skill definition to get max_context_tokens
        let skill_def = load_skill(&skill_meta.name, &skills_path).ok();
        let default_max_tokens = skill_def.as_ref().map(|s| s.context.max_context_tokens).unwrap_or(20000);

        let ov = config.skill_overrides.get(&skill_meta.name);
        let effective_model = if let Some(ov) = ov {
            if ov.model != "auto" && !ov.model.is_empty() {
                ov.model.clone()
            } else {
                config.default_model.clone()
            }
        } else {
            config.default_model.clone()
        };
        let effective_max_tokens = ov
            .and_then(|o| o.max_context_tokens)
            .unwrap_or(default_max_tokens);

        entries.push(SkillSettingsEntry {
            name: skill_meta.name.clone(),
            display_name: skill_meta.display_name.clone(),
            description: skill_meta.description.clone(),
            default_model: skill_meta.default_model.clone(),
            effective_model,
            default_max_context_tokens: default_max_tokens,
            effective_max_context_tokens: effective_max_tokens,
            temperature: skill_meta.temperature,
        });
    }
    Ok(entries)
}
