# Phase 6 — Settings files, then the databases

Two databases, neither of them installed, both running in about a minute. The order
matters: **write `backend/.env` first**, because the database script reads it to decide
what ports, database names and credentials to serve.

---

## 6.1 Make the project theirs

```bash
cd <project>
# Package names
sed -i '' "s/\"name\": \"template-v2\"/\"name\": \"<slug>\"/"                package.json
sed -i '' "s/\"name\": \"template-backend\"/\"name\": \"<slug>-backend\"/"   backend/package.json
sed -i '' "s/\"name\": \"template-frontend\"/\"name\": \"<slug>-frontend\"/" frontend/package.json
# Browser tab
sed -i '' "s|<title>Template</title>|<title><App Name></title>|"             frontend/index.html
```

(On Linux, `sed -i` takes no `''` argument.) Also replace the word "Template" in
`README.md` with the app's name and rewrite its opening paragraph to describe their app
rather than the template.

---

## 6.2 Write `backend/.env`

Generate a real secret. Never a placeholder — anything under 32 characters and the
backend exits at boot with a validation error and no server.

```bash
cd <project>/backend
cat > .env <<ENVEOF
NODE_ENV=development
PORT=3000
APP_NAME=<App Name>
LOG_LEVEL=info
FRONTEND_URL=http://localhost:5173

MONGODB_URI=mongodb://127.0.0.1:27017/<slug>
JWT_SECRET=$(openssl rand -hex 32)

POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=<slug>
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_SSL=disable
ENVEOF
```

Why each database line matters:

- **`MONGODB_URI` ends in the slug**, so every app on their machine gets its own data
  instead of all sharing `template`.
- **The five `POSTGRES_*` lines are what switch Postgres on.** With them unset the app
  skips Postgres entirely at boot and runs on Mongo alone — and the database script will
  still start a Postgres server, which the app then ignores while printing a notice
  saying so. Setting only _some_ of `HOST`/`DB`/`USER` is a deliberate boot error, not a
  fallback: write all five.
- `POSTGRES_SSL=disable` is right for a local server. A managed provider later (Neon,
  Supabase, RDS, Railway) wants `no-verify`.

Then the frontend:

```bash
cd <project>/frontend && cp .env.example .env
```

---

## 6.3 Check the two ports first

A developer's machine often already has MongoDB or Postgres running — a Homebrew install,
Docker, Compass, or another project's `npm run db`. The script refuses to start on an
occupied port, which is correct but means you should know before you launch it:

```bash
for p in 27017 5432; do
  (nc -z 127.0.0.1 $p >/dev/null 2>&1 && echo "$p IN USE") || echo "$p free"
done
```

| Result      | What to do                                                                                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Both free   | Normal path. Start both: `npm run db`.                                                                                                                                                 |
| One in use  | Reuse the one that's running and start only the other: `npm run db -- --mongo` (or `--postgres`).                                                                                      |
| Both in use | Reuse both. **Skip 6.4 entirely** — the `.env` you already wrote points at `127.0.0.1` with the slug as the database name, so their app gets its own data inside the existing servers. |

Reusing a server that's already there is the better outcome, not a workaround: one fewer
long-lived process, and nothing to restart after a reboot. Say nothing about it to them —
"your app's storage is ready" is true either way.

If a port is in use but a connection fails later, something non-database is squatting on
it. Change the port in `backend/.env`, then `npm run db:reset` before restarting — see
`reference/troubleshooting.md`.

---

## 6.4 Start whatever isn't already running

```bash
cd <project>/backend && npm run db
```

Run it with **`run_in_background: true`.** It holds the terminal until Ctrl+C, so in the
foreground it locks up the conversation.

What it does, and why there is nothing to install: `mongodb-memory-server-core` and
`embedded-postgres` fetch the **official binaries** and run them as child processes. These
are real database servers, not emulators. Mongo runs as a 1-node replica set, so
transactions and change streams behave the way they will in production. Data persists in
`backend/.devdata/` (gitignored), so their records survive restarts; `npm run db:reset`
wipes it.

The first run ever downloads the MongoDB binary (~75 MB) into
`node_modules/.cache/mongodb-binaries`. The Postgres binary came down with
`npm install`. Both are cached after that.

Wait for this, then say the databases are ready — not before:

```
  MongoDB   mongodb://127.0.0.1:27017/<slug>
  Postgres  postgres://postgres:postgres@127.0.0.1:5432/<slug>

  Data persists in backend/.devdata — 'npm run db:reset' wipes it.

Ready. Press Ctrl+C to stop.
```

Things worth knowing:

- **A port conflict fails loudly** rather than half-starting — which is why 6.3 checks
  first. Two local servers cannot share a port; reuse the one that's there, or move the
  port. More in `reference/troubleshooting.md`.
- **Changing the Mongo port after the first run** invalidates the replica-set config baked
  into `.devdata`. Run `npm run db:reset` after any port change.
- **A remote host is skipped, not shadowed.** If `MONGODB_URI` ever points at Atlas, or
  `POSTGRES_URL` at Supabase, the script leaves that engine alone.
- **Run one engine only** with `npm run db -- --mongo` or `npm run db -- --postgres` —
  that is the 6.3 "one in use" path. With no flag it starts both.
- **This is for development.** Production uses a real managed database, and that is a
  later conversation — don't raise it now.

In their words, all of this is: _"Your app's storage is running on your own computer —
nothing to install and nothing to sign up for."_

---

## 6.5 Prove the foundation works before anything is built on it

```bash
cd <project>/backend  && npm run typecheck && npm run lint && npm test
cd <project>/frontend && npm run typecheck && npm run lint
```

All of these must pass on the untouched template. If they don't, the problem is the
environment, not anyone's code — fix it now, because every later failure will be harder
to attribute. The backend test run includes database integration tests, which is also
your proof that the connections actually work.
