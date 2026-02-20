import { ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAIStore } from '../../stores/aiStore';

export function SkillSelector() {
  const activeSkill = useAIStore((s) => s.activeSkill);
  const setActiveSkill = useAIStore((s) => s.setActiveSkill);
  const availableSkills = useAIStore((s) => s.availableSkills);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeName = availableSkills.find((s) => s.name === activeSkill)?.display_name || 'Auto';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between rounded-md text-xs font-medium w-full"
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-primary)',
          padding: '6px 10px',
        }}
      >
        <span className="truncate">Skill: {activeName}</span>
        <ChevronDown size={12} className="shrink-0" />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded-lg overflow-hidden z-50 max-h-60 overflow-y-auto"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <button
            onClick={() => { setActiveSkill(null); setOpen(false); }}
            className="w-full text-left text-xs transition-colors"
            style={{
              color: !activeSkill ? 'var(--accent)' : 'var(--text-primary)',
              backgroundColor: !activeSkill ? 'var(--accent-subtle)' : 'transparent',
              padding: '7px 12px',
            }}
            onMouseEnter={(e) => { if (activeSkill) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { if (activeSkill) e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            Auto (context-based)
          </button>
          {availableSkills.map((skill) => (
            <button
              key={skill.name}
              onClick={() => { setActiveSkill(skill.name); setOpen(false); }}
              className="w-full text-left text-xs transition-colors"
              style={{
                color: activeSkill === skill.name ? 'var(--accent)' : 'var(--text-primary)',
                backgroundColor: activeSkill === skill.name ? 'var(--accent-subtle)' : 'transparent',
                padding: '7px 12px',
              }}
              onMouseEnter={(e) => { if (activeSkill !== skill.name) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { if (activeSkill !== skill.name) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {skill.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
