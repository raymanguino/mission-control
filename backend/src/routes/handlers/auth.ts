import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const loginSchema = z.object({
  password: z.string(),
});

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Invalid body' });
    }

    const expected = process.env['DASHBOARD_PASSWORD'];
    if (!expected || body.data.password !== expected) {
      return reply.code(401).send({ error: 'Invalid password' });
    }

    const token = fastify.jwt.sign({ sub: 'dashboard' }, { expiresIn: '30d' });
    return { token };
  });
};

export default authRoutes;
