import { Check, Pencil, X, Cpu, Search } from 'lucide-react';
import type { AgentPlan } from '../../types/ai';

interface AgentPlanCardProps {
  plan: AgentPlan;
  onApprove: () => void;
  onCancel: () => void;
}

export function AgentPlanCard({ plan, onApprove, onCancel }: AgentPlanCardProps) {
  const searchTokens = plan.search_results.reduce((sum, r) => sum + r.tokens_est, 0);

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
          {plan.context_files.length} files
          {plan.search_results.length > 0 && ` + ${plan.search_results.length} search results`}
          {' '}· ~{plan.total_tokens_est.toLocaleString()} tokens
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

        {/* Context files (via skill) */}
        {plan.context_files.length > 0 && (
          <div className="pt-1">
            <div className="font-medium" style={{ color: 'var(--text-tertiary)', marginBottom: '2px' }}>
              Context files (via skill):
            </div>
            {plan.context_files.map((f) => (
              <div key={f.path} style={{ color: 'var(--text-secondary)', marginBottom: '1px' }}>
                ✓ {f.path} ({f.mode.toUpperCase()}) — {f.tokens_est.toLocaleString()} tokens
              </div>
            ))}
          </div>
        )}

        {/* Context files (via search) */}
        {plan.search_results.length > 0 && (
          <div className="pt-1">
            <div className="flex items-center gap-1 font-medium" style={{ color: 'var(--text-tertiary)', marginBottom: '2px' }}>
              <Search size={10} />
              Context files (via search) — {searchTokens.toLocaleString()} tokens:
            </div>
            {plan.search_results.map((r, i) => (
              <div key={i} style={{ color: 'var(--text-secondary)', marginBottom: '1px' }}>
                🔍 {r.file_path}
                {r.section && <span style={{ color: 'var(--text-tertiary)' }}> § {r.section}</span>}
                {' '}— {r.tokens_est.toLocaleString()} tokens
                <span style={{ color: 'var(--text-tertiary)' }}> ({(r.similarity_score * 100).toFixed(0)}% match)</span>
              </div>
            ))}
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
