import type { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { errorResponse } from '../utils/helpers.js';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly isOperational = true;

  constructor(message: string, statusCode: number, code = 'ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json(errorResponse('Route not found', 'NOT_FOUND'));
};

export const globalErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const code = err instanceof AppError ? err.code : 'SERVER_ERROR';
  const message = err instanceof Error ? err.message : 'Internal Server Error';

  logger.error({ err }, 'Request failed');

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code,
      ...(env.NODE_ENV === 'development' && err instanceof Error && { stack: err.stack }),
    },
  });
};
