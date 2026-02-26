export interface ContextScope {
  book?: string;
  chapter?: string;
  scene?: string;
}

export interface ContextFileInfo {
  path: string;
  mode: 'full' | 'summary';
  tokens_est: number;
}

export interface SearchResultInfo {
  file_path: string;
  section: string | null;
  similarity_score: number;
  tokens_est: number;
  content_preview: string;
}

export interface AgentPlan {
  plan_id: string;
  skills: string[];
  model: string;
  context_files: ContextFileInfo[];
  search_results: SearchResultInfo[];
  total_tokens_est: number;
  estimated_cost: string;
  approach: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface TokenEstimate {
  system_tokens: number;
  context_tokens: number;
  total_tokens: number;
  estimated_cost: string;
}

export interface SkillMeta {
  name: string;
  display_name: string;
  description: string;
  default_model: string;
  temperature: number;
}

export interface ApplyBlock {
  target: string;
  action: 'create' | 'replace' | 'append' | 'update_frontmatter';
  section?: string;
  content: string;
  frontmatter?: Record<string, unknown>;
}

export type ApprovalMode = 'always_recommend' | 'smart' | 'always_execute';

export type ModelId = 'claude-opus-4-6' | 'claude-sonnet-4-6' | 'claude-haiku-4-5';

export interface SkillSettingsEntry {
  name: string;
  display_name: string;
  description: string;
  default_model: string;
  effective_model: string;
  default_max_context_tokens: number;
  effective_max_context_tokens: number;
  temperature: number;
}

export interface SkillOverride {
  model: string;
  max_context_tokens?: number;
}

export interface ModelPricingTier {
  input: number;
  output: number;
}

export interface CachePricingTier {
  standard: number;
  long_context?: number;
}

export interface ModelPricing {
  standard: ModelPricingTier;
  long_context?: ModelPricingTier;
  cache_write?: CachePricingTier;
  cache_read?: CachePricingTier;
}

export interface ModelEntry {
  id: string;
  display_name: string;
  description: string;
  max_context: number;
  pricing: ModelPricing;
}

export interface ModelsConfig {
  models: ModelEntry[];
}
