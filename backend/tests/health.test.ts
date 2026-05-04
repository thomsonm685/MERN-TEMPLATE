import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/template-test');
vi.stubEnv('JWT_SECRET', 'this-is-a-thirty-two-char-secret-x');
vi.stubEnv('LOG_LEVEL', 'fatal');

const { createApp } = await import('../src/app.js');
const request = (await import('supertest')).default;

describe('app smoke', () => {
  const app = createApp();

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('unknown route returns 404 with NOT_FOUND code', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('protected route without token returns 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, error: { code: 'UNAUTHORIZED' } });
  });

  beforeAll(() => {});
  afterAll(() => {});
});
