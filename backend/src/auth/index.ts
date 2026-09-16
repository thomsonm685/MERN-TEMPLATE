import type { RequestHandler } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { env } from '../config/env.js';
import { errorResponse } from '../utils/helpers.js';
import { getAuth } from './better-auth.js';
import { protect as legacyProtect } from '../middleware/auth.js';

/**
 * Provider-neutral identity attached to every authenticated request.
 *
 * Read `req.authUser` in your own routes rather than `req.user` (legacy, a Mongoose
 * document) or a Better Auth session — that is what lets AUTH_PROVIDER be flipped without
 * touching route code.
 */
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  themePreference: 'light' | 'dark';
  emailVerified: boolean;
  provider: 'better-auth' | 'jwt';
}

declare module 'express-serve-static-core' {
  interface Request {
    authUser?: AuthUser;
  }
}

export const authProvider = env.AUTH_PROVIDER;
export const isBetterAuth = env.AUTH_PROVIDER === 'better-auth';

function themeOf(value: unknown): 'light' | 'dark' {
  return value === 'light' ? 'light' : 'dark';
}

/** Splits Better Auth's single `name` when firstName/lastName were never set. */
function splitName(name: string | null | undefined): { firstName: string; lastName: string } {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

/** Reads the Better Auth session cookie, returning null when there is no valid session. */
export async function getSessionUser(
  headers: NodeJS.Dict<string | string[]>,
): Promise<AuthUser | null> {
  const session = await getAuth().api.getSession({ headers: fromNodeHeaders(headers) });
  if (!session?.user) return null;

  const user = session.user as typeof session.user & {
    firstName?: string;
    lastName?: string;
    themePreference?: string;
  };
  const fallback = splitName(user.name);

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName || fallback.firstName,
    lastName: user.lastName || fallback.lastName,
    themePreference: themeOf(user.themePreference),
    emailVerified: Boolean(user.emailVerified),
    provider: 'better-auth',
  };
}

const betterAuthGuard: RequestHandler = async (req, res, next) => {
  try {
    const authUser = await getSessionUser(req.headers);
    if (!authUser) {
      res.status(401).json(errorResponse('Not authorized to access this route', 'UNAUTHORIZED'));
      return;
    }
    req.authUser = authUser;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Populates `req.authUser` from the legacy JWT middleware's Mongoose document, so routes
 * written against `req.authUser` keep working when AUTH_PROVIDER=jwt.
 */
const legacyGuard: RequestHandler = (req, res, next) => {
  void legacyProtect(req, res, () => {
    const user = req.user;
    if (!user) {
      res.status(401).json(errorResponse('Not authorized to access this route', 'UNAUTHORIZED'));
      return;
    }
    req.authUser = {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      themePreference: themeOf(user.settings?.themePreference),
      // The legacy system has no verification flow; treat accounts as verified.
      emailVerified: true,
      provider: 'jwt',
    };
    next();
  });
};

/**
 * Guards a route with whichever provider AUTH_PROVIDER selects. Use this everywhere instead
 * of importing a provider-specific middleware.
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  const guard = isBetterAuth ? betterAuthGuard : legacyGuard;
  guard(req, res, next);
};

export { getAuth } from './better-auth.js';
