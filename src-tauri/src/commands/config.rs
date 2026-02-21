use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillOverride {
    #[serde(default = "default_auto")]
    pub model: String,
    #[serde(default)]
    pub max_context_tokens: Option<u64>,
}

fn default_auto() -> String {
    "auto".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorConfig {
    pub auto_save_interval_seconds: u32,
    pub show_word_count: bool,
    pub spell_check: bool,
}

impl Default for EditorConfig {
    fn default() -> Self {
        Self {
            auto_save_interval_seconds: 30,
            show_word_count: true,
            spell_check: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub default_temperature: f64,
    pub max_context_tokens: u64,
    pub stream_responses: bool,
    pub approval_mode: String,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            default_temperature: 0.7,
            max_context_tokens: 150000,
            stream_responses: true,
            approval_mode: "smart".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub version: String,
    #[serde(default)]
    pub api_key_encrypted: String,
    pub default_model: String,
    pub projects_root: String,
    pub theme: String,
    pub editor: EditorConfig,
    pub ai: AiConfig,
    #[serde(default)]
    pub skill_overrides: HashMap<String, SkillOverride>,
}

impl Default for AppConfig {
    fn default() -> Self {
        let docs = dirs_next().unwrap_or_else(|| PathBuf::from("."));
        Self {
            version: "1.0.0".to_string(),
            api_key_encrypted: String::new(),
            default_model: "claude-sonnet-4-6".to_string(),
            projects_root: docs.to_string_lossy().to_string(),
            theme: "darkPro".to_string(),
            editor: EditorConfig::default(),
            ai: AiConfig::default(),
            skill_overrides: HashMap::new(),
        }
    }
}

fn dirs_next() -> Option<PathBuf> {
    dirs::document_dir().map(|d| d.join("SAiPLING"))
}

fn config_dir() -> Result<PathBuf, AppError> {
    let docs = dirs::document_dir()
        .ok_or_else(|| AppError::Config("Cannot find Documents directory".into()))?;
    Ok(docs.join("SAiPLING").join(".saipling"))
}

fn config_path() -> Result<PathBuf, AppError> {
    Ok(config_dir()?.join("config.json"))
}

fn ensure_config_dir() -> Result<PathBuf, AppError> {
    let dir = config_dir()?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

#[tauri::command]
pub fn get_config() -> Result<AppConfig, AppError> {
    let path = config_path()?;
    if path.exists() {
        let data = std::fs::read_to_string(&path)?;
        let config: AppConfig = serde_json::from_str(&data)?;
        Ok(config)
    } else {
        Ok(AppConfig::default())
    }
}

#[tauri::command]
pub fn update_config(config: AppConfig) -> Result<(), AppError> {
    ensure_config_dir()?;
    let path = config_path()?;
    let data = serde_json::to_string_pretty(&config)?;
    std::fs::write(&path, data)?;
    Ok(())
}

#[tauri::command]
pub fn set_api_key(key: String) -> Result<(), AppError> {
    let mut config = get_config()?;
    // Simple obfuscation for now — real encryption would use OS keychain
    config.api_key_encrypted = base64_encode(&key);
    update_config(config)?;
    Ok(())
}

#[tauri::command]
pub async fn validate_api_key() -> Result<bool, AppError> {
    let config = get_config()?;
    let key = get_api_key_internal(&config)?;
    if key.is_empty() {
        return Err(AppError::ApiKeyNotSet);
    }

    let client = reqwest::Client::new();
    let res = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&serde_json::json!({
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 1,
            "messages": [{"role": "user", "content": "hi"}]
        }))
        .send()
        .await?;

    let status = res.status().as_u16();
    // 401 = invalid key, 403 = forbidden → key is bad
    // 200 = success, 400/404/429 = key is valid but request issue
    Ok(status != 401 && status != 403)
}

pub fn get_api_key_internal(config: &AppConfig) -> Result<String, AppError> {
    if config.api_key_encrypted.is_empty() {
        return Err(AppError::ApiKeyNotSet);
    }
    base64_decode(&config.api_key_encrypted)
}

fn base64_encode(input: &str) -> String {
    use std::io::Write;
    let mut buf = Vec::new();
    {
        let mut encoder = Base64Encoder::new(&mut buf);
        encoder.write_all(input.as_bytes()).unwrap();
        encoder.finish().unwrap();
    }
    String::from_utf8(buf).unwrap()
}

fn base64_decode(input: &str) -> Result<String, AppError> {
    let bytes = Base64Decoder::decode(input)
        .map_err(|e| AppError::Config(format!("Failed to decode API key: {}", e)))?;
    String::from_utf8(bytes)
        .map_err(|e| AppError::Config(format!("Invalid UTF-8 in API key: {}", e)))
}

// Minimal base64 implementation to avoid adding another crate
struct Base64Encoder<'a> {
    output: &'a mut Vec<u8>,
    buf: [u8; 3],
    buf_len: usize,
}

const B64_CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

impl<'a> Base64Encoder<'a> {
    fn new(output: &'a mut Vec<u8>) -> Self {
        Self { output, buf: [0; 3], buf_len: 0 }
    }
    fn finish(mut self) -> Result<(), std::io::Error> {
        if self.buf_len > 0 {
            self.encode_block();
        }
        Ok(())
    }
    fn encode_block(&mut self) {
        let b = &self.buf;
        let len = self.buf_len;
        let mut out = [b'='; 4];
        out[0] = B64_CHARS[(b[0] >> 2) as usize];
        out[1] = B64_CHARS[((b[0] & 0x03) << 4 | if len > 1 { b[1] >> 4 } else { 0 }) as usize];
        if len > 1 {
            out[2] = B64_CHARS[((b[1] & 0x0f) << 2 | if len > 2 { b[2] >> 6 } else { 0 }) as usize];
        }
        if len > 2 {
            out[3] = B64_CHARS[(b[2] & 0x3f) as usize];
        }
        self.output.extend_from_slice(&out);
        self.buf = [0; 3];
        self.buf_len = 0;
    }
}

impl<'a> std::io::Write for Base64Encoder<'a> {
    fn write(&mut self, data: &[u8]) -> std::io::Result<usize> {
        for &byte in data {
            self.buf[self.buf_len] = byte;
            self.buf_len += 1;
            if self.buf_len == 3 {
                self.encode_block();
            }
        }
        Ok(data.len())
    }
    fn flush(&mut self) -> std::io::Result<()> { Ok(()) }
}

struct Base64Decoder;

impl Base64Decoder {
    fn decode(input: &str) -> Result<Vec<u8>, String> {
        let input = input.trim().as_bytes();
        if input.len() % 4 != 0 {
            return Err("Invalid base64 length".into());
        }
        let mut output = Vec::with_capacity(input.len() * 3 / 4);
        for chunk in input.chunks(4) {
            let vals: Vec<u8> = chunk.iter().map(|&c| Self::char_val(c)).collect();
            output.push((vals[0] << 2) | (vals[1] >> 4));
            if chunk[2] != b'=' {
                output.push((vals[1] << 4) | (vals[2] >> 2));
            }
            if chunk[3] != b'=' {
                output.push((vals[2] << 6) | vals[3]);
            }
        }
        Ok(output)
    }
    fn char_val(c: u8) -> u8 {
        match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => 0,
        }
    }
}
