import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emitTo } from '@tauri-apps/api/event';
import { Minus, X, RotateCcw } from 'lucide-react';
import { useThemeStore } from '../../stores/themeStore';
import { getConfig, updateConfig } from '../../utils/tauri';

interface ColorField {
  key: string;
  label: string;
  defaultValue: string;
}

const COLOR_FIELDS: ColorField[] = [
  { key: '--bg-primary', label: 'Background', defaultValue: '#0a0a0f' },
  { key: '--bg-secondary', label: 'Background Alt', defaultValue: '#0e0e16' },
  { key: '--bg-elevated', label: 'Panels / Cards', defaultValue: '#12121c' },
  { key: '--bg-sidebar', label: 'Sidebar', defaultValue: '#0b0a0b' },
  { key: '--text-primary', label: 'Text', defaultValue: '#e0e0ff' },
  { key: '--text-secondary', label: 'Text Muted', defaultValue: '#a0a0cc' },
  { key: '--accent', label: 'Accent', defaultValue: '#00ffaa' },
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
    getConfig().then((c) => {
      setTheme((c.theme || 'custom') as 'custom');
      const saved = c.custom_theme_colors || {};
      // Merge defaults with saved values
      const merged: Record<string, string> = {};
      for (const f of COLOR_FIELDS) {
        merged[f.key] = saved[f.key] || f.defaultValue;
      }
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
    const defaults: Record<string, string> = {};
    for (const f of COLOR_FIELDS) {
      defaults[f.key] = f.defaultValue;
    }
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
        <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: '20px' }}>
          Pick colors for your custom theme. Changes preview live; click Save to persist.
        </p>

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
