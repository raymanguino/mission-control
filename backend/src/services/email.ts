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
