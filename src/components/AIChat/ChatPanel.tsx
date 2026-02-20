import { useRef, useEffect } from 'react';
import { MessageSquare, Trash2 } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { SkillSelector } from './SkillSelector';
import { ContextSummary } from './ContextSummary';
import { AgentPlanCard } from './AgentPlanCard';
import { useAIStore } from '../../stores/aiStore';

interface ChatPanelProps {
  width?: number;
}

export function ChatPanel({ width }: ChatPanelProps) {
  const messages = useAIStore((s) => s.messages);
  const isStreaming = useAIStore((s) => s.isStreaming);
  const currentPlan = useAIStore((s) => s.currentPlan);
  const addMessage = useAIStore((s) => s.addMessage);
  const clearMessages = useAIStore((s) => s.clearMessages);
  const setCurrentPlan = useAIStore((s) => s.setCurrentPlan);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (text: string) => {
    addMessage({ role: 'user', content: text });
    // TODO: Wire to agent_plan or agent_quick based on approval mode
    // For now, show a placeholder response
    setTimeout(() => {
      addMessage({
        role: 'assistant',
        content: 'AI responses will work once an API key is configured and the agent system is connected. Try Settings → API Key first.',
      });
    }, 500);
  };

  const handleApprovePlan = () => {
    // TODO: Call agent_execute with the plan
    setCurrentPlan(null);
  };

  const handleCancelPlan = () => {
    setCurrentPlan(null);
  };

  return (
    <div
      className="flex flex-col h-full shrink-0"
      style={{
        width: width ? `${width}px` : 'var(--right-panel-width)',
        backgroundColor: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-primary)',
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
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="p-1 rounded"
            style={{ color: 'var(--text-tertiary)' }}
            title="Clear conversation"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Skill Selector */}
      <div className="shrink-0" style={{ borderBottom: '1px solid var(--border-secondary)', padding: '8px 16px' }}>
        <SkillSelector />
      </div>

      {/* Context Summary */}
      <ContextSummary files={[]} totalTokens={0} />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <MessageSquare size={32} style={{ color: 'var(--text-tertiary)' }} className="mb-3 opacity-30" />
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
