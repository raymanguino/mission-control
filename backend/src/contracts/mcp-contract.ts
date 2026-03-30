import { z } from 'zod';

export type ContractMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export type ParamLocation = 'none' | 'query' | 'body' | 'path+query' | 'path+body';

export interface McpToolContract {
  method: ContractMethod;
  path: string;
  params: ParamLocation;
  input: z.ZodRawShape;
}

// Backend request-body schemas used by MCP-facing endpoints.
export const backendRequestSchemas = {
  createAgent: z.object({
    name: z.string(),
    email: z.string().email().optional(),
    device: z.string().optional(),
    ip: z.string().optional(),
    specialization: z.string().optional(),
    description: z.string().optional(),
    reportsToAgentId: z.string().uuid().nullable().optional(),
  }),
  updateAgent: z.object({
    agentId: z.string().uuid(),
    name: z.string().optional(),
    email: z.string().email().optional(),
    device: z.string().optional(),
    ip: z.string().optional(),
    orgRole: z.enum(['chief_of_staff', 'member']).optional(),
    specialization: z.string().optional(),
    description: z.string().optional(),
    reportsToAgentId: z.string().uuid().nullable().optional(),
  }),
  updateSettings: z.object({
    updates: z.record(z.string(), z.string()),
  }),
  createProject: z.object({
    name: z.string(),
    description: z.string().optional(),
  }),
  updateProject: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(['pending_approval', 'approved', 'denied']).optional(),
  }),
  createTask: z.object({
    projectId: z.string().uuid(),
    title: z.string(),
    description: z.string().optional(),
    status: z.enum(['backlog', 'doing', 'review', 'done']).optional(),
    assignedAgentId: z.string().uuid().optional(),
    order: z.number().int().optional(),
  }),
  updateTask: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(['backlog', 'doing', 'review', 'done']).optional(),
    assignedAgentId: z.string().uuid().nullable().optional(),
    order: z.number().int().optional(),
  }),
  createMessage: z
    .object({
      author: z.string().optional(),
      content: z.string(),
      agentId: z.string().uuid().optional(),
      /** If set, author display name is resolved from this member in the configured Discord guild (snowflake id). */
      discordUserId: z.string().regex(/^\d{17,20}$/).optional(),
    })
    .refine((data) => data.author != null || data.discordUserId != null, {
      message: 'Provide either author or discordUserId',
    }),
  createFood: z.object({
    mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
    description: z.string().min(1),
    calories: z.number().int().min(0).optional().nullable(),
    protein: z.coerce.number().min(0).optional().nullable(),
    carbs: z.coerce.number().min(0).optional().nullable(),
    fat: z.coerce.number().min(0).optional().nullable(),
    loggedAt: z.string(),
    date: z.string(),
    notes: z.string().optional().nullable(),
  }),
  quickFood: z.object({
    text: z.string().min(1),
  }),
  estimateFood: z.object({
    description: z.string().min(1),
  }),
  createMarijuana: z.object({
    form: z.enum(['flower', 'vape', 'edible', 'tincture', 'other']),
    strain: z.string().optional().nullable(),
    amount: z.string().optional().nullable(),
    unit: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    sessionAt: z.string(),
    date: z.string(),
  }),
  createSleep: z.object({
    bedTime: z.string(),
    wakeTime: z.string().optional().nullable(),
    qualityScore: z.number().int().min(1).max(5).optional().nullable(),
    notes: z.string().optional().nullable(),
    date: z.string(),
  }),
  runHealthAnalysis: z.object({
    goal: z.string().min(1),
    goals: z.array(z.string().min(1)).optional(),
  }),
} as const;

// MCP-facing contract used for drift checks.
export const mcpToolContracts: Record<string, McpToolContract> = {
  list_agents: { method: 'GET', path: '/api/agents', params: 'none', input: {} },
  get_agent_activity: {
    method: 'GET',
    path: '/api/agents/:agentId/activity',
    params: 'path+query',
    input: {
      agentId: z.string(),
      limit: z.number().int().min(1).max(100).optional(),
    },
  },
  create_agent: {
    method: 'POST',
    path: '/api/agents',
    params: 'body',
    input: backendRequestSchemas.createAgent.shape,
  },
  update_agent: {
    method: 'PATCH',
    path: '/api/agents/:agentId',
    params: 'path+body',
    input: backendRequestSchemas.updateAgent.shape,
  },
  delete_agent: {
    method: 'DELETE',
    path: '/api/agents/:agentId',
    params: 'path+query',
    input: { agentId: z.string().uuid() },
  },
  list_projects: { method: 'GET', path: '/api/projects', params: 'none', input: {} },
  create_project: {
    method: 'POST',
    path: '/api/projects',
    params: 'body',
    input: backendRequestSchemas.createProject.shape,
  },
  update_project: {
    method: 'PATCH',
    path: '/api/projects/:projectId',
    params: 'path+body',
    input: {
      projectId: z.string().uuid(),
      name: backendRequestSchemas.updateProject.shape.name,
      description: backendRequestSchemas.updateProject.shape.description,
      status: backendRequestSchemas.updateProject.shape.status,
    },
  },
  delete_project: {
    method: 'DELETE',
    path: '/api/projects/:projectId',
    params: 'path+query',
    input: { projectId: z.string().uuid() },
  },
  get_task: {
    method: 'GET',
    path: '/api/tasks/:taskId',
    params: 'path+query',
    input: { taskId: z.string() },
  },
  list_tasks: {
    method: 'GET',
    path: '/api/projects/:projectId/tasks',
    params: 'path+query',
    input: { projectId: z.string() },
  },
  create_task: {
    method: 'POST',
    path: '/api/tasks',
    params: 'body',
    input: {
      projectId: backendRequestSchemas.createTask.shape.projectId,
      title: backendRequestSchemas.createTask.shape.title,
      description: backendRequestSchemas.createTask.shape.description,
      status: backendRequestSchemas.createTask.shape.status,
      assignedAgentId: z.string().optional(),
    },
  },
  update_task: {
    method: 'PATCH',
    path: '/api/tasks/:taskId',
    params: 'path+body',
    input: {
      taskId: z.string(),
      status: backendRequestSchemas.updateTask.shape.status,
      title: backendRequestSchemas.updateTask.shape.title,
      description: backendRequestSchemas.updateTask.shape.description,
      assignedAgentId: z.string().nullable().optional(),
    },
  },
  delete_task: {
    method: 'DELETE',
    path: '/api/tasks/:taskId',
    params: 'path+query',
    input: { taskId: z.string().uuid() },
  },
  list_channels: { method: 'GET', path: '/api/channels', params: 'none', input: {} },
  get_messages: {
    method: 'GET',
    path: '/api/channels/:channelId/messages',
    params: 'path+query',
    input: {
      channelId: z.string(),
      limit: z.number().int().min(1).max(100).optional(),
    },
  },
  post_message: {
    method: 'POST',
    path: '/api/channels/:channelId/messages',
    params: 'path+body',
    input: {
      channelId: z.string(),
      content: z.string(),
      author: z.string().optional(),
      discordUserId: z.string().regex(/^\d{17,20}$/).optional(),
    },
  },
  delete_channel: {
    method: 'DELETE',
    path: '/api/channels/:channelId',
    params: 'path+query',
    input: { channelId: z.string().uuid() },
  },
  get_usage: {
    method: 'GET',
    path: '/api/usage',
    params: 'query',
    input: {
      groupBy: z.enum(['model', 'apiKey', 'agent']).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    },
  },
  get_usage_records: {
    method: 'GET',
    path: '/api/usage/records',
    params: 'query',
    input: {
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).optional(),
    },
  },
  get_ai_config: { method: 'GET', path: '/api/usage/ai/config', params: 'none', input: {} },
  sync_usage: { method: 'POST', path: '/api/usage/sync', params: 'none', input: {} },
  log_food: {
    method: 'POST',
    path: '/api/health/food',
    params: 'body',
    input: {
      mealType: backendRequestSchemas.createFood.shape.mealType,
      description: backendRequestSchemas.createFood.shape.description,
      loggedAt: z.string().optional(),
      date: z.string().optional(),
      calories: backendRequestSchemas.createFood.shape.calories,
      protein: backendRequestSchemas.createFood.shape.protein,
      carbs: backendRequestSchemas.createFood.shape.carbs,
      fat: backendRequestSchemas.createFood.shape.fat,
      notes: z.string().optional(),
    },
  },
  quick_log_food: {
    method: 'POST',
    path: '/api/health/food/quick',
    params: 'body',
    input: backendRequestSchemas.quickFood.shape,
  },
  list_food_logs: {
    method: 'GET',
    path: '/api/health/food',
    params: 'query',
    input: {
      date: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    },
  },
  delete_food_log: {
    method: 'DELETE',
    path: '/api/health/food/:id',
    params: 'path+query',
    input: { id: z.string().uuid() },
  },
  log_cannabis_session: {
    method: 'POST',
    path: '/api/health/marijuana',
    params: 'body',
    input: {
      form: backendRequestSchemas.createMarijuana.shape.form,
      sessionAt: z.string().optional(),
      date: z.string().optional(),
      strain: z.string().optional(),
      amount: z.string().optional(),
      unit: z.string().optional(),
      notes: z.string().optional(),
    },
  },
  list_cannabis_sessions: {
    method: 'GET',
    path: '/api/health/marijuana',
    params: 'query',
    input: {
      date: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    },
  },
  delete_marijuana_session: {
    method: 'DELETE',
    path: '/api/health/marijuana/:id',
    params: 'path+query',
    input: { id: z.string().uuid() },
  },
  log_sleep: {
    method: 'POST',
    path: '/api/health/sleep',
    params: 'body',
    input: {
      bedTime: backendRequestSchemas.createSleep.shape.bedTime,
      wakeTime: backendRequestSchemas.createSleep.shape.wakeTime,
      qualityScore: backendRequestSchemas.createSleep.shape.qualityScore,
      date: z.string().optional(),
      notes: z.string().optional(),
    },
  },
  update_sleep_log: {
    method: 'PATCH',
    path: '/api/health/sleep/:id',
    params: 'path+body',
    input: {
      id: z.string().uuid(),
      wakeTime: z.string().optional(),
      qualityScore: z.number().int().min(1).max(5).optional(),
      notes: z.string().optional(),
    },
  },
  list_sleep_logs: {
    method: 'GET',
    path: '/api/health/sleep',
    params: 'query',
    input: {
      from: z.string().optional(),
      to: z.string().optional(),
    },
  },
  delete_sleep_log: {
    method: 'DELETE',
    path: '/api/health/sleep/:id',
    params: 'path+query',
    input: { id: z.string().uuid() },
  },
  run_health_analysis: {
    method: 'POST',
    path: '/api/health/analysis',
    params: 'body',
    input: backendRequestSchemas.runHealthAnalysis.shape,
  },
  get_settings: { method: 'GET', path: '/api/settings', params: 'none', input: {} },
  update_settings: {
    method: 'PATCH',
    path: '/api/settings',
    params: 'body',
    input: backendRequestSchemas.updateSettings.shape,
  },
};

export const mcpBackendEndpointPaths = [
  ...new Set([
    ...Object.values(mcpToolContracts).map((entry) => entry.path),
    '/api/health/food/estimate',
  ]),
];
