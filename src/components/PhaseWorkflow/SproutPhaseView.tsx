import { useState, useEffect, useCallback } from 'react';
import { Users, Loader2, Info, Check, Circle, FileText, ChevronRight, ChevronDown } from 'lucide-react';
import { PhaseIcon } from './PhaseIcon';
import { useProjectStore } from '../../stores/projectStore';
import { openHelpWindow } from '../../utils/helpWindow';
import { listDirectory, readFile, writeFile, loadTemplate } from '../../utils/tauri';
import { JOURNEY_STAGES, stageDir } from './sproutHelpers';
import type { FileEntry } from '../../types/project';

interface CharacterInfo {
  name: string;
  slug: string;
  dirPath: string;
}

interface StageStatus {
  hasBrainstorm: boolean;
  hasDraft: boolean;
}

export function SproutPhaseView() {
  const projectDir = useProjectStore((s) => s.projectDir);
  const activeBookId = useProjectStore((s) => s.activeBookId);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const refresh = useProjectStore((s) => s.refreshCounter);
  const [characters, setCharacters] = useState<CharacterInfo[]>([]);
  const [expandedChar, setExpandedChar] = useState<string | null>(null);
  const [stageStatuses, setStageStatuses] = useState<Record<string, Record<number, StageStatus>>>({});
  const [loading, setLoading] = useState(true);

  const sproutDir = projectDir && activeBookId
    ? `${projectDir}\\books\\${activeBookId}\\phase-3-sprout`
    : null;

  const charsDir = projectDir ? `${projectDir}\\characters` : null;

  const loadCharacters = useCallback(async () => {
    if (!charsDir) return;
    setLoading(true);
    try {
      const entries = await listDirectory(charsDir);
      const chars: CharacterInfo[] = entries
        .filter((e: FileEntry) => e.is_dir)
        .map((e: FileEntry) => ({
          name: e.name.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          slug: e.name,
          dirPath: e.path,
        }));
      setCharacters(chars);
    } catch {
      setCharacters([]);
    }
    setLoading(false);
  }, [charsDir]);

  const loadStageStatuses = useCallback(async (charSlug: string) => {
    if (!sproutDir) return;
    const result: Record<number, StageStatus> = {};
    for (const stage of JOURNEY_STAGES) {
      const dir = `${sproutDir}\\${charSlug}\\${stageDir(stage.num, stage.slug)}`;
      let hasBrainstorm = false;
      let hasDraft = false;
      try { await readFile(`${dir}\\brainstorm.md`); hasBrainstorm = true; } catch { /* */ }
      try { await readFile(`${dir}\\draft.md`); hasDraft = true; } catch { /* */ }
      result[stage.num] = { hasBrainstorm, hasDraft };
    }
    setStageStatuses(prev => ({ ...prev, [charSlug]: result }));
  }, [sproutDir]);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters, refresh]);

  useEffect(() => {
    if (expandedChar) loadStageStatuses(expandedChar);
  }, [expandedChar, loadStageStatuses, refresh]);

  const handleStageClick = async (char: CharacterInfo, stage: typeof JOURNEY_STAGES[number]) => {
    if (!sproutDir || !projectDir || !activeBookId) return;
    const dir = `${sproutDir}\\${char.slug}\\${stageDir(stage.num, stage.slug)}`;
    const brainstormPath = `${dir}\\brainstorm.md`;
    const statuses = stageStatuses[char.slug];
    if (!statuses?.[stage.num]?.hasBrainstorm) {
      try {
        const now = new Date().toISOString().slice(0, 10);
        const frontmatter: Record<string, unknown> = {
          type: 'brainstorm',
          scope: activeBookId,
          subject: 'journey-stage',
          character_id: char.slug,
          stage_number: stage.num,
          stage_name: stage.name,
          created: now,
          modified: now,
          status: 'empty',
        };
        const body = await loadTemplate(projectDir, stage.template, { name: char.name });
        await writeFile(brainstormPath, frontmatter, body);
        await loadStageStatuses(char.slug);
      } catch (e) {
        console.error('Failed to create stage brainstorm:', e);
      }
    }
    setActiveFile(brainstormPath);
  };

  const getCharStageCount = (charSlug: string): { brainstormed: number; drafted: number } => {
    const statuses = stageStatuses[charSlug];
    if (!statuses) return { brainstormed: 0, drafted: 0 };
    return {
      brainstormed: JOURNEY_STAGES.filter(s => statuses[s.num]?.hasBrainstorm).length,
      drafted: JOURNEY_STAGES.filter(s => statuses[s.num]?.hasDraft).length,
    };
  };

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
                className="flex items-center justify-center rounded-full hover-icon"
                style={{ color: 'var(--text-tertiary)', width: '22px', height: '22px', background: 'none', border: 'none', cursor: 'pointer' }}
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
            {characters.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                {characters.map((char) => {
                  const isExpanded = expandedChar === char.slug;
                  const counts = getCharStageCount(char.slug);
                  return (
                    <div key={char.slug} className="rounded-lg" style={{ border: '1px solid var(--border-primary)', overflow: 'hidden' }}>
                      {/* Character header */}
                      <button
                        onClick={() => setExpandedChar(isExpanded ? null : char.slug)}
                        className="flex items-center justify-between w-full text-left hover-btn"
                        style={{ padding: '14px 16px', backgroundColor: 'var(--bg-elevated)', border: 'none', cursor: 'pointer' }}
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />}
                          <Users size={14} style={{ color: 'var(--accent)' }} />
                          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {char.name}
                          </span>
                        </div>
                        {isExpanded && (
                          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {counts.drafted}/8 drafted
                          </span>
                        )}
                      </button>

                      {/* Expanded: journey stages */}
                      {isExpanded && (
                        <div style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {JOURNEY_STAGES.map((stage) => {
                            const status = stageStatuses[char.slug]?.[stage.num] || { hasBrainstorm: false, hasDraft: false };
                            return (
                              <button
                                key={stage.num}
                                onClick={() => handleStageClick(char, stage)}
                                className="flex items-start gap-3 text-left rounded-md transition-all"
                                style={{
                                  backgroundColor: 'var(--bg-primary)',
                                  border: '1px solid var(--border-primary)',
                                  padding: '10px 12px',
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
                                    <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                                      {stage.num}.
                                    </span>
                                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                      {stage.name}
                                    </span>
                                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                      {stage.beats}
                                    </span>
                                    {status.hasDraft && (
                                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(var(--success-rgb, 46,160,67), 0.15)', color: 'var(--color-success)' }}>
                                        Drafted
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
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
                <p className="text-sm">No characters found yet</p>
                <p className="text-xs" style={{ marginTop: '4px' }}>
                  Create characters in the Characters section first. Each character will appear here
                  with their own 8-stage journey to develop.
                </p>
              </div>
            )}

            {/* Guidance */}
            <div className="rounded-lg" style={{ marginTop: '8px', padding: '16px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)', lineHeight: '1.6' }}>
                Expand a character to see their 8-stage journey. Click any stage to open its brainstorm
                document. When ready, click <strong style={{ color: 'var(--text-secondary)' }}>Generate</strong> to
                have Claude draft that stage. Start with your protagonist.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
