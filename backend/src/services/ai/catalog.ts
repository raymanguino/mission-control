import type { AiProvider, AiWorkload } from './types.js';

export type CostTier = 'cheap' | 'medium' | 'expensive';

export interface AiModelCandidate {
  id: string;
  provider: AiProvider;
  modelEnvVar: string;
  defaultModel: string;
  workloads: AiWorkload[];
  costTier: CostTier;
}

export interface ResolvedCandidate extends Omit<AiModelCandidate, 'modelEnvVar' | 'defaultModel'> {
  model: string;
}

const allCandidates: AiModelCandidate[] = [
  {
    id: 'openrouter-cheap',
    provider: 'openrouter',
    modelEnvVar: 'OPENROUTER_CHEAP_MODEL',
    defaultModel: 'openai/gpt-4o-mini',
    workloads: ['cheap_extract', 'balanced_analysis', 'fast_interactive'],
    costTier: 'cheap',
  },
  {
    id: 'openrouter-balanced',
    provider: 'openrouter',
    modelEnvVar: 'OPENROUTER_BALANCED_MODEL',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    workloads: ['balanced_analysis', 'fast_interactive', 'high_reasoning'],
    costTier: 'medium',
  },
  {
    id: 'anthropic-fallback',
    provider: 'anthropic',
    modelEnvVar: 'ANTHROPIC_MODEL',
    defaultModel: 'claude-sonnet-4-6',
    workloads: ['cheap_extract', 'balanced_analysis', 'fast_interactive', 'high_reasoning'],
    costTier: 'medium',
  },
];

export function listCandidates(): AiModelCandidate[] {
  return [...allCandidates];
}

export function getCandidateById(id: string): AiModelCandidate | undefined {
  return allCandidates.find((candidate) => candidate.id === id);
}

export function resolveCandidate(candidate: AiModelCandidate): ResolvedCandidate {
  const model = process.env[candidate.modelEnvVar] ?? candidate.defaultModel;
  return {
    id: candidate.id,
    provider: candidate.provider,
    model,
    workloads: candidate.workloads,
    costTier: candidate.costTier,
  };
}

