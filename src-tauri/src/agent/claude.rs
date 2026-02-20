use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClaudeMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<ClaudeMessage>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
#[allow(dead_code)]
enum StreamEvent {
    #[serde(rename = "message_start")]
    MessageStart { message: MessageStartData },
    #[serde(rename = "content_block_start")]
    ContentBlockStart { index: u32, content_block: ContentBlock },
    #[serde(rename = "content_block_delta")]
    ContentBlockDelta { index: u32, delta: Delta },
    #[serde(rename = "content_block_stop")]
    ContentBlockStop { index: u32 },
    #[serde(rename = "message_delta")]
    MessageDelta { delta: MessageDeltaData, usage: Option<UsageData> },
    #[serde(rename = "message_stop")]
    MessageStop,
    #[serde(rename = "ping")]
    Ping,
    #[serde(rename = "error")]
    Error { error: ErrorData },
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct MessageStartData {
    id: String,
    model: String,
    usage: Option<UsageData>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct ContentBlock {
    #[serde(rename = "type")]
    block_type: String,
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct Delta {
    #[serde(rename = "type")]
    delta_type: String,
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct MessageDeltaData {
    stop_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct UsageData {
    input_tokens: Option<u64>,
    output_tokens: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct ErrorData {
    #[serde(rename = "type")]
    error_type: String,
    message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct StreamChunk {
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct StreamDone {
    pub full_text: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct StreamError {
    pub error: String,
}

/// Call Claude API with streaming, emitting events to the frontend.
pub async fn stream_claude(
    app: &AppHandle,
    api_key: &str,
    model: &str,
    system_prompt: &str,
    messages: Vec<ClaudeMessage>,
    temperature: Option<f64>,
    conversation_id: &str,
) -> Result<String, AppError> {
    let client = Client::new();

    let request = ClaudeRequest {
        model: model.to_string(),
        max_tokens: 8192,
        system: system_prompt.to_string(),
        messages,
        stream: true,
        temperature,
    };

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::ApiError(format!("Claude API error {}: {}", status, body)));
    }

    let mut full_text = String::new();
    let mut input_tokens: u64 = 0;
    let mut output_tokens: u64 = 0;
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result?;
        let chunk_str = String::from_utf8_lossy(&chunk);
        buffer.push_str(&chunk_str);

        // Process complete SSE lines
        while let Some(line_end) = buffer.find('\n') {
            let line = buffer[..line_end].trim().to_string();
            buffer = buffer[line_end + 1..].to_string();

            if line.is_empty() || line == "event: ping" {
                continue;
            }

            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" {
                    break;
                }

                if let Ok(event) = serde_json::from_str::<StreamEvent>(data) {
                    match event {
                        StreamEvent::ContentBlockDelta { delta, .. } => {
                            if let Some(text) = delta.text {
                                full_text.push_str(&text);
                                let _ = app.emit(&format!("claude:chunk:{}", conversation_id), StreamChunk {
                                    text,
                                });
                            }
                        }
                        StreamEvent::MessageStart { message } => {
                            if let Some(usage) = message.usage {
                                input_tokens = usage.input_tokens.unwrap_or(0);
                            }
                        }
                        StreamEvent::MessageDelta { usage, .. } => {
                            if let Some(usage) = usage {
                                output_tokens = usage.output_tokens.unwrap_or(0);
                            }
                        }
                        StreamEvent::Error { error } => {
                            let _ = app.emit(&format!("claude:error:{}", conversation_id), StreamError {
                                error: error.message.clone(),
                            });
                            return Err(AppError::ApiError(error.message));
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    let _ = app.emit(&format!("claude:done:{}", conversation_id), StreamDone {
        full_text: full_text.clone(),
        input_tokens,
        output_tokens,
    });

    Ok(full_text)
}
