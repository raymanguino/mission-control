import type { AgentOrgRole } from '../lib/agentOrgRoles.js';
import { Resend } from 'resend';

const INSTRUCTION_ROLE_LABEL: Record<AgentOrgRole, string> = {
  chief_of_staff: 'Chief of Staff',
  engineer: 'Engineer',
  qa: 'QA',
};

const resend = new Resend(process.env['RESEND_API_KEY']);
const FROM = process.env['RESEND_FROM_EMAIL'] ?? 'noreply@example.com';

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  await resend.emails.send({ from: FROM, to, subject, text });
}

export async function notifyCoSOfProject(
  cos: { email: string; name: string },
  project: { id: string; name: string; description: string | null },
  instructions: string,
): Promise<void> {
  const subject = `[Mission Control] New Project Pending Approval: ${project.name}`;
  const text = [
    `A new project has been submitted and requires your approval.`,
    ``,
    `Project ID: ${project.id}`,
    `Name: ${project.name}`,
    `Description: ${project.description ?? '(none)'}`,
    ``,
    `To approve: PATCH /api/projects/${project.id} with { "status": "approved" }`,
    `To deny:    PATCH /api/projects/${project.id} with { "status": "denied" }`,
    ``,
    `---`,
    `Your instructions:`,
    instructions,
  ].join('\n');
  await sendEmail(cos.email, subject, text);
}

export async function notifyAgentOfTask(
  agent: { email: string; name: string },
  task: { id: string; title: string; description: string | null },
  project: { name: string },
  instructions: string,
): Promise<void> {
  const subject = `[Mission Control] Task Assigned: ${task.title}`;
  const text = [
    `A task has been assigned to you.`,
    ``,
    `Project: ${project.name}`,
    `Task ID: ${task.id}`,
    `Title: ${task.title}`,
    `Description: ${task.description ?? '(none)'}`,
    ``,
    `---`,
    `Your instructions:`,
    instructions,
  ].join('\n');
  await sendEmail(agent.email, subject, text);
}

export async function notifyAgentInstructionsUpdated(
  agent: { email: string; name: string },
  kind: AgentOrgRole,
): Promise<void> {
  const roleLabel = INSTRUCTION_ROLE_LABEL[kind];
  const subject = '[Mission Control] Instructions updated — refresh your local copy';
  const text = [
    `Hello ${agent.name},`,
    ``,
    `Your ${roleLabel} playbook (Mission Control settings) was updated.`,
    `Refresh your local instructions (e.g. MEMORY.md): call GET /api/agents/instructions with Authorization: Bearer <your agent API key>,`,
    `using the same API base URL you already use for Mission Control.`,
    ``,
    `If you do not rely on email, you can also detect changes via instructionsUpdatedAt on POST /api/agents/report.`,
  ].join('\n');
  await sendEmail(agent.email, subject, text);
}
