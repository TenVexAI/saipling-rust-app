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
