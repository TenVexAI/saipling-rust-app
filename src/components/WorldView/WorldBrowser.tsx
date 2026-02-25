import { useState, useEffect, useCallback, useRef } from 'react';
import { Globe, FolderOpen, FileText, ChevronRight, ChevronDown, Folder, Plus, X } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { listDirectory, createDirectory, writeFile } from '../../utils/tauri';
import type { FileEntry } from '../../types/project';

interface WorldFolder {
  slug: string;
  name: string;
  path: string;
  entries: FileEntry[];
  expanded: boolean;
}

interface SectionDef {
  slug: string;
  label: string;
  description: string;
}

const SECTION_GROUPS: { group: string; sections: SectionDef[] }[] = [
  {
    group: 'Common',
    sections: [
      { slug: 'history', label: 'History & Backstory', description: 'Events that precede the story' },
      { slug: 'factions', label: 'Factions & Organizations', description: 'Groups, companies, families, agencies' },
      { slug: 'culture', label: 'Culture & Society', description: 'Customs, social norms, class structures, daily life' },
      { slug: 'rules', label: 'Rules & Conventions', description: 'Genre-specific logic, story-world constraints' },
    ],
  },
  {
    group: 'Genre-leaning',
    sections: [
      { slug: 'technology', label: 'Technology', description: 'Systems, devices, infrastructure' },
      { slug: 'magic-systems', label: 'Magic Systems', description: 'Rules, costs, limitations' },
      { slug: 'religion', label: 'Religion & Belief Systems', description: 'Faiths, philosophies, superstitions' },
      { slug: 'government', label: 'Government & Politics', description: 'Power structures, laws, jurisdictions' },
      { slug: 'economy', label: 'Economy & Trade', description: 'Money, resources, commerce, wealth dynamics' },
      { slug: 'flora-fauna', label: 'Flora & Fauna', description: 'Creatures, plants, ecosystems' },
    ],
  },
  {
    group: 'Specialized',
    sections: [
      { slug: 'languages', label: 'Languages & Communication', description: 'Dialects, slang, constructed languages, codes' },
      { slug: 'mythology', label: 'Mythology & Legends', description: 'In-world myths, prophecies, folklore' },
      { slug: 'geography', label: 'Geography & Climate', description: 'Physical world, weather patterns, natural features' },
      { slug: 'medicine', label: 'Medicine & Science', description: 'Medical systems, scientific understanding, health' },
      { slug: 'arts', label: 'Arts & Entertainment', description: 'In-world media, music, literature, sports' },
      { slug: 'food', label: 'Food & Cuisine', description: 'Culinary traditions' },
      { slug: 'calendar', label: 'Calendar & Timekeeping', description: 'Seasons, festivals, how time is marked' },
      { slug: 'transportation', label: 'Transportation & Travel', description: 'How people get around, travel times, infrastructure' },
    ],
  },
];

const ALL_SECTIONS: Record<string, string> = { locations: 'Locations', items: 'Items' };
for (const group of SECTION_GROUPS) {
  for (const s of group.sections) {
    ALL_SECTIONS[s.slug] = s.label;
  }
}

export function WorldBrowser() {
  const projectDir = useProjectStore((s) => s.projectDir);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const [folders, setFolders] = useState<WorldFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewSection, setShowNewSection] = useState(false);
  const [customName, setCustomName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showNewEntryModal, setShowNewEntryModal] = useState(false);
  const [newEntryName, setNewEntryName] = useState('');
  const [newEntryFolder, setNewEntryFolder] = useState<{ path: string; name: string; slug: string } | null>(null);
  const entryInputRef = useRef<HTMLInputElement>(null);

  const worldDir = projectDir ? `${projectDir}\\world` : null;

  const loadWorld = useCallback(async () => {
    if (!worldDir) return;
    setLoading(true);
    try {
      const entries = await listDirectory(worldDir);
      const folderEntries: WorldFolder[] = [];
      const dirs = entries.filter((e) => e.is_dir).sort((a, b) => a.name.localeCompare(b.name));
      for (const dir of dirs) {
        const label = ALL_SECTIONS[dir.name] || dir.name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        try {
          const children = await listDirectory(dir.path);
          folderEntries.push({
            slug: dir.name,
            name: label,
            path: dir.path,
            entries: children.filter((c) => c.is_dir).sort((a, b) => a.name.localeCompare(b.name)),
            expanded: true,
          });
        } catch {
          folderEntries.push({ slug: dir.name, name: label, path: dir.path, entries: [], expanded: true });
        }
      }
      setFolders(folderEntries);
    } catch {
      setFolders([]);
    }
    setLoading(false);
  }, [worldDir]);

  useEffect(() => {
    loadWorld();
  }, [loadWorld]);

  useEffect(() => {
    if (!showNewSection) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNewSection(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNewSection]);

  const toggleFolder = (index: number) => {
    setFolders((prev) =>
      prev.map((f, i) => (i === index ? { ...f, expanded: !f.expanded } : f))
    );
  };

  const existingSlugs = new Set(folders.map((f) => f.slug));

  const handleCreateSection = async (slug: string) => {
    if (!worldDir) return;
    try {
      await createDirectory(`${worldDir}\\${slug}`);
      setShowNewSection(false);
      setCustomName('');
      loadWorld();
    } catch { /* may already exist */ }
  };

  const handleOpenNewEntry = (folderPath: string, folderName: string, folderSlug: string) => {
    setNewEntryName('');
    setNewEntryFolder({ path: folderPath, name: folderName, slug: folderSlug });
    setShowNewEntryModal(true);
    setTimeout(() => entryInputRef.current?.focus(), 50);
  };

  const handleConfirmNewEntry = async () => {
    if (!newEntryName.trim() || !newEntryFolder) return;
    const name = newEntryName.trim();
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const entryDir = `${newEntryFolder.path}\\${slug}`;
    const brainstormPath = `${entryDir}\\brainstorm.md`;
    setShowNewEntryModal(false);
    setNewEntryName('');
    try {
      await createDirectory(entryDir);
      const now = new Date().toISOString().slice(0, 10);
      const frontmatter: Record<string, unknown> = {
        type: 'brainstorm',
        scope: 'series',
        subject: 'world-entry',
        category: newEntryFolder.slug,
        entry_id: slug,
        created: now,
        modified: now,
        status: 'empty',
      };
      const body = `# World Entry Brainstorm \u2014 ${name}\n\nDump everything you know about this element of your world. Remember: every\nworld-building detail should ultimately serve your story \u2014 connecting to\ncharacters, conflict, or theme.\n\nThink about:\n- What is it and how does it work?\n- What are its rules and limitations?\n- How does it affect daily life in your world?\n- How does it create conflict or story possibilities?\n- What's its history \u2014 how did it come to exist?\n- How do different characters or groups relate to it?\n\nWrite freely below.\n\n---\n\n`;
      await writeFile(brainstormPath, frontmatter, body);
      loadWorld();
      setActiveFile(brainstormPath);
    } catch (e) {
      console.error('Failed to create world entry:', e);
    }
    setNewEntryFolder(null);
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
    <>
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="shrink-0" style={{ padding: '24px 28px 16px', borderBottom: '1px solid var(--border-secondary)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe size={18} style={{ color: 'var(--accent)' }} />
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>World Bible</h1>
          </div>
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              onClick={() => setShowNewSection((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg text-xs font-medium hover-btn"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)',
                padding: '6px 12px',
              }}
            >
              <Plus size={14} />
              New Section
            </button>

            {showNewSection && (
              <div
                className="rounded-lg"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  width: '280px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-primary)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 100,
                  padding: '8px 0',
                }}
              >
                {SECTION_GROUPS.map((group) => {
                  const available = group.sections.filter((s) => !existingSlugs.has(s.slug));
                  if (available.length === 0) return null;
                  return (
                    <div key={group.group}>
                      <div
                        className="text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-tertiary)', padding: '8px 14px 4px' }}
                      >
                        {group.group}
                      </div>
                      {available.map((s) => (
                        <button
                          key={s.slug}
                          onClick={() => handleCreateSection(s.slug)}
                          className="flex flex-col w-full text-left"
                          style={{ padding: '6px 14px', cursor: 'pointer', background: 'none', border: 'none' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{s.label}</span>
                          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{s.description}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}

                {/* Custom section */}
                <div
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-tertiary)', padding: '8px 14px 4px', borderTop: '1px solid var(--border-primary)', marginTop: '4px' }}
                >
                  Custom
                </div>
                <div style={{ padding: '4px 14px 8px', display: 'flex', gap: '6px' }}>
                  <input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Section name..."
                    className="flex-1 rounded text-xs"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-primary)',
                      color: 'var(--text-primary)',
                      padding: '4px 8px',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customName.trim()) {
                        handleCreateSection(customName.trim().toLowerCase().replace(/\s+/g, '-'));
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (customName.trim()) {
                        handleCreateSection(customName.trim().toLowerCase().replace(/\s+/g, '-'));
                      }
                    }}
                    disabled={!customName.trim()}
                    className="rounded text-xs font-medium"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--text-inverse)',
                      border: 'none',
                      padding: '4px 10px',
                      cursor: customName.trim() ? 'pointer' : 'default',
                      opacity: customName.trim() ? 1 : 0.5,
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ padding: '16px 28px' }}>
        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: '24px', color: 'var(--text-tertiary)' }}>
            <span className="text-sm">Loading world data...</span>
          </div>
        ) : (
          <>
            {folders.length === 0 ? (
              <div className="flex flex-col items-center" style={{ padding: '32px 0', color: 'var(--text-tertiary)' }}>
                <FolderOpen size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                <p className="text-sm">No world-building sections yet</p>
                <p className="text-xs" style={{ marginTop: '4px' }}>Click <strong>+ New Section</strong> to add one</p>
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
                      onClick={() => handleOpenNewEntry(folder.path, folder.name, folder.slug)}
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
                          onClick={() => setActiveFile(`${entry.path}\\brainstorm.md`)}
                          className="flex items-center gap-2 w-full text-left text-xs rounded-md transition-colors"
                          style={{ padding: '5px 10px', color: 'var(--text-primary)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <FileText size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                          <span className="truncate">{entry.name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>
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

    {/* New Entry Modal */}
    {showNewEntryModal && newEntryFolder && (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
        onClick={() => { setShowNewEntryModal(false); setNewEntryFolder(null); }}
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
              New {newEntryFolder.name} Entry
            </h2>
            <button
              onClick={() => { setShowNewEntryModal(false); setNewEntryFolder(null); }}
              className="hover-icon"
              style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
            >
              <X size={16} />
            </button>
          </div>

          <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Entry name
          </label>
          <input
            ref={entryInputRef}
            value={newEntryName}
            onChange={(e) => setNewEntryName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmNewEntry(); if (e.key === 'Escape') { setShowNewEntryModal(false); setNewEntryFolder(null); } }}
            placeholder="e.g. Warp Drive"
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
              onClick={() => { setShowNewEntryModal(false); setNewEntryFolder(null); }}
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
              onClick={handleConfirmNewEntry}
              disabled={!newEntryName.trim()}
              className="rounded-lg text-xs font-medium hover-btn-primary"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--text-inverse)',
                border: 'none',
                padding: '8px 16px',
                cursor: newEntryName.trim() ? 'pointer' : 'default',
                opacity: newEntryName.trim() ? 1 : 0.5,
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
