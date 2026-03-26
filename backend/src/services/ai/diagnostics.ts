import type { AiWorkload } from './types.js';
import { listCandidates, resolveCandidate } from './catalog.js';
import { getWorkloadPolicy } from './policy.js';
import { selectModelForWorkload } from './select-model.js';

const workloads: AiWorkload[] = [
  'cheap_extract',
  'balanced_analysis',
  'fast_interactive',
  'high_reasoning',
];

function isConfigured(provider: 'openrouter' | 'anthropic' | 'system'): boolean {
  if (provider === 'openrouter') return Boolean(process.env['OPENROUTER_API_KEY']);
  if (provider === 'anthropic') return Boolean(process.env['ANTHROPIC_API_KEY']);
  return false;
}

export function getAiRoutingDiagnostics() {
  const providers = {
    openrouter: {
      configured: isConfigured('openrouter'),
      modelEnv: {
        OPENROUTER_MODEL: process.env['OPENROUTER_MODEL'] ?? null,
        OPENROUTER_CHEAP_MODEL: process.env['OPENROUTER_CHEAP_MODEL'] ?? null,
        OPENROUTER_BALANCED_MODEL: process.env['OPENROUTER_BALANCED_MODEL'] ?? null,
      },
    },
    anthropic: {
      configured: isConfigured('anthropic'),
      modelEnv: {
        ANTHROPIC_MODEL: process.env['ANTHROPIC_MODEL'] ?? null,
      },
    },
  };

  const availableCandidates = listCandidates().map((candidate) => {
    const resolved = resolveCandidate(candidate);
    return {
      id: resolved.id,
      provider: resolved.provider,
      model: resolved.model,
      workloads: resolved.workloads,
      costTier: resolved.costTier,
      configured: isConfigured(resolved.provider),
    };
  });

  const workloadSelections = workloads.map((workload) => {
    const policy = getWorkloadPolicy(workload);
    try {
      const selected = selectModelForWorkload(workload);
      return {
        workload,
        policy,
        selected: {
          primary: {
            id: selected.primary.id,
            provider: selected.primary.provider,
            model: selected.primary.model,
            costTier: selected.primary.costTier,
          },
          fallback: selected.fallback
            ? {
                id: selected.fallback.id,
                provider: selected.fallback.provider,
                model: selected.fallback.model,
                costTier: selected.fallback.costTier,
              }
            : null,
        },
        status: 'ok' as const,
      };
    } catch (err) {
      return {
        workload,
        policy,
        selected: null,
        status: 'error' as const,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  return {
    providers,
    availableCandidates,
    workloadSelections,
  };
}

