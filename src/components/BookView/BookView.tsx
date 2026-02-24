import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Target, PenTool, Download, Lightbulb } from 'lucide-react';
import { ChapterList } from './ChapterList';
import { MatterList } from './MatterList';
import { useProjectStore } from '../../stores/projectStore';
import { useAIStore } from '../../stores/aiStore';
import {
  getBookMetadata,
  createChapter,
  createScene,
  listFrontMatter,
  listBackMatter,
  createFrontMatter,
  createBackMatter,
  removeFrontMatter,
  removeBackMatter,
  listDirectory,
} from '../../utils/tauri';
import type { BookMetadata, MatterEntry, PhaseProgress } from '../../types/project';
import { PHASES } from '../../types/sapling';
import { ExportDialog } from './ExportDialog';

function getPhaseProgressPct(phaseProgress: Record<string, PhaseProgress>, phaseId: string): number {
  const p = phaseProgress[phaseId];
  if (!p) return 0;
  if (p.status === 'complete') return 100;
  if (p.status === 'not_started') return 0;
  // in_progress — use sub-metrics where available
  const raw = p as Record<string, unknown>;
  switch (phaseId) {
    case 'seed': {
      const d = (raw.deliverables || {}) as Record<string, boolean>;
      const total = Object.keys(d).length || 1;
      const done = Object.values(d).filter(Boolean).length;
      return Math.max(5, Math.round((done / total) * 100));
    }
    case 'root': {
      const drafted = (raw.beats_drafted as number) || 0;
      const total = (raw.beats_total as number) || 21;
      return Math.max(5, Math.round((drafted / total) * 100));
    }
    case 'sprout': {
      const d = (raw.deliverables || {}) as Record<string, boolean>;
      const total = Object.keys(d).length || 1;
      const done = Object.values(d).filter(Boolean).length;
      return Math.max(5, Math.round((done / total) * 100));
    }
    case 'flourish': {
      const outlined = (raw.scenes_outlined as number) || 0;
      return outlined > 0 ? Math.max(5, Math.min(95, outlined * 10)) : 5;
    }
    case 'bloom': {
      const drafted = (raw.scenes_drafted as number) || 0;
      const total = (raw.scenes_total as number) || 0;
      return total > 0 ? Math.max(5, Math.round((drafted / total) * 100)) : 5;
    }
    default:
      return 5;
  }
}

function getCurrentPhaseId(phaseProgress: Record<string, PhaseProgress>): string {
  const order = ['seed', 'root', 'sprout', 'flourish', 'bloom'];
  for (const id of order) {
    const p = phaseProgress[id];
    if (!p || p.status !== 'complete') return id;
  }
  return 'bloom';
}

export function BookView() {
  const project = useProjectStore((s) => s.project);
  const projectDir = useProjectStore((s) => s.projectDir);
  const activeBookId = useProjectStore((s) => s.activeBookId);
  const setActiveBook = useProjectStore((s) => s.setActiveBook);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);

  const setActiveSkill = useAIStore((s) => s.setActiveSkill);

  const [bookMeta, setBookMeta] = useState<BookMetadata | null>(null);
  const [frontMatter, setFrontMatter] = useState<MatterEntry[]>([]);
  const [backMatter, setBackMatter] = useState<MatterEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [bookOverviewPath, setBookOverviewPath] = useState<string | null>(null);
  const [overviewChecked, setOverviewChecked] = useState(false);
  const [showGettingStarted, setShowGettingStarted] = useState(false);

  const bookId = activeBookId || project?.books[0]?.id || null;

  const loadBook = useCallback(async () => {
    if (!projectDir || !bookId) return;
    setLoading(true);
    try {
      const [meta, fm, bm] = await Promise.all([
        getBookMetadata(projectDir, bookId),
        listFrontMatter(projectDir, bookId),
        listBackMatter(projectDir, bookId),
      ]);
      setBookMeta(meta);
      setFrontMatter(fm);
      setBackMatter(bm);
      setActiveBook(bookId, meta);
    } catch {
      setBookMeta(null);
    }
    setLoading(false);
  }, [projectDir, bookId, setActiveBook]);

  useEffect(() => {
    loadBook();
  }, [loadBook]);

  // Check if book overview exists
  useEffect(() => {
    if (!projectDir || !bookId) return;
    setOverviewChecked(false);
    setBookOverviewPath(null);
    const overviewDir = `${projectDir}\\books\\${bookId}\\overview`;
    listDirectory(overviewDir)
      .then((entries) => {
        const overview = entries.find((e) => e.name === 'overview.md');
        setBookOverviewPath(overview ? overview.path : null);
        setOverviewChecked(true);
        if (!overview) setShowGettingStarted(true);
      })
      .catch(() => {
        setBookOverviewPath(null);
        setOverviewChecked(true);
        setShowGettingStarted(true);
      });
  }, [projectDir, bookId]);

  const handleBookBrainstorm = () => {
    if (!projectDir || !bookId) return;
    setActiveSkill('brainstorm');
    setActiveFile(bookOverviewPath ?? `${projectDir}\\books\\${bookId}\\overview\\brainstorm.md`);
  };

  const bumpRefresh = useProjectStore((s) => s.bumpRefresh);

  const handleCreateChapter = async () => {
    if (!projectDir || !bookId) return;
    const title = `Chapter ${(bookMeta?.chapters.length ?? 0) + 1}`;
    try {
      await createChapter(projectDir, bookId, title);
      loadBook();
      bumpRefresh();
    } catch { /* ignore */ }
  };

  const handleCreateScene = async (chapterId: string) => {
    if (!projectDir || !bookId) return;
    const chapter = bookMeta?.chapters.find((c) => c.id === chapterId);
    const title = `Scene ${(chapter?.scenes.length ?? 0) + 1}`;
    try {
      await createScene(projectDir, bookId, chapterId, title, 'action');
      loadBook();
      bumpRefresh();
    } catch { /* ignore */ }
  };

  const handleSceneSelect = (chapterId: string, sceneId: string) => {
    useProjectStore.getState().setActiveChapter(chapterId);
    useProjectStore.getState().setActiveScene(sceneId);
    // Build path to the scene draft file
    if (projectDir && bookId) {
      const path = `${projectDir}\\books\\${bookId}\\chapters\\${chapterId}\\${sceneId}\\draft.md`;
      setActiveFile(path);
    }
  };

  const handleMatterSelect = (_subtype: string, path: string) => {
    setActiveFile(path);
  };

  const handleCreateFrontMatter = async (subtype: string) => {
    if (!projectDir || !bookId) return;
    try {
      await createFrontMatter(projectDir, bookId, subtype);
      loadBook();
      bumpRefresh();
    } catch { /* ignore */ }
  };

  const handleCreateBackMatter = async (subtype: string) => {
    if (!projectDir || !bookId) return;
    try {
      await createBackMatter(projectDir, bookId, subtype);
      loadBook();
      bumpRefresh();
    } catch { /* ignore */ }
  };

  const handleRemoveFrontMatter = async (subtype: string) => {
    if (!projectDir || !bookId) return;
    try {
      await removeFrontMatter(projectDir, bookId, subtype);
      loadBook();
      bumpRefresh();
    } catch { /* ignore */ }
  };

  const handleRemoveBackMatter = async (subtype: string) => {
    if (!projectDir || !bookId) return;
    try {
      await removeBackMatter(projectDir, bookId, subtype);
      loadBook();
      bumpRefresh();
    } catch { /* ignore */ }
  };

  if (!project || !projectDir) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
        <BookOpen size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
        <p className="text-sm">Open a project to view books</p>
      </div>
    );
  }

  if (!bookId) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
        <BookOpen size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
        <p className="text-sm">No books in this project yet</p>
      </div>
    );
  }

  if (loading && !bookMeta) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
        <span className="text-sm">Loading book...</span>
      </div>
    );
  }

  if (!bookMeta) return null;

  const progressPct = bookMeta.target_word_count > 0
    ? Math.round((bookMeta.current_word_count / bookMeta.target_word_count) * 100)
    : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Book Header */}
      <div className="shrink-0" style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border-secondary)' }}>
        <div className="flex items-start gap-3">
          <BookOpen size={20} style={{ color: 'var(--accent)', marginTop: '2px', flexShrink: 0 }} />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold truncate" style={{ color: 'var(--text-primary)' }}>
              {bookMeta.title}
            </h1>
            <div className="flex items-center gap-4" style={{ marginTop: '8px' }}>
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                <PenTool size={12} />
                {bookMeta.current_word_count.toLocaleString()} words
              </span>
              {bookMeta.target_word_count > 0 && (
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  <Target size={12} />
                  {bookMeta.target_word_count.toLocaleString()} target ({progressPct}%)
                </span>
              )}
            </div>
            {bookMeta.target_word_count > 0 && (
              <div style={{ marginTop: '10px', height: '4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(progressPct, 100)}%`, height: '100%', backgroundColor: 'var(--accent)', borderRadius: '2px', transition: 'width 0.3s' }} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0" style={{ marginTop: '2px' }}>
            {overviewChecked && (
              <button
                onClick={handleBookBrainstorm}
                className="flex items-center gap-2 rounded-lg text-sm font-medium hover-btn-primary"
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--accent)',
                  color: 'var(--text-inverse)',
                }}
                title={bookOverviewPath ? 'Open book overview' : 'Start brainstorming for this book'}
              >
                {!bookOverviewPath && <Lightbulb size={16} />}
                {bookOverviewPath ? 'Book Overview' : 'Brainstorm'}
              </button>
            )}
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1.5 rounded-lg text-xs font-medium hover-btn"
              style={{
                padding: '6px 12px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-secondary)',
              }}
              title="Export book"
            >
              <Download size={13} />
              Export
            </button>
          </div>
        </div>
      </div>

      {showExport && (
        <ExportDialog
          projectDir={projectDir!}
          bookId={bookId!}
          bookTitle={bookMeta.title}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* Book Getting Started Modal */}
      {showGettingStarted && overviewChecked && !bookOverviewPath && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
          onClick={() => setShowGettingStarted(false)}
        >
          <div
            className="rounded-xl"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-primary)',
              padding: '28px',
              maxWidth: '460px',
              width: '90%',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
              <Lightbulb size={18} style={{ color: 'var(--accent)' }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Getting Started with {bookMeta?.title ?? 'This Book'}
              </h2>
            </div>

            <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '12px' }}>
              Your first step is to create a <strong style={{ color: 'var(--text-primary)' }}>Book Overview</strong> — a
              living document that describes the scope and key details of this book.
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '12px' }}>
              Start by brain-dumping your ideas into the book's brainstorm document. Chat with the AI to refine your
              concept, then generate the overview when you're ready.
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '20px' }}>
              Press <strong style={{ color: 'var(--text-primary)' }}>Start Now</strong> to open the brainstorm workspace
              for this book.
            </p>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowGettingStarted(false)}
                className="rounded-lg text-xs font-medium hover-btn"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-primary)',
                  padding: '8px 16px',
                  cursor: 'pointer',
                }}
              >
                Not Yet
              </button>
              <button
                onClick={() => {
                  setShowGettingStarted(false);
                  handleBookBrainstorm();
                }}
                className="rounded-lg text-xs font-medium hover-btn-primary"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--text-inverse)',
                  border: 'none',
                  padding: '8px 16px',
                  cursor: 'pointer',
                }}
              >
                Start Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase Progress */}
      <div className="shrink-0" style={{ padding: '16px 28px', borderBottom: '1px solid var(--border-secondary)' }}>
        <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)', marginBottom: '12px' }}>
          Writing Phases
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {PHASES.map((phase) => {
            const pct = getPhaseProgressPct(bookMeta.phase_progress, phase.id);
            const currentId = getCurrentPhaseId(bookMeta.phase_progress);
            const isCurrent = currentId === phase.id;
            const isComplete = bookMeta.phase_progress[phase.id]?.status === 'complete';
            const isNotStarted = !bookMeta.phase_progress[phase.id] || bookMeta.phase_progress[phase.id]?.status === 'not_started';
            return (
              <div key={phase.id} title={`${phase.question} — ${phase.deliverable}`}>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 shrink-0" style={{ width: '110px' }}>
                    <span className="text-xs font-medium" style={{
                      color: isCurrent ? 'var(--accent)' : isComplete ? 'var(--color-success)' : 'var(--text-tertiary)',
                    }}>
                      {phase.label}
                    </span>
                    {isCurrent && !isComplete && (
                      <span style={{
                        color: 'var(--accent)',
                        backgroundColor: 'var(--accent-subtle)',
                        padding: '0 6px',
                        borderRadius: '3px',
                        fontSize: '9px',
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                      }}>
                        NOW
                      </span>
                    )}
                  </div>
                  <div className="flex-1" style={{ height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: isNotStarted ? '0%' : `${pct}%`,
                      height: '100%',
                      backgroundColor: isComplete ? 'var(--color-success)' : isCurrent ? 'var(--accent)' : 'var(--text-tertiary)',
                      borderRadius: '3px',
                      transition: 'width 0.3s',
                      opacity: isNotStarted ? 0 : 1,
                    }} />
                  </div>
                  <span className="text-xs shrink-0" style={{ color: 'var(--text-tertiary)', width: '32px', textAlign: 'right' }}>
                    {isComplete ? '✓' : isNotStarted ? '—' : `${pct}%`}
                  </span>
                </div>
                {isCurrent && !isComplete && (
                  <div className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '2px', marginLeft: '110px', paddingLeft: '12px' }}>
                    {phase.question}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '20px 28px' }}>
        {/* Front Matter */}
        <div style={{ marginBottom: '28px' }}>
          <MatterList
            title="Front Matter"
            entries={frontMatter}
            onSelect={handleMatterSelect}
            onCreate={handleCreateFrontMatter}
            onRemove={handleRemoveFrontMatter}
          />
        </div>

        {/* Chapters */}
        <div style={{ marginBottom: '28px' }}>
          <ChapterList
            chapters={bookMeta.chapters}
            projectDir={projectDir}
            bookId={bookId}
            onSceneSelect={handleSceneSelect}
            onCreateChapter={handleCreateChapter}
            onCreateScene={handleCreateScene}
          />
        </div>

        {/* Back Matter */}
        <div style={{ marginBottom: '28px' }}>
          <MatterList
            title="Back Matter"
            entries={backMatter}
            onSelect={handleMatterSelect}
            onCreate={handleCreateBackMatter}
            onRemove={handleRemoveBackMatter}
          />
        </div>
      </div>
    </div>
  );
}
