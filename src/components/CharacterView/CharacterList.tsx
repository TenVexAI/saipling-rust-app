import { useState, useEffect, useCallback } from 'react';
import { Users, FileText, Plus, Link2 } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { listDirectory } from '../../utils/tauri';
import type { FileEntry } from '../../types/project';

export function CharacterList() {
  const projectDir = useProjectStore((s) => s.projectDir);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const [characters, setCharacters] = useState<FileEntry[]>([]);
  const [relationships, setRelationships] = useState<FileEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const charsDir = projectDir ? `${projectDir}\\characters` : null;

  const loadCharacters = useCallback(async () => {
    if (!charsDir) return;
    setLoading(true);
    try {
      const entries = await listDirectory(charsDir);
      const relFile = entries.find((e) => e.name === '_relationships.md') || null;
      const charFiles = entries
        .filter((e) => !e.is_dir && e.name.endsWith('.md') && e.name !== '_relationships.md')
        .sort((a, b) => a.name.localeCompare(b.name));
      setRelationships(relFile);
      setCharacters(charFiles);
    } catch {
      setCharacters([]);
      setRelationships(null);
    }
    setLoading(false);
  }, [charsDir]);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  const handleAddCharacter = () => {
    const name = prompt('Character name:');
    if (!name?.trim() || !charsDir) return;
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
    const path = `${charsDir}\\${slug}.md`;
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
        <Users size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
        <p className="text-sm">Open a project to view characters</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="shrink-0" style={{ padding: '24px 28px 16px', borderBottom: '1px solid var(--border-secondary)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={18} style={{ color: 'var(--accent)' }} />
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Characters</h1>
          </div>
          <button
            onClick={handleAddCharacter}
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
                    onClick={() => setActiveFile(char.path)}
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
                        Character sheet
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
  );
}
