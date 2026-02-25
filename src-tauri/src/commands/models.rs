use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelPricingTier {
    pub input: f64,
    pub output: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachePricingTier {
    pub standard: f64,
    #[serde(default)]
    pub long_context: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelPricing {
    pub standard: ModelPricingTier,
    #[serde(default)]
    pub long_context: Option<ModelPricingTier>,
    #[serde(default)]
    pub cache_write: Option<CachePricingTier>,
    #[serde(default)]
    pub cache_read: Option<CachePricingTier>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelEntry {
    pub id: String,
    pub display_name: String,
    pub description: String,
    pub max_context: u64,
    pub pricing: ModelPricing,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelsConfig {
    pub models: Vec<ModelEntry>,
}

fn config_dir() -> Result<PathBuf, AppError> {
    let docs = dirs::document_dir()
        .ok_or_else(|| AppError::Config("Cannot find Documents directory".into()))?;
    Ok(docs.join("SAiPLING").join(".saipling"))
}

fn default_models_toml() -> &'static str {
    include_str!("../../defaults/models.toml")
}

/// Ensure the models.toml exists in the config directory.
/// If it doesn't, copy the bundled default.
fn ensure_models_config() -> Result<PathBuf, AppError> {
    let dir = config_dir()?;
    std::fs::create_dir_all(&dir)?;
    let path = dir.join("models.toml");
    if !path.exists() {
        std::fs::write(&path, default_models_toml())?;
    }
    Ok(path)
}

#[tauri::command]
pub fn get_models_config() -> Result<ModelsConfig, AppError> {
    let path = ensure_models_config()?;
    let data = std::fs::read_to_string(&path)?;
    let config: ModelsConfig = toml::from_str(&data)
        .map_err(|e| AppError::Config(format!("Failed to parse models.toml: {}", e)))?;
    Ok(config)
}

#[tauri::command]
pub fn get_models_config_path() -> Result<String, AppError> {
    let path = ensure_models_config()?;
    Ok(path.to_string_lossy().to_string())
}

/// Look up pricing for a model by ID. Returns (input_rate, output_rate) per million tokens.
/// If input_tokens > 200K and the model has long_context pricing, use that tier.
pub fn get_model_rates(model_id: &str, input_tokens: u64) -> (f64, f64) {
    let config = get_models_config().ok();
    let long_context_threshold = 200_000;

    if let Some(config) = config {
        if let Some(model) = config.models.iter().find(|m| m.id == model_id || model_id.starts_with(&m.id)) {
            if input_tokens > long_context_threshold {
                if let Some(ref lc) = model.pricing.long_context {
                    return (lc.input, lc.output);
                }
            }
            return (model.pricing.standard.input, model.pricing.standard.output);
        }
    }

    // Fallback: Sonnet pricing
    (3.0, 15.0)
}
