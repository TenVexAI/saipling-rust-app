import type { ModelEntry, ModelsConfig } from '../types/ai';

let cachedConfig: ModelsConfig | null = null;

export function setModelsConfig(config: ModelsConfig): void {
  cachedConfig = config;
}

export function getModelEntry(modelId: string): ModelEntry | undefined {
  if (!cachedConfig) return undefined;
  return cachedConfig.models.find(
    (m) => m.id === modelId || modelId.startsWith(m.id),
  );
}

/**
 * Calculate cost based on model pricing config.
 * Uses long_context tier if input_tokens > 200K and the model supports it.
 */
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const model = getModelEntry(modelId);
  if (!model) {
    // Fallback: Sonnet 4.6 standard pricing
    return (inputTokens * 3 + outputTokens * 15) / 1_000_000;
  }

  const longContextThreshold = 200_000;
  const useLongContext =
    inputTokens > longContextThreshold && model.pricing.long_context;

  const tier = useLongContext ? model.pricing.long_context! : model.pricing.standard;
  return (inputTokens * tier.input + outputTokens * tier.output) / 1_000_000;
}
