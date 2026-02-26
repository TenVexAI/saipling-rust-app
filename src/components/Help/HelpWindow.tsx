import { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';
import { Minus, Square, X, ChevronRight, ChevronDown, Search, BookOpen } from 'lucide-react';
import { HELP_SECTIONS, type HelpSection, type HelpSubsection } from '../../data/helpContent';
import { useThemeStore } from '../../stores/themeStore';
import { getConfig } from '../../utils/tauri';
import { openUrl } from '@tauri-apps/plugin-opener';
import logo from '../../assets/logo.png';

export function HelpWindow() {
  const setTheme = useThemeStore((s) => s.setTheme);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const appWindow = getCurrentWindow();

  const expandToSection = useCallback((targetId: string) => {
    setExpandedSections((prev) => {
      const newExpanded = new Set(prev);
      newExpanded.add(targetId);
      for (const section of HELP_SECTIONS) {
        if (section.id === targetId) {
          newExpanded.add(section.id);
          break;
        }
        if (section.subsections) {
          for (const sub of section.subsections) {
            if (sub.id === targetId) {
              newExpanded.add(section.id);
              newExpanded.add(sub.id);
              break;
            }
            if (sub.subsections?.some((nested) => nested.id === targetId)) {
              newExpanded.add(section.id);
              newExpanded.add(sub.id);
              newExpanded.add(targetId);
              break;
            }
          }
        }
      }
      return newExpanded;
    });
  }, []);

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(`help-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const applyCustomColors = useThemeStore((s) => s.applyCustomColors);

  // Load theme from config so help window matches main app
  useEffect(() => {
    getConfig().then((config) => {
      if (config.theme) {
        setTheme(config.theme as Parameters<typeof setTheme>[0]);
      }
      if (config.theme === 'custom' && config.custom_theme_colors && Object.keys(config.custom_theme_colors).length > 0) {
        applyCustomColors(config.custom_theme_colors);
      }
    }).catch(() => {});
  }, [setTheme, applyCustomColors]);

  // Listen for live custom theme color updates from the editor window
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<Record<string, string>>('custom-theme-updated', (event) => {
        applyCustomColors(event.payload);
      }).then((u) => { unlisten = u; });
    });
    return () => { unlisten?.(); };
  }, [applyCustomColors]);

  // Helper: notify sidebar then close
  const emitCloseAndExit = useCallback(async () => {
    await emit('help-window-closed');
    appWindow.close();
  }, [appWindow]);

  // Close help window on Ctrl+Shift+H
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toUpperCase() === 'H') {
        e.preventDefault();
        emitCloseAndExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appWindow, emitCloseAndExit]);

  // Read target section from URL params and scroll to it
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    if (section) {
      setActiveId(section);
      expandToSection(section);
      setTimeout(() => scrollToSection(section), 150);
    }
  }, [expandToSection, scrollToSection]);

  // Listen for Tauri navigate events from main window
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<{ section: string }>('help-navigate', (event) => {
        const section = event.payload.section;
        setActiveId(section);
        expandToSection(section);
        setTimeout(() => scrollToSection(section), 100);
      }).then((u) => { unlisten = u; });
    });
    return () => { unlisten?.(); };
  }, [expandToSection, scrollToSection]);

  // Listen for theme changes from the main window
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<{ theme: string }>('theme-changed', (event) => {
        setTheme(event.payload.theme as Parameters<typeof setTheme>[0]);
      }).then((u) => { unlisten = u; });
    });
    return () => { unlisten?.(); };
  }, [setTheme]);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>();
    for (const section of HELP_SECTIONS) {
      all.add(section.id);
      section.subsections?.forEach((sub) => {
        all.add(sub.id);
        sub.subsections?.forEach((nested) => all.add(nested.id));
      });
    }
    setExpandedSections(all);
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  // Filter sections based on search
  const filteredSections = searchQuery.trim()
    ? HELP_SECTIONS.map((section) => {
        const q = searchQuery.toLowerCase();
        const sectionMatch = section.title.toLowerCase().includes(q) || section.content.toLowerCase().includes(q);
        const matchesSubsection = (sub: HelpSubsection): boolean =>
          sub.title.toLowerCase().includes(q) ||
          sub.content.toLowerCase().includes(q) ||
          sub.bullets?.some((b) => b.toLowerCase().includes(q)) === true ||
          sub.table?.some((t) => t.label.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)) === true ||
          sub.subsections?.some(matchesSubsection) === true;
        const matchingSubs = section.subsections?.filter(matchesSubsection);
        if (sectionMatch || (matchingSubs && matchingSubs.length > 0)) {
          return { ...section, subsections: sectionMatch ? section.subsections : matchingSubs };
        }
        return null;
      }).filter(Boolean) as HelpSection[]
    : HELP_SECTIONS;

  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    appWindow.startDragging();
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Title Bar */}
      <div
        onMouseDown={handleDragStart}
        className="flex items-center justify-between select-none shrink-0"
        style={{
          height: 'var(--titlebar-height)',
          backgroundColor: 'var(--bg-sidebar)',
          borderBottom: '1px solid var(--border-primary)',
          paddingLeft: '12px',
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <img src={logo} alt="SAiPLING" className="w-5 h-5 shrink-0" />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            SAiPLING HELP
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
            onClick={() => emitCloseAndExit()}
            className="flex items-center justify-center w-11 h-full transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dc2626'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Search & Controls */}
      <div
        className="shrink-0 flex items-center gap-2"
        style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-secondary)' }}
      >
        <div
          className="flex items-center gap-2 flex-1 rounded-lg"
          style={{
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-primary)',
            padding: '6px 10px',
          }}
        >
          <Search size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.trim()) expandAll();
            }}
            placeholder="Search help..."
            className="flex-1 text-sm bg-transparent border-none outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
        <button
          onClick={expandAll}
          className="text-xs rounded-md hover-btn"
          style={{ padding: '5px 10px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
        >
          Expand All
        </button>
        <button
          onClick={collapseAll}
          className="text-xs rounded-md hover-btn"
          style={{ padding: '5px 10px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
        >
          Collapse All
        </button>
      </div>

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto" style={{ padding: '16px 20px' }}>
        {filteredSections.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12" style={{ color: 'var(--text-tertiary)' }}>
            <BookOpen size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <p className="text-sm">No results found for "{searchQuery}"</p>
          </div>
        )}

        {filteredSections.map((section) => (
          <SectionBlock
            key={section.id}
            section={section}
            expanded={expandedSections.has(section.id)}
            expandedSubs={expandedSections}
            activeId={activeId}
            onToggle={toggleSection}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Section Block ───
interface SectionBlockProps {
  section: HelpSection;
  expanded: boolean;
  expandedSubs: Set<string>;
  activeId: string | null;
  onToggle: (id: string) => void;
  depth: number;
}

function SectionBlock({ section, expanded, expandedSubs, activeId, onToggle, depth }: SectionBlockProps) {
  const isActive = activeId === section.id;

  return (
    <div
      id={`help-${section.id}`}
      style={{ marginBottom: depth === 0 ? '8px' : '4px' }}
    >
      {/* Header */}
      <button
        onClick={() => onToggle(section.id)}
        className="flex items-center gap-2 w-full text-left rounded-lg transition-colors"
        style={{
          padding: depth === 0 ? '10px 12px' : '8px 12px',
          backgroundColor: isActive ? 'var(--accent-subtle)' : 'transparent',
          border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
          marginLeft: depth > 0 ? '12px' : '0',
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {expanded
          ? <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          : <ChevronRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        }
        <span
          className={depth === 0 ? 'text-sm font-semibold' : 'text-sm font-medium'}
          style={{ color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}
        >
          {section.title}
        </span>
      </button>

      {/* Body */}
      {expanded && (
        <div style={{ paddingLeft: depth === 0 ? '28px' : '40px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px' }}>
          <ContentBlock content={section.content} bullets={section.bullets} table={section.table} />

          {/* Subsections */}
          {section.subsections?.map((sub) => (
            <SubsectionBlock
              key={sub.id}
              sub={sub}
              expanded={expandedSubs.has(sub.id)}
              expandedSubs={expandedSubs}
              activeId={activeId}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Subsection Block ───
interface SubsectionBlockProps {
  sub: HelpSubsection;
  expanded: boolean;
  expandedSubs: Set<string>;
  activeId: string | null;
  onToggle: (id: string) => void;
}

function SubsectionBlock({ sub, expanded, expandedSubs, activeId, onToggle }: SubsectionBlockProps) {
  const isActive = activeId === sub.id;

  return (
    <div id={`help-${sub.id}`} style={{ marginBottom: '4px' }}>
      <button
        onClick={() => onToggle(sub.id)}
        className="flex items-center gap-2 w-full text-left rounded-lg transition-colors"
        style={{
          padding: '7px 10px',
          backgroundColor: isActive ? 'var(--accent-subtle)' : 'transparent',
          border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {expanded
          ? <ChevronDown size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          : <ChevronRight size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        }
        <span
          className="text-xs font-medium"
          style={{ color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}
        >
          {sub.title}
        </span>
      </button>

      {expanded && (
        <div style={{ paddingLeft: '24px', paddingRight: '8px', paddingTop: '6px', paddingBottom: '6px' }}>
          <ContentBlock content={sub.content} bullets={sub.bullets} table={sub.table} />

          {/* Nested subsections (e.g. Acts under Phase 2) */}
          {sub.subsections?.map((nested) => (
            <SubsectionBlock
              key={nested.id}
              sub={nested}
              expanded={expandedSubs.has(nested.id)}
              expandedSubs={expandedSubs}
              activeId={activeId}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Content Renderer ───
interface ContentBlockProps {
  content: string;
  bullets?: string[];
  table?: { label: string; desc: string }[];
}

function ContentBlock({ content, bullets, table }: ContentBlockProps) {
  // Render content with basic formatting: \n → paragraph breaks
  const paragraphs = content.split('\n\n').filter(Boolean);

  return (
    <div>
      {paragraphs.map((p, i) => (
        <p
          key={i}
          className="text-xs leading-relaxed"
          style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}
        >
          {renderInlineFormatting(p)}
        </p>
      ))}

      {bullets && bullets.length > 0 && (
        <ul style={{ margin: '8px 0 8px 16px', listStyleType: 'disc' }}>
          {bullets.map((b, i) => (
            <li key={i} className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
              {renderInlineFormatting(b)}
            </li>
          ))}
        </ul>
      )}

      {table && table.length > 0 && (
        <div
          className="rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--border-primary)', margin: '8px 0' }}
        >
          {table.map((row, i) => (
            <div
              key={i}
              className="flex"
              style={{
                borderBottom: i < table.length - 1 ? '1px solid var(--border-primary)' : 'none',
                backgroundColor: i % 2 === 0 ? 'var(--bg-secondary)' : 'transparent',
              }}
            >
              <div
                className="text-xs font-medium shrink-0"
                style={{
                  width: '160px',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  borderRight: '1px solid var(--border-primary)',
                }}
              >
                {row.label}
              </div>
              <div
                className="text-xs flex-1"
                style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}
              >
                {renderInlineFormatting(row.desc)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Inline formatting helper ───
function renderInlineFormatting(text: string): React.ReactNode[] {
  // Handle **bold**, *italic*, and https:// links
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|(https?:\/\/[^\s,)]+))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      // **bold**
      parts.push(<strong key={match.index} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{match[2]}</strong>);
    } else if (match[3]) {
      // *italic*
      parts.push(<em key={match.index}>{match[3]}</em>);
    } else if (match[4]) {
      // URL — open in external browser via Tauri opener
      const url = match[4];
      parts.push(
        <span
          key={match.index}
          style={{ color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer' }}
          onClick={() => { openUrl(url).catch(() => {}); }}
        >
          {url}
        </span>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}
