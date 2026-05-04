import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

export async function connectDB(): Promise<typeof mongoose> {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI);
    logger.info({ host: conn.connection.host }, 'MongoDB connected');
    return conn;
  } catch (err) {
    logger.fatal({ err }, 'MongoDB connection failed');
    process.exit(1);
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
