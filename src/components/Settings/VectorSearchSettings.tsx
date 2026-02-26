import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Trash2, Loader2, ExternalLink, Info } from 'lucide-react';
import { openHelpWindow } from '../../utils/helpWindow';
import { getConfig, updateConfig, getIndexStatus, reindexProject, clearIndex, type AppConfig } from '../../utils/tauri';
import { useProjectStore } from '../../stores/projectStore';
import type { IndexStatus } from '../../types/vectorSearch';

export function VectorSearchSettings() {
  const projectDir = useProjectStore((s) => s.projectDir);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [voyageKey, setVoyageKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [indexStatus, setIndexStatus] = useState<IndexStatus | null>(null);
  const [isReindexing, setIsReindexing] = useState(false);
  const [showEnableConfirm, setShowEnableConfirm] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const c = await getConfig();
      setConfig(c);
    } catch { /* ignore */ }
  }, []);

  const loadIndexStatus = useCallback(async () => {
    if (!projectDir) return;
    try {
      const status = await getIndexStatus(projectDir);
      setIndexStatus(status);
      setIsReindexing(status.is_indexing);
    } catch { /* index may not exist yet */ }
  }, [projectDir]);

  useEffect(() => {
    loadConfig();
    loadIndexStatus();
  }, [loadConfig, loadIndexStatus]);

  const updateVectorConfig = async (updates: Partial<AppConfig['vector_search']>) => {
    if (!config) return;
    const updated: AppConfig = {
      ...config,
      vector_search: { ...config.vector_search, ...updates },
    };
    setConfig(updated);
    try { await updateConfig(updated); } catch { /* ignore */ }
  };

  const handleToggleEnabled = async () => {
    if (!config) return;
    const newEnabled = !config.vector_search.enabled;
    if (newEnabled) {
      // Show confirmation dialog before enabling
      setShowEnableConfirm(true);
    } else {
      await updateVectorConfig({ enabled: false });
    }
  };

  const confirmEnable = async () => {
    setShowEnableConfirm(false);
    await updateVectorConfig({ enabled: true });
    if (projectDir) loadIndexStatus();
  };

  const handleSaveVoyageKey = async () => {
    if (!voyageKey.trim()) return;
    // Simple base64 encode matching the pattern in config.rs
    const encoded = btoa(voyageKey.trim());
    await updateVectorConfig({ embedding_api_key_encrypted: encoded });
    setVoyageKey('');
    setShowKeyInput(false);
  };

  const handleReindex = async () => {
    if (!projectDir) return;
    setIsReindexing(true);
    try {
      await reindexProject(projectDir);
    } catch (e) {
      console.error('Reindex failed:', e);
    } finally {
      setIsReindexing(false);
      loadIndexStatus();
    }
  };

  const handleClearIndex = async () => {
    if (!projectDir) return;
    try {
      await clearIndex(projectDir);
      loadIndexStatus();
    } catch (e) {
      console.error('Clear index failed:', e);
    }
  };

  const enabled = config?.vector_search?.enabled ?? false;
  const hasVoyageKey = !!config?.vector_search?.embedding_api_key_encrypted;

  return (
    <section style={{ marginBottom: '40px' }}>
      <h2
        className="flex items-center gap-2 text-sm font-semibold"
        style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}
      >
        <Search size={16} />
        Vector Search (Optional)
        <button
          onClick={() => openHelpWindow('voyage-api-key-how-to-get')}
          className="ml-1 flex items-center justify-center rounded-full transition-colors"
          style={{ color: 'var(--text-tertiary)', width: '20px', height: '20px', background: 'none', border: 'none', cursor: 'pointer' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          title="How to get a Voyage AI API key"
        >
          <Info size={14} />
        </button>
      </h2>

      {/* Enable toggle */}
      <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
        <div>
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
            Enable Vector Search
          </span>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '2px' }}>
            Adds semantic search across your project files. Requires a Voyage AI API key.
          </p>
        </div>
        <button
          onClick={handleToggleEnabled}
          className="relative rounded-full transition-colors"
          style={{
            width: '44px',
            height: '24px',
            backgroundColor: enabled ? 'var(--accent)' : 'var(--bg-tertiary)',
            border: `1px solid ${enabled ? 'var(--accent)' : 'var(--border-primary)'}`,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <div
            className="absolute rounded-full transition-all"
            style={{
              width: '18px',
              height: '18px',
              top: '2px',
              left: enabled ? '22px' : '2px',
              backgroundColor: enabled ? 'var(--text-inverse)' : 'var(--text-tertiary)',
            }}
          />
        </button>
      </div>

      {enabled && (
        <div
          className="rounded-lg"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            padding: '16px',
          }}
        >
          {/* Voyage API Key */}
          <div style={{ marginBottom: '16px' }}>
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Voyage AI API Key (required)
            </label>
            {hasVoyageKey && !showKeyInput ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-success)', marginTop: '6px' }}>
                <span>✓ API key configured</span>
                <button
                  onClick={() => setShowKeyInput(true)}
                  className="text-xs underline"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div style={{ marginTop: '6px' }}>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={voyageKey}
                    onChange={(e) => setVoyageKey(e.target.value)}
                    placeholder="pa-..."
                    className="flex-1 rounded-lg text-sm"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-primary)',
                      color: 'var(--text-primary)',
                      padding: '8px 12px',
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveVoyageKey()}
                  />
                  <button
                    onClick={handleSaveVoyageKey}
                    disabled={!voyageKey.trim()}
                    className="rounded-lg text-sm font-medium"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--text-inverse)',
                      opacity: !voyageKey.trim() ? 0.6 : 1,
                      padding: '8px 16px',
                    }}
                  >
                    Save
                  </button>
                </div>
                <a
                  href="https://dash.voyageai.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs"
                  style={{ color: 'var(--accent)', marginTop: '6px', textDecoration: 'none' }}
                >
                  Get your Voyage API key
                  <ExternalLink size={10} />
                </a>
              </div>
            )}
          </div>

          {/* Auto-index toggle */}
          <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
            <div>
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                Auto-index on file changes
              </span>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '2px' }}>
                Automatically updates the search index when you edit project files.
              </p>
            </div>
            <button
              onClick={() => updateVectorConfig({ auto_index: !config?.vector_search.auto_index })}
              className="relative rounded-full transition-colors"
              style={{
                width: '44px',
                height: '24px',
                backgroundColor: config?.vector_search.auto_index ? 'var(--accent)' : 'var(--bg-tertiary)',
                border: `1px solid ${config?.vector_search.auto_index ? 'var(--accent)' : 'var(--border-primary)'}`,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <div
                className="absolute rounded-full transition-all"
                style={{
                  width: '18px',
                  height: '18px',
                  top: '2px',
                  left: config?.vector_search.auto_index ? '22px' : '2px',
                  backgroundColor: config?.vector_search.auto_index ? 'var(--text-inverse)' : 'var(--text-tertiary)',
                }}
              />
            </button>
          </div>

          {/* Index Status */}
          {projectDir && indexStatus && (
            <div
              className="rounded-lg"
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                padding: '12px 14px',
                marginBottom: '16px',
              }}
            >
              <h3 className="text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Project Index Status
              </h3>
              <div className="grid grid-cols-2 text-xs" style={{ gap: '4px' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Files indexed:</span>
                <span style={{ color: 'var(--text-primary)' }}>{indexStatus.total_files}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>Total chunks:</span>
                <span style={{ color: 'var(--text-primary)' }}>{indexStatus.total_chunks}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>Last indexed:</span>
                <span style={{ color: 'var(--text-primary)' }}>
                  {indexStatus.last_indexed
                    ? new Date(indexStatus.last_indexed).toLocaleString()
                    : 'Never'}
                </span>
                <span style={{ color: 'var(--text-tertiary)' }}>Embedding cost:</span>
                <span style={{ color: 'var(--text-primary)' }}>
                  ${indexStatus.total_cost_usd.toFixed(4)}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          {projectDir && (
            <div className="flex gap-2">
              <button
                onClick={handleReindex}
                disabled={isReindexing || !hasVoyageKey}
                className="flex items-center gap-2 rounded-lg text-sm font-medium"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-secondary)',
                  padding: '8px 14px',
                  opacity: isReindexing || !hasVoyageKey ? 0.6 : 1,
                  cursor: isReindexing || !hasVoyageKey ? 'not-allowed' : 'pointer',
                }}
              >
                {isReindexing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                {isReindexing ? 'Indexing...' : 'Re-index Project'}
              </button>
              <button
                onClick={handleClearIndex}
                disabled={isReindexing}
                className="flex items-center gap-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-tertiary)',
                  padding: '8px 14px',
                  cursor: isReindexing ? 'not-allowed' : 'pointer',
                }}
              >
                <Trash2 size={14} />
                Clear Index
              </button>
            </div>
          )}

          {/* Advanced */}
          <div style={{ marginTop: '16px' }}>
            <h3 className="text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Advanced
            </h3>
            <div className="flex items-center gap-4">
              <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Default max results:
              </label>
              <select
                value={config?.vector_search.max_results_default ?? 5}
                onChange={(e) => updateVectorConfig({ max_results_default: Number(e.target.value) })}
                className="rounded text-xs"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-primary)',
                  padding: '4px 8px',
                }}
              >
                {[3, 5, 10, 15, 20].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Search token budget:
              </label>
              <select
                value={config?.vector_search.max_search_tokens_default ?? 15000}
                onChange={(e) => updateVectorConfig({ max_search_tokens_default: Number(e.target.value) })}
                className="rounded text-xs"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-primary)',
                  padding: '4px 8px',
                }}
              >
                {[5000, 10000, 15000, 20000, 30000].map((n) => (
                  <option key={n} value={n}>{n.toLocaleString()}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {!enabled && (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '4px' }}>
          When disabled, all features work normally — vector search only provides supplementary context for supported skills. Embedding costs are minimal (typically &lt; $0.01 per full novel index).
        </p>
      )}

      {/* First-time enable confirmation dialog */}
      {showEnableConfirm && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
          onClick={() => setShowEnableConfirm(false)}
        >
          <div
            className="rounded-xl"
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              boxShadow: 'var(--shadow-lg)',
              padding: '24px',
              maxWidth: '420px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)', marginBottom: '12px' }}>
              Enable Vector Search?
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>
              This will index your project files using AI embeddings.
            </p>
            <ul className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: '1.8', marginBottom: '20px', paddingLeft: '16px', listStyleType: 'disc' }}>
              <li>Uses your Voyage AI API key to generate embeddings (~$0.01 for a full novel)</li>
              <li>Creates a search index in your project's .saipling/ folder</li>
              <li>The index can be deleted and rebuilt at any time</li>
              <li>You can disable this at any time with no data loss</li>
            </ul>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowEnableConfirm(false)}
                className="rounded-lg text-xs font-medium hover-btn"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-primary)',
                  padding: '8px 16px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmEnable}
                className="rounded-lg text-xs font-medium hover-btn"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--text-inverse)',
                  border: 'none',
                  padding: '8px 16px',
                }}
              >
                Enable
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
