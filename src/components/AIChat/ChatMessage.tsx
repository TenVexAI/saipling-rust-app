import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User } from 'lucide-react';
import type { Message } from '../../types/ai';
import { ApplyCard } from './ApplyCard';
import { parseApplyBlocks, getMessageText, hasApplyBlocks } from '../../utils/applyParser';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  const textContent = hasApplyBlocks(message.content)
    ? getMessageText(message.content)
    : message.content;

  const applyBlocks = hasApplyBlocks(message.content)
    ? parseApplyBlocks(message.content).blocks
    : [];

  return (
    <div
      className="flex gap-3 py-3"
      style={{
        backgroundColor: isUser ? 'transparent' : 'var(--bg-secondary)',
        padding: '8px 12px',
      }}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{
          backgroundColor: isUser ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
          color: isUser ? 'var(--accent)' : 'var(--color-info)',
        }}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      <div className="flex-1 min-w-0 text-sm" style={{ color: isUser ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
        {textContent && (
          <div className="prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {textContent}
            </ReactMarkdown>
          </div>
        )}

        {applyBlocks.map((block, i) => (
          <ApplyCard key={i} block={block} />
        ))}
      </div>
    </div>
  );
}
