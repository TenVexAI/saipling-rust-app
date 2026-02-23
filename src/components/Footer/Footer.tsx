import { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useEditorStore } from '../../stores/editorStore';
import { getBookTotalDocWords, getProjectTotalDocWords } from '../../utils/tauri';

export function Footer() {
  const project = useProjectStore((s) => s.project);
  const activeBookId = useProjectStore((s) => s.activeBookId);
  const activeChapterId = useProjectStore((s) => s.activeChapterId);
  const activeSceneId = useProjectStore((s) => s.activeSceneId);
  const projectDir = useProjectStore((s) => s.projectDir);
  const totalProjectCost = useProjectStore((s) => s.totalProjectCost);
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const [bookTokens, setBookTokens] = useState(0);
  const [projectTokens, setProjectTokens] = useState(0);

  useEffect(() => {
    if (!projectDir || !activeBookId) {
      setBookTokens(0);
      return;
    }
    getBookTotalDocWords(projectDir, activeBookId).then((total) => setBookTokens(Math.round(total * 0.75))).catch(() => setBookTokens(0));
  }, [projectDir, activeBookId]);

  useEffect(() => {
    if (!projectDir) {
      setProjectTokens(0);
      return;
    }
    getProjectTotalDocWords(projectDir).then((total) => setProjectTokens(Math.round(total * 0.75))).catch(() => setProjectTokens(0));
  }, [projectDir]);

  const bookTitle = project?.books.find((b) => b.id === activeBookId)?.title;

  const contextParts = [
    bookTitle,
    activeChapterId,
    activeSceneId,
  ].filter(Boolean);

  const saveStatus = isSaving ? 'Saving...' : isDirty ? 'Unsaved' : 'Saved';
  const saveColor = isSaving
    ? 'var(--color-warning)'
    : isDirty
    ? 'var(--color-error)'
    : 'var(--color-success)';

  return (
    <div
      className="flex items-center justify-between text-xs select-none shrink-0"
      style={{
        height: 'var(--footer-height)',
        backgroundColor: 'var(--bg-sidebar)',
        borderTop: '1px solid var(--border-primary)',
        color: 'var(--text-tertiary)',
        padding: '0 12px',
      }}
    >
      <div className="flex items-center gap-3">
        {contextParts.length > 0 && (
          <span>{contextParts.join(' › ')}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {bookTokens > 0 && (
          <span>Book Tokens: ~{bookTokens.toLocaleString()}</span>
        )}
        {projectTokens > 0 && (
          <>
            {bookTokens > 0 && <span style={{ color: 'var(--border-primary)' }}>│</span>}
            <span>Project Tokens: ~{projectTokens.toLocaleString()}</span>
          </>
        )}
        {totalProjectCost > 0 && (
          <>
            <span style={{ color: 'var(--border-primary)' }}>│</span>
            <span>AI: ${totalProjectCost.toFixed(4)}</span>
          </>
        )}
        <span style={{ color: 'var(--border-primary)' }}>│</span>
        <span style={{ color: saveColor }}>● {saveStatus}</span>
      </div>
    </div>
  );
}
