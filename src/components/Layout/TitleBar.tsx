import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X } from 'lucide-react';
import logo from '../../assets/logo.png';
import { useProjectStore } from '../../stores/projectStore';

export function TitleBar() {
  const project = useProjectStore((s) => s.project);
  const activeBookId = useProjectStore((s) => s.activeBookId);
  const appWindow = getCurrentWindow();

  const bookTitle = project?.books.find((b) => b.id === activeBookId)?.title;
  const title = [project?.name, bookTitle].filter(Boolean).join(' — ') || 'SAiPLING';

  const handleDragStart = (e: React.MouseEvent) => {
    // Only start drag if not clicking a button
    if ((e.target as HTMLElement).closest('button')) return;
    appWindow.startDragging();
  };

  return (
    <div
      onMouseDown={handleDragStart}
      className="flex items-center justify-between select-none shrink-0"
      style={{
        height: 'var(--titlebar-height)',
        backgroundColor: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border-primary)',
        paddingLeft: 'var(--space-sm)',
      }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <img src={logo} alt="SAiPLING" className="w-5 h-5 shrink-0" />
        <span
          className="text-xs truncate"
          style={{ color: 'var(--text-secondary)' }}
        >
          {title}
        </span>
      </div>

      <div className="flex h-full">
        <button
          onClick={() => appWindow.minimize()}
          className="flex items-center justify-center w-11 h-full transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className="flex items-center justify-center w-11 h-full transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => appWindow.close()}
          className="flex items-center justify-center w-11 h-full transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dc2626'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
