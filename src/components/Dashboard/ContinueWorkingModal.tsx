import { ArrowRight, Users, Globe, X } from 'lucide-react';
import { PhaseIcon } from '../PhaseWorkflow/PhaseIcon';
import type { Phase, PhaseInfo } from '../../types/sapling';

interface ContinueWorkingModalProps {
  phaseInfo: PhaseInfo;
  phaseId: Phase;
  bookTitle: string;
  onGoToPhase: () => void;
  onAddCharacter: () => void;
  onAddWorldEntry: () => void;
  onDismiss: () => void;
}

export function ContinueWorkingModal({
  phaseInfo,
  phaseId,
  bookTitle,
  onGoToPhase,
  onAddCharacter,
  onAddWorldEntry,
  onDismiss,
}: ContinueWorkingModalProps) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
      onClick={onDismiss}
    >
      <div
        className="rounded-xl"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          padding: '28px',
          maxWidth: '480px',
          width: '90%',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3" style={{ marginBottom: '20px' }}>
          <PhaseIcon phase={phaseId} size={36} />
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Continue Working
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '2px' }}>
              {bookTitle}
            </p>
          </div>
        </div>

        <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '20px' }}>
          Pick up where you left off, or expand your project with new characters and world-building.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          {/* Continue Phase */}
          <button
            onClick={onGoToPhase}
            className="flex items-center gap-3 rounded-lg text-left hover-btn"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-primary)',
              padding: '12px 16px',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <ArrowRight size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold block" style={{ color: 'var(--text-primary)' }}>
                Continue {phaseInfo.label} Phase
              </span>
              <span className="text-[11px] block" style={{ color: 'var(--text-tertiary)', marginTop: '1px' }}>
                {phaseInfo.question}
              </span>
            </div>
          </button>

          {/* Add Character */}
          <button
            onClick={onAddCharacter}
            className="flex items-center gap-3 rounded-lg text-left hover-btn"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-primary)',
              padding: '12px 16px',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <Users size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold block" style={{ color: 'var(--text-primary)' }}>
                Add a Character
              </span>
              <span className="text-[11px] block" style={{ color: 'var(--text-tertiary)', marginTop: '1px' }}>
                Create a new character brainstorm document
              </span>
            </div>
          </button>

          {/* Add World Entry */}
          <button
            onClick={onAddWorldEntry}
            className="flex items-center gap-3 rounded-lg text-left hover-btn"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-primary)',
              padding: '12px 16px',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <Globe size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold block" style={{ color: 'var(--text-primary)' }}>
                Add a World Bible Entry
              </span>
              <span className="text-[11px] block" style={{ color: 'var(--text-tertiary)', marginTop: '1px' }}>
                Expand your world-building with a new entry
              </span>
            </div>
          </button>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onDismiss}
            className="flex items-center gap-1.5 rounded-lg text-xs font-medium hover-btn"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)',
              padding: '8px 16px',
              cursor: 'pointer',
            }}
          >
            <X size={12} />
            Stay on Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
