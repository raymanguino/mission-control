import { upsertRecord } from '../db/api/usage.js';

interface OpenRouterActivityItem {
  date: string;
  model: string;
  model_permaslug: string;
  endpoint_id: string;
  provider_name: string;
  usage: number;
  byok_usage_inference: number;
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens: number;
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
      model: item.model,
      tokensIn: item.prompt_tokens,
      tokensOut: item.completion_tokens,
      costUsd: String(item.usage),
      recordedAt: new Date(item.date),
    });
    count++;
  }

  return count;
}
