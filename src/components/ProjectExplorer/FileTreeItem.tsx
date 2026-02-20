import { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, FileText, Image } from 'lucide-react';
import type { FileEntry } from '../../types/project';
import { listDirectory } from '../../utils/tauri';

interface FileTreeItemProps {
  entry: FileEntry;
  depth: number;
  onFileSelect: (path: string) => void;
  selectedPath: string | null;
}

function getFileIcon(entry: FileEntry) {
  if (entry.is_dir) return null; // handled by folder icons
  const ext = entry.name.split('.').pop()?.toLowerCase();
  if (ext === 'md') return <FileText size={14} />;
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext || '')) return <Image size={14} />;
  return <File size={14} />;
}

export function FileTreeItem({ entry, depth, onFileSelect, selectedPath }: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const isSelected = selectedPath === entry.path;

  const handleToggle = async () => {
    if (!entry.is_dir) {
      onFileSelect(entry.path);
      return;
    }

    if (!loaded) {
      try {
        const entries = await listDirectory(entry.path);
        const sorted = entries.sort((a, b) => {
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

  const isHidden = entry.name.startsWith('.') || entry.name === 'node_modules';

  if (isHidden) return null;

  return (
    <div>
      <button
        onClick={handleToggle}
        className="flex items-center w-full text-left text-xs transition-colors"
        style={{
          paddingLeft: `${8 + depth * 16}px`,
          paddingRight: '8px',
          paddingTop: '4px',
          paddingBottom: '4px',
          color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
          backgroundColor: isSelected ? 'var(--accent-subtle)' : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <span className="shrink-0 flex items-center justify-center" style={{ width: '16px', marginRight: '4px' }}>
          {entry.is_dir ? (
            expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          ) : null}
        </span>
        <span className="shrink-0 flex items-center justify-center" style={{ marginRight: '6px', color: 'var(--text-tertiary)' }}>
          {entry.is_dir ? (
            expanded ? <FolderOpen size={14} /> : <Folder size={14} />
          ) : (
            getFileIcon(entry)
          )}
        </span>
        <span className="truncate">{entry.name}</span>
      </button>

      {expanded && children.map((child) => (
        <FileTreeItem
          key={child.path}
          entry={child}
          depth={depth + 1}
          onFileSelect={onFileSelect}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  );
}
