export interface VectorSearchConfig {
  enabled: boolean;
  embedding_model: string;
  embedding_api_key_encrypted: string;
  auto_index: boolean;
  max_results_default: number;
  max_search_tokens_default: number;
}

export interface SearchResult {
  file_path: string;
  section_heading: string | null;
  similarity_score: number;
  content_preview: string;
  token_count: number;
  entity_type: string | null;
  entity_name: string | null;
  book_id: string | null;
}

export interface IndexStatus {
  total_files: number;
  total_chunks: number;
  last_indexed: string | null;
  total_cost_usd: number;
  is_indexing: boolean;
  index_progress: IndexProgress | null;
}

export interface IndexProgress {
  files_processed: number;
  files_total: number;
  current_file: string;
}

export interface SearchResultInfo {
  file_path: string;
  section: string | null;
  similarity_score: number;
  tokens_est: number;
  content_preview: string;
}
