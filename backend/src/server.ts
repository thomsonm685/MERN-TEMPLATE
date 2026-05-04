import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDB, disconnectDB } from './config/mongo.js';

async function main(): Promise<void> {
  await connectDB();
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server listening');
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info({ signal }, 'Shutting down');
    server.close(async (closeErr) => {
      if (closeErr) logger.error({ err: closeErr }, 'Error closing HTTP server');
      try {
        await disconnectDB();
      } catch (err) {
        logger.error({ err }, 'Error disconnecting from MongoDB');
      }
      process.exit(closeErr ? 1 : 0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection');
    shutdown('SIGTERM');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    shutdown('SIGTERM');
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
