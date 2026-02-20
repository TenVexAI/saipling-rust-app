import { useProjectStore } from '../../stores/projectStore';
import { useEditorStore } from '../../stores/editorStore';
import { useAIStore } from '../../stores/aiStore';

export function Footer() {
  const project = useProjectStore((s) => s.project);
  const activeBookId = useProjectStore((s) => s.activeBookId);
  const activeChapterId = useProjectStore((s) => s.activeChapterId);
  const activeSceneId = useProjectStore((s) => s.activeSceneId);
  const wordCount = useEditorStore((s) => s.wordCount);
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const lastCost = useAIStore((s) => s.lastCost);

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
        <span>v0.1.0</span>
        {contextParts.length > 0 && (
          <>
            <span style={{ color: 'var(--border-primary)' }}>│</span>
            <span>{contextParts.join(' › ')}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {wordCount > 0 && (
          <span>{wordCount.toLocaleString()} words</span>
        )}
        {lastCost && (
          <>
            <span style={{ color: 'var(--border-primary)' }}>│</span>
            <span>~{lastCost}</span>
          </>
        )}
        <span style={{ color: 'var(--border-primary)' }}>│</span>
        <span style={{ color: saveColor }}>● {saveStatus}</span>
      </div>
    </div>
  );
}
