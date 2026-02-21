import { useState, useEffect, useCallback } from 'react';
import { Users, Loader2, Info } from 'lucide-react';
import { PhaseIcon } from './PhaseIcon';
import { useProjectStore } from '../../stores/projectStore';
import { openHelpWindow } from '../../utils/helpWindow';
import { CHARACTER_JOURNEY_STAGES } from '../../types/sapling';

interface CharacterEntry {
  name: string;
  path: string;
  role?: string;
  journeyStages: number;
}

export function SproutPhaseView() {
  const projectDir = useProjectStore((s) => s.projectDir);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const [characters, setCharacters] = useState<CharacterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChar, setSelectedChar] = useState<string | null>(null);

  const loadCharacters = useCallback(async () => {
    if (!projectDir) return;
    setLoading(true);
    try {
      // Try to read character files from the characters directory
      // Character loading will be enhanced when directory listing is available
      const chars: CharacterEntry[] = [];
      setCharacters(chars);
    } catch {
      setCharacters([]);
    }
    setLoading(false);
  }, [projectDir]);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Phase Header */}
      <div className="shrink-0" style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border-secondary)' }}>
        <div className="flex items-center gap-3">
          <PhaseIcon phase="sprout" size={50} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                Sprout Phase — Character Journeys
              </h1>
              <button
                onClick={() => openHelpWindow('phase-3-sprout')}
                className="flex items-center justify-center rounded-full transition-colors"
                style={{ color: 'var(--text-tertiary)', width: '22px', height: '22px', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                title="Learn about the Sprout Phase"
              >
                <Info size={15} />
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '2px' }}>
              Who changes, and how? Develop character arcs through the 8-stage journey.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '20px 28px' }}>
        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: '40px 0' }}>
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
          </div>
        ) : (
          <>
            {/* Character List */}
            {characters.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                {characters.map((char) => (
                  <button
                    key={char.name}
                    onClick={() => {
                      setSelectedChar(selectedChar === char.name ? null : char.name);
                      setActiveFile(char.path);
                    }}
                    className="flex items-center justify-between text-left rounded-lg transition-all"
                    style={{
                      backgroundColor: selectedChar === char.name ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                      border: `1px solid ${selectedChar === char.name ? 'var(--accent)' : 'var(--border-primary)'}`,
                      padding: '14px 16px',
                    }}
                  >
                    <div>
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {char.name}
                      </span>
                      {char.role && (
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)', marginLeft: '8px' }}>
                          {char.role}
                        </span>
                      )}
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {char.journeyStages}/8 stages
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div
                className="rounded-lg text-center"
                style={{
                  border: '2px dashed var(--border-primary)',
                  color: 'var(--text-tertiary)',
                  padding: '32px 20px',
                  marginBottom: '24px',
                }}
              >
                <Users size={24} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                <p className="text-sm">No character sheets found yet</p>
                <p className="text-xs" style={{ marginTop: '4px' }}>
                  Create characters in the Characters section, or ask Claude to generate them.
                </p>
              </div>
            )}

            {/* Journey Stages Reference */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)', marginBottom: '10px' }}>
                8-Stage Character Journey
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {CHARACTER_JOURNEY_STAGES.map((stage) => (
                  <div
                    key={stage.num}
                    className="flex items-center gap-3 rounded-md"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-primary)',
                      padding: '10px 14px',
                    }}
                  >
                    <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)', width: '16px' }}>
                      {stage.num}
                    </span>
                    <span className="text-sm font-medium flex-1" style={{ color: 'var(--text-primary)' }}>
                      {stage.name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {stage.beats}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Guidance */}
            <div className="rounded-lg" style={{ marginTop: '20px', padding: '16px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)', lineHeight: '1.6' }}>
                Start with your protagonist. Map their journey through the 8 stages, aligning each stage
                with the corresponding beats from your outline. Ask Claude to generate character journeys
                based on your beat outline and character sheets.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
