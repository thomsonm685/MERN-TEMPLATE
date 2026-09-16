# Build patterns — copy-ready code

Everything here matches the template's conventions exactly (see `ARCHITECTURE.md` in the
generated project). Adapt names; do not change the shapes.

Two lint rules bite generated code, both set to `error` in this template:

- **`@typescript-eslint/consistent-type-imports`** — types must be imported with
  `import type { Foo }` or `import { type Foo }`. Every snippet below already does.
- **`@typescript-eslint/no-unused-vars`** — an unused import fails the build.

---

## Frontend: the API client (`frontend/src/lib/api.ts`)

For the app's **own** routes. Authentication is handled separately by the template's Better
Auth client — see the next section. This client only needs to carry the session cookie.

```ts
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, code: string, status: number, details: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface Envelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: { message: string; code: string; details: unknown };
}

/** Calls the backend. Path is relative to /api — `api('/walk')`. */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    // Sends the Better Auth session cookie. Without this every protected route 401s.
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const body = (await res.json().catch(() => null)) as Envelope<T> | null;

  if (!res.ok || !body?.success) {
    throw new ApiError(
      body?.error?.message ?? 'Something went wrong. Please try again.',
      body?.error?.code ?? 'NETWORK_ERROR',
      res.status,
      body?.error?.details,
    );
  }

  return body.data as T;
}

export const apiGet = <T>(path: string) => api<T>(path);
export const apiPost = <T>(path: string, data: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(data) });
export const apiPut = <T>(path: string, data: unknown) =>
  api<T>(path, { method: 'PUT', body: JSON.stringify(data) });
export const apiDelete = <T>(path: string) => api<T>(path, { method: 'DELETE' });
```

Always relative `/api/...` — the Vite dev proxy and production nginx both depend on it, and
staying same-origin is what keeps the session cookie first-party.

There is **no token to store**. The session lives in an httpOnly cookie the browser sends
automatically; JavaScript cannot read it, which is the point. Never write a `localStorage`
token shim.

---

## Frontend: auth — the template already ships the client

`frontend/src/lib/auth-client.ts` exists in the template. **Do not write an auth context, a
token store, or login/signup API calls of your own.** It exports:

```ts
import { signIn, signUp, signOut, useSession } from '@/lib/auth-client.ts';
```

Add one thin adapter so pages read naturally and there is a single place to reshape the user
(`frontend/src/lib/auth.ts`):

```ts
import { useSession } from './auth-client.ts';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  themePreference: 'light' | 'dark';
}

export function useAuth(): { user: AuthUser | null; loading: boolean } {
  const { data, isPending } = useSession();
  const u = data?.user;

  return {
    loading: isPending,
    user: u
      ? {
          id: u.id,
          email: u.email,
          firstName: u.firstName ?? u.name?.split(' ')[0] ?? '',
          lastName: u.lastName ?? u.name?.split(' ').slice(1).join(' ') ?? '',
          themePreference: u.themePreference === 'light' ? 'light' : 'dark',
        }
      : null,
  };
}
```

No provider to mount — `useSession` manages its own state, so `main.tsx` stays as the
template ships it.

---

## Frontend: protected routes (`frontend/src/components/ProtectedRoute.tsx`)

```tsx
import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth.ts';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

Render the loading state before the redirect. Skipping it bounces a signed-in person to
`/login` for a frame on every refresh, while the session request is still in flight.

`App.tsx` — every route is declared here:

```tsx
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { LoginPage } from './pages/Login.tsx';
import { SignupPage } from './pages/Signup.tsx';
import { WalksPage } from './pages/Walks.tsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <WalksPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
```

---

## Frontend: a login page that handles errors like a human

Better Auth's client **returns** `{ data, error }` — it does not throw. Branch on
`error.code`.

```tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button.tsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { signIn } from '@/lib/auth-client.ts';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error: authError } = await signIn.email({ email, password });

    if (authError) {
      setError(
        authError.code === 'INVALID_EMAIL_OR_PASSWORD'
          ? "That email and password don't match. Try again?"
          : 'Something went wrong signing you in. Please try again.',
      );
      setBusy(false);
      return;
    }

    navigate('/');
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                required
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                required
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              No account?{' '}
              <Link to="/signup" className="underline">
                Create one
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
```

The signup page is the same shape, calling
`signUp.email({ email, password, name, firstName, lastName })`. Better Auth requires `name`;
pass `` `${firstName} ${lastName}` `` so the template's additional fields and its own display
name agree.

**Error codes, verified against the running server:**

| Code                                    | Status | Means                     |
| --------------------------------------- | ------ | ------------------------- |
| `INVALID_EMAIL_OR_PASSWORD`             | 401    | Wrong email or password   |
| `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` | 422    | Signup with a taken email |
| `PASSWORD_TOO_SHORT`                    | 400    | Under 8 characters        |

**Error copy is part of the product.** Branch on `error.code` and write a sentence a
human would say. Never surface a raw backend message.

---

## Backend: a complete resource

### Model — `backend/src/models/Walk.ts`

```ts
import mongoose, { Schema, type HydratedDocument, type Model } from 'mongoose';

export interface WalkAttrs {
  /** Owner id from `req.authUser.id` — a string under either auth provider. */
  user: string;
  dogName: string;
  startedAt: Date;
  durationMinutes: number;
  notes?: string;
}

export type WalkDoc = HydratedDocument<WalkAttrs>;
type WalkModel = Model<WalkAttrs>;

const walkSchema = new Schema<WalkAttrs, WalkModel>(
  {
    // A string, not ObjectId: Better Auth user ids are opaque strings, not Mongo ids.
    user: { type: String, required: true, index: true },
    dogName: { type: String, required: true, trim: true, maxlength: 100 },
    startedAt: { type: Date, required: true, default: Date.now },
    durationMinutes: { type: Number, required: true, min: 1, max: 1440 },
    notes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

walkSchema.index({ user: 1, startedAt: -1 });

export const Walk = mongoose.model<WalkAttrs, WalkModel>('Walk', walkSchema);
export default Walk;
```

The `user` field plus the compound index is the ownership pattern. Every user-owned
model gets both.

### Validation — append to `backend/src/middleware/validation.ts`

```ts
export const createWalkValidation = [
  body('dogName').trim().notEmpty().withMessage('Dog name is required'),
  body('durationMinutes')
    .isInt({ min: 1, max: 1440 })
    .withMessage('Duration must be 1–1440 minutes'),
  body('startedAt').optional().isISO8601().withMessage('Start time must be a valid date'),
  body('notes').optional().trim().isLength({ max: 2000 }),
];
```

### Controller — `backend/src/controllers/walkController.ts`

```ts
import type { RequestHandler } from 'express';
import Walk from '../models/Walk.js';
import { AppError } from '../middleware/errorHandler.js';
import { successResponse } from '../utils/helpers.js';

export const listWalks: RequestHandler = async (req, res) => {
  const walks = await Walk.find({ user: req.authUser!.id }).sort({ startedAt: -1 }).limit(100);
  res.status(200).json(successResponse(walks, 'Walks retrieved'));
};

export const createWalk: RequestHandler = async (req, res) => {
  const { dogName, startedAt, durationMinutes, notes } = req.body as {
    dogName: string;
    startedAt?: string;
    durationMinutes: number;
    notes?: string;
  };

  const walk = await Walk.create({
    user: req.authUser!.id,
    dogName,
    startedAt: startedAt ? new Date(startedAt) : new Date(),
    durationMinutes,
    notes,
  });

  res.status(201).json(successResponse(walk, 'Walk logged'));
};

export const getWalk: RequestHandler = async (req, res) => {
  const walk = await Walk.findOne({ _id: req.params.walkID, user: req.authUser!.id });
  if (!walk) throw new AppError('Walk not found', 404, 'WALK_NOT_FOUND');
  res.status(200).json(successResponse(walk, 'Walk retrieved'));
};

export const deleteWalk: RequestHandler = async (req, res) => {
  const walk = await Walk.findOneAndDelete({ _id: req.params.walkID, user: req.authUser!.id });
  if (!walk) throw new AppError('Walk not found', 404, 'WALK_NOT_FOUND');
  res.status(200).json(successResponse({ _id: walk._id }, 'Walk deleted'));
};
```

Three things to copy exactly: `.js` on every relative import, ownership baked into the
**query** (not checked after fetching), and `throw new AppError(...)` — Express 5 routes
it to the global error handler with no try/catch.

### Routes — `backend/src/routes/walk.ts`

```ts
import { Router } from 'express';
import { listWalks, createWalk, getWalk, deleteWalk } from '../controllers/walkController.js';
import { createWalkValidation, validate } from '../middleware/validation.js';
import { requireAuth } from '../auth/index.js';

const router: Router = Router();

router.get('/', requireAuth, listWalks);
router.post('/', requireAuth, createWalkValidation, validate, createWalk);
router.get('/:walkID', requireAuth, getWalk);
router.delete('/:walkID', requireAuth, deleteWalk);

export default router;
```

### Mount — in `backend/src/app.ts`

```ts
import walkRoutes from './routes/walk.js';
// ...
app.use('/api/walk', walkRoutes); // AFTER the rate limiter, BEFORE notFoundHandler
```

---

## Theming: the accent colour (`frontend/src/index.css`)

Tailwind v4 — no config file. Set the CSS variables in **both** `:root` and `.dark`:

```css
:root {
  --primary: oklch(0.55 0.14 155); /* deep green */
  --primary-foreground: oklch(0.985 0 0);
  --ring: oklch(0.55 0.14 155);
}

.dark {
  --primary: oklch(0.72 0.13 155); /* lighter for dark backgrounds */
  --primary-foreground: oklch(0.145 0 0);
  --ring: oklch(0.72 0.13 155);
}
```

The `@theme inline` block below already maps these to Tailwind utilities — don't touch it.
Dark mode needs `class="dark"` on `<html>`; nothing sets it yet, so wire it to
`User.settings.themePreference` if they want a toggle.

---

## A backend test for the new resource (`backend/tests/walk.test.ts`)

Follow `health.test.ts` — stub env before importing the app:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/<slug>-test');
vi.stubEnv('JWT_SECRET', 'this-is-a-thirty-two-char-secret-x');
vi.stubEnv('LOG_LEVEL', 'fatal');

const { createApp } = await import('../src/app.js');
const request = (await import('supertest')).default;

describe('walks', () => {
  const app = createApp();

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/walk');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
```

Auth-free assertions like this need no database connection, so they run anywhere. Tests
that create records need a live MongoDB.
