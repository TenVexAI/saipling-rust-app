import { ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAIStore } from '../../stores/aiStore';

const BUILTIN_SKILLS = [
  { name: 'brainstorm', display_name: 'Brainstorm' },
  { name: 'seed_developer', display_name: 'Seed Developer' },
  { name: 'structure_analyst', display_name: 'Structure Analyst' },
  { name: 'character_developer', display_name: 'Character Developer' },
  { name: 'relationship_mapper', display_name: 'Relationship Mapper' },
  { name: 'world_builder', display_name: 'World Builder' },
  { name: 'scene_architect', display_name: 'Scene Architect' },
  { name: 'prose_writer', display_name: 'Prose Writer' },
  { name: 'prose_editor', display_name: 'Prose Editor' },
  { name: 'describe', display_name: 'Describe' },
  { name: 'dialogue_crafter', display_name: 'Dialogue Crafter' },
  { name: 'consistency_checker', display_name: 'Consistency Checker' },
  { name: 'researcher', display_name: 'Researcher' },
  { name: 'series_arc_planner', display_name: 'Series Arc Planner' },
  { name: 'genre_specialist', display_name: 'Genre Specialist' },
  { name: 'front_back_matter_writer', display_name: 'Front/Back Matter Writer' },
];

export function SkillSelector() {
  const activeSkill = useAIStore((s) => s.activeSkill);
  const setActiveSkill = useAIStore((s) => s.setActiveSkill);
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

  const activeName = BUILTIN_SKILLS.find((s) => s.name === activeSkill)?.display_name || 'Auto';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium w-full"
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-primary)',
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
            className="w-full text-left px-3 py-1.5 text-xs transition-colors"
            style={{
              color: !activeSkill ? 'var(--accent)' : 'var(--text-primary)',
              backgroundColor: !activeSkill ? 'var(--accent-subtle)' : 'transparent',
            }}
          >
            Auto (context-based)
          </button>
          {BUILTIN_SKILLS.map((skill) => (
            <button
              key={skill.name}
              onClick={() => { setActiveSkill(skill.name); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs transition-colors"
              style={{
                color: activeSkill === skill.name ? 'var(--accent)' : 'var(--text-primary)',
                backgroundColor: activeSkill === skill.name ? 'var(--accent-subtle)' : 'transparent',
              }}
            >
              {skill.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
