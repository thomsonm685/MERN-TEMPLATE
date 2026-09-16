import { createHash } from 'node:crypto';
import 'dotenv/config';
import { z } from 'zod';

/** Treat empty strings (common in Docker/CI) as "not set" so optional vars stay optional. */
const emptyToUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());

/** Booleans arrive as strings; accept the usual spellings and fall back to a default. */
const optionalBoolean = (fallback: boolean) =>
  z.preprocess(
    emptyToUndefined,
    z
      .enum(['true', 'false', '1', '0'])
      .optional()
      .transform((value) => (value === undefined ? fallback : value === 'true' || value === '1')),
  );

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    MONGODB_URI: z.string().url(),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRE: z.string().default('7d'),
    FRONTEND_URL: z.string().url().default('http://localhost:5173'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    // Postgres is optional: leave every POSTGRES_* var unset to run without it.
    // Provide either POSTGRES_URL, or the POSTGRES_HOST/DB/USER trio.
    POSTGRES_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    POSTGRES_HOST: optionalString,
    POSTGRES_PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(5432)),
    POSTGRES_DB: optionalString,
    POSTGRES_USER: optionalString,
    POSTGRES_PASSWORD: z.preprocess(emptyToUndefined, z.string().optional()),
    POSTGRES_SCHEMA: optionalString,
    POSTGRES_SSL: z.preprocess(
      emptyToUndefined,
      z.enum(['disable', 'no-verify', 'require', 'allow', 'prefer', 'verify-full']).optional(),
    ),
    POSTGRES_MAX_CONNECTIONS: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().positive().max(100).default(10),
    ),
    POSTGRES_IDLE_TIMEOUT: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().nonnegative().default(30),
    ),
    POSTGRES_CONNECT_TIMEOUT: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().positive().default(10),
    ),

    // S3 is optional: leave AWS_S3_BUCKET unset to run without object storage.
    // Credentials may be omitted entirely — the AWS SDK then falls back to its default
    // provider chain (IAM role, ~/.aws/credentials, container/instance metadata).
    AWS_S3_BUCKET: optionalString,
    AWS_REGION: z.preprocess(emptyToUndefined, z.string().min(1).default('us-east-1')),
    AWS_ACCESS_KEY_ID: optionalString,
    AWS_SECRET_ACCESS_KEY: optionalString,
    AWS_SESSION_TOKEN: optionalString,
    // Point at any S3-compatible service: Cloudflare R2, MinIO, DigitalOcean Spaces, Backblaze.
    AWS_S3_ENDPOINT: z.preprocess(emptyToUndefined, z.string().url().optional()),
    AWS_S3_FORCE_PATH_STYLE: optionalBoolean(false),
    // CDN / CloudFront origin used to build public URLs; falls back to the bucket URL.
    AWS_S3_PUBLIC_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    // Modern buckets have ACLs disabled (Object Ownership: bucket owner enforced), so this
    // is unset by default — setting it on such a bucket fails with AccessControlListNotSupported.
    AWS_S3_ACL: z.preprocess(
      emptyToUndefined,
      z.enum(['private', 'public-read', 'public-read-write', 'authenticated-read']).optional(),
    ),
    AWS_S3_PRESIGN_EXPIRES: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().positive().max(604800).default(900),
    ),
    AWS_S3_MAX_UPLOAD_MB: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().positive().default(100),
    ),

    // Which auth system serves /api/auth. 'better-auth' is the default; 'jwt' falls back to
    // the template's original hand-rolled JWT routes, which are kept but deprecated.
    AUTH_PROVIDER: z.preprocess(
      emptyToUndefined,
      z.enum(['better-auth', 'jwt']).default('better-auth'),
    ),
    // Falls back to JWT_SECRET so the template runs with a single secret.
    BETTER_AUTH_SECRET: z.preprocess(
      emptyToUndefined,
      z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters').optional(),
    ),
    // Public origin of the API. Needed once the backend is not on localhost.
    BETTER_AUTH_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    // MongoDB transactions need a replica set. Safe to enable on Atlas or any replica set;
    // leave off for a standalone mongod, which rejects transactions outright.
    BETTER_AUTH_DB_TRANSACTIONS: optionalBoolean(false),

    // AI is optional: without ANTHROPIC_API_KEY the /api/ai routes are not mounted at all.
    // A server uses an API key, not an interactive `ant auth login` profile, so the key is
    // the gate — the SDK's other credential sources are deliberately not consulted.
    ANTHROPIC_API_KEY: optionalString,
    ANTHROPIC_MODEL: z.preprocess(emptyToUndefined, z.string().min(1).default('claude-opus-5')),
    ANTHROPIC_MAX_TOKENS: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().positive().max(128000).default(16000),
    ),
    // Controls thinking depth and token spend. `high` is the API default.
    ANTHROPIC_EFFORT: z.preprocess(
      emptyToUndefined,
      z.enum(['low', 'medium', 'high', 'xhigh', 'max']).default('high'),
    ),
    // Prepended to every request unless a route overrides it.
    ANTHROPIC_SYSTEM_PROMPT: optionalString,
    // Server-side refusal fallback: if the model declines on safety grounds, the API
    // re-runs the same request on a fallback model within the same call. Claude API only —
    // turn this off if you point the SDK at Bedrock, Vertex or Foundry.
    ANTHROPIC_REFUSAL_FALLBACK: optionalBoolean(true),
    // Per-user cap on the AI routes, which cost real money per call.
    AI_RATE_LIMIT_PER_HOUR: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().positive().default(60),
    ),

    // Email is optional: without RESEND_API_KEY every send is logged to the console
    // instead of going out, so password reset still works on a laptop with no account.
    RESEND_API_KEY: optionalString,
    // Must be a domain verified in Resend. The default is Resend's shared testing
    // sender, which only delivers to the address on your own Resend account.
    EMAIL_FROM: z.preprocess(
      emptyToUndefined,
      z.string().min(1).default('Template <onboarding@resend.dev>'),
    ),
    EMAIL_REPLY_TO: optionalString,
    // Force console-only sending even when a key is present.
    EMAIL_DRY_RUN: optionalBoolean(false),
    // Shown in subjects, layout header and footer.
    APP_NAME: z.preprocess(emptyToUndefined, z.string().min(1).default('Template')),
    EMAIL_TIMEOUT_MS: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().positive().default(10000),
    ),
    EMAIL_MAX_ATTEMPTS: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().positive().max(10).default(3),
    ),
  })
  .superRefine((value, ctx) => {
    if (!value.POSTGRES_URL) {
      const discrete = ['POSTGRES_HOST', 'POSTGRES_DB', 'POSTGRES_USER'] as const;
      const missing = discrete.filter((key) => !value[key]);

      // All three missing → Postgres is simply disabled. Some missing → a typo'd config.
      if (missing.length > 0 && missing.length < discrete.length) {
        for (const key of missing) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `Postgres is partially configured. Set ${missing.join(', ')} (or a single POSTGRES_URL), or unset every POSTGRES_* var to disable Postgres.`,
          });
        }
      }
    }

    // An access key without its secret (or vice versa) is always a mistake. Neither is fine:
    // the SDK then uses its default credential chain.
    const hasKeyId = Boolean(value.AWS_ACCESS_KEY_ID);
    const hasSecret = Boolean(value.AWS_SECRET_ACCESS_KEY);
    if (hasKeyId !== hasSecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [hasKeyId ? 'AWS_SECRET_ACCESS_KEY' : 'AWS_ACCESS_KEY_ID'],
        message:
          'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set together, or both left unset to use the default AWS credential chain.',
      });
    }
  });

/**
 * Development fallbacks.
 *
 * A fresh clone should run with `npm run dev` and nothing else — needing a hand-written
 * .env before the server will even boot is friction with no safety benefit locally. In
 * production both of these stay strictly required, so nothing can ship on a default.
 */
const DEV_MONGODB_URI = 'mongodb://127.0.0.1:27017/template';

/**
 * A per-checkout development signing secret.
 *
 * Derived from the project path rather than randomised, so it is stable across restarts —
 * a random secret would invalidate every session on each `tsx watch` reload, logging you
 * out on every file save. Two different projects get different secrets, and nothing is
 * written to disk. It is not a real secret and is never used in production.
 */
function devJwtSecret(): string {
  return createHash('sha256').update(`template-dev-secret:${process.cwd()}`).digest('hex');
}

const source: NodeJS.ProcessEnv = { ...process.env };
const nodeEnv = source.NODE_ENV?.trim() || 'development';
const usingDevDefaults: string[] = [];

if (nodeEnv !== 'production') {
  if (!source.MONGODB_URI?.trim()) {
    source.MONGODB_URI = DEV_MONGODB_URI;
    usingDevDefaults.push('MONGODB_URI');
  }
  if (!source.JWT_SECRET?.trim()) {
    source.JWT_SECRET = devJwtSecret();
    usingDevDefaults.push('JWT_SECRET');
  }
}

const parsed = envSchema.safeParse(source);

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  console.error('Invalid environment variables:', fieldErrors);
  if (nodeEnv === 'production' && ('MONGODB_URI' in fieldErrors || 'JWT_SECRET' in fieldErrors)) {
    console.error(
      '\nMONGODB_URI and JWT_SECRET have development defaults, but are required in production.\n' +
        'Set them in the environment before deploying. Generate a secret with:\n' +
        "  node -e \"console.log(require('node:crypto').randomBytes(48).toString('base64url'))\"",
    );
  }
  process.exit(1);
}

if (usingDevDefaults.length > 0) {
  // Loud on purpose: convenient locally, but you should never see this in a deployed log.
  console.warn(
    `[env] Using development defaults for ${usingDevDefaults.join(', ')}. ` +
      `Copy .env.example to .env to override. Production requires both.`,
  );
}

export const env = parsed.data;
export type Env = typeof env;

/** Postgres wiring only activates when credentials are present. */
export const isPostgresEnabled = Boolean(env.POSTGRES_URL ?? env.POSTGRES_HOST);

/** S3 wiring only activates when a bucket is named. */
export const isS3Enabled = Boolean(env.AWS_S3_BUCKET);

/** True when Better Auth serves /api/auth; false selects the deprecated JWT routes. */
export const isBetterAuthEnabled = env.AUTH_PROVIDER === 'better-auth';

/** The /api/ai routes exist only when an Anthropic key is present. */
export const isAiEnabled = Boolean(env.ANTHROPIC_API_KEY);

/** With no API key (or EMAIL_DRY_RUN) messages are logged instead of sent. */
export const isEmailEnabled = Boolean(env.RESEND_API_KEY) && !env.EMAIL_DRY_RUN;
