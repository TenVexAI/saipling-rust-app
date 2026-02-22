import { useState, useCallback, useEffect, useRef } from 'react';
import { TitleBar } from './TitleBar';
import { Sidebar } from '../Sidebar/Sidebar';
import { Footer } from '../Footer/Footer';
import { PhaseProgressBar } from '../ProgressBar/PhaseProgressBar';
import { ChatPanel } from '../AIChat/ChatPanel';
import { ResizeDivider } from './ResizeDivider';
import { Dashboard } from '../Dashboard/Dashboard';
import { SettingsView } from '../Settings/SettingsView';
import { SkillSettings } from '../Settings/SkillSettings';
import { ContextSettings } from '../ContextSettings/ContextSettings';
import { BookView } from '../BookView/BookView';
import { WorldBrowser } from '../WorldView/WorldBrowser';
import { CharacterList } from '../CharacterView/CharacterList';
import { NotesBrowser } from '../NotesView/NotesBrowser';
import { PhaseWorkflow } from '../PhaseWorkflow/PhaseWorkflow';
import { ProseEditor } from '../Editor/ProseEditor';
import { useProjectStore } from '../../stores/projectStore';
import { useEditorStore } from '../../stores/editorStore';
import { getModelsConfig, getConfig } from '../../utils/tauri';
import { listen } from '@tauri-apps/api/event';
import { useThemeStore } from '../../stores/themeStore';
import { setModelsConfig } from '../../utils/modelPricing';

function MainContent() {
  const activeView = useProjectStore((s) => s.activeView);
  const activeFilePath = useProjectStore((s) => s.activeFilePath);
  const focusMode = useEditorStore((s) => s.focusMode);

  // If a file is selected and it's a markdown file, show the editor
  if (activeFilePath && activeFilePath.endsWith('.md')) {
    return <ProseEditor filePath={activeFilePath} />;
  }

  if (focusMode) {
    return (
      <div className="flex-1 h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
          <p className="text-sm">Open a file to write in focus mode (Ctrl+Shift+F to exit)</p>
        </div>
      </div>
    );
  }

  switch (activeView) {
    case 'dashboard':
      return <Dashboard />;
    case 'settings':
      return <SettingsView />;
    case 'skill_settings':
      return <SkillSettings />;
    case 'files':
      return <ContextSettings />;
    case 'book':
      return <BookView />;
    case 'world':
      return <WorldBrowser />;
    case 'characters':
      return <CharacterList />;
    case 'notes':
      return <NotesBrowser />;
    case 'phase':
      return <PhaseWorkflow />;
    default:
      return <Dashboard />;
  }
}

export function AppShell() {
  const focusMode = useEditorStore((s) => s.focusMode);
  const toggleFocusMode = useEditorStore((s) => s.toggleFocusMode);
  const activeBookId = useProjectStore((s) => s.activeBookId);
  const rightPanelOpen = useProjectStore((s) => s.rightPanelOpen);
  const activeView = useProjectStore((s) => s.activeView);
  const showChat = activeView !== 'settings' && activeView !== 'skill_settings' && rightPanelOpen;
  const [chatWidth, setChatWidth] = useState(340);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleResize = useCallback((delta: number) => {
    setChatWidth((prev) => {
      const containerWidth = contentRef.current?.offsetWidth ?? Infinity;
      const maxChat = containerWidth - 560; // reserve main content min-width
      return Math.max(300, Math.min(maxChat, prev - delta));
    });
  }, []);

  const applyCustomColors = useThemeStore((s) => s.applyCustomColors);
  const currentTheme = useThemeStore((s) => s.theme);

  // Load models config on mount
  useEffect(() => {
    getModelsConfig().then(setModelsConfig).catch(() => {});
  }, []);

  // Load custom theme colors on mount and when theme changes to custom
  useEffect(() => {
    if (currentTheme === 'custom') {
      getConfig().then((c) => {
        if (c.custom_theme_colors && Object.keys(c.custom_theme_colors).length > 0) {
          applyCustomColors(c.custom_theme_colors);
        }
      }).catch(() => {});
    }
  }, [currentTheme, applyCustomColors]);

  // Listen for live updates from the custom theme editor window
  useEffect(() => {
    const unlisten = listen<Record<string, string>>('custom-theme-updated', (event) => {
      if (currentTheme === 'custom') {
        applyCustomColors(event.payload);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [currentTheme, applyCustomColors]);

  // Focus mode keyboard shortcuts: F11 or Ctrl+Shift+F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11' || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F')) {
        e.preventDefault();
        toggleFocusMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFocusMode]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {!focusMode && <TitleBar />}

      <div className="flex flex-1 min-h-0">
        {!focusMode && <Sidebar />}

        <div ref={contentRef} className="flex-1 flex min-w-0">
          <div className="flex-1 flex flex-col" style={{ minWidth: '560px' }}>
            <div className="flex-1 min-h-0 overflow-hidden">
              <MainContent />
            </div>
            {!focusMode && activeBookId && activeView !== 'settings' && <PhaseProgressBar />}
          </div>

          {!focusMode && showChat && (
            <>
              <ResizeDivider onResize={handleResize} />
              <ChatPanel width={chatWidth} />
            </>
          )}
        </div>
      </div>

      {!focusMode && <Footer />}
    </div>
  );
}
