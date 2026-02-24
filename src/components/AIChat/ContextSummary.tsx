import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { ContextFileInfo } from '../../types/ai';

interface ContextSummaryProps {
  files: ContextFileInfo[];
  totalTokens: number;
}

export function ContextSummary({ files, totalTokens }: ContextSummaryProps) {
  const [expanded, setExpanded] = useState(false);

  if (files.length === 0) {
    return (
      <div
        className="text-xs shrink-0"
        style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-secondary)', padding: '8px 16px' }}
      >
        No context loaded
      </div>
    );
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border-secondary)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-xs"
        style={{ color: 'var(--text-secondary)', padding: '8px 16px' }}
      >
        <span className="flex items-center gap-1.5">
          <FileText size={12} />
          {files.length} files · ~{totalTokens.toLocaleString()} tokens
        </span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <div className="pb-2 space-y-1" style={{ padding: '0 16px 8px' }}>
          {files.map((file, i) => {
            const bookMatch = file.path.match(/^books[\\/](book-\d+)[\\/](.*)/);
            const scopeLabel = bookMatch ? bookMatch[1] : 'project';
            const displayPath = bookMatch ? bookMatch[2] : file.path;
            return (
              <div
                key={i}
                className="flex items-center justify-between text-xs"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <span className="truncate flex-1">
                  <span
                    className="rounded shrink-0"
                    style={{
                      backgroundColor: bookMatch ? 'var(--bg-tertiary)' : 'var(--accent-subtle)',
                      color: bookMatch ? 'var(--text-tertiary)' : 'var(--accent)',
                      fontSize: '10px',
                      padding: '1px 5px',
                      marginRight: '6px',
                    }}
                  >
                    {scopeLabel}
                  </span>
                  {displayPath}
                </span>
                <span
                  className="ml-2 rounded shrink-0"
                  style={{
                    backgroundColor: file.mode === 'full' ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                    color: file.mode === 'full' ? 'var(--accent)' : 'var(--text-tertiary)',
                    fontSize: '10px',
                    padding: '2px 6px',
                  }}
                >
                  {file.mode}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
