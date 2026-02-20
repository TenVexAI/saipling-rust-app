// Token estimation using tiktoken-rs

use crate::error::AppError;

pub fn estimate_tokens(text: &str) -> Result<usize, AppError> {
    // Use cl100k_base encoding (closest to Claude's tokenizer)
    let bpe = tiktoken_rs::cl100k_base()
        .map_err(|e| AppError::General(format!("Failed to initialize tokenizer: {}", e)))?;
    Ok(bpe.encode_with_special_tokens(text).len())
}

pub fn estimate_cost(input_tokens: u64, output_tokens: u64, model: &str) -> f64 {
    // Pricing per million tokens (approximate as of early 2026)
    let (input_rate, output_rate) = match model {
        m if m.contains("haiku") => (0.25, 1.25),
        m if m.contains("sonnet") => (3.0, 15.0),
        m if m.contains("opus") => (15.0, 75.0),
        _ => (3.0, 15.0), // Default to Sonnet pricing
    };
    (input_tokens as f64 * input_rate + output_tokens as f64 * output_rate) / 1_000_000.0
}

pub fn format_cost(cost: f64) -> String {
    if cost < 0.01 {
        format!("${:.4}", cost)
    } else {
        format!("${:.2}", cost)
    }
}
