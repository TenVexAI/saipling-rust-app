import { useProjectStore } from '../../stores/projectStore';
import { SeedPhaseView } from './SeedPhaseView';
import { RootPhaseView } from './RootPhaseView';
import { SproutPhaseView } from './SproutPhaseView';
import { FlourishPhaseView } from './FlourishPhaseView';
import { BloomPhaseView } from './BloomPhaseView';
import { Sprout } from 'lucide-react';

export function PhaseWorkflow() {
  const activePhase = useProjectStore((s) => s.activePhase);
  const activeBookId = useProjectStore((s) => s.activeBookId);

  if (!activeBookId) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
        <Sprout size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
        <p className="text-sm">Select a book to begin a phase workflow</p>
      </div>
    );
  }

  if (!activePhase) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
        <Sprout size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
        <p className="text-sm">Click a phase in the progress bar to begin</p>
      </div>
    );
  }

  switch (activePhase) {
    case 'seed':
      return <SeedPhaseView />;
    case 'root':
      return <RootPhaseView />;
    case 'sprout':
      return <SproutPhaseView />;
    case 'flourish':
      return <FlourishPhaseView />;
    case 'bloom':
      return <BloomPhaseView />;
    default:
      return null;
  }
}
