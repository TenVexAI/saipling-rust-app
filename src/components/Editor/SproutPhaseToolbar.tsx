import { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, ChevronDown, Settings2, Loader2, X } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { useProjectStore } from '../../stores/projectStore';
import { useAIStore } from '../../stores/aiStore';
import { readFile, agentPlan, agentExecute, agentCancel, writeFile } from '../../utils/tauri';
import { trackCost } from '../../utils/projectCost';
import { calculateCost } from '../../utils/modelPricing';
import { JOURNEY_STAGES } from '../PhaseWorkflow/sproutHelpers';
import { extractDraftBody } from '../../utils/applyParser';
import type { AgentPlan } from '../../types/ai';

interface SproutPhaseToolbarProps {
  currentFilePath: string;
}

type GeneratePhase = 'idle' | 'planning' | 'confirming' | 'generating';

function parseSproutPath(filePath: string): { bookId: string; charSlug: string; stageDirName: string } | null {
  const match = filePath.match(/[\\/]books[\\/](book-\d+)[\\/]phase-3-sprout[\\/]([^\\/]+)[\\/]([^\\/]+)[\\/]/);
  if (!match) return null;
  return { bookId: match[1], charSlug: match[2], stageDirName: match[3] };
}

export function SproutPhaseToolbar({ currentFilePath }: SproutPhaseToolbarProps) {
  const projectDir = useProjectStore((s) => s.projectDir);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const setActiveView = useProjectStore((s) => s.setActiveView);
  const setContextExpandFolder = useProjectStore((s) => s.setContextExpandFolder);
  const [showDropdown, setShowDropdown] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  const [phase, setPhase] = useState<GeneratePhase>('idle');
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamedRef = useRef<string>('');

  const parsed = parseSproutPath(currentFilePath);
  const bookId = parsed?.bookId ?? null;
  const charSlug = parsed?.charSlug ?? null;
  const stageDirName = parsed?.stageDirName ?? null;

  // Match stage from dir name (stage-N-slug)
  const stageMatch = stageDirName?.match(/^stage-(\d+)-(.+)$/);
  const stageNum = stageMatch ? parseInt(stageMatch[1], 10) : null;
  const stage = JOURNEY_STAGES.find(s => s.num === stageNum);
  const stageLabel = stage?.name ?? stageDirName ?? 'Stage';
  const charName = charSlug?.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Character';

  const stageDirectory = projectDir && bookId && charSlug && stageDirName
    ? `${projectDir}\\books\\${bookId}\\phase-3-sprout\\${charSlug}\\${stageDirName}`
    : null;

  const brainstormPath = stageDirectory ? `${stageDirectory}\\brainstorm.md` : null;
  const draftPath = stageDirectory ? `${stageDirectory}\\draft.md` : null;
  const currentFileName = currentFilePath.split(/[\\/]/).pop() || '';

  const checkDraft = useCallback(async () => {
    if (!draftPath) return;
    try {
      await readFile(draftPath);
      setHasDraft(true);
    } catch {
      setHasDraft(false);
    }
  }, [draftPath]);

  useEffect(() => {
    checkDraft();
  }, [checkDraft, currentFilePath]);

  const handleGenerate = async () => {
    if (!projectDir || !bookId) return;
    setPhase('planning');
    setError(null);
    try {
      const userMessage = `Develop Stage ${stageNum}: "${stageLabel}" for character "${charName}" based on the brainstorm notes. Produce a focused draft of this journey stage — how it manifests for this specific character.`;
      const p = await agentPlan(projectDir, 'character_developer', { book: bookId }, userMessage);
      setPlan(p);
      setPhase('confirming');
    } catch (e) {
      setError(String(e));
      setPhase('idle');
    }
  };

  const handleConfirmGenerate = async () => {
    if (!plan || !projectDir || !draftPath || !bookId || !charSlug || !stageDirName || !stageNum) return;
    setPhase('generating');
    streamedRef.current = '';

    const chatMessages = useAIStore.getState().messages;
    const history = [
      ...chatMessages.filter(m => m.content.length > 0).map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: `Develop Stage ${stageNum}: "${stageLabel}" for character "${charName}" based on the brainstorm notes.` },
    ];

    const unlistenChunk = await listen<{ text: string }>(`claude:chunk:${plan.plan_id}`, (event) => {
      streamedRef.current += event.payload.text;
    });
    const unlistenDone = await listen<{ full_text: string; input_tokens: number; output_tokens: number; model: string }>(`claude:done:${plan.plan_id}`, async (event) => {
      unlistenChunk();
      unlistenDone();
      unlistenError();
      const cost = calculateCost(event.payload.model, event.payload.input_tokens, event.payload.output_tokens);
      useAIStore.getState().addSessionCost(cost);
      trackCost(cost);

      const now = new Date().toISOString().slice(0, 10);
      const genFrontmatter: Record<string, unknown> = {
        type: 'journey-stage-draft',
        scope: bookId,
        character_id: charSlug,
        stage_number: stageNum,
        stage_name: stageLabel,
        created: now,
        modified: now,
        status: 'generated',
        generated_from: [`books/${bookId}/phase-3-sprout/${charSlug}/${stageDirName}/brainstorm.md`],
      };

      try {
        await writeFile(draftPath, genFrontmatter, extractDraftBody(event.payload.full_text));
        useProjectStore.getState().bumpRefresh();
        setHasDraft(true);
        setActiveFile(draftPath);
        setPhase('idle');
        setPlan(null);
      } catch (e) {
        setError(`Failed to write draft: ${String(e)}`);
        setPhase('idle');
      }
    });
    const unlistenError = await listen<{ error: string }>(`claude:error:${plan.plan_id}`, (event) => {
      unlistenChunk();
      unlistenDone();
      unlistenError();
      setError(event.payload.error);
      setPhase('idle');
    });

    try {
      await agentExecute(plan.plan_id, history);
    } catch (e) {
      unlistenChunk();
      unlistenDone();
      unlistenError();
      setError(String(e));
      setPhase('idle');
    }
  };

  const handleCancelGenerate = async () => {
    if (plan) {
      try { await agentCancel(plan.plan_id); } catch { /* best effort */ }
    }
    setPlan(null);
    setPhase('idle');
  };

  const handleContextSettings = () => {
    setActiveView('files');
    if (stageDirectory) setContextExpandFolder(stageDirectory);
  };

  const isGenerating = phase === 'planning' || phase === 'generating';

  const dropdownFiles: { name: string; path: string }[] = [];
  if (brainstormPath) dropdownFiles.push({ name: 'brainstorm.md', path: brainstormPath });
  if (hasDraft && draftPath) dropdownFiles.push({ name: 'draft.md', path: draftPath });

  return (
    <>
      <div
        className="flex items-center gap-2 shrink-0"
        style={{ padding: '6px 16px', borderBottom: '1px solid var(--border-secondary)', backgroundColor: 'var(--bg-elevated)' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--accent)', marginRight: '4px' }}>
          {charName} · Stage {stageNum}: {stageLabel}
        </span>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-1.5 rounded-md text-xs font-medium hover-btn-primary"
          style={{
            backgroundColor: isGenerating ? 'var(--bg-tertiary)' : 'var(--accent)',
            color: isGenerating ? 'var(--text-tertiary)' : 'var(--text-inverse)',
            padding: '5px 12px',
            border: 'none',
            opacity: isGenerating ? 0.7 : 1,
          }}
        >
          {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {phase === 'planning' ? 'Planning...' : phase === 'generating' ? 'Generating...' : hasDraft ? 'Regenerate' : 'Generate'}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1.5 rounded-md text-xs font-medium hover-btn"
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '5px 12px', border: '1px solid var(--border-primary)' }}
          >
            {currentFileName}
            <ChevronDown size={12} />
          </button>

          {showDropdown && (
            <div
              className="absolute left-0 rounded-lg"
              style={{ top: '100%', marginTop: '4px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', boxShadow: 'var(--shadow-md)', minWidth: '200px', zIndex: 100, overflow: 'hidden' }}
            >
              {dropdownFiles.map((file) => {
                const isActive = currentFilePath.endsWith(file.name);
                return (
                  <button
                    key={file.path}
                    onClick={() => { setActiveFile(file.path); setShowDropdown(false); }}
                    className="flex items-center w-full text-left text-xs transition-colors"
                    style={{ padding: '8px 12px', color: isActive ? 'var(--accent)' : 'var(--text-primary)', backgroundColor: isActive ? 'var(--accent-subtle)' : 'transparent', border: 'none' }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    {file.name}
                  </button>
                );
              })}
              {!hasDraft && (
                <div className="text-xs" style={{ padding: '6px 12px', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-primary)' }}>
                  Draft will appear here after generation
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleContextSettings}
          className="flex items-center gap-1.5 rounded-md text-xs font-medium hover-btn"
          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '5px 12px', border: '1px solid var(--border-primary)' }}
        >
          <Settings2 size={13} />
          Context Settings
        </button>

        {error && (
          <span className="text-xs" style={{ color: 'var(--color-error)', marginLeft: '8px' }}>
            {error}
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: 'var(--color-error)', marginLeft: '4px', cursor: 'pointer' }}><X size={10} /></button>
          </span>
        )}
      </div>

      {phase === 'confirming' && plan && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }} onClick={handleCancelGenerate}>
          <div className="rounded-xl" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', boxShadow: 'var(--shadow-lg)', padding: '24px', maxWidth: '440px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)', marginBottom: '12px' }}>
              {hasDraft ? `Regenerate "${stageLabel}" Draft` : `Generate "${stageLabel}" Draft`}
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
              {hasDraft
                ? `This will overwrite the existing draft for "${charName}" — Stage ${stageNum}: "${stageLabel}".`
                : `This will generate a focused draft for "${charName}" — Stage ${stageNum}: "${stageLabel}" from your brainstorm notes.`}
            </p>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: '8px' }}>
              <div className="flex justify-between" style={{ marginBottom: '4px' }}><span>Skill</span><span style={{ color: 'var(--text-secondary)' }}>Character Developer</span></div>
              <div className="flex justify-between" style={{ marginBottom: '4px' }}><span>Context files</span><span style={{ color: 'var(--text-secondary)' }}>{plan.context_files.length}</span></div>
              <div className="flex justify-between" style={{ marginBottom: '4px' }}><span>Est. tokens</span><span style={{ color: 'var(--text-secondary)' }}>{plan.total_tokens_est.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Est. cost</span><span style={{ color: 'var(--accent)' }}>{plan.estimated_cost}</span></div>
            </div>
            <div className="flex gap-2 justify-end" style={{ marginTop: '20px' }}>
              <button onClick={handleCancelGenerate} className="rounded-lg text-xs font-medium hover-btn" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', padding: '8px 16px' }}>Cancel</button>
              <button onClick={handleConfirmGenerate} className="rounded-lg text-xs font-medium hover-btn-primary" style={{ backgroundColor: 'var(--accent)', color: 'var(--text-inverse)', border: 'none', padding: '8px 16px' }}>{hasDraft ? 'Regenerate' : 'Generate'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
