/**
 * POSTs JSON event payloads to `MC_WEBHOOK_BASE_URL/hooks/mc/{cos|eng|qa}` with
 * `Authorization: Bearer MC_WEBHOOK_TOKEN`.
 */

import type { FastifyBaseLogger } from 'fastify';
import * as agentsDb from '../db/api/agents.js';
import * as settingsDb from '../db/api/settings.js';
import { instructionKeyForOrgRole } from '../lib/agentOrgRoles.js';
import { getMcRoleWebhookUrl, type McWebhookRole } from '../lib/mcHookUrl.js';

export type ProjectWebhookSnapshot = { id: string; name: string };

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

/** Agent names for a given org role. */
async function agentNamesForOrgRole(orgRole: string | null | undefined): Promise<string[]> {
  if (!orgRole) return [];
  try {
    const rows = await agentsDb.listAgentsByOrgRole(orgRole as import('../lib/agentOrgRoles.js').AgentOrgRole);
    return rows.map((a: { name: string }) => a.name);
  } catch {
    return [];
  }
}

/** Set `AGENT_WEBHOOKS_ENABLED=false` (or `0` / `no`) to disable all outbound webhook POSTs. Default: enabled. */
function agentWebhooksEnabled(): boolean {
  const v = process.env['AGENT_WEBHOOKS_ENABLED'];
  if (v == null || v.trim() === '') return true;
  const lower = v.trim().toLowerCase();
  return lower !== 'false' && lower !== '0' && lower !== 'no';
}

function mcWebhookAuth(): string | null {
  const t = process.env['MC_WEBHOOK_TOKEN']?.trim();
  return t && t.length > 0 ? t : null;
}

function basePayload(
  project: ProjectWebhookSnapshot,
  event: string,
  agentInstructions: string,
  agents: string[],
) {
  return {
    event,
    project: { id: project.id, name: project.name },
    agentInstructions,
    agents,
  };
}

async function postRoleWebhook(
  role: McWebhookRole,
  payload: Record<string, unknown>,
  log?: FastifyBaseLogger,
): Promise<void> {
  if (!agentWebhooksEnabled()) {
    log?.warn(
      'Skipping role webhook: set AGENT_WEBHOOKS_ENABLED for outbound POSTs.',
    );
    return;
  }
  const token = mcWebhookAuth();
  const url = getMcRoleWebhookUrl(role);
  if (!url || !token) {
    log?.warn(
      'Skipping role webhook: set MC_WEBHOOK_BASE_URL and MC_WEBHOOK_TOKEN for outbound POSTs.',
    );
    return;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Role webhook responded ${res.status}: ${await res.text()}`);
  }
}

/** Single POST `project.pending_approval` to `/hooks/mc/cos`. */
export async function notifyChiefOfStaffOfProject(
  project: ProjectWebhookSnapshot,
  log?: FastifyBaseLogger,
): Promise<void> {
  const [agentInstructions, agentNames] = await Promise.all([
    instructionsTextForOrgRole('chief_of_staff'),
    agentNamesForOrgRole('chief_of_staff'),
  ]);
  try {
    await postRoleWebhook(
      'cos',
      {
        ...basePayload(project, 'project.pending_approval', agentInstructions, agentNames),
      },
      log,
    );
  } catch (err) {
    log?.error({ err }, 'Failed to POST project.pending_approval webhook');
  }
}

/** Emits `project.backlog_updated` on every task create/update (single POST to `/hooks/mc/eng`). */
export async function postProjectBacklogUpdatedWebhook(
  project: ProjectWebhookSnapshot,
  log?: FastifyBaseLogger,
): Promise<void> {
  const [agentInstructions, agentNames] = await Promise.all([
    instructionsTextForOrgRole('engineer'),
    agentNamesForOrgRole('engineer'),
  ]);
  try {
    await postRoleWebhook(
      'eng',
      {
        ...basePayload(project, 'project.backlog_updated', agentInstructions, agentNames),
      },
      log,
    );
  } catch (err) {
    log?.error({ err }, 'Failed to POST project.backlog_updated webhook');
  }
}

/** When every task in the project is in Review: notify QA (`project.all_tasks_completed`). */
export async function notifyQaProjectAllTasksInReview(
  project: ProjectWebhookSnapshot,
  log?: FastifyBaseLogger,
): Promise<void> {
  const [agentInstructions, agentNames] = await Promise.all([
    instructionsTextForOrgRole('qa'),
    agentNamesForOrgRole('qa'),
  ]);
  try {
    await postRoleWebhook(
      'qa',
      {
        ...basePayload(project, 'project.all_tasks_completed', agentInstructions, agentNames),
      },
      log,
    );
  } catch (err) {
    log?.error({ err }, 'Failed to POST project.all_tasks_completed webhook');
  }
}

/** When every project task is `done` or `not_done`: notify CoS (`project.review_completed`). */
export async function notifyChiefOfStaffOfReviewCompleted(
  project: ProjectWebhookSnapshot,
  log?: FastifyBaseLogger,
): Promise<void> {
  const [agentInstructions, agentNames] = await Promise.all([
    instructionsTextForOrgRole('chief_of_staff'),
    agentNamesForOrgRole('chief_of_staff'),
  ]);
  try {
    await postRoleWebhook(
      'cos',
      {
        ...basePayload(project, 'project.review_completed', agentInstructions, agentNames),
      },
      log,
    );
  } catch (err) {
    log?.error({ err }, 'Failed to POST project.review_completed webhook');
  }
}
