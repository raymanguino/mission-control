import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as settingsDb from '../../db/api/settings.js';
import { parseBody } from '../../lib/errors.js';

const updateSettingsSchema = z.record(z.string(), z.string());

const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: fastify.authenticate }, async () => {
    return settingsDb.getAllSettings();
  });

  fastify.patch('/', { preHandler: fastify.authenticate }, async (request) => {
    const body = parseBody(updateSettingsSchema, request.body);
    await settingsDb.upsertSettings(body);
    return settingsDb.getAllSettings();
  });
};

export default settingsRoutes;
