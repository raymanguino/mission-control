/**
 * Mission Control → Ralph notifier service
 *
 * Drop this file into: backend/src/services/ralph.ts
 *
 * This replaces email as the action trigger for Ralph (OpenClaw chief of staff).
 * Calls OpenClaw directly over Tailscale — no public internet involved.
 *
 * Setup:
 *   Add to backend/.env:
 *     RALPH_HOOK_URL=https://six7swe-leader.tailc28236.ts.net/hooks/mc
 *     RALPH_HOOK_TOKEN=f2c3cab4ac54bbbffd473baa6bbdfc3fd96aab9d1d3ec2aec184d5e162c97c9f
 *
 * Usage:
 *   import { notifyRalphOfProject, notifyRalphOfTask, notifyRalphInstructionsUpdated } from './ralph.js';
 */

const RALPH_HOOK_URL = process.env['RALPH_HOOK_URL'];
const RALPH_HOOK_TOKEN = process.env['RALPH_HOOK_TOKEN'];

async function postToRalph(payload: Record<string, unknown>): Promise<void> {
  if (!RALPH_HOOK_URL || !RALPH_HOOK_TOKEN) {
    console.warn('[ralph] RALPH_HOOK_URL or RALPH_HOOK_TOKEN not set — skipping tailnet notify');
    return;
  }

  const res = await fetch(RALPH_HOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RALPH_HOOK_TOKEN}`,
    },
    body: JSON.stringify(payload),
    // Tailscale connections are fast — 5s is generous
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Ralph hook responded ${res.status}: ${await res.text()}`);
  }

  console.log(`[ralph] Notified: ${payload.event}`);
}

export async function notifyRalphOfProject(
  project: { id: string; name: string; description: string | null },
): Promise<void> {
  await postToRalph({
    event: 'project.approval_requested',
    project: {
      id: project.id,
      name: project.name,
      description: project.description ?? null,
    },
  });
}

export async function notifyRalphOfTask(
  task: { id: string; title: string; description: string | null },
  projectName: string,
): Promise<void> {
  await postToRalph({
    event: 'task.assigned',
    task: {
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      projectName,
    },
  });
}

export async function notifyRalphInstructionsUpdated(): Promise<void> {
  await postToRalph({ event: 'instructions.updated' });
}
