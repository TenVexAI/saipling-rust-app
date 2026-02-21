import { useState, useEffect } from 'react';
import { Key, Check, Loader2, Palette, Info, Bot, Pencil, Zap, ChevronRight } from 'lucide-react';
import { emit } from '@tauri-apps/api/event';
import { useThemeStore } from '../../stores/themeStore';
import { THEMES } from '../../types/theme';
import { getConfig, setApiKey, validateApiKey, updateConfig, getModelsConfig, getModelsConfigPath, type AppConfig } from '../../utils/tauri';
import { openHelpWindow } from '../../utils/helpWindow';
import { setModelsConfig } from '../../utils/modelPricing';
import { useProjectStore } from '../../stores/projectStore';
import type { ModelEntry } from '../../types/ai';

export function SettingsView() {
  const { theme, setTheme } = useThemeStore();
  const setActiveView = useProjectStore((s) => s.setActiveView);
  const [apiKey, setApiKeyInput] = useState('');
  const [keyStatus, setKeyStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [hasKey, setHasKey] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [models, setModels] = useState<ModelEntry[]>([]);

  useEffect(() => {
    getConfig().then((c) => {
      setConfig(c);
      setHasKey(!!c.api_key_encrypted);
      setTheme(c.theme as typeof theme);
    }).catch(() => { /* config may not exist yet */ });
    getModelsConfig().then((mc) => {
      setModels(mc.models);
      setModelsConfig(mc);
    }).catch(() => {});
  }, [setTheme]);

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    setKeyStatus('validating');
    try {
      await setApiKey(apiKey.trim());
      const valid = await validateApiKey();
      if (valid) {
        setKeyStatus('valid');
        setHasKey(true);
        setApiKeyInput('');
      } else {
        setKeyStatus('invalid');
      }
    } catch {
      setKeyStatus('invalid');
    }
  };

  const handleThemeChange = async (themeId: typeof theme) => {
    setTheme(themeId);
    emit('theme-changed', { theme: themeId }).catch(() => {});
    if (config) {
      const updated = { ...config, theme: themeId };
      setConfig(updated);
      try { await updateConfig(updated); } catch { /* ignore */ }
    }
  };

  return (
    <div className="overflow-y-auto h-full relative" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-2xl" style={{ padding: '32px 40px' }}>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', marginBottom: '32px' }}>
          Settings
        </h1>

        {/* API Key */}
        <section style={{ marginBottom: '40px' }}>
          <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            <Key size={16} />
            Anthropic API Key
            <button
              onClick={() => openHelpWindow('api-key-how-to-get')}
              className="ml-1 flex items-center justify-center rounded-full transition-colors"
              style={{ color: 'var(--text-tertiary)', width: '20px', height: '20px', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
              title="How to get an API key"
            >
              <Info size={14} />
            </button>
          </h2>
          {hasKey && keyStatus !== 'invalid' ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-success)' }}>
              <Check size={16} />
              API key configured
              <button
                onClick={() => setHasKey(false)}
                className="ml-2 text-xs underline"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Change
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKeyInput(e.target.value); setKeyStatus('idle'); }}
                placeholder="sk-ant-..."
                className="flex-1 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: `1px solid ${keyStatus === 'invalid' ? 'var(--color-error)' : 'var(--border-primary)'}`,
                  color: 'var(--text-primary)',
                  padding: '8px 12px',
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
              />
              <button
                onClick={handleSaveKey}
                disabled={keyStatus === 'validating' || !apiKey.trim()}
                className="rounded-lg text-sm font-medium flex items-center gap-2"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--text-inverse)',
                  opacity: keyStatus === 'validating' || !apiKey.trim() ? 0.6 : 1,
                  padding: '8px 16px',
                }}
              >
                {keyStatus === 'validating' ? <Loader2 size={14} className="animate-spin" /> : null}
                {keyStatus === 'validating' ? 'Validating...' : 'Save'}
              </button>
            </div>
          )}
          {keyStatus === 'invalid' && (
            <p className="text-xs" style={{ color: 'var(--color-error)', marginTop: '8px' }}>
              Invalid API key. Please check and try again.
            </p>
          )}
        </section>

        {/* Preferred Model */}
        <section style={{ marginBottom: '40px' }}>
          <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            <Bot size={16} />
            Preferred Model
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={config?.default_model || 'claude-sonnet-4-6'}
              onChange={async (e) => {
                if (!config) return;
                const updated = { ...config, default_model: e.target.value };
                setConfig(updated);
                try { await updateConfig(updated); } catch { /* ignore */ }
              }}
              className="flex-1 rounded-lg text-sm"
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                appearance: 'auto',
              }}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name} — {m.description}
                </option>
              ))}
              {models.length === 0 && (
                <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
              )}
            </select>
            <button
              onClick={async () => {
                try {
                  const path = await getModelsConfigPath();
                  const { revealInExplorer } = await import('../../utils/tauri');
                  await revealInExplorer(path);
                } catch (e) {
                  console.error('Failed to open models config:', e);
                }
              }}
              className="flex items-center justify-center rounded-lg transition-colors shrink-0"
              style={{
                color: 'var(--text-tertiary)',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-primary)',
                padding: '8px',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
              title="Edit models.toml — add models or update pricing"
            >
              <Pencil size={14} />
            </button>
          </div>
          {/* Pricing display */}
          {(() => {
            const selected = models.find((m) => m.id === (config?.default_model || 'claude-sonnet-4-6'));
            if (!selected) return null;
            const { standard, long_context } = selected.pricing;
            return (
              <div
                className="rounded-lg text-xs"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-primary)',
                  padding: '12px 14px',
                  marginTop: '10px',
                }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: long_context ? '6px' : '0' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Standard</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    ${standard.input}/M input · ${standard.output}/M output
                  </span>
                </div>
                {long_context && (
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-tertiary)' }}>&gt;200K tokens</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      ${long_context.input}/M input · ${long_context.output}/M output
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '8px' }}>
            The selected model is the default for AI interactions. Advanced Skill specific modelsettings are available below.
          </p>

          {/* Advanced Skill Settings button */}
          <button
            onClick={() => setActiveView('skill_settings')}
            className="flex items-center justify-between w-full rounded-lg text-sm transition-colors"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-secondary)',
              padding: '10px 14px',
              marginTop: '12px',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-primary)')}
          >
            <span className="flex items-center gap-2">
              <Zap size={14} />
              Advanced Model Settings for Skills
            </span>
            <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </section>

        {/* Theme */}
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            <Palette size={16} />
            Theme
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: '12px' }}>
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id)}
                className="text-left rounded-xl transition-all"
                style={{
                  backgroundColor: theme === t.id ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                  border: `2px solid ${theme === t.id ? 'var(--accent)' : 'var(--border-primary)'}`,
                  padding: '16px',
                }}
              >
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {t.label}
                </span>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  {t.description}
                </p>
              </button>
            ))}
          </div>
        </section>

      </div>

      {/* App Version */}
      <div style={{ position: 'fixed', bottom: '36px', right: '16px' }}>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>SAiPLING v0.1.0</span>
      </div>
    </div>
  );
}
