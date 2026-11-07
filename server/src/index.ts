import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { buildApp } from './app.js';
import { seedDefaultProfiles } from './services/seed.service.js';

async function startServer() {
  const app = buildApp();

  try {
    console.log('[Server] Initializing database connection...');
    await connectDB();

    console.log('[Server] Seeding default profiles if needed...');
    await seedDefaultProfiles();

    await app.listen({
      port: env.PORT,
      host: env.HOST
    });

    console.log(`[Server] Running on http://${env.HOST}:${env.PORT}`);
    console.log(`[Server] Health check: http://${env.HOST}:${env.PORT}/api/health`);

    const shutdown = async (signal: string) => {
      console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
      try {
        await app.close();
        await disconnectDB();
        console.log('[Server] Shutdown complete.');
        process.exit(0);
      } catch (err) {
        console.error('[Server] Error during shutdown:', err);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    app.log.error(err);
    console.error('[Server] Failed to start:', err);
    await disconnectDB().catch(() => {});
    process.exit(1);
  }
}

// Only start when invoked directly
startServer();
