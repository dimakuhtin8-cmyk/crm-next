import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';

import { getHealthCheck } from './health';
import { appRouter } from './router';
import { createContext } from './trpc';
import { createFastifyHandler } from './trpc-adapter';

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
  pluginTimeout: 10000,
});

// ============ PLUGINS ============

async function registerPlugins() {
  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  // CORS
  await app.register(cors, {
    origin: ['http://localhost:3000', 'https://crm-next.ua', 'https://staging.crm-next.ua'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id'],
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // tRPC route
  app.all('/trpc/*', createFastifyHandler(appRouter, createContext));
}

// ============ ROUTES ============

app.get('/health', async (_req, reply) => {
  const health = await getHealthCheck();
  const statusCode = health.status === 'error' ? 503 : health.status === 'degraded' ? 200 : 200;
  reply.status(statusCode);
  return health;
});

app.get('/health/ready', async (_req, reply) => {
  const health = await getHealthCheck();
  const isReady = health.checks.database.status === 'ok';
  reply.status(isReady ? 200 : 503);
  return { ready: isReady, database: health.checks.database.status };
});

app.get('/health/live', async () => {
  return { alive: true, timestamp: new Date().toISOString() };
});

app.get('/', async () => {
  return {
    name: 'CRM-Next API',
    version: '0.1.0',
    docs: '/health',
    trpc: '/trpc',
  };
});

// ============ START ============

async function start() {
  try {
    await registerPlugins();

    const port = parseInt(process.env.PORT || '4000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });

    app.log.info(`🚀 API server running on http://${host}:${port}`);
    app.log.info(`📊 Health check: http://${host}:${port}/health`);
    app.log.info(`🔌 tRPC endpoint: http://${host}:${port}/trpc`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

export { app };
