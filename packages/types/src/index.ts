// Agent types
export type AgentStatus = 'online' | 'idle' | 'offline';
export type AgentOrgRole = 'chief_of_staff' | 'member';

export interface Agent {
  id: string;
  name: string;
  device: string | null;
  ip: string | null;
  orgRole: AgentOrgRole;
  strengths: string | null;
  reportsToAgentId: string | null;
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
  status?: AgentStatus;
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

export type IntentStatus = 'open' | 'converted' | 'cancelled';

export interface Intent {
  id: string;
  title: string;
  body: string;
  status: IntentStatus;
  createdProjectId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Wellness tracking types
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type CannabisFom = 'flower' | 'vape' | 'edible' | 'tincture' | 'other';

export interface FoodLog {
  id: string;
  mealType: MealType;
  description: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  loggedAt: string;
  date: string;
  notes: string | null;
  createdAt: string;
}

export interface MarijuanaSession {
  id: string;
  form: CannabisFom;
  strain: string | null;
  amount: string | null;
  unit: string | null;
  notes: string | null;
  sessionAt: string;
  date: string;
  createdAt: string;
}

export interface SleepLog {
  id: string;
  bedTime: string;
  wakeTime: string | null;
  qualityScore: number | null;
  notes: string | null;
  date: string;
  createdAt: string;
}

export type AiProvider = 'openrouter' | 'anthropic' | 'system';
export type AiWorkload = 'cheap_extract' | 'balanced_analysis' | 'fast_interactive' | 'high_reasoning';

export interface AiSelectionMetadata {
  provider: AiProvider;
  model: string;
  workload: AiWorkload;
  fallbackUsed?: boolean;
}

export interface HealthAnalysis {
  insights: string;
  generatedAt: string;
  goal?: string;
  provider?: AiProvider;
  model?: string;
  workload?: AiWorkload;
  fallbackUsed?: boolean;
}

export interface HealthAnalysisRequest {
  goal: string;
  goals?: string[];
}

export interface NutritionEstimate extends AiSelectionMetadata {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: 'llm';
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
  source: string;
  providerRequestId: string | null;
  model: string | null;
  requestCount: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  reasoningTokens: number | null;
  cachedTokens: number | null;
  cacheWriteTokens: number | null;
  audioTokens: number | null;
  costUsd: string | null;
  upstreamInferenceCostUsd: string | null;
  recordedAt: string;
  createdAt: string;
}

export interface UsageSummary {
  totalCostUsd: string;
  totalUpstreamInferenceCostUsd: string;
  totalRequests: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalReasoningTokens: number;
  totalCachedTokens: number;
  totalCacheWriteTokens: number;
  totalAudioTokens: number;
  groups: UsageGroup[];
}

export interface UsageGroup {
  key: string | null;
  requestCount: number;
  costUsd: string;
  upstreamInferenceCostUsd: string;
  tokensIn: number;
  tokensOut: number;
  reasoningTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  audioTokens: number;
}

// Pagination
export interface Paginated<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// API error envelope
export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_FAILED'
  | 'INTERNAL_ERROR'
  | (string & {});

export interface ApiErrorBody {
  message: string;
  code: ApiErrorCode;
  details?: unknown;
}

export interface ErrorEnvelope {
  error: ApiErrorBody;
}
