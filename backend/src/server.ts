import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDB, disconnectDB } from './config/mongo.js';
import { connectPostgres, disconnectPostgres } from './config/postgres.js';
import { connectS3, disconnectS3 } from './config/s3.js';
import { reportAiStatus } from './ai/client.js';

async function main(): Promise<void> {
  await connectDB();
  await connectPostgres();
  await connectS3();
  reportAiStatus();
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
      try {
        await disconnectPostgres();
      } catch (err) {
        logger.error({ err }, 'Error disconnecting from Postgres');
      }
      try {
        disconnectS3();
      } catch (err) {
        logger.error({ err }, 'Error closing the S3 client');
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
