import { useState, useEffect, useCallback, useRef } from 'react';
import { StickyNote, FileText, Plus, FolderOpen, X } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { listDirectory } from '../../utils/tauri';
import type { FileEntry } from '../../types/project';

export function NotesBrowser() {
  const projectDir = useProjectStore((s) => s.projectDir);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const [notes, setNotes] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewNoteModal, setShowNewNoteModal] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const notesDir = projectDir ? `${projectDir}\\notes` : null;

  const loadNotes = useCallback(async () => {
    if (!notesDir) return;
    setLoading(true);
    try {
      const entries = await listDirectory(notesDir);
      const noteFiles = entries
        .filter((e) => !e.is_dir && e.name.endsWith('.md'))
        .sort((a, b) => a.name.localeCompare(b.name));
      setNotes(noteFiles);
    } catch {
      setNotes([]);
    }
    setLoading(false);
  }, [notesDir]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleAddNote = () => {
    setNewNoteTitle('');
    setShowNewNoteModal(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleConfirmNewNote = () => {
    if (!newNoteTitle.trim() || !notesDir) return;
    const slug = newNoteTitle.trim().toLowerCase().replace(/\s+/g, '-');
    const path = `${notesDir}\\${slug}.md`;
    setShowNewNoteModal(false);
    setNewNoteTitle('');
    setActiveFile(path);
  };

  // Allow external trigger (hotkey) to open the new note modal
  useEffect(() => {
    const handler = () => handleAddNote();
    window.addEventListener('trigger-new-note', handler);
    return () => window.removeEventListener('trigger-new-note', handler);
  }, []);

  const formatName = (filename: string): string => {
    return filename
      .replace(/\.md$/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  if (!projectDir) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
        <StickyNote size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
        <p className="text-sm">Open a project to browse notes</p>
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="shrink-0" style={{ padding: '24px 28px 16px', borderBottom: '1px solid var(--border-secondary)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StickyNote size={18} style={{ color: 'var(--accent)' }} />
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Notes</h1>
          </div>
          <button
            onClick={handleAddNote}
            className="flex items-center gap-1 text-xs hover-action"
            style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <Plus size={14} />
            New
          </button>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '6px' }}>
          Ctrl+Shift+N to create a new note anytime
        </p>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ padding: '16px 28px' }}>
        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: '24px', color: 'var(--text-tertiary)' }}>
            <span className="text-sm">Loading notes...</span>
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center" style={{ padding: '32px 0', color: 'var(--text-tertiary)' }}>
            <FolderOpen size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <p className="text-sm">No notes yet</p>
            <p className="text-xs" style={{ marginTop: '4px' }}>Notes live in the <code>notes/</code> directory</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {notes.map((note) => (
              <button
                key={note.path}
                onClick={() => setActiveFile(note.path)}
                className="flex items-center gap-3 w-full text-left rounded-lg transition-colors"
                style={{ padding: '10px 14px' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <FileText size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                  {formatName(note.name)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* New Note Modal */}
    {showNewNoteModal && (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
        onClick={() => setShowNewNoteModal(false)}
      >
        <div
          className="rounded-xl"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            padding: '24px',
            width: '360px',
            maxWidth: '90vw',
            boxShadow: 'var(--shadow-lg)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              New Note
            </h2>
            <button
              onClick={() => setShowNewNoteModal(false)}
              className="hover-icon"
              style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
            >
              <X size={16} />
            </button>
          </div>

          <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Note title
          </label>
          <input
            ref={inputRef}
            value={newNoteTitle}
            onChange={(e) => setNewNoteTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmNewNote(); if (e.key === 'Escape') setShowNewNoteModal(false); }}
            placeholder="e.g. Character Ideas"
            className="w-full rounded-lg text-sm"
            style={{
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-primary)',
              padding: '10px 12px',
              marginBottom: '20px',
            }}
          />

          <div className="flex justify-end" style={{ gap: '8px' }}>
            <button
              onClick={() => setShowNewNoteModal(false)}
              className="rounded-lg text-xs font-medium hover-btn"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)',
                padding: '8px 16px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmNewNote}
              disabled={!newNoteTitle.trim()}
              className="rounded-lg text-xs font-medium hover-btn-primary"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--text-inverse)',
                border: 'none',
                padding: '8px 16px',
                cursor: newNoteTitle.trim() ? 'pointer' : 'default',
                opacity: newNoteTitle.trim() ? 1 : 0.5,
              }}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
