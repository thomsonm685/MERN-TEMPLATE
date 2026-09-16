import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';

/**
 * Better Auth browser client.
 *
 * No `baseURL` is set on purpose: the client then calls `/api/auth/*` on the current origin,
 * which the Vite dev server proxies to the backend (see vite.config.ts). Staying same-origin
 * means the session cookie is first-party — no CORS preflight, and no third-party cookie
 * blocking in Safari or Chrome's incognito.
 *
 * Only set `baseURL` if the API really does live on another origin in production; the backend
 * must then list that origin in `trustedOrigins` and CORS must allow credentials.
 */
export const authClient = createAuthClient({
  plugins: [
    // Mirrors the `additionalFields` declared on the server so `session.user.firstName`
    // and friends are typed here too.
    inferAdditionalFields({
      user: {
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        themePreference: { type: 'string' },
      },
    }),
  ],
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
