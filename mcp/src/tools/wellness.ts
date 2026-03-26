import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet, apiPost, apiPatch, apiDelete } from '../client.js';
import { omitNullValues } from './sanitize.js';
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
    'Log a meal or snack with nutritional details.\n\nRequired: `mealType`, `description`.\nOptional: `loggedAt`, `date`, nutrition fields (`calories`, `protein`, `carbs`, `fat`), `notes`.\nIf ALL nutrition fields are omitted, nutrition is auto-estimated from `description`.\nIf you provide ANY nutrition field, auto-estimation is skipped.\nIf `loggedAt`/`date` are omitted, they default to now/today.',
    {
      mealType: z
        .enum(['breakfast', 'lunch', 'dinner', 'snack'])
        .describe('Meal type: `breakfast`, `lunch`, `dinner`, or `snack` (required).'),
      description: z
        .string()
        .describe('What was eaten (required), e.g. "Chicken salad with avocado".'),
      loggedAt: z
        .string()
        .optional()
        .describe('ISO datetime of the meal (default: now).'),
      date: z.string().optional().describe('Date YYYY-MM-DD (default: today).'),
      calories: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('Calories (kcal) as a non-negative integer (0 is allowed). Omit to allow nutrition auto-estimation.'),
      protein: z
        .coerce.number()
        .min(0)
        .optional()
        .nullable()
        .describe('Protein grams as a non-negative number (e.g. 35). Omit to allow nutrition auto-estimation.'),
      carbs: z
        .coerce.number()
        .min(0)
        .optional()
        .nullable()
        .describe('Carbohydrates grams as a non-negative number (e.g. 45). Omit to allow nutrition auto-estimation.'),
      fat: z
        .coerce.number()
        .min(0)
        .optional()
        .nullable()
        .describe('Fat grams as a non-negative number (e.g. 20). Omit to allow nutrition auto-estimation.'),
      notes: z.string().optional().describe('Any additional notes (optional).'),
    },
    async ({ mealType, description, loggedAt, date, calories, protein, carbs, fat, notes }) => {
      const now = new Date();
      // Treat `null` the same as "not provided" to avoid sending nulls downstream.
      const shouldEstimate = calories == null && protein == null && carbs == null && fat == null;

      const estimate = shouldEstimate
        ? await apiPost<NutritionEstimate>('/api/health/food/estimate', {
            description: description.trim(),
          })
        : null;

      const payload = omitNullValues({
        mealType,
        description,
        loggedAt: loggedAt ?? now.toISOString(),
        date: date ?? now.toISOString().slice(0, 10),
        calories: calories ?? estimate?.calories ?? null,
        protein: protein ?? estimate?.protein ?? null,
        carbs: carbs ?? estimate?.carbs ?? null,
        fat: fat ?? estimate?.fat ?? null,
        notes: notes ?? null,
      });
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
    'quick_log_food',
    'Log food from free text only. The server infers `mealType`, `loggedAt`, `date`, and macros using the same AI stack as other wellness features.\n\nRequired: `text` — what you ate; you may add natural-language time hints (e.g. "yesterday evening", "this morning").',
    {
      text: z
        .string()
        .min(1)
        .describe('Free-form text describing the meal and optionally when it was eaten.'),
    },
    async ({ text }) => {
      const log = await apiPost<FoodLog>('/api/health/food/quick', { text });
      return {
        content: [{ type: 'text', text: `Food logged (quick).\n\n${JSON.stringify(log, null, 2)}` }],
      };
    },
  );

  server.tool(
    'list_food_logs',
    'List food logs filtered by date or date range.\n\nOptional: `date` OR (`from`, `to`). If omitted, returns all available food logs.',
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

  server.tool(
    'delete_food_log',
    'Delete a food log by ID. Use `list_food_logs` first to find the UUID.',
    {
      id: z.string().uuid().describe('Food log UUID'),
    },
    async ({ id }) => {
      await apiDelete(`/api/health/food/${id}`);
      return {
        content: [{ type: 'text', text: `Food log deleted (id: ${id}).` }],
      };
    },
  );

  // ─── Cannabis ──────────────────────────────────────────────────────────────

  server.tool(
    'log_cannabis_session',
    'Log a cannabis/marijuana session.\n\nRequired: `form`.\nOptional: `sessionAt` (ISO datetime), `date` (YYYY-MM-DD), `strain`, `amount`, `unit`, `notes`.\nIf `sessionAt` is omitted, it defaults to now.\nProvide an accurate `sessionAt` for sleep-correlation analysis.',
    {
      form: z
        .enum(['flower', 'vape', 'edible', 'tincture', 'other'])
        .describe('Consumption method (required): `flower`, `vape`, `edible`, `tincture`, or `other`.'),
      sessionAt: z
        .string()
        .optional()
        .describe('ISO datetime of the session (default: now). Be precise for sleep correlation.'),
      date: z.string().optional().describe('Date YYYY-MM-DD (default: today).'),
      strain: z.string().optional().describe('Strain name if known'),
      amount: z.string().optional().describe('Amount consumed as a numeric string (optional)'),
      unit: z
        .string()
        .optional()
        .describe('Unit: `hits`, `g`, `mg`, or `ml` (optional)'),
      notes: z.string().optional().describe('Any notes'),
    },
    async ({ form, sessionAt, date, strain, amount, unit, notes }) => {
      const now = new Date();
      const payload = omitNullValues({
        form,
        sessionAt: sessionAt ?? now.toISOString(),
        date: date ?? now.toISOString().slice(0, 10),
        strain: strain ?? null,
        amount: amount ?? null,
        unit: unit ?? null,
        notes: notes ?? null,
      });
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
    'List cannabis sessions filtered by date or date range.\n\nOptional: `date` OR (`from`, `to`). If omitted, returns all sessions.',
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
    'Log a sleep session.\n\nRequired: `bedTime`.\nOptional: `wakeTime` (omit if still asleep), `qualityScore` (1-5), `date`, `notes`.\nIf `wakeTime` is omitted, the log is treated as still asleep.\nIf `date` is omitted, it defaults to today.',
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
      date: z
        .string()
        .optional()
        .describe("Date YYYY-MM-DD (night's date, default: today)"),
      notes: z.string().optional().describe('Any notes about sleep'),
    },
    async ({ bedTime, wakeTime, qualityScore, date, notes }) => {
      const payload = omitNullValues({
        bedTime,
        wakeTime: wakeTime ?? null,
        qualityScore: qualityScore ?? null,
        notes: notes ?? null,
        date: date ?? new Date().toISOString().slice(0, 10),
      });
      const log = await apiPost<SleepLog>('/api/health/sleep', payload);
      return {
        content: [{ type: 'text', text: `Sleep logged.\n\n${JSON.stringify(log, null, 2)}` }],
      };
    },
  );

  server.tool(
    'update_sleep_log',
    'Update an existing sleep log (e.g. add `wakeTime` and/or `qualityScore` after waking up).\n\nRequired: `id` (UUID). Call `list_sleep_logs` first to find it.',
    {
      id: z.string().uuid().describe('Sleep log UUID'),
      wakeTime: z.string().optional().describe('ISO datetime wake time'),
      qualityScore: z.number().int().min(1).max(5).optional().describe('Quality score 1–5'),
      notes: z.string().optional().describe('Notes'),
    },
    async ({ id, wakeTime, qualityScore, notes }) => {
      const data: Record<string, unknown> = {};
      if (wakeTime != null) data['wakeTime'] = wakeTime;
      if (qualityScore != null) data['qualityScore'] = qualityScore;
      if (notes != null) data['notes'] = notes;
      const log = await apiPatch<SleepLog>(`/api/health/sleep/${id}`, data);
      return {
        content: [{ type: 'text', text: `Sleep log updated.\n\n${JSON.stringify(log, null, 2)}` }],
      };
    },
  );

  server.tool(
    'list_sleep_logs',
    'List sleep logs for a date range.\n\nOptional: `from` (default: 7 days ago) and `to` (default: today).',
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
    'Run goal-driven AI insights on the last 30 days of wellness data.\n\nRequired: `goal` (free-form text). Optional: `goals` (additional goals; first item should still be the main goal).',
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
