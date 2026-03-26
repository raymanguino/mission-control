export type AiProvider = 'openrouter' | 'anthropic' | 'system';
export type AiWorkload = 'cheap_extract' | 'balanced_analysis' | 'fast_interactive' | 'high_reasoning';

export interface AiSelectionMetadata {
  provider: AiProvider;
  model: string;
  workload: AiWorkload;
  fallbackUsed?: boolean;
}

