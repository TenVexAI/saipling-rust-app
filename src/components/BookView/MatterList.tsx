import { FileText, X } from 'lucide-react';
import type { MatterEntry } from '../../types/project';

interface MatterListProps {
  title: string;
  entries: MatterEntry[];
  onSelect: (subtype: string, path: string) => void;
  onCreate: (subtype: string) => void;
  onRemove: (subtype: string) => void;
}

const FRONT_MATTER_TYPES = [
  'title-page', 'copyright', 'dedication', 'epigraph',
  'acknowledgments', 'foreword', 'preface', 'prologue',
];

const BACK_MATTER_TYPES = [
  'epilogue', 'afterword', 'acknowledgments', 'about-the-author', 'glossary',
];

export function MatterList({ title, entries, onSelect, onCreate, onRemove }: MatterListProps) {
  const isFront = title.toLowerCase().includes('front');
  const availableTypes = isFront ? FRONT_MATTER_TYPES : BACK_MATTER_TYPES;
  const existingSubtypes = new Set(entries.filter((e) => e.exists).map((e) => e.subtype));
  const addable = availableTypes.filter((t) => !existingSubtypes.has(t));

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          {title}
        </h3>
      </div>

      {entries.filter((e) => e.exists).length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)', padding: '4px 0' }}>
          No {title.toLowerCase()} added yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {entries.filter((e) => e.exists).map((entry) => (
            <div
              key={entry.subtype}
              className="flex items-center rounded-md transition-colors"
              style={{ padding: '5px 10px' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <button
                onClick={() => onSelect(entry.subtype, entry.path)}
                className="flex items-center flex-1 min-w-0 text-left"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <FileText size={12} style={{ color: 'var(--text-tertiary)', marginRight: '8px', flexShrink: 0 }} />
                <span className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                  {entry.subtype.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              </button>
              <button
                onClick={() => onRemove(entry.subtype)}
                className="flex items-center justify-center transition-colors"
                style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                title="Remove"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {addable.length > 0 && (
        <div className="relative" style={{ marginTop: '4px' }}>
          <select
            onChange={(e) => {
              if (e.target.value) {
                onCreate(e.target.value);
                e.target.value = '';
              }
            }}
            className="text-xs rounded-md"
            style={{
              color: 'var(--text-tertiary)',
              backgroundColor: 'transparent',
              border: '1px dashed var(--border-primary)',
              padding: '4px 8px',
              cursor: 'pointer',
              width: '100%',
            }}
            defaultValue=""
          >
            <option value="" disabled>
              + Add {isFront ? 'front' : 'back'} matter...
            </option>
            {addable.map((t) => (
              <option key={t} value={t} style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                {t.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
