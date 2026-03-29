import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import * as agentsDb from '../../db/api/agents.js';
import * as settingsDb from '../../db/api/settings.js';
import * as emailService from '../../services/email.js';
import { parseBody } from '../../lib/errors.js';

const updateSettingsSchema = z.record(z.string(), z.string());

const INSTRUCTION_SETTING_KEYS = ['cos_instructions', 'agent_instructions'] as const;

const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: fastify.authenticate }, async () => {
    return settingsDb.getAllSettings();
  });

  fastify.patch('/', { preHandler: fastify.authenticate }, async (request) => {
    const body = parseBody(updateSettingsSchema, request.body);

    const previousByKey: Partial<Record<(typeof INSTRUCTION_SETTING_KEYS)[number], string | null>> =
      {};
    for (const key of INSTRUCTION_SETTING_KEYS) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        previousByKey[key] = await settingsDb.getSetting(key);
      }
    }

    await settingsDb.upsertSettings(body);

    notifyAgentsOfInstructionChanges(request, previousByKey, body).catch((err) => {
      request.log.error({ err }, 'Failed to notify agents of instruction updates');
    });

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
    if (prev === next) continue;

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
