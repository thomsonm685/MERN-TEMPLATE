# Template V2

Two independent npm projects in one repo:

- `backend/` — Node 20+, Express 5, MongoDB (Mongoose), TypeScript, JWT auth.
- `frontend/` — Vite 6, React 19 (+ React Compiler), Tailwind CSS v4, TypeScript, shadcn/ui, React Router 7.

The repo root holds only shared tooling (Husky, lint-staged, Prettier). Each app has its own `package.json`, lockfile, and CI job.

## Prerequisites

- Node.js 20+
- npm 10+
- A running MongoDB (locally, or via `docker compose up mongo`)

## First-time setup

```bash
# Install shared tooling + git hooks at the repo root
npm install

# Install each app
cd backend && npm install && cp .env.example .env
cd ../frontend && npm install && cp .env.example .env
```

Edit `backend/.env` and set a real `JWT_SECRET` (≥32 chars) and `MONGODB_URI`.

## Day-to-day

```bash
# Terminal 1 – backend (auto-reloads on save)
cd backend && npm run dev

# Terminal 2 – frontend (Vite proxies /api to the backend)
cd frontend && npm run dev
```

Frontend is served at <http://localhost:5173>; backend at <http://localhost:3000>. The Vite dev server proxies `/api/*` to the backend, so the browser only ever talks to one origin.

## Scripts

### Backend (`cd backend`)

| Command             | What it does                             |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Start Express with `tsx watch`           |
| `npm run build`     | Emit JS to `dist/`                       |
| `npm start`         | Run the compiled output (used by Docker) |
| `npm run lint`      | ESLint                                   |
| `npm run typecheck` | `tsc --noEmit`                           |
| `npm test`          | Vitest (smoke tests in `tests/`)         |

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

## Running everything in Docker

```bash
JWT_SECRET=your-real-secret-of-32-plus-chars docker compose up --build
```

Frontend → <http://localhost:8080>, backend → <http://localhost:3000>, Mongo → `mongodb://localhost:27017`.

## API surface (current)

| Method | Path                         | Auth   | Notes                          |
| ------ | ---------------------------- | ------ | ------------------------------ |
| GET    | `/health`                    | public | Liveness probe                 |
| POST   | `/api/auth/signup`           | public | Email + password               |
| POST   | `/api/auth/login`            | public | Returns `{ token, user }`      |
| GET    | `/api/auth/me`               | bearer | Current user                   |
| PUT    | `/api/user/:userID`          | bearer | Update profile (own user only) |
| PUT    | `/api/user/:userID/settings` | bearer | Update theme preference        |

Responses follow `{ success, message, data }` for OK and `{ success: false, error: { message, code, details } }` for failures.

## Env vars

### Backend (`backend/.env`)

```
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/template
JWT_SECRET=<at-least-32-chars>
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:5173
LOG_LEVEL=info
```

Validated at boot via Zod — the server refuses to start if anything is missing or malformed.

### Frontend (`frontend/.env`)

```
VITE_API_URL=http://localhost:3000
```

Only used by the Vite dev proxy; in production the frontend is served behind the same origin (or routed to `/api`).
