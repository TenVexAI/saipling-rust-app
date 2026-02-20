import { useState } from 'react';
import { FileText, Check, Pencil, X } from 'lucide-react';
import type { ApplyBlock } from '../../types/ai';
import { useProjectStore } from '../../stores/projectStore';
import { writeFile } from '../../utils/tauri';
import { parseFrontmatter } from '../../utils/markdown';

interface ApplyCardProps {
  block: ApplyBlock;
}

export function ApplyCard({ block }: ApplyCardProps) {
  const projectDir = useProjectStore((s) => s.projectDir);
  const [status, setStatus] = useState<'pending' | 'applied' | 'discarded'>('pending');

  const actionLabel = {
    create: 'Create',
    replace: 'Replace section in',
    append: 'Append to',
    update_frontmatter: 'Update metadata of',
  }[block.action];

  const handleApply = async () => {
    if (!projectDir) return;
    try {
      const fullPath = `${projectDir}\\${block.target.replace(/\//g, '\\\\')}`;
      const { frontmatter, body } = parseFrontmatter(block.content);
      await writeFile(fullPath, frontmatter, body);
      setStatus('applied');
    } catch (e) {
      console.error('Failed to apply:', e);
    }
  };

  const handleDiscard = () => {
    setStatus('discarded');
  };

  if (status === 'applied') {
    return (
      <div
        className="flex items-center gap-2 p-3 rounded-lg mt-2 text-xs"
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--color-success)',
          color: 'var(--color-success)',
        }}
      >
        <Check size={14} />
        Applied to {block.target}
      </div>
    );
  }

  if (status === 'discarded') {
    return (
      <div
        className="flex items-center gap-2 p-3 rounded-lg mt-2 text-xs opacity-50"
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-primary)',
          color: 'var(--text-tertiary)',
        }}
      >
        <X size={14} />
        Discarded
      </div>
    );
  }

  return (
    <div
      className="rounded-lg mt-2 overflow-hidden"
      style={{
        border: '1px solid var(--border-primary)',
        backgroundColor: 'var(--bg-elevated)',
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 text-xs"
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-primary)',
          color: 'var(--text-secondary)',
        }}
      >
        <FileText size={14} />
        <span className="font-medium">{actionLabel}:</span>
        <span className="truncate">{block.target}</span>
      </div>

      <div
        className="px-3 py-2 text-xs max-h-40 overflow-y-auto font-mono"
        style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}
      >
        {block.content.slice(0, 500)}
        {block.content.length > 500 && '...'}
      </div>

      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderTop: '1px solid var(--border-primary)' }}
      >
        <button
          onClick={handleApply}
          className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium"
          style={{ backgroundColor: 'var(--color-success)', color: '#fff' }}
        >
          <Check size={12} />
          Apply
        </button>
        <button
          className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-primary)',
          }}
        >
          <Pencil size={12} />
          Edit First
        </button>
        <button
          onClick={handleDiscard}
          className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <X size={12} />
          Discard
        </button>
      </div>
    </div>
  );
}
