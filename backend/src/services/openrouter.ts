import { upsertRecord } from '../db/api/usage.js';

interface OpenRouterActivityItem {
  date: string;
  model?: string;
  model_permaslug?: string;
  endpoint_id?: string;
  provider_name?: string;
  usage?: number;
  cost?: number;
  byok_usage_inference?: number;
  requests?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  reasoning_tokens?: number;
  cached_tokens?: number;
  cache_write_tokens?: number;
  audio_tokens?: number;
}

interface OpenRouterActivityResponse {
  data: OpenRouterActivityItem[];
}

export async function syncOpenRouterUsage(): Promise<number> {
  const apiKey = process.env['OPENROUTER_API_KEY'];
  if (!apiKey) {
    console.warn('[openrouter] OPENROUTER_API_KEY not set, skipping sync');
    return 0;
  }

  const res = await fetch('https://openrouter.ai/api/v1/activity', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`OpenRouter usage API returned ${res.status}: ${await res.text()}`);
  }

  const body = (await res.json()) as OpenRouterActivityResponse;
  let count = 0;

  for (const item of body.data) {
    await upsertRecord({
      source: 'activity',
      model: item.model ?? item.model_permaslug,
      requestCount: item.requests,
      tokensIn: item.prompt_tokens,
      tokensOut: item.completion_tokens,
      reasoningTokens: item.reasoning_tokens,
      cachedTokens: item.cached_tokens,
      cacheWriteTokens: item.cache_write_tokens,
      audioTokens: item.audio_tokens,
      costUsd: toCostString(item.cost ?? item.usage),
      upstreamInferenceCostUsd: toCostString(item.byok_usage_inference),
      recordedAt: new Date(item.date),
    });
    count++;
  }

  return count;
}

function toCostString(value: number | undefined): string | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(6) : undefined;
}
