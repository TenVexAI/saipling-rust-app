import { Check, Pencil, X, Cpu } from 'lucide-react';
import type { AgentPlan } from '../../types/ai';

interface AgentPlanCardProps {
  plan: AgentPlan;
  onApprove: () => void;
  onCancel: () => void;
}

export function AgentPlanCard({ plan, onApprove, onCancel }: AgentPlanCardProps) {
  return (
    <div
      className="rounded-lg mx-4 my-2 overflow-hidden"
      style={{
        border: '1px solid var(--color-info)',
        backgroundColor: 'var(--bg-elevated)',
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 text-xs font-medium"
        style={{
          backgroundColor: 'var(--accent-subtle)',
          color: 'var(--color-info)',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        <Cpu size={14} />
        Agent Plan
      </div>

      <div className="px-3 py-2 space-y-2 text-xs" style={{ color: 'var(--text-primary)' }}>
        <div>
          <span style={{ color: 'var(--text-tertiary)' }}>Skills: </span>
          {plan.skills.join(', ')}
        </div>
        <div>
          <span style={{ color: 'var(--text-tertiary)' }}>Model: </span>
          {plan.model}
        </div>
        <div>
          <span style={{ color: 'var(--text-tertiary)' }}>Context: </span>
          {plan.context_files.length} files · ~{plan.total_tokens_est.toLocaleString()} tokens
        </div>
        <div>
          <span style={{ color: 'var(--text-tertiary)' }}>Est. cost: </span>
          {plan.estimated_cost}
        </div>
        {plan.approach && (
          <div className="pt-1" style={{ color: 'var(--text-secondary)' }}>
            {plan.approach}
          </div>
        )}
      </div>

      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderTop: '1px solid var(--border-primary)' }}
      >
        <button
          onClick={onApprove}
          className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium"
          style={{ backgroundColor: 'var(--color-success)', color: '#fff' }}
        >
          <Check size={12} />
          Approve
        </button>
        <button
          className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-primary)',
          }}
        >
          <Pencil size={12} />
          Edit Plan
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <X size={12} />
          Cancel
        </button>
      </div>
    </div>
  );
}
