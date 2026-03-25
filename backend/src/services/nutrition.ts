import Anthropic from '@anthropic-ai/sdk';

export interface NutritionEstimate {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: 'llm';
}

function toOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function sanitizeEstimate(raw: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}): Omit<NutritionEstimate, 'source'> {
  return {
    calories: Math.round(clampNonNegative(raw.calories)),
    protein: toOneDecimal(clampNonNegative(raw.protein)),
    carbs: toOneDecimal(clampNonNegative(raw.carbs)),
    fat: toOneDecimal(clampNonNegative(raw.fat)),
  };
}

function parseFallbackJson(text: string): Omit<NutritionEstimate, 'source'> | null {
  const trimmed = text.trim();
  const rawMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!rawMatch) return null;

  try {
    const parsed = JSON.parse(rawMatch[0]) as Partial<Record<'calories' | 'protein' | 'carbs' | 'fat', unknown>>;
    const calories = Number(parsed.calories);
    const protein = Number(parsed.protein);
    const carbs = Number(parsed.carbs);
    const fat = Number(parsed.fat);
    if (![calories, protein, carbs, fat].every((n) => Number.isFinite(n))) return null;
    return sanitizeEstimate({ calories, protein, carbs, fat });
  } catch {
    return null;
  }
}

async function estimateFromLlm(description: string, apiKeyOverride?: string): Promise<NutritionEstimate> {
  const apiKey = apiKeyOverride ?? process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    throw new Error('Nutrition estimation unavailable: missing OPENAI_API_KEY');
  }

  const prompt = `Estimate the nutrition macros for this meal description.

Description: "${description}"

Return ONLY strict JSON with keys:
{
  "calories": <number>,
  "protein": <number>,
  "carbs": <number>,
  "fat": <number>
}

Rules:
- Use realistic values for one eating occasion unless quantity suggests otherwise.
- Never return negative values.
- No extra keys, no markdown.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env['OPENAI_MODEL'] ?? 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI nutrition API returned ${res.status}: ${errorText}`);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  const text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content
            .filter((p) => p.type === 'text' && typeof p.text === 'string')
            .map((p) => p.text)
            .join('\n')
        : '';

  const parsed = parseFallbackJson(text);
  if (!parsed) {
    throw new Error('Failed to parse OpenAI nutrition estimate');
  }

  return { ...parsed, source: 'llm' };
}

async function estimateFromAnthropic(description: string): Promise<NutritionEstimate> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    throw new Error('Nutrition estimation unavailable: missing ANTHROPIC_API_KEY');
  }

  const client = new Anthropic({ apiKey });
  const prompt = `Estimate the nutrition macros for this meal description.

Description: "${description}"

Return ONLY strict JSON with keys:
{
  "calories": <number>,
  "protein": <number>,
  "carbs": <number>,
  "fat": <number>
}

Rules:
- Use realistic values for one eating occasion unless quantity suggests otherwise.
- Never return negative values.
- No extra keys, no markdown.`;

  let response: Awaited<ReturnType<typeof client.messages.create>>;
  try {
    response = await client.messages.create({
      model: process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-6',
      max_tokens: 300,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (err) {
    throw err;
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  const parsed = parseFallbackJson(text);
  if (!parsed) {
    throw new Error('Failed to parse Anthropic nutrition estimate');
  }

  return { ...parsed, source: 'llm' };
}

export async function estimateNutrition(description: string): Promise<NutritionEstimate> {
  const openAiKeyFromEnv = process.env['OPENAI_API_KEY'];
  const openRouterKey = process.env['OPENROUTER_API_KEY'];
  const openAiCompatibleFallback =
    !openAiKeyFromEnv && openRouterKey?.startsWith('sk-proj-') ? openRouterKey : undefined;
  const effectiveOpenAiKey = openAiKeyFromEnv ?? openAiCompatibleFallback;

  if (effectiveOpenAiKey) {
    return estimateFromLlm(description, effectiveOpenAiKey);
  }

  if (process.env['ANTHROPIC_API_KEY']) {
    return estimateFromAnthropic(description);
  }

  throw new Error('Nutrition estimation unavailable: missing OPENAI_API_KEY and ANTHROPIC_API_KEY');
}
