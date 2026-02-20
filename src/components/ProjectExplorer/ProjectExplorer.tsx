import { useState, useEffect, useCallback } from 'react';
import { FolderOpen, RefreshCw } from 'lucide-react';
import { FileTreeItem } from './FileTreeItem';
import { useProjectStore } from '../../stores/projectStore';
import { listDirectory } from '../../utils/tauri';
import type { FileEntry } from '../../types/project';

export function ProjectExplorer() {
  const projectDir = useProjectStore((s) => s.projectDir);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const activeFilePath = useProjectStore((s) => s.activeFilePath);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoot = useCallback(async () => {
    if (!projectDir) return;
    setLoading(true);
    try {
      const items = await listDirectory(projectDir);
      const sorted = items.sort((a, b) => {
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
  }, [loadRoot]);

  if (!projectDir) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
        <FolderOpen size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
        <p className="text-sm">Open a project to browse files</p>
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
          Project Files
        </h2>
        <button
          onClick={loadRoot}
          className="flex items-center justify-center transition-colors"
          style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ paddingTop: '4px', paddingBottom: '8px' }}>
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
            <FileTreeItem
              key={entry.path}
              entry={entry}
              depth={0}
              onFileSelect={setActiveFile}
              selectedPath={activeFilePath}
            />
          ))
        )}
      </div>
    </div>
  );
}
