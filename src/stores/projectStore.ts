import { create } from 'zustand';
import type { ProjectMetadata, BookMetadata, BookRef } from '../types/project';
import type { Phase } from '../types/sapling';
import { updateProjectMetadata } from '../utils/tauri';

export type SidebarView = 'dashboard' | 'files' | 'book' | 'world' | 'characters' | 'notes' | 'settings' | 'skill_settings' | 'phase';

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
  activePhase: Phase | null;
  contextExpandFolder: string | null;
  totalProjectCost: number;

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
  setActivePhase: (phase: Phase | null) => void;
  setContextExpandFolder: (folder: string | null) => void;
  setTotalProjectCost: (cost: number) => void;
  addProjectCost: (cost: number) => void;
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
  activePhase: null,
  contextExpandFolder: null,
  totalProjectCost: 0,

  sidebarExpanded: false,
  rightPanelOpen: true,

  setProject: (project, dir) => {
    const savedId = project.active_book_id;
    const firstBookId = project.books.length > 0 ? project.books[0].id : null;
    const activeId = savedId && project.books.some((b) => b.id === savedId) ? savedId : firstBookId;
    set({
      project,
      projectDir: dir,
      activeView: 'dashboard',
      activeBookId: activeId,
      activeBookMeta: null,
      activeChapterId: null,
      activeSceneId: null,
      activeFilePath: null,
      activePhase: null,
    });
  },

  clearProject: () => set({
    project: null,
    projectDir: null,
    activeView: 'dashboard',
    activeBookId: null,
    activeBookMeta: null,
    activeChapterId: null,
    activeSceneId: null,
    activeFilePath: null,
    activePhase: null,
  }),

  setActiveView: (view) => set({ activeView: view, activeFilePath: null, contextExpandFolder: null, activePhase: null }),
  setActiveBook: (bookId, meta) => {
    set((s) => {
      // Persist active book to project.json
      if (s.project && s.projectDir && bookId !== s.activeBookId) {
        const updated = { ...s.project, active_book_id: bookId };
        updateProjectMetadata(s.projectDir, updated).catch(() => {});
      }
      return {
        activeBookId: bookId,
        activeBookMeta: meta ?? null,
        activeChapterId: null,
        activeSceneId: null,
        project: s.project ? { ...s.project, active_book_id: bookId } : null,
      };
    });
  },
  setActiveChapter: (chapterId) => set({ activeChapterId: chapterId, activeSceneId: null }),
  setActiveScene: (sceneId) => set({ activeSceneId: sceneId }),
  setActiveFile: (path) => set({ activeFilePath: path }),
  setContextExpandFolder: (folder) => set({ contextExpandFolder: folder }),
  setTotalProjectCost: (cost) => set({ totalProjectCost: cost }),
  addProjectCost: (cost) => set((s) => ({ totalProjectCost: s.totalProjectCost + cost })),
  setActivePhase: (phase) => set({ activePhase: phase, activeView: 'phase', activeFilePath: null }),
  toggleSidebar: () => set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  updateBooks: (books) => set((s) => ({
    project: s.project ? { ...s.project, books } : null,
  })),
}));
