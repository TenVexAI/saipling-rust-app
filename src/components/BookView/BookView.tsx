import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Target, PenTool, Download } from 'lucide-react';
import { ChapterList } from './ChapterList';
import { MatterList } from './MatterList';
import { useProjectStore } from '../../stores/projectStore';
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
} from '../../utils/tauri';
import type { BookMetadata, MatterEntry } from '../../types/project';
import { ExportDialog } from './ExportDialog';

export function BookView() {
  const project = useProjectStore((s) => s.project);
  const projectDir = useProjectStore((s) => s.projectDir);
  const activeBookId = useProjectStore((s) => s.activeBookId);
  const setActiveBook = useProjectStore((s) => s.setActiveBook);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);

  const [bookMeta, setBookMeta] = useState<BookMetadata | null>(null);
  const [frontMatter, setFrontMatter] = useState<MatterEntry[]>([]);
  const [backMatter, setBackMatter] = useState<MatterEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showExport, setShowExport] = useState(false);

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

  const handleCreateChapter = async () => {
    if (!projectDir || !bookId) return;
    const title = `Chapter ${(bookMeta?.chapters.length ?? 0) + 1}`;
    try {
      await createChapter(projectDir, bookId, title);
      loadBook();
    } catch { /* ignore */ }
  };

  const handleCreateScene = async (chapterId: string) => {
    if (!projectDir || !bookId) return;
    const chapter = bookMeta?.chapters.find((c) => c.id === chapterId);
    const title = `Scene ${(chapter?.scenes.length ?? 0) + 1}`;
    try {
      await createScene(projectDir, bookId, chapterId, title, 'action');
      loadBook();
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
    } catch { /* ignore */ }
  };

  const handleCreateBackMatter = async (subtype: string) => {
    if (!projectDir || !bookId) return;
    try {
      await createBackMatter(projectDir, bookId, subtype);
      loadBook();
    } catch { /* ignore */ }
  };

  const handleRemoveFrontMatter = async (subtype: string) => {
    if (!projectDir || !bookId) return;
    try {
      await removeFrontMatter(projectDir, bookId, subtype);
      loadBook();
    } catch { /* ignore */ }
  };

  const handleRemoveBackMatter = async (subtype: string) => {
    if (!projectDir || !bookId) return;
    try {
      await removeBackMatter(projectDir, bookId, subtype);
      loadBook();
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
          <button
            onClick={() => setShowExport(true)}
            className="shrink-0 flex items-center gap-1.5 rounded-lg text-xs font-medium hover-btn"
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-secondary)',
              marginTop: '2px',
            }}
            title="Export book"
          >
            <Download size={13} />
            Export
          </button>
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
