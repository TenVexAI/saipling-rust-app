import { useState, useEffect, useCallback } from 'react';
import { Check, Circle, Loader2, Info, FileText } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { readFile, writeFile, loadTemplate } from '../../utils/tauri';
import { openHelpWindow } from '../../utils/helpWindow';
import { PhaseIcon } from './PhaseIcon';
import { SEED_ELEMENTS } from './seedElements';

interface ElementStatus {
  hasBrainstorm: boolean;
  hasDraft: boolean;
  brainstormPreview: string;
}

export function SeedPhaseView() {
  const projectDir = useProjectStore((s) => s.projectDir);
  const activeBookId = useProjectStore((s) => s.activeBookId);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const refresh = useProjectStore((s) => s.refreshCounter);
  const [statuses, setStatuses] = useState<Record<string, ElementStatus>>({});
  const [loading, setLoading] = useState(true);

  const seedDir = projectDir && activeBookId
    ? `${projectDir}\\books\\${activeBookId}\\phase-1-seed`
    : null;

  const loadStatuses = useCallback(async () => {
    if (!seedDir || !projectDir) return;
    setLoading(true);
    const result: Record<string, ElementStatus> = {};
    for (const el of SEED_ELEMENTS) {
      const elDir = `${seedDir}\\${el.slug}`;
      const brainstormPath = `${elDir}\\brainstorm.md`;
      const draftPath = `${elDir}\\draft.md`;
      let hasBrainstorm = false;
      let hasDraft = false;
      let brainstormPreview = '';
      try {
        const content = await readFile(brainstormPath);
        hasBrainstorm = true;
        // Get a preview from the body (skip template headings)
        const lines = content.body.split('\n').filter((l: string) => !l.startsWith('#') && !l.startsWith('**') && !l.startsWith('---') && l.trim().length > 0);
        brainstormPreview = lines.slice(0, 3).join(' ').slice(0, 200);
      } catch { /* doesn't exist yet */ }
      try {
        await readFile(draftPath);
        hasDraft = true;
      } catch { /* doesn't exist yet */ }
      result[el.key] = { hasBrainstorm, hasDraft, brainstormPreview };
    }
    setStatuses(result);
    setLoading(false);
  }, [seedDir, projectDir]);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses, refresh]);

  const handleElementClick = async (el: typeof SEED_ELEMENTS[0]) => {
    if (!seedDir || !projectDir || !activeBookId) return;
    const elDir = `${seedDir}\\${el.slug}`;
    const brainstormPath = `${elDir}\\brainstorm.md`;

    // Create brainstorm.md from template if it doesn't exist
    const status = statuses[el.key];
    if (!status?.hasBrainstorm) {
      try {
        const now = new Date().toISOString().slice(0, 10);
        const frontmatter: Record<string, unknown> = {
          type: 'brainstorm',
          scope: activeBookId,
          subject: 'seed-element',
          element: el.slug,
          created: now,
          modified: now,
          status: 'empty',
        };
        const body = await loadTemplate(projectDir, el.template, {});
        await writeFile(brainstormPath, frontmatter, body);
        await loadStatuses();
      } catch (e) {
        console.error('Failed to create seed brainstorm:', e);
      }
    }
    setActiveFile(brainstormPath);
  };

  const filledCount = SEED_ELEMENTS.filter(e => statuses[e.key]?.hasDraft).length;

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
            {filledCount}/6 drafted
          </span>
        </div>
      </div>

      {/* Element Cards */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '20px 28px' }}>
        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: '40px 0' }}>
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {SEED_ELEMENTS.map((el) => {
              const status = statuses[el.key] || { hasBrainstorm: false, hasDraft: false, brainstormPreview: '' };
              return (
                <button
                  key={el.key}
                  onClick={() => handleElementClick(el)}
                  className="text-left rounded-lg transition-all"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1.5px solid var(--border-primary)',
                    padding: '16px',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-primary)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div className="flex items-center gap-2" style={{ marginBottom: '6px' }}>
                    {status.hasDraft ? (
                      <Check size={14} style={{ color: 'var(--color-success)' }} />
                    ) : status.hasBrainstorm ? (
                      <FileText size={14} style={{ color: 'var(--accent)' }} />
                    ) : (
                      <Circle size={14} style={{ color: 'var(--text-tertiary)' }} />
                    )}
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {el.label}
                    </span>
                    {status.hasDraft && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(var(--success-rgb, 46,160,67), 0.15)', color: 'var(--color-success)' }}>
                        Drafted
                      </span>
                    )}
                    {status.hasBrainstorm && !status.hasDraft && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                        Brainstormed
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                    {el.description}
                  </p>
                  {status.brainstormPreview ? (
                    <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                      {status.brainstormPreview}
                    </p>
                  ) : (
                    <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
                      Click to start brainstorming
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
            Click any element to open its brainstorm document in the editor. Write your ideas, then use the AI Chat panel to
            refine them with Claude. When your brainstorm is ready, use the <strong style={{ color: 'var(--text-secondary)' }}>Generate</strong> button
            in the editor toolbar to have Claude produce a polished draft.
          </p>
        </div>
      </div>
    </div>
  );
}
