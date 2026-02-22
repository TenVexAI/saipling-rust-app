import { useState } from 'react';
import { ChevronRight, ChevronDown, FileText, Plus, GripVertical } from 'lucide-react';
import type { ChapterMeta, SceneMeta } from '../../types/project';

interface ChapterListProps {
  chapters: ChapterMeta[];
  projectDir: string;
  bookId: string;
  onSceneSelect: (chapterId: string, sceneId: string) => void;
  onCreateChapter: () => void;
  onCreateScene: (chapterId: string) => void;
}

function statusColor(status: SceneMeta['status']): string {
  switch (status) {
    case 'not_started': return 'var(--text-tertiary)';
    case 'outlined': return 'var(--color-cyan)';
    case 'drafted': return 'var(--color-green)';
    case 'revised': return 'var(--accent)';
    default: return 'var(--text-tertiary)';
  }
}

function statusLabel(status: SceneMeta['status']): string {
  switch (status) {
    case 'not_started': return 'Not Started';
    case 'outlined': return 'Outlined';
    case 'drafted': return 'Drafted';
    case 'revised': return 'Revised';
    default: return status;
  }
}

export function ChapterList({
  chapters,
  onSceneSelect,
  onCreateChapter,
  onCreateScene,
}: ChapterListProps) {
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    new Set(chapters.map((c) => c.id))
  );

  const toggleChapter = (id: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          Chapters
        </h3>
        <button
          onClick={onCreateChapter}
          className="flex items-center gap-1 text-xs hover-action"
          style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      {chapters.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)', padding: '8px 0' }}>
          No chapters yet. Create one to start writing.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {chapters.map((chapter) => {
            const isExpanded = expandedChapters.has(chapter.id);
            const totalWords = chapter.scenes.reduce((sum, s) => sum + s.word_count, 0);

            return (
              <div key={chapter.id}>
                <button
                  onClick={() => toggleChapter(chapter.id)}
                  className="flex items-center w-full text-left rounded-md transition-colors"
                  style={{ padding: '8px 10px' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <GripVertical size={12} style={{ color: 'var(--text-tertiary)', marginRight: '4px', cursor: 'grab', opacity: 0.5 }} />
                  <span style={{ marginRight: '6px', color: 'var(--text-tertiary)' }}>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                  <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                    {chapter.title}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)', marginLeft: '8px' }}>
                    {chapter.scenes.length} scene{chapter.scenes.length !== 1 ? 's' : ''} · {totalWords.toLocaleString()}w
                  </span>
                </button>

                {isExpanded && (
                  <div style={{ paddingLeft: '28px' }}>
                    {chapter.scenes.map((scene) => (
                      <button
                        key={scene.id}
                        onClick={() => onSceneSelect(chapter.id, scene.id)}
                        className="flex items-center w-full text-left rounded-md transition-colors"
                        style={{ padding: '5px 10px' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <FileText size={12} style={{ color: 'var(--text-tertiary)', marginRight: '8px', flexShrink: 0 }} />
                        <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                          {scene.title}
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: statusColor(scene.status), marginLeft: '8px' }}
                          title={statusLabel(scene.status)}
                        >
                          {scene.word_count > 0 ? `${scene.word_count.toLocaleString()}w` : statusLabel(scene.status)}
                        </span>
                      </button>
                    ))}
                    <button
                      onClick={() => onCreateScene(chapter.id)}
                      className="flex items-center w-full text-left text-xs hover-action"
                      style={{ padding: '5px 10px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <Plus size={12} style={{ marginRight: '8px' }} />
                      Add Scene
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
