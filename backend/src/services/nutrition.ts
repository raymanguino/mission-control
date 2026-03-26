import { generateText } from './ai/generate.js';

export interface NutritionEstimate {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: 'llm';
  provider: 'openrouter' | 'anthropic' | 'system';
  model: string;
  workload: 'cheap_extract' | 'balanced_analysis' | 'fast_interactive' | 'high_reasoning';
  fallbackUsed?: boolean;
}

type ParsedNutritionEstimate = Omit<
  NutritionEstimate,
  'source' | 'provider' | 'model' | 'workload' | 'fallbackUsed'
>;

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
}): ParsedNutritionEstimate {
  return {
    calories: Math.round(clampNonNegative(raw.calories)),
    protein: toOneDecimal(clampNonNegative(raw.protein)),
    carbs: toOneDecimal(clampNonNegative(raw.carbs)),
    fat: toOneDecimal(clampNonNegative(raw.fat)),
  };
}

function parseFallbackJson(text: string): ParsedNutritionEstimate | null {
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

async function estimateFromLlm(description: string): Promise<NutritionEstimate> {
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

  const generated = await generateText({
    feature: 'wellness.nutrition',
    workload: 'cheap_extract',
    prompt,
    maxTokens: 300,
    temperature: 0.2,
  });

  const parsed = parseFallbackJson(generated.text);
  if (!parsed) {
    throw new Error(`Failed to parse nutrition estimate from ${generated.provider}/${generated.model}`);
  }

  return {
    ...parsed,
    source: 'llm',
    provider: generated.provider,
    model: generated.model,
    workload: generated.workload,
    fallbackUsed: generated.fallbackUsed,
  };
}

export async function estimateNutrition(description: string): Promise<NutritionEstimate> {
  return estimateFromLlm(description);
}
