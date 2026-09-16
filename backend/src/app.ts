import express, { type Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { toNodeHandler } from 'better-auth/node';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { getAuth, isBetterAuth } from './auth/index.js';
import { isAiEnabled } from './config/env.js';
import aiRoutes from './routes/ai.js';
import legacyAuthRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(compression());
  app.use(pinoHttp({ logger }));

  app.use(
    cors({
      origin: [env.FRONTEND_URL],
      credentials: true,
    }),
  );

  app.use(cookieParser());

  // Better Auth owns /api/auth and MUST be mounted before express.json(): it reads the raw
  // request stream, and a body parser that has already consumed it produces empty payloads.
  // The `*splat` named wildcard is Express 5 syntax; Express 4 spells it `/api/auth/*`.
  if (isBetterAuth) {
    app.all('/api/auth/*splat', (req, res, next) => {
      void toNodeHandler(getAuth())(req, res).catch(next);
    });
  }

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.get('/', (_req, res) => {
    res.redirect(env.FRONTEND_URL);
  });

  // Legacy JWT routes only exist when Better Auth is switched off.
  if (!isBetterAuth) app.use('/api/auth', legacyAuthRoutes);

  app.use('/api/user', userRoutes);

  // Only exists when an Anthropic key is configured — otherwise /api/ai 404s like any
  // other unknown route, and the AI code is never reached.
  if (isAiEnabled) app.use('/api/ai', aiRoutes);

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
