import { describe, it, expect, vi } from 'vitest';

vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/template-test');
vi.stubEnv('JWT_SECRET', 'this-is-a-thirty-two-char-secret-x');
vi.stubEnv('LOG_LEVEL', 'fatal');
// Docker/CI often export these as empty strings — they must still count as "unset".
vi.stubEnv('POSTGRES_URL', '');
vi.stubEnv('POSTGRES_HOST', '');

const { isPostgresEnabled } = await import('../src/config/env.js');
const { connectPostgres, disconnectPostgres, getSql, isPostgresConnected, pingPostgres } =
  await import('../src/config/postgres.js');

describe('postgres (no credentials configured)', () => {
  it('stays disabled', () => {
    expect(isPostgresEnabled).toBe(false);
    expect(isPostgresConnected()).toBe(false);
  });

  it('connectPostgres resolves to null instead of throwing', async () => {
    await expect(connectPostgres()).resolves.toBeNull();
    expect(isPostgresConnected()).toBe(false);
  });

  it('getSql throws an actionable error', () => {
    expect(() => getSql()).toThrowError(/Postgres is not connected/);
  });

  it('pingPostgres reports false and disconnectPostgres is a no-op', async () => {
    await expect(pingPostgres()).resolves.toBe(false);
    await expect(disconnectPostgres()).resolves.toBeUndefined();
  });
});
