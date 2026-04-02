import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import * as agentsDb from '../../db/api/agents.js';
import * as settingsDb from '../../db/api/settings.js';
import * as emailService from '../../services/email.js';
import {
  notifyChiefOfStaffInstructionsUpdated,
  notifyMemberAgentsInstructionsUpdated,
} from '../../services/agentNotifier.js';
import { ApiError, parseBody } from '../../lib/errors.js';
import { AGENT_PRESENCE_SETTING_KEYS } from '../../lib/agentPresenceConfig.js';

const DEFAULT_DASHBOARD_TITLE = 'Mission Control';
const DASHBOARD_TITLE_MAX_LEN = 128;

const updateSettingsSchema = z.record(z.string(), z.string());

const INSTRUCTION_SETTING_KEYS = ['cos_instructions', 'agent_instructions'] as const;

function resolveDashboardTitle(raw: string | null): string {
  const t = raw?.trim() ?? '';
  return t.length > 0 ? t.slice(0, DASHBOARD_TITLE_MAX_LEN) : DEFAULT_DASHBOARD_TITLE;
}

const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  /** Public: login page and shell need the label without a JWT. */
  fastify.get('/display', async () => {
    const raw = await settingsDb.getSetting('dashboard_title');
    return { dashboardTitle: resolveDashboardTitle(raw) };
  });

  fastify.get('/', { preHandler: fastify.authenticate }, async () => {
    return settingsDb.getAllSettings();
  });

  fastify.patch('/', { preHandler: fastify.authenticate }, async (request) => {
    const body = parseBody(updateSettingsSchema, request.body);

    for (const key of Object.values(AGENT_PRESENCE_SETTING_KEYS)) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
      const raw = String(body[key] ?? '').trim();
      const n = Number.parseInt(raw, 10);
      if (!Number.isFinite(n) || n < 1 || n > 10_080) {
        throw new ApiError(
          400,
          'VALIDATION_FAILED',
          `${key} must be an integer from 1 to 10080 (minutes)`,
        );
      }
      body[key] = String(n);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'dashboard_title')) {
      const v = body['dashboard_title'] ?? '';
      body['dashboard_title'] = v.trim().slice(0, DASHBOARD_TITLE_MAX_LEN);
    }

    const previousByKey: Partial<Record<(typeof INSTRUCTION_SETTING_KEYS)[number], string | null>> =
      {};
    for (const key of INSTRUCTION_SETTING_KEYS) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        previousByKey[key] = await settingsDb.getSetting(key);
      }
    }

    await settingsDb.upsertSettings(body);

    try {
      await notifyAgentsOfInstructionChanges(request, previousByKey, body);
    } catch (err) {
      request.log.error({ err }, 'Failed to notify agents of instruction updates');
    }

    return settingsDb.getAllSettings();
  });
};

async function notifyAgentsOfInstructionChanges(
  request: FastifyRequest,
  previousByKey: Partial<Record<(typeof INSTRUCTION_SETTING_KEYS)[number], string | null>>,
  body: Record<string, string>,
): Promise<void> {
  for (const key of INSTRUCTION_SETTING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    const prev = previousByKey[key];
    const next = body[key];
    const unchanged = prev === next;

    if (key === 'cos_instructions') {
      try {
        await notifyChiefOfStaffInstructionsUpdated(request.log);
      } catch (err) {
        request.log.error({ err }, 'Failed to notify chief of staff webhook of instructions update');
      }
    } else if (key === 'agent_instructions') {
      try {
        await notifyMemberAgentsInstructionsUpdated(request.log);
      } catch (err) {
        request.log.error({ err }, 'Failed to notify member agent webhooks of instructions update');
      }
    }

    if (unchanged) continue;

    const role = key === 'cos_instructions' ? 'chief_of_staff' : 'member';

    const agents = await agentsDb.listAgentsWithEmailByOrgRole(role);
    for (const a of agents) {
      if (!a.email) continue;
      try {
        await emailService.notifyAgentInstructionsUpdated({ email: a.email, name: a.name }, role);
      } catch (err) {
        request.log.error({ err, agentId: a.id }, 'Failed to send instruction update email');
      }
    }
  }
}

export default settingsRoutes;
