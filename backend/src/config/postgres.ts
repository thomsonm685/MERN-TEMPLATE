import postgres from 'postgres';
import { env, isPostgresEnabled } from './env.js';
import { logger } from './logger.js';

export type Sql = postgres.Sql<Record<string, never>>;

let client: Sql | null = null;

/**
 * postgres.js accepts `false`, a mode string, or TLS options.
 * Managed providers (Supabase, Neon, RDS, Railway) usually need `no-verify`.
 */
function resolveSsl(): postgres.Options<Record<string, never>>['ssl'] {
  const mode = env.POSTGRES_SSL ?? (env.NODE_ENV === 'production' ? 'no-verify' : 'disable');

  if (mode === 'disable') return false;
  if (mode === 'no-verify') return { rejectUnauthorized: false };
  return mode;
}

/** Connection target with the password removed — safe to log. */
function describeTarget(): string {
  if (env.POSTGRES_URL) {
    try {
      const url = new URL(env.POSTGRES_URL);
      if (url.password) url.password = '********';
      return url.toString();
    } catch {
      return 'postgres://<invalid-url>';
    }
  }
  const user = env.POSTGRES_USER ?? 'postgres';
  return `postgres://${user}:********@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}`;
}

function createClient(): Sql {
  const options = {
    max: env.POSTGRES_MAX_CONNECTIONS,
    idle_timeout: env.POSTGRES_IDLE_TIMEOUT,
    connect_timeout: env.POSTGRES_CONNECT_TIMEOUT,
    ssl: resolveSsl(),
    // Send JS `undefined` as SQL NULL instead of throwing on missing params.
    transform: { undefined: null },
    onnotice: (notice: postgres.Notice) => logger.debug({ notice }, 'Postgres notice'),
    ...(env.POSTGRES_SCHEMA && { connection: { search_path: env.POSTGRES_SCHEMA } }),
  } satisfies postgres.Options<Record<string, never>>;

  if (env.POSTGRES_URL) return postgres(env.POSTGRES_URL, options);

  return postgres({
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    database: env.POSTGRES_DB,
    username: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    ...options,
  });
}

/**
 * Opens the pool and verifies it with a round-trip. No-ops (returning `null`) when no
 * POSTGRES_* credentials are configured; exits the process when credentials are set but wrong,
 * mirroring `connectDB()`.
 */
export async function connectPostgres(): Promise<Sql | null> {
  if (!isPostgresEnabled) {
    logger.debug(
      'Postgres not configured — skipping (set POSTGRES_URL or POSTGRES_HOST to enable)',
    );
    return null;
  }
  if (client) return client;

  const sql = createClient();
  try {
    await sql`select 1`;
  } catch (err) {
    logger.fatal({ err, target: describeTarget() }, 'Postgres connection failed');
    await sql.end({ timeout: 5 }).catch(() => undefined);
    process.exit(1);
  }

  client = sql;
  logger.info({ target: describeTarget() }, 'Postgres connected');
  return client;
}

export async function disconnectPostgres(): Promise<void> {
  if (!client) return;
  const sql = client;
  client = null;
  await sql.end({ timeout: 5 });
  logger.info('Postgres disconnected');
}

/**
 * The tagged-template query client, e.g. `await getSql()\`select * from users\``.
 * Throws when Postgres is not configured, so a missing `.env` fails loudly at the call site.
 */
export function getSql(): Sql {
  if (!client) {
    throw new Error(
      'Postgres is not connected. Set POSTGRES_URL (or POSTGRES_HOST/POSTGRES_DB/POSTGRES_USER) and call connectPostgres() during startup.',
    );
  }
  return client;
}

export function isPostgresConnected(): boolean {
  return client !== null;
}

/** Cheap liveness check — useful for a readiness probe. */
export async function pingPostgres(): Promise<boolean> {
  if (!client) return false;
  try {
    await client`select 1`;
    return true;
  } catch (err) {
    logger.error({ err }, 'Postgres ping failed');
    return false;
  }
}
