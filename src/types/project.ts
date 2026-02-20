export interface ProjectMetadata {
  version: string;
  name: string;
  author: string;
  genre: string;
  created: string;
  modified: string;
  series_phase_progress: Record<string, PhaseProgress>;
  books: BookRef[];
  settings: ProjectSettings;
  directory: string;
}

export interface PhaseProgress {
  status: 'not_started' | 'in_progress' | 'complete';
  completed_at?: string;
  [key: string]: unknown;
}

export interface BookRef {
  id: string;
  title: string;
  sort_order: number;
}

export interface ProjectSettings {
  preferred_model: string;
  writing_style_notes: string;
  pov: string;
  tense: string;
}

export interface RecentProject {
  name: string;
  path: string;
  last_opened: string;
}

export interface BookMetadata {
  version: string;
  id: string;
  title: string;
  sort_order: number;
  created: string;
  modified: string;
  target_word_count: number;
  current_word_count: number;
  phase_progress: Record<string, PhaseProgress>;
  front_matter: Record<string, boolean>;
  back_matter: Record<string, boolean>;
  chapters: ChapterMeta[];
}

export interface ChapterMeta {
  id: string;
  title: string;
  sort_order: number;
  scenes: SceneMeta[];
}

export interface SceneMeta {
  id: string;
  title: string;
  sort_order: number;
  type: 'action' | 'reaction';
  status: 'not_started' | 'outlined' | 'drafted' | 'revised';
  word_count: number;
}

export interface FileContent {
  frontmatter: Record<string, unknown>;
  body: string;
  path: string;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  file_type?: string;
  size?: number;
}

export interface WordCountSummary {
  book_total: number;
  target: number;
  chapters: ChapterWordCount[];
}

export interface ChapterWordCount {
  chapter_id: string;
  chapter_title: string;
  word_count: number;
  scenes: SceneWordCount[];
}

export interface SceneWordCount {
  scene_id: string;
  word_count: number;
}

export interface DraftSnapshot {
  name: string;
  path: string;
  created: string;
  word_count: number;
}

export interface MatterEntry {
  subtype: string;
  path: string;
  exists: boolean;
}
