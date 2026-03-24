import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  date,
  jsonb,
} from 'drizzle-orm/pg-core';

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  device: text('device'),
  ip: text('ip'),
  apiKeyHash: text('api_key_hash').notNull(),
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
  agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const usageRecords = pgTable('usage_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  apiKeyLabel: text('api_key_label'),
  model: text('model'),
  tokensIn: integer('tokens_in'),
  tokensOut: integer('tokens_out'),
  costUsd: numeric('cost_usd', { precision: 10, scale: 6 }),
  recordedAt: timestamp('recorded_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
