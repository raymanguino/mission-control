import * as agentsDb from '../db/api/agents.js';
import * as projectsDb from '../db/api/projects.js';

/**
 * Picks a QA agent with the fewest non-done assigned tasks; ties break on
 * `description` (locale-aware), then `name`.
 */
export async function pickQaReviewerAgent() {
  const qas = await agentsDb.listAgentsByOrgRole('qa');
  if (qas.length === 0) return null;

  const counts = await projectsDb.countNonDoneTasksByAssignedAgentIds(qas.map((a) => a.id));

  const sorted = [...qas].sort((a, b) => {
    const ca = counts[a.id] ?? 0;
    const cb = counts[b.id] ?? 0;
    if (ca !== cb) return ca - cb;
    const d = (a.description ?? '').localeCompare(b.description ?? '', undefined, {
      sensitivity: 'base',
    });
    if (d !== 0) return d;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return sorted[0] ?? null;
}
