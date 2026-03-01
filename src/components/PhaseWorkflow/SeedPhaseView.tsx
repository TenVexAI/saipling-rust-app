import { useState, useEffect, useCallback, useMemo } from 'react';
import { Check, Circle, Loader2, Info, FileText, Sparkles, ExternalLink } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { readFile, writeFile, loadTemplate, getBookMetadata, updateBookMetadata } from '../../utils/tauri';
import { openHelpWindow } from '../../utils/helpWindow';
import { useGenerate } from '../../hooks/useGenerate';
import { extractDraftBody } from '../../utils/applyParser';
import { PhaseIcon } from './PhaseIcon';
import { SEED_ELEMENTS } from './seedElements';

interface ElementStatus {
  hasBrainstorm: boolean;
  hasDraft: boolean;
}

export function SeedPhaseView() {
  const projectDir = useProjectStore((s) => s.projectDir);
  const activeBookId = useProjectStore((s) => s.activeBookId);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const refresh = useProjectStore((s) => s.refreshCounter);
  const [statuses, setStatuses] = useState<Record<string, ElementStatus>>({});
  const [loading, setLoading] = useState(true);
  const [hasStoryFoundation, setHasStoryFoundation] = useState(false);
  const [loglineText, setLoglineText] = useState('');

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
      try {
        await readFile(brainstormPath);
        hasBrainstorm = true;
      } catch { /* doesn't exist yet */ }
      try {
        await readFile(draftPath);
        hasDraft = true;
      } catch { /* doesn't exist yet */ }
      result[el.key] = { hasBrainstorm, hasDraft };
    }
    setStatuses(result);

    // Check for phase deliverables
    const loglinePath = `${seedDir}\\logline.md`;
    const foundationPath = `${seedDir}\\story-foundation.md`;
    let foundFoundation = false;
    try {
      const loglineContent = await readFile(loglinePath);
      setLoglineText(loglineContent.body.trim());
    } catch {
      setLoglineText('');
    }
    try {
      await readFile(foundationPath);
      foundFoundation = true;
    } catch { /* doesn't exist yet */ }
    setHasStoryFoundation(foundFoundation);

    setLoading(false);
  }, [seedDir, projectDir]);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses, refresh]);

  const handleElementClick = async (el: typeof SEED_ELEMENTS[0]) => {
    if (!seedDir || !projectDir || !activeBookId) return;
    const elDir = `${seedDir}\\${el.slug}`;
    const brainstormPath = `${elDir}\\brainstorm.md`;
    const draftPath = `${elDir}\\draft.md`;
    const status = statuses[el.key];

    // If a draft exists, open it
    if (status?.hasDraft) {
      setActiveFile(draftPath);
      return;
    }

    // Create brainstorm.md from template if it doesn't exist
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
  const allDrafted = filledCount === 6;
  const phaseComplete = hasStoryFoundation;

  // When story foundation is created, mark seed phase complete + root as in_progress
  useEffect(() => {
    if (!hasStoryFoundation || !projectDir || !activeBookId) return;
    (async () => {
      try {
        const meta = await getBookMetadata(projectDir, activeBookId);
        const pp = { ...meta.phase_progress };
        const seedProgress = pp['seed'] || { status: 'not_started' };
        if (seedProgress.status === 'complete') return; // already done
        pp['seed'] = { ...seedProgress, status: 'complete', completed_at: new Date().toISOString() };
        if (!pp['root'] || pp['root'].status === 'not_started') {
          pp['root'] = { status: 'in_progress' };
        }
        const updated = { ...meta, phase_progress: pp };
        await updateBookMetadata(projectDir, activeBookId, updated);
        // Refresh activeBookMeta in the store so phase bar + dashboard update
        useProjectStore.getState().setActiveBook(activeBookId, updated);
      } catch (e) {
        console.error('Failed to update phase progress:', e);
      }
    })();
  }, [hasStoryFoundation, projectDir, activeBookId]);

  // Find the first element in order that doesn't have a draft yet
  const [showGuide, setShowGuide] = useState(false);
  const [guideDismissed, setGuideDismissed] = useState(false);

  const nextElement = useMemo(() => {
    if (loading || guideDismissed) return null;
    for (const el of SEED_ELEMENTS) {
      const s = statuses[el.key];
      if (!s?.hasDraft) return el;
    }
    return null; // all drafted
  }, [statuses, loading, guideDismissed]);

  useEffect(() => {
    if (!loading && !guideDismissed && (nextElement || (allDrafted && !hasStoryFoundation))) {
      setShowGuide(true);
    } else {
      setShowGuide(false);
    }
  }, [nextElement, loading, guideDismissed, allDrafted, hasStoryFoundation]);

  // Story Foundation generation
  const { phase: genPhase, plan: genPlan, error: genError, startGenerate, confirmGenerate, cancelGenerate, reset: resetGen } = useGenerate();

  const handleGenerateFoundation = async () => {
    if (!seedDir || !projectDir || !activeBookId) return;
    const foundationPath = `${seedDir}\\story-foundation.md`;
    const now = new Date().toISOString().slice(0, 10);
    await startGenerate({
      skill: 'seed_developer',
      scope: { book: activeBookId },
      message: `All 6 core seed elements have been drafted. Please synthesize them into the final Seed Phase deliverables:\n\n1. **Logline** — A single compelling sentence (or at most two) that captures the entire story. This is the elevator pitch.\n\n2. **Story Foundation** — 3–5 paragraphs that weave all 6 elements together into a cohesive narrative summary. This is NOT a section-by-section relisting — it is a unified synthesis that captures the story's DNA, naturally integrating the premise, theme, protagonist, central conflict, story world, and emotional promise.\n\nFormat your response as:\n\n## Logline\n[the logline]\n\n## Story Foundation\n[the synthesis paragraphs]`,
      outputPath: foundationPath,
      frontmatter: {
        type: 'story-foundation',
        scope: activeBookId,
        phase: 'seed',
        created: now,
        modified: now,
        status: 'generated',
        generated_from: SEED_ELEMENTS.map(el => `books/${activeBookId}/phase-1-seed/${el.slug}/draft.md`),
      },
      parseResponse: (raw: string) => {
        // Extract the body, then also write logline.md as a side effect
        const body = extractDraftBody(raw);
        // Try to extract logline section
        const loglineMatch = body.match(/##\s*Logline\s*\n+([\s\S]*?)(?=\n##|$)/);
        if (loglineMatch && seedDir && activeBookId) {
          const loglineBody = loglineMatch[1].trim().replace(/\n---\s*$/, '').trim();
          const loglinePath = `${seedDir}\\logline.md`;
          writeFile(loglinePath, {
            type: 'logline',
            scope: activeBookId,
            phase: 'seed',
            created: now,
            modified: now,
            status: 'generated',
            generated_from: [
              `books/${activeBookId}/phase-1-seed/premise/draft.md`,
              `books/${activeBookId}/phase-1-seed/central-conflict/draft.md`,
              `books/${activeBookId}/phase-1-seed/protagonist/draft.md`,
            ],
          }, loglineBody).catch(e => console.error('Failed to write logline:', e));
        }
        return body;
      },
    });
  };

  const handleConfirmFoundation = async () => {
    await confirmGenerate();
  };

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
              width: `${phaseComplete ? 100 : (filledCount / 6) * 100}%`,
              height: '100%',
              backgroundColor: phaseComplete ? 'var(--color-success)' : 'var(--accent)',
              borderRadius: '2px',
              transition: 'width 0.3s',
            }} />
          </div>
          <span className="text-xs font-medium" style={{ color: phaseComplete ? 'var(--color-success)' : 'var(--text-tertiary)' }}>
            {phaseComplete ? 'Complete' : `${filledCount}/6 drafted`}
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
              const status = statuses[el.key] || { hasBrainstorm: false, hasDraft: false };
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
                  <p className="text-xs italic" style={{ color: status.hasDraft ? 'var(--color-success)' : 'var(--text-tertiary)' }}>
                    {status.hasDraft ? 'Click to edit draft' : 'Click to start brainstorming'}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {/* Guidance / Foundation Card */}
        <div className="rounded-lg" style={{ marginTop: '24px', padding: '16px', backgroundColor: 'var(--bg-elevated)', border: `1px solid ${phaseComplete ? 'var(--color-success)' : 'var(--border-primary)'}` }}>
          {phaseComplete ? (
            /* State 3: Foundation generated — show logline + open buttons */
            <>
              <p className="text-xs font-medium" style={{ color: 'var(--color-success)', marginBottom: '10px' }}>
                Seed Phase Complete
              </p>
              {loglineText && (
                <div style={{ marginBottom: '12px' }}>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: '4px' }}>Logline</p>
                  <div className="flex items-start gap-2">
                    <p className="text-xs flex-1" style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontStyle: 'italic' }}>
                      {loglineText}
                    </p>
                    <button
                      onClick={() => seedDir && setActiveFile(`${seedDir}\\logline.md`)}
                      className="shrink-0 flex items-center justify-center rounded hover-icon"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px' }}
                      title="Open logline"
                    >
                      <ExternalLink size={13} />
                    </button>
                  </div>
                </div>
              )}
              <button
                onClick={() => seedDir && setActiveFile(`${seedDir}\\story-foundation.md`)}
                className="flex items-center gap-1.5 text-xs font-medium rounded-md hover-btn-primary"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--text-inverse)', border: 'none', padding: '6px 14px', cursor: 'pointer' }}
              >
                <FileText size={12} />
                Story Foundation
              </button>
            </>
          ) : allDrafted ? (
            /* State 2: All 6 drafted — show generate button */
            <>
              <p className="text-xs font-medium" style={{ color: 'var(--accent)', marginBottom: '6px' }}>
                All 6 Core Elements Drafted
              </p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)', lineHeight: '1.6', marginBottom: '12px' }}>
                Claude will read all 6 of your drafted elements and synthesize them into a <strong style={{ color: 'var(--text-secondary)' }}>Story Foundation</strong> — a
                cohesive narrative summary that captures your story's DNA — along with a distilled <strong style={{ color: 'var(--text-secondary)' }}>Logline</strong>.
                These become the primary alignment context for all subsequent phases.
              </p>
              <div className="flex items-center gap-2">
                {genPhase === 'idle' && (
                  <button
                    onClick={handleGenerateFoundation}
                    className="flex items-center gap-1.5 text-xs font-medium rounded-md hover-btn-primary"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--text-inverse)', border: 'none', padding: '6px 14px', cursor: 'pointer' }}
                  >
                    <Sparkles size={12} />
                    Generate Story Foundation
                  </button>
                )}
                {genPhase === 'planning' && (
                  <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    <Loader2 size={12} className="animate-spin" /> Planning...
                  </span>
                )}
                {genPhase === 'confirming' && genPlan && (
                  <>
                    <button
                      onClick={handleConfirmFoundation}
                      className="flex items-center gap-1.5 text-xs font-medium rounded-md"
                      style={{ backgroundColor: 'var(--color-success)', color: '#fff', border: 'none', padding: '6px 14px', cursor: 'pointer' }}
                    >
                      <Check size={12} />
                      Confirm ({genPlan.estimated_cost})
                    </button>
                    <button
                      onClick={cancelGenerate}
                      className="flex items-center gap-1.5 text-xs font-medium rounded-md hover-btn"
                      style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', padding: '5px 12px', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </>
                )}
                {genPhase === 'generating' && (
                  <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--accent)' }}>
                    <Loader2 size={12} className="animate-spin" /> Generating...
                  </span>
                )}
                {genPhase === 'done' && (
                  <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--color-success)' }}>
                    <Check size={12} /> Done!
                  </span>
                )}
                {genError && (
                  <button onClick={resetGen} className="text-xs" style={{ color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer' }} title={genError}>
                    Error — click to retry
                  </button>
                )}
              </div>
            </>
          ) : (
            /* State 1: Still drafting — show guidance */
            <>
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)', marginBottom: '6px' }}>
                How to use the Seed Phase
              </p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)', lineHeight: '1.6' }}>
                Click any element to open its brainstorm document in the editor. Write your ideas, then use the AI Chat panel to
                refine them with Claude. When your brainstorm is ready, use the <strong style={{ color: 'var(--text-secondary)' }}>Generate</strong> button
                in the editor toolbar to have Claude produce a polished draft.
              </p>
            </>
          )}
        </div>
      </div>
      {/* Guided workflow modal */}
      {showGuide && (nextElement || (allDrafted && !hasStoryFoundation)) && (
        <SeedGuideModal
          element={nextElement}
          statuses={statuses}
          allDrafted={allDrafted && !hasStoryFoundation}
          onStart={() => {
            setShowGuide(false);
            if (nextElement) {
              handleElementClick(nextElement);
            }
          }}
          onGenerateFoundation={() => {
            setShowGuide(false);
            handleGenerateFoundation();
          }}
          onDismiss={() => {
            setShowGuide(false);
            setGuideDismissed(true);
          }}
        />
      )}
    </div>
  );
}

/* ─── Guided Workflow Modal ─── */

interface SeedGuideModalProps {
  element: typeof SEED_ELEMENTS[0] | null;
  statuses: Record<string, ElementStatus>;
  allDrafted: boolean;
  onStart: () => void;
  onGenerateFoundation: () => void;
  onDismiss: () => void;
}

function SeedGuideModal({ element, statuses, allDrafted, onStart, onGenerateFoundation, onDismiss }: SeedGuideModalProps) {
  const completedCount = SEED_ELEMENTS.filter(e => statuses[e.key]?.hasDraft).length;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
      onClick={onDismiss}
    >
      <div
        className="rounded-xl"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          padding: '28px',
          maxWidth: '460px',
          width: '90%',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
          <Sparkles size={18} style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {allDrafted ? 'Generate Story Foundation' : completedCount === 0 ? 'Start Your Story Foundation' : `Next Up — ${element?.label}`}
          </h2>
        </div>

        <div className="flex items-center gap-1" style={{ marginBottom: '16px' }}>
          {SEED_ELEMENTS.map((el) => (
            <div
              key={el.key}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                backgroundColor: statuses[el.key]?.hasDraft
                  ? 'var(--color-success)'
                  : 'var(--border-primary)',
                transition: 'background-color 0.3s',
              }}
            />
          ))}
        </div>

        {allDrafted ? (
          <>
            <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '12px' }}>
              All <strong style={{ color: 'var(--text-primary)' }}>6 core elements</strong> are drafted! Claude can now synthesize them
              into a cohesive <strong style={{ color: 'var(--text-primary)' }}>Story Foundation</strong> and a distilled <strong style={{ color: 'var(--text-primary)' }}>Logline</strong>.
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '20px' }}>
              The Story Foundation becomes the primary alignment context for all subsequent phases of your book.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '12px' }}>
              {completedCount === 0 && element ? (
                <>The Seed Phase walks you through 6 core story elements, starting with the <strong style={{ color: 'var(--text-primary)' }}>{element.label}</strong> — {element.description.toLowerCase()}.&nbsp;Each element builds on the last.</>
              ) : element ? (
                <>You've completed <strong style={{ color: 'var(--text-primary)' }}>{completedCount} of 6</strong> elements.&nbsp;The next element is <strong style={{ color: 'var(--text-primary)' }}>{element.label}</strong> — {element.description.toLowerCase()}.</>
              ) : null}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '20px' }}>
              You'll brainstorm ideas first, then use the AI to generate a polished draft.
            </p>
          </>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onDismiss}
            className="rounded-lg text-xs font-medium hover-btn"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)',
              padding: '8px 16px',
              cursor: 'pointer',
            }}
          >
            Not Now
          </button>
          {allDrafted ? (
            <button
              onClick={onGenerateFoundation}
              className="rounded-lg text-xs font-medium hover-btn-primary"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--text-inverse)',
                border: 'none',
                padding: '8px 16px',
                cursor: 'pointer',
              }}
            >
              Generate Story Foundation
            </button>
          ) : element && (
            <button
              onClick={onStart}
              className="rounded-lg text-xs font-medium hover-btn-primary"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--text-inverse)',
                border: 'none',
                padding: '8px 16px',
                cursor: 'pointer',
              }}
            >
              {statuses[element.key]?.hasBrainstorm ? 'Open Brainstorm' : 'Start Brainstorming'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
