import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import { X, Save, Scan } from 'lucide-react';
import { EditorToolbar } from './EditorToolbar';
import { FrontmatterPanel } from './FrontmatterPanel';
import { InlineAIToolbar } from './InlineAIToolbar';
import { BrainstormToolbar } from './BrainstormToolbar';
import { useEditorStore } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import { readFile, writeFile } from '../../utils/tauri';
import { markdownToHtml, htmlToMarkdown } from '../../utils/markdown';

interface ProseEditorProps {
  filePath: string;
}

export function ProseEditor({ filePath }: ProseEditorProps) {
  const [frontmatter, setFrontmatter] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const markSaving = useEditorStore((s) => s.markSaving);
  const markSaved = useEditorStore((s) => s.markSaved);
  const setBody = useEditorStore((s) => s.setBody);
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const focusMode = useEditorStore((s) => s.focusMode);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const initialContentRef = useRef<string>('');
  const frontmatterRef = useRef<Record<string, unknown>>({});
  const filePathRef = useRef(filePath);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isBrainstormFile = /[\\/]overview[\\/]/.test(filePath);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      CharacterCount,
      Highlight.configure({ multicolor: false }),
      Typography,
    ],
    editorProps: {
      attributes: {
        class: 'prose-editor-content',
        style: [
          'outline: none',
          'font-family: var(--font-editor)',
          'font-size: 16px',
          'line-height: 1.8',
          'color: var(--text-primary)',
          'min-height: 100%',
          'padding: 24px 40px',
          'max-width: 720px',
          'margin: 0 auto',
        ].join('; '),
      },
      handleClick(view, pos, event) {
        if (event.ctrlKey && !event.shiftKey) {
          const $pos = view.state.doc.resolve(pos);
          const text = $pos.parent.textContent;
          const offset = $pos.parentOffset;
          let start = offset;
          let end = offset;
          while (start > 0 && /\w/.test(text[start - 1])) start--;
          while (end < text.length && /\w/.test(text[end])) end++;
          if (start !== end) {
            const base = pos - offset;
            const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, base + start, base + end));
            view.dispatch(tr);
            return true;
          }
        }
        return false;
      },
      handleDOMEvents: {
        mousedown(view, event) {
          if (event.ctrlKey && event.shiftKey) {
            const coords = { left: event.clientX, top: event.clientY };
            const clickPos = view.posAtCoords(coords);
            if (!clickPos) return false;
            const pos = clickPos.pos;
            const $pos = view.state.doc.resolve(pos);
            const from = $pos.start($pos.depth);
            const to = $pos.end($pos.depth);
            const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to));
            view.dispatch(tr);
            event.preventDefault();
            return true;
          }
          if (event.shiftKey && !event.ctrlKey) {
            const coords = { left: event.clientX, top: event.clientY };
            const clickPos = view.posAtCoords(coords);
            if (!clickPos) return false;

            const anchor = view.state.selection.anchor;
            const head = clickPos.pos;

            const wordAt = (p: number) => {
              const $p = view.state.doc.resolve(p);
              const t = $p.parent.textContent;
              const o = $p.parentOffset;
              let s = o, e = o;
              while (s > 0 && /\w/.test(t[s - 1])) s--;
              while (e < t.length && /\w/.test(t[e])) e++;
              const base = p - o;
              return { from: base + s, to: base + e };
            };

            const anchorWord = wordAt(anchor);
            const headWord = wordAt(head);
            const from = head >= anchor ? anchorWord.from : headWord.from;
            const to = head >= anchor ? headWord.to : anchorWord.to;

            const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to));
            view.dispatch(tr);
            event.preventDefault();
            return true;
          }
          return false;
        },
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      const md = htmlToMarkdown(html);
      setBody(md);
    },
  });

  // Load file content
  const loadFile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const content = await readFile(filePath);
      setFrontmatter(content.frontmatter || {});
      frontmatterRef.current = content.frontmatter || {};
      const html = markdownToHtml(content.body);
      initialContentRef.current = content.body;
      if (editor) {
        editor.commands.setContent(html);
        markSaved();
      }
    } catch (readErr) {
      // Only create empty file if it truly doesn't exist (error message heuristic)
      const errMsg = String(readErr).toLowerCase();
      if (errMsg.includes('not found') || errMsg.includes('no such file') || errMsg.includes('does not exist') || errMsg.includes('(os error 2)') || errMsg.includes('(os error 3)')) {
        try {
          await writeFile(filePath, {}, '');
          setFrontmatter({});
          frontmatterRef.current = {};
          initialContentRef.current = '';
          if (editor) {
            editor.commands.setContent('');
            markSaved();
          }
        } catch (writeErr) {
          setError(String(writeErr));
        }
      } else {
        setError(`Failed to read file: ${String(readErr)}`);
      }
    }
    setLoading(false);
  }, [filePath, editor, markSaved]);

  useEffect(() => {
    filePathRef.current = filePath;
    if (editor) {
      loadFile();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, editor]);

  // Save function — guarded against writing empty content over a non-empty file
  const saveFile = useCallback(async () => {
    if (!editor || editor.isDestroyed) return;
    const html = editor.getHTML();
    const markdown = htmlToMarkdown(html);

    // Never overwrite a file that had content with empty/trivial content
    const hadContent = initialContentRef.current.trim().length > 0;
    const newIsEmpty = markdown.trim().length === 0;
    if (hadContent && newIsEmpty) {
      console.warn('Save aborted: would overwrite non-empty file with empty content');
      return;
    }

    markSaving();
    try {
      await writeFile(filePathRef.current, frontmatterRef.current, markdown);
      markSaved();
      useProjectStore.getState().bumpRefresh();
    } catch (e) {
      console.error('Save failed:', e);
      markSaved();
    }
  }, [editor, markSaving, markSaved]);

  // Auto-save every 30 seconds
  useEffect(() => {
    autoSaveTimerRef.current = setInterval(() => {
      const isDirty = useEditorStore.getState().isDirty;
      if (isDirty && editor) {
        saveFile();
      }
    }, 30000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [editor, saveFile]);

  // Ctrl+S save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveFile]);

  // Word count from CharacterCount extension
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wordCount = editor ? (editor.storage as any).characterCount?.words?.() ?? 0 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-tertiary)', padding: '24px' }}>
        <p className="text-sm" style={{ color: 'var(--color-error)', marginBottom: '8px' }}>Failed to load file</p>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  const fileName = filePath.split(/[\\/]/).pop() || filePath;
  const dirParts = filePath.split(/[\\/]/);
  const breadcrumb = dirParts.length > 2
    ? dirParts.slice(-3, -1).join(' > ')
    : dirParts.slice(0, -1).join(' > ');

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* File header — hidden in focus mode */}
      {!focusMode && (
        <div
          className="flex items-center justify-between shrink-0"
          style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-secondary)', backgroundColor: 'var(--bg-elevated)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{breadcrumb}</span>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>/</span>
            <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{fileName}</span>
            {isDirty && <span className="text-xs" style={{ color: 'var(--accent)' }}>(unsaved)</span>}
            {isSaving && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>saving...</span>}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={saveFile}
              disabled={!isDirty}
              title="Save (Ctrl+S)"
              className="flex items-center justify-center hover-icon"
              style={{ width: '26px', height: '26px', borderRadius: '4px', background: 'none', border: 'none', cursor: isDirty ? 'pointer' : 'default', color: isDirty ? 'var(--accent)' : 'var(--text-tertiary)', opacity: isDirty ? 1 : 0.4 }}
            >
              <Save size={14} />
            </button>
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', ctrlKey: true, shiftKey: true, bubbles: true }))}
              title="Focus Mode (Ctrl+Shift+F)"
              className="flex items-center justify-center hover-icon"
              style={{ width: '26px', height: '26px', borderRadius: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
            >
              <Scan size={14} />
            </button>
            <button
              onClick={() => setActiveFile(null)}
              title="Close file"
              className="flex items-center justify-center hover-icon"
              style={{ width: '26px', height: '26px', borderRadius: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {!focusMode && isBrainstormFile && <BrainstormToolbar currentFilePath={filePath} />}
      {!focusMode && <FrontmatterPanel frontmatter={frontmatter} />}
      {!focusMode && <EditorToolbar editor={editor} />}

      <div className="flex-1 overflow-y-auto relative">
        <EditorContent editor={editor} style={{ height: '100%' }} />
        {!focusMode && <InlineAIToolbar editor={editor} />}
      </div>

      {/* Status bar — minimal in focus mode */}
      <div
        className="flex items-center justify-between shrink-0 text-xs"
        style={{
          padding: focusMode ? '6px 24px' : '4px 16px',
          borderTop: focusMode ? 'none' : '1px solid var(--border-secondary)',
          color: 'var(--text-tertiary)',
          opacity: focusMode ? 0.4 : 1,
        }}
      >
        <span>{wordCount.toLocaleString()} words</span>
        {focusMode
          ? <span>Ctrl+Shift+F to exit focus mode · Win+Down to un-maximize</span>
          : <span style={!isDirty ? { color: 'var(--accent)' } : undefined}>{isDirty ? 'Unsaved changes' : 'Saved'}</span>
        }
      </div>
    </div>
  );
}
