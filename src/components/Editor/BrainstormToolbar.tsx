import { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, ChevronDown, Settings2, Loader2, X, Check, AlertCircle } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { useProjectStore } from '../../stores/projectStore';
import { useAIStore } from '../../stores/aiStore';
import { listDirectory, agentPlan, agentExecute, agentCancel, writeFile, updateProjectMetadata } from '../../utils/tauri';
import { trackCost } from '../../utils/projectCost';
import { calculateCost } from '../../utils/modelPricing';
import type { FileEntry } from '../../types/project';
import type { AgentPlan } from '../../types/ai';

interface BrainstormToolbarProps {
  currentFilePath: string;
}

type GeneratePhase = 'idle' | 'planning' | 'confirming' | 'generating' | 'description_approval';

/** Determine the next versioned filename for project_overview. */
function getNextOverviewVersion(files: FileEntry[]): string {
  const existing = files
    .map((f) => f.name)
    .filter((n) => /^project_overview(_v\d+)?\.md$/.test(n));
  if (existing.length === 0) return 'project_overview.md';
  // Find the highest version number
  let maxVersion = 1; // project_overview.md counts as v1
  for (const name of existing) {
    const match = name.match(/^project_overview_v(\d+)\.md$/);
    if (match) {
      maxVersion = Math.max(maxVersion, parseInt(match[1], 10));
    }
  }
  return `project_overview_v${maxVersion + 1}.md`;
}

export function BrainstormToolbar({ currentFilePath }: BrainstormToolbarProps) {
  const projectDir = useProjectStore((s) => s.projectDir);
  const project = useProjectStore((s) => s.project);
  const setProject = useProjectStore((s) => s.setProject);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const setActiveView = useProjectStore((s) => s.setActiveView);
  const setContextExpandFolder = useProjectStore((s) => s.setContextExpandFolder);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Generate flow state
  const [phase, setPhase] = useState<GeneratePhase>('idle');
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestedDescription, setSuggestedDescription] = useState<string>('');
  const [pendingOverviewPath, setPendingOverviewPath] = useState<string | null>(null);
  const streamedRef = useRef<string>('');

  const overviewDir = projectDir ? `${projectDir}\\project_overview` : null;

  const loadFiles = useCallback(async () => {
    if (!overviewDir) return;
    try {
      const entries = await listDirectory(overviewDir);
      setFiles(entries.filter((e) => !e.is_dir && e.name.endsWith('.md')));
    } catch {
      setFiles([]);
    }
  }, [overviewDir]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const currentFileName = currentFilePath.split(/[\\/]/).pop() || '';

  // Detect multiple project_overview versions
  const overviewVersions = files.filter((f) => /^project_overview(_v\d+)?\.md$/.test(f.name));
  const hasMultipleOverviews = overviewVersions.length > 1;

  // ─── Generate Flow ───

  const handleGenerate = async () => {
    if (!projectDir) return;
    setPhase('planning');
    setError(null);
    try {
      // Get current chat messages for context
      const chatMessages = useAIStore.getState().messages;
      const userMessage = chatMessages.length > 0
        ? 'Generate a project overview based on the brainstorm notes and our conversation so far.'
        : 'Generate a project overview based on the brainstorm notes.';

      const p = await agentPlan(projectDir, 'overview_generator', {}, userMessage);
      setPlan(p);
      setPhase('confirming');
    } catch (e) {
      setError(String(e));
      setPhase('idle');
    }
  };

  const handleConfirmGenerate = async () => {
    if (!plan || !projectDir) return;
    setPhase('generating');
    streamedRef.current = '';

    // Build conversation history including chat context
    const chatMessages = useAIStore.getState().messages;
    const history = [
      ...chatMessages.filter(m => m.content.length > 0).map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: 'Generate a project overview based on the brainstorm notes and our conversation so far.' },
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
      await handleGenerationComplete(event.payload.full_text);
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

  const handleGenerationComplete = async (fullText: string) => {
    if (!projectDir || !overviewDir) return;

    // Parse the response for <overview> and <description> tags
    const overviewMatch = fullText.match(/<overview>\s*([\s\S]*?)\s*<\/overview>/);
    const descMatch = fullText.match(/<description>\s*([\s\S]*?)\s*<\/description>/);

    const overviewContent = overviewMatch ? overviewMatch[1].trim() : fullText.trim();
    const description = descMatch ? descMatch[1].trim() : '';

    // Determine versioned filename — never overwrite existing overviews
    const nextVersion = getNextOverviewVersion(files);
    const overviewPath = `${overviewDir}\\${nextVersion}`;
    try {
      await writeFile(overviewPath, { title: 'Project Overview' }, overviewContent);
    } catch (e) {
      setError(`Failed to write overview: ${String(e)}`);
      setPhase('idle');
      return;
    }

    // Reload file list
    await loadFiles();

    // IMPORTANT: Don't call setActiveFile yet — it would change the file path prop
    // and remount this component, losing all local state including the modal.
    // Instead, store the path and open the file AFTER the description modal is dismissed.
    setPendingOverviewPath(overviewPath);

    if (description) {
      setSuggestedDescription(description);
      setPhase('description_approval');
    } else {
      // No description suggestion — open file now
      setActiveFile(overviewPath);
      setPendingOverviewPath(null);
      setPhase('idle');
    }
  };

  const handleApproveDescription = async () => {
    if (!project || !projectDir) return;
    const updated = { ...project, description: suggestedDescription };
    try {
      await updateProjectMetadata(projectDir, updated);
      setProject(updated, projectDir);
    } catch (e) {
      console.error('Failed to update description:', e);
    }
    setSuggestedDescription('');
    setPhase('idle');
    // Now open the generated file
    if (pendingOverviewPath) {
      setActiveFile(pendingOverviewPath);
      setPendingOverviewPath(null);
    }
  };

  const handleDenyDescription = () => {
    setSuggestedDescription('');
    setPhase('idle');
    // Now open the generated file
    if (pendingOverviewPath) {
      setActiveFile(pendingOverviewPath);
      setPendingOverviewPath(null);
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
    if (overviewDir) setContextExpandFolder(overviewDir);
  };

  const isGenerating = phase === 'planning' || phase === 'generating';

  return (
    <>
      <div
        className="flex items-center gap-2 shrink-0"
        style={{
          padding: '6px 16px',
          borderBottom: '1px solid var(--border-secondary)',
          backgroundColor: 'var(--bg-elevated)',
        }}
      >
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors"
          style={{
            backgroundColor: isGenerating ? 'var(--bg-tertiary)' : 'var(--accent)',
            color: isGenerating ? 'var(--text-tertiary)' : 'var(--text-inverse)',
            padding: '5px 12px',
            border: 'none',
            opacity: isGenerating ? 0.7 : 1,
          }}
        >
          {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {phase === 'planning' ? 'Planning...' : phase === 'generating' ? 'Generating...' : 'Generate'}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              padding: '5px 12px',
              border: '1px solid var(--border-primary)',
            }}
          >
            {currentFileName}
            <ChevronDown size={12} />
          </button>

          {showDropdown && (
            <div
              className="absolute left-0 rounded-lg"
              style={{
                top: '100%',
                marginTop: '4px',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-primary)',
                boxShadow: 'var(--shadow-md)',
                minWidth: '240px',
                zIndex: 100,
                overflow: 'hidden',
              }}
            >
              {files.map((file) => {
                const isActive = currentFilePath.endsWith(file.name);
                return (
                  <button
                    key={file.path}
                    onClick={() => {
                      setActiveFile(file.path);
                      setShowDropdown(false);
                    }}
                    className="flex items-center w-full text-left text-xs transition-colors"
                    style={{
                      padding: '8px 12px',
                      color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                      backgroundColor: isActive ? 'var(--accent-subtle)' : 'transparent',
                      border: 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {file.name}
                  </button>
                );
              })}
              {files.length === 0 && (
                <div className="text-xs" style={{ padding: '8px 12px', color: 'var(--text-tertiary)' }}>
                  No files yet
                </div>
              )}
            </div>
          )}
        </div>

        {hasMultipleOverviews && (
          <div
            className="flex items-center"
            title={`${overviewVersions.length} versions of project_overview.md exist. Consider deleting old versions or excluding them in Context Settings.`}
            style={{ color: 'var(--color-warning)', cursor: 'help' }}
          >
            <AlertCircle size={15} />
          </div>
        )}

        <button
          onClick={handleContextSettings}
          className="flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            padding: '5px 12px',
            border: '1px solid var(--border-primary)',
          }}
        >
          <Settings2 size={13} />
          Context Settings
        </button>

        {error && (
          <span className="text-xs" style={{ color: 'var(--color-error)', marginLeft: '8px' }}>
            {error}
            <button
              onClick={() => setError(null)}
              style={{ background: 'none', border: 'none', color: 'var(--color-error)', marginLeft: '4px' }}
            >
              <X size={10} />
            </button>
          </span>
        )}
      </div>

      {/* Plan Confirmation Modal */}
      {phase === 'confirming' && plan && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
          onClick={handleCancelGenerate}
        >
          <div
            className="rounded-xl"
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              boxShadow: 'var(--shadow-lg)',
              padding: '24px',
              maxWidth: '440px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)', marginBottom: '12px' }}>
              Generate Project Overview
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
              This will read your brainstorm notes and chat history, then generate a structured project overview and a suggested short description.
            </p>

            <div className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: '8px' }}>
              <div className="flex justify-between" style={{ marginBottom: '4px' }}>
                <span>Skill</span>
                <span style={{ color: 'var(--text-secondary)' }}>Overview Generator</span>
              </div>
              <div className="flex justify-between" style={{ marginBottom: '4px' }}>
                <span>Context files</span>
                <span style={{ color: 'var(--text-secondary)' }}>{plan.context_files.length}</span>
              </div>
              <div className="flex justify-between" style={{ marginBottom: '4px' }}>
                <span>Est. tokens</span>
                <span style={{ color: 'var(--text-secondary)' }}>{plan.total_tokens_est.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Est. cost</span>
                <span style={{ color: 'var(--accent)' }}>{plan.estimated_cost}</span>
              </div>
            </div>

            {plan.context_files.length > 0 && (
              <div style={{ marginBottom: '16px', marginTop: '12px' }}>
                <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                  Context files:
                </div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {plan.context_files.map((f) => (
                    <div key={f.path} style={{ marginBottom: '2px' }}>• {f.path}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end" style={{ marginTop: '20px' }}>
              <button
                onClick={handleCancelGenerate}
                className="rounded-lg text-xs font-medium"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-primary)',
                  padding: '8px 16px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmGenerate}
                className="rounded-lg text-xs font-medium"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--text-inverse)',
                  border: 'none',
                  padding: '8px 16px',
                }}
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Description Approval Modal */}
      {phase === 'description_approval' && suggestedDescription && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
          onClick={handleDenyDescription}
        >
          <div
            className="rounded-xl"
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              boxShadow: 'var(--shadow-lg)',
              padding: '24px',
              maxWidth: '480px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)', marginBottom: '6px' }}>
              Update Project Description?
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: '16px' }}>
              The AI generated a suggested short description for your project:
            </p>

            <div
              className="rounded-lg text-sm"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-primary)',
                padding: '12px 16px',
                color: 'var(--text-primary)',
                lineHeight: '1.5',
                marginBottom: '12px',
              }}
            >
              {suggestedDescription}
            </div>

            {project?.description && (
              <div className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: '16px' }}>
                <span>Current: </span>
                <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  {project.description || '(none)'}
                </span>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={handleDenyDescription}
                className="flex items-center gap-1.5 rounded-lg text-xs font-medium"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-primary)',
                  padding: '8px 16px',
                }}
              >
                <X size={12} />
                Keep Current
              </button>
              <button
                onClick={handleApproveDescription}
                className="flex items-center gap-1.5 rounded-lg text-xs font-medium"
                style={{
                  backgroundColor: 'var(--color-success)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                }}
              >
                <Check size={12} />
                Update Description
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
