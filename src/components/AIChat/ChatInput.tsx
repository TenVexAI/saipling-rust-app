import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [text]);

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="flex items-end gap-2 shrink-0"
      style={{ borderTop: '1px solid var(--border-primary)', padding: '12px 16px' }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Type a message...'}
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none px-3 py-2 rounded-lg text-sm"
        style={{
          backgroundColor: 'var(--bg-input)',
          border: '1px solid var(--border-primary)',
          color: 'var(--text-primary)',
          maxHeight: '150px',
          lineHeight: '1.5',
        }}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        className="p-2 rounded-lg shrink-0"
        style={{
          backgroundColor: text.trim() && !disabled ? 'var(--accent)' : 'var(--bg-tertiary)',
          color: text.trim() && !disabled ? 'var(--text-inverse)' : 'var(--text-tertiary)',
          cursor: text.trim() && !disabled ? 'pointer' : 'not-allowed',
        }}
      >
        <Send size={16} />
      </button>
    </div>
  );
}
