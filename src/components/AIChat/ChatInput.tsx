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
      style={{ borderTop: '1px solid var(--border-primary)', padding: '10px 10px' }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Ask Claude...'}
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none rounded-lg text-sm"
        style={{
          backgroundColor: 'var(--bg-input)',
          border: '1px solid var(--border-primary)',
          color: 'var(--text-primary)',
          maxHeight: '250px',
          lineHeight: '1.5',
          padding: '6px 6px',
        }}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        className="shrink-0 flex items-center justify-center transition-colors"
        style={{
          background: 'none',
          border: 'none',
          color: text.trim() && !disabled ? 'var(--accent)' : 'var(--text-tertiary)',
          cursor: text.trim() && !disabled ? 'pointer' : 'default',
          padding: '0 2px',
          marginBottom: '2px',
          alignSelf: 'flex-end',
        }}
      >
        <Send size={18} />
      </button>
    </div>
  );
}
