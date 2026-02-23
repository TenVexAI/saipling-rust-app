import { useRef, useEffect, useCallback, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { MessageSquare, Trash2, StopCircle } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { SkillSelector } from './SkillSelector';
import { ContextSummary } from './ContextSummary';
import { AgentPlanCard } from './AgentPlanCard';
import { SaiplingChatLogo } from './SaiplingChatLogo';
import { useAIStore } from '../../stores/aiStore';
import { useProjectStore } from '../../stores/projectStore';
import { agentPlan, agentExecute, agentCancel, listAvailableSkills, getConfig } from '../../utils/tauri';
import { trackCost } from '../../utils/projectCost';
import { saveCurrentChat } from '../../utils/projectChat';
import { calculateCost } from '../../utils/modelPricing';
import type { ContextFileInfo } from '../../types/ai';

interface ChatPanelProps {
  width?: number;
}

export function ChatPanel({ width }: ChatPanelProps) {
  const messages = useAIStore((s) => s.messages);
  const isStreaming = useAIStore((s) => s.isStreaming);
  const currentPlan = useAIStore((s) => s.currentPlan);
  const addMessage = useAIStore((s) => s.addMessage);
  const appendToLastAssistant = useAIStore((s) => s.appendToLastAssistant);
  const clearMessages = useAIStore((s) => s.clearMessages);
  const setStreaming = useAIStore((s) => s.setStreaming);
  const setCurrentPlan = useAIStore((s) => s.setCurrentPlan);
  const setConversationId = useAIStore((s) => s.setConversationId);
  const setLastCost = useAIStore((s) => s.setLastCost);
  const addSessionCost = useAIStore((s) => s.addSessionCost);
  const setAvailableSkills = useAIStore((s) => s.setAvailableSkills);
  const conversationId = useAIStore((s) => s.conversationId);
  const sessionCost = useAIStore((s) => s.sessionCost);
  const activeSkill = useAIStore((s) => s.activeSkill);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [contextFiles, setContextFiles] = useState<ContextFileInfo[]>([]);
  const [contextTokens, setContextTokens] = useState(0);
  const [modelFamily, setModelFamily] = useState('Sonnet');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Load preferred model family and available skills on mount
  useEffect(() => {
    getConfig().then((c) => {
      const id = c.default_model || '';
      if (id.includes('opus')) setModelFamily('Opus');
      else if (id.includes('haiku')) setModelFamily('Haiku');
      else setModelFamily('Sonnet');
    }).catch(() => {});
  }, []);

  useEffect(() => {
    listAvailableSkills()
      .then((skills) => setAvailableSkills(skills))
      .catch(() => {});
  }, [setAvailableSkills]);

  const executeWithStreaming = useCallback(async (planId: string, history: { role: 'user' | 'assistant'; content: string }[]) => {
    setStreaming(true);
    setConversationId(planId);

    const unlistenChunk = await listen<{ text: string }>(`claude:chunk:${planId}`, (event) => {
      appendToLastAssistant(event.payload.text);
    });
    const unlistenDone = await listen<{ full_text: string; input_tokens: number; output_tokens: number; model: string }>(`claude:done:${planId}`, (event) => {
      const cost = calculateCost(event.payload.model, event.payload.input_tokens, event.payload.output_tokens);
      setLastCost(`$${cost.toFixed(4)}`);
      addSessionCost(cost);
      trackCost(cost);
      setStreaming(false);
      saveCurrentChat();
      unlistenChunk();
      unlistenDone();
      unlistenError();
    });
    const unlistenError = await listen<{ error: string }>(`claude:error:${planId}`, (event) => {
      appendToLastAssistant(`\n\n⚠️ Error: ${event.payload.error}`);
      setStreaming(false);
      unlistenChunk();
      unlistenDone();
      unlistenError();
    });

    try {
      await agentExecute(planId, history.map(m => ({ role: m.role, content: m.content })));
    } catch (e) {
      const errMsg = String(e);
      if (errMsg.includes('API key not set') || errMsg.includes('ApiKeyNotSet')) {
        appendToLastAssistant('Please set your Claude API key in Settings first.');
      } else {
        appendToLastAssistant(`Error: ${errMsg}`);
      }
      setStreaming(false);
      unlistenChunk();
      unlistenDone();
      unlistenError();
    }
  }, [setStreaming, setConversationId, appendToLastAssistant, setLastCost, addSessionCost]);

  const handleSend = useCallback(async (text: string) => {
    const userMsg = { role: 'user' as const, content: text };
    addMessage(userMsg);
    addMessage({ role: 'assistant', content: '' });

    const projectDir = useProjectStore.getState().projectDir;
    const bookId = useProjectStore.getState().activeBookId;

    if (!projectDir) {
      appendToLastAssistant('Please open a project first.');
      return;
    }

    try {
      const plan = await agentPlan(
        projectDir,
        activeSkill || '',
        { book: bookId || undefined },
        text,
      );

      // Update context display
      setContextFiles(plan.context_files);
      setContextTokens(plan.total_tokens_est);

      const allMessages = useAIStore.getState().messages;
      const history = allMessages
        .filter(m => m.content.length > 0)
        .map(m => ({ role: m.role, content: m.content }));

      await executeWithStreaming(plan.plan_id, history);
    } catch (e) {
      appendToLastAssistant(`Error: ${String(e)}`);
    }
  }, [addMessage, appendToLastAssistant, activeSkill, executeWithStreaming]);

  const handleCancel = useCallback(async () => {
    if (conversationId) {
      try {
        await agentCancel(conversationId);
      } catch {
        // best-effort
      }
    }
  }, [conversationId]);

  const handleApprovePlan = async () => {
    if (!currentPlan) return;
    setCurrentPlan(null);
    addMessage({ role: 'assistant', content: '' });

    const allMessages = useAIStore.getState().messages;
    const history = allMessages
      .filter(m => m.content.length > 0)
      .map(m => ({ role: m.role, content: m.content }));

    await executeWithStreaming(currentPlan.plan_id, history);
  };

  const handleCancelPlan = () => {
    setCurrentPlan(null);
  };

  return (
    <div
      className="flex flex-col h-full shrink-0 overflow-hidden"
      style={{
        width: width ? `${width}px` : 'var(--right-panel-width)',
        backgroundColor: 'var(--bg-secondary)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{ borderBottom: '1px solid var(--border-primary)', padding: '10px 16px' }}
      >
        <div className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          <MessageSquare size={14} />
          AI Chat
          {sessionCost > 0 && (
            <span className="font-normal" style={{ color: 'var(--text-tertiary)' }}>
              ({modelFamily}: ${sessionCost.toFixed(4)})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isStreaming && (
            <button
              onClick={handleCancel}
              className="p-1 rounded hover-icon-danger"
              style={{ color: 'var(--color-error)' }}
              title="Stop generation"
            >
              <StopCircle size={14} />
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={() => { clearMessages(); saveCurrentChat(); }}
              className="p-1 rounded hover-icon"
              style={{ color: 'var(--text-tertiary)' }}
              title="Clear conversation"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Skill Selector */}
      <div className="shrink-0" style={{ borderBottom: '1px solid var(--border-secondary)', padding: '8px 16px' }}>
        <SkillSelector />
      </div>

      {/* Context Summary */}
      <ContextSummary files={contextFiles} totalTokens={contextTokens} />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center" style={{ padding: '0 24px' }}>
            <SaiplingChatLogo size={100} className="mb-3" />
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              Ask Claude for help with your story. The AI will use the right skills based on what you're working on.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}

        {currentPlan && (
          <AgentPlanCard
            plan={currentPlan}
            onApprove={handleApprovePlan}
            onCancel={handleCancelPlan}
          />
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={isStreaming}
        placeholder={isStreaming ? 'Claude is thinking...' : 'Ask Claude...'}
      />
    </div>
  );
}
