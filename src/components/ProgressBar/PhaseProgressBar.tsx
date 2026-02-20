import { useProjectStore } from '../../stores/projectStore';
import { useAIStore } from '../../stores/aiStore';
import { PHASES } from '../../types/sapling';
import type { Phase, PhaseStatus } from '../../types/sapling';

function getPhaseStatus(
  phaseProgress: Record<string, { status: string }> | undefined,
  phaseId: Phase,
): PhaseStatus {
  if (!phaseProgress) return 'not_started';
  const p = phaseProgress[phaseId];
  if (!p) return 'not_started';
  return p.status as PhaseStatus;
}

function StatusIcon({ status }: { status: PhaseStatus }) {
  if (status === 'complete') {
    return <span style={{ color: 'var(--color-success)' }}>✓</span>;
  }
  if (status === 'in_progress') {
    return <span style={{ color: 'var(--color-magenta)' }}>◐</span>;
  }
  return <span style={{ color: 'var(--text-tertiary)' }}>○</span>;
}

// Map each phase to its primary AI skill
const PHASE_SKILLS: Record<Phase, string> = {
  seed: 'seed_developer',
  root: 'structure_analyst',
  sprout: 'character_developer',
  flourish: 'scene_architect',
  bloom: 'prose_writer',
};

export function PhaseProgressBar() {
  const activeBookMeta = useProjectStore((s) => s.activeBookMeta);
  const activePhase = useProjectStore((s) => s.activePhase);
  const setActivePhase = useProjectStore((s) => s.setActivePhase);
  const setActiveSkill = useAIStore((s) => s.setActiveSkill);

  const handlePhaseClick = (phaseId: Phase) => {
    setActivePhase(phaseId);
    setActiveSkill(PHASE_SKILLS[phaseId]);
  };

  return (
    <div
      className="flex items-center justify-center select-none shrink-0"
      style={{
        height: 'var(--progress-bar-height)',
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-primary)',
        padding: '0 16px',
      }}
    >
      {PHASES.map((phase, i) => {
        const status = getPhaseStatus(
          activeBookMeta?.phase_progress as Record<string, { status: string }>,
          phase.id,
        );

        return (
          <div key={phase.id} className="flex items-center">
            {i > 0 && (
              <div
                className="w-8 h-px"
                style={{
                  backgroundColor:
                    status === 'complete' || getPhaseStatus(
                      activeBookMeta?.phase_progress as Record<string, { status: string }>,
                      PHASES[i - 1].id,
                    ) === 'complete'
                      ? 'var(--color-success)'
                      : 'var(--border-primary)',
                }}
              />
            )}
            <button
              onClick={() => handlePhaseClick(phase.id)}
              className="flex items-center gap-1.5 rounded text-xs transition-colors"
              style={{
                padding: '2px 8px',
                color: activePhase === phase.id ? 'var(--accent)' : status === 'not_started' ? 'var(--text-tertiary)' : 'var(--text-primary)',
                backgroundColor: activePhase === phase.id ? 'var(--accent-subtle)' : 'transparent',
              }}
              title={`${phase.label}: ${phase.question}`}
            >
              <StatusIcon status={status} />
              <span className="font-medium">{phase.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
