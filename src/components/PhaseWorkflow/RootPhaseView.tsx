import { useState, useEffect, useCallback } from 'react';
import { Check, Circle, Loader2, Info, FileText } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { readFile, writeFile, loadTemplate } from '../../utils/tauri';
import { openHelpWindow } from '../../utils/helpWindow';
import { BEATS } from '../../types/sapling';
import { PhaseIcon } from './PhaseIcon';
import { beatDir, beatTemplate, ANCHOR_BEATS } from './beatHelpers';

const ACT_COLORS: Record<string, string> = {
  I: 'var(--color-info)',
  II: 'var(--color-magenta)',
  III: 'var(--color-warning)',
};

interface BeatStatus {
  hasBrainstorm: boolean;
  hasDraft: boolean;
  brainstormPreview: string;
}

export function RootPhaseView() {
  const projectDir = useProjectStore((s) => s.projectDir);
  const activeBookId = useProjectStore((s) => s.activeBookId);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const refresh = useProjectStore((s) => s.refreshCounter);
  const [statuses, setStatuses] = useState<Record<number, BeatStatus>>({});
  const [loading, setLoading] = useState(true);

  const rootDir = projectDir && activeBookId
    ? `${projectDir}\\books\\${activeBookId}\\phase-2-root`
    : null;

  const loadStatuses = useCallback(async () => {
    if (!rootDir) return;
    setLoading(true);
    const result: Record<number, BeatStatus> = {};
    for (const beat of BEATS) {
      const dir = `${rootDir}\\${beatDir(beat.num, beat.name)}`;
      const brainstormPath = `${dir}\\brainstorm.md`;
      const draftPath = `${dir}\\draft.md`;
      let hasBrainstorm = false;
      let hasDraft = false;
      let brainstormPreview = '';
      try {
        const content = await readFile(brainstormPath);
        hasBrainstorm = true;
        const lines = content.body.split('\n').filter((l: string) => !l.startsWith('#') && !l.startsWith('**') && !l.startsWith('---') && !l.startsWith('>') && l.trim().length > 0);
        brainstormPreview = lines.slice(0, 2).join(' ').slice(0, 150);
      } catch { /* doesn't exist yet */ }
      try {
        await readFile(draftPath);
        hasDraft = true;
      } catch { /* doesn't exist yet */ }
      result[beat.num] = { hasBrainstorm, hasDraft, brainstormPreview };
    }
    setStatuses(result);
    setLoading(false);
  }, [rootDir]);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses, refresh]);

  const handleBeatClick = async (beat: typeof BEATS[number]) => {
    if (!rootDir || !projectDir || !activeBookId) return;
    const dir = `${rootDir}\\${beatDir(beat.num, beat.name)}`;
    const brainstormPath = `${dir}\\brainstorm.md`;
    const status = statuses[beat.num];
    if (!status?.hasBrainstorm) {
      try {
        const now = new Date().toISOString().slice(0, 10);
        const frontmatter: Record<string, unknown> = {
          type: 'brainstorm',
          scope: activeBookId,
          subject: 'beat',
          beat_number: beat.num,
          beat_name: beat.name,
          act: beat.act === 'I' ? 1 : beat.act === 'II' ? 2 : 3,
          is_anchor: ANCHOR_BEATS.has(beat.num),
          created: now,
          modified: now,
          status: 'empty',
        };
        const body = await loadTemplate(projectDir, beatTemplate(beat.num, beat.name), {});
        await writeFile(brainstormPath, frontmatter, body);
        await loadStatuses();
      } catch (e) {
        console.error('Failed to create beat brainstorm:', e);
      }
    }
    setActiveFile(brainstormPath);
  };

  const draftedCount = BEATS.filter(b => statuses[b.num]?.hasDraft).length;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Phase Header */}
      <div className="shrink-0" style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border-secondary)' }}>
        <div className="flex items-center gap-3">
          <PhaseIcon phase="root" size={50} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                Root Phase — Story Structure
              </h1>
              <button
                onClick={() => openHelpWindow('phase-2-root')}
                className="flex items-center justify-center rounded-full hover-icon"
                style={{ color: 'var(--text-tertiary)', width: '22px', height: '22px', background: 'none', border: 'none', cursor: 'pointer' }}
                title="Learn about the Root Phase"
              >
                <Info size={15} />
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '2px' }}>
              What happens in this story? Develop the 21-beat outline.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2" style={{ marginTop: '12px' }}>
          <div style={{ flex: 1, height: '4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              width: `${(draftedCount / 21) * 100}%`,
              height: '100%',
              backgroundColor: 'var(--accent)',
              borderRadius: '2px',
              transition: 'width 0.3s',
            }} />
          </div>
          <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
            {draftedCount}/21 drafted
          </span>
        </div>
      </div>

      {/* Beat List */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '16px 28px' }}>
        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: '40px 0' }}>
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
          </div>
        ) : (
          <>
            {['I', 'II', 'III'].map((act) => (
              <div key={act} style={{ marginBottom: '20px' }}>
                <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
                  <div style={{ width: '3px', height: '16px', backgroundColor: ACT_COLORS[act], borderRadius: '2px' }} />
                  <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: ACT_COLORS[act] }}>
                    Act {act}
                  </h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {BEATS.filter(b => b.act === act).map((beat) => {
                    const status = statuses[beat.num] || { hasBrainstorm: false, hasDraft: false, brainstormPreview: '' };
                    const isAnchor = ANCHOR_BEATS.has(beat.num);
                    return (
                      <button
                        key={beat.num}
                        onClick={() => handleBeatClick(beat)}
                        className="flex items-start gap-3 text-left rounded-md transition-all"
                        style={{
                          backgroundColor: 'var(--bg-elevated)',
                          border: '1px solid var(--border-primary)',
                          padding: '10px 14px',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--accent)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-primary)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div className="shrink-0" style={{ marginTop: '1px' }}>
                          {status.hasDraft ? (
                            <Check size={13} style={{ color: 'var(--color-success)' }} />
                          ) : status.hasBrainstorm ? (
                            <FileText size={13} style={{ color: 'var(--accent)' }} />
                          ) : (
                            <Circle size={13} style={{ color: 'var(--text-tertiary)' }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                              {beat.num}.
                            </span>
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                              {beat.name}
                            </span>
                            {isAnchor && (
                              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                                Anchor
                              </span>
                            )}
                            {status.hasDraft && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(var(--success-rgb, 46,160,67), 0.15)', color: 'var(--color-success)' }}>
                                Drafted
                              </span>
                            )}
                          </div>
                          {status.brainstormPreview && (
                            <p className="text-xs line-clamp-1" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                              {status.brainstormPreview}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Tip */}
            <div className="rounded-lg" style={{ marginTop: '8px', padding: '16px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)', lineHeight: '1.6' }}>
                Click any beat to open its brainstorm document. Start with the anchor beats — Inciting Incident,
                Midpoint Shift, Climactic Confrontation, and Closing Image. When a brainstorm is ready, click
                <strong style={{ color: 'var(--text-secondary)' }}> Generate</strong> to have Claude produce a polished draft.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
