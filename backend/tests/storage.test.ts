import { describe, it, expect, vi } from 'vitest';

vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/template-test');
vi.stubEnv('JWT_SECRET', 'this-is-a-thirty-two-char-secret-x');
vi.stubEnv('LOG_LEVEL', 'fatal');
// Empty strings must read as "unset", exactly as Docker/CI supply them.
vi.stubEnv('AWS_S3_BUCKET', '');
vi.stubEnv('AWS_ACCESS_KEY_ID', '');
vi.stubEnv('AWS_SECRET_ACCESS_KEY', '');

const { isS3Enabled } = await import('../src/config/env.js');
const { connectS3, disconnectS3, getS3, getBucket, isS3Connected } =
  await import('../src/config/s3.js');
const { buildObjectKey, contentTypeFor } = await import('../src/utils/storage.js');

describe('s3 (no bucket configured)', () => {
  it('stays disabled', () => {
    expect(isS3Enabled).toBe(false);
    expect(isS3Connected()).toBe(false);
  });

  it('connectS3 resolves to null instead of throwing', async () => {
    await expect(connectS3()).resolves.toBeNull();
    expect(isS3Connected()).toBe(false);
  });

  it('getS3 and getBucket throw actionable errors', () => {
    expect(() => getS3()).toThrowError(/S3 is not connected/);
    expect(() => getBucket()).toThrowError(/S3 is not configured/);
  });

  it('disconnectS3 is a no-op', () => {
    expect(() => disconnectS3()).not.toThrow();
  });
});

describe('contentTypeFor', () => {
  it('maps common image and video extensions', () => {
    expect(contentTypeFor('a.jpg')).toBe('image/jpeg');
    expect(contentTypeFor('a.PNG')).toBe('image/png');
    expect(contentTypeFor('clip.mp4')).toBe('video/mp4');
    expect(contentTypeFor('clip.mov')).toBe('video/quicktime');
  });

  it('falls back to octet-stream for unknown or missing extensions', () => {
    expect(contentTypeFor('mystery.xyz')).toBe('application/octet-stream');
    expect(contentTypeFor('no-extension')).toBe('application/octet-stream');
  });
});

describe('buildObjectKey', () => {
  it('slugifies the filename and keeps the extension', () => {
    const key = buildObjectKey('My Holiday Photo!.JPG');
    expect(key).toMatch(/^uploads\/[\dTZ-]+-[0-9a-f]{6}-my-holiday-photo\.jpg$/);
  });

  it('never collides for identical filenames', () => {
    const keys = new Set(Array.from({ length: 200 }, () => buildObjectKey('photo.jpg')));
    expect(keys.size).toBe(200);
  });

  it('honours a custom prefix and trims stray slashes', () => {
    expect(buildObjectKey('a.png', '/avatars/')).toMatch(/^avatars\//);
    expect(buildObjectKey('a.png', '')).not.toContain('/');
  });

  it('neutralises path traversal and other hostile filenames', () => {
    const key = buildObjectKey('../../etc/passwd');
    expect(key).not.toContain('..');
    expect(key.startsWith('uploads/')).toBe(true);
    expect(key.split('/')).toHaveLength(2);
  });
});
