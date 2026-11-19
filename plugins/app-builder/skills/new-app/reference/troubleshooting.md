# Troubleshooting

You fix these. The person you're building for should never see an error message — only
the one sentence that tells them what _they_ need to do, if anything.

---

## The databases won't start

`cd backend && npm run db` starts real MongoDB and Postgres binaries as child processes.
Nothing is installed, so most failures here are a port, a download, or a stale data
directory — not a missing database.

### A port is already in use

```
✖ MongoDB port 27017 is already in use.
```

The script refuses to half-start, which is correct. Find what's holding it:

```bash
lsof -ti:27017    # or :5432 for Postgres
```

| What's holding it                              | Fix                                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Another project's `npm run db`                 | Use it. Point this app's `.env` at the same server — the database _name_ keeps the data apart.     |
| A Homebrew `mongodb-community` or `postgresql` | Also fine. Leave it running and skip the script's copy: `npm run db -- --postgres` (or `--mongo`). |
| Docker (`docker ps`)                           | Either stop the container or skip that engine as above.                                            |
| Nothing recognisable                           | Change the port in `backend/.env`, then `npm run db:reset` — see the next item.                    |

### "not running with --replSet" or Mongo won't come up after a port change

The replica-set config and the Mongo port are baked into `backend/.devdata` on first run.
Change the port afterwards and that directory is stale.

```bash
cd backend && npm run db:reset && npm run db
```

That deletes local development data. Say so first if they've entered anything real.

### The binary download fails

First run ever fetches MongoDB (~75 MB) into `node_modules/.cache/mongodb-binaries`.
Postgres came down with `npm install`.

- **Offline or a corporate proxy** → retry once, then set a mirror in `backend/.env`:
  `MONGOMS_DOWNLOAD_MIRROR=https://fastdl.mongodb.org`.
- **An unsupported platform build** → point it at an installed `mongod` instead:
  `MONGOMS_SYSTEM_BINARY=/usr/local/bin/mongod`.
- **Postgres binary missing from `node_modules`** → the backend install didn't finish.
  `cd backend && npm install`.

### Postgres is running but the app ignores it

The script says so explicitly:

```
  Postgres is running but the app ignores it until .env has:
    POSTGRES_HOST=127.0.0.1
    ...
```

Write all five `POSTGRES_*` lines into `backend/.env` (see `workflow/4-databases.md`) and
restart the backend. Setting only some of `HOST`/`DB`/`USER` is a deliberate boot error,
not a fallback.

### Last resorts

Only if the embedded servers genuinely can't run on their machine:

- **Docker** — `docker compose up -d mongo`, and `docker compose --profile postgres up -d`
  for Postgres. Then `MONGODB_URI=mongodb://localhost:27017/<slug>`.
- **MongoDB Atlas free tier** — a browser signup, so it's a last resort for a
  non-technical person, not a first step. Walk them through
  <https://www.mongodb.com/cloud/atlas/register>, a free M0 cluster, a database user, and
  **Network Access → Allow access from anywhere**. Their connection string needs the slug
  inserted as the database name before the `?`:
  `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<slug>?retryWrites=true&w=majority`.
  URL-encode any `@ : / ? # [ ] %` in the password. `npm run db` detects the remote host
  and skips starting a local Mongo rather than shadowing it.

Never send someone to a signup page before trying `npm run db`.

## Node is missing or too old

The template needs Node 20+. Check with `node -v`.

Send them to <https://nodejs.org>, tell them to download the big green **LTS** button and
run the installer, then come back. After they confirm, re-check — a new terminal session
may be needed for the PATH to update, so if it still reports missing, that's why.

Never suggest nvm, asdf, or a version manager to a non-technical person.

---

## Backend won't start

Read the background output yourself. In order of likelihood:

| Symptom in the output                                   | Cause                           | Fix                                                                        |
| ------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------- |
| `Invalid environment variables: { JWT_SECRET: [...] }`  | Secret shorter than 32 chars    | Regenerate: `openssl rand -hex 32`                                         |
| `Invalid environment variables: { MONGODB_URI: [...] }` | Not a valid URL                 | Check for a missing `mongodb://` prefix or an unencoded password character |
| `MongoDB connection failed` then exit                   | Database not reachable          | Is `npm run db` still running? See "The databases won't start" above       |
| `ERR_MODULE_NOT_FOUND` naming one of your files         | A relative import missing `.js` | Add the extension. `npm run typecheck` finds all of them                   |
| `EADDRINUSE :::3000`                                    | Something already on port 3000  | See "Port already in use"                                                  |

---

## Port already in use

```bash
lsof -ti:3000        # what's holding it
kill $(lsof -ti:3000)
```

If it's a previous run of this same app, killing it is safe. If it's something else the
person is using, change `PORT` in `backend/.env` **and** `VITE_API_URL` in
`frontend/.env` to match.

**Vite reassigns its own port automatically** (5174, 5175…) — don't fight it, just read
the real port out of the dev server output and hand them that URL.

---

## `npm install` failed

- **Network/registry error** → retry once. Then check they're online.
- **`EACCES` permission errors** → they've previously run npm with `sudo`. Don't suggest
  `sudo` again; install into a fresh folder in their home directory instead.
- **Node-version complaint from `engines`** → see "Node is missing or too old".
- **Corrupted partial install** → `rm -rf node_modules package-lock.json` in that one
  project, then reinstall. Do it per project (`backend/` or `frontend/`), never at the
  root for all three.

---

## Typecheck or lint failures in code you just wrote

| Message                                                | Cause                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `Cannot find module './x' ... did you mean './x.js'?`  | Backend relative import missing `.js`                                                                  |
| `'X' is declared but its value is never read`          | `noUnusedLocals` — delete the unused import                                                            |
| `All imports in import declaration are unused`         | Same                                                                                                   |
| `Type-only import must use 'import type'`              | `consistent-type-imports` is an **error** here                                                         |
| `Property 'authUser' does not exist on type 'Request'` | You're outside a `requireAuth` route, or missed importing from `auth/index.js` which augments the type |
| Enum / parameter-property errors in the frontend       | `erasableSyntaxOnly` — use a union type or a `const` object instead of `enum`                          |

Frontend **warnings** (like `react-refresh/only-export-components`) don't fail the build.
Backend warnings do — lint-staged runs the backend with `--max-warnings=0`.

---

## The page loads but nothing works

1. Is the backend actually up? `curl -s http://localhost:3000/health`
2. Are frontend calls hitting `/api/...` relative paths? An absolute
   `http://localhost:3000` bypasses the proxy and trips CORS.
3. Is the session cookie being sent? Every `fetch` to the app's own API needs
   `credentials: 'include'`. Missing it is the most common cause of a blanket 401.
4. 401s right after signing in usually mean the call went to an absolute
   `http://localhost:3000` URL instead of a relative `/api/...` one. That makes the cookie
   third-party, and the browser drops it. Keep everything same-origin through the proxy.
5. Changing `BETTER_AUTH_SECRET` (or `JWT_SECRET`, which it falls back to) invalidates every
   existing session — have them sign in again.

---

## Frontend tests fail after you replace the home page

`frontend/src/pages/Home.test.tsx` asserts on the template's placeholder text
("Template", "Welcome.", "Continue", "Cancel"). If you replaced or deleted that page,
update the test to match the real page or delete it — and say which you did. Don't leave
a red test behind, and don't weaken an assertion just to make it pass.

---

## They want to stop or restart everything

- **Stop:** kill the two background dev servers, and the `npm run db` process if they
  want the storage down too (leaving it running is harmless).
- **The databases are a long-lived process.** They die on reboot. If the app stops loading
  after a restart, `cd backend && npm run db` before debugging anything else.
- **Restart later:** open the project folder in Claude Code and say "start my app" —
  `CLAUDE.md` tells the next session exactly which two commands to run.
