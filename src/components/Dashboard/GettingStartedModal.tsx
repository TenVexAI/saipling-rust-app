import { Lightbulb } from 'lucide-react';

interface GettingStartedModalProps {
  onStart: () => void;
  onDismiss: () => void;
}

export function GettingStartedModal({ onStart, onDismiss }: GettingStartedModalProps) {
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
          maxWidth: '460px',
          width: '90%',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
          <Lightbulb size={18} style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Getting Started
          </h2>
        </div>

        <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '12px' }}>
          Your first step is to create a <strong style={{ color: 'var(--text-primary)' }}>Project Overview</strong> — a
          living document that describes the scope and key details of your novel, series, or literary universe.
        </p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '12px' }}>
          This document will grow and evolve alongside your project. It gives both you and the AI a shared understanding
          of what you're building.
        </p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '20px' }}>
          Press <strong style={{ color: 'var(--text-primary)' }}>Start Now</strong> to open the brainstorm workspace
          and begin shaping your project.
        </p>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onDismiss}
            className="rounded-lg text-xs font-medium hover-btn"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)',
              padding: '8px 16px',
              cursor: 'pointer',
            }}
          >
            Not Yet
          </button>
          <button
            onClick={onStart}
            className="rounded-lg text-xs font-medium hover-btn-primary"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--text-inverse)',
              border: 'none',
              padding: '8px 16px',
              cursor: 'pointer',
            }}
          >
            Start Now
          </button>
        </div>
      </div>
    </div>
  );
}
