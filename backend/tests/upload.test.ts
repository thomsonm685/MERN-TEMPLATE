import { describe, it, expect, vi } from 'vitest';

vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/template-test');
vi.stubEnv('JWT_SECRET', 'this-is-a-thirty-two-char-secret-x');
vi.stubEnv('LOG_LEVEL', 'fatal');
vi.stubEnv('AWS_S3_BUCKET', '');
vi.stubEnv('AWS_S3_MAX_UPLOAD_MB', '100');

import type { Express, RequestHandler } from 'express';

const express = (await import('express')).default;
const request = (await import('supertest')).default;
const { createUploader, withUploadErrors, uploadImage } =
  await import('../src/middleware/upload.js');

/** An upload route that stops at the middleware — no S3 credentials needed. */
function appWith(middleware: RequestHandler): Express {
  const app = express();
  app.post('/upload', withUploadErrors(middleware), (req, res) => {
    res.json({ received: req.file?.originalname, bytes: req.file?.size });
  });
  return app;
}

const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

describe('upload middleware', () => {
  it('accepts an allowed image and exposes it as a buffer', async () => {
    const res = await request(appWith(uploadImage.single('file')))
      .post('/upload')
      .attach('file', PNG, { filename: 'avatar.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: 'avatar.png', bytes: PNG.length });
  });

  it('rejects a disallowed content type with the standard error envelope', async () => {
    const res = await request(appWith(uploadImage.single('file')))
      .post('/upload')
      .attach('file', Buffer.from('MZ'), {
        filename: 'evil.exe',
        contentType: 'application/x-msdownload',
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: { code: 'UPLOAD_ERROR' } });
  });

  it('rejects a video through the image-only uploader', async () => {
    const res = await request(appWith(uploadImage.single('file')))
      .post('/upload')
      .attach('file', Buffer.alloc(16), { filename: 'clip.mp4', contentType: 'video/mp4' });

    expect(res.status).toBe(400);
  });

  it("reports the uploader's own size cap, not the global default", async () => {
    const tiny = createUploader({ allowed: ['image/png'], maxSizeMb: 1 });
    const res = await request(appWith(tiny.single('file')))
      .post('/upload')
      .attach('file', Buffer.alloc(2 * 1024 * 1024), {
        filename: 'big.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(400);
    // Regression guard: this once read AWS_S3_MAX_UPLOAD_MB (100) instead of the 1MB limit.
    expect(res.body.error.message).toContain('max 1MB');
  });
});
