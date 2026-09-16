# Troubleshooting

You fix these. The person you're building for should never see an error message — only
the one sentence that tells them what _they_ need to do, if anything.

---

## No database

The most common blocker, and the one to catch in Phase 0 before they've invested time.

### Option A — something is already listening on 27017 _(best)_

```bash
nc -z localhost 27017 && echo OPEN
```

Use `mongodb://localhost:27017/<slug>`. Nothing to install. Done.

### Option B — Docker is running

The template's `docker-compose.yml` already defines a `mongo` service.

```bash
cd <project> && docker compose up -d mongo
# wait for it
for i in $(seq 1 30); do nc -z localhost 27017 && break; sleep 1; done
```

Use `mongodb://localhost:27017/<slug>`. Mention once: _"I started the database — it'll
keep running in the background."_

### Option C — MongoDB Atlas free tier _(no install, works everywhere)_

Best fallback for a non-technical person on a fresh machine. Walk them through it in
plain language, one step at a time:

1. _"Go to <https://www.mongodb.com/cloud/atlas/register> and make a free account."_
2. _"Create a free cluster — pick the **M0 Free** option and just accept the defaults."_
3. _"It'll ask you to make a database user. Pick any username and password, and **save
   the password somewhere** — I'll need it in a second."_
4. _"Under Network Access, click 'Allow access from anywhere'."_
5. _"Hit Connect → Drivers, and paste me the line that starts with `mongodb+srv://`."_

Then assemble the URI yourself — swap in their password and add the database name before
the `?`:

```
mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<slug>?retryWrites=true&w=majority
```

If their password contains `@ : / ? # [ ] %`, URL-encode it or it will silently fail to
connect. Safest to ask for a password with letters and numbers only.

### Option D — install MongoDB locally (Mac, Homebrew)

```bash
brew tap mongodb/brew && brew install mongodb-community
brew services start mongodb-community
```

Only suggest this if they already have Homebrew — installing Homebrew is a big ask for
someone non-technical.

---

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
| `MongoDB connection failed` then exit                   | Database not reachable          | Back to "No database" above                                                |
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

- **Stop:** kill the two background dev servers. If Docker started Mongo,
  `docker compose stop mongo` — but leaving it running is harmless.
- **Restart later:** open the project folder in Claude Code and say "start my app" —
  `CLAUDE.md` tells the next session exactly which two commands to run.
