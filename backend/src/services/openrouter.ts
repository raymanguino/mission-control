import { upsertRecord } from '../db/api/usage.js';

interface OpenRouterUsageItem {
  id: string;
  label?: string;
  model?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number;
  created_at: string;
}

interface OpenRouterUsageResponse {
  data: OpenRouterUsageItem[];
}

export async function syncOpenRouterUsage(): Promise<number> {
  const apiKey = process.env['OPENROUTER_API_KEY'];
  if (!apiKey) {
    console.warn('[openrouter] OPENROUTER_API_KEY not set, skipping sync');
    return 0;
  }

  const res = await fetch('https://openrouter.ai/api/v1/credits/usage', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`OpenRouter usage API returned ${res.status}: ${await res.text()}`);
  }

  const body = (await res.json()) as OpenRouterUsageResponse;
  let count = 0;

  for (const item of body.data) {
    await upsertRecord({
      apiKeyLabel: item.label,
      model: item.model,
      tokensIn: item.prompt_tokens,
      tokensOut: item.completion_tokens,
      costUsd: item.cost != null ? String(item.cost) : undefined,
      recordedAt: new Date(item.created_at),
    });
    count++;
  }

  return count;
}
