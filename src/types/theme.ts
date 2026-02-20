export type ThemeId = 'lightPro' | 'darkPro' | 'highContrast' | 'sepia' | 'nightMode';

export interface ThemeInfo {
  id: ThemeId;
  label: string;
  description: string;
}

export const THEMES: ThemeInfo[] = [
  { id: 'lightPro', label: 'Light Professional', description: 'Clean light theme' },
  { id: 'darkPro', label: 'Dark Professional', description: 'Dark, modern' },
  { id: 'highContrast', label: 'High Contrast', description: 'Accessibility-focused' },
  { id: 'sepia', label: 'Sepia', description: 'Warm, paper-like' },
  { id: 'nightMode', label: 'Night Mode', description: 'Blue-tinted dark (Tokyo Night)' },
];
