import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Env resolution is decided at import time, and each case needs a different NODE_ENV — so
 * each one runs in its own process rather than fighting module caching.
 */
const run = promisify(execFile);
const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// tsx cannot resolve a relative import from --eval, so the probe is a real file.
const probe = path.join(backendDir, 'env-probe.generated.ts');

beforeAll(() => {
  writeFileSync(
    probe,
    `const { env } = await import('./src/config/env.js');\n` +
      `console.log(JSON.stringify({ mongo: env.MONGODB_URI, secret: env.JWT_SECRET }));\n`,
  );
});

afterAll(() => {
  rmSync(probe, { force: true });
});

async function loadEnv(vars: Record<string, string>): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  try {
    const { stdout, stderr } = await run('npx', ['tsx', probe], {
      cwd: backendDir,
      // A clean slate: only PATH and what the case supplies, so a stray .env or an
      // exported shell var cannot make a failing case look like it passes.
      env: { PATH: process.env.PATH ?? '', DOTENV_CONFIG_PATH: '/dev/null', ...vars },
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return { code: e.code ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

describe('development defaults', () => {
  it('boots with no MONGODB_URI or JWT_SECRET at all', async () => {
    const { code, stdout } = await loadEnv({});
    expect(code).toBe(0);

    const parsed = JSON.parse(stdout.trim().split('\n').pop() ?? '{}') as {
      mongo: string;
      secret: string;
    };
    expect(parsed.mongo).toBe('mongodb://127.0.0.1:27017/template');
    // Must still satisfy the 32-character minimum the schema enforces.
    expect(parsed.secret.length).toBeGreaterThanOrEqual(32);
  });

  it('says so, loudly', async () => {
    const { stderr } = await loadEnv({});
    expect(stderr).toContain('development defaults');
  });

  it('derives a secret that survives a restart', async () => {
    // A random per-boot secret would log every user out on each tsx-watch reload.
    const [a, b] = await Promise.all([loadEnv({}), loadEnv({})]);
    expect(JSON.parse(a.stdout.trim().split('\n').pop()!).secret).toBe(
      JSON.parse(b.stdout.trim().split('\n').pop()!).secret,
    );
  });

  it('never overrides an explicit value', async () => {
    const { stdout, stderr } = await loadEnv({
      MONGODB_URI: 'mongodb://127.0.0.1:27017/mine',
      JWT_SECRET: 'an-explicit-secret-of-at-least-32-chars',
    });
    const parsed = JSON.parse(stdout.trim().split('\n').pop() ?? '{}') as { mongo: string };
    expect(parsed.mongo).toBe('mongodb://127.0.0.1:27017/mine');
    expect(stderr).not.toContain('development defaults');
  });

  it('still rejects a malformed value rather than replacing it', async () => {
    // The point is convenience for a missing var, not papering over a typo.
    const { code, stderr } = await loadEnv({ MONGODB_URI: 'not-a-uri' });
    expect(code).toBe(1);
    expect(stderr).toContain('Invalid url');
  });
});

describe('production', () => {
  it('refuses to start without MONGODB_URI and JWT_SECRET', async () => {
    const { code, stderr } = await loadEnv({ NODE_ENV: 'production' });
    expect(code).toBe(1);
    expect(stderr).toContain('required in production');
  });

  it('starts when both are supplied', async () => {
    const { code } = await loadEnv({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/prod',
      JWT_SECRET: 'a-real-production-secret-32-chars-long',
    });
    expect(code).toBe(0);
  });
});
