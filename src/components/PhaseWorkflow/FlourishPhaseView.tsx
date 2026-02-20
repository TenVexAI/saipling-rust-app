import { useState, useEffect, useCallback } from 'react';
import { LayoutList, Check, Circle, Loader2 } from 'lucide-react';
import { PhaseIcon } from './PhaseIcon';
import { useProjectStore } from '../../stores/projectStore';
import { getBookMetadata } from '../../utils/tauri';
import type { BookMetadata } from '../../types/project';

export function FlourishPhaseView() {
  const projectDir = useProjectStore((s) => s.projectDir);
  const activeBookId = useProjectStore((s) => s.activeBookId);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const [bookMeta, setBookMeta] = useState<BookMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedScene, setSelectedScene] = useState<string | null>(null);

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

  const totalScenes = bookMeta?.chapters.reduce((sum, ch) => sum + ch.scenes.length, 0) ?? 0;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Phase Header */}
      <div className="shrink-0" style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border-secondary)' }}>
        <div className="flex items-center gap-3">
          <PhaseIcon phase="flourish" size={50} />
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              Flourish Phase — Scene Outlines
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '2px' }}>
              What does each scene do? Design scenes using the Action/Reaction pattern.
            </p>
          </div>
        </div>
        {totalScenes > 0 && (
          <div className="flex items-center gap-2" style={{ marginTop: '12px' }}>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {bookMeta?.chapters.length ?? 0} chapters · {totalScenes} scenes
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '20px 28px' }}>
        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: '40px 0' }}>
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
          </div>
        ) : bookMeta && bookMeta.chapters.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {bookMeta.chapters.map((chapter) => (
              <div key={chapter.id}>
                <div className="flex items-center gap-2" style={{ marginBottom: '6px' }}>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {chapter.title}
                  </h2>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    ({chapter.scenes.length} scenes)
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {chapter.scenes.map((scene) => {
                    const sceneKey = `${chapter.id}/${scene.id}`;
                    const isSelected = selectedScene === sceneKey;
                    return (
                      <button
                        key={scene.id}
                        onClick={() => {
                          setSelectedScene(isSelected ? null : sceneKey);
                          if (projectDir && activeBookId) {
                            const path = `${projectDir}\\books\\${activeBookId}\\chapters\\${chapter.id}\\${scene.id}\\outline.md`;
                            setActiveFile(path);
                          }
                        }}
                        className="flex items-center gap-3 text-left rounded-md transition-all"
                        style={{
                          backgroundColor: isSelected ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                          border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-primary)'}`,
                          padding: '10px 14px',
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = isSelected ? 'var(--accent-subtle)' : 'var(--bg-elevated)'; }}
                      >
                        <div className="shrink-0">
                          {scene.word_count > 0 ? (
                            <Check size={13} style={{ color: 'var(--color-success)' }} />
                          ) : (
                            <Circle size={13} style={{ color: 'var(--text-tertiary)' }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {scene.title}
                          </span>
                          {scene.type && (
                            <span
                              className="ml-2 text-xs rounded"
                              style={{
                                backgroundColor: scene.type === 'action' ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                                color: scene.type === 'action' ? 'var(--accent)' : 'var(--text-tertiary)',
                                padding: '1px 6px',
                              }}
                            >
                              {scene.type}
                            </span>
                          )}
                        </div>
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
            <LayoutList size={24} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
            <p className="text-sm">No chapters or scenes yet</p>
            <p className="text-xs" style={{ marginTop: '4px' }}>
              Create chapters in the Book view, or ask Claude to generate a scene breakdown.
            </p>
          </div>
        )}

        {/* Guidance */}
        <div className="rounded-lg" style={{ marginTop: '24px', padding: '16px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)', lineHeight: '1.6' }}>
            Design each scene with Action/Reaction alternation. Action scenes drive the plot forward with
            a goal, conflict, and outcome. Reaction scenes show the character processing events with
            emotion, analysis, and a new decision. Ask Claude to generate a complete scene breakdown
            from your beat outline.
          </p>
        </div>
      </div>
    </div>
  );
}
