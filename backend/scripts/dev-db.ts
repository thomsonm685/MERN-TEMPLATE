/**
 * Local development databases with no system installs.
 *
 *   npm run db              # start Mongo + Postgres
 *   npm run db -- --mongo   # just Mongo
 *   npm run db -- --postgres
 *
 * Both servers are real binaries (not emulators) managed by npm packages, and both persist
 * to `backend/.devdata/` so data survives restarts. Ports, database names and credentials are
 * read from `.env`, so whatever the app connects to is what this script serves. Remote hosts
 * (Atlas, Supabase, RDS) are detected and skipped rather than shadowed by a local server.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.join(scriptDir, '..', '.devdata');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
const isLocal = (host: string): boolean => LOCAL_HOSTS.has(host);

interface MongoConfig {
  host: string;
  port: number;
  dbName: string;
  local: boolean;
}

interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  local: boolean;
  configured: boolean;
}

function resolveMongo(): MongoConfig {
  const raw = process.env.MONGODB_URI?.trim() || 'mongodb://127.0.0.1:27017/template';
  try {
    const url = new URL(raw);
    return {
      host: url.hostname,
      port: Number(url.port) || 27017,
      dbName: url.pathname.replace(/^\//, '') || 'template',
      // mongodb+srv always points at a hosted cluster.
      local: url.protocol === 'mongodb:' && isLocal(url.hostname),
    };
  } catch {
    console.error(`MONGODB_URI is not a valid URI: ${raw}`);
    process.exit(1);
  }
}

function resolvePostgres(): PostgresConfig {
  const url = process.env.POSTGRES_URL?.trim();
  if (url) {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname,
        port: Number(parsed.port) || 5432,
        database: parsed.pathname.replace(/^\//, '') || 'template',
        user: decodeURIComponent(parsed.username) || 'postgres',
        password: decodeURIComponent(parsed.password) || 'postgres',
        local: isLocal(parsed.hostname),
        configured: true,
      };
    } catch {
      console.error(`POSTGRES_URL is not a valid URI: ${url}`);
      process.exit(1);
    }
  }

  const host = process.env.POSTGRES_HOST?.trim() || '127.0.0.1';
  return {
    host,
    port: Number(process.env.POSTGRES_PORT?.trim()) || 5432,
    database: process.env.POSTGRES_DB?.trim() || 'template',
    user: process.env.POSTGRES_USER?.trim() || 'postgres',
    password: process.env.POSTGRES_PASSWORD?.trim() || 'postgres',
    local: isLocal(host),
    configured: Boolean(process.env.POSTGRES_HOST?.trim()),
  };
}

function portInUse(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', (err: NodeJS.ErrnoException) => {
      resolve(err.code === 'EADDRINUSE');
    });
    probe.once('listening', () => probe.close(() => resolve(false)));
    probe.listen(port, host === '::1' ? '::1' : '127.0.0.1');
  });
}

async function assertPortFree(label: string, port: number, host: string): Promise<void> {
  if (!(await portInUse(port, host))) return;
  console.error(
    `\n✖ ${label} port ${port} is already in use.\n` +
      `  Something else (a system ${label} install, Docker, or another 'npm run db') owns it.\n` +
      `  Stop it, or point .env at a different port and re-run.\n`,
  );
  process.exit(1);
}

type Stopper = () => Promise<void>;

async function startMongo(config: MongoConfig): Promise<Stopper> {
  const { MongoMemoryReplSet } = await import('mongodb-memory-server-core');
  const dbPath = path.join(dataRoot, 'mongo');
  mkdirSync(dbPath, { recursive: true });

  // A 1-node replica set (not a standalone) so transactions and change streams work,
  // matching what a real deployment supports. The replica set name and port are written
  // into the data directory — change the port and you must `npm run db:reset`.
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, name: 'rs0', storageEngine: 'wiredTiger', dbName: config.dbName },
    instanceOpts: [{ port: config.port, dbPath, storageEngine: 'wiredTiger' }],
  });

  console.log(`  MongoDB   mongodb://127.0.0.1:${config.port}/${config.dbName}`);
  // doCleanup:false keeps the data directory on disk between runs.
  return async () => {
    await replSet.stop({ doCleanup: false });
  };
}

async function startPostgres(config: PostgresConfig): Promise<Stopper> {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const databaseDir = path.join(dataRoot, 'postgres');

  const pg = new EmbeddedPostgres({
    databaseDir,
    user: config.user,
    password: config.password,
    port: config.port,
    persistent: true,
  });

  // initialise() runs initdb, which refuses to touch a non-empty directory.
  if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) {
    console.log('  (first run — initialising the Postgres cluster)');
    await pg.initialise();
  }
  await pg.start();

  // embedded-postgres creates a database named after the user; ensure the configured one exists.
  try {
    await pg.createDatabase(config.database);
  } catch {
    // Already exists — expected on every run after the first.
  }

  console.log(
    `  Postgres  postgres://${config.user}:${config.password}@127.0.0.1:${config.port}/${config.database}`,
  );
  return () => pg.stop();
}

async function main(): Promise<void> {
  const flags = process.argv.slice(2);
  const only = flags.find((flag) => flag === '--mongo' || flag === '--postgres');
  const wantMongo = only !== '--postgres';
  const wantPostgres = only !== '--mongo';

  const mongo = resolveMongo();
  const postgres = resolvePostgres();

  const runMongo = wantMongo && mongo.local;
  const runPostgres = wantPostgres && postgres.local;

  if (wantMongo && !mongo.local) {
    console.log(`→ Skipping MongoDB: MONGODB_URI points at a remote host (${mongo.host}).`);
  }
  if (wantPostgres && !postgres.local) {
    console.log(`→ Skipping Postgres: credentials point at a remote host (${postgres.host}).`);
  }
  if (!runMongo && !runPostgres) {
    console.log('Nothing to start.');
    return;
  }

  if (runMongo) await assertPortFree('MongoDB', mongo.port, mongo.host);
  if (runPostgres) await assertPortFree('Postgres', postgres.port, postgres.host);

  console.log('\nStarting local databases (first run downloads binaries)...\n');

  const stoppers: Stopper[] = [];
  if (runMongo) stoppers.push(await startMongo(mongo));
  if (runPostgres) stoppers.push(await startPostgres(postgres));

  console.log(`\n  Data persists in backend/.devdata — 'npm run db:reset' wipes it.`);

  if (runPostgres && !postgres.configured) {
    console.log(
      `\n  Postgres is running but the app ignores it until .env has:\n` +
        `    POSTGRES_HOST=127.0.0.1\n` +
        `    POSTGRES_PORT=${postgres.port}\n` +
        `    POSTGRES_DB=${postgres.database}\n` +
        `    POSTGRES_USER=${postgres.user}\n` +
        `    POSTGRES_PASSWORD=${postgres.password}`,
    );
  }

  console.log('\nReady. Press Ctrl+C to stop.\n');

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('\nStopping databases...');
    for (const stop of stoppers) {
      try {
        await stop();
      } catch (err) {
        console.error('Error during shutdown:', err);
      }
    }
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  console.error('Failed to start local databases:', err);
  process.exit(1);
});
