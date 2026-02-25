import { useState, useEffect, useCallback, useRef } from 'react';
import { Users, FileText, Plus, Link2, X } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { listDirectory, createDirectory, writeFile } from '../../utils/tauri';
import type { FileEntry } from '../../types/project';

export function CharacterList() {
  const projectDir = useProjectStore((s) => s.projectDir);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const [characters, setCharacters] = useState<FileEntry[]>([]);
  const [relationships, setRelationships] = useState<FileEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newCharName, setNewCharName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const charsDir = projectDir ? `${projectDir}\\characters` : null;

  const loadCharacters = useCallback(async () => {
    if (!charsDir) return;
    setLoading(true);
    try {
      const entries = await listDirectory(charsDir);
      const relFile = entries.find((e) => e.name === '_relationships.md') || null;
      const charDirs = entries
        .filter((e) => e.is_dir)
        .sort((a, b) => a.name.localeCompare(b.name));
      setRelationships(relFile);
      setCharacters(charDirs);
    } catch {
      setCharacters([]);
      setRelationships(null);
    }
    setLoading(false);
  }, [charsDir]);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  const handleOpenNewModal = () => {
    setNewCharName('');
    setShowNewModal(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleConfirmNewCharacter = async () => {
    if (!newCharName.trim() || !charsDir) return;
    const name = newCharName.trim();
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const charDir = `${charsDir}\\${slug}`;
    const brainstormPath = `${charDir}\\brainstorm.md`;
    setShowNewModal(false);
    setNewCharName('');
    try {
      await createDirectory(charDir);
      const now = new Date().toISOString().slice(0, 10);
      const frontmatter: Record<string, unknown> = {
        type: 'brainstorm',
        scope: 'series',
        subject: 'character',
        character_id: slug,
        created: now,
        modified: now,
        status: 'empty',
      };
      const body = `# Character Brainstorm — ${name}\n\nDump everything you know or feel about this character. Don't worry about filling\nin every detail — just capture what's alive in your imagination right now.\n\nThink about:\n- Who is this person at their core?\n- What do they want more than anything? (their conscious desire)\n- What do they actually need? (often different from what they want)\n- What's their biggest flaw or blind spot?\n- What happened in their past that shaped who they are today?\n- How do they talk? What makes their voice distinctive?\n- What are their key relationships?\n- What role do they play in the story?\n- How will they change by the end?\n\nWrite freely below.\n\n---\n\n`;
      await writeFile(brainstormPath, frontmatter, body);
      await loadCharacters();
      setActiveFile(brainstormPath);
    } catch (e) {
      console.error('Failed to create character:', e);
    }
  };

  const formatName = (dirOrFileName: string): string => {
    return dirOrFileName
      .replace(/\.md$/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  if (!projectDir) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
        <Users size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
        <p className="text-sm">Open a project to view characters</p>
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="shrink-0" style={{ padding: '24px 28px 16px', borderBottom: '1px solid var(--border-secondary)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={18} style={{ color: 'var(--accent)' }} />
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Characters</h1>
          </div>
          <button
            onClick={handleOpenNewModal}
            className="flex items-center gap-1 text-xs hover-action"
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
            <span className="text-sm">Loading characters...</span>
          </div>
        ) : (
          <>
            {/* Relationships File */}
            {relationships && (
              <div style={{ marginBottom: '16px' }}>
                <button
                  onClick={() => setActiveFile(relationships.path)}
                  className="flex items-center gap-2 w-full text-left rounded-lg transition-colors"
                  style={{ padding: '12px 14px', border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-elevated)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-primary)')}
                >
                  <Link2 size={16} style={{ color: 'var(--color-magenta)', flexShrink: 0 }} />
                  <div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Relationship Map</span>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '2px' }}>Character dynamics and connections</p>
                  </div>
                </button>
              </div>
            )}

            {/* Character Cards */}
            {characters.length === 0 ? (
              <div className="flex flex-col items-center" style={{ padding: '32px 0', color: 'var(--text-tertiary)' }}>
                <Users size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                <p className="text-sm">No characters yet</p>
                <p className="text-xs" style={{ marginTop: '4px' }}>Characters live in the <code>characters/</code> directory</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                {characters.map((char) => (
                  <button
                    key={char.path}
                    onClick={() => setActiveFile(`${char.path}\\brainstorm.md`)}
                    className="flex items-start gap-3 text-left rounded-xl transition-all"
                    style={{
                      padding: '14px',
                      border: '1px solid var(--border-primary)',
                      backgroundColor: 'var(--bg-elevated)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-primary)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div
                      className="flex items-center justify-center shrink-0 rounded-full text-xs font-bold"
                      style={{
                        width: '32px',
                        height: '32px',
                        backgroundColor: 'var(--accent-subtle)',
                        color: 'var(--accent)',
                      }}
                    >
                      {formatName(char.name).charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-medium block truncate" style={{ color: 'var(--text-primary)' }}>
                        {formatName(char.name)}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        <FileText size={10} style={{ display: 'inline', marginRight: '4px' }} />
                        Character brainstorm
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>

    {/* New Character Modal */}
    {showNewModal && (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
        onClick={() => setShowNewModal(false)}
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
              New Character
            </h2>
            <button
              onClick={() => setShowNewModal(false)}
              className="hover-icon"
              style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
            >
              <X size={16} />
            </button>
          </div>

          <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Character name
          </label>
          <input
            ref={inputRef}
            value={newCharName}
            onChange={(e) => setNewCharName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmNewCharacter(); if (e.key === 'Escape') setShowNewModal(false); }}
            placeholder="e.g. Marcus Cole"
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
              onClick={() => setShowNewModal(false)}
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
              onClick={handleConfirmNewCharacter}
              disabled={!newCharName.trim()}
              className="rounded-lg text-xs font-medium hover-btn-primary"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--text-inverse)',
                border: 'none',
                padding: '8px 16px',
                cursor: newCharName.trim() ? 'pointer' : 'default',
                opacity: newCharName.trim() ? 1 : 0.5,
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
