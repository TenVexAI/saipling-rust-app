import { useState, useCallback, useEffect } from 'react';
import { X, Check, FileText } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { writeFile } from '../../utils/tauri';
import { parseFrontmatter } from '../../utils/markdown';

interface ApplyEditModalProps {
  target: string;
  content: string;
  onClose: () => void;
  onApplied: () => void;
}

export function ApplyEditModal({ target, content, onClose, onApplied }: ApplyEditModalProps) {
  const projectDir = useProjectStore((s) => s.projectDir);
  const [editedContent, setEditedContent] = useState(content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleApply = useCallback(async () => {
    if (!projectDir) return;
    setSaving(true);
    setError('');
    try {
      const fullPath = `${projectDir}\\${target.replace(/\//g, '\\\\')}`;
      const { frontmatter, body } = parseFrontmatter(editedContent);
      await writeFile(fullPath, frontmatter, body);
      useProjectStore.getState().bumpRefresh();
      onApplied();
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  }, [projectDir, target, editedContent, onApplied]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        className="rounded-xl flex flex-col"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          width: '720px',
          maxWidth: '90vw',
          height: '80vh',
          maxHeight: '800px',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-primary)',
          }}
        >
          <div className="flex items-center gap-2">
            <FileText size={16} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Edit Before Applying
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover-icon"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Target path */}
        <div
          className="shrink-0 px-5 py-2 text-xs font-mono truncate"
          style={{
            color: 'var(--text-tertiary)',
            backgroundColor: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border-secondary)',
          }}
        >
          {target}
        </div>

        {/* Editor area */}
        <div className="flex-1 min-h-0" style={{ padding: '0' }}>
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="w-full h-full resize-none font-mono text-sm"
            style={{
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: 'none',
              outline: 'none',
              padding: '16px 20px',
              lineHeight: '1.6',
              tabSize: 2,
            }}
            spellCheck={false}
          />
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-primary)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <div className="text-xs" style={{ color: 'var(--color-error)' }}>
            {error}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded text-xs font-medium"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-primary)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium"
              style={{
                backgroundColor: 'var(--color-success)',
                color: '#fff',
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Check size={12} />
              {saving ? 'Applying...' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
