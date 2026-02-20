import { TitleBar } from './TitleBar';
import { Sidebar } from '../Sidebar/Sidebar';
import { Footer } from '../Footer/Footer';
import { PhaseProgressBar } from '../ProgressBar/PhaseProgressBar';
import { ChatPanel } from '../AIChat/ChatPanel';
import { Dashboard } from '../Dashboard/Dashboard';
import { SettingsView } from '../Settings/SettingsView';
import { useProjectStore } from '../../stores/projectStore';
import { useEditorStore } from '../../stores/editorStore';

function MainContent() {
  const activeView = useProjectStore((s) => s.activeView);
  const focusMode = useEditorStore((s) => s.focusMode);

  if (focusMode) {
    return (
      <div className="flex-1 h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
          Editor (Focus Mode) — coming soon
        </div>
      </div>
    );
  }

  switch (activeView) {
    case 'dashboard':
      return <Dashboard />;
    case 'settings':
      return <SettingsView />;
    case 'files':
      return (
        <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
          Project Explorer — coming soon
        </div>
      );
    case 'book':
      return (
        <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
          Book View — coming soon
        </div>
      );
    case 'world':
      return (
        <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
          World Browser — coming soon
        </div>
      );
    case 'characters':
      return (
        <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
          Characters — coming soon
        </div>
      );
    case 'notes':
      return (
        <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
          Notes — coming soon
        </div>
      );
    default:
      return <Dashboard />;
  }
}

export function AppShell() {
  const focusMode = useEditorStore((s) => s.focusMode);
  const activeBookId = useProjectStore((s) => s.activeBookId);
  const rightPanelOpen = useProjectStore((s) => s.rightPanelOpen);
  const activeView = useProjectStore((s) => s.activeView);
  const showChat = activeView !== 'settings' && rightPanelOpen;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {!focusMode && <TitleBar />}

      <div className="flex flex-1 min-h-0">
        {!focusMode && <Sidebar />}

        <div className="flex-1 flex min-w-0">
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 min-h-0 overflow-hidden">
              <MainContent />
            </div>
          </div>

          {!focusMode && showChat && <ChatPanel />}
        </div>
      </div>

      {!focusMode && activeBookId && <PhaseProgressBar />}
      {!focusMode && <Footer />}
    </div>
  );
}
