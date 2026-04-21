// Agent types
export type AgentStatus = 'online' | 'idle' | 'offline';
export type AgentOrgRole = 'chief_of_staff' | 'engineer' | 'qa';

/**
 * Engineer and QA roles (non–Chief of Staff). Playbook text is stored separately:
 * `agent_instructions` for engineers, `qa_instructions` for QA (see Settings).
 */
export const SHARED_AGENT_INSTRUCTION_ORG_ROLES: readonly AgentOrgRole[] = ['engineer', 'qa'];

/** Preset block-style avatars (filenames under `/avatars/{id}.svg`). */
export const AGENT_AVATAR_IDS = [
  'grass_block',
  'stone_block',
  'cobblestone',
  'oak_planks',
  'iron_ore',
  'gold_block',
  'diamond_block',
  'redstone_block',
  'creeper_face',
  'steve_face',
  'alex_face',
  'bee_face',
  'blaze_face',
  'drowned_face',
  'enderman_face',
  'herobrine_face',
  'pig_face',
  'skeleton_face',
  'spider_face',
  'villager_face',
  'zombie_face',
  'optimus_face',
  'spongebob_face',
] as const;

export type AgentAvatarId = (typeof AGENT_AVATAR_IDS)[number];

export const DEFAULT_AGENT_AVATAR_ID: AgentAvatarId = 'grass_block';

export function agentAvatarSrc(avatarId: string | null): string {
  const id =
    avatarId && (AGENT_AVATAR_IDS as readonly string[]).includes(avatarId)
      ? avatarId
      : DEFAULT_AGENT_AVATAR_ID;
  return `/avatars/${id}.svg`;
}

export interface Agent {
  id: string;
  name: string;
  email: string | null;
  specialization: string | null;
  description: string | null;
  device: string | null;
  model: string | null;
  orgRole: AgentOrgRole;
  reportsToAgentId: string | null;
  /** Selected preset id, or null to show the default sprite in the UI. */
  avatarId: string | null;
  lastSeen: string | null;
  /** ISO timestamp of last Mission Control–recorded activity used for presence (not from report). */
  lastActivityAt: string | null;
  status: AgentStatus;
  createdAt: string;
}

/** Settings keys for agent presence sweep (values are minutes as decimal strings). */
export const AGENT_PRESENCE_SETTING_KEYS = {
  activityStaleToIdleMinutes: 'agent_presence_activity_stale_to_idle_minutes',
  idleToOfflineMinutes: 'agent_presence_idle_to_offline_minutes',
} as const;

export const AGENT_PRESENCE_DEFAULTS = {
  activityStaleToIdleMinutes: 10,
  idleToOfflineMinutes: 10,
} as const;

/** Older installs may still have this key; treat like `activityStaleToIdleMinutes`. */
export const AGENT_PRESENCE_LEGACY_MCP_STALE_KEY = 'agent_presence_mcp_stale_to_idle_minutes';

export interface AgentActivity {
  id: string;
  agentId: string;
  type: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/** Activity row with agent display name (e.g. fleet-wide feed). */
export interface FleetActivityEntry extends AgentActivity {
  agentName: string;
}

export interface AgentReportBody {
  type: string;
  status?: AgentStatus;
  description?: string;
  metadata?: Record<string, unknown>;
}

// Project types
export type ProjectStatus = 'pending_approval' | 'approved' | 'denied';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  status: ProjectStatus;
  /** Agent id of the Chief of Staff who approved, if recorded. */
  approvedByAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'backlog' | 'doing' | 'review' | 'not_done' | 'done';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  /** Optional resolution notes (outcome / how it was closed). */
  resolution: string | null;
  status: TaskStatus;
  assignedAgentId: string | null;
  /** Set when moving Doing → Review; used when moving Review → Backlog to reassign the implementer. */
  implementerAgentId: string | null;
  order: number;
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
  discordUserId: string | null;
  content: string;
  /** True if created via Mission Control API (not ingested from Discord). */
  fromMissionControl: boolean;
  agentId: string | null;
  source: string;
  externalMessageId: string | null;
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
