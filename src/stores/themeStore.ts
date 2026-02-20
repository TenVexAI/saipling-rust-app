import { create } from 'zustand';
import type { ThemeId } from '../types/theme';

interface ThemeState {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'darkPro',
  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
}));
