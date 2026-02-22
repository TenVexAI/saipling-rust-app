import { useState, useEffect, useCallback } from 'react';
import { Check, Circle, Loader2, Info } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { readFile } from '../../utils/tauri';
import { openHelpWindow } from '../../utils/helpWindow';
import { PhaseIcon } from './PhaseIcon';

const SEED_ELEMENTS = [
  { key: 'premise', label: 'Premise', description: 'The core "what if" of your story' },
  { key: 'theme', label: 'Theme', description: 'The central message or question explored' },
  { key: 'protagonist', label: 'Protagonist', description: 'Who the story follows and their defining flaw' },
  { key: 'conflict', label: 'Central Conflict', description: 'The main obstacle testing the protagonist' },
  { key: 'world', label: 'World', description: 'The setting and its rules' },
  { key: 'promise', label: 'Emotional Promise', description: 'How readers should feel at the end' },
];

interface FoundationData {
  [key: string]: string | undefined;
}

function parseFoundationBody(body: string): FoundationData {
  const data: FoundationData = {};
  let currentKey = '';
  const lines = body.split('\n');
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)/);
    if (heading) {
      currentKey = heading[1].toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
      data[currentKey] = '';
    } else if (currentKey) {
      data[currentKey] = ((data[currentKey] || '') + '\n' + line).trim();
    }
  }
  return data;
}

export function SeedPhaseView() {
  const projectDir = useProjectStore((s) => s.projectDir);
  const activeBookId = useProjectStore((s) => s.activeBookId);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const [foundation, setFoundation] = useState<FoundationData>({});
  const [loading, setLoading] = useState(true);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);

  const foundationPath = projectDir && activeBookId
    ? `${projectDir}\\books\\${activeBookId}\\foundation\\story-foundation.md`
    : null;

  const loadFoundation = useCallback(async () => {
    if (!foundationPath) return;
    setLoading(true);
    try {
      const content = await readFile(foundationPath);
      setFoundation(parseFoundationBody(content.body));
    } catch {
      setFoundation({});
    }
    setLoading(false);
  }, [foundationPath]);

  useEffect(() => {
    loadFoundation();
  }, [loadFoundation]);

  const getElementStatus = (key: string): 'empty' | 'filled' => {
    const val = foundation[key];
    return val && val.trim().length > 0 ? 'filled' : 'empty';
  };

  const filledCount = SEED_ELEMENTS.filter(e => getElementStatus(e.key) === 'filled').length;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Phase Header */}
      <div className="shrink-0" style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border-secondary)' }}>
        <div className="flex items-center gap-3">
          <PhaseIcon phase="seed" size={50} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                Seed Phase — Story Foundation
              </h1>
              <button
                onClick={() => openHelpWindow('phase-1-seed')}
                className="flex items-center justify-center rounded-full hover-icon"
                style={{ color: 'var(--text-tertiary)', width: '22px', height: '22px', background: 'none', border: 'none', cursor: 'pointer' }}
                title="Learn about the Seed Phase"
              >
                <Info size={15} />
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '2px' }}>
              What is this story about? Define the 6 core elements.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2" style={{ marginTop: '12px' }}>
          <div style={{ flex: 1, height: '4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              width: `${(filledCount / 6) * 100}%`,
              height: '100%',
              backgroundColor: 'var(--accent)',
              borderRadius: '2px',
              transition: 'width 0.3s',
            }} />
          </div>
          <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
            {filledCount}/6
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '20px 28px' }}>
        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: '40px 0' }}>
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {SEED_ELEMENTS.map((el) => {
              const status = getElementStatus(el.key);
              const isSelected = selectedElement === el.key;
              return (
                <button
                  key={el.key}
                  onClick={() => {
                    setSelectedElement(isSelected ? null : el.key);
                    if (foundationPath) setActiveFile(foundationPath);
                  }}
                  className="text-left rounded-lg hover-btn"
                  style={{
                    backgroundColor: isSelected ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-primary)'}`,
                    padding: '16px',
                  }}
                >
                  <div className="flex items-center gap-2" style={{ marginBottom: '6px' }}>
                    {status === 'filled' ? (
                      <Check size={14} style={{ color: 'var(--color-success)' }} />
                    ) : (
                      <Circle size={14} style={{ color: 'var(--text-tertiary)' }} />
                    )}
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {el.label}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                    {el.description}
                  </p>
                  {status === 'filled' ? (
                    <p className="text-xs line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                      {foundation[el.key]}
                    </p>
                  ) : (
                    <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
                      Not yet defined — ask Claude to help
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Guidance */}
        <div className="rounded-lg" style={{ marginTop: '24px', padding: '16px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>
            How to use the Seed Phase
          </p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)', lineHeight: '1.6' }}>
            Tell Claude about the story you want to write in the AI Chat panel. It can be as rough as a feeling
            or as specific as a full plot. Claude will help you develop each of the six core elements one at a time,
            offering options for you to approve, edit, or refine. You can also write elements directly by opening
            the story foundation file.
          </p>
        </div>
      </div>
    </div>
  );
}
