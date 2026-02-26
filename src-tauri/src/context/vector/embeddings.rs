use async_trait::async_trait;
use crate::error::AppError;

/// Provider-agnostic embedding client trait.
/// Allows swapping Voyage for another provider without touching calling code.
#[async_trait]
pub trait EmbeddingClient: Send + Sync {
    /// Embed a batch of text chunks. Returns one vector per input.
    async fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, AppError>;

    /// Embed a single query. May use a different input_type for queries vs documents.
    async fn embed_query(&self, query: &str) -> Result<Vec<f32>, AppError>;

    /// Returns the dimensionality of the embedding vectors.
    #[allow(dead_code)]
    fn dimensions(&self) -> usize;

    /// Returns the cost per million tokens for logging.
    fn cost_per_million_tokens(&self) -> f64;
}

/// Voyage AI embedding client
pub struct VoyageClient {
    api_key: String,
    model: String,
    http_client: reqwest::Client,
}

impl VoyageClient {
    pub fn new(api_key: String, model: String) -> Self {
        Self {
            api_key,
            model,
            http_client: reqwest::Client::new(),
        }
    }
}

#[async_trait]
impl EmbeddingClient for VoyageClient {
    async fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, AppError> {
        if texts.is_empty() {
            return Ok(Vec::new());
        }

        let body = serde_json::json!({
            "model": self.model,
            "input": texts,
            "input_type": "document"
        });

        let resp = self.http_client
            .post("https://api.voyageai.com/v1/embeddings")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Embedding(format!("Voyage API request failed: {}", e)))?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            return Err(AppError::Embedding(format!(
                "Voyage API error ({}): {}",
                status, error_body
            )));
        }

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| AppError::Embedding(format!("Failed to parse Voyage response: {}", e)))?;

        let data = json
            .get("data")
            .and_then(|d| d.as_array())
            .ok_or_else(|| AppError::Embedding("Missing 'data' array in Voyage response".into()))?;

        let mut embeddings = Vec::with_capacity(data.len());
        for item in data {
            let embedding = item
                .get("embedding")
                .and_then(|e| e.as_array())
                .ok_or_else(|| AppError::Embedding("Missing 'embedding' in response item".into()))?
                .iter()
                .filter_map(|v| v.as_f64().map(|f| f as f32))
                .collect::<Vec<f32>>();
            embeddings.push(embedding);
        }

        Ok(embeddings)
    }

    async fn embed_query(&self, query: &str) -> Result<Vec<f32>, AppError> {
        let body = serde_json::json!({
            "model": self.model,
            "input": [query],
            "input_type": "query"
        });

        let resp = self.http_client
            .post("https://api.voyageai.com/v1/embeddings")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Embedding(format!("Voyage API request failed: {}", e)))?;

        let status = resp.status();
        if !status.is_success() {
            let error_body = resp.text().await.unwrap_or_default();
            return Err(AppError::Embedding(format!(
                "Voyage API error ({}): {}",
                status, error_body
            )));
        }

        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| AppError::Embedding(format!("Failed to parse Voyage response: {}", e)))?;

        let embedding = json
            .pointer("/data/0/embedding")
            .and_then(|e| e.as_array())
            .ok_or_else(|| AppError::Embedding("Missing embedding in Voyage response".into()))?
            .iter()
            .filter_map(|v| v.as_f64().map(|f| f as f32))
            .collect::<Vec<f32>>();

        Ok(embedding)
    }

    fn dimensions(&self) -> usize {
        1024
    }

    fn cost_per_million_tokens(&self) -> f64 {
        0.06
    }
}

/// Serialize a Vec<f32> embedding into bytes (little-endian f32s) for SQLite BLOB storage.
pub fn embedding_to_bytes(embedding: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(embedding.len() * 4);
    for &val in embedding {
        bytes.extend_from_slice(&val.to_le_bytes());
    }
    bytes
}

/// Deserialize bytes (little-endian f32s) back into a Vec<f32> embedding.
pub fn bytes_to_embedding(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks_exact(4)
        .map(|chunk| {
            let arr: [u8; 4] = [chunk[0], chunk[1], chunk[2], chunk[3]];
            f32::from_le_bytes(arr)
        })
        .collect()
}

/// Compute cosine similarity between two vectors.
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let mut dot = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;
    for i in 0..a.len() {
        dot += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }
    let denom = norm_a.sqrt() * norm_b.sqrt();
    if denom == 0.0 {
        0.0
    } else {
        dot / denom
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_embedding_roundtrip() {
        let original = vec![1.0f32, -0.5, 0.25, 3.14];
        let bytes = embedding_to_bytes(&original);
        let restored = bytes_to_embedding(&bytes);
        assert_eq!(original, restored);
    }

    #[test]
    fn test_cosine_similarity_identical() {
        let a = vec![1.0, 0.0, 0.0];
        let sim = cosine_similarity(&a, &a);
        assert!((sim - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_cosine_similarity_orthogonal() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![0.0, 1.0, 0.0];
        let sim = cosine_similarity(&a, &b);
        assert!(sim.abs() < 1e-6);
    }
}
