use serde::{Deserialize, Serialize};
use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenreMeta {
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubGenre {
    pub id: String,
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Genre {
    pub id: String,
    pub name: String,
    pub sort_order: u32,
    pub description: String,
    pub novel_word_count_min: u64,
    pub novel_word_count_max: u64,
    pub chapter_word_count_min: u64,
    pub chapter_word_count_max: u64,
    pub sub_genres: Vec<SubGenre>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenresConfig {
    pub meta: GenreMeta,
    pub genres: Vec<Genre>,
}

const GENRES_TOML: &str = include_str!("../../data/genres.toml");

pub fn load_genres() -> Result<GenresConfig, AppError> {
    let config: GenresConfig = toml::from_str(GENRES_TOML)
        .map_err(|e| AppError::Config(format!("Failed to parse genres.toml: {}", e)))?;
    Ok(config)
}

#[tauri::command]
pub fn get_genres() -> Result<GenresConfig, AppError> {
    load_genres()
}
