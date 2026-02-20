import {
  LayoutDashboard, FolderOpen, BookOpen, Globe, Users, StickyNote, Settings,
} from 'lucide-react';
import { useProjectStore, type SidebarView } from '../../stores/projectStore';

interface NavItem {
  id: SidebarView;
  icon: React.ReactNode;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
  { id: 'files', icon: <FolderOpen size={20} />, label: 'Files' },
  { id: 'book', icon: <BookOpen size={20} />, label: 'Book' },
  { id: 'world', icon: <Globe size={20} />, label: 'World' },
  { id: 'characters', icon: <Users size={20} />, label: 'Characters' },
  { id: 'notes', icon: <StickyNote size={20} />, label: 'Notes' },
];

export function Sidebar() {
  const activeView = useProjectStore((s) => s.activeView);
  const setActiveView = useProjectStore((s) => s.setActiveView);
  const sidebarExpanded = useProjectStore((s) => s.sidebarExpanded);
  const project = useProjectStore((s) => s.project);

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
              className="flex items-center gap-3 w-full rounded-md transition-colors"
              style={{
                color: isActive ? 'var(--accent)' : disabled ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--bg-active)' : 'transparent',
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

      <div className="pb-3 px-1.5">
        <button
          onClick={() => setActiveView('settings')}
          className="flex items-center gap-3 w-full rounded-md transition-colors"
          style={{
            color: activeView === 'settings' ? 'var(--accent)' : 'var(--text-secondary)',
            backgroundColor: activeView === 'settings' ? 'var(--bg-active)' : 'transparent',
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
