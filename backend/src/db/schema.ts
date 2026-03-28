import {
  pgTable,
  type AnyPgColumn,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  date,
  jsonb,
  smallint,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email'),
  device: text('device'),
  ip: text('ip'),
  apiKeyHash: text('api_key_hash').notNull(),
  orgRole: text('org_role').notNull().default('member'),
  specialization: text('specialization'),
  description: text('description'),
  reportsToAgentId: uuid('reports_to_agent_id').references((): AnyPgColumn => agents.id, {
    onDelete: 'set null',
  }),
  lastSeen: timestamp('last_seen'),
  status: text('status').notNull().default('offline'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const agentActivities = pgTable('agent_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  description: text('description'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('backlog'),
  assignedAgentId: uuid('assigned_agent_id').references(() => agents.id, {
    onDelete: 'set null',
  }),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const intents = pgTable('intents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  status: text('status').notNull().default('open'),
  createdProjectId: uuid('created_project_id').references(() => projects.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const healthGoals = pgTable('health_goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  target: numeric('target').notNull(),
  unit: text('unit').notNull(),
  frequency: text('frequency').notNull().default('daily'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const healthEntries = pgTable('health_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  goalId: uuid('goal_id')
    .notNull()
    .references(() => healthGoals.id, { onDelete: 'cascade' }),
  value: numeric('value').notNull(),
  notes: text('notes'),
  date: date('date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const channels = pgTable('channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  source: text('source').notNull().default('manual'),
  externalId: text('external_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id')
    .notNull()
    .references(() => channels.id, { onDelete: 'cascade' }),
  author: text('author').notNull(),
  content: text('content').notNull(),
  /** True when the row was created by the Mission Control API (dashboard/MCP), not synced from Discord. */
  fromMissionControl: boolean('from_mission_control').notNull().default(false),
  agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  source: text('source').notNull().default('manual'),
  externalMessageId: text('external_message_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  externalMessageIdUnique: uniqueIndex('messages_external_message_id_idx').on(table.externalMessageId),
}));

export const usageRecords = pgTable('usage_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  apiKeyLabel: text('api_key_label'),
  source: text('source').notNull().default('activity'),
  providerRequestId: text('provider_request_id'),
  model: text('model'),
  requestCount: integer('request_count'),
  tokensIn: integer('tokens_in'),
  tokensOut: integer('tokens_out'),
  reasoningTokens: integer('reasoning_tokens'),
  cachedTokens: integer('cached_tokens'),
  cacheWriteTokens: integer('cache_write_tokens'),
  audioTokens: integer('audio_tokens'),
  costUsd: numeric('cost_usd', { precision: 10, scale: 6 }),
  upstreamInferenceCostUsd: numeric('upstream_inference_cost_usd', { precision: 10, scale: 6 }),
  recordedAt: timestamp('recorded_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Wellness tracking tables

export const foodLogs = pgTable('food_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  mealType: text('meal_type').notNull(), // 'breakfast' | 'lunch' | 'dinner' | 'snack'
  description: text('description').notNull(),
  calories: integer('calories'),
  protein: numeric('protein', { precision: 6, scale: 1 }), // grams
  carbs: numeric('carbs', { precision: 6, scale: 1 }),     // grams
  fat: numeric('fat', { precision: 6, scale: 1 }),         // grams
  loggedAt: timestamp('logged_at').notNull(),               // actual time of meal
  date: date('date').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const marijuanaSessions = pgTable('marijuana_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  form: text('form').notNull(), // 'flower' | 'vape' | 'edible' | 'tincture' | 'other'
  strain: text('strain'),
  amount: numeric('amount', { precision: 6, scale: 2 }),
  unit: text('unit'),  // 'g' | 'mg' | 'hits' | 'ml'
  notes: text('notes'),
  sessionAt: timestamp('session_at').notNull(), // key field for time-of-day correlation
  date: date('date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const sleepLogs = pgTable('sleep_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  bedTime: timestamp('bed_time').notNull(),
  wakeTime: timestamp('wake_time'),          // nullable until they wake up
  qualityScore: smallint('quality_score'),   // 1–5
  notes: text('notes'),
  date: date('date').notNull(),              // the night's date (date you went to bed)
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scope: text('scope').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    method: text('method').notNull(),
    path: text('path').notNull(),
    requestHash: text('request_hash').notNull(),
    statusCode: integer('status_code'),
    responseBody: jsonb('response_body'),
    state: text('state').notNull().default('in_progress'),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    uniqueScopeKey: uniqueIndex('idempotency_keys_scope_key_method_path_idx').on(
      table.scope,
      table.idempotencyKey,
      table.method,
      table.path,
    ),
    expiresAtIdx: index('idempotency_keys_expires_at_idx').on(table.expiresAt),
  }),
);
