import fastify, { FastifyError, FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { healthRoutes } from './routes/health.routes.js';
import { profileRoutes } from './routes/profiles.routes.js';
import { videoRoutes } from './routes/videos.routes.js';
import { learningRoutes } from './routes/learning.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function buildApp(opts: FastifyServerOptions = {}): FastifyInstance {
  const app = fastify({
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info'
    },
    ...opts
  });

  // Enable CORS
  app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true
  });

  // Register API Routes
  app.register(healthRoutes);
  app.register(profileRoutes);
  app.register(videoRoutes);
  app.register(learningRoutes);

  // Serve Web App Static Build if available (web/dist)
  const distPath = path.resolve(__dirname, '../../web/dist');
  if (fs.existsSync(distPath)) {
    app.register(fastifyStatic, {
      root: distPath,
      prefix: '/',
      wildcard: false
    });

    // SPA fallback: any non-API route serves index.html
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url && req.raw.url.startsWith('/api')) {
        return reply.status(404).send({ error: 'Endpoint not found' });
      }
      return reply.sendFile('index.html');
    });
  }

  // Global Error Handler
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      statusCode,
      error: error.name || 'InternalServerError',
      message: error.message || 'An unexpected error occurred'
    });
  });

  return app;
}
