import multer, { MulterError } from 'multer';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { env } from '../config/env.js';
import { errorResponse } from '../utils/helpers.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by createUploader so the error handler can report the limit that actually applied. */
    uploadMaxSizeMb?: number;
  }
}

export const IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/heic',
] as const;

export const VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'video/x-matroska',
] as const;

export interface UploaderOptions {
  /** Allowed MIME types. Defaults to images + video. */
  allowed?: readonly string[];
  /** Per-file cap in megabytes. Defaults to AWS_S3_MAX_UPLOAD_MB. */
  maxSizeMb?: number;
  /** Max files in a single request. */
  maxFiles?: number;
}

/**
 * Multer configured for S3 hand-off.
 *
 * Files land in memory as `req.file.buffer` / `req.files[].buffer`, ready to pass straight to
 * `uploadObject()` — no temp files to clean up. That is the right trade for images and short
 * clips, but a 2GB video would sit entirely in RSS: for large media, skip this middleware and
 * hand the browser a presigned PUT URL from `getUploadUrl()` so the bytes never reach Node.
 */
export function createUploader(options: UploaderOptions = {}) {
  const allowed = options.allowed ?? [...IMAGE_TYPES, ...VIDEO_TYPES];
  const maxSizeMb = options.maxSizeMb ?? env.AWS_S3_MAX_UPLOAD_MB;

  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxSizeMb * 1024 * 1024,
      files: options.maxFiles ?? 1,
    },
    fileFilter: (req, file, cb) => {
      // Recorded here (before multer enforces limits.fileSize) so a LIMIT_FILE_SIZE error
      // can report this uploader's cap rather than the global default.
      req.uploadMaxSizeMb = maxSizeMb;
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
        return;
      }
      // Surfaces as a MulterError so uploadErrorHandler can turn it into a 400.
      cb(new MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
    },
  });
}

/** Images only — a tighter default for avatars and thumbnails. */
export const uploadImage = createUploader({ allowed: IMAGE_TYPES, maxSizeMb: 10 });

/** Images and video, capped by AWS_S3_MAX_UPLOAD_MB. */
export const uploadMedia = createUploader();

function multerErrorResponse(err: MulterError, maxSizeMb: number) {
  const message =
    err.code === 'LIMIT_FILE_SIZE'
      ? `File is too large (max ${maxSizeMb}MB)`
      : err.code === 'LIMIT_UNEXPECTED_FILE'
        ? 'Unsupported file type or unexpected field'
        : err.message;

  return errorResponse(message, 'UPLOAD_ERROR', { code: err.code });
}

/**
 * Wraps an upload middleware so rejected files become 400s in the template's error envelope.
 * This is the recommended way to mount an uploader:
 *
 *   router.post('/avatar', protect, withUploadErrors(uploadImage.single('file')), handler)
 *
 * Preferred over the standalone `uploadErrorHandler` because it stays a normal
 * RequestHandler — a 4-argument error handler placed mid-chain defeats Express's route
 * type inference, leaving the following handler's `req`/`res` implicitly `any`.
 */
export function withUploadErrors(middleware: RequestHandler): RequestHandler {
  return (req, res, next) => {
    middleware(req, res, (err: unknown) => {
      if (err instanceof MulterError) {
        res
          .status(400)
          .json(multerErrorResponse(err, req.uploadMaxSizeMb ?? env.AWS_S3_MAX_UPLOAD_MB));
        return;
      }
      next(err);
    });
  };
}

/**
 * The same translation as an Express error handler, for mounting app- or router-wide
 * (`router.use(uploadErrorHandler)`) rather than per route.
 */
export const uploadErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (!(err instanceof MulterError)) {
    next(err);
    return;
  }
  res.status(400).json(multerErrorResponse(err, req.uploadMaxSizeMb ?? env.AWS_S3_MAX_UPLOAD_MB));
};
