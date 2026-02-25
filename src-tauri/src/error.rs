use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("TOML error: {0}")]
    Toml(#[from] toml::de::Error),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Project not found: {0}")]
    ProjectNotFound(String),

    #[error("File not found: {0}")]
    FileNotFound(String),

    #[error("Book not found: {0}")]
    BookNotFound(String),

    #[error("Chapter not found: {0}")]
    ChapterNotFound(String),

    #[allow(dead_code)]
    #[error("Scene not found: {0}")]
    SceneNotFound(String),

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("Config error: {0}")]
    Config(String),

    #[error("API key not set")]
    ApiKeyNotSet,

    #[error("API error: {0}")]
    ApiError(String),

    #[error("Agent error: {0}")]
    AgentError(String),

    #[error("Export error: {0}")]
    ExportError(String),

    #[error("{0}")]
    General(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
