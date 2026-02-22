import { create } from 'zustand';
import type { ThemeId } from '../types/theme';

interface ThemeState {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  applyCustomColors: (colors: Record<string, string>) => void;
  clearCustomColors: () => void;
}

const CUSTOM_COLOR_KEYS = [
  '--bg-primary', '--bg-secondary', '--bg-elevated', '--bg-sidebar',
  '--text-primary', '--text-secondary', '--accent', '--accent-hover',
  '--accent-subtle', '--border-primary', '--logo-stroke',
];

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'darkPro',
  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    // Clear any inline custom color overrides when switching away from custom
    if (theme !== 'custom') {
      for (const key of CUSTOM_COLOR_KEYS) {
        document.documentElement.style.removeProperty(key);
      }
    }
    set({ theme });
  },
  applyCustomColors: (colors) => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(colors)) {
      root.style.setProperty(key, value);
    }
  },
  clearCustomColors: () => {
    for (const key of CUSTOM_COLOR_KEYS) {
      document.documentElement.style.removeProperty(key);
    }
  },
}));
