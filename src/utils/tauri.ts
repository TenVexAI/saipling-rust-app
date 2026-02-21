import { invoke } from '@tauri-apps/api/core';
import type {
  ProjectMetadata, RecentProject, BookMetadata, FileContent, FileEntry,
  WordCountSummary, DraftSnapshot, MatterEntry,
} from '../types/project';
import type { AgentPlan, ContextScope, Message, TokenEstimate } from '../types/ai';

// ─── Project Management ───
export const createProject = (name: string, isSeries: boolean, genre: string | null, description: string | null, directory: string) =>
  invoke<ProjectMetadata>('create_project', { name, isSeries, genre, description, directory });

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
export const createBook = (projectDir: string, title: string) =>
  invoke<BookMetadata>('create_book', { projectDir, title });

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

export const agentQuick = (projectDir: string, skill: string, scope: ContextScope, selectedText: string | null, action: string, message: string) =>
  invoke<string>('agent_quick', { projectDir, skill, scope, selectedText, action, message });

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
}

export const getConfig = () =>
  invoke<AppConfig>('get_config');

export const updateConfig = (config: AppConfig) =>
  invoke<void>('update_config', { config });

export const setApiKey = (key: string) =>
  invoke<void>('set_api_key', { key });

export const validateApiKey = () =>
  invoke<boolean>('validate_api_key');

// ─── File Watcher ───
export const startFileWatcher = (projectDir: string) =>
  invoke<void>('start_file_watcher', { projectDir });

// ─── Export ───
export const exportBook = (projectDir: string, bookId: string, format: string, options: Record<string, unknown>, outputPath: string) =>
  invoke<string>('export_book', { projectDir, bookId, format, options, outputPath });
