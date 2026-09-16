import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { Express } from 'express';

/**
 * Proves the escape hatch: with AUTH_PROVIDER=jwt the template's original auth system serves
 * /api/auth again, Better Auth is not mounted, and `requireAuth` keeps protecting routes.
 *
 * If this suite ever fails, switching back is no longer a one-line change.
 */
vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('JWT_SECRET', 'this-is-a-thirty-two-char-secret-x');
vi.stubEnv('LOG_LEVEL', 'fatal');
vi.stubEnv('AUTH_PROVIDER', 'jwt');
vi.stubEnv('RESEND_API_KEY', '');

const { MongoMemoryServer } = await import('mongodb-memory-server-core');
const mongo = await MongoMemoryServer.create();
vi.stubEnv('MONGODB_URI', mongo.getUri('legacy-auth-test'));

const request = (await import('supertest')).default;
const mongoose = (await import('mongoose')).default;
const { createApp } = await import('../src/app.js');

let app: Express;

beforeAll(async () => {
  await mongoose.connect(mongo.getUri('legacy-auth-test'));
  app = createApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const CREDENTIALS = {
  email: 'grace@hopper.dev',
  password: 'correct-horse-battery',
  firstName: 'Grace',
  lastName: 'Hopper',
};

describe('legacy JWT provider', () => {
  let token = '';
  let userId = '';

  it('mounts the legacy routes and not Better Auth', async () => {
    const legacy = await request(app).get('/api/auth/me');
    expect(legacy.status).toBe(401); // exists, but unauthenticated

    const betterAuth = await request(app).get('/api/auth/get-session');
    expect(betterAuth.status).toBe(404); // not mounted
  });

  it('signs up and returns a bearer token', async () => {
    const res = await request(app).post('/api/auth/signup').send(CREDENTIALS);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true });
    token = res.body.data.token as string;
    userId = res.body.data.user._id as string;
    expect(token).toBeTruthy();
  });

  it('logs in with the right password and rejects the wrong one', async () => {
    const ok = await request(app)
      .post('/api/auth/login')
      .send({ email: CREDENTIALS.email, password: CREDENTIALS.password });
    expect(ok.status).toBe(200);

    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: CREDENTIALS.email, password: 'nope' });
    expect(bad.status).toBe(401);
  });

  it('returns the current user from /api/auth/me', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: CREDENTIALS.email, firstName: 'Grace' });
  });

  it('protects /api/user through the shared requireAuth middleware', async () => {
    const anon = await request(app)
      .put(`/api/user/${userId}/settings`)
      .send({ themePreference: 'light' });
    expect(anon.status).toBe(401);

    const authed = await request(app)
      .put(`/api/user/${userId}/settings`)
      .set('Authorization', `Bearer ${token}`)
      .send({ themePreference: 'light' });

    expect(authed.status).toBe(200);
    expect(authed.body.data).toMatchObject({ themePreference: 'light' });
  });

  it('writes to the Mongoose users collection, not Better Auth’s', async () => {
    const db = mongoose.connection.db!;
    expect(await db.collection('users').countDocuments()).toBe(1);

    const names = (await db.listCollections().toArray()).map((c) => c.name);
    expect(names).not.toContain('session');
    expect(names).not.toContain('account');
  });
});
