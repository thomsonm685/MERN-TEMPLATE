import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { emailTriggers } from '../email/index.js';

/**
 * The Better Auth instance.
 *
 * Built lazily because the MongoDB adapter needs a live `Db`, which only exists after
 * `connectDB()` has run. `getAuth()` is safe to call from a request handler; calling it
 * before the database is connected throws rather than silently building a broken instance.
 */
let instance: ReturnType<typeof buildAuth> | null = null;

function buildAuth() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Better Auth needs a live MongoDB connection. Call connectDB() first.');
  }

  return betterAuth({
    // BETTER_AUTH_SECRET is validated in config/env.ts; it falls back to JWT_SECRET so the
    // template works with one secret out of the box.
    secret: env.BETTER_AUTH_SECRET ?? env.JWT_SECRET,
    baseURL: env.BETTER_AUTH_URL ?? `http://localhost:${env.PORT}`,
    // Matches where app.ts mounts the handler.
    basePath: '/api/auth',

    // Passing `client` enables MongoDB transactions, which require a replica set — a plain
    // standalone mongod (a local install, or `docker compose up mongo`) rejects every write
    // with "Transaction numbers are only allowed on a replica set member or mongos".
    // Off by default so the template works everywhere; turn it on for Atlas or any replica
    // set to get atomic multi-document writes.
    database: env.BETTER_AUTH_DB_TRANSACTIONS
      ? mongodbAdapter(db, { client: mongoose.connection.getClient() })
      : mongodbAdapter(db),

    // Browsers on a different origin (the Vite dev server) must be allowed to set cookies.
    trustedOrigins: [env.FRONTEND_URL],

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // Wired to the template's Resend integration. Without RESEND_API_KEY the message is
      // logged to the console, so password reset stays usable with no email account.
      sendResetPassword: async ({ user, url }) => {
        await emailTriggers.passwordResetLink(
          { email: user.email, firstName: firstNameOf(user.name) },
          url,
        );
      },
    },

    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        await emailTriggers.emailVerificationLink(
          { email: user.email, firstName: firstNameOf(user.name) },
          url,
        );
      },
    },

    user: {
      // Better Auth models a single `name`. The template's UI uses first/last, so both are
      // kept as additional fields and `name` is derived from them at signup.
      additionalFields: {
        firstName: { type: 'string', required: false, input: true },
        lastName: { type: 'string', required: false, input: true },
        themePreference: {
          type: 'string',
          required: false,
          defaultValue: 'dark',
          input: true,
        },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },

    advanced: {
      database: { joins: true },
    },
  });
}

function firstNameOf(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? 'there';
}

export function getAuth(): ReturnType<typeof buildAuth> {
  instance ??= buildAuth();
  return instance;
}

/** Test seam — drops the memoised instance so a new connection can build a fresh one. */
export function resetAuth(): void {
  instance = null;
}

export type Auth = ReturnType<typeof getAuth>;
