use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use crate::error::AppError;

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

#[tauri::command]
pub async fn agent_plan(
    project_dir: PathBuf,
    intent: String,
    scope: ContextScope,
    message: String,
) -> Result<AgentPlan, AppError> {
    // TODO: Full implementation with context assembly and skill loading
    // For now, return a basic plan structure
    let plan_id = uuid::Uuid::new_v4().to_string();

    Ok(AgentPlan {
        plan_id,
        skills: vec!["brainstorm".to_string()],
        model: "claude-sonnet-4-5-20250929".to_string(),
        context_files: Vec::new(),
        total_tokens_est: 0,
        estimated_cost: "$0.00".to_string(),
        approach: format!("Process intent: {} with message: {}", intent, message),
    })
}

#[tauri::command]
pub async fn agent_execute(
    app: tauri::AppHandle,
    plan_id: String,
    conversation_history: Vec<Message>,
) -> Result<String, AppError> {
    // TODO: Full implementation with streaming Claude API calls
    // Will emit "claude:chunk", "claude:done", "claude:error" events
    let _ = app;
    let _ = plan_id;
    let _ = conversation_history;
    Err(AppError::AgentError("Agent execution not yet implemented. API key and skill system required.".into()))
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
    // TODO: Full implementation for inline quick actions
    let _ = (app, project_dir, skill, scope, selected_text, action, message);
    Err(AppError::AgentError("Quick agent not yet implemented.".into()))
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
    // TODO: Full implementation with tiktoken-rs
    let _ = (project_dir, skill, scope);
    Ok(TokenEstimate {
        system_tokens: 0,
        context_tokens: 0,
        total_tokens: 0,
        estimated_cost: "$0.00".to_string(),
    })
}
