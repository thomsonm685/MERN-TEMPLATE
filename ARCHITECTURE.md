# ARCHITECTURE.md — Template Map

The complete map of this template: what the stack is, where every file lives, the
conventions that must be followed, and how to extend it correctly.

**Read this before writing any code in a project generated from this template.**

---

## 1. Stack

| Layer                     | Technology                                    | Version                       | Notes                                                               |
| ------------------------- | --------------------------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| Runtime                   | Node.js                                       | >= 20 (CI uses 22)            | ESM only — `"type": "module"` in both apps                          |
| Language                  | TypeScript                                    | 5.7                           | `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`        |
| API framework             | Express                                       | 5.x                           | **v5** — async errors auto-forward to the error handler             |
| Database                  | MongoDB + Mongoose                            | 8.x                           | Single connection, established before the server listens            |
| Auth                      | Better Auth                                   | 1.7.x                         | Default. Cookie sessions; legacy JWT kept behind `AUTH_PROVIDER`    |
| Validation (runtime env)  | Zod                                           | 3.x                           | Boot-time env validation, process exits if invalid                  |
| Validation (request body) | express-validator                             | 7.x                           | Chain arrays + shared `validate` middleware                         |
| Logging                   | Pino + pino-http                              | 9.x / 10.x                    | `pino-pretty` in development only                                   |
| Security                  | helmet, cors, express-rate-limit, compression | —                             | Applied globally in `app.ts`                                        |
| Build tool (frontend)     | Vite                                          | 6.x                           | Dev server proxies `/api` to the backend                            |
| UI library                | React                                         | 19.x                          | **React Compiler enabled** via babel plugin                         |
| Routing                   | React Router                                  | 7.x                           | `BrowserRouter` in `main.tsx`, `<Routes>` in `App.tsx`              |
| Styling                   | Tailwind CSS                                  | **v4**                        | Via `@tailwindcss/vite` — **no `tailwind.config.js`**               |
| Components                | shadcn/ui                                     | —                             | `components.json` present, `zinc` base, CSS variables               |
| Icons                     | lucide-react                                  | —                             | Configured as the shadcn icon library                               |
| Object storage (optional) | AWS SDK v3 + multer                           | 3.x / 2.x                     | S3-compatible: also R2, MinIO, Spaces, Backblaze                    |
| Email (optional)          | Resend over raw `fetch`                       | —                             | No SDK — explicit retry policy and idempotency keys                 |
| AI (optional)             | Claude via `@anthropic-ai/sdk`                | 0.126.x                       | `/api/ai` mounted only when `ANTHROPIC_API_KEY` is set              |
| SQL (optional)            | postgres.js                                   | 3.x                           | Second database alongside Mongo; off unless configured              |
| Testing                   | Vitest                                        | **5.x** backend, 2.x frontend | `supertest` + `mongodb-memory-server` (backend), `jsdom` (frontend) |
| Formatting / linting      | Prettier + ESLint 9 (flat config)             | —                             | Enforced pre-commit via Husky + lint-staged                         |
| Containers                | Docker + docker-compose                       | —                             | mongo + backend + nginx-served frontend                             |
| CI                        | GitHub Actions                                | —                             | Parallel backend/frontend jobs: lint → typecheck → test → build     |

The two apps are on different Vitest majors on purpose: Better Auth's optional peer
`@tanstack/react-start` requires `vite >= 7`, which conflicts with the Vite 5 that Vitest 2
pins. The backend was moved to Vitest 5 (and carries `vite` as a devDependency, which Vitest 5
declares as a peer) so `npm install` resolves without `--legacy-peer-deps`. The frontend
already has Vite 6 as a direct dependency, so it never hit the conflict.

`mongodb` is pinned to `~6.20.0` to match the range Mongoose pins. Two copies of the driver
produce structurally identical but nominally incompatible `Db` types, which breaks the Better
Auth adapter at compile time.

**This is two independent npm projects in one repo, not a monorepo.** `backend/` and
`frontend/` each have their own `package.json`, their own `package-lock.json`, and their
own `node_modules`. The root `package.json` holds _only_ shared tooling (Husky,
lint-staged, Prettier). There is no workspace linking — never add one app as a
dependency of the other, and never hoist their dependencies to the root.

---

## 2. File map

```
.
├── package.json                 Root: Husky + lint-staged + Prettier ONLY
├── docker-compose.yml           mongo(7) + backend + frontend(nginx); postgres behind a profile
├── .prettierrc.json             Shared formatting rules (single quotes, 100 cols, trailing commas)
├── .husky/pre-commit            Runs lint-staged on staged files
├── .github/workflows/ci.yml     Two jobs: backend + frontend — lint, typecheck, test, build
├── seed-documentation/          Blank spec sheets (CSV) — fill these in to define the app
├── ARCHITECTURE.md              This file
├── docs/first-app.html          Beginner getting-started guide (published as an Artifact)
├── plugins/app-builder/         Claude Code plugin — the `new-app` skill
├── .claude/skills/refresh-docs/ Project skill that re-syncs the three docs
├── .env.example                 Root: read by docker-compose ONLY, not by the apps
│
├── backend/
│   ├── package.json             Express/Mongoose deps + dev/build/start/test scripts
│   ├── tsconfig.json            module: NodeNext  ← forces .js import extensions
│   ├── tsconfig.build.json      Build-only config: rootDir src, excludes tests
│   ├── vitest.config.ts         node environment, includes tests/**/*.test.ts
│   ├── eslint.config.js         Flat config, typescript-eslint
│   ├── Dockerfile               3-stage: deps → build → runtime (node:22-alpine, USER node)
│   ├── .env.example             Copy to .env — only MONGODB_URI and JWT_SECRET are required
│   ├── scripts/                 Dev tooling. Typechecked, but excluded from the build
│   │   ├── dev-db.ts            `npm run db` — local Mongo + Postgres, no system install
│   │   └── email-check.ts       `npm run email:check` — Resend key/domain preflight
│   ├── src/
│   │   ├── server.ts            Entry: connect Mongo → Postgres → S3 → listen → graceful shutdown
│   │   ├── app.ts               Express assembly: middleware order, /health, route mounting
│   │   ├── auth/                ACTIVE auth (Better Auth)
│   │   │   ├── better-auth.ts   betterAuth() instance, built lazily once Mongo is connected
│   │   │   └── index.ts         requireAuth + req.authUser — provider-neutral; switches on AUTH_PROVIDER
│   │   ├── config/
│   │   │   ├── env.ts           Zod schema for process.env. Exits on invalid. Import `env` — NEVER read process.env directly
│   │   │   ├── logger.ts        Pino instance. Import `logger` — never use console.log
│   │   │   ├── mongo.ts         connectDB() / disconnectDB()
│   │   │   ├── postgres.ts      OPTIONAL — no-ops unless POSTGRES_* is set
│   │   │   └── s3.ts            OPTIONAL — no-ops unless AWS_S3_BUCKET is set
│   │   ├── ai/                  OPTIONAL — routes unmounted without ANTHROPIC_API_KEY
│   │   │   ├── client.ts        Gated Anthropic client; getClaude() throws if unconfigured
│   │   │   └── service.ts       ask() / askStream() — model, thinking and effort defaults
│   │   ├── email/               OPTIONAL — logs to console without RESEND_API_KEY
│   │   │   ├── client.ts        Transport: retry policy, idempotency, timeouts, error parsing
│   │   │   ├── render.ts        One description → text + HTML (escaped, inline CSS)
│   │   │   ├── triggers.ts      App events → emails. Never throw
│   │   │   └── templates/       welcome, passwordReset, emailVerification, notification
│   │   ├── models/
│   │   │   └── User.ts          LEGACY Mongoose User — only used when AUTH_PROVIDER=jwt
│   │   ├── controllers/
│   │   │   ├── aiController.ts    postMessage, postMessageStream (SSE)
│   │   │   ├── authController.ts  LEGACY signup, login, getMe
│   │   │   └── userController.ts  updateProfile, updateSettings — branches on the provider
│   │   ├── routes/
│   │   │   ├── ai.ts            POST /message, POST /stream — authed + per-user rate limit
│   │   │   ├── auth.ts          LEGACY POST /signup, POST /login, GET /me
│   │   │   └── user.ts          PUT /:userID, PUT /:userID/settings
│   │   ├── middleware/
│   │   │   ├── auth.ts          LEGACY protect/adminProtect/generateToken + Request augmentation
│   │   │   ├── upload.ts        multer for images + video, withUploadErrors()
│   │   │   ├── validation.ts    validate + express-validator chains per endpoint
│   │   │   └── errorHandler.ts  AppError class, notFoundHandler, globalErrorHandler
│   │   └── utils/
│   │       ├── helpers.ts       successResponse() / errorResponse() — the response envelope
│   │       └── storage.ts       S3 upload/download/presign/delete/list helpers
│   └── tests/
│       ├── health.test.ts       Smoke: /health, 404 shape, 401 shape (pins AUTH_PROVIDER=jwt)
│       ├── auth.test.ts         Better Auth end-to-end against a real in-process MongoDB
│       ├── auth-legacy.test.ts  Proves AUTH_PROVIDER=jwt still works
│       ├── email.test.ts        Rendering, escaping, retry classification, triggers
│       ├── email-transport.test.ts  Retries/idempotency/headers against a stubbed fetch
│       ├── ai.test.ts           Disabled path: routes absent, client throws
│       ├── ai-enabled.test.ts   Full route → SDK path against a local mock API
│       ├── postgres.test.ts     Disabled-path behaviour
│       ├── storage.test.ts      Key generation, content types, disabled path
│       └── upload.test.ts       multer accept/reject via real HTTP
│
└── frontend/
    ├── package.json             React/Vite deps + dev/build/preview/test scripts
    ├── vite.config.ts           React Compiler, Tailwind v4 plugin, @ alias, port 5173, /api proxy, vitest jsdom
    ├── tsconfig.app.json        Bundler resolution, allowImportingTsExtensions, erasableSyntaxOnly
    ├── components.json          shadcn/ui config — style default, baseColor zinc, iconLibrary lucide
    ├── eslint.config.js         Flat config + react-hooks + react-refresh
    ├── Dockerfile               build → nginx:1.27-alpine static serve
    ├── nginx.conf               SPA fallback config for the container
    ├── index.html               Root HTML — <title> lives here
    ├── .env.example             VITE_API_URL (dev proxy target only)
    ├── public/favicon.svg
    └── src/
        ├── main.tsx             createRoot + StrictMode + BrowserRouter
        ├── App.tsx              <Routes> — ALL routes are declared here
        ├── index.css            Tailwind v4 entry: @import, CSS vars for :root and .dark, @theme inline
        ├── lib/
        │   ├── utils.ts         cn() — clsx + tailwind-merge
        │   └── auth-client.ts   Better Auth React client (no baseURL → same-origin via proxy)
        ├── pages/
        │   ├── Home.tsx         Example page
        │   └── Home.test.tsx    Colocated test (renderToStaticMarkup)
        └── components/ui/       shadcn primitives: button, card, separator
```

---

## 3. Conventions that are not optional

### 3.1 Backend imports must end in `.js`

`backend/tsconfig.json` uses `"module": "NodeNext"`. Every **relative** import of a local
TypeScript file must carry a `.js` extension, even though the file on disk is `.ts`:

```ts
import { env } from './config/env.js'; // ✅ correct — file is env.ts
import User from '../models/User.js'; // ✅
import { env } from './config/env'; // ❌ runtime crash: ERR_MODULE_NOT_FOUND
```

Package imports (`express`, `mongoose`) take no extension. This is the single most common
way to break the backend.

### 3.2 Every API response uses the envelope

Built by `backend/src/utils/helpers.ts`. Never hand-write a response body.

```ts
// success
res.status(200).json(successResponse(data, 'Human readable message'));
// → { success: true, message: "...", data: {...} }

// failure
res.status(400).json(errorResponse('Message', 'MACHINE_CODE', details));
// → { success: false, error: { message, code, details } }
```

Existing error codes: `UNAUTHORIZED`, `TOKEN_INVALID`, `FORBIDDEN`, `NOT_FOUND`,
`VALIDATION_ERROR`, `SERVER_ERROR`, `USER_EXISTS`, `USER_NOT_FOUND`,
`INVALID_CREDENTIALS`, `EMAIL_IN_USE`, `UPLOAD_ERROR`, `EMAIL_CHANGE_UNSUPPORTED`, and the
AI set — `AI_REFUSED`, `AI_BAD_REQUEST`, `AI_RATE_LIMITED`, `AI_UNAVAILABLE`,
`AI_AUTH_ERROR`, `AI_ERROR`. Add new `SCREAMING_SNAKE_CASE` codes as needed — the frontend
branches on `error.code`, never on `error.message`.

One exception, by design: **Better Auth serves `/api/auth/*` and uses its own response
shape**, not this envelope. Everything the template itself writes uses the envelope.

### 3.3 Config comes from `env.ts`, logs come from `logger.ts`

```ts
import { env } from '../config/env.js'; // ✅  process.env.FOO  ❌
import { logger } from '../config/logger.js'; // ✅  console.log      ❌
```

Adding a config value means adding it to **three** places: the Zod schema in
`config/env.ts`, `backend/.env.example`, and your local `backend/.env`.

`MONGODB_URI` and `JWT_SECRET` are the only required variables, and **only in production**.
Outside production `env.ts` fills them in — `mongodb://127.0.0.1:27017/template` and a
secret derived from `process.cwd()` — so a fresh clone runs with `npm run dev` and no `.env`,
with a warning on stderr. The secret is derived rather than random so it survives watch
reloads. A _malformed_ value still exits in every environment: the fallback covers a missing
variable, never a typo'd one.

If the value also needs to reach the Docker stack, add it to `docker-compose.yml` under the
backend service and to the **root** `.env.example`, which exists only for compose
interpolation and configures nothing by itself.

### 3.4 Express 5 handles async errors for you

Express 5 forwards rejected promises from route handlers to the global error handler
automatically. Do **not** install `express-async-handler` and do not wrap handlers in
try/catch purely to call `next(err)`. Throw `AppError` for expected failures:

```ts
import { AppError } from '../middleware/errorHandler.js';
throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
```

### 3.5 Middleware order in `app.ts` is load-bearing

`helmet → compression → pino-http → cors → cookieParser → **Better Auth handler** → body
parsers → rateLimit('/api') → /health → / → routes → notFoundHandler → globalErrorHandler`.

New routes mount **after** the rate limiter and **before** `notFoundHandler`. The two
error handlers always stay last, in that order.

The Better Auth handler sits **before `express.json()`** and that placement is required: it
reads the raw request stream, and a body parser that has already consumed it hands Better
Auth an empty body. Its route is `app.all('/api/auth/*splat', ...)` — the named wildcard is
Express 5 syntax; the Express 4 spelling `/api/auth/*` throws at startup.

### 3.6 Tailwind v4 has no config file

All theming lives in `frontend/src/index.css`: CSS custom properties under `:root` and
`.dark`, exposed to Tailwind through `@theme inline`. To change brand colors, edit the
oklch values there — do not create `tailwind.config.js`, it will be ignored.

Dark mode is a **class variant** (`@custom-variant dark (&:is(.dark *))`). It activates
when `.dark` is present on an ancestor — put it on `<html>`. Nothing in the template toggles
it yet; the stored `themePreference` exists to drive it (a Better Auth additional field under
the default provider, `User.settings.themePreference` under the legacy one).

### 3.7 Frontend path alias and import extensions

`@/` resolves to `frontend/src/` (configured in both `vite.config.ts` and
`tsconfig.app.json`). Local imports in this codebase carry explicit `.tsx`/`.ts`
extensions — `allowImportingTsExtensions` is on. Match the surrounding style:

```tsx
import { Button } from '@/components/ui/button.tsx';
import { HomePage } from './pages/Home.tsx';
```

`erasableSyntaxOnly` is enabled — no TS `enum`, no constructor parameter properties.
`noUnusedLocals` / `noUnusedParameters` are on, so an unused import fails the build.

### 3.8 Protect routes with `requireAuth`, read `req.authUser`

```ts
import { requireAuth } from '../auth/index.js';

router.get('/things', requireAuth, (req, res) => {
  const { id, email, firstName } = req.authUser!;
});
```

Both are provider-neutral: `requireAuth` delegates to Better Auth or to the legacy JWT
middleware depending on `AUTH_PROVIDER`, and populates the same `req.authUser` either way.
That is what makes the switch a one-line env change. Do **not** reach for `req.user` (the
legacy Mongoose document) or call `auth.api.getSession` directly in route code.

`req.authUser.id` is a Better Auth string id under the default provider and a stringified
Mongo `ObjectId` under the legacy one. Treat it as an opaque string.

### 3.9 The frontend talks to `/api`, always

The Vite dev server proxies `/api/*` → `http://localhost:3000`, and in production nginx
serves the same origin. Fetch relative paths (`fetch('/api/auth/login')`). Do not build
absolute `http://localhost:3000` URLs into components — that breaks production and CORS.

---

## 4. What already exists

### API surface

Default provider (`AUTH_PROVIDER=better-auth`):

| Method | Path                         | Auth    | Handler                                                           |
| ------ | ---------------------------- | ------- | ----------------------------------------------------------------- |
| GET    | `/health`                    | public  | inline in `app.ts`                                                |
| GET    | `/`                          | public  | redirect to `FRONTEND_URL`                                        |
| POST   | `/api/auth/sign-up/email`    | public  | Better Auth                                                       |
| POST   | `/api/auth/sign-in/email`    | public  | Better Auth                                                       |
| GET    | `/api/auth/get-session`      | cookie  | Better Auth                                                       |
| POST   | `/api/auth/sign-out`         | cookie  | Better Auth                                                       |
| \*     | `/api/auth/*`                | —       | Everything else Better Auth serves                                |
| PUT    | `/api/user/:userID`          | session | `userController.updateProfile`                                    |
| PUT    | `/api/user/:userID/settings` | session | `userController.updateSettings`                                   |
| POST   | `/api/ai/message`            | session | `aiController.postMessage` (only when `ANTHROPIC_API_KEY` is set) |
| POST   | `/api/ai/stream`             | session | `aiController.postMessageStream` (SSE)                            |

With `AUTH_PROVIDER=jwt`, `/api/auth` reverts to the legacy routes — `POST /signup`,
`POST /login` returning `{ token, user }`, `GET /me` with a bearer token — and Better Auth is
not mounted at all.

`/api/*` is rate limited to 300 requests / 15 min per IP.

No upload routes are mounted. `middleware/upload.ts` and `utils/storage.ts` are the plumbing
for you to add your own.

### Data model

**Under the default provider, Better Auth owns the user store** and creates its own
collections on first use:

| Collection     | Holds                                                          |
| -------------- | -------------------------------------------------------------- |
| `user`         | `name`, `email`, `emailVerified`, plus additional fields below |
| `account`      | Credentials — the password hash lives here, never on `user`    |
| `session`      | Active sessions: token, expiry, IP, user agent                 |
| `verification` | Email-verification / reset tokens (created when first needed)  |

The template declares three `additionalFields` on `user` so the app's shape survives a
provider switch: `firstName`, `lastName`, `themePreference` (default `'dark'`).

The two user stores are **separate and do not share documents** — Better Auth writes to
`user`, the legacy system to Mongoose's `users`. That is what makes switching safe, but it
also means accounts do not carry across: a user created under one provider cannot sign in
under the other. Migrating real users is a data job, not a config change.

### Legacy data model

The Mongoose `User` model is still present and is the store **only** when
`AUTH_PROVIDER=jwt`:

| Field                      | Type                | Rules                                                                             |
| -------------------------- | ------------------- | --------------------------------------------------------------------------------- |
| `email`                    | String              | required, unique, lowercased, trimmed, regex-validated                            |
| `password`                 | String              | required, min 8, **`select: false`**, bcrypt-hashed (12 rounds) via `pre('save')` |
| `firstName` / `lastName`   | String              | required, trimmed, max 50                                                         |
| `settings.themePreference` | `'light' \| 'dark'` | default `'dark'`                                                                  |
| `createdAt` / `updatedAt`  | Date                | via `timestamps: true`                                                            |

`comparePassword(candidate)` is an instance method. `toJSON` strips `password`.
Because of `select: false`, any query that needs the hash must ask for it:
`User.findOne({ email }).select('+password')`.

### Optional subsystems — wired, inert until configured

Each follows the same pattern: no credentials means it no-ops rather than crashing, so a
fresh clone runs with nothing but a MongoDB connection.

| Subsystem | Switched on by      | Without it                                      |
| --------- | ------------------- | ----------------------------------------------- |
| Postgres  | `POSTGRES_*`        | Skipped at boot; `getSql()` throws if called    |
| S3        | `AWS_S3_BUCKET`     | Skipped at boot; upload helpers throw if called |
| Email     | `RESEND_API_KEY`    | Every message is logged to the console instead  |
| AI        | `ANTHROPIC_API_KEY` | `/api/ai` is not mounted; the routes 404        |

### Not yet built — expect to add these

- No frontend API client for the app's own routes, and no protected-route wrapper.
- No dark-mode toggle wired to `themePreference`.
- No upload routes mounted (the plumbing exists).
- `adminProtect` / `generateAdminToken` are legacy and unused by any route.
- No database indexes beyond `email`'s implicit unique index.
- No background jobs, caching, or websockets.

---

## 5. How to extend

### Add a resource (model → controller → route)

1. **Model** — `backend/src/models/Thing.ts`. Mirror `User.ts`: typed `Schema<Attrs, Model, Methods>`,
   `{ timestamps: true }`, export both named and default.
2. **Validation** — add an express-validator chain to `backend/src/middleware/validation.ts`.
3. **Controller** — `backend/src/controllers/thingController.ts`, one exported
   `RequestHandler` per action, returning `successResponse` / `errorResponse`.
4. **Routes** — `backend/src/routes/thing.ts`:
   `router.post('/', requireAuth, createThingValidation, validate, createThing);`
5. **Mount** — in `app.ts`: `app.use('/api/thing', thingRoutes);` (before `notFoundHandler`).
6. **Scope by owner** — user-owned documents get an owner field indexed on
   `req.authUser!.id`. Under Better Auth that id is an opaque string, not an ObjectId, so
   type the field `String` rather than `Schema.Types.ObjectId` if you want the model to work
   under both providers. Compare ids as strings either way.

### Add a page

1. Create `frontend/src/pages/Thing.tsx`, exporting a named component.
2. Register it in `App.tsx`: `<Route path="/thing" element={<ThingPage />} />`.
3. Compose from `@/components/ui/*`; pull new primitives with
   `cd frontend && npx shadcn@latest add dialog input label` — they land in
   `src/components/ui/` and follow `components.json`.
4. Use `cn()` from `@/lib/utils.ts` to merge conditional classes.

### Add an env var

Zod schema in `config/env.ts` → `.env.example` → local `.env`. All three, or boot fails.

---

## 6. Commands

| Where    | Command                                           | Does                                                              |
| -------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| root     | `npm install`                                     | Installs Husky + lint-staged + Prettier, activates git hooks      |
| root     | `npm run format`                                  | Prettier across the repo                                          |
| backend  | `npm run db`                                      | Local Mongo + Postgres with no system install — see README        |
| backend  | `npm run db:reset`                                | Deletes `backend/.devdata`                                        |
| backend  | `npm run email:check`                             | Resend key + sending-domain preflight                             |
| backend  | `npm run dev`                                     | `tsx watch src/server.ts` — reloads on save                       |
| backend  | `npm run build` / `npm start`                     | Compile to `dist/` / run compiled output                          |
| backend  | `npm run typecheck` / `npm run lint` / `npm test` | Must all pass — CI runs them                                      |
| frontend | `npm run dev`                                     | Vite on **5173**, HMR, proxies `/api`                             |
| frontend | `npm run build` / `npm run preview`               | Typecheck + bundle / serve the bundle                             |
| frontend | `npm run typecheck` / `npm run lint` / `npm test` | Must all pass — CI runs them                                      |
| root     | `docker compose up --build`                       | Whole stack: frontend **8080**, backend **3000**, mongo **27017** |

Ports: frontend dev **5173**, backend **3000**, mongo **27017**, dockerized frontend **8080**.

---

## 7. Environment variables

**`backend/.env`** — all validated by Zod at boot.

Forty-seven variables are defined. **Two are required in production and none in development**
— everything else has a default or switches an optional subsystem off when absent. `backend/.env.example` documents every one
with its default; treat the Zod schema as the source of truth and that file as its mirror.

| Var            | Required | Default                 | Notes                                                           |
| -------------- | -------- | ----------------------- | --------------------------------------------------------------- |
| `MONGODB_URI`  | **yes**  | —                       | Must parse as a URL                                             |
| `JWT_SECRET`   | **yes**  | —                       | **Minimum 32 characters**. Also the Better Auth secret fallback |
| `NODE_ENV`     | no       | `development`           | `development` \| `production` \| `test`                         |
| `PORT`         | no       | `3000`                  |                                                                 |
| `JWT_EXPIRE`   | no       | `7d`                    | Legacy provider only                                            |
| `FRONTEND_URL` | no       | `http://localhost:5173` | CORS origin, `/` redirect target, Better Auth trusted origin    |
| `LOG_LEVEL`    | no       | `info`                  | fatal\|error\|warn\|info\|debug\|trace                          |
| `APP_NAME`     | no       | `Template`              | Email subjects, layout, User-Agent                              |

The rest fall into four groups, each inert until its trigger var is set:

| Group    | Trigger                | Other vars                                                                                          |
| -------- | ---------------------- | --------------------------------------------------------------------------------------------------- |
| Auth     | `AUTH_PROVIDER`        | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_DB_TRANSACTIONS`                              |
| Postgres | `POSTGRES_HOST`/`_URL` | `_PORT` `_DB` `_USER` `_PASSWORD` `_SCHEMA` `_SSL` and three pool knobs                             |
| S3       | `AWS_S3_BUCKET`        | `AWS_REGION`, credentials, `_ENDPOINT`, `_PUBLIC_URL`, `_ACL`, limits                               |
| Email    | `RESEND_API_KEY`       | `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_DRY_RUN`, timeout, attempts                                  |
| AI       | `ANTHROPIC_API_KEY`    | `_MODEL`, `_MAX_TOKENS`, `_EFFORT`, `_SYSTEM_PROMPT`, `_REFUSAL_FALLBACK`, `AI_RATE_LIMIT_PER_HOUR` |

Postgres requires `HOST`, `DB` and `USER` **together**; setting some but not all is a
deliberate boot error. The same applies to the AWS key/secret pair.

**`frontend/.env`** — `VITE_API_URL` (dev proxy target only; production uses same-origin `/api`).

Never commit `.env`. Only `VITE_`-prefixed vars reach the browser — and everything that
reaches the browser is public. Secrets belong in `backend/.env` exclusively.

---

## 8. Gotchas

1. **Missing `.js` on a backend relative import** → `ERR_MODULE_NOT_FOUND` at runtime, and
   `tsc --noEmit` catches it. Most frequent failure in this codebase.
2. **`JWT_SECRET` under 32 chars** → server exits immediately at boot with a Zod error. A
   _missing_ one is fine outside production (it is derived); a _too-short_ one never is.
3. **Querying a user's password without `.select('+password')`** → `comparePassword`
   throws on `undefined`.
4. **Creating `tailwind.config.js`** → silently ignored. Tailwind v4 config is CSS-side.
5. **Unused import in the frontend** → `noUnusedLocals` fails `npm run build`, so CI fails.
6. **Hardcoding `http://localhost:3000` in frontend fetches** → works in dev, breaks in
   production and trips CORS.
7. **`docker compose up` without `JWT_SECRET` set** → compose aborts by design
   (`${JWT_SECRET:?...}`).
8. **Adding a route after `notFoundHandler`** → every request to it 404s.
9. **Mongoose `_id` comparison** → `req.user._id !== req.params.id` is always true for
   ObjectId vs string. Use `.toString()` on both sides.
10. **Backend tests that need MongoDB start their own.** `auth.test.ts` and
    `auth-legacy.test.ts` spin up `mongodb-memory-server`; the rest never open a connection.
    No test touches the network.
11. **Mounting anything that parses a body before the Better Auth handler** → Better Auth
    receives an empty body and every sign-in fails. It must stay above `express.json()`.
12. **`BETTER_AUTH_DB_TRANSACTIONS=true` against a standalone `mongod`** → every write fails
    with _"Transaction numbers are only allowed on a replica set member or mongos"_.
    Transactions need a replica set; `docker compose up mongo` is a standalone. `npm run db`
    runs a single-node replica set, so it supports them.
13. **Expecting accounts to survive an `AUTH_PROVIDER` switch** → they do not. The two
    providers have separate user stores.
14. **Writing `/api/auth/*` instead of `/api/auth/*splat`** → Express 5 throws at startup.
15. **A Claude refusal is HTTP 200, not an exception.** `stop_reason: 'refusal'` with empty
    content — check it before trusting the text, or you will report an empty answer as
    success. The route maps it to a 422.
16. **`budget_tokens` is rejected by current models.** Use adaptive thinking and `effort`;
    the fixed-thinking-budget parameter returns a 400 on Opus 5.
17. **A send failure never becomes a 500.** Email triggers swallow and log, so a broken
    Resend key is silent — run `npm run email:check` rather than waiting for a bug report.

---

## 9. Spec sheets

`seed-documentation/` holds six blank CSV templates that define an app before it is built:

| File                                                       | Captures                                               |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| `App Outline - Application Overview.csv`                   | Name, audience, goal, monetization, stack, constraints |
| `App Outline - Functional Requirements (User Stories).csv` | `FR-xxx` user stories + acceptance criteria            |
| `App Outline - Application Pages_Views.csv`                | `PV-xx` pages, routes, access level, data shown        |
| `App Outline - Data Model (Database Structure).csv`        | Models, fields, types, indexes, references             |
| `App Outline - API Routes and Core Logic.csv`              | `RT-xxx` endpoints, auth, I/O, error cases             |
| `App Outline - Design & Style Guide.csv`                   | Colors, type, radius, tone, accessibility target       |

IDs cross-reference across sheets (a page cites the routes it calls; a route cites the
models it touches). Filled-in sheets are the source of truth for what gets built.
