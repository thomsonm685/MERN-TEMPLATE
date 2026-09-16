import { describe, it, expect, vi } from 'vitest';
import type { Express } from 'express';

vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/template-test');
vi.stubEnv('JWT_SECRET', 'this-is-a-thirty-two-char-secret-x');
vi.stubEnv('LOG_LEVEL', 'fatal');
vi.stubEnv('AUTH_PROVIDER', 'jwt');
// Empty strings are how Docker/CI supply an unset var — AI must read that as "off".
vi.stubEnv('ANTHROPIC_API_KEY', '');

const request = (await import('supertest')).default;
const { isAiEnabled } = await import('../src/config/env.js');
const { getClaude, isAiConnected } = await import('../src/ai/client.js');
const { createApp } = await import('../src/app.js');

const app: Express = createApp();

describe('ai (no API key)', () => {
  it('is disabled', () => {
    expect(isAiEnabled).toBe(false);
    expect(isAiConnected()).toBe(false);
  });

  it('does not mount the routes at all', async () => {
    const res = await request(app).post('/api/ai/message').send({ messages: [] });
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('getClaude throws an actionable error if something calls it anyway', () => {
    expect(() => getClaude()).toThrowError(/ANTHROPIC_API_KEY/);
  });
});
