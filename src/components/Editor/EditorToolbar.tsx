import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code, Minus, Undo2, Redo2, Highlighter,
} from 'lucide-react';
import type { Editor } from '@tiptap/react';

interface EditorToolbarProps {
  editor: Editor | null;
}


interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, isActive, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center justify-center transition-colors"
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '4px',
        background: 'none',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        color: isActive ? 'var(--accent)' : disabled ? 'var(--text-tertiary)' : 'var(--text-secondary)',
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-secondary)', margin: '0 4px' }} />
  );
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = editor as any;

  return (
    <div
      className="flex items-center shrink-0 flex-wrap"
      style={{
        padding: '6px 12px',
        borderBottom: '1px solid var(--border-secondary)',
        gap: '2px',
      }}
    >
      <ToolbarButton
        onClick={() => e.chain().focus().toggleBold().run()}
        isActive={e.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <Bold size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => e.chain().focus().toggleItalic().run()}
        isActive={e.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <Italic size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => e.chain().focus().toggleStrike().run()}
        isActive={e.isActive('strike')}
        title="Strikethrough"
      >
        <Strikethrough size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => e.chain().focus().toggleHighlight().run()}
        isActive={e.isActive('highlight')}
        title="Highlight"
      >
        <Highlighter size={14} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => e.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={e.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <Heading1 size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => e.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={e.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <Heading2 size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => e.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={e.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        <Heading3 size={14} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => e.chain().focus().toggleBulletList().run()}
        isActive={e.isActive('bulletList')}
        title="Bullet List"
      >
        <List size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => e.chain().focus().toggleOrderedList().run()}
        isActive={e.isActive('orderedList')}
        title="Ordered List"
      >
        <ListOrdered size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => e.chain().focus().toggleBlockquote().run()}
        isActive={e.isActive('blockquote')}
        title="Blockquote"
      >
        <Quote size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => e.chain().focus().toggleCodeBlock().run()}
        isActive={e.isActive('codeBlock')}
        title="Code Block"
      >
        <Code size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => e.chain().focus().setHorizontalRule().run()}
        title="Horizontal Rule"
      >
        <Minus size={14} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => e.chain().focus().undo().run()}
        disabled={!e.can().undo()}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => e.chain().focus().redo().run()}
        disabled={!e.can().redo()}
        title="Redo (Ctrl+Y)"
      >
        <Redo2 size={14} />
      </ToolbarButton>
    </div>
  );
}
