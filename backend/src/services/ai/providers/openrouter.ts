interface OpenRouterMessage {
  role: 'user';
  content: string;
}

interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
    cache_write_tokens?: number;
    audio_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
    audio_tokens?: number;
  };
  cost?: number;
  cost_details?: {
    upstream_inference_cost?: number;
  };
}

interface OpenRouterResponse {
  id?: string;
  created?: number;
  model?: string;
  usage?: OpenRouterUsage;
  choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
}

export interface OpenRouterGenerationResult {
  text: string;
  usage?: {
    source: 'live';
    providerRequestId?: string;
    model?: string;
    requestCount: number;
    tokensIn?: number;
    tokensOut?: number;
    reasoningTokens?: number;
    cachedTokens?: number;
    cacheWriteTokens?: number;
    audioTokens?: number;
    costUsd?: string;
    upstreamInferenceCostUsd?: string;
    recordedAt: Date;
  };
}

export async function generateWithOpenRouter(params: {
  model: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<OpenRouterGenerationResult> {
  const apiKey = process.env['OPENROUTER_API_KEY'];
  if (!apiKey) {
    throw new Error('OpenRouter provider unavailable: missing OPENROUTER_API_KEY');
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(process.env['OPENROUTER_HTTP_REFERER']
        ? { 'HTTP-Referer': process.env['OPENROUTER_HTTP_REFERER'] }
        : {}),
      ...(process.env['OPENROUTER_APP_TITLE']
        ? { 'X-OpenRouter-Title': process.env['OPENROUTER_APP_TITLE'] }
        : {}),
    },
    body: JSON.stringify({
      model: params.model,
      messages: [{ role: 'user', content: params.prompt } satisfies OpenRouterMessage],
      max_tokens: params.maxTokens ?? 1200,
      temperature: params.temperature ?? 0.2,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter API returned ${res.status}: ${await res.text()}`);
  }

  const body = (await res.json()) as OpenRouterResponse;
  const content = body.choices?.[0]?.message?.content;
  const text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content
            .filter((part) => part.type === 'text' && typeof part.text === 'string')
            .map((part) => part.text)
            .join('\n')
        : '';

  const promptAudioTokens = body.usage?.prompt_tokens_details?.audio_tokens;
  const completionAudioTokens = body.usage?.completion_tokens_details?.audio_tokens;

  return {
    text,
    usage: body.usage
      ? {
          source: 'live',
          providerRequestId: body.id,
          model: body.model ?? params.model,
          requestCount: 1,
          tokensIn: body.usage.prompt_tokens,
          tokensOut: body.usage.completion_tokens,
          reasoningTokens: body.usage.completion_tokens_details?.reasoning_tokens,
          cachedTokens: body.usage.prompt_tokens_details?.cached_tokens,
          cacheWriteTokens: body.usage.prompt_tokens_details?.cache_write_tokens,
          audioTokens: sumNumbers(promptAudioTokens, completionAudioTokens),
          costUsd: toCostString(body.usage.cost),
          upstreamInferenceCostUsd: toCostString(body.usage.cost_details?.upstream_inference_cost),
          recordedAt: body.created ? new Date(body.created * 1000) : new Date(),
        }
      : undefined,
  };
}

function toCostString(value: number | undefined): string | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(6) : undefined;
}

function sumNumbers(...values: Array<number | undefined>): number | undefined {
  const total = values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  return total > 0 ? total : undefined;
}

