import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Circle, Loader2, Info, FileText, Sparkles, ChevronDown, X, AlertCircle } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { useProjectStore } from '../../stores/projectStore';
import { useAIStore } from '../../stores/aiStore';
import { readFile, writeFile, loadTemplate, agentPlan, agentExecute, agentCancel, listDirectory } from '../../utils/tauri';
import { openHelpWindow } from '../../utils/helpWindow';
import { trackCost } from '../../utils/projectCost';
import { calculateCost } from '../../utils/modelPricing';
import { BEATS } from '../../types/sapling';
import type { AgentPlan, Message } from '../../types/ai';
import { PhaseIcon } from './PhaseIcon';
import { beatDir, beatTemplate, ANCHOR_BEATS } from './beatHelpers';

const ACT_COLORS: Record<string, string> = {
  I: 'var(--color-info)',
  II: 'var(--color-magenta)',
  III: 'var(--color-warning)',
};

type SuggestPhase = 'idle' | 'planning' | 'confirming' | 'generating' | 'writing' | 'done';
type SuggestMode = 'all' | 'empty';

interface BeatStatus {
  hasBrainstorm: boolean;
  hasDraft: boolean;
  brainstormPreview: string;
}

function parseBeatSuggestions(text: string): Map<number, string> {
  const results = new Map<number, string>();
  const regex = /## BEAT (\d+):[^\n]*/g;
  const matches = [...text.matchAll(regex)];
  for (let i = 0; i < matches.length; i++) {
    const beatNum = parseInt(matches[i][1], 10);
    const startIdx = matches[i].index! + matches[i][0].length;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const content = text.slice(startIdx, endIdx).trim();
    if (content) results.set(beatNum, content);
  }
  return results;
}

async function getNextBrainstormFilename(dirPath: string): Promise<string> {
  try {
    const files = await listDirectory(dirPath);
    const existing = files.map(f => f.name).filter(n => /^brainstorm(_v\d+)?\.md$/.test(n));
    if (existing.length === 0) return 'brainstorm.md';
    let maxVersion = 1;
    for (const name of existing) {
      const match = name.match(/^brainstorm_v(\d+)\.md$/);
      if (match) maxVersion = Math.max(maxVersion, parseInt(match[1], 10));
    }
    return `brainstorm_v${maxVersion + 1}.md`;
  } catch {
    return 'brainstorm.md';
  }
}

function buildBeatSuggestPrompt(beats: readonly (typeof BEATS)[number][]): string {
  const beatList = beats.map(b => {
    const actLabel = b.act === 'I' ? 'Act One — The Known World'
      : b.act === 'II' ? 'Act Two — The Unknown World'
      : 'Act Three — The Transformed World';
    return `${b.num}. ${b.name} (${actLabel})`;
  }).join('\n');

  return `Generate brainstorm suggestions for the story's beat structure.

## About the Sapling Method Root Phase

In the Sapling Method, the Root Phase establishes the story's structural skeleton — a 21-beat outline across three acts that maps the full arc of the plot. These brainstorm documents serve as the writer's working notes for each beat, which will then be:
1. Refined into polished beat drafts (detailed narrative descriptions of each story moment)
2. Used to generate scene outlines in the Flourish Phase (breaking beats into individual scenes with action/reaction pacing)
3. Used as the structural foundation for final prose in the Bloom Phase

The three acts follow this shape:
- **Act One — The Known World (~25%)**: Beats 1-7. Establish the protagonist's ordinary life, disrupt it with the Inciting Incident, and push them past the Point of Departure into the unknown.
- **Act Two — The Unknown World (~50%)**: Beats 8-15. The protagonist navigates new reality, builds alliances, hits the Midpoint Shift that redefines the conflict, faces growing opposition, and approaches the Ultimate Challenge.
- **Act Three — The Transformed World (~25%)**: Beats 16-21. The Darkest Moment, a defining Final Decision, the Climactic Confrontation, Resolution, and a Closing Image that contrasts with the Opening Image.

Your suggestions should be **specific to THIS story**, grounded in the Story Foundation and core element drafts from the Seed Phase. For each beat, provide:
- A concrete, story-specific suggestion for what happens in this beat
- Key character moments, decisions, or emotional beats
- How this beat connects to surrounding beats and the overall arc
- Questions or alternatives the writer might want to consider

## Beats to Generate

${beatList}

## Response Format

Use exactly this delimiter format for each beat:

## BEAT ${beats[0]?.num ?? 1}: ${beats[0]?.name ?? 'Beat Name'}
[brainstorm content]

...and so on for each beat listed above. Only generate content for the beats listed.`;
}

function executeBatch(
  planId: string,
  history: Message[],
): Promise<{ fullText: string; inputTokens: number; outputTokens: number; model: string }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    void (async () => {
      try {
        const unlistenDone = await listen<{ full_text: string; input_tokens: number; output_tokens: number; model: string }>(
          `claude:done:${planId}`,
          (event) => {
            if (settled) return;
            settled = true;
            unlistenDone();
            unlistenError();
            resolve({
              fullText: event.payload.full_text,
              inputTokens: event.payload.input_tokens,
              outputTokens: event.payload.output_tokens,
              model: event.payload.model,
            });
          }
        );
        const unlistenError = await listen<{ error: string }>(
          `claude:error:${planId}`,
          (event) => {
            if (settled) return;
            settled = true;
            unlistenDone();
            unlistenError();
            reject(new Error(event.payload.error));
          }
        );
        await agentExecute(planId, history);
      } catch (e) {
        if (!settled) {
          settled = true;
          reject(e);
        }
      }
    })();
  });
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

  // ─── Suggest All Beats ───
  const [showSuggestMenu, setShowSuggestMenu] = useState(false);
  const [suggestPhase, setSuggestPhase] = useState<SuggestPhase>('idle');
  const [suggestPlan, setSuggestPlan] = useState<AgentPlan | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestMode, setSuggestMode] = useState<SuggestMode>('empty');
  const [writeProgress, setWriteProgress] = useState({ current: 0, total: 0 });
  const suggestPlanRef = useRef<AgentPlan | null>(null);

  const emptyBeatCount = BEATS.filter(b => !statuses[b.num]?.hasBrainstorm).length;

  const handleStartSuggest = useCallback(async (mode: SuggestMode) => {
    if (!projectDir || !activeBookId) return;
    setShowSuggestMenu(false);
    setSuggestMode(mode);
    setSuggestPhase('planning');
    setSuggestError(null);
    try {
      const beatsForPlan = mode === 'all'
        ? [...BEATS]
        : BEATS.filter(b => !statuses[b.num]?.hasBrainstorm);
      const message = buildBeatSuggestPrompt(beatsForPlan);
      const p = await agentPlan(projectDir, 'structure_analyst', { book: activeBookId }, message);
      setSuggestPlan(p);
      suggestPlanRef.current = p;
      setSuggestPhase('confirming');
    } catch (e) {
      setSuggestError(String(e));
      setSuggestPhase('idle');
    }
  }, [projectDir, activeBookId, statuses]);

  const handleConfirmSuggest = useCallback(async () => {
    const plan = suggestPlanRef.current;
    if (!plan || !projectDir || !activeBookId || !rootDir) return;
    setSuggestPhase('generating');

    const beatsToGenerate = suggestMode === 'all'
      ? [...BEATS]
      : BEATS.filter(b => !statuses[b.num]?.hasBrainstorm);

    const message = buildBeatSuggestPrompt(beatsToGenerate);
    const chatMessages = useAIStore.getState().messages;
    const history: Message[] = [
      ...chatMessages.filter(m => m.content.length > 0).map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: message },
    ];

    try {
      const result = await executeBatch(plan.plan_id, history);

      // Track cost
      const cost = calculateCost(result.model, result.inputTokens, result.outputTokens);
      useAIStore.getState().addSessionCost(cost);
      trackCost(cost);

      // Parse and write files
      const beatContents = parseBeatSuggestions(result.fullText);
      const beatsWithContent = beatsToGenerate.filter(b => beatContents.has(b.num));
      setSuggestPhase('writing');
      setWriteProgress({ current: 0, total: beatsWithContent.length });

      let written = 0;
      for (const beat of beatsWithContent) {
        const dir = `${rootDir}\\${beatDir(beat.num, beat.name)}`;
        const filename = await getNextBrainstormFilename(dir);
        const filePath = `${dir}\\${filename}`;
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
          status: 'ai_suggestion',
        };
        try {
          await writeFile(filePath, frontmatter, beatContents.get(beat.num)!);
        } catch (e) {
          console.error(`Failed to write beat ${beat.num}:`, e);
        }
        written++;
        setWriteProgress({ current: written, total: beatsWithContent.length });
      }

      useProjectStore.getState().bumpRefresh();
      setSuggestPhase('done');
    } catch (e) {
      setSuggestError(String(e));
      setSuggestPhase('idle');
    }
  }, [suggestMode, statuses, projectDir, activeBookId, rootDir]);

  const handleCancelSuggest = useCallback(async () => {
    const plan = suggestPlanRef.current;
    if (plan) {
      try { await agentCancel(plan.plan_id); } catch { /* best effort */ }
    }
    setSuggestPlan(null);
    suggestPlanRef.current = null;
    setSuggestPhase('idle');
  }, []);

  const handleCloseSuggest = useCallback(() => {
    setSuggestPlan(null);
    suggestPlanRef.current = null;
    setSuggestError(null);
    setSuggestPhase('idle');
  }, []);

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

          {/* Suggest Beats button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowSuggestMenu(!showSuggestMenu)}
              disabled={suggestPhase !== 'idle'}
              className="flex items-center gap-1.5 text-xs font-medium rounded-md transition-colors"
              style={{
                padding: '4px 10px',
                backgroundColor: suggestPhase === 'planning' ? 'var(--bg-tertiary)' : 'var(--accent)',
                color: suggestPhase === 'planning' ? 'var(--text-secondary)' : '#fff',
                border: 'none',
                cursor: suggestPhase !== 'idle' ? 'not-allowed' : 'pointer',
                opacity: suggestPhase !== 'idle' ? 0.6 : 1,
              }}
            >
              {suggestPhase === 'planning' ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              {suggestPhase === 'planning' ? 'Planning...' : 'Suggest Beats'}
              {suggestPhase === 'idle' && <ChevronDown size={10} />}
            </button>

            {showSuggestMenu && (
              <div
                className="absolute right-0 rounded-lg shadow-lg"
                style={{
                  top: '100%',
                  marginTop: '4px',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-primary)',
                  padding: '4px',
                  zIndex: 50,
                  minWidth: '200px',
                }}
              >
                {emptyBeatCount > 0 && (
                  <button
                    onClick={() => handleStartSuggest('empty')}
                    className="flex items-center gap-2 w-full text-left text-xs rounded-md transition-colors"
                    style={{ padding: '8px 12px', color: 'var(--text-primary)', border: 'none', background: 'none', cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Sparkles size={12} style={{ color: 'var(--accent)' }} />
                    <div>
                      <div className="font-medium">Suggest Empty Beats</div>
                      <div style={{ color: 'var(--text-tertiary)', marginTop: '1px' }}>{emptyBeatCount} beats without brainstorms</div>
                    </div>
                  </button>
                )}
                <button
                  onClick={() => handleStartSuggest('all')}
                  className="flex items-center gap-2 w-full text-left text-xs rounded-md transition-colors"
                  style={{ padding: '8px 12px', color: 'var(--text-primary)', border: 'none', background: 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Sparkles size={12} style={{ color: 'var(--color-magenta)' }} />
                  <div>
                    <div className="font-medium">Suggest All 21 Beats</div>
                    <div style={{ color: 'var(--text-tertiary)', marginTop: '1px' }}>Existing brainstorms are preserved as-is</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Suggest error indicator */}
          {suggestError && suggestPhase === 'idle' && (
            <button
              onClick={() => setSuggestError(null)}
              className="flex items-center gap-1 text-xs"
              style={{ color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer' }}
              title={suggestError}
            >
              <AlertCircle size={12} />
              Error
            </button>
          )}
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
                Click any beat to open its brainstorm document. If you're stuck, start with the anchor beats — Inciting Incident,
                Midpoint Shift, Climactic Confrontation, and Closing Image. When a brainstorm is ready, click
                <strong style={{ color: 'var(--text-secondary)' }}> Generate</strong> to have Claude produce a polished draft.
              </p>
            </div>
          </>
        )}
      </div>
      {/* Suggest Beats Modal — Confirming / Generating / Writing / Done */}
      {suggestPhase !== 'idle' && suggestPhase !== 'planning' && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
          onClick={suggestPhase === 'confirming' || suggestPhase === 'done' ? handleCloseSuggest : undefined}
        >
          <div
            className="rounded-xl"
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              boxShadow: 'var(--shadow-lg)',
              width: '520px',
              maxWidth: '95vw',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
              <div className="flex items-center gap-2">
                <Sparkles size={16} style={{ color: 'var(--accent)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {suggestMode === 'all' ? 'Suggest All 21 Beats' : `Suggest ${emptyBeatCount} Empty Beats`}
                </h3>
              </div>
              {(suggestPhase === 'confirming' || suggestPhase === 'done') && (
                <button
                  onClick={handleCloseSuggest}
                  className="hover-icon"
                  style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto" style={{ padding: '16px 20px' }}>
              {suggestPhase === 'confirming' && suggestPlan && (
                <>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>
                    The AI will generate brainstorm suggestions for {suggestMode === 'all' ? 'all 21 beats' : `${emptyBeatCount} beats without brainstorms`} based
                    on your Seed Phase context. {suggestMode === 'all' ? 'Existing brainstorm files will not be overwritten — new suggestions are saved as separate versions.' : 'Each suggestion will be saved as brainstorm.md in the beat folder.'}
                  </p>

                  {/* Context files */}
                  <div style={{ marginBottom: '16px' }}>
                    <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Context Included ({suggestPlan.context_files.length} files, ~{suggestPlan.total_tokens_est.toLocaleString()} tokens)
                    </label>
                    <div
                      className="rounded-lg"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-primary)',
                        maxHeight: '160px',
                        overflowY: 'auto',
                        padding: '8px 12px',
                      }}
                    >
                      {suggestPlan.context_files.map((f, i) => {
                        const shortPath = f.path.split(/[\\/]/).slice(-3).join('/');
                        return (
                          <div key={i} className="flex items-center justify-between text-xs" style={{ padding: '2px 0' }}>
                            <span style={{ color: 'var(--text-primary)' }}>{shortPath}</span>
                            <span style={{ color: 'var(--text-tertiary)', marginLeft: '8px', flexShrink: 0 }}>~{f.tokens_est.toLocaleString()} tokens</span>
                          </div>
                        );
                      })}
                      {suggestPlan.context_files.length === 0 && (
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No context files found</span>
                      )}
                    </div>
                  </div>

                  {/* Cost estimate */}
                  <div className="flex items-center gap-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', padding: '10px 14px', marginBottom: '4px' }}>
                    <div className="flex-1">
                      <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Estimated Cost</div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{suggestPlan.estimated_cost}</div>
                    </div>
                    <div>
                      <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Model</div>
                      <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{suggestPlan.model}</div>
                    </div>
                  </div>
                </>
              )}

              {suggestPhase === 'generating' && (
                <div className="flex flex-col items-center justify-center" style={{ padding: '32px 0' }}>
                  <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)', marginBottom: '12px' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Generating beat suggestions...</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '4px' }}>This may take a minute for all 21 beats</p>
                </div>
              )}

              {suggestPhase === 'writing' && (
                <div className="flex flex-col items-center justify-center" style={{ padding: '32px 0' }}>
                  <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)', marginBottom: '12px' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Writing brainstorm files... {writeProgress.current}/{writeProgress.total}
                  </p>
                  <div style={{ width: '200px', height: '4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '2px', marginTop: '12px', overflow: 'hidden' }}>
                    <div style={{
                      width: writeProgress.total > 0 ? `${(writeProgress.current / writeProgress.total) * 100}%` : '0%',
                      height: '100%',
                      backgroundColor: 'var(--accent)',
                      borderRadius: '2px',
                      transition: 'width 0.2s',
                    }} />
                  </div>
                </div>
              )}

              {suggestPhase === 'done' && (
                <div className="flex flex-col items-center justify-center" style={{ padding: '32px 0' }}>
                  <Check size={24} style={{ color: 'var(--color-success)', marginBottom: '12px' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Beat suggestions written successfully
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    Click any beat to review and refine the AI's suggestions
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 justify-end" style={{ padding: '12px 20px', borderTop: '1px solid var(--border-primary)' }}>
              {suggestPhase === 'confirming' && (
                <>
                  <button
                    onClick={handleCancelSuggest}
                    className="rounded-lg text-xs font-medium hover-btn"
                    style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', padding: '8px 16px' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmSuggest}
                    className="rounded-lg text-xs font-medium hover-btn-primary"
                    style={{ backgroundColor: 'var(--accent)', color: '#fff', border: 'none', padding: '8px 16px' }}
                  >
                    Generate ({suggestPlan?.estimated_cost})
                  </button>
                </>
              )}
              {suggestPhase === 'generating' && (
                <button
                  onClick={handleCancelSuggest}
                  className="rounded-lg text-xs font-medium hover-btn"
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', padding: '8px 16px' }}
                >
                  Cancel
                </button>
              )}
              {suggestPhase === 'done' && (
                <button
                  onClick={handleCloseSuggest}
                  className="rounded-lg text-xs font-medium hover-btn-primary"
                  style={{ backgroundColor: 'var(--accent)', color: '#fff', border: 'none', padding: '8px 16px' }}
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
