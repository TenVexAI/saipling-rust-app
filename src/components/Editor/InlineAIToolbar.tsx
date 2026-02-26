import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Wand2, RefreshCw, Scissors, Expand, ArrowUpRight } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';
import { agentQuick } from '../../utils/tauri';
import { trackCost } from '../../utils/projectCost';
import { useProjectStore } from '../../stores/projectStore';
import type { Editor } from '@tiptap/react';

interface InlineAIToolbarProps {
  editor: Editor | null;
}

const ACTIONS = [
  { id: 'rewrite', label: 'Rewrite', icon: RefreshCw, prompt: 'Rewrite this passage to improve clarity and flow while keeping the same meaning and tone:' },
  { id: 'shorten', label: 'Shorten', icon: Scissors, prompt: 'Make this passage more concise while preserving its meaning:' },
  { id: 'expand', label: 'Expand', icon: Expand, prompt: 'Expand this passage with more vivid detail and sensory description:' },
  { id: 'improve', label: 'Improve', icon: Wand2, prompt: 'Improve the prose quality of this passage — better word choices, rhythm, and imagery:' },
  { id: 'continue', label: 'Continue', icon: ArrowUpRight, prompt: 'Continue writing from where this passage ends, maintaining the same style and voice:' },
];

export function InlineAIToolbar({ editor }: InlineAIToolbarProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, containerWidth: 0 });
  const [loading, setLoading] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const addMessage = useAIStore((s) => s.addMessage);

  const updatePosition = useCallback(() => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    if (from === to) {
      setVisible(false);
      return;
    }

    // Get the selected text
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    if (selectedText.trim().length < 3) {
      setVisible(false);
      return;
    }

    // Get the position of the selection end in the DOM
    const coords = editor.view.coordsAtPos(to);
    const editorRect = editor.view.dom.closest('.flex-1.overflow-y-auto')?.getBoundingClientRect();

    if (!editorRect) {
      setVisible(false);
      return;
    }

    setPosition({
      top: coords.bottom - editorRect.top + 8,
      left: coords.left - editorRect.left,
      containerWidth: editorRect.width,
    });
    setVisible(true);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    editor.on('selectionUpdate', updatePosition);
    editor.on('blur', () => {
      // Small delay to allow toolbar button clicks
      setTimeout(() => {
        if (!toolbarRef.current?.contains(document.activeElement)) {
          setVisible(false);
        }
      }, 200);
    });

    return () => {
      editor.off('selectionUpdate', updatePosition);
    };
  }, [editor, updatePosition]);

  const handleAction = async (actionId: string) => {
    if (!editor || loading) return;

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    if (!selectedText.trim()) return;

    const action = ACTIONS.find(a => a.id === actionId);
    if (!action) return;

    const projectDir = useProjectStore.getState().projectDir;
    if (!projectDir) return;

    setLoading(true);

    try {
      const result = await agentQuick(
        projectDir,
        'prose_writer',
        { book: useProjectStore.getState().activeBookId || undefined },
        selectedText,
        actionId,
        `${action.prompt}\n\n---\n${selectedText}\n---`,
      );

      // Track cost from the quick result
      if (result.cost > 0) {
        useAIStore.getState().addSessionCost(result.cost);
        trackCost(result.cost);
      }

      if (result.text) {
        // Clean the result — remove any surrounding quotes or markdown fencing
        let cleaned = result.text.trim();
        if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
          cleaned = cleaned.slice(3, -3).trim();
        }
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
          cleaned = cleaned.slice(1, -1);
        }

        // Show result in AI chat for review rather than auto-replacing
        addMessage({ role: 'assistant', content: `**${action.label}** suggestion:\n\n${cleaned}` });
      }
    } catch (e) {
      addMessage({ role: 'assistant', content: `Error: ${String(e)}` });
    }

    setLoading(false);
    setVisible(false);
  };

  // Clamp toolbar position after render so it doesn't overflow the container
  useLayoutEffect(() => {
    if (!visible || !toolbarRef.current) return;
    const toolbarWidth = toolbarRef.current.offsetWidth;
    const maxLeft = position.containerWidth - toolbarWidth - 8;
    if (position.left > maxLeft && maxLeft > 0) {
      setPosition((prev) => ({ ...prev, left: maxLeft }));
    }
  }, [visible, position.left, position.containerWidth]);

  if (!visible || !editor) return null;

  return (
    <div
      ref={toolbarRef}
      className="absolute flex items-center gap-0.5 rounded-lg shadow-lg"
      style={{
        top: `${position.top}px`,
        left: `${Math.max(0, position.left)}px`,
        zIndex: 50,
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-primary)',
        padding: '4px',
        opacity: loading ? 0.6 : 1,
        pointerEvents: loading ? 'none' : 'auto',
      }}
    >
      {ACTIONS.map(action => (
        <button
          key={action.id}
          onClick={() => handleAction(action.id)}
          className="flex items-center gap-1 rounded text-xs transition-colors"
          style={{
            padding: '4px 8px',
            color: 'var(--text-secondary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
          title={action.label}
        >
          <action.icon size={12} />
          {action.label}
        </button>
      ))}
    </div>
  );
}
