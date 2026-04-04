import type { FastifyBaseLogger } from 'fastify';
import type { DiscordSyncService } from './sync.js';

const DISCORD_BODY_MAX = 1900;

function truncateBody(s: string): string {
  if (s.length <= DISCORD_BODY_MAX) return s;
  return `${s.slice(0, DISCORD_BODY_MAX - 1)}…`;
}

/**
 * Resolves the #general channel for outbound project announcements.
 * Prefer `DISCORD_GENERAL_CHANNEL_ID`; otherwise resolve by channel name `general` in the configured guild.
 */
export async function resolveGeneralDiscordChannelId(
  service: DiscordSyncService | null,
  log: FastifyBaseLogger,
): Promise<string | null> {
  const fromEnv = process.env['DISCORD_GENERAL_CHANNEL_ID']?.trim();
  if (fromEnv) return fromEnv;
  if (!service) {
    log.warn('Discord project announcement skipped: no sync service and DISCORD_GENERAL_CHANNEL_ID unset');
    return null;
  }
  const id = await service.getTextChannelIdByName('general');
  if (!id) {
    log.warn(
      'Discord project announcement: set DISCORD_GENERAL_CHANNEL_ID or ensure a #general text channel exists',
    );
  }
  return id;
}

type ProjectRow = { id: string; name: string; url: string | null };
type TaskRow = { title: string; resolution: string | null };

/** When every task is Done: success line for #general (solution URL + task resolutions). */
export function formatDiscordProjectSuccess(project: ProjectRow, taskList: TaskRow[]): string {
  const lines: string[] = [
    `**Project complete:** ${project.name}`,
    project.url?.trim() ? `**Solution / project URL:** ${project.url.trim()}` : null,
    taskList.some((t) => t.resolution?.trim()) ? '**Task resolutions:**' : null,
    ...taskList
      .filter((t) => t.resolution?.trim())
      .map((t) => `• ${t.title}: ${t.resolution!.trim()}`),
  ].filter((x): x is string => Boolean(x));
  return truncateBody(lines.join('\n'));
}

/** When every task is `not_done`: failure summary for #general. */
export function formatDiscordProjectFailure(project: ProjectRow, taskList: TaskRow[]): string {
  const lines: string[] = [
    `**Project failed (all tasks not done):** ${project.name}`,
    project.url?.trim() ? `**Project URL:** ${project.url.trim()}` : null,
    taskList.length ? '**Tasks:**' : null,
    ...taskList.map((t) => `• ${t.title}${t.resolution?.trim() ? ` — ${t.resolution.trim()}` : ''}`),
  ].filter((x): x is string => Boolean(x));
  return truncateBody(lines.join('\n'));
}

export async function sendDiscordToGeneral(
  service: DiscordSyncService | null,
  channelId: string | null,
  content: string,
  log: FastifyBaseLogger,
): Promise<void> {
  if (!service || !channelId) return;
  try {
    await service.sendMessage(channelId, content, { prefixMissionControl: true });
  } catch (err) {
    log.warn({ err }, 'Discord send to #general failed');
  }
}
