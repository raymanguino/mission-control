import type { AiWorkload } from './types.js';
import { getCandidateById, resolveCandidate, type CostTier, type ResolvedCandidate } from './catalog.js';
import { getWorkloadPolicy } from './policy.js';

interface SelectionAttempt {
  primary: ResolvedCandidate;
  fallback?: ResolvedCandidate;
}

const costOrder: Record<CostTier, number> = {
  cheap: 0,
  medium: 1,
  expensive: 2,
};

function isProviderConfigured(provider: ResolvedCandidate['provider']): boolean {
  if (provider === 'openrouter') return Boolean(process.env['OPENROUTER_API_KEY']);
  if (provider === 'anthropic') return Boolean(process.env['ANTHROPIC_API_KEY']);
  return false;
}

function withinCostTier(candidateTier: CostTier, maxTier?: CostTier): boolean {
  if (!maxTier) return true;
  return costOrder[candidateTier] <= costOrder[maxTier];
}

function requiredEnvForProvider(provider: ResolvedCandidate['provider']): string {
  if (provider === 'openrouter') return 'OPENROUTER_API_KEY';
  if (provider === 'anthropic') return 'ANTHROPIC_API_KEY';
  return 'unknown';
}

export function selectModelForWorkload(workload: AiWorkload): SelectionAttempt {
  const policy = getWorkloadPolicy(workload);
  const allowed = policy.allowedCandidateIds
    .map((id) => getCandidateById(id))
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .map(resolveCandidate)
    .filter((candidate) => candidate.workloads.includes(workload))
    .filter((candidate) => withinCostTier(candidate.costTier, policy.maxCostTier));

  const configured = allowed.filter((candidate) => isProviderConfigured(candidate.provider));
  const fallback = configured.find((candidate) => candidate.id === policy.fallbackCandidateId);

  const defaultCandidate = configured.find((candidate) => candidate.id === policy.defaultCandidateId);
  if (defaultCandidate) {
    return { primary: defaultCandidate, fallback };
  }

  const openRouterAlternatives = configured
    .filter((candidate) => candidate.provider === 'openrouter')
    .sort((a, b) => costOrder[a.costTier] - costOrder[b.costTier]);
  const preferredOpenRouter = openRouterAlternatives[0];
  if (preferredOpenRouter) {
    return { primary: preferredOpenRouter, fallback };
  }

  if (fallback) {
    return { primary: fallback };
  }

  const defaultTemplate = getCandidateById(policy.defaultCandidateId);
  const fallbackTemplate = getCandidateById(policy.fallbackCandidateId);
  if (!defaultTemplate || !fallbackTemplate) {
    throw new Error(`AI generation unavailable for workload "${workload}": invalid policy candidate`);
  }

  const required = [
    requiredEnvForProvider(resolveCandidate(defaultTemplate).provider),
    requiredEnvForProvider(resolveCandidate(fallbackTemplate).provider),
  ]
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
    .join(' and ');
  throw new Error(`AI generation unavailable for workload "${workload}": missing ${required}`);
}

