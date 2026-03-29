import { Resend } from 'resend';

const resend = new Resend(process.env['RESEND_API_KEY']);
const FROM = process.env['RESEND_FROM_EMAIL'] ?? 'noreply@example.com';

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  await resend.emails.send({ from: FROM, to, subject, text });
}

export async function notifyCoSOfIntent(
  cos: { email: string; name: string },
  intent: { id: string; title: string; body: string },
  instructions: string,
): Promise<void> {
  const subject = `[Mission Control] New Intent: ${intent.title}`;
  const text = [
    `A new intent has been submitted and requires your attention.`,
    ``,
    `Intent ID: ${intent.id}`,
    `Title: ${intent.title}`,
    `Details:`,
    intent.body,
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
  kind: 'chief_of_staff' | 'member',
): Promise<void> {
  const roleLabel = kind === 'chief_of_staff' ? 'Chief of Staff' : 'Task Agent';
  const subject = '[Mission Control] Instructions updated — refresh your local copy';
  const text = [
    `Hello ${agent.name},`,
    ``,
    `Your ${roleLabel} playbook (Mission Control settings) was updated.`,
    `Refresh your local instructions (e.g. MEMORY.md): call GET /api/agents/instructions with your existing X-Agent-Key,`,
    `using the same API base URL you already use for Mission Control.`,
    ``,
    `If you do not rely on email, you can also detect changes via instructionsUpdatedAt on POST /api/agents/report.`,
  ].join('\n');
  await sendEmail(agent.email, subject, text);
}
