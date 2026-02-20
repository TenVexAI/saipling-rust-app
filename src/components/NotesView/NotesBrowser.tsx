import { useState, useEffect, useCallback } from 'react';
import { StickyNote, FileText, Plus, FolderOpen } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { listDirectory } from '../../utils/tauri';
import type { FileEntry } from '../../types/project';

export function NotesBrowser() {
  const projectDir = useProjectStore((s) => s.projectDir);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const [notes, setNotes] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);

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
    const name = prompt('Note title:');
    if (!name?.trim() || !notesDir) return;
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
    const path = `${notesDir}\\${slug}.md`;
    setActiveFile(path);
  };

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
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="shrink-0" style={{ padding: '24px 28px 16px', borderBottom: '1px solid var(--border-secondary)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StickyNote size={18} style={{ color: 'var(--accent)' }} />
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Notes</h1>
          </div>
          <button
            onClick={handleAddNote}
            className="flex items-center gap-1 text-xs transition-colors"
            style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <Plus size={14} />
            New
          </button>
        </div>
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
  );
}
