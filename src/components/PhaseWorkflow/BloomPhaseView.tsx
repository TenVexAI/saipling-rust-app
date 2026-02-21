import { useState, useEffect, useCallback } from 'react';
import { PenTool, Check, Circle, Loader2, Info } from 'lucide-react';
import { PhaseIcon } from './PhaseIcon';
import { useProjectStore } from '../../stores/projectStore';
import { getBookMetadata } from '../../utils/tauri';
import { openHelpWindow } from '../../utils/helpWindow';
import type { BookMetadata } from '../../types/project';

export function BloomPhaseView() {
  const projectDir = useProjectStore((s) => s.projectDir);
  const activeBookId = useProjectStore((s) => s.activeBookId);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const [bookMeta, setBookMeta] = useState<BookMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBook = useCallback(async () => {
    if (!projectDir || !activeBookId) return;
    setLoading(true);
    try {
      const meta = await getBookMetadata(projectDir, activeBookId);
      setBookMeta(meta);
    } catch {
      setBookMeta(null);
    }
    setLoading(false);
  }, [projectDir, activeBookId]);

  useEffect(() => {
    loadBook();
  }, [loadBook]);

  const totalWords = bookMeta?.current_word_count ?? 0;
  const targetWords = bookMeta?.target_word_count ?? 0;
  const progressPct = targetWords > 0 ? Math.round((totalWords / targetWords) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Phase Header */}
      <div className="shrink-0" style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border-secondary)' }}>
        <div className="flex items-center gap-3">
          <PhaseIcon phase="bloom" size={50} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                Bloom Phase — Draft Manuscript
              </h1>
              <button
                onClick={() => openHelpWindow('phase-5-bloom')}
                className="flex items-center justify-center rounded-full transition-colors"
                style={{ color: 'var(--text-tertiary)', width: '22px', height: '22px', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                title="Learn about the Bloom Phase"
              >
                <Info size={15} />
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '2px' }}>
              How does this read? Write scene by scene, or let Claude draft for you.
            </p>
          </div>
        </div>
        {targetWords > 0 && (
          <div className="flex items-center gap-2" style={{ marginTop: '12px' }}>
            <div style={{ flex: 1, height: '4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(progressPct, 100)}%`,
                height: '100%',
                backgroundColor: 'var(--accent)',
                borderRadius: '2px',
                transition: 'width 0.3s',
              }} />
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
              {totalWords.toLocaleString()} / {targetWords.toLocaleString()} words ({progressPct}%)
            </span>
          </div>
        )}
      </div>

      {/* Scene Navigator */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '20px 28px' }}>
        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: '40px 0' }}>
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
          </div>
        ) : bookMeta && bookMeta.chapters.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {bookMeta.chapters.map((chapter) => (
              <div key={chapter.id}>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)', marginBottom: '6px' }}>
                  {chapter.title}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {chapter.scenes.map((scene) => {
                    const hasDraft = scene.word_count > 0;
                    return (
                      <button
                        key={scene.id}
                        onClick={() => {
                          if (projectDir && activeBookId) {
                            const path = `${projectDir}\\books\\${activeBookId}\\chapters\\${chapter.id}\\${scene.id}\\draft.md`;
                            setActiveFile(path);
                          }
                        }}
                        className="flex items-center justify-between text-left rounded-md transition-all"
                        style={{
                          backgroundColor: 'var(--bg-elevated)',
                          border: '1px solid var(--border-primary)',
                          padding: '10px 14px',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'; }}
                      >
                        <div className="flex items-center gap-3">
                          {hasDraft ? (
                            <Check size={13} style={{ color: 'var(--color-success)' }} />
                          ) : (
                            <Circle size={13} style={{ color: 'var(--text-tertiary)' }} />
                          )}
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {scene.title}
                          </span>
                        </div>
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {scene.word_count > 0 ? `${scene.word_count.toLocaleString()} words` : 'No draft'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="rounded-lg text-center"
            style={{
              border: '2px dashed var(--border-primary)',
              color: 'var(--text-tertiary)',
              padding: '32px 20px',
            }}
          >
            <PenTool size={24} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
            <p className="text-sm">No scenes to write yet</p>
            <p className="text-xs" style={{ marginTop: '4px' }}>
              Complete the Flourish Phase first to create scene outlines, then return here to write.
            </p>
          </div>
        )}

        {/* Guidance */}
        <div className="rounded-lg" style={{ marginTop: '24px', padding: '16px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)', lineHeight: '1.6' }}>
            Click a scene to open it in the editor. Write it yourself, or ask Claude to draft the
            entire scene based on your outline. Use inline AI actions (select text) for rewrites,
            expansions, and dialogue help.
          </p>
        </div>
      </div>
    </div>
  );
}
