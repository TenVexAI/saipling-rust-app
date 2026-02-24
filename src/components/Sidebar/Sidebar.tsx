import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, FolderOpen, BookOpen, Globe, Users, StickyNote, Settings, HelpCircle,
} from 'lucide-react';
import { useProjectStore, type SidebarView } from '../../stores/projectStore';
import { toggleHelpWindow, isHelpWindowOpen } from '../../utils/helpWindow';
import { listen } from '@tauri-apps/api/event';

interface NavItem {
  id: SidebarView;
  icon: React.ReactNode;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
  { id: 'book', icon: <BookOpen size={20} />, label: 'Book' },
  { id: 'characters', icon: <Users size={20} />, label: 'Characters' },
  { id: 'world', icon: <Globe size={20} />, label: 'World Bible' },
  { id: 'notes', icon: <StickyNote size={20} />, label: 'Notes' },
  { id: 'files', icon: <FolderOpen size={20} />, label: 'Files & Context' },
];

export function Sidebar() {
  const activeView = useProjectStore((s) => s.activeView);
  const setActiveView = useProjectStore((s) => s.setActiveView);
  const sidebarExpanded = useProjectStore((s) => s.sidebarExpanded);
  const project = useProjectStore((s) => s.project);
  const [helpOpen, setHelpOpen] = useState(false);

  // Track help window open/close via Tauri webview events
  useEffect(() => {
    // Check initial state
    isHelpWindowOpen().then(setHelpOpen).catch(() => {});

    // Listen for window created/destroyed events
    const unlistenCreated = listen('tauri://webview-created', () => {
      isHelpWindowOpen().then(setHelpOpen).catch(() => {});
    });
    const unlistenDestroyed = listen('tauri://window-destroyed', () => {
      // Small delay to let the window fully close
      setTimeout(() => isHelpWindowOpen().then(setHelpOpen).catch(() => {}), 100);
    });

    return () => {
      unlistenCreated.then((fn) => fn());
      unlistenDestroyed.then((fn) => fn());
    };
  }, []);

  const handleHelpClick = useCallback(() => {
    toggleHelpWindow().then(() => {
      // Update state after toggle
      setTimeout(() => isHelpWindowOpen().then(setHelpOpen).catch(() => {}), 150);
    });
  }, []);

  return (
    <div
      className="flex flex-col h-full shrink-0"
      style={{
        width: sidebarExpanded ? 'var(--sidebar-expanded-width)' : 'var(--sidebar-width)',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-primary)',
        transition: 'width var(--transition-normal)',
      }}
    >
      <div className="flex-1 flex flex-col gap-1 py-3 px-1.5">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          const disabled = !project && item.id !== 'dashboard' && item.id !== 'settings';

          return (
            <button
              key={item.id}
              onClick={() => !disabled && setActiveView(item.id)}
              disabled={disabled}
              className="flex items-center gap-3 w-full rounded-md hover-sidebar"
              style={{
                color: isActive ? '#3cf281' : disabled ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                backgroundColor: 'transparent',
                opacity: disabled ? 0.4 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
                justifyContent: sidebarExpanded ? 'flex-start' : 'center',
                padding: sidebarExpanded ? '8px 12px' : '10px 0',
              }}
              title={item.label}
            >
              {item.icon}
              {sidebarExpanded && (
                <span className="text-sm truncate">{item.label}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="pb-3 px-1.5 flex flex-col gap-1">
        <button
          onClick={handleHelpClick}
          className={`flex items-center gap-3 w-full rounded-md ${helpOpen ? '' : 'hover-sidebar'}`}
          style={{
            color: helpOpen ? 'var(--accent)' : 'var(--text-secondary)',
            backgroundColor: 'transparent',
            transition: 'color 0.15s ease',
            justifyContent: sidebarExpanded ? 'flex-start' : 'center',
            padding: sidebarExpanded ? '8px 12px' : '10px 0',
          }}
          onMouseEnter={(e) => { if (helpOpen) e.currentTarget.style.color = 'var(--color-error)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = helpOpen ? 'var(--accent)' : 'var(--text-secondary)'; }}
          title={helpOpen ? 'Close Help' : 'Help'}
        >
          <HelpCircle size={20} />
          {sidebarExpanded && <span className="text-sm">Help</span>}
        </button>
        <button
          onClick={() => setActiveView('settings')}
          className="flex items-center gap-3 w-full rounded-md hover-sidebar"
          style={{
            color: activeView === 'settings' ? '#3cf281' : 'var(--text-secondary)',
            backgroundColor: 'transparent',
            justifyContent: sidebarExpanded ? 'flex-start' : 'center',
            padding: sidebarExpanded ? '8px 12px' : '10px 0',
          }}
          title="Settings"
        >
          <Settings size={20} />
          {sidebarExpanded && <span className="text-sm">Settings</span>}
        </button>
      </div>
    </div>
  );
}
