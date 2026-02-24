import { useState, useEffect, useCallback } from 'react';
import {
  FolderOpen, RefreshCw, ChevronRight, ChevronDown, Folder, FolderOpenIcon,
  FileText, File, Image, ExternalLink, Pencil, Trash2, AlertTriangle,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { listDirectory, deleteEntry, readFile, writeFile, revealInExplorer } from '../../utils/tauri';
import type { FileEntry } from '../../types/project';

type ContextMode = 'auto' | 'exclude' | 'force';

interface ContextSettingsMap {
  [filePath: string]: ContextMode;
}

export function ContextSettings() {
  const projectDir = useProjectStore((s) => s.projectDir);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const expandFolder = useProjectStore((s) => s.contextExpandFolder);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [contextSettings, setContextSettings] = useState<ContextSettingsMap>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const settingsPath = projectDir ? `${projectDir}\\.context_settings.json` : null;

  const loadContextSettings = useCallback(async () => {
    if (!settingsPath) return;
    try {
      const content = await readFile(settingsPath);
      const parsed = JSON.parse(content.body);
      setContextSettings(parsed);
    } catch {
      setContextSettings({});
    }
  }, [settingsPath]);

  const saveContextSettings = useCallback(async (updated: ContextSettingsMap) => {
    if (!settingsPath) return;
    try {
      await writeFile(settingsPath, {}, JSON.stringify(updated, null, 2));
      useProjectStore.getState().bumpRefresh();
    } catch (e) {
      console.error('Failed to save context settings:', e);
    }
  }, [settingsPath]);

  const loadRoot = useCallback(async () => {
    if (!projectDir) return;
    setLoading(true);
    try {
      const items = await listDirectory(projectDir);
      const sorted = items
        .filter((e) => !e.name.startsWith('.'))
        .sort((a, b) => {
          if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      setEntries(sorted);
    } catch {
      setEntries([]);
    }
    setLoading(false);
  }, [projectDir]);

  useEffect(() => {
    loadRoot();
    loadContextSettings();
  }, [loadRoot, loadContextSettings]);

  const handleContextChange = async (filePath: string, mode: ContextMode) => {
    const updated = { ...contextSettings };
    if (mode === 'auto') {
      delete updated[filePath];
    } else {
      updated[filePath] = mode;
    }
    setContextSettings(updated);
    await saveContextSettings(updated);
  };

  const handleOpenInExplorer = async (filePath: string) => {
    try {
      await revealInExplorer(filePath);
    } catch (e) {
      console.error('Failed to open:', e);
    }
  };

  const handleDelete = async (filePath: string) => {
    try {
      await deleteEntry(filePath);
      setDeleteConfirm(null);
      loadRoot();
      useProjectStore.getState().bumpRefresh();
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  };

  if (!projectDir) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
        <FolderOpen size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
        <p className="text-sm">Open a project to manage files</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div
        className="flex items-center justify-between shrink-0"
        style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-secondary)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Project Files & Context Settings
        </h2>
        <button
          onClick={loadRoot}
          className="flex items-center justify-center hover-icon"
          style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ padding: '8px 0' }}>
        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: '24px', color: 'var(--text-tertiary)' }}>
            <span className="text-xs">Loading...</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center" style={{ padding: '24px', color: 'var(--text-tertiary)' }}>
            <span className="text-xs">Empty project directory</span>
          </div>
        ) : (
          entries.map((entry) => (
            <ContextFileTreeItem
              key={entry.path}
              entry={entry}
              depth={0}
              contextSettings={contextSettings}
              onContextChange={handleContextChange}
              onEdit={setActiveFile}
              onOpenExplorer={handleOpenInExplorer}
              onDelete={(path) => setDeleteConfirm(path)}
              expandFolder={expandFolder ?? undefined}
            />
          ))
        )}
      </div>

      {deleteConfirm && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="rounded-xl"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-primary)',
              padding: '20px',
              width: '360px',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2" style={{ marginBottom: '12px' }}>
              <AlertTriangle size={18} style={{ color: 'var(--color-error)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Delete File</h3>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Are you sure you want to delete this file?
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)', marginBottom: '16px' }}>
              {deleteConfirm.split(/[\\/]/).pop()}
            </p>
            <div className="flex justify-end" style={{ gap: '8px' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg text-xs hover-btn"
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', padding: '6px 14px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="rounded-lg text-xs font-medium"
                style={{ backgroundColor: 'var(--color-error)', color: '#fff', border: 'none', padding: '6px 14px', cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── File Tree Item with Context Controls ───

function getFileIcon(entry: FileEntry) {
  if (entry.is_dir) return null;
  const ext = entry.name.split('.').pop()?.toLowerCase();
  if (ext === 'md') return <FileText size={14} />;
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext || '')) return <Image size={14} />;
  return <File size={14} />;
}

interface ContextFileTreeItemProps {
  entry: FileEntry;
  depth: number;
  contextSettings: ContextSettingsMap;
  onContextChange: (path: string, mode: ContextMode) => void;
  onEdit: (path: string) => void;
  onOpenExplorer: (path: string) => void;
  onDelete: (path: string) => void;
  expandFolder?: string;
}

function ContextFileTreeItem({
  entry, depth, contextSettings, onContextChange, onEdit, onOpenExplorer, onDelete, expandFolder,
}: ContextFileTreeItemProps) {
  const shouldAutoExpand = expandFolder ? entry.is_dir && entry.path.replace(/\\/g, '/').includes(expandFolder.replace(/\\/g, '/')) : false;
  const [expanded, setExpanded] = useState(shouldAutoExpand);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isHidden = entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'exports';

  const contextMode: ContextMode = contextSettings[entry.path] || 'auto';

  const handleToggle = async () => {
    if (!entry.is_dir) return;
    if (!loaded) {
      try {
        const entries = await listDirectory(entry.path);
        const sorted = entries
          .filter((e) => !e.name.startsWith('.'))
          .sort((a, b) => {
            if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
        setChildren(sorted);
        setLoaded(true);
      } catch {
        setChildren([]);
        setLoaded(true);
      }
    }
    setExpanded(!expanded);
  };

  // Auto-expand on mount if needed
  useEffect(() => {
    if (shouldAutoExpand && !loaded && entry.is_dir) {
      listDirectory(entry.path).then((entries) => {
        const sorted = entries
          .filter((e) => !e.name.startsWith('.'))
          .sort((a, b) => {
            if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
        setChildren(sorted);
        setLoaded(true);
        setExpanded(true);
      }).catch(() => {
        setLoaded(true);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isHidden) return null;

  return (
    <div>
      <div
        className="flex items-center transition-colors"
        style={{
          paddingLeft: `${8 + depth * 16}px`,
          paddingRight: '8px',
          paddingTop: '3px',
          paddingBottom: '3px',
          backgroundColor: hovered ? 'var(--bg-hover)' : 'transparent',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Name / Toggle */}
        <button
          onClick={handleToggle}
          className="flex items-center flex-1 min-w-0 text-left text-xs"
          style={{ color: 'var(--text-primary)', background: 'none', border: 'none', cursor: entry.is_dir ? 'pointer' : 'default', padding: 0 }}
        >
          <span className="shrink-0 flex items-center justify-center" style={{ width: '16px', marginRight: '4px' }}>
            {entry.is_dir ? (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : null}
          </span>
          <span className="shrink-0 flex items-center justify-center" style={{ marginRight: '6px', color: 'var(--text-tertiary)' }}>
            {entry.is_dir ? (expanded ? <FolderOpenIcon size={14} /> : <Folder size={14} />) : getFileIcon(entry)}
          </span>
          <span className="truncate">{entry.name}</span>
        </button>

        {/* Action buttons — only show edit/delete for .md files */}
        {!entry.is_dir && (() => {
          const isMd = entry.name.endsWith('.md');
          return (
          <div className="flex items-center gap-1 shrink-0" style={{ marginLeft: '8px' }}>
            <button
              onClick={() => onOpenExplorer(entry.path)}
              title="Open file location"
              className="flex items-center justify-center transition-opacity hover-icon"
              style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', opacity: hovered ? 1 : 0 }}
            >
              <ExternalLink size={12} />
            </button>
            {isMd && (
              <button
                onClick={() => onEdit(entry.path)}
                title="Edit in editor"
                className="flex items-center justify-center transition-opacity hover-icon"
                style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', opacity: hovered ? 1 : 0 }}
              >
                <Pencil size={12} />
              </button>
            )}
            <select
              value={contextMode}
              onChange={(e) => onContextChange(entry.path, e.target.value as ContextMode)}
              title="Context inclusion mode"
              className="text-xs rounded"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: contextMode === 'force' ? 'var(--color-success)' : contextMode === 'exclude' ? 'var(--color-error)' : 'var(--text-secondary)',
                border: '1px solid var(--border-primary)',
                padding: '1px 4px',
                cursor: 'pointer',
                fontSize: '10px',
              }}
            >
              <option value="auto">Auto</option>
              <option value="exclude">Exclude</option>
              <option value="force">Force</option>
            </select>
            {isMd && (
              <button
                onClick={() => onDelete(entry.path)}
                title="Delete file"
                className="flex items-center justify-center transition-opacity hover-icon-danger"
                style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', opacity: hovered ? 1 : 0 }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
          );
        })()}
      </div>

      {expanded && children.map((child) => (
        <ContextFileTreeItem
          key={child.path}
          entry={child}
          depth={depth + 1}
          contextSettings={contextSettings}
          onContextChange={onContextChange}
          onEdit={onEdit}
          onOpenExplorer={onOpenExplorer}
          onDelete={onDelete}
          expandFolder={expandFolder}
        />
      ))}
    </div>
  );
}
