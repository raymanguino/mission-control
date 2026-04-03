/**
 * POSTs JSON event payloads to each agent's configured `hookUrl` with `Authorization: Bearer <hookToken>`.
 * Used for task assignment (assigned agent), task.completed / review handoff (chief of staff), and org-wide events.
 *
 * OpenClaw gateway `POST /hooks/agent` requires a `message` string; instruction payloads include it
 * so hooks work when `hookUrl` points at that endpoint. Custom receivers may ignore extra fields.
 */

import type { FastifyBaseLogger } from 'fastify';
import * as agentsDb from '../db/api/agents.js';

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
): Promise<void> {
  if (!agentWebhooksEnabled()) {
    return;
  }
  if (!hookUrl?.trim() || !hookToken?.trim()) {
    return;
  }

  const res = await fetch(hookUrl.trim(), {
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
  agent: { hookUrl: string | null; hookToken: string | null },
  task: { id: string; title: string; description: string | null },
  projectName: string,
): Promise<void> {
  await postToAgentWebhook(agent.hookUrl, agent.hookToken, {
    event: 'task.assigned',
    task: {
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      projectName,
    },
  });
}

export async function notifyChiefOfStaffOfProject(
  project: { id: string; name: string; description: string | null },
): Promise<void> {
  const cosRows = await agentsDb.getCoSAgents();
  const agent = cosRows.find((a) => a.hookUrl?.trim() && a.hookToken?.trim());
  if (!agent) return;

  await postToAgentWebhook(agent.hookUrl, agent.hookToken, {
    event: 'project.approval_requested',
    project: {
      id: project.id,
      name: project.name,
      description: project.description ?? null,
    },
  });
}

/** When a task moves into the Review column: notify the first chief_of_staff agent that has a webhook. */
export async function notifyChiefOfStaffOfTaskCompleted(
  task: { id: string; title: string; description: string | null },
  projectName: string,
): Promise<void> {
  const cosRows = await agentsDb.getCoSAgents();
  const agent = cosRows.find((a) => a.hookUrl?.trim() && a.hookToken?.trim());
  if (!agent) return;

  await postToAgentWebhook(agent.hookUrl, agent.hookToken, {
    event: 'task.completed',
    task: {
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      projectName,
    },
  });
}

const INSTRUCTIONS_UPDATE_EVENT = 'instructions.updated' as const;

const INSTRUCTIONS_WEBHOOK_MESSAGE =
  'Mission Control: instructions were updated. Refresh via GET /api/agents/instructions with Authorization: Bearer <your agent API key>.';

function instructionsUpdatePayload(): Record<string, unknown> {
  return {
    event: INSTRUCTIONS_UPDATE_EVENT,
    message: INSTRUCTIONS_WEBHOOK_MESSAGE,
    name: 'Mission Control',
    deliver: false,
    wakeMode: 'now',
  };
}

/** When CoS playbook text is saved: notify each chief_of_staff agent that has a webhook. */
export async function notifyChiefOfStaffInstructionsUpdated(
  log?: FastifyBaseLogger,
): Promise<void> {
  if (!agentWebhooksEnabled()) return;

  const cosRows = await agentsDb.getCoSAgents();
  let posted = 0;
  for (const agent of cosRows) {
    if (!agent.hookUrl?.trim() || !agent.hookToken?.trim()) continue;
    await postToAgentWebhook(agent.hookUrl, agent.hookToken, instructionsUpdatePayload());
    posted += 1;
  }

  if (posted === 0) {
    log?.warn(
      'Skipping instructions.updated webhook: no chief_of_staff agent has both hook URL and hook token set.',
    );
  }
}

/** When shared agent playbook text is saved: notify each engineer/QA agent that has a webhook. */
export async function notifyEngineerAndQaAgentsInstructionsUpdated(
  log?: FastifyBaseLogger,
): Promise<void> {
  if (!agentWebhooksEnabled()) return;

  const rows = await agentsDb.listAgentsForSharedAgentInstructions();
  let posted = 0;
  for (const agent of rows) {
    if (!agent.hookUrl?.trim() || !agent.hookToken?.trim()) continue;
    await postToAgentWebhook(agent.hookUrl, agent.hookToken, instructionsUpdatePayload());
    posted += 1;
  }

  if (posted === 0) {
    log?.warn(
      'Skipping instructions.updated webhook: no engineer or QA agent has both hook URL and hook token set.',
    );
  }
}
