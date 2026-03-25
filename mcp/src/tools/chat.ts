import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet, apiPost } from '../client.js';
import type { Channel, Message } from '@mission-control/types';

export function registerChatTools(server: McpServer) {
  server.tool('list_channels', 'List all chat channels', {}, async () => {
    const channels = await apiGet<Channel[]>('/api/channels');
    return {
      content: [{ type: 'text', text: JSON.stringify(channels, null, 2) }],
    };
  });

  server.tool(
    'get_messages',
    'Get recent messages from a channel',
    {
      channelId: z.string().describe('The channel UUID'),
      limit: z.number().int().min(1).max(100).optional().describe('Number of messages (default 50)'),
    },
    async ({ channelId, limit = 50 }) => {
      const messages = await apiGet<Message[]>(
        `/api/channels/${channelId}/messages?limit=${limit}`,
      );
      // Return in chronological order
      const ordered = [...messages].reverse();
      return {
        content: [{ type: 'text', text: JSON.stringify(ordered, null, 2) }],
      };
    },
  );

  server.tool(
    'post_message',
    'Post a message to a channel',
    {
      channelId: z.string().describe('The channel UUID'),
      content: z.string().describe('Message text'),
      author: z.string().optional().describe('Author name (default: "Claude")'),
    },
    async ({ channelId, content, author = 'Claude' }) => {
      const message = await apiPost<Message>(`/api/channels/${channelId}/messages`, {
        author,
        content,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(message, null, 2) }],
      };
    },
  );
}
