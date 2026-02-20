import { create } from 'zustand';

interface EditorState {
  openFilePath: string | null;
  body: string;
  frontmatter: Record<string, unknown>;
  isDirty: boolean;
  isSaving: boolean;
  wordCount: number;
  focusMode: boolean;

  setOpenFile: (path: string, body: string, frontmatter: Record<string, unknown>) => void;
  setBody: (body: string) => void;
  setFrontmatter: (frontmatter: Record<string, unknown>) => void;
  markSaved: () => void;
  markSaving: () => void;
  setWordCount: (count: number) => void;
  toggleFocusMode: () => void;
  closeFile: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  openFilePath: null,
  body: '',
  frontmatter: {},
  isDirty: false,
  isSaving: false,
  wordCount: 0,
  focusMode: false,

  setOpenFile: (path, body, frontmatter) => set({
    openFilePath: path,
    body,
    frontmatter,
    isDirty: false,
    wordCount: body.split(/\s+/).filter(Boolean).length,
  }),

  setBody: (body) => set({
    body,
    isDirty: true,
    wordCount: body.split(/\s+/).filter(Boolean).length,
  }),

  setFrontmatter: (frontmatter) => set({ frontmatter, isDirty: true }),
  markSaved: () => set({ isDirty: false, isSaving: false }),
  markSaving: () => set({ isSaving: true }),
  setWordCount: (count) => set({ wordCount: count }),
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
  closeFile: () => set({
    openFilePath: null,
    body: '',
    frontmatter: {},
    isDirty: false,
    wordCount: 0,
  }),
}));
