// Agent types
export type AgentStatus = 'online' | 'idle' | 'offline';

export interface Agent {
  id: string;
  name: string;
  device: string | null;
  ip: string | null;
  lastSeen: string | null;
  status: AgentStatus;
  createdAt: string;
}

export interface AgentActivity {
  id: string;
  agentId: string;
  type: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AgentReportBody {
  type: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

// Project types
export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'backlog' | 'doing' | 'review' | 'done';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignedAgentId: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// Health types
export type GoalType = 'diet' | 'exercise' | 'sleep' | 'other';
export type GoalFrequency = 'daily' | 'weekly';

export interface HealthGoal {
  id: string;
  name: string;
  type: GoalType;
  target: string;
  unit: string;
  frequency: GoalFrequency;
  createdAt: string;
}

export interface HealthEntry {
  id: string;
  goalId: string;
  value: string;
  notes: string | null;
  date: string;
  createdAt: string;
}

// Chat types
export interface Channel {
  id: string;
  name: string;
  source: string;
  externalId: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  channelId: string;
  author: string;
  content: string;
  agentId: string | null;
  createdAt: string;
}

// Usage types
export interface UsageRecord {
  id: string;
  agentId: string | null;
  apiKeyLabel: string | null;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: string | null;
  recordedAt: string;
  createdAt: string;
}

export interface UsageSummary {
  totalCostUsd: string;
  totalTokensIn: number;
  totalTokensOut: number;
  groups: UsageGroup[];
}

export interface UsageGroup {
  key: string;
  costUsd: string;
  tokensIn: number;
  tokensOut: number;
}

// Pagination
export interface Paginated<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
