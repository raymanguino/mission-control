import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ApiError, parseBody } from '../../lib/errors.js';

const loginSchema = z.object({
  password: z.string(),
});

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/login', async (request) => {
    const body = parseBody(loginSchema, request.body);

    const expected = process.env['DASHBOARD_PASSWORD'];
    if (!expected || body.password !== expected) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Invalid password');
    }

    const token = fastify.jwt.sign({ sub: 'dashboard' }, { expiresIn: '30d' });
    return { token };
  });
};

export default authRoutes;
