/**
 * POSTs JSON event payloads to `MC_WEBHOOK_BASE_URL/hooks/mc/{cos|eng|qa}` with
 * `Authorization: Bearer MC_WEBHOOK_TOKEN`.
 */

import type { FastifyBaseLogger } from 'fastify';
import * as agentsDb from '../db/api/agents.js';
import * as settingsDb from '../db/api/settings.js';
import { instructionKeyForOrgRole } from '../lib/agentOrgRoles.js';

type McWebhookRole = 'cos' | 'eng' | 'qa';

function getMcWebhookUrl(): string | null {
  const raw = process.env['MC_WEBHOOK_BASE_URL']?.trim();
  if (!raw) return null;
  try {
    const base = raw.replace(/\/$/, '');
    const url = new URL(base.includes('://') ? base : `https://${base}`);
    url.pathname = '/hooks/mc';
    return url.toString();
  } catch {
    return null;
  }
}

export type AgentWebhookSnapshot = { id: string; name: string };
export type ProjectWebhookSnapshot = { id: string; name: string; url: string };

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

/** Agents (id + name) for a given org role. */
async function agentsForOrgRole(
  orgRole: string | null | undefined,
): Promise<AgentWebhookSnapshot[]> {
  if (!orgRole) return [];
  try {
    const rows = await agentsDb.listAgentsByOrgRole(
      orgRole as import('../lib/agentOrgRoles.js').AgentOrgRole,
    );
    return rows.map((a: { id: string; name: string }) => ({ id: a.id, name: a.name }));
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
  agents: AgentWebhookSnapshot[],
) {
  return {
    event,
    project: { id: project.id, name: project.name, githubUrl: project.url },
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
  const url = getMcWebhookUrl();
  if (!url || !token) {
    log?.warn(
      'Skipping role webhook: set MC_WEBHOOK_BASE_URL and MC_WEBHOOK_TOKEN for outbound POSTs.',
    );
    return;
  }

  log?.info({ url, token, payload }, 'POSTing role webhook');

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

/** Single POST `project.pending_approval` to `/hooks/mc` (role inferred by event). */
export async function notifyChiefOfStaffOfProject(
  project: ProjectWebhookSnapshot,
  log?: FastifyBaseLogger,
): Promise<void> {
  await postProjectWebhook(project, 'project.pending_approval', 'chief_of_staff', 'cos', log);
}

/** Helper to POST a project event webhook for a given role. */
export async function postProjectWebhook(
  project: ProjectWebhookSnapshot,
  event: string,
  orgRole: string,
  webhookRole: McWebhookRole,
  log?: FastifyBaseLogger,
): Promise<void> {
  const [agentInstructions, agents] = await Promise.all([
    instructionsTextForOrgRole(orgRole),
    agentsForOrgRole(orgRole),
  ]);
  try {
    await postRoleWebhook(
      webhookRole,
      {
        ...basePayload(project, event, agentInstructions, agents),
      },
      log,
    );
  } catch (err) {
    log?.error({ err }, `Failed to POST ${event} webhook`);
  }
}

/** Emits `project.backlog_updated` on every task create/update (single POST to `/hooks/mc`). */
export async function postProjectBacklogUpdatedWebhook(
  project: ProjectWebhookSnapshot,
  log?: FastifyBaseLogger,
): Promise<void> {
  await postProjectWebhook(project, 'project.backlog_updated', 'engineer', 'eng', log);
  await postProjectWebhook(project, 'project.backlog_updated', 'qa', 'qa', log);
}

/** When every task in the project is in Review: notify QA (`project.all_tasks_completed`). */
export async function notifyQaProjectAllTasksInReview(
  project: ProjectWebhookSnapshot,
  log?: FastifyBaseLogger,
): Promise<void> {
  await postProjectWebhook(project, 'project.all_tasks_completed', 'qa', 'qa', log);
}

/** When every project task is `done` or `not_done`: notify CoS (`project.review_completed`). */
export async function notifyChiefOfStaffOfReviewCompleted(
  project: ProjectWebhookSnapshot,
  log?: FastifyBaseLogger,
): Promise<void> {
  await postProjectWebhook(project, 'project.review_completed', 'chief_of_staff', 'cos', log);
}
