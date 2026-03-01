import { useState, useRef, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { agentPlan, agentExecute, agentCancel, writeFile } from '../utils/tauri';
import { useProjectStore } from '../stores/projectStore';
import { useAIStore } from '../stores/aiStore';
import { trackCost } from '../utils/projectCost';
import { calculateCost } from '../utils/modelPricing';
import { extractDraftBody } from '../utils/applyParser';
import type { AgentPlan, ContextScope } from '../types/ai';

export type GeneratePhase = 'idle' | 'planning' | 'confirming' | 'generating' | 'done';

interface GenerateOptions {
  skill: string;
  scope: ContextScope;
  message: string;
  outputPath: string;
  frontmatter: Record<string, unknown>;
  /** Called with the raw AI response text; return the body to write. Default: identity. */
  parseResponse?: (text: string) => string;
}

interface UseGenerateReturn {
  phase: GeneratePhase;
  plan: AgentPlan | null;
  error: string | null;
  startGenerate: (opts: GenerateOptions) => Promise<void>;
  confirmGenerate: () => Promise<void>;
  cancelGenerate: () => Promise<void>;
  reset: () => void;
}

export function useGenerate(): UseGenerateReturn {
  const projectDir = useProjectStore((s) => s.projectDir);
  const [phase, setPhase] = useState<GeneratePhase>('idle');
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const optsRef = useRef<GenerateOptions | null>(null);
  const streamedRef = useRef('');

  const startGenerate = useCallback(async (opts: GenerateOptions) => {
    if (!projectDir) return;
    optsRef.current = opts;
    setError(null);
    setPhase('planning');
    try {
      const p = await agentPlan(projectDir, opts.skill, opts.scope, opts.message);
      setPlan(p);
      setPhase('confirming');
    } catch (e) {
      setError(String(e));
      setPhase('idle');
    }
  }, [projectDir]);

  const confirmGenerate = useCallback(async () => {
    if (!plan || !projectDir || !optsRef.current) return;
    const opts = optsRef.current;
    setPhase('generating');
    streamedRef.current = '';

    const chatMessages = useAIStore.getState().messages;
    const history = [
      ...chatMessages.filter(m => m.content.length > 0).map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: opts.message },
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

      // Parse and write the generated content
      const rawText = event.payload.full_text;
      const body = opts.parseResponse ? opts.parseResponse(rawText) : extractDraftBody(rawText);

      try {
        await writeFile(opts.outputPath, opts.frontmatter, body);
        useProjectStore.getState().bumpRefresh();
        setPhase('done');
      } catch (e) {
        setError(`Failed to write generated file: ${String(e)}`);
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
  }, [plan, projectDir]);

  const cancelGenerate = useCallback(async () => {
    if (plan) {
      try { await agentCancel(plan.plan_id); } catch { /* best effort */ }
    }
    setPlan(null);
    setPhase('idle');
  }, [plan]);

  const reset = useCallback(() => {
    setPlan(null);
    setError(null);
    setPhase('idle');
    optsRef.current = null;
  }, []);

  return { phase, plan, error, startGenerate, confirmGenerate, cancelGenerate, reset };
}
