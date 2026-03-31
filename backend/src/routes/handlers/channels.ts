import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as channelsDb from '../../db/api/channels.js';
import { backendRequestSchemas } from '../../contracts/mcp-contract.js';
import { parseBody } from '../../lib/errors.js';
import { getDiscordSyncService } from '../../services/discord/index.js';

const createChannelSchema = z.object({
  name: z.string(),
  source: z.enum(['discord', 'manual']).optional(),
  externalId: z.string().optional(),
});

const createMessageSchema = backendRequestSchemas.createMessage;
const DASHBOARD_AUTHOR_NAME = 'Mr';
const DASHBOARD_DISCORD_USER_ID = '1486874215104905367';

function isExternalMessageIdDuplicateError(error: unknown): boolean {
  const e = error as { code?: string; constraint_name?: string };
  return e?.code === '23505' && e?.constraint_name === 'messages_external_message_id_idx';
}

const channelRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: fastify.authenticate }, async () => {
    return channelsDb.listChannels();
  });

  fastify.post('/', { preHandler: [fastify.authenticate, fastify.enforceIdempotency] }, async (request, reply) => {
    const body = parseBody(createChannelSchema, request.body);
    const channel = await channelsDb.createChannel(body);
    await fastify.finalizeIdempotency(request, 201, channel);
    return reply.code(201).send(channel);
  });

  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await channelsDb.deleteChannel(id);
    return reply.code(204).send();
  });

  fastify.get('/:id/messages', { preHandler: fastify.authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    const q = request.query as { limit?: string; before?: string };
    const limit = Math.min(Number(q.limit ?? 50), 200);
    const rows = await channelsDb.listMessages(id, limit, q.before);
    return rows;
  });

  fastify.post(
    '/:id/messages',
    { preHandler: [fastify.authenticate, fastify.enforceIdempotency] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = parseBody(createMessageSchema, request.body);
      const author = DASHBOARD_AUTHOR_NAME;

      const channel = await channelsDb.getChannelById(id);
      if (!channel) {
        return reply.code(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Channel not found',
          },
        });
      }

      let message;
      if (channel.source === 'discord' && !channel.externalId) {
        return reply.code(400).send({
          error: {
            code: 'BAD_REQUEST',
            message: 'Discord channel is missing external mapping',
          },
        });
      }

      if (channel.source === 'discord' && channel.externalId) {
        const discord = getDiscordSyncService();
        if (!discord) {
          return reply.code(503).send({
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Discord sync is not connected',
            },
          });
        }
        let externalMessageId: string;
        try {
          externalMessageId = await discord.sendMessage(channel.externalId, body.content);
        } catch (error) {
          const e = error as { message?: string };
          return reply.code(502).send({
            error: {
              code: 'DISCORD_SEND_FAILED',
              message: e.message ?? 'Discord send failed',
            },
          });
        }
        try {
          message = await channelsDb.createMessage({
            channelId: id,
            author,
            discordUserId: DASHBOARD_DISCORD_USER_ID,
            content: body.content,
            source: 'discord',
            externalMessageId,
          });
        } catch (error) {
          // Discord gateway ingestion can race this write; return existing row when duplicate.
          if (!isExternalMessageIdDuplicateError(error)) {
            throw error;
          }

          const existing = await channelsDb.getMessageByExternalMessageId(externalMessageId);
          if (!existing) {
            throw error;
          }
          message = existing;
        }
      } else {
        message = await channelsDb.createMessage({
          channelId: id,
          author,
          discordUserId: DASHBOARD_DISCORD_USER_ID,
          content: body.content,
          source: channel.source,
        });
      }

      await fastify.finalizeIdempotency(request, 201, message);
      return reply.code(201).send(message);
    },
  );
};

export default channelRoutes;
