# Phases 5–6 — Write the spec, finish the setup

The spec is not paperwork. It is what lets the next conversation — days later, with no
memory of this one — pick up exactly where you left off.

---

## Phase 5 — Write the spec

Three artefacts, each with a different reader.

### 5.1 Fill in the spec sheets (`seed-documentation/*.csv`)

The template ships six blank CSVs. Fill them from the interview — they are the
structured source of truth, and their IDs cross-reference each other.

| File                                                       | Fill with                                                                                                                                                                                                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `App Outline - Application Overview.csv`                   | The `Value` column: name, tagline, primary goal, audience, problem, roles, auth method, monetization, out of scope. Tech stack rows are already known — fill them in from `ARCHITECTURE.md` (React + TS + Vite / Node + Express 5 / MongoDB + Mongoose). |
| `App Outline - Functional Requirements (User Stories).csv` | One `FR-001`… row per thing a user can do, with acceptance criteria and `Required`/`Nice to have`.                                                                                                                                                       |
| `App Outline - Application Pages_Views.csv`                | One `PV-01`… row per page: route path, access level, purpose, what's on it, which `RT-` routes it calls.                                                                                                                                                 |
| `App Outline - Data Model (Database Structure).csv`        | One row **per field per model** — including the existing `User` fields, so the sheet is complete.                                                                                                                                                        |
| `App Outline - API Routes and Core Logic.csv`              | One `RT-001`… row per endpoint, including the seven the template already provides.                                                                                                                                                                       |
| `App Outline - Design & Style Guide.csv`                   | Colours (hex), fonts, radius, tone, icon library (Lucide), UI framework (shadcn/ui), accessibility target.                                                                                                                                               |

Write them with a small script rather than by hand — quote any field containing a comma.

### 5.2 `docs/YOUR-APP.md` — for them

Plain English, no jargon. The Phase 4 summary, expanded: what the app is, who it's for,
what someone can do in it today, what's deliberately not built yet, and how to ask for
changes. This is the file they'll actually open in six weeks.

### 5.3 `CLAUDE.md` — for the next session

Short and factual, at the project root. Claude Code loads it automatically, which is
what makes "just talk to it" work later.

```markdown
# <App Name>

<One-sentence description.> Built for <audience>.

## Read first

- `ARCHITECTURE.md` — the stack, the file map, and the conventions that break the
  build if ignored. Read it before writing code.
- `docs/YOUR-APP.md` — what this app is, in plain English.
- `seed-documentation/*.csv` — the filled-in spec sheets.

## This app specifically

- **Models:** User (from the template), <Thing>, <Thing>
- **Routes added:** /api/<thing> (CRUD, all behind `requireAuth`)
- **Pages:** / (<main screen>), /login, /signup, /<thing>/:id, /settings
- **Accent colour:** <name> — defined in `frontend/src/index.css`
- **Auth:** <one line from Q4>

## Running it

Backend: `cd backend && npm run dev` (port 3000)
Frontend: `cd frontend && npm run dev` (port 5173) ← this is the one to open
Database: <mongodb://localhost:27017/<slug> | Docker | Atlas>

## Not built yet (deliberately)

- <from the out-of-scope list>

## Working with the person who owns this

They are non-technical. Explain changes in plain English, don't show them errors, and
verify the app still loads after every change.
```

---

## Phase 6 — Finish the setup

### 6.1 Wait for the background install

Check the background task output for `APP_BUILDER_SETUP_COMPLETE`. If it isn't there
yet, tell them you're finishing the download and wait. If it failed, read the output
yourself and see `reference/troubleshooting.md` — don't show them the error.

### 6.2 Make the project theirs

```bash
cd <project>
# Package names
sed -i '' "s/\"name\": \"template-v2\"/\"name\": \"<slug>\"/"        package.json
sed -i '' "s/\"name\": \"template-backend\"/\"name\": \"<slug>-backend\"/"  backend/package.json
sed -i '' "s/\"name\": \"template-frontend\"/\"name\": \"<slug>-frontend\"/" frontend/package.json
# Browser tab
sed -i '' "s|<title>Template</title>|<title><App Name></title>|" frontend/index.html
```

(On Linux, `sed -i` takes no `''` argument.) Also replace the word "Template" in
`README.md` with the app's name, and rewrite the README's opening paragraph to describe
their app rather than the template.

### 6.3 Write the settings files

**`backend/.env`** — generate a real secret, never a placeholder:

```bash
cd <project>/backend
cat > .env <<ENVEOF
NODE_ENV=development
PORT=3000
MONGODB_URI=<the URI decided in Phase 0>
JWT_SECRET=$(openssl rand -hex 32)
FRONTEND_URL=http://localhost:5173
LOG_LEVEL=info
APP_NAME=<the app's name>
ENVEOF
```

`MONGODB_URI` ends in the app's slug as the database name —
`mongodb://localhost:27017/<slug>` — so each app gets its own data.

**`frontend/.env`**:

```bash
cd <project>/frontend && cp .env.example .env
```

### 6.4 Start the database if it isn't running

- Docker path: `docker compose up -d mongo`, then poll until port 27017 answers.
- Atlas path: their connection string goes straight into `MONGODB_URI` (remember to
  append `/<slug>` before the `?` for the database name).

### 6.5 Prove the foundation works before building on it

```bash
cd <project>/backend && npm run typecheck && npm test
cd <project>/frontend && npm run typecheck
```

All three must pass on the untouched template. If they don't, the problem is the
environment, not your code — fix it now, because every later failure will be harder to
attribute.
