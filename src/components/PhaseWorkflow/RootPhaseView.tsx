import { useState, useEffect, useCallback } from 'react';
import { Check, Circle, Loader2, Info } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { readFile } from '../../utils/tauri';
import { openHelpWindow } from '../../utils/helpWindow';
import { BEATS } from '../../types/sapling';
import { PhaseIcon } from './PhaseIcon';

interface BeatData {
  [beatName: string]: string;
}

function parseBeatOutline(body: string): BeatData {
  const data: BeatData = {};
  let currentBeat = '';
  for (const line of body.split('\n')) {
    const heading = line.match(/^###?\s+(?:Beat\s+\d+[:\s]*)?(.+)/i);
    if (heading) {
      currentBeat = heading[1].trim();
      data[currentBeat] = '';
    } else if (currentBeat) {
      data[currentBeat] = ((data[currentBeat] || '') + '\n' + line).trim();
    }
  }
  return data;
}

const ACT_COLORS: Record<string, string> = {
  I: 'var(--color-info)',
  II: 'var(--color-magenta)',
  III: 'var(--color-warning)',
};

export function RootPhaseView() {
  const projectDir = useProjectStore((s) => s.projectDir);
  const activeBookId = useProjectStore((s) => s.activeBookId);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const [beatData, setBeatData] = useState<BeatData>({});
  const [loading, setLoading] = useState(true);
  const [selectedBeat, setSelectedBeat] = useState<number | null>(null);

  const beatOutlinePath = projectDir && activeBookId
    ? `${projectDir}\\books\\${activeBookId}\\structure\\beat-outline.md`
    : null;

  const loadBeats = useCallback(async () => {
    if (!beatOutlinePath) return;
    setLoading(true);
    try {
      const content = await readFile(beatOutlinePath);
      setBeatData(parseBeatOutline(content.body));
    } catch {
      setBeatData({});
    }
    setLoading(false);
  }, [beatOutlinePath]);

  useEffect(() => {
    loadBeats();
  }, [loadBeats]);

  const hasBeatContent = (beatName: string): boolean => {
    const val = beatData[beatName];
    return !!val && val.trim().length > 0;
  };

  const filledCount = BEATS.filter(b => hasBeatContent(b.name)).length;

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
              width: `${(filledCount / 21) * 100}%`,
              height: '100%',
              backgroundColor: 'var(--accent)',
              borderRadius: '2px',
              transition: 'width 0.3s',
            }} />
          </div>
          <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
            {filledCount}/21
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
                    const filled = hasBeatContent(beat.name);
                    const isSelected = selectedBeat === beat.num;
                    return (
                      <button
                        key={beat.num}
                        onClick={() => {
                          setSelectedBeat(isSelected ? null : beat.num);
                          if (beatOutlinePath) setActiveFile(beatOutlinePath);
                        }}
                        className="flex items-start gap-3 text-left rounded-md hover-btn"
                        style={{
                          backgroundColor: isSelected ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                          border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-primary)'}`,
                          padding: '10px 14px',
                        }}
                      >
                        <div className="shrink-0" style={{ marginTop: '1px' }}>
                          {filled ? (
                            <Check size={13} style={{ color: 'var(--color-success)' }} />
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
                          </div>
                          {filled && (
                            <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                              {beatData[beat.name]}
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
                Start with the anchor beats — Inciting Incident, Midpoint Shift, Climactic Confrontation,
                and Closing Image. Or ask Claude to generate all 21 beats based on your story foundation.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
