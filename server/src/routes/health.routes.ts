import { FastifyPluginAsync } from 'fastify';
import { isDbConnected } from '../config/db.js';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/health', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      uptime: process.uptime(),
      dbConnected: isDbConnected()
    });
  });
};
