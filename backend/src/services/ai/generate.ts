import type { AiSelectionMetadata, AiWorkload } from './types.js';
import { upsertRecord } from '../../db/api/usage.js';
import { generateWithAnthropic } from './providers/anthropic.js';
import { generateWithOpenRouter } from './providers/openrouter.js';
import { selectModelForWorkload } from './select-model.js';

export interface GenerateTextParams {
  feature: string;
  workload: AiWorkload;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateTextResult extends AiSelectionMetadata {
  text: string;
}

interface ProviderCallResult {
  text: string;
  usageRecord?: Parameters<typeof upsertRecord>[0];
}

async function callProvider(
  provider: AiSelectionMetadata['provider'],
  model: string,
  prompt: string,
  options: { maxTokens?: number; temperature?: number },
): Promise<ProviderCallResult> {
  if (provider === 'openrouter') {
    const result = await generateWithOpenRouter({
      model,
      prompt,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });
    return {
      text: result.text,
      usageRecord: result.usage,
    };
  }
  if (provider === 'anthropic') {
    const text = await generateWithAnthropic({
      model,
      prompt,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });
    return { text };
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}

export async function generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
  const selection = selectModelForWorkload(params.workload);

  try {
    const result = await callProvider(selection.primary.provider, selection.primary.model, params.prompt, {
      maxTokens: params.maxTokens,
      temperature: params.temperature,
    });
    await persistUsage(result.usageRecord);
    console.info(
      `[ai] feature=${params.feature} workload=${params.workload} provider=${selection.primary.provider} model=${selection.primary.model} fallbackUsed=false`,
    );
    return {
      text: result.text,
      provider: selection.primary.provider,
      model: selection.primary.model,
      workload: params.workload,
      fallbackUsed: false,
    };
  } catch (err) {
    if (!selection.fallback || selection.fallback.id === selection.primary.id) {
      throw err;
    }

    console.warn(
      `[ai] feature=${params.feature} workload=${params.workload} primaryProvider=${selection.primary.provider} primaryModel=${selection.primary.model} primaryFailed=true error="${err instanceof Error ? err.message : String(err)}"`,
    );

    const result = await callProvider(
      selection.fallback.provider,
      selection.fallback.model,
      params.prompt,
      {
        maxTokens: params.maxTokens,
        temperature: params.temperature,
      },
    );
    await persistUsage(result.usageRecord);

    console.info(
      `[ai] feature=${params.feature} workload=${params.workload} provider=${selection.fallback.provider} model=${selection.fallback.model} fallbackUsed=true`,
    );
    return {
      text: result.text,
      provider: selection.fallback.provider,
      model: selection.fallback.model,
      workload: params.workload,
      fallbackUsed: true,
    };
  }
}

async function persistUsage(record: Parameters<typeof upsertRecord>[0] | undefined) {
  if (!record) return;
  await upsertRecord(record);
}

