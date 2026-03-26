import type { AiWorkload } from './types.js';
import type { CostTier } from './catalog.js';

export interface WorkloadPolicy {
  defaultCandidateId: string;
  fallbackCandidateId: string;
  allowedCandidateIds: string[];
  maxCostTier?: CostTier;
}

const policyByWorkload: Record<AiWorkload, WorkloadPolicy> = {
  cheap_extract: {
    defaultCandidateId: 'openrouter-cheap',
    fallbackCandidateId: 'anthropic-fallback',
    allowedCandidateIds: ['openrouter-cheap', 'openrouter-balanced', 'anthropic-fallback'],
    maxCostTier: 'medium',
  },
  balanced_analysis: {
    defaultCandidateId: 'openrouter-balanced',
    fallbackCandidateId: 'anthropic-fallback',
    allowedCandidateIds: ['openrouter-balanced', 'openrouter-cheap', 'anthropic-fallback'],
  },
  fast_interactive: {
    defaultCandidateId: 'openrouter-cheap',
    fallbackCandidateId: 'anthropic-fallback',
    allowedCandidateIds: ['openrouter-cheap', 'openrouter-balanced', 'anthropic-fallback'],
    maxCostTier: 'medium',
  },
  high_reasoning: {
    defaultCandidateId: 'openrouter-balanced',
    fallbackCandidateId: 'anthropic-fallback',
    allowedCandidateIds: ['openrouter-balanced', 'anthropic-fallback'],
  },
};

export function getWorkloadPolicy(workload: AiWorkload): WorkloadPolicy {
  return policyByWorkload[workload];
}

