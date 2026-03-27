import { generateText } from './ai/generate.js';
import * as wellnessDb from '../db/api/wellness.js';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type MealType = (typeof MEAL_TYPES)[number];

const MAX_QUICK_TEXT = 4000;

function toOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function mealTypeFromHourUtc(h: number): MealType {
  if (h >= 5 && h < 11) return 'breakfast';
  if (h >= 11 && h < 14) return 'lunch';
  if (h >= 14 && h < 17) return 'snack';
  if (h >= 17 && h < 22) return 'dinner';
  return 'snack';
}

function coerceMealType(raw: unknown, loggedAt: Date): MealType {
  if (typeof raw === 'string' && (MEAL_TYPES as readonly string[]).includes(raw)) {
    return raw as MealType;
  }
  return mealTypeFromHourUtc(loggedAt.getUTCHours());
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const rawMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!rawMatch) return null;
  try {
    return JSON.parse(rawMatch[0]);
  } catch {
    return null;
  }
}

/**
 * Parses free-text food log, infers meal type + time + macros via LLM, then persists a food log.
 */
export async function createFoodLogFromQuickText(rawText: string, referenceNow: Date = new Date()) {
  const text = rawText.trim();
  if (!text.length) {
    throw new Error('Text is required');
  }
  if (text.length > MAX_QUICK_TEXT) {
    throw new Error(`Text must be at most ${MAX_QUICK_TEXT} characters`);
  }

  const refIso = referenceNow.toISOString();
  const userBlock = JSON.stringify(text);
  const prompt = `You interpret a quick free-text food log. Infer what was eaten, when it was eaten, meal category, and plausible macros.

Server reference instant (ISO UTC): ${refIso}

User text (verbatim JSON string): ${userBlock}

Return ONLY strict JSON with keys:
{
  "mealType": "breakfast" | "lunch" | "dinner" | "snack",
  "loggedAt": "<ISO 8601 instant, prefer UTC with Z suffix>",
  "description": "<concise description of the food only; omit time-of-day chatter>",
  "calories": <number>,
  "protein": <number>,
  "carbs": <number>,
  "fat": <number>
}

Rules:
- If the user gives no time or date, set loggedAt to the reference instant and pick mealType from that time of day (or from obvious cues like "breakfast" in text).
- If they say yesterday, last night, this morning, etc., adjust loggedAt relative to the reference instant (assume reference is "now" in the user's intent).
- description must be suitable as a meal label (food items and rough quantity), not a repeat of timing instructions.
- Macros: realistic for one eating occasion; all non-negative; calories is an integer kcal; protein/carbs/fat are grams with one decimal at most.
- No markdown, no extra keys.`;

  const generated = await generateText({
    feature: 'wellness.quick_food_log',
    workload: 'cheap_extract',
    prompt,
    maxTokens: 600,
    temperature: 0.2,
  });

  const parsed = parseJsonObject(generated.text);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(
      `Failed to parse quick food log JSON from ${generated.provider}/${generated.model}`,
    );
  }

  const obj = parsed as Record<string, unknown>;
  const loggedAtRaw = obj['loggedAt'];
  let loggedAt: Date;
  if (typeof loggedAtRaw === 'string') {
    const d = new Date(loggedAtRaw);
    loggedAt = Number.isFinite(d.getTime()) ? d : referenceNow;
  } else {
    loggedAt = referenceNow;
  }

  const mealType = coerceMealType(obj['mealType'], loggedAt);
  const description =
    typeof obj['description'] === 'string' && obj['description'].trim().length > 0
      ? obj['description'].trim()
      : text;

  const calories = Math.round(clampNonNegative(Number(obj['calories'])));
  const protein = toOneDecimal(clampNonNegative(Number(obj['protein'])));
  const carbs = toOneDecimal(clampNonNegative(Number(obj['carbs'])));
  const fat = toOneDecimal(clampNonNegative(Number(obj['fat'])));

  if (![obj['calories'], obj['protein'], obj['carbs'], obj['fat']].every((v) => Number.isFinite(Number(v)))) {
    throw new Error(`Invalid macro numbers in quick food log from ${generated.provider}/${generated.model}`);
  }

  const date = loggedAt.toISOString().slice(0, 10);

  const log = await wellnessDb.createFoodLog({
    mealType,
    description,
    calories,
    protein,
    carbs,
    fat,
    loggedAt,
    date,
    notes: null,
  });

  return log;
}
