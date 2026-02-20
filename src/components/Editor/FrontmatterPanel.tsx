import { useState } from 'react';
import { ChevronRight, ChevronDown, FileCode } from 'lucide-react';

interface FrontmatterPanelProps {
  frontmatter: Record<string, unknown>;
}

export function FrontmatterPanel({ frontmatter }: FrontmatterPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const entries = Object.entries(frontmatter);
  if (entries.length === 0) return null;

  return (
    <div className="shrink-0" style={{ borderBottom: '1px solid var(--border-secondary)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left text-xs"
        style={{ padding: '8px 16px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <span>{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
        <FileCode size={12} />
        <span>Frontmatter ({entries.length} fields)</span>
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-baseline gap-2 text-xs">
              <span className="font-medium shrink-0" style={{ color: 'var(--text-secondary)', minWidth: '80px' }}>
                {key}:
              </span>
              <span className="truncate" style={{ color: 'var(--text-tertiary)' }}>
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
