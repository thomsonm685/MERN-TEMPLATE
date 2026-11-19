---
name: new-app
description: "Set up a brand-new web app for someone non-technical — asks plain-English questions about their idea, clones the production-ready MERN template (Express 5 + MongoDB + React 19 + Tailwind v4 + shadcn/ui), installs it, writes their answers into the six spec sheets, starts a local MongoDB and Postgres that need no installing, and hands back a project that is ready to build. Stops before writing app code: the build is the next conversation, and it starts from the spec this skill produced. Use when: /app-builder:new-app, 'build me an app', 'make me an app', 'I have an app idea', 'create a new app', 'start a new project', 'set up a new project', 'I want to build software', 'turn my idea into an app', 'new MERN app', 'scaffold an app from my template'. NOT for changing an app that already exists — just edit that app directly."
user_invocable: true
---

# New App

Take someone from _"I have an idea"_ to _"the project is set up, the plan is written
down, and the databases are running"_ in one conversation — then offer to build it.

**Assume the person you are talking to has never written code.** They should never
need to open a terminal, read an error, install a database, or know what MongoDB is.
You do all of it.

---

## Where this skill stops

It ends with a **ready-to-build project**, not a running app:

- The template is cloned, renamed, and installed.
- `seed-documentation/*.csv` holds their idea as a filled-in spec.
- `CLAUDE.md` and `docs/YOUR-APP.md` are written.
- MongoDB and Postgres are running locally, and `backend/.env` points at both.
- `npm run typecheck`, `npm run lint` and `npm test` pass on the untouched template.

Then you ask whether to build the first version. If they say yes, you carry straight on
in the same conversation using `reference/build-patterns.md` — but the spec exists and
has been read back to them _before_ any code is written, which is the cheapest possible
place to catch a misunderstanding.

---

## Ground rules

1. **Plain English, always.** No jargon in anything you say to them. Not "scaffold",
   "dependencies", "schema", "endpoint", "env var", "repo". Say "set up the project
   files", "download the building blocks", "how information is stored", "a web address
   the app answers on", "settings", "starter project". If you must name a technology,
   add a five-word explanation.
2. **One question at a time.** Use `AskUserQuestion` with concrete options and a clear
   recommendation. Never present a wall of questions. Never ask them to pick a
   technology — that decision is already made.
3. **Never show raw errors.** If a command fails, read it yourself, fix it yourself,
   and tell them plainly what happened only if it needs their input ("I need you to
   install one free program — here's the one click that does it").
4. **Show progress, hide the machinery.** Short status lines between phases
   ("Writing your plan down…"), not command output.
5. **Never invent that something works.** Verify the databases actually answered and the
   checks actually passed before saying the project is ready.
6. **Don't stop to ask what you can safely decide.** Colours, field names, page layout,
   which pages exist — make the call, write it into the spec, and let them react to
   something concrete.

---

## Cost & duration

A full run is roughly **8–15 minutes** of wall clock — most of it the download, the
install, and the first database binary fetch, all of which happen while you talk to them.
It makes network calls (one git clone, three npm installs, a MongoDB binary download on
the very first run ever) and writes files inside a new folder it creates.

Building v1 afterwards, if they ask for it, is another 15–30 minutes.

---

## Workflow checklist

Keep this visible and tick items off as you go — it survives context compaction.

```
Setting up <App Name>:
- [ ] Phase 0 — Preflight: Node 20+, npm, git, and a local session
- [ ] Phase 0.5 — Already inside a template clone? Build in place, don't re-clone
- [ ] Phase 1 — Name the app and choose where it lives
- [ ] Phase 2 — Start the download + install in the BACKGROUND
- [ ] Phase 3 — Interview: 10 plain-English questions
- [ ] Phase 4 — Read the plan back in their words, get a yes
- [ ] Phase 5 — Write the spec: six CSVs, CLAUDE.md, docs/YOUR-APP.md
- [ ] Phase 6 — Settings files, then start MongoDB + Postgres locally
- [ ] Phase 7 — Verify, hand over, offer to build v1
```

---

## Phase guide — read the file for the phase you are running

| Phase         | File                                               | Covers                                                             |
| ------------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| 0–2 Setup     | [workflow/1-setup.md](workflow/1-setup.md)         | Preflight, in-place check, naming, background clone + install      |
| 3–4 Interview | [workflow/2-interview.md](workflow/2-interview.md) | The 10 questions, what to infer, the confirmation summary          |
| 5 Spec        | [workflow/3-spec.md](workflow/3-spec.md)           | Filling the six CSVs via the plan file, `CLAUDE.md`, `YOUR-APP.md` |
| 6 Databases   | [workflow/4-databases.md](workflow/4-databases.md) | `.env` for Mongo **and** Postgres, starting both locally           |
| 7 Handoff     | [workflow/5-handoff.md](workflow/5-handoff.md)     | Verification gates, the handoff message, the offer to build        |

## Reference — load on demand

| File                                                         | When                                                                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| [reference/spec-json.md](reference/spec-json.md)             | Phase 5 — the exact shape of the plan file the CSV writer takes                                                           |
| [reference/troubleshooting.md](reference/troubleshooting.md) | Any phase — a command failed, a port is busy, Node too old, the database won't start                                      |
| `ARCHITECTURE.md` **in the new project**                     | Only if you go on to build. The authoritative map of the template; it ships inside every generated app. Read it first.    |
| [reference/build-v1.md](reference/build-v1.md)               | Only if you go on to build — build order, verification gates, starting both servers, the app handoff                      |
| [reference/build-patterns.md](reference/build-patterns.md)   | Only if you go on to build — copy-ready code for the pieces the template lacks: API client, auth context, a CRUD resource |

---

## The stack they are getting (for your reference, not theirs)

Two independent npm projects in one folder, cloned from
`https://github.com/thomsonm685/MERN-TEMPLATE.git` (public — no account or key needed):

- **backend/** — Node 20+, Express 5, MongoDB via Mongoose 8, TypeScript, Better Auth
  (cookie sessions), Zod-validated env, Pino logging, helmet/cors/rate-limiting wired.
  Postgres ships wired but inert until `POSTGRES_*` is set.
- **frontend/** — Vite 6, React 19 (React Compiler on), Tailwind CSS v4, shadcn/ui,
  React Router 7, TypeScript.

Sign-up, log-in, sessions and sign-out already work out of the box, served by Better Auth at
`/api/auth/*`, with `frontend/src/lib/auth-client.ts` as the browser client. Never rebuild
any of that — extend it, and never hand-roll token storage; the session is an httpOnly cookie.

---

## Gotchas

- **Check whether you are already inside a clone of the template** before cloning anything
  (Phase 0.5). People install the plugin by cloning this repo and then say "build me an app"
  right there; cloning again nests the template inside itself. `plugins/app-builder` present
  means template, absent means somebody's existing app — and an existing app is a stop, not
  a scaffold.
- **The interview happens while the download runs.** Start the clone and `npm install`
  in the background (Phase 2) _before_ asking the questions, then wait for it at the
  start of Phase 5. Doing it in order wastes minutes of their time watching nothing.
- **`npm install` runs in three places** — repo root, `backend/`, and `frontend/`. They
  are separate projects with separate lockfiles. Installing only at the root leaves you
  with nothing runnable.
- **No database needs installing.** `cd backend && npm run db` starts real MongoDB and
  Postgres binaries as child processes, no Docker and no Atlas account. Do not send
  anyone to a signup page. Details in `workflow/4-databases.md`.
- **Check ports 27017 and 5432 before starting them.** If a system MongoDB, Docker or
  another project already owns one, the script refuses to start rather than half-starting.
  Reuse what's running and start only the missing engine — the slug in the connection
  string keeps their data separate.
- **Write `backend/.env` before starting the databases.** The database script reads it
  for ports, names and credentials, so writing the file afterwards gives you a server
  serving one database name and an app connecting to another.
- **Postgres is ignored unless `POSTGRES_*` is in `.env`.** The script will happily run a
  Postgres the app never talks to, and prints a notice saying so. Write the five
  variables.
- **`npm run db` runs in the foreground until Ctrl+C.** Start it with
  `run_in_background: true` or the conversation locks up.
- **`JWT_SECRET` must be at least 32 characters** or the backend exits at boot with a
  validation error and no server. Generate it with `openssl rand -hex 32` — never use a
  placeholder.
- **Delete `plugins/`, `.claude/`, `.git` and `docs/first-app.html` from the clone.** All
  four belong to the template, not to their app, and all four ride along in the clone.
  Then re-init a fresh repo.
- **Check you are in a local session before promising anything they can open.** In a
  cloud session the project lives on Anthropic's infrastructure, so a `localhost` URL
  points at a machine that isn't theirs. If `hostname` and the working directory look
  like a managed sandbox, say so early and ask them to start a local session instead.
  The desktop app, the CLI and the IDE extensions all give you a real local machine.
- **Spec small on purpose.** Three screens that work beats twelve that half-work. They
  will ask for more the moment they see something real, and that conversation is far
  more productive than guessing up front.

---

## What good looks like

A run succeeded when **all** of these are true:

- The person answered about ten friendly questions and never saw a terminal.
- A new folder exists with the template installed and renamed — their app's name is in
  `package.json`, the browser tab title, and the database name.
- All six `seed-documentation/*.csv` sheets are filled in and cross-reference each other
  by ID, with no placeholder rows left.
- `CLAUDE.md` and `docs/YOUR-APP.md` exist, so the next session starts informed and they
  have something readable.
- MongoDB and Postgres are both running locally, and `backend/.env` names both.
- `npm run typecheck`, `npm run lint` and `npm test` pass in `backend/`, and typecheck
  passes in `frontend/` — on the untouched template.
- The last message tells them, in plain English, what exists, what doesn't yet, and that
  saying "build it" is the next step.
