/**
 * POSTs JSON event payloads to each agent's configured `hookUrl` with `Authorization: Bearer <hookToken>`.
 * Role-based paths: engineer → `/hooks/mc/eng`, QA → `/hooks/mc/qa`, Chief of Staff → `/hooks/mc/cos`
 * (see `applyMcRoleToHookUrl`, `packages/agent-webhook-relay`).
 */

import type { FastifyBaseLogger } from 'fastify';
import * as agentsDb from '../db/api/agents.js';
import * as settingsDb from '../db/api/settings.js';
import { pickAgentByOrgRoleLeastLoaded } from '../lib/pickAgentByLoad.js';
import { instructionKeyForOrgRole } from '../lib/agentOrgRoles.js';
import { applyMcRoleToHookUrl, type McWebhookRole } from '../lib/mcHookUrl.js';

/** Role-specific playbook text for webhook payloads (same keys as GET /api/agents/instructions). */
async function instructionsTextForOrgRole(orgRole: string | null | undefined): Promise<string> {
  if (!orgRole) return '';
  try {
    const key = instructionKeyForOrgRole(orgRole);
    return (await settingsDb.getSetting(key)) ?? '';
  } catch {
    return '';
  }
}

/** Set `AGENT_WEBHOOKS_ENABLED=false` (or `0` / `no`) to disable all outbound agent webhook POSTs. Default: enabled. */
function agentWebhooksEnabled(): boolean {
  const v = process.env['AGENT_WEBHOOKS_ENABLED'];
  if (v == null || v.trim() === '') return true;
  const lower = v.trim().toLowerCase();
  return lower !== 'false' && lower !== '0' && lower !== 'no';
}

export async function postToAgentWebhook(
  hookUrl: string | null,
  hookToken: string | null,
  payload: Record<string, unknown>,
  options: { mcRole: McWebhookRole },
): Promise<void> {
  if (!agentWebhooksEnabled()) {
    return;
  }
  if (!hookUrl?.trim() || !hookToken?.trim()) {
    return;
  }

  const url = applyMcRoleToHookUrl(hookUrl, options.mcRole);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hookToken.trim()}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Agent webhook responded ${res.status}: ${await res.text()}`);
  }
}

export async function notifyAssignedAgentOfTask(
  agent: {
    id: string;
    hookUrl: string | null;
    hookToken: string | null;
    name?: string;
    orgRole?: string;
  },
  task: { id: string; title: string; description: string | null; resolution?: string | null },
  project: { id: string; name: string; description: string | null; url: string | null },
): Promise<void> {
  const agentInstructions = await instructionsTextForOrgRole(agent.orgRole);

  await postToAgentWebhook(agent.hookUrl, agent.hookToken, {
    event: 'task.created',
    task: {
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      projectId: project.id,
      projectName: project.name,
    },
    agentInstructions,
    projectContext: {
      name: project.name,
      description: project.description ?? null,
      url: project.url ?? null,
    },
  }, { mcRole: 'eng' });
}

/** When every task in the project is in Review: notify QA (`task.completed`, `allTasksInReview: true`). */
export async function notifyQaOfProjectAllTasksInReviewWebhook(
  agent: { hookUrl: string | null; hookToken: string | null; orgRole?: string | null },
  task: { id: string; title: string; description: string | null; resolution?: string | null },
  project: { id: string; name: string; description?: string | null; url?: string | null },
  projectName: string,
): Promise<void> {
  const agentInstructions = await instructionsTextForOrgRole(agent.orgRole);
  await postToAgentWebhook(agent.hookUrl, agent.hookToken, {
    event: 'task.completed',
    allTasksInReview: true,
    project: {
      id: project.id,
      name: project.name,
    },
    task: {
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      resolution: task.resolution ?? null,
      projectId: project.id,
      projectName,
    },
    projectContext: {
      name: project.name,
      description: project.description ?? null,
      url: project.url ?? null,
    },
    agentInstructions,
  }, { mcRole: 'qa' });
}

export async function notifyChiefOfStaffOfProject(
  project: { id: string; name: string; description: string | null },
): Promise<void> {
  const agent = await pickAgentByOrgRoleLeastLoaded('chief_of_staff', { requireWebhook: true });
  if (!agent) {
    return;
  }

  const agentInstructions = await instructionsTextForOrgRole(agent.orgRole);
  await postToAgentWebhook(agent.hookUrl, agent.hookToken, {
    agentId: agent.id,
    event: 'project.pending_approval',
    project: {
      id: project.id,
      name: project.name,
      description: project.description ?? null,
    },
    agentInstructions,
  }, { mcRole: 'cos' });
}

/** When every task in a project is Done: notify each chief_of_staff agent that has a webhook. */
/** When QA marks a task done from Review: notify each chief_of_staff agent that has a webhook (`review.completed`). */
export async function notifyChiefOfStaffOfReviewCompleted(
  task: {
    id: string;
    title: string;
    description: string | null;
    resolution?: string | null;
  },
  project: { id: string; name: string; description: string | null; url: string | null },
  log?: FastifyBaseLogger,
): Promise<void> {
  if (!agentWebhooksEnabled()) return;

  const cosRows = await agentsDb.getCoSAgents();
  const agentInstructions = await instructionsTextForOrgRole('chief_of_staff');
  let posted = 0;
  for (const agent of cosRows) {
    if (!agent.hookUrl?.trim() || !agent.hookToken?.trim()) continue;
    await postToAgentWebhook(agent.hookUrl, agent.hookToken, {
      event: 'review.completed',
      task: {
        id: task.id,
        title: task.title,
        description: task.description ?? null,
        resolution: task.resolution ?? null,
        projectId: project.id,
        projectName: project.name,
      },
      project: {
        id: project.id,
        name: project.name,
        description: project.description ?? null,
        url: project.url ?? null,
      },
      agentInstructions,
    }, { mcRole: 'cos' });
    posted += 1;
  }

  if (posted === 0) {
    log?.warn(
      'Skipping review.completed webhook: no chief_of_staff agent has both hook URL and hook token set.',
    );
  }
}

export async function notifyChiefOfStaffOfProjectCompleted(
  project: { id: string; name: string; description: string | null; url: string | null },
  log?: FastifyBaseLogger,
): Promise<void> {
  if (!agentWebhooksEnabled()) return;

  const cosRows = await agentsDb.getCoSAgents();
  const agentInstructions = await instructionsTextForOrgRole('chief_of_staff');
  let posted = 0;
  for (const agent of cosRows) {
    if (!agent.hookUrl?.trim() || !agent.hookToken?.trim()) continue;
    await postToAgentWebhook(agent.hookUrl, agent.hookToken, {
      event: 'project.completed',
      project: {
        id: project.id,
        name: project.name,
        description: project.description ?? null,
        url: project.url ?? null,
      },
      agentInstructions,
    }, { mcRole: 'cos' });
    posted += 1;
  }

  if (posted === 0) {
    log?.warn(
      'Skipping project.completed webhook: no chief_of_staff agent has both hook URL and hook token set.',
    );
  }
}
