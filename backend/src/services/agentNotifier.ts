/**
 * POSTs JSON event payloads to each agent's configured `hookUrl` with `Authorization: Bearer <hookToken>`.
 * Used for task assignment (assigned agent) and org-wide events (chief of staff agent).
 */

import * as agentsDb from '../db/api/agents.js';

export async function postToAgentWebhook(
  hookUrl: string | null,
  hookToken: string | null,
  payload: Record<string, unknown>,
): Promise<void> {
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

export async function notifyChiefOfStaffInstructionsUpdated(): Promise<void> {
  const cosRows = await agentsDb.getCoSAgents();
  const agent = cosRows.find((a) => a.hookUrl?.trim() && a.hookToken?.trim());
  if (!agent) return;

  await postToAgentWebhook(agent.hookUrl, agent.hookToken, { event: 'instructions.updated' });
}
