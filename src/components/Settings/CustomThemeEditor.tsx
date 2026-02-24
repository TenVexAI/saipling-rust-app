import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emitTo } from '@tauri-apps/api/event';
import { Minus, X, RotateCcw, ChevronDown } from 'lucide-react';
import { useThemeStore } from '../../stores/themeStore';
import { getConfig, updateConfig } from '../../utils/tauri';

interface ColorField {
  key: string;
  label: string;
  defaultValue: string;
}

type PresetId = 'lightPro' | 'darkPro' | 'highContrast' | 'sepia' | 'nightMode' | 'custom';

const THEME_PRESETS: { id: PresetId; label: string; colors: Record<string, string> }[] = [
  {
    id: 'lightPro',
    label: 'Light Professional',
    colors: {
      '--bg-primary': '#ffffff', '--bg-secondary': '#f8f9fa', '--bg-tertiary': '#f1f3f5',
      '--bg-elevated': '#ffffff', '--bg-sidebar': '#f1f3f5', '--bg-input': '#ffffff',
      '--bg-hover': '#e9ecef', '--bg-active': '#dee2e6', '--bg-selection': '#d0ebff',
      '--text-primary': '#212529', '--text-secondary': '#495057', '--text-tertiary': '#868e96',
      '--text-inverse': '#ffffff',
      '--border-primary': '#dee2e6', '--border-secondary': '#e9ecef', '--border-focus': '#228be6',
      '--accent': '#228be6', '--accent-hover': '#1c7ed6', '--accent-subtle': '#d0ebff',
      '--shadow-sm': '0 1px 2px rgba(0,0,0,0.05)', '--shadow-md': '0 4px 6px rgba(0,0,0,0.07)',
      '--shadow-lg': '0 10px 15px rgba(0,0,0,0.1)',
      '--scrollbar-thumb': '#ced4da', '--scrollbar-track': 'transparent',
      '--logo-stroke': '#212529',
    },
  },
  {
    id: 'darkPro',
    label: 'Dark Professional',
    colors: {
      '--bg-primary': '#151515', '--bg-secondary': '#1a1a1a', '--bg-tertiary': '#222222',
      '--bg-elevated': '#1e1e1e', '--bg-sidebar': '#111111', '--bg-input': '#1e1e1e',
      '--bg-hover': '#2a2a2a', '--bg-active': '#333333', '--bg-selection': '#1a3a5c',
      '--text-primary': '#e9ecef', '--text-secondary': '#adb5bd', '--text-tertiary': '#868e96',
      '--text-inverse': '#151515',
      '--border-primary': '#333333', '--border-secondary': '#2a2a2a', '--border-focus': '#4dabf7',
      '--accent': '#4dabf7', '--accent-hover': '#339af0', '--accent-subtle': '#1a3a5c',
      '--shadow-sm': '0 1px 2px rgba(0,0,0,0.3)', '--shadow-md': '0 4px 6px rgba(0,0,0,0.4)',
      '--shadow-lg': '0 10px 15px rgba(0,0,0,0.5)',
      '--scrollbar-thumb': '#444444', '--scrollbar-track': 'transparent',
      '--logo-stroke': '#ffffff',
    },
  },
  {
    id: 'highContrast',
    label: 'High Contrast',
    colors: {
      '--bg-primary': '#000000', '--bg-secondary': '#0a0a0a', '--bg-tertiary': '#141414',
      '--bg-elevated': '#0a0a0a', '--bg-sidebar': '#000000', '--bg-input': '#0a0a0a',
      '--bg-hover': '#1a1a1a', '--bg-active': '#2a2a2a', '--bg-selection': '#003366',
      '--text-primary': '#ffffff', '--text-secondary': '#e0e0e0', '--text-tertiary': '#b0b0b0',
      '--text-inverse': '#000000',
      '--border-primary': '#555555', '--border-secondary': '#333333', '--border-focus': '#00afff',
      '--accent': '#00afff', '--accent-hover': '#0090dd', '--accent-subtle': '#003366',
      '--shadow-sm': '0 1px 2px rgba(0,0,0,0.5)', '--shadow-md': '0 4px 6px rgba(0,0,0,0.6)',
      '--shadow-lg': '0 10px 15px rgba(0,0,0,0.7)',
      '--scrollbar-thumb': '#666666', '--scrollbar-track': 'transparent',
      '--logo-stroke': '#ffffff',
    },
  },
  {
    id: 'sepia',
    label: 'Sepia',
    colors: {
      '--bg-primary': '#f4ecd8', '--bg-secondary': '#efe5cf', '--bg-tertiary': '#e8dcc4',
      '--bg-elevated': '#f4ecd8', '--bg-sidebar': '#e8dcc4', '--bg-input': '#f4ecd8',
      '--bg-hover': '#e0d4b8', '--bg-active': '#d6caac', '--bg-selection': '#d4c4a0',
      '--text-primary': '#5c4b37', '--text-secondary': '#7a6a56', '--text-tertiary': '#998a76',
      '--text-inverse': '#f4ecd8',
      '--border-primary': '#d6caac', '--border-secondary': '#e0d4b8', '--border-focus': '#8b7355',
      '--accent': '#8b7355', '--accent-hover': '#7a6244', '--accent-subtle': '#e0d4b8',
      '--shadow-sm': '0 1px 2px rgba(92,75,55,0.1)', '--shadow-md': '0 4px 6px rgba(92,75,55,0.12)',
      '--shadow-lg': '0 10px 15px rgba(92,75,55,0.15)',
      '--scrollbar-thumb': '#c4b89c', '--scrollbar-track': 'transparent',
      '--logo-stroke': '#5c4b37',
    },
  },
  {
    id: 'nightMode',
    label: 'Night Mode',
    colors: {
      '--bg-primary': '#1a1b26', '--bg-secondary': '#16161e', '--bg-tertiary': '#1e1f2b',
      '--bg-elevated': '#1e1f2b', '--bg-sidebar': '#13131a', '--bg-input': '#1e1f2b',
      '--bg-hover': '#24253a', '--bg-active': '#2a2b40', '--bg-selection': '#28294a',
      '--text-primary': '#c0caf5', '--text-secondary': '#9aa5ce', '--text-tertiary': '#565f89',
      '--text-inverse': '#1a1b26',
      '--border-primary': '#2a2b40', '--border-secondary': '#24253a', '--border-focus': '#7aa2f7',
      '--accent': '#7aa2f7', '--accent-hover': '#6a92e7', '--accent-subtle': '#28294a',
      '--shadow-sm': '0 1px 2px rgba(0,0,0,0.4)', '--shadow-md': '0 4px 6px rgba(0,0,0,0.5)',
      '--shadow-lg': '0 10px 15px rgba(0,0,0,0.6)',
      '--scrollbar-thumb': '#3b3d57', '--scrollbar-track': 'transparent',
      '--logo-stroke': '#ffffff',
    },
  },
  {
    id: 'custom',
    label: 'Custom (Default)',
    colors: {
      '--bg-primary': '#0a0a0f', '--bg-secondary': '#0e0e16', '--bg-tertiary': '#14141f',
      '--bg-elevated': '#12121c', '--bg-sidebar': '#08080d', '--bg-input': '#12121c',
      '--bg-hover': '#1a1a2a', '--bg-active': '#222235', '--bg-selection': '#1a2a3a',
      '--text-primary': '#e0e0ff', '--text-secondary': '#a0a0cc', '--text-tertiary': '#6a6a8a',
      '--text-inverse': '#0a0a0f',
      '--border-primary': '#2a2a40', '--border-secondary': '#1e1e30', '--border-focus': '#00ffaa',
      '--accent': '#00ffaa', '--accent-hover': '#00dd90', '--accent-subtle': '#0a2a20',
      '--shadow-sm': '0 1px 2px rgba(0,255,170,0.08)', '--shadow-md': '0 4px 6px rgba(0,255,170,0.1)',
      '--shadow-lg': '0 10px 15px rgba(0,255,170,0.12)',
      '--scrollbar-thumb': '#2a2a40', '--scrollbar-track': 'transparent',
      '--logo-stroke': '#ffffff',
    },
  },
];

const COLOR_FIELDS: ColorField[] = [
  { key: '--bg-primary', label: 'Background', defaultValue: '#0a0a0f' },
  { key: '--bg-secondary', label: 'Background Alt', defaultValue: '#0e0e16' },
  { key: '--bg-elevated', label: 'Panels / Cards', defaultValue: '#12121c' },
  { key: '--bg-sidebar', label: 'Sidebar', defaultValue: '#0b0a0b' },
  { key: '--text-primary', label: 'Text', defaultValue: '#e0e0ff' },
  { key: '--text-secondary', label: 'Text Muted', defaultValue: '#a0a0cc' },
  { key: '--accent', label: 'Accent', defaultValue: '#3cf281' },
  { key: '--accent-hover', label: 'Accent Hover', defaultValue: '#00dd90' },
  { key: '--accent-subtle', label: 'Accent Subtle', defaultValue: '#0a2a20' },
  { key: '--border-primary', label: 'Borders', defaultValue: '#2a5a5e' },
  { key: '--logo-stroke', label: 'Logo', defaultValue: '#ffffff' },
];

export function CustomThemeEditor() {
  const setTheme = useThemeStore((s) => s.setTheme);
  const appWindow = getCurrentWindow();
  const [colors, setColors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Apply the custom theme so the editor window itself uses it
    const customDefaults = THEME_PRESETS.find((p) => p.id === 'custom')!.colors;
    getConfig().then((c) => {
      setTheme((c.theme || 'custom') as 'custom');
      const saved = c.custom_theme_colors || {};
      // Merge ALL preset defaults with saved values
      const merged: Record<string, string> = { ...customDefaults, ...saved };
      setColors(merged);
      applyColorsToDocument(merged);
    }).catch(() => {});
  }, [setTheme]);

  const applyColorsToDocument = (c: Record<string, string>) => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(c)) {
      root.style.setProperty(key, value);
    }
  };

  const broadcast = (colors: Record<string, string>) => {
    emitTo('main', 'custom-theme-updated', colors);
    emitTo('help', 'custom-theme-updated', colors).catch(() => {});
  };

  const handleColorChange = (key: string, value: string) => {
    const updated = { ...colors, [key]: value };
    setColors(updated);
    applyColorsToDocument(updated);
    broadcast(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const config = await getConfig();
      const updated = { ...config, custom_theme_colors: colors };
      await updateConfig(updated);
      broadcast(colors);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleReset = () => {
    const defaults = { ...THEME_PRESETS.find((p) => p.id === 'custom')!.colors };
    setColors(defaults);
    applyColorsToDocument(defaults);
    broadcast(defaults);
  };

  return (
    <div
      className="flex flex-col h-screen"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      {/* Custom titlebar */}
      <div
        className="flex items-center justify-between shrink-0 select-none"
        data-tauri-drag-region
        style={{
          height: '36px',
          backgroundColor: 'var(--bg-sidebar)',
          borderBottom: '1px solid var(--border-primary)',
          padding: '0 8px 0 14px',
        }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }} data-tauri-drag-region>
          Custom Theme Editor
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => appWindow.minimize()}
            className="flex items-center justify-center rounded-sm"
            style={{ width: '28px', height: '24px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => appWindow.close()}
            className="flex items-center justify-center rounded-sm"
            style={{ width: '28px', height: '24px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#c42b1c'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '20px 24px' }}>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: '16px' }}>
          Pick colors for your custom theme. Changes preview live; click Save to persist.
        </p>

        {/* Theme preset dropdown */}
        <div className="flex items-center gap-3" style={{ marginBottom: '20px' }}>
          <label className="text-xs shrink-0" style={{ color: 'var(--text-secondary)', width: '100px' }}>
            Start from
          </label>
          <div className="relative flex-1" style={{ maxWidth: '220px' }}>
            <select
              onChange={(e) => {
                const preset = THEME_PRESETS.find((p) => p.id === e.target.value);
                if (preset) {
                  setColors(preset.colors);
                  applyColorsToDocument(preset.colors);
                  broadcast(preset.colors);
                }
                e.target.value = '';
              }}
              defaultValue=""
              className="w-full rounded-md text-xs appearance-none"
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-primary)',
                padding: '7px 28px 7px 10px',
                cursor: 'pointer',
              }}
            >
              <option value="" disabled>Select a theme preset…</option>
              {THEME_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <ChevronDown
              size={12}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>

        <div className="flex flex-col" style={{ gap: '12px' }}>
          {COLOR_FIELDS.map((field) => (
            <div key={field.key} className="flex items-center gap-3">
              <label className="text-xs shrink-0" style={{ color: 'var(--text-secondary)', width: '100px' }}>
                {field.label}
              </label>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="color"
                  value={colors[field.key] || field.defaultValue}
                  onChange={(e) => handleColorChange(field.key, e.target.value)}
                  style={{
                    width: '32px',
                    height: '32px',
                    border: '2px solid var(--border-primary)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: 'transparent',
                    padding: '2px',
                  }}
                />
                <input
                  type="text"
                  value={colors[field.key] || field.defaultValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(val)) {
                      handleColorChange(field.key, val);
                    }
                  }}
                  className="rounded-md text-xs font-mono"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-primary)',
                    color: 'var(--text-primary)',
                    padding: '6px 10px',
                    width: '90px',
                  }}
                />
                <div
                  className="rounded-md"
                  style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: colors[field.key] || field.defaultValue,
                    border: '1px solid var(--border-primary)',
                    flexShrink: 0,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer actions */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs rounded-md transition-colors"
          style={{
            color: 'var(--text-tertiary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px 10px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
        >
          <RotateCcw size={12} />
          Reset to Defaults
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs font-medium rounded-lg"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--text-inverse)',
            padding: '8px 20px',
            border: 'none',
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
