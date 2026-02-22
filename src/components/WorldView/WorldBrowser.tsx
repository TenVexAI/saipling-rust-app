import { useState, useEffect, useCallback } from 'react';
import { Globe, FolderOpen, FileText, ChevronRight, ChevronDown, Folder, Plus } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { listDirectory, createDirectory, createFromTemplate } from '../../utils/tauri';
import type { FileEntry } from '../../types/project';

interface WorldFolder {
  name: string;
  path: string;
  entries: FileEntry[];
  expanded: boolean;
}

const WORLD_CATEGORIES = [
  { dir: 'locations', label: 'Locations' },
  { dir: 'factions', label: 'Factions' },
  { dir: 'technology', label: 'Technology' },
  { dir: 'history', label: 'History' },
  { dir: 'magic-systems', label: 'Magic Systems' },
  { dir: 'rules', label: 'Rules & Conventions' },
];

export function WorldBrowser() {
  const projectDir = useProjectStore((s) => s.projectDir);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const [worldBible, setWorldBible] = useState<FileEntry | null>(null);
  const [folders, setFolders] = useState<WorldFolder[]>([]);
  const [loading, setLoading] = useState(true);

  const worldDir = projectDir ? `${projectDir}\\world` : null;

  const loadWorld = useCallback(async () => {
    if (!worldDir) return;
    setLoading(true);
    try {
      const entries = await listDirectory(worldDir);
      const bible = entries.find((e) => e.name === 'world-bible.md') || null;
      setWorldBible(bible);

      const folderEntries: WorldFolder[] = [];
      for (const cat of WORLD_CATEGORIES) {
        const catDir = entries.find((e) => e.is_dir && e.name === cat.dir);
        if (catDir) {
          try {
            const children = await listDirectory(catDir.path);
            folderEntries.push({
              name: cat.label,
              path: catDir.path,
              entries: children.filter((c) => !c.is_dir).sort((a, b) => a.name.localeCompare(b.name)),
              expanded: true,
            });
          } catch {
            folderEntries.push({ name: cat.label, path: catDir.path, entries: [], expanded: true });
          }
        }
      }
      setFolders(folderEntries);
    } catch {
      setWorldBible(null);
      setFolders([]);
    }
    setLoading(false);
  }, [worldDir]);

  useEffect(() => {
    loadWorld();
  }, [loadWorld]);

  const toggleFolder = (index: number) => {
    setFolders((prev) =>
      prev.map((f, i) => (i === index ? { ...f, expanded: !f.expanded } : f))
    );
  };

  const handleAddEntry = async (folderPath: string, folderName: string) => {
    const name = prompt(`New ${folderName.toLowerCase().replace(/s$/, '')} name:`);
    if (!name?.trim()) return;
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
    const filePath = `${folderPath}\\${slug}.md`;
    try {
      await createFromTemplate(filePath, 'world-entry', { title: name.trim(), type: folderName });
      loadWorld();
    } catch {
      // Template might not exist, try creating directory and basic file
      try {
        await createDirectory(folderPath);
      } catch { /* may already exist */ }
      loadWorld();
    }
  };

  if (!projectDir) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
        <Globe size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
        <p className="text-sm">Open a project to browse world-building</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="shrink-0" style={{ padding: '24px 28px 16px', borderBottom: '1px solid var(--border-secondary)' }}>
        <div className="flex items-center gap-2">
          <Globe size={18} style={{ color: 'var(--accent)' }} />
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>World</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ padding: '16px 28px' }}>
        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: '24px', color: 'var(--text-tertiary)' }}>
            <span className="text-sm">Loading world data...</span>
          </div>
        ) : (
          <>
            {/* World Bible */}
            {worldBible && (
              <div style={{ marginBottom: '20px' }}>
                <button
                  onClick={() => setActiveFile(worldBible.path)}
                  className="flex items-center gap-2 w-full text-left rounded-lg transition-colors"
                  style={{ padding: '12px 14px', border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-elevated)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-primary)')}
                >
                  <FileText size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>World Bible</span>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '2px' }}>Core world rules, tone, and era</p>
                  </div>
                </button>
              </div>
            )}

            {/* Category Folders */}
            {folders.length === 0 && !worldBible ? (
              <div className="flex flex-col items-center" style={{ padding: '32px 0', color: 'var(--text-tertiary)' }}>
                <FolderOpen size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                <p className="text-sm">No world-building files found</p>
                <p className="text-xs" style={{ marginTop: '4px' }}>World data lives in the <code>world/</code> directory</p>
              </div>
            ) : (
              folders.map((folder, index) => (
                <div key={folder.path} style={{ marginBottom: '12px' }}>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => toggleFolder(index)}
                      className="flex items-center gap-2 text-left hover-sidebar rounded-md"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}
                    >
                      <span style={{ color: 'var(--text-tertiary)' }}>
                        {folder.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                      <Folder size={14} style={{ color: 'var(--text-tertiary)' }} />
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                        {folder.name}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}>
                        ({folder.entries.length})
                      </span>
                    </button>
                    <button
                      onClick={() => handleAddEntry(folder.path, folder.name)}
                      className="flex items-center hover-icon"
                      style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                      title={`Add ${folder.name}`}
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  {folder.expanded && folder.entries.length > 0 && (
                    <div style={{ paddingLeft: '24px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                      {folder.entries.map((entry) => (
                        <button
                          key={entry.path}
                          onClick={() => setActiveFile(entry.path)}
                          className="flex items-center gap-2 w-full text-left text-xs rounded-md transition-colors"
                          style={{ padding: '5px 10px', color: 'var(--text-primary)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <FileText size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                          <span className="truncate">{entry.name.replace(/\.md$/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
