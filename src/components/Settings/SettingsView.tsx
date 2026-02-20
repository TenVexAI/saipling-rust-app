import { useState, useEffect } from 'react';
import { Key, Check, Loader2, Palette } from 'lucide-react';
import { useThemeStore } from '../../stores/themeStore';
import { THEMES } from '../../types/theme';
import { getConfig, setApiKey, validateApiKey, updateConfig, type AppConfig } from '../../utils/tauri';

export function SettingsView() {
  const { theme, setTheme } = useThemeStore();
  const [apiKey, setApiKeyInput] = useState('');
  const [keyStatus, setKeyStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [hasKey, setHasKey] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    getConfig().then((c) => {
      setConfig(c);
      setHasKey(!!c.api_key_encrypted);
      setTheme(c.theme as typeof theme);
    }).catch(() => { /* config may not exist yet */ });
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
    if (config) {
      const updated = { ...config, theme: themeId };
      setConfig(updated);
      try { await updateConfig(updated); } catch { /* ignore */ }
    }
  };

  return (
    <div className="p-6 overflow-y-auto h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <h1 className="text-xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
        Settings
      </h1>

      {/* API Key */}
      <section className="mb-8">
        <h2 className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
          <Key size={16} />
          Anthropic API Key
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
          <div className="flex gap-2 max-w-lg">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKeyInput(e.target.value); setKeyStatus('idle'); }}
              placeholder="sk-ant-..."
              className="flex-1 px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: 'var(--bg-input)',
                border: `1px solid ${keyStatus === 'invalid' ? 'var(--color-error)' : 'var(--border-primary)'}`,
                color: 'var(--text-primary)',
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
            />
            <button
              onClick={handleSaveKey}
              disabled={keyStatus === 'validating' || !apiKey.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--text-inverse)',
                opacity: keyStatus === 'validating' || !apiKey.trim() ? 0.6 : 1,
              }}
            >
              {keyStatus === 'validating' ? <Loader2 size={14} className="animate-spin" /> : null}
              {keyStatus === 'validating' ? 'Validating...' : 'Save'}
            </button>
          </div>
        )}
        {keyStatus === 'invalid' && (
          <p className="text-xs mt-2" style={{ color: 'var(--color-error)' }}>
            Invalid API key. Please check and try again.
          </p>
        )}
      </section>

      {/* Theme */}
      <section className="mb-8">
        <h2 className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
          <Palette size={16} />
          Theme
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-2xl">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => handleThemeChange(t.id)}
              className="text-left p-3 rounded-lg transition-colors"
              style={{
                backgroundColor: theme === t.id ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                border: `2px solid ${theme === t.id ? 'var(--accent)' : 'var(--border-primary)'}`,
              }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {t.label}
              </span>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {t.description}
              </p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
