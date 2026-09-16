# Template V2

Two independent npm projects in one repo:

- `backend/` — Node 20+, Express 5, MongoDB (Mongoose), TypeScript, Better Auth, optional Postgres, S3, email and AI.
- `frontend/` — Vite 6, React 19 (+ React Compiler), Tailwind CSS v4, TypeScript, shadcn/ui, React Router 7.

The repo root holds only shared tooling (Husky, lint-staged, Prettier). Each app has its own `package.json`, lockfile, and CI job.

## Documentation

Three documents, three readers:

| File                                         | For                                             | Contents                                                                               |
| -------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`ARCHITECTURE.md`](ARCHITECTURE.md)         | Claude, or an engineer about to write code here | Full file map, the conventions that break the build if ignored, how to extend, gotchas |
| `README.md` (this file)                      | A developer who just cloned the repo            | Setup, scripts, API surface, env vars                                                  |
| [`docs/first-app.html`](docs/first-app.html) | Someone non-technical building their first app  | Four-step getting-started guide, published as an Artifact                              |

**Read `ARCHITECTURE.md` before writing any code in this repo or in an app generated from
it.** It documents the things that silently break — notably that backend relative imports
must end in `.js`, and that every API response goes through the `successResponse` /
`errorResponse` envelope.

To re-audit the repo and bring all three back in sync after a change, run the
`refresh-docs` skill (`.claude/skills/refresh-docs/`).

## Building an app from this template

The [`app-builder`](plugins/app-builder/) plugin turns this template into a finished app
through a plain-English conversation — no terminal knowledge required. It interviews the
person about their idea, clones and installs this template, writes the spec into
`seed-documentation/`, builds a working v1, and starts it locally.

```bash
/plugin marketplace add odyssey-core/grimoire
/plugin install app-builder@grimoire
```

Then, in any folder: `build me an app`.

The plugin lives in this repo under `plugins/app-builder/`; the Grimoire marketplace only
holds a pointer to it. Bump the version in `plugins/app-builder/.claude-plugin/plugin.json`
when you change it — teammates pick it up with `/plugin marketplace update`.

## Prerequisites

- Node.js 20+
- npm 10+
- A database to talk to. You do **not** need to install MongoDB or Postgres — `npm run db`
  starts both locally (see [Local databases](#local-databases-no-install-required)). Docker
  and system installs work too.

## First-time setup

```bash
# Install shared tooling + git hooks at the repo root
npm install

# Install each app
cd backend && npm install
cd ../frontend && npm install

# Optional: only if you want to override the development defaults
# cp .env.example .env
```

Edit `backend/.env` and set a real `JWT_SECRET` (≥32 chars) and `MONGODB_URI`.

## Day-to-day

```bash
# Terminal 1 – local databases (skip if you run your own Mongo/Postgres)
cd backend && npm run db

# Terminal 2 – backend (auto-reloads on save)
cd backend && npm run dev

# Terminal 3 – frontend (Vite proxies /api to the backend)
cd frontend && npm run dev
```

Frontend is served at <http://localhost:5173>; backend at <http://localhost:3000>. The Vite dev server proxies `/api/*` to the backend, so the browser only ever talks to one origin.

## Scripts

### Backend (`cd backend`)

| Command               | What it does                                  |
| --------------------- | --------------------------------------------- |
| `npm run db`          | Start local Mongo + Postgres (no install)     |
| `npm run db:reset`    | Delete the local database data                |
| `npm run email:check` | Verify the Resend key and sending domain      |
| `npm run dev`         | Start Express with `tsx watch`                |
| `npm run build`       | Emit JS to `dist/`                            |
| `npm start`           | Run the compiled output (used by Docker)      |
| `npm run lint`        | ESLint                                        |
| `npm run typecheck`   | `tsc --noEmit`                                |
| `npm test`            | Vitest — unit, route and database integration |

### Frontend (`cd frontend`)

| Command             | What it does                  |
| ------------------- | ----------------------------- |
| `npm run dev`       | Vite dev server with HMR      |
| `npm run build`     | Typecheck + production bundle |
| `npm run preview`   | Serve the production bundle   |
| `npm run lint`      | ESLint                        |
| `npm run typecheck` | `tsc -b --noEmit`             |
| `npm test`          | Vitest                        |

### Root

| Command                | What it does               |
| ---------------------- | -------------------------- |
| `npm run format`       | Prettier across the repo   |
| `npm run format:check` | CI-friendly Prettier check |

A pre-commit hook (Husky + lint-staged) runs Prettier and ESLint on staged files.

## S3 object storage (optional)

Images, video and documents. Like Postgres, it ships wired but **inert**: with `AWS_S3_BUCKET`
unset, `connectS3()` logs a debug line and returns `null`, and every non-upload route works
unchanged. Name a bucket and it connects at boot.

```bash
# backend/.env
AWS_S3_BUCKET=my-app-media
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...        # optional — see below
AWS_SECRET_ACCESS_KEY=...
```

Credentials are optional by design. Omit both keys in production and the AWS SDK uses its
default provider chain — an IAM role on EC2/ECS/Lambda, `~/.aws/credentials`, or SSO — which
avoids long-lived keys in your environment. Setting one key without the other is a boot error.

Because it is plain S3 API, `AWS_S3_ENDPOINT` points the same code at **Cloudflare R2, MinIO,
DigitalOcean Spaces or Backblaze B2**.

### Uploading

`src/utils/storage.ts` wraps the SDK. Two upload paths, and the choice matters:

**Small files through your server** — avatars, thumbnails, documents:

```ts
import { uploadImage, uploadErrorHandler } from '../middleware/upload.js';
import { buildObjectKey, uploadObject, getPublicUrl } from '../utils/storage.js';

router.post(
  '/avatar',
  protect,
  uploadImage.single('file'),
  uploadErrorHandler,
  async (req, res) => {
    const file = req.file!;
    const key = await uploadObject({
      key: buildObjectKey(file.originalname, `avatars/${req.user!._id}`),
      body: file.buffer,
      contentType: file.mimetype,
    });
    res.json(successResponse({ key, url: getPublicUrl(key) }, 'Avatar uploaded'));
  },
);
```

**Large files straight to S3** — video, anything over ~50MB. Hand the browser a presigned URL
so the bytes never touch Node:

```ts
const key = buildObjectKey(filename, 'videos');
const url = await getUploadUrl(key, 'video/mp4'); // client PUTs the file to this URL
```

The multer middleware buffers files in memory, which is the right trade for images but would
put a 2GB video into RSS — use the presigned path for those.

`withUploadErrors()` turns rejected files (wrong type, too large) into 400s in the standard
error envelope. Prefer it to mounting `uploadErrorHandler` mid-route: a 4-argument error
handler in the middle of a route chain defeats Express's type inference and leaves the next
handler's `req`/`res` implicitly `any`.

### API

| Function                                                          | Purpose                                                                                  |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `uploadObject({ key, body, contentType })`                        | Upload a Buffer, string or stream. Switches to multipart automatically for large bodies. |
| `uploadFile(path, key?)`                                          | Stream a local file to S3                                                                |
| `getObjectBuffer(key)`                                            | Download into a Buffer — small objects only                                              |
| `downloadToFile(key, path)`                                       | Stream to disk, constant memory                                                          |
| `getDownloadUrl(key, expiresIn?)`                                 | Presigned GET for private objects                                                        |
| `getUploadUrl(key, contentType)`                                  | Presigned PUT for direct browser upload                                                  |
| `getPublicUrl(key)`                                               | Permanent URL via `AWS_S3_PUBLIC_URL` (CDN) or the bucket                                |
| `objectExists(key)` / `deleteObject(key)` / `deleteObjects(keys)` | Housekeeping; deletes batch in 1000s                                                     |
| `listObjects(prefix, maxKeys?)`                                   | Paginated listing                                                                        |
| `buildObjectKey(filename, prefix?)`                               | Timestamped, slugified, collision-proof key                                              |

Always run user filenames through `buildObjectKey()` — it slugifies, appends a random suffix
so two `photo.jpg` uploads never overwrite each other, and strips path traversal.

### Notes

- **ACLs are off by default.** Buckets created since April 2023 have Object Ownership set to
  "bucket owner enforced" and reject any ACL with `AccessControlListNotSupported`. Serve public
  files through CloudFront or a bucket policy. `AWS_S3_ACL` exists for older buckets.
- **A failed bucket check warns rather than exits**, unlike Mongo and Postgres. An object-level
  IAM policy (`GetObject`/`PutObject` without `s3:ListBucket`) legitimately returns 403 from
  `HeadBucket` while uploads work fine, and S3 is not needed to serve ordinary requests.
- Presigned PUTs require `requestChecksumCalculation: 'WHEN_REQUIRED'`, already set in
  `config/s3.ts` — the SDK v3 default signs a checksum of an empty body and S3 then rejects the
  real upload with a 403.

## Authentication

[Better Auth](https://better-auth.com) is the default. It owns `/api/auth`, keeps sessions in
httpOnly cookies, and stores credentials in their own collection — never on the user document.

```bash
# backend/.env
AUTH_PROVIDER=better-auth      # the default
# BETTER_AUTH_SECRET=...       # falls back to JWT_SECRET
```

Nothing else is required: it uses the same MongoDB connection the app already has.

### Switching back to the legacy JWT system

The template's original hand-rolled auth is still here, working, and marked `LEGACY`:

```bash
AUTH_PROVIDER=jwt
```

That is the whole change. `/api/auth` goes back to `POST /signup`, `POST /login` and
`GET /me` with bearer tokens, and Better Auth stops being mounted. Both paths are covered by
tests (`tests/auth.test.ts` and `tests/auth-legacy.test.ts`) so the fallback cannot rot.

To delete Better Auth for good: remove `src/auth/`, drop the `isBetterAuth` branches in
`src/app.ts`, point `src/routes/user.ts` back at `protect`, uninstall `better-auth`, and
remove the LEGACY banners from `middleware/auth.ts`, `controllers/authController.ts` and
`routes/auth.ts`.

### Writing protected routes

Use `requireAuth` and read `req.authUser`. Both are provider-neutral, which is what lets
`AUTH_PROVIDER` be flipped without touching route code:

```ts
import { requireAuth } from '../auth/index.js';

router.get('/things', requireAuth, (req, res) => {
  const { id, email, firstName } = req.authUser!;
  ...
});
```

Do not reach for `req.user` (the legacy Mongoose document) or a Better Auth session directly.

### The two user stores are separate

Better Auth writes to `user`, `session` and `account`; the legacy system writes to Mongoose's
`users`. They never share a document, which is what makes switching safe — but it also means
**accounts do not carry across**. A user created under one provider cannot sign in under the
other. Migrating real users between the two is a data-migration job, not a config change.

The template's first/last name split is preserved through Better Auth's `additionalFields`
(`firstName`, `lastName`, `themePreference`), so `req.authUser` looks the same either way.

### Frontend

`frontend/src/lib/auth-client.ts` exports a typed client:

```ts
import { signIn, signUp, signOut, useSession } from '@/lib/auth-client.ts';

const { data: session } = useSession();
await signIn.email({ email, password });
```

It deliberately sets no `baseURL`, so calls go to `/api/auth` on the current origin and the
Vite proxy forwards them. That keeps the session cookie first-party — no CORS preflight and
nothing for browser third-party-cookie blocking to reject.

### Notes

- **Password reset and email verification are wired to Resend.** Better Auth generates the
  link and hands it to the template's email triggers, so with no `RESEND_API_KEY` the reset
  link is logged to the console and still works locally.
- **`BETTER_AUTH_DB_TRANSACTIONS` stays off by default.** MongoDB transactions need a replica
  set; a standalone `mongod` — including `docker compose up mongo` — rejects them with
  _"Transaction numbers are only allowed on a replica set member or mongos"_. Turn it on for
  Atlas or any replica set. (`npm run db` runs a single-node replica set, so it supports them.)
- The Better Auth handler is mounted **before** `express.json()` in `app.ts`. It reads the raw
  request stream; a body parser that has already consumed it yields empty payloads.
- Express 5 spells the wildcard `/api/auth/*splat`, not `/api/auth/*`.

## AI — Claude (optional)

Two routes that talk to Claude, gated on one key. **With `ANTHROPIC_API_KEY` unset they are
not mounted at all** — `/api/ai` 404s like any unknown path and none of the AI code runs. Set
the key and they are live on the next boot. Nothing else is required.

```bash
# backend/.env
ANTHROPIC_API_KEY=sk-ant-...
```

| Method | Path              | Auth    | Returns                                 |
| ------ | ----------------- | ------- | --------------------------------------- |
| POST   | `/api/ai/message` | session | One JSON reply in the standard envelope |
| POST   | `/api/ai/stream`  | session | Server-Sent Events: `delta` → `done`    |

```bash
curl -X POST http://localhost:3000/api/ai/message \
  -H 'content-type: application/json' -b cookies.txt \
  -d '{"messages":[{"role":"user","content":"Write a haiku about Express"}]}'
```

Both take `{ messages, system?, maxTokens?, effort? }`. `messages` is the standard
`[{ role, content }]` history — the API is stateless, so send the whole conversation each
time.

### Calling it from your own code

Skip the HTTP layer and use the service directly:

```ts
import { ask } from '../ai/index.js';

const { text, usage } = await ask({
  messages: [{ role: 'user', content: `Summarise: ${article}` }],
  system: 'Reply in two sentences.',
  effort: 'low', // cheap and fast for simple work
});
```

`askStream(options, onText)` is the streaming equivalent and resolves with the same result
once the stream ends.

### Defaults, and why

- **`claude-opus-5`** with **adaptive thinking** — the model decides how hard to think per
  request. The older fixed `budget_tokens` form is rejected outright by current models.
- **`effort: high`** (the API default). Drop to `low` for classification and simple
  extraction; raise to `xhigh`/`max` when correctness matters more than cost.
- **`max_tokens: 16000`** — high enough that replies are not truncated mid-thought. Above
  ~32000, use the streaming route so the request cannot hit an HTTP timeout.
- **Refusal fallback is on.** If Claude declines on safety grounds the API re-runs the
  request on a fallback model inside the same call. Set `ANTHROPIC_REFUSAL_FALLBACK=false` to
  turn it off — required if you point the SDK at Bedrock, Vertex or Foundry, which do not
  support it.

### Cost and abuse

These routes spend money on every call, so unlike the rest of `/api` they are **not** open:

- **Authentication is required** — they use the same `requireAuth` as everything else.
- **A separate rate limit**, `AI_RATE_LIMIT_PER_HOUR` (default 60), keyed by **user id**
  rather than IP so colleagues behind one office NAT do not exhaust each other's allowance.
- `maxTokens` is capped at 32000 by request validation regardless of what a caller asks for.
- The streaming route aborts the upstream request if the client disconnects, so a closed tab
  stops costing tokens.

### A refusal is not an error

Claude can decline on safety grounds. That returns **HTTP 200 with `stop_reason: 'refusal'`
and no useful content** — it does not throw. The route turns it into a `422` with code
`AI_REFUSED` rather than reporting empty text as success. If you call `ask()` directly, check
`result.stopReason` before trusting `result.text`.

SDK failures are mapped by type, not by string matching: `AI_BAD_REQUEST` (400),
`AI_RATE_LIMITED` (429), `AI_UNAVAILABLE` (503), `AI_AUTH_ERROR` (a bad key — reported as 500
because the caller can do nothing about it).

## Email — Resend (optional)

Transactional mail, gated on one API key. **With no `RESEND_API_KEY` every message is logged
to the console instead of being sent**, so signup and password reset work on a laptop with no
Resend account, and the test suite never touches the network. Add a key and the same code
sends for real — nothing else changes.

```bash
# backend/.env
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=Acme <no-reply@acme.com>   # must be a domain verified in Resend
APP_NAME=Acme
```

```bash
npm run email:check                     # key + sending domain
npm run email:check -- you@acme.com     # ...and send one real message
```

### Layout

```
src/email/
  index.ts              public surface
  client.ts             transport: retries, idempotency, timeouts, error parsing
  render.ts             one description → text + HTML
  triggers.ts           app events → emails; never throw
  templates/
    welcome.ts
    passwordReset.ts
    emailVerification.ts
    notification.ts     generic one-off
```

### Triggers

An email is fired by naming an app event, not by assembling a message at the call site:

```ts
import { emailTriggers } from '../email/index.js';

void emailTriggers.userRegistered({ email: user.email, firstName: user.firstName });
void emailTriggers.passwordResetRequested(user, resetToken, '1 hour');
void emailTriggers.emailVerificationRequested(user, verifyToken);
void emailTriggers.notified(user, { subject: 'Your export is ready', paragraphs: ['...'] });
```

**Triggers never throw.** By the time mail goes out the caller has already committed — the
user row is written, the token is stored. Turning a mail failure into a 500 would tell someone
"something went wrong" _after_ their password was reset, which is worse than a missing email.
Failures are logged; `await` the returned result if a caller genuinely needs to know.

`user.registered` is already wired into `POST /api/auth/signup` as a worked example. Delete
that one line in `controllers/authController.ts` if you do not want a welcome email.

### Adding a template

Each template turns data into `{ subject, text, html }`. Describe the message once and
`renderEmail` builds both versions — writing each message twice is how the plain-text and HTML
copies drift apart:

```ts
export function invoiceEmail(data: { firstName: string; url: string }): EmailMessage {
  return renderEmail({
    subject: `Your ${env.APP_NAME} invoice`,
    paragraphs: [`Hi ${data.firstName},`, 'Your invoice is ready.'],
    button: { label: 'View invoice', url: data.url },
    footnote: 'Questions? Just reply to this email.',
  });
}
```

Everything is escaped, including the subject — it lands in `<title>`. All CSS is inline
because many clients discard `<style>` blocks.

### Behaviour worth knowing

- **Retries are selective.** Throttling (429), contention (409) and 5xx are retried;
  400/401/403/404/422 are permanent and fail immediately — retrying a 403 for an unverified
  domain just reaches the same outcome three times more slowly. Resend's `retry-after` header
  wins over local backoff.
- **Idempotency keys are derived from the message**, not random. A double-submitted password
  reset sends one email; a genuinely new reset carries a new link, so it sends. The key is
  reused across retries, which is what it exists for.
- **`from` must be a verified domain.** Anything else is `403 not authorized to send emails
from <domain>`. The default `onboarding@resend.dev` is Resend's shared testing sender and
  only delivers to the address on your own Resend account.
- A `200` from Resend means _accepted_, not _delivered_. Bounces only arrive via webhooks
  (`email.bounced`); polling will not tell you.
- Up to 50 recipients per send; more is rejected before any request is made.

## Local databases (no install required)

`npm run db` boots MongoDB **and** Postgres on your machine without installing either, and
without Docker:

```bash
cd backend && npm run db
```

```
  MongoDB   mongodb://127.0.0.1:27017/template
  Postgres  postgres://postgres:postgres@127.0.0.1:5432/template

  Data persists in backend/.devdata — 'npm run db:reset' wipes it.

Ready. Press Ctrl+C to stop.
```

These are **real database binaries**, not emulators — `mongodb-memory-server-core` and
`embedded-postgres` fetch official builds and run them as child processes. Ctrl+C shuts both
down cleanly.

What it does for you:

- **Reads your `.env`.** Ports, database names and credentials come from `MONGODB_URI` and the
  `POSTGRES_*` vars, so the script serves exactly what the app connects to.
- **Persists data** in `backend/.devdata/` (gitignored) — your records survive restarts.
  `npm run db:reset` starts over.
- **Skips remote hosts.** If `MONGODB_URI` points at Atlas or `POSTGRES_URL` at Supabase/Neon,
  that engine is left alone instead of being shadowed by a local server.
- **Runs Mongo as a 1-node replica set**, so transactions and change streams work the same way
  they do in production.
- **Fails loudly on port conflicts** rather than half-starting.

Run just one engine with `npm run db -- --mongo` or `npm run db -- --postgres`.

### Trade-offs

- `npm install` in `backend/` pulls a platform-specific Postgres binary (~130 MB in
  `node_modules`). The MongoDB binary (~75 MB) downloads on first `npm run db` into a cache.
  If you never want local Postgres, drop `embedded-postgres` from `devDependencies`.
- Changing the Mongo port after first run invalidates the replica-set config baked into
  `.devdata` — run `npm run db:reset` after changing it.
- This is a development convenience. Production still uses a real managed database.

### Alternatives

| Approach                                         | Install needed | Notes                                                                                     |
| ------------------------------------------------ | -------------- | ----------------------------------------------------------------------------------------- |
| `npm run db`                                     | none           | Default. Real binaries, persistent, reads `.env`.                                         |
| `docker compose up mongo` / `--profile postgres` | Docker         | Closest to production; see [Running everything in Docker](#running-everything-in-docker). |
| System install (Homebrew, etc.)                  | Mongo/Postgres | Fine — `npm run db` detects the port conflict and tells you to skip it.                   |

## Running everything in Docker

```bash
JWT_SECRET=your-real-secret-of-32-plus-chars docker compose up --build
```

Frontend → <http://localhost:8080>, backend → <http://localhost:3000>, Mongo → `mongodb://localhost:27017`.

To include the bundled Postgres service, activate its profile and pass credentials:

```bash
POSTGRES_HOST=postgres POSTGRES_DB=template POSTGRES_USER=postgres POSTGRES_PASSWORD=postgres \
  JWT_SECRET=your-real-secret-of-32-plus-chars docker compose --profile postgres up --build
```

Without those vars the `postgres` service never starts and the backend runs Mongo-only.

## API surface (current)

With the default `AUTH_PROVIDER=better-auth`:

| Method | Path                         | Auth    | Notes                              |
| ------ | ---------------------------- | ------- | ---------------------------------- |
| GET    | `/health`                    | public  | Liveness probe                     |
| POST   | `/api/auth/sign-up/email`    | public  | Email + password, sets a session   |
| POST   | `/api/auth/sign-in/email`    | public  | Sets a session cookie              |
| GET    | `/api/auth/get-session`      | cookie  | Current session and user           |
| POST   | `/api/auth/sign-out`         | cookie  | Clears the session                 |
| \*     | `/api/auth/*`                | —       | Everything else Better Auth serves |
| PUT    | `/api/user/:userID`          | session | Update profile (own user only)     |
| PUT    | `/api/user/:userID/settings` | session | Update theme preference            |

With `AUTH_PROVIDER=jwt`, `/api/auth` reverts to the legacy routes — `POST /signup`,
`POST /login` returning `{ token, user }`, and `GET /me` with a bearer token.

No upload routes are mounted — `src/middleware/upload.ts` and `src/utils/storage.ts` provide
the plumbing for you to add your own. See [S3 object storage](#s3-object-storage-optional).

Responses follow `{ success, message, data }` for OK and `{ success: false, error: { message, code, details } }` for failures.

## Postgres (optional)

Postgres ships wired but **inert**. With no `POSTGRES_*` variables set, `connectPostgres()` logs a debug line, returns `null`, and the app runs on Mongo alone. Add credentials and it connects at boot — no code changes.

Enable it with either a connection string or the discrete trio:

```bash
# backend/.env — option A
POSTGRES_URL=postgres://user:password@localhost:5432/template

# backend/.env — option B (HOST, DB and USER are required together)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=template
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

Setting only _some_ of the trio is a boot-time error — the same fail-fast rule the rest of the env follows.

### Using it

`src/config/postgres.ts` exposes a [postgres.js](https://github.com/porsager/postgres) client. Import `getSql()` wherever you need it:

```ts
import { getSql } from '../config/postgres.js';

export const listWidgets: RequestHandler = async (_req, res) => {
  const sql = getSql();
  const widgets = await sql`select * from widgets order by created_at desc limit 50`;
  res.json(successResponse(widgets, 'Widgets retrieved successfully'));
};
```

Values interpolated into the tagged template are always parameterised, so `sql\`select \* from users where email = ${email}\`` is injection-safe. Helpers that come with the client:

```ts
await sql`insert into widgets ${sql({ name, note })} returning *`; // object → columns
await sql.begin(async (tx) => {
  /* transaction, auto rollback on throw */
});
await sql`select * from t where id in ${sql(ids)}`; // array → IN list
```

`getSql()` throws if Postgres was never configured, so a missing `.env` surfaces at the call site instead of silently returning no rows.

### Exports

| Export                  | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| `connectPostgres()`     | Opens the pool and verifies it; `null` when unconfigured |
| `disconnectPostgres()`  | Drains the pool (wired into graceful shutdown)           |
| `getSql()`              | The query client; throws when not connected              |
| `isPostgresConnected()` | Boolean check, no throw                                  |
| `pingPostgres()`        | `select 1` round-trip — useful for a readiness probe     |

### Tuning

| Var                        | Default                                | Notes                                                                         |
| -------------------------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| `POSTGRES_SSL`             | `no-verify` in prod, `disable` locally | `disable` \| `no-verify` \| `require` \| `allow` \| `prefer` \| `verify-full` |
| `POSTGRES_SCHEMA`          | server default                         | Sets `search_path` on connect                                                 |
| `POSTGRES_MAX_CONNECTIONS` | `10`                                   | Pool size                                                                     |
| `POSTGRES_IDLE_TIMEOUT`    | `30`                                   | Seconds before an idle connection closes                                      |
| `POSTGRES_CONNECT_TIMEOUT` | `10`                                   | Seconds to wait for a connection                                              |

Managed providers (Supabase, Neon, RDS, Railway) generally want `POSTGRES_SSL=no-verify`, which is the production default.

## Env vars

### Backend (`backend/.env`)

**In development you need no `.env` at all.** `npm run dev` falls back to
`mongodb://127.0.0.1:27017/template` and a signing secret derived from the project path,
printing a warning so the fallback is never silent. Copy `.env.example` to `.env` when you
want to override anything.

**In production both are required** and the server refuses to start without them:

```
MONGODB_URI=mongodb://localhost:27017/template
JWT_SECRET=<at-least-32-chars>
```

The development secret is derived, not random, so it survives `tsx watch` reloads — a random
one would sign you out on every file save. It is not a real secret and is never used when
`NODE_ENV=production`.

Everything else is optional and grouped by the feature it turns on:

| Group    | Set this to switch it on                                    | Off by default means                     |
| -------- | ----------------------------------------------------------- | ---------------------------------------- |
| Core     | `NODE_ENV`, `PORT`, `LOG_LEVEL`, `APP_NAME`, `FRONTEND_URL` | sensible defaults                        |
| Auth     | `AUTH_PROVIDER` (default Better Auth)                       | `jwt` reverts to the legacy system       |
| Postgres | `POSTGRES_HOST` or `POSTGRES_URL`                           | skipped at boot; Mongo only              |
| S3       | `AWS_S3_BUCKET`                                             | skipped at boot; uploads unavailable     |
| Email    | `RESEND_API_KEY`                                            | messages logged to the console, not sent |
| AI       | `ANTHROPIC_API_KEY`                                         | `/api/ai` is not mounted at all          |

`backend/.env.example` documents all 47 with their defaults and is the file to read; the Zod
schema in `src/config/env.ts` is the source of truth. A _malformed_ value is always a boot
error, in every environment — the development fallbacks fill in a missing variable, they
never paper over a typo. A half-configured subsystem (say `POSTGRES_DB` without
`POSTGRES_HOST`) is likewise a deliberate boot error rather than a silent fallback.

### Frontend (`frontend/.env`)

```
VITE_API_URL=http://localhost:3000
```

Only used by the Vite dev proxy; in production the frontend is served behind the same origin (or routed to `/api`). Keeping every call same-origin is also what keeps the Better Auth session cookie first-party — see [Authentication](#authentication).
