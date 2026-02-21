// Token estimation using tiktoken-rs

use crate::error::AppError;

pub fn estimate_tokens(text: &str) -> Result<usize, AppError> {
    // Use cl100k_base encoding (closest to Claude's tokenizer)
    let bpe = tiktoken_rs::cl100k_base()
        .map_err(|e| AppError::General(format!("Failed to initialize tokenizer: {}", e)))?;
    Ok(bpe.encode_with_special_tokens(text).len())
}

pub fn estimate_cost(input_tokens: u64, output_tokens: u64, model: &str) -> f64 {
    let (input_rate, output_rate) = crate::commands::models::get_model_rates(model, input_tokens);
    (input_tokens as f64 * input_rate + output_tokens as f64 * output_rate) / 1_000_000.0
}

pub fn format_cost(cost: f64) -> String {
    if cost < 0.01 {
        format!("${:.4}", cost)
    } else {
        format!("${:.2}", cost)
    }
}
