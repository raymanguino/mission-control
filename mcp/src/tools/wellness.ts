import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet, apiPost, apiPatch } from '../client.js';
import type {
  FoodLog,
  MarijuanaSession,
  SleepLog,
  HealthAnalysis,
  NutritionEstimate,
} from '@mission-control/types';

export function registerWellnessTools(server: McpServer) {
  // ─── Food ──────────────────────────────────────────────────────────────────

  server.tool(
    'log_food',
    'Log a meal or snack with optional nutritional info. Use this when the user reports eating something.',
    {
      mealType: z
        .enum(['breakfast', 'lunch', 'dinner', 'snack'])
        .describe('Type of meal'),
      description: z.string().describe('What was eaten, e.g. "Chicken salad with avocado"'),
      loggedAt: z
        .string()
        .optional()
        .describe('ISO datetime of the meal (default: now)'),
      date: z.string().optional().describe('Date YYYY-MM-DD (default: today)'),
      calories: z.number().int().positive().optional().describe('Calories (kcal)'),
      protein: z.string().optional().describe('Protein in grams'),
      carbs: z.string().optional().describe('Carbohydrates in grams'),
      fat: z.string().optional().describe('Fat in grams'),
      notes: z.string().optional().describe('Any additional notes'),
    },
    async ({ mealType, description, loggedAt, date, calories, protein, carbs, fat, notes }) => {
      const now = new Date();
      const shouldEstimate =
        calories === undefined && protein === undefined && carbs === undefined && fat === undefined;

      const estimate = shouldEstimate
        ? await apiPost<NutritionEstimate>('/api/health/food/estimate', {
            description: description.trim(),
          })
        : null;

      const payload = {
        mealType,
        description,
        loggedAt: loggedAt ?? now.toISOString(),
        date: date ?? now.toISOString().slice(0, 10),
        calories: calories ?? estimate?.calories ?? null,
        protein: protein ?? (estimate ? String(estimate.protein) : null),
        carbs: carbs ?? (estimate ? String(estimate.carbs) : null),
        fat: fat ?? (estimate ? String(estimate.fat) : null),
        notes: notes ?? null,
      };
      const log = await apiPost<FoodLog>('/api/health/food', payload);
      const autoEstimateNote = estimate
        ? `\n\n(nutrition auto-estimated via ${estimate.provider}/${estimate.model})`
        : '';
      return {
        content: [{ type: 'text', text: `Food logged.${autoEstimateNote}\n\n${JSON.stringify(log, null, 2)}` }],
      };
    },
  );

  server.tool(
    'list_food_logs',
    'List food logs filtered by date or date range',
    {
      date: z.string().optional().describe('Single date YYYY-MM-DD'),
      from: z.string().optional().describe('Start date YYYY-MM-DD'),
      to: z.string().optional().describe('End date YYYY-MM-DD'),
    },
    async ({ date, from, to }) => {
      const params = new URLSearchParams();
      if (date) params.set('date', date);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const logs = await apiGet<FoodLog[]>(`/api/health/food?${params}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(logs, null, 2) }],
      };
    },
  );

  // ─── Cannabis ──────────────────────────────────────────────────────────────

  server.tool(
    'log_cannabis_session',
    'Log a cannabis/marijuana session with the exact time. The sessionAt timestamp is critical for sleep correlation analysis.',
    {
      form: z
        .enum(['flower', 'vape', 'edible', 'tincture', 'other'])
        .describe('Consumption method'),
      sessionAt: z
        .string()
        .optional()
        .describe('ISO datetime of the session (default: now). Be precise — this is used for sleep correlation.'),
      date: z.string().optional().describe('Date YYYY-MM-DD (default: today)'),
      strain: z.string().optional().describe('Strain name if known'),
      amount: z.string().optional().describe('Amount consumed as a numeric string'),
      unit: z
        .string()
        .optional()
        .describe('Unit: hits, g, mg, ml'),
      notes: z.string().optional().describe('Any notes'),
    },
    async ({ form, sessionAt, date, strain, amount, unit, notes }) => {
      const now = new Date();
      const payload = {
        form,
        sessionAt: sessionAt ?? now.toISOString(),
        date: date ?? now.toISOString().slice(0, 10),
        strain: strain ?? null,
        amount: amount ?? null,
        unit: unit ?? null,
        notes: notes ?? null,
      };
      const session = await apiPost<MarijuanaSession>('/api/health/marijuana', payload);
      return {
        content: [
          { type: 'text', text: `Session logged.\n\n${JSON.stringify(session, null, 2)}` },
        ],
      };
    },
  );

  server.tool(
    'list_cannabis_sessions',
    'List cannabis sessions filtered by date or date range',
    {
      date: z.string().optional().describe('Single date YYYY-MM-DD'),
      from: z.string().optional().describe('Start date YYYY-MM-DD'),
      to: z.string().optional().describe('End date YYYY-MM-DD'),
    },
    async ({ date, from, to }) => {
      const params = new URLSearchParams();
      if (date) params.set('date', date);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const sessions = await apiGet<MarijuanaSession[]>(`/api/health/marijuana?${params}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(sessions, null, 2) }],
      };
    },
  );

  // ─── Sleep ─────────────────────────────────────────────────────────────────

  server.tool(
    'log_sleep',
    'Log a sleep session with bed time and optional wake time and quality score. Call this when logging bedtime or when waking up.',
    {
      bedTime: z.string().describe('ISO datetime when the user went to bed'),
      wakeTime: z
        .string()
        .optional()
        .describe('ISO datetime when they woke up (omit if still asleep)'),
      qualityScore: z
        .number()
        .int()
        .min(1)
        .max(5)
        .optional()
        .describe('Subjective sleep quality 1 (terrible) to 5 (excellent)'),
      date: z.string().optional().describe("Date YYYY-MM-DD (the night's date, default: today)"),
      notes: z.string().optional().describe('Any notes about sleep'),
    },
    async ({ bedTime, wakeTime, qualityScore, date, notes }) => {
      const payload = {
        bedTime,
        wakeTime: wakeTime ?? null,
        qualityScore: qualityScore ?? null,
        notes: notes ?? null,
        date: date ?? new Date().toISOString().slice(0, 10),
      };
      const log = await apiPost<SleepLog>('/api/health/sleep', payload);
      return {
        content: [{ type: 'text', text: `Sleep logged.\n\n${JSON.stringify(log, null, 2)}` }],
      };
    },
  );

  server.tool(
    'update_sleep_log',
    'Update an existing sleep log — e.g. to add wake time or quality score after waking up. Call list_sleep_logs first to get the ID.',
    {
      id: z.string().uuid().describe('Sleep log UUID'),
      wakeTime: z.string().optional().describe('ISO datetime wake time'),
      qualityScore: z.number().int().min(1).max(5).optional().describe('Quality score 1–5'),
      notes: z.string().optional().describe('Notes'),
    },
    async ({ id, wakeTime, qualityScore, notes }) => {
      const data: Record<string, unknown> = {};
      if (wakeTime !== undefined) data['wakeTime'] = wakeTime;
      if (qualityScore !== undefined) data['qualityScore'] = qualityScore;
      if (notes !== undefined) data['notes'] = notes;
      const log = await apiPatch<SleepLog>(`/api/health/sleep/${id}`, data);
      return {
        content: [{ type: 'text', text: `Sleep log updated.\n\n${JSON.stringify(log, null, 2)}` }],
      };
    },
  );

  server.tool(
    'list_sleep_logs',
    'List sleep logs for a date range',
    {
      from: z.string().optional().describe('Start date YYYY-MM-DD (default: 7 days ago)'),
      to: z.string().optional().describe('End date YYYY-MM-DD (default: today)'),
    },
    async ({ from, to }) => {
      const defaultFrom = new Date();
      defaultFrom.setDate(defaultFrom.getDate() - 7);
      const params = new URLSearchParams({
        from: from ?? defaultFrom.toISOString().slice(0, 10),
        to: to ?? new Date().toISOString().slice(0, 10),
      });
      const logs = await apiGet<SleepLog[]>(`/api/health/sleep?${params}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(logs, null, 2) }],
      };
    },
  );

  // ─── Analysis ──────────────────────────────────────────────────────────────

  server.tool(
    'run_health_analysis',
    'Run goal-driven AI insights on the last 30 days of wellness data.',
    {
      goal: z
        .string()
        .describe('Primary analysis goal in free-form text, e.g. "Improve sleep quality by changing meal/cannabis timing"'),
      goals: z
        .array(z.string())
        .optional()
        .describe('Optional additional goals; first item should still be the main goal'),
    },
    async ({ goal, goals }) => {
      const result = await apiPost<HealthAnalysis>('/api/health/analysis', { goal, goals });
      return {
        content: [
          {
            type: 'text',
            text: `Wellness Insights (generated ${result.generatedAt})\nGoal: ${result.goal ?? goal}\nModel: ${result.provider ?? 'unknown'}/${result.model ?? 'unknown'}${result.fallbackUsed ? ' (fallback)' : ''}\n\n${result.insights}`,
          },
        ],
      };
    },
  );
}
