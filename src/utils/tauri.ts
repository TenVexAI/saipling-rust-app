import { invoke } from '@tauri-apps/api/core';
import type {
  ProjectMetadata, RecentProject, BookMetadata, FileContent, FileEntry,
  WordCountSummary, DraftSnapshot, MatterEntry,
} from '../types/project';
import type { AgentPlan, ContextScope, Message, TokenEstimate, ModelsConfig, SkillSettingsEntry, SkillOverride } from '../types/ai';
import type { SearchResult, IndexStatus } from '../types/vectorSearch';

// ─── Project Management ───
export const createProject = (name: string, description: string | null, directory: string) =>
  invoke<ProjectMetadata>('create_project', { name, description, directory });

export const openProject = (directory: string) =>
  invoke<ProjectMetadata>('open_project', { directory });

export const getRecentProjects = () =>
  invoke<RecentProject[]>('get_recent_projects');

export const getProjectMetadata = (projectDir: string) =>
  invoke<ProjectMetadata>('get_project_metadata', { projectDir });

export const updateProjectMetadata = (projectDir: string, metadata: ProjectMetadata) =>
  invoke<void>('update_project_metadata', { projectDir, metadata });

export const deleteProject = (directory: string) =>
  invoke<void>('delete_project', { directory });

// ─── Book Management ───
export const createBook = (
  projectDir: string,
  title: string,
  author: string,
  genreId: string,
  subGenreId: string,
  tense: string,
  perspective: string,
  targetWordCount: number,
) =>
  invoke<BookMetadata>('create_book', { projectDir, title, author, genreId, subGenreId, tense, perspective, targetWordCount });

export const getBookMetadata = (projectDir: string, bookId: string) =>
  invoke<BookMetadata>('get_book_metadata', { projectDir, bookId });

export const updateBookMetadata = (projectDir: string, bookId: string, metadata: BookMetadata) =>
  invoke<void>('update_book_metadata', { projectDir, bookId, metadata });

export const reorderBooks = (projectDir: string, bookIds: string[]) =>
  invoke<void>('reorder_books', { projectDir, bookIds });

// ─── File System ───
export const readFile = (path: string) =>
  invoke<FileContent>('read_file', { path });

export const writeFile = (path: string, frontmatter: Record<string, unknown>, body: string) =>
  invoke<void>('write_file', { path, frontmatter, body });

export const createFromTemplate = (path: string, template: string, variables: Record<string, string>) =>
  invoke<void>('create_from_template', { path, template, variables });

export const listDirectory = (path: string) =>
  invoke<FileEntry[]>('list_directory', { path });

export const createDirectory = (path: string) =>
  invoke<void>('create_directory', { path });

export const renameEntry = (from: string, to: string) =>
  invoke<void>('rename_entry', { from, to });

export const deleteEntry = (path: string) =>
  invoke<void>('delete_entry', { path });

export const revealInExplorer = (path: string) =>
  invoke<void>('reveal_in_explorer', { path });

export const moveEntry = (from: string, to: string) =>
  invoke<void>('move_entry', { from, to });

export const getWordCount = (path: string) =>
  invoke<number>('get_word_count', { path });

export const getBookWordCount = (projectDir: string, bookId: string) =>
  invoke<WordCountSummary>('get_book_word_count', { projectDir, bookId });

export const getBookTotalDocWords = (projectDir: string, bookId: string) =>
  invoke<number>('get_book_total_doc_words', { projectDir, bookId });

export const getProjectTotalDocWords = (projectDir: string) =>
  invoke<number>('get_project_total_doc_words', { projectDir });

// ─── Draft Management ───
export const saveDraft = (path: string, content: string) =>
  invoke<void>('save_draft', { path, content });

export const listDrafts = (sceneDir: string) =>
  invoke<DraftSnapshot[]>('list_drafts', { sceneDir });

export const restoreDraft = (sceneDir: string, snapshotName: string) =>
  invoke<string>('restore_draft', { sceneDir, snapshotName });

// ─── Chapter & Scene Management ───
export const createChapter = (projectDir: string, bookId: string, title: string) =>
  invoke<{ id: string; title: string; sort_order: number; scenes: unknown[] }>('create_chapter', { projectDir, bookId, title });

export const createScene = (projectDir: string, bookId: string, chapterId: string, title: string, sceneType: string) =>
  invoke<{ id: string; title: string; sort_order: number }>('create_scene', { projectDir, bookId, chapterId, title, sceneType });

export const reorderChapters = (projectDir: string, bookId: string, chapterIds: string[]) =>
  invoke<void>('reorder_chapters', { projectDir, bookId, chapterIds });

export const reorderScenes = (projectDir: string, bookId: string, chapterId: string, sceneIds: string[]) =>
  invoke<void>('reorder_scenes', { projectDir, bookId, chapterId, sceneIds });

export const moveScene = (projectDir: string, bookId: string, sceneId: string, fromChapter: string, toChapter: string, position: number) =>
  invoke<void>('move_scene', { projectDir, bookId, sceneId, fromChapter, toChapter, position });

// ─── Front & Back Matter ───
export const createFrontMatter = (projectDir: string, bookId: string, subtype: string) =>
  invoke<string>('create_front_matter', { projectDir, bookId, subtype });

export const createBackMatter = (projectDir: string, bookId: string, subtype: string) =>
  invoke<string>('create_back_matter', { projectDir, bookId, subtype });

export const removeFrontMatter = (projectDir: string, bookId: string, subtype: string) =>
  invoke<void>('remove_front_matter', { projectDir, bookId, subtype });

export const removeBackMatter = (projectDir: string, bookId: string, subtype: string) =>
  invoke<void>('remove_back_matter', { projectDir, bookId, subtype });

export const listFrontMatter = (projectDir: string, bookId: string) =>
  invoke<MatterEntry[]>('list_front_matter', { projectDir, bookId });

export const listBackMatter = (projectDir: string, bookId: string) =>
  invoke<MatterEntry[]>('list_back_matter', { projectDir, bookId });

// ─── Agent / Claude API ───
export const agentPlan = (projectDir: string, intent: string, scope: ContextScope, message: string) =>
  invoke<AgentPlan>('agent_plan', { projectDir, intent, scope, message });

export const agentExecute = (planId: string, conversationHistory: Message[]) =>
  invoke<string>('agent_execute', { planId, conversationHistory });

export interface QuickResult {
  text: string;
  input_tokens: number;
  output_tokens: number;
  model: string;
  cost: number;
}

export const agentQuick = (projectDir: string, skill: string, scope: ContextScope, selectedText: string | null, action: string, message: string) =>
  invoke<QuickResult>('agent_quick', { projectDir, skill, scope, selectedText, action, message });

export const agentCancel = (conversationId: string) =>
  invoke<void>('agent_cancel', { conversationId });

export const estimateContextTokens = (projectDir: string, skill: string, scope: ContextScope) =>
  invoke<TokenEstimate>('estimate_context_tokens', { projectDir, skill, scope });

export const listAvailableSkills = () =>
  invoke<import('../types/ai').SkillMeta[]>('list_available_skills');

// ─── Configuration ───
export interface AppConfig {
  version: string;
  api_key_encrypted: string;
  default_model: string;
  projects_root: string;
  theme: string;
  editor: {
    auto_save_interval_seconds: number;
    show_word_count: boolean;
    spell_check: boolean;
  };
  ai: {
    default_temperature: number;
    max_context_tokens: number;
    stream_responses: boolean;
    approval_mode: string;
  };
  skill_overrides: Record<string, SkillOverride>;
  custom_theme_colors: Record<string, string>;
  vector_search: {
    enabled: boolean;
    embedding_model: string;
    embedding_api_key_encrypted: string;
    auto_index: boolean;
    max_results_default: number;
    max_search_tokens_default: number;
  };
}

export const getConfig = () =>
  invoke<AppConfig>('get_config');

export const updateConfig = (config: AppConfig) =>
  invoke<void>('update_config', { config });

export const setApiKey = (key: string) =>
  invoke<void>('set_api_key', { key });

export const validateApiKey = () =>
  invoke<boolean>('validate_api_key');

// ─── Models Config ───

export const getModelsConfig = () =>
  invoke<ModelsConfig>('get_models_config');

export const getModelsConfigPath = () =>
  invoke<string>('get_models_config_path');

// ─── Skill Settings ───
export const getSkillSettings = () =>
  invoke<SkillSettingsEntry[]>('get_skill_settings');

// ─── Genres ───
export interface SubGenre {
  id: string;
  name: string;
  description: string;
}

export interface Genre {
  id: string;
  name: string;
  sort_order: number;
  description: string;
  novel_word_count_min: number;
  novel_word_count_max: number;
  chapter_word_count_min: number;
  chapter_word_count_max: number;
  sub_genres: SubGenre[];
}

export interface GenresConfig {
  meta: { version: string };
  genres: Genre[];
}

export const getGenres = () =>
  invoke<GenresConfig>('get_genres');

// ─── File Watcher ───
export const startFileWatcher = (projectDir: string) =>
  invoke<void>('start_file_watcher', { projectDir });

// ─── Vector Search ───

export const vectorSearch = (
  projectDir: string,
  query: string,
  maxResults?: number,
  filterEntityTypes?: string[],
  filterBookId?: string,
  respectContextSettings?: boolean,
) => invoke<SearchResult[]>('vector_search', {
  projectDir, query, maxResults, filterEntityTypes, filterBookId,
  respectContextSettings: respectContextSettings ?? true,
});

export const getIndexStatus = (projectDir: string) =>
  invoke<IndexStatus>('get_index_status', { projectDir });

export const reindexProject = (projectDir: string) =>
  invoke<void>('reindex_project', { projectDir });

export const clearIndex = (projectDir: string) =>
  invoke<void>('clear_index', { projectDir });

// ─── Templates ───

export const loadTemplate = (
  projectDir: string,
  templateName: string,
  variables: Record<string, string> = {},
) => invoke<string>('load_template', { projectDir, templateName, variables });

export const listTemplates = () =>
  invoke<string[]>('list_templates');

// ─── Export ───
export const exportBook = (projectDir: string, bookId: string, format: string, options: Record<string, unknown>, outputPath: string) =>
  invoke<string>('export_book', { projectDir, bookId, format, options, outputPath });
