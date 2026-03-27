import type { FastifyPluginAsync } from 'fastify';
import * as intentsDb from '../../db/api/intents.js';
import { backendRequestSchemas } from '../../contracts/mcp-contract.js';
import { ApiError, parseBody } from '../../lib/errors.js';

const createIntentSchema = backendRequestSchemas.createIntent;
const updateIntentSchema = backendRequestSchemas.updateIntent;
const convertIntentSchema = backendRequestSchemas.convertIntent;

const intentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: fastify.authenticate }, async () => {
    return intentsDb.listIntents();
  });

  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    const intent = await intentsDb.getIntent(id);
    if (!intent) throw new ApiError(404, 'NOT_FOUND', 'Not found');
    return intent;
  });

  fastify.post(
    '/',
    { preHandler: [fastify.authenticate, fastify.enforceIdempotency] },
    async (request, reply) => {
      const body = parseBody(createIntentSchema, request.body);
      const intent = await intentsDb.createIntent(body);
      await fastify.finalizeIdempotency(request, 201, intent);
      return reply.code(201).send(intent);
    },
  );

  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updateIntentSchema, request.body);
    const intent = await intentsDb.updateIntent(id, body);
    if (!intent) throw new ApiError(404, 'NOT_FOUND', 'Not found');
    return intent;
  });

  fastify.post(
    '/:id/convert',
    { preHandler: [fastify.authenticate, fastify.enforceIdempotency] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = parseBody(convertIntentSchema, request.body);
      const existing = await intentsDb.getIntent(id);
      if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Not found');
      if (existing.status === 'converted') {
        throw new ApiError(409, 'CONFLICT', 'Intent is already converted');
      }

      const result = await intentsDb.convertIntentToProject(id, {
        name: body.projectName,
        description: body.projectDescription,
      });

      if (!result.intent) throw new ApiError(404, 'NOT_FOUND', 'Not found');

      const response = { intent: result.intent, project: result.project };
      await fastify.finalizeIdempotency(request, 201, response);
      return reply.code(201).send(response);
    },
  );
};

export default intentRoutes;
