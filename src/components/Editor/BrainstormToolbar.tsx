import { useState, useEffect, useCallback } from 'react';
import { Sparkles, ChevronDown, Settings2 } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { listDirectory } from '../../utils/tauri';
import type { FileEntry } from '../../types/project';


interface BrainstormToolbarProps {
  currentFilePath: string;
}

export function BrainstormToolbar({ currentFilePath }: BrainstormToolbarProps) {
  const projectDir = useProjectStore((s) => s.projectDir);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const setActiveView = useProjectStore((s) => s.setActiveView);
  const setContextExpandFolder = useProjectStore((s) => s.setContextExpandFolder);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const overviewDir = projectDir ? `${projectDir}\\project_overview` : null;

  const loadFiles = useCallback(async () => {
    if (!overviewDir) return;
    try {
      const entries = await listDirectory(overviewDir);
      setFiles(entries.filter((e) => !e.is_dir && e.name.endsWith('.md')));
    } catch {
      setFiles([]);
    }
  }, [overviewDir]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const currentFileName = currentFilePath.split(/[\\/]/).pop() || '';

  const handleGenerate = () => {
    // TODO: Trigger AI generation of project_overview.md
    console.log('Generate project overview');
  };

  const handleContextSettings = () => {
    setActiveView('files');
    if (overviewDir) setContextExpandFolder(overviewDir);
  };

  return (
    <div
      className="flex items-center gap-2 shrink-0"
      style={{
        padding: '6px 16px',
        borderBottom: '1px solid var(--border-secondary)',
        backgroundColor: 'var(--bg-elevated)',
      }}
    >
      <button
        onClick={handleGenerate}
        className="flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors"
        style={{
          backgroundColor: 'var(--accent)',
          color: 'var(--text-inverse)',
          padding: '5px 12px',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <Sparkles size={13} />
        Generate
      </button>

      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            padding: '5px 12px',
            border: '1px solid var(--border-primary)',
            cursor: 'pointer',
          }}
        >
          {currentFileName}
          <ChevronDown size={12} />
        </button>

        {showDropdown && (
          <div
            className="absolute left-0 rounded-lg"
            style={{
              top: '100%',
              marginTop: '4px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-primary)',
              boxShadow: 'var(--shadow-md)',
              minWidth: '240px',
              zIndex: 100,
              overflow: 'hidden',
            }}
          >
            {files.map((file) => {
              const isActive = currentFilePath.endsWith(file.name);
              return (
                <button
                  key={file.path}
                  onClick={() => {
                    setActiveFile(file.path);
                    setShowDropdown(false);
                  }}
                  className="flex items-center w-full text-left text-xs transition-colors"
                  style={{
                    padding: '8px 12px',
                    color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                    backgroundColor: isActive ? 'var(--accent-subtle)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {file.name}
                </button>
              );
            })}
            {files.length === 0 && (
              <div className="text-xs" style={{ padding: '8px 12px', color: 'var(--text-tertiary)' }}>
                No files yet
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleContextSettings}
        className="flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors"
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          color: 'var(--text-primary)',
          padding: '5px 12px',
          border: '1px solid var(--border-primary)',
          cursor: 'pointer',
        }}
      >
        <Settings2 size={13} />
        Context Settings
      </button>
    </div>
  );
}
