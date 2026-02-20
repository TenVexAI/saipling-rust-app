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

export interface AgentPlan {
  plan_id: string;
  skills: string[];
  model: string;
  context_files: ContextFileInfo[];
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

export type ModelId = 'claude-haiku-4-5-20241022' | 'claude-sonnet-4-5-20250929' | 'claude-opus-4-20250514';
