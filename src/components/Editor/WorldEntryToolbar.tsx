import { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, ChevronDown, Settings2, Loader2, X } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { useProjectStore } from '../../stores/projectStore';
import { useAIStore } from '../../stores/aiStore';
import { readFile, agentPlan, agentExecute, agentCancel, writeFile } from '../../utils/tauri';
import { trackCost } from '../../utils/projectCost';
import { calculateCost } from '../../utils/modelPricing';
import { extractDraftBody } from '../../utils/applyParser';
import type { AgentPlan } from '../../types/ai';

interface WorldEntryToolbarProps {
  currentFilePath: string;
}

type GeneratePhase = 'idle' | 'planning' | 'confirming' | 'generating';

function parseWorldPath(filePath: string): { category: string; entrySlug: string } | null {
  const match = filePath.match(/[\\/]world[\\/]([^\\/]+)[\\/]([^\\/]+)[\\/]/);
  if (!match) return null;
  return { category: match[1], entrySlug: match[2] };
}

export function WorldEntryToolbar({ currentFilePath }: WorldEntryToolbarProps) {
  const projectDir = useProjectStore((s) => s.projectDir);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const setActiveView = useProjectStore((s) => s.setActiveView);
  const setContextExpandFolder = useProjectStore((s) => s.setContextExpandFolder);
  const [showDropdown, setShowDropdown] = useState(false);
  const [hasEntry, setHasEntry] = useState(false);

  const [phase, setPhase] = useState<GeneratePhase>('idle');
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamedRef = useRef<string>('');

  const parsed = parseWorldPath(currentFilePath);
  const category = parsed?.category ?? null;
  const entrySlug = parsed?.entrySlug ?? null;
  const categoryLabel = category?.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'World';
  const entryName = entrySlug?.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Entry';

  const entryDir = projectDir && category && entrySlug
    ? `${projectDir}\\world\\${category}\\${entrySlug}`
    : null;

  const brainstormPath = entryDir ? `${entryDir}\\brainstorm.md` : null;
  const entryPath = entryDir ? `${entryDir}\\entry.md` : null;
  const currentFileName = currentFilePath.split(/[\\/]/).pop() || '';

  const checkEntry = useCallback(async () => {
    if (!entryPath) return;
    try {
      await readFile(entryPath);
      setHasEntry(true);
    } catch {
      setHasEntry(false);
    }
  }, [entryPath]);

  useEffect(() => {
    checkEntry();
  }, [checkEntry, currentFilePath]);

  const handleGenerate = async () => {
    if (!projectDir) return;
    setPhase('planning');
    setError(null);
    try {
      const userMessage = `Generate a complete world entry for "${entryName}" (category: ${categoryLabel}) based on the brainstorm notes. Include: overview, details, story significance, and connections to other world elements.`;
      const p = await agentPlan(projectDir, 'world_builder', {}, userMessage);
      setPlan(p);
      setPhase('confirming');
    } catch (e) {
      setError(String(e));
      setPhase('idle');
    }
  };

  const handleConfirmGenerate = async () => {
    if (!plan || !projectDir || !entryPath || !category || !entrySlug) return;
    setPhase('generating');
    streamedRef.current = '';

    const chatMessages = useAIStore.getState().messages;
    const history = [
      ...chatMessages.filter(m => m.content.length > 0).map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: `Generate a complete world entry for "${entryName}" (category: ${categoryLabel}) based on the brainstorm notes.` },
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
        type: 'world-entry',
        scope: 'series',
        category: category,
        entry_id: entrySlug,
        created: now,
        modified: now,
        status: 'generated',
        generated_from: [`world/${category}/${entrySlug}/brainstorm.md`],
      };

      try {
        await writeFile(entryPath, genFrontmatter, extractDraftBody(event.payload.full_text));
        useProjectStore.getState().bumpRefresh();
        setHasEntry(true);
        setActiveFile(entryPath);
        setPhase('idle');
        setPlan(null);
      } catch (e) {
        setError(`Failed to write entry: ${String(e)}`);
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
    if (entryDir) setContextExpandFolder(entryDir);
  };

  const isGenerating = phase === 'planning' || phase === 'generating';

  const dropdownFiles: { name: string; path: string }[] = [];
  if (brainstormPath) dropdownFiles.push({ name: 'brainstorm.md', path: brainstormPath });
  if (hasEntry && entryPath) dropdownFiles.push({ name: 'entry.md', path: entryPath });

  return (
    <>
      <div
        className="flex items-center gap-2 shrink-0"
        style={{ padding: '6px 16px', borderBottom: '1px solid var(--border-secondary)', backgroundColor: 'var(--bg-elevated)' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--accent)', marginRight: '4px' }}>
          {categoryLabel}: {entryName}
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
          {phase === 'planning' ? 'Planning...' : phase === 'generating' ? 'Generating...' : hasEntry ? 'Regenerate Entry' : 'Generate Entry'}
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
              {!hasEntry && (
                <div className="text-xs" style={{ padding: '6px 12px', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-primary)' }}>
                  Entry will appear here after generation
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
              {hasEntry ? `Regenerate "${entryName}" Entry` : `Generate "${entryName}" Entry`}
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
              {hasEntry
                ? `This will overwrite the existing entry for "${entryName}" using the brainstorm notes and chat history.`
                : `This will generate a complete world entry for "${entryName}" from the brainstorm notes and chat history.`}
            </p>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: '8px' }}>
              <div className="flex justify-between" style={{ marginBottom: '4px' }}><span>Skill</span><span style={{ color: 'var(--text-secondary)' }}>World Builder</span></div>
              <div className="flex justify-between" style={{ marginBottom: '4px' }}><span>Context files</span><span style={{ color: 'var(--text-secondary)' }}>{plan.context_files.length}</span></div>
              <div className="flex justify-between" style={{ marginBottom: '4px' }}><span>Est. tokens</span><span style={{ color: 'var(--text-secondary)' }}>{plan.total_tokens_est.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Est. cost</span><span style={{ color: 'var(--accent)' }}>{plan.estimated_cost}</span></div>
            </div>
            <div className="flex gap-2 justify-end" style={{ marginTop: '20px' }}>
              <button onClick={handleCancelGenerate} className="rounded-lg text-xs font-medium hover-btn" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', padding: '8px 16px' }}>Cancel</button>
              <button onClick={handleConfirmGenerate} className="rounded-lg text-xs font-medium hover-btn-primary" style={{ backgroundColor: 'var(--accent)', color: 'var(--text-inverse)', border: 'none', padding: '8px 16px' }}>{hasEntry ? 'Regenerate' : 'Generate'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
