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
      const { discordUserId, ...messageBody } = body;

      let author = messageBody.author;
      if (discordUserId) {
        const discord = getDiscordSyncService();
        if (!discord) {
          return reply.code(503).send({
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Discord sync is not connected',
            },
          });
        }
        try {
          author = await discord.resolveAuthorForUserId(discordUserId);
        } catch (error) {
          const e = error as { message?: string };
          return reply.code(400).send({
            error: {
              code: 'DISCORD_USER_RESOLVE_FAILED',
              message: e.message ?? 'Could not resolve Discord user',
            },
          });
        }
      } else if (!author) {
        return reply.code(400).send({
          error: {
            code: 'BAD_REQUEST',
            message: 'author is required when discordUserId is not set',
          },
        });
      }

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
          externalMessageId = await discord.sendMessage(channel.externalId, messageBody.content, {
            prefixMissionControl: true,
          });
        } catch (error) {
          const e = error as { message?: string };
          return reply.code(502).send({
            error: {
              code: 'DISCORD_SEND_FAILED',
              message: e.message ?? 'Discord send failed',
            },
          });
        }
        message = await channelsDb.createMessage({
          channelId: id,
          author,
          content: messageBody.content,
          fromMissionControl: true,
          agentId: messageBody.agentId,
          source: 'discord',
          externalMessageId,
        });
      } else {
        message = await channelsDb.createMessage({
          channelId: id,
          author,
          content: messageBody.content,
          fromMissionControl: true,
          agentId: messageBody.agentId,
          source: channel.source,
        });
      }

      await fastify.finalizeIdempotency(request, 201, message);
      return reply.code(201).send(message);
    },
  );
};

export default channelRoutes;
