import { useState, useEffect } from 'react';
import { ArrowLeft, Zap, RotateCcw } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { getSkillSettings, getModelsConfig, getConfig, updateConfig, type AppConfig } from '../../utils/tauri';
import type { SkillSettingsEntry, ModelEntry, SkillOverride } from '../../types/ai';

const TOKEN_PRESETS = [
  { label: '20K', value: 20000 },
  { label: '40K', value: 40000 },
  { label: '80K', value: 80000 },
  { label: '120K', value: 120000 },
  { label: '200K', value: 200000 },
];

export function SkillSettings() {
  const setActiveView = useProjectStore((s) => s.setActiveView);
  const [skills, setSkills] = useState<SkillSettingsEntry[]>([]);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getSkillSettings().then(setSkills).catch(() => {});
    getModelsConfig().then((mc) => setModels(mc.models)).catch(() => {});
    getConfig().then(setConfig).catch(() => {});
  }, []);

  const handleModelChange = async (skillName: string, value: string) => {
    if (!config) return;
    const overrides = { ...config.skill_overrides };
    if (!overrides[skillName]) {
      overrides[skillName] = { model: 'auto' };
    }
    overrides[skillName] = { ...overrides[skillName], model: value };
    const updated = { ...config, skill_overrides: overrides };
    setConfig(updated);
    setDirty((d) => ({ ...d, [skillName]: true }));
    try {
      await updateConfig(updated);
      // Refresh skills to reflect new effective settings
      const refreshed = await getSkillSettings();
      setSkills(refreshed);
      setDirty((d) => ({ ...d, [skillName]: false }));
    } catch { /* ignore */ }
  };

  const handleTokensChange = async (skillName: string, value: number) => {
    if (!config) return;
    const overrides = { ...config.skill_overrides };
    if (!overrides[skillName]) {
      overrides[skillName] = { model: 'auto' };
    }
    overrides[skillName] = { ...overrides[skillName], max_context_tokens: value };
    const updated = { ...config, skill_overrides: overrides };
    setConfig(updated);
    setDirty((d) => ({ ...d, [skillName]: true }));
    try {
      await updateConfig(updated);
      const refreshed = await getSkillSettings();
      setSkills(refreshed);
      setDirty((d) => ({ ...d, [skillName]: false }));
    } catch { /* ignore */ }
  };

  const handleReset = async (skillName: string) => {
    if (!config) return;
    const overrides = { ...config.skill_overrides };
    delete overrides[skillName];
    const updated = { ...config, skill_overrides: overrides };
    setConfig(updated);
    try {
      await updateConfig(updated);
      const refreshed = await getSkillSettings();
      setSkills(refreshed);
    } catch { /* ignore */ }
  };

  const getOverride = (skillName: string): SkillOverride | undefined => {
    return config?.skill_overrides?.[skillName];
  };

  return (
    <div className="overflow-y-auto h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-2xl" style={{ padding: '32px 40px' }}>
        {/* Header with back button */}
        <div className="flex items-center gap-3" style={{ marginBottom: '28px' }}>
          <button
            onClick={() => setActiveView('settings')}
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{
              color: 'var(--text-tertiary)',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-primary)',
              padding: '6px',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            title="Back to Settings"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Skill Model Settings
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '2px' }}>
              Override the model and context limit for individual skills
            </p>
          </div>
        </div>

        {/* Skills list */}
        <div className="flex flex-col" style={{ gap: '16px' }}>
          {skills.map((skill) => {
            const ov = getOverride(skill.name);
            const hasOverride = ov && (ov.model !== 'auto' || ov.max_context_tokens != null);
            const modelValue = ov?.model || 'auto';
            const tokensValue = skill.effective_max_context_tokens;

            return (
              <div
                key={skill.name}
                className="rounded-xl"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: `1px solid ${hasOverride ? 'var(--accent)' : 'var(--border-primary)'}`,
                  padding: '16px 18px',
                }}
              >
                {/* Skill header */}
                <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                  <div className="flex items-center gap-2">
                    <Zap size={14} style={{ color: 'var(--accent)' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {skill.display_name}
                    </span>
                    {hasOverride && (
                      <span
                        className="text-[10px] font-medium rounded-full"
                        style={{
                          backgroundColor: 'var(--accent-subtle)',
                          color: 'var(--accent)',
                          padding: '1px 8px',
                        }}
                      >
                        custom
                      </span>
                    )}
                  </div>
                  {hasOverride && (
                    <button
                      onClick={() => handleReset(skill.name)}
                      className="flex items-center gap-1 text-xs rounded-md transition-colors"
                      style={{
                        color: 'var(--text-tertiary)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 6px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                      title="Reset to defaults"
                    >
                      <RotateCcw size={12} />
                      Reset
                    </button>
                  )}
                </div>

                <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: '12px' }}>
                  {skill.description}
                </p>

                {/* Controls */}
                <div className="flex flex-col" style={{ gap: '10px' }}>
                  {/* Model selector */}
                  <div className="flex items-center gap-3">
                    <label className="text-xs shrink-0" style={{ color: 'var(--text-secondary)', width: '60px' }}>
                      Model
                    </label>
                    <select
                      value={modelValue}
                      onChange={(e) => handleModelChange(skill.name, e.target.value)}
                      className="flex-1 rounded-md text-xs"
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-primary)',
                        color: 'var(--text-primary)',
                        padding: '6px 10px',
                        appearance: 'auto',
                      }}
                    >
                      <option value="auto">Auto (use default)</option>
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Token limit */}
                  <div className="flex items-center gap-3">
                    <label className="text-xs shrink-0" style={{ color: 'var(--text-secondary)', width: '60px' }}>
                      Max Tokens
                    </label>
                    <div className="flex items-center gap-2 flex-1">
                      {TOKEN_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          onClick={() => handleTokensChange(skill.name, preset.value)}
                          className="rounded-md text-xs font-medium transition-colors"
                          style={{
                            backgroundColor: tokensValue === preset.value ? 'var(--accent-subtle)' : 'var(--bg-input)',
                            border: `1px solid ${tokensValue === preset.value ? 'var(--accent)' : 'var(--border-primary)'}`,
                            color: tokensValue === preset.value ? 'var(--accent)' : 'var(--text-secondary)',
                            padding: '4px 10px',
                            cursor: 'pointer',
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                      <input
                        type="number"
                        value={tokensValue}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val >= 1000 && val <= 1000000) {
                            handleTokensChange(skill.name, val);
                          }
                        }}
                        className="rounded-md text-xs"
                        style={{
                          backgroundColor: 'var(--bg-input)',
                          border: '1px solid var(--border-primary)',
                          color: 'var(--text-primary)',
                          padding: '4px 8px',
                          width: '80px',
                          textAlign: 'right',
                        }}
                        min={1000}
                        max={1000000}
                        step={1000}
                        title="Custom token limit (1,000 – 1,000,000)"
                      />
                    </div>
                  </div>
                </div>

                {/* Loading indicator */}
                {dirty[skill.name] && (
                  <div className="text-[10px] text-right" style={{ color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    Saving...
                  </div>
                )}
              </div>
            );
          })}

          {skills.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '40px 0' }}>
              No skills found. Skills are loaded from the app's skills directory.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
