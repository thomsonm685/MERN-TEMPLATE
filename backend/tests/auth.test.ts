import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { Express } from 'express';

/**
 * End-to-end Better Auth coverage against a real MongoDB.
 *
 * `mongodb-memory-server` (already used by `npm run db`) starts a genuine mongod, so this
 * exercises the real adapter, real collections and real session cookies rather than a mock.
 */
vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('JWT_SECRET', 'this-is-a-thirty-two-char-secret-x');
vi.stubEnv('LOG_LEVEL', 'fatal');
vi.stubEnv('AUTH_PROVIDER', 'better-auth');
vi.stubEnv('RESEND_API_KEY', '');

const { MongoMemoryServer } = await import('mongodb-memory-server-core');
const mongo = await MongoMemoryServer.create();
vi.stubEnv('MONGODB_URI', mongo.getUri('auth-test'));

const request = (await import('supertest')).default;
const mongoose = (await import('mongoose')).default;
const { createApp } = await import('../src/app.js');

let app: Express;

beforeAll(async () => {
  await mongoose.connect(mongo.getUri('auth-test'));
  app = createApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const CREDENTIALS = {
  email: 'ada@lovelace.dev',
  password: 'correct-horse-battery',
  name: 'Ada Lovelace',
  firstName: 'Ada',
  lastName: 'Lovelace',
};

/** Better Auth returns its session as a Set-Cookie header. */
function cookiesFrom(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  return Array.isArray(raw) ? raw.join('; ') : String(raw ?? '');
}

describe('better auth — mounted', () => {
  it('serves its own routes at /api/auth', async () => {
    const res = await request(app).get('/api/auth/get-session');
    // No session yet, but the endpoint exists — a 404 would mean the handler is not mounted.
    expect(res.status).not.toBe(404);
  });

  it('does not mount the legacy JWT routes', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(404);
  });
});

describe('better auth — email and password', () => {
  let cookie = '';
  let userId = '';

  it('signs up and issues a session cookie', async () => {
    const res = await request(app).post('/api/auth/sign-up/email').send(CREDENTIALS);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: CREDENTIALS.email, name: CREDENTIALS.name });
    cookie = cookiesFrom(res);
    expect(cookie).toContain('better-auth');
    userId = res.body.user.id as string;
  });

  it('stores the template’s additional fields on the user', async () => {
    const res = await request(app).get('/api/auth/get-session').set('Cookie', cookie);
    expect(res.body.user).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      themePreference: 'dark',
    });
  });

  it('rejects a duplicate email', async () => {
    const res = await request(app).post('/api/auth/sign-up/email').send(CREDENTIALS);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('rejects a wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/sign-in/email')
      .send({ email: CREDENTIALS.email, password: 'wrong-password' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('signs in with the right password', async () => {
    const res = await request(app)
      .post('/api/auth/sign-in/email')
      .send({ email: CREDENTIALS.email, password: CREDENTIALS.password });

    expect(res.status).toBe(200);
    cookie = cookiesFrom(res);
    expect(cookie).toBeTruthy();
  });

  it('returns no session without a cookie', async () => {
    const res = await request(app).get('/api/auth/get-session');
    expect(res.body?.user).toBeFalsy();
  });

  describe('requireAuth on /api/user', () => {
    it('rejects an unauthenticated request with the template error envelope', async () => {
      const res = await request(app)
        .put(`/api/user/${userId}/settings`)
        .send({ themePreference: 'light' });

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ success: false, error: { code: 'UNAUTHORIZED' } });
    });

    it('accepts a session cookie and updates the setting', async () => {
      const res = await request(app)
        .put(`/api/user/${userId}/settings`)
        .set('Cookie', cookie)
        .send({ themePreference: 'light' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        data: { themePreference: 'light' },
      });
    });

    it('persists the change on the Better Auth user', async () => {
      const res = await request(app).get('/api/auth/get-session').set('Cookie', cookie);
      expect(res.body.user.themePreference).toBe('light');
    });

    it('forbids editing somebody else’s profile', async () => {
      const res = await request(app)
        .put(`/api/user/000000000000000000000000/settings`)
        .set('Cookie', cookie)
        .send({ themePreference: 'dark' });

      expect(res.status).toBe(403);
    });

    it('updates first and last name', async () => {
      const res = await request(app)
        .put(`/api/user/${userId}`)
        .set('Cookie', cookie)
        .send({ firstName: 'Augusta', lastName: 'King' });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ firstName: 'Augusta', lastName: 'King' });
    });
  });

  it('signs out and invalidates the session', async () => {
    const out = await request(app).post('/api/auth/sign-out').set('Cookie', cookie);
    expect(out.status).toBe(200);

    const after = await request(app)
      .put(`/api/user/${userId}/settings`)
      .set('Cookie', cookiesFrom(out) || cookie)
      .send({ themePreference: 'dark' });
    expect(after.status).toBe(401);
  });
});

describe('better auth — collections', () => {
  it('uses its own collections and keeps credentials out of the user document', async () => {
    const db = mongoose.connection.db!;
    const names = (await db.listCollections().toArray()).map((c) => c.name);

    // Better Auth owns singular `user`/`session`/`account`.
    expect(names).toEqual(expect.arrayContaining(['user', 'session', 'account']));

    const user = await db.collection('user').findOne({ email: CREDENTIALS.email });
    expect(user).toMatchObject({ email: CREDENTIALS.email });
    // Credentials live in `account`, never on the user document.
    expect(user).not.toHaveProperty('password');
    expect(await db.collection('account').countDocuments({ providerId: 'credential' })).toBe(1);
  });

  it('never writes to the legacy Mongoose users collection', async () => {
    // Mongoose creates `users` (plural) when it builds the User model's indexes, so the
    // collection exists — but switching providers must leave it empty.
    expect(await mongoose.connection.db!.collection('users').countDocuments()).toBe(0);
  });
});
