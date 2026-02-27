import { Sparkles, Loader2, X, Check, AlertCircle } from 'lucide-react';
import { useGenerate } from '../../hooks/useGenerate';
import type { ContextScope } from '../../types/ai';

interface GenerateButtonProps {
  skill: string;
  scope: ContextScope;
  message: string;
  outputPath: string;
  frontmatter: Record<string, unknown>;
  parseResponse?: (text: string) => string;
  label?: string;
  onComplete?: (outputPath: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function GenerateButton({
  skill,
  scope,
  message,
  outputPath,
  frontmatter,
  parseResponse,
  label = 'Generate',
  onComplete,
  disabled = false,
  size = 'sm',
}: GenerateButtonProps) {
  const { phase, plan, error, startGenerate, confirmGenerate, cancelGenerate, reset } = useGenerate();

  const handleClick = async () => {
    if (phase === 'idle') {
      await startGenerate({ skill, scope, message, outputPath, frontmatter, parseResponse });
    } else if (phase === 'confirming') {
      await confirmGenerate();
    } else if (phase === 'done') {
      onComplete?.(outputPath);
      reset();
    }
  };

  const iconSize = size === 'sm' ? 12 : 14;
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const padding = size === 'sm' ? '4px 10px' : '6px 14px';

  const isWorking = phase === 'planning' || phase === 'generating';

  return (
    <div className="flex items-center gap-2">
      {/* Main button */}
      <button
        onClick={handleClick}
        disabled={disabled || isWorking}
        className={`flex items-center gap-1.5 ${textSize} font-medium rounded-md transition-colors`}
        style={{
          padding,
          backgroundColor: phase === 'confirming' ? 'var(--color-success)' : phase === 'done' ? 'var(--color-success)' : 'var(--accent)',
          color: '#fff',
          border: 'none',
          cursor: disabled || isWorking ? 'not-allowed' : 'pointer',
          opacity: disabled || isWorking ? 0.6 : 1,
        }}
        title={phase === 'confirming' && plan
          ? `${plan.approach}\nEst. cost: ${plan.estimated_cost}`
          : label}
      >
        {isWorking ? (
          <Loader2 size={iconSize} className="animate-spin" />
        ) : phase === 'done' ? (
          <Check size={iconSize} />
        ) : (
          <Sparkles size={iconSize} />
        )}
        {phase === 'idle' && label}
        {phase === 'planning' && 'Planning...'}
        {phase === 'confirming' && `Confirm (${plan?.estimated_cost ?? '?'})`}
        {phase === 'generating' && 'Generating...'}
        {phase === 'done' && 'View'}
      </button>

      {/* Cancel button (during confirming/generating) */}
      {(phase === 'confirming' || phase === 'generating') && (
        <button
          onClick={cancelGenerate}
          className="flex items-center justify-center rounded-md transition-colors hover-icon"
          style={{
            width: size === 'sm' ? '22px' : '26px',
            height: size === 'sm' ? '22px' : '26px',
            backgroundColor: 'var(--bg-tertiary)',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
          }}
          title="Cancel"
        >
          <X size={iconSize} />
        </button>
      )}

      {/* Error indicator */}
      {error && (
        <button
          onClick={reset}
          className="flex items-center gap-1 text-xs rounded-md"
          style={{ color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer' }}
          title={error}
        >
          <AlertCircle size={12} />
          <span>Error</span>
        </button>
      )}
    </div>
  );
}
