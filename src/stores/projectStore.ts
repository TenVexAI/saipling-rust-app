import { create } from 'zustand';
import type { ProjectMetadata, BookMetadata, BookRef } from '../types/project';

export type SidebarView = 'dashboard' | 'files' | 'book' | 'world' | 'characters' | 'notes' | 'settings';

interface ProjectState {
  // Project
  project: ProjectMetadata | null;
  projectDir: string | null;
  isLoading: boolean;

  // Current context
  activeView: SidebarView;
  activeBookId: string | null;
  activeBookMeta: BookMetadata | null;
  activeChapterId: string | null;
  activeSceneId: string | null;
  activeFilePath: string | null;

  // Sidebar
  sidebarExpanded: boolean;
  rightPanelOpen: boolean;

  // Actions
  setProject: (project: ProjectMetadata, dir: string) => void;
  clearProject: () => void;
  setActiveView: (view: SidebarView) => void;
  setActiveBook: (bookId: string | null, meta?: BookMetadata | null) => void;
  setActiveChapter: (chapterId: string | null) => void;
  setActiveScene: (sceneId: string | null) => void;
  setActiveFile: (path: string | null) => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;
  updateBooks: (books: BookRef[]) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: null,
  projectDir: null,
  isLoading: false,

  activeView: 'dashboard',
  activeBookId: null,
  activeBookMeta: null,
  activeChapterId: null,
  activeSceneId: null,
  activeFilePath: null,

  sidebarExpanded: false,
  rightPanelOpen: true,

  setProject: (project, dir) => set({
    project,
    projectDir: dir,
    activeView: 'dashboard',
    activeBookId: null,
    activeBookMeta: null,
    activeChapterId: null,
    activeSceneId: null,
    activeFilePath: null,
  }),

  clearProject: () => set({
    project: null,
    projectDir: null,
    activeView: 'dashboard',
    activeBookId: null,
    activeBookMeta: null,
    activeChapterId: null,
    activeSceneId: null,
    activeFilePath: null,
  }),

  setActiveView: (view) => set({ activeView: view }),
  setActiveBook: (bookId, meta) => set({
    activeBookId: bookId,
    activeBookMeta: meta ?? null,
    activeChapterId: null,
    activeSceneId: null,
  }),
  setActiveChapter: (chapterId) => set({ activeChapterId: chapterId, activeSceneId: null }),
  setActiveScene: (sceneId) => set({ activeSceneId: sceneId }),
  setActiveFile: (path) => set({ activeFilePath: path }),
  toggleSidebar: () => set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  updateBooks: (books) => set((s) => ({
    project: s.project ? { ...s.project, books } : null,
  })),
}));
