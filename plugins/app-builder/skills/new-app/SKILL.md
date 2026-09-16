---
name: new-app
description: "Build a brand-new web app from scratch for someone non-technical — asks plain-English questions about their idea, scaffolds the production-ready MERN template (Express 5 + MongoDB + React 19 + Tailwind v4 + shadcn/ui), installs dependencies, writes a spec, builds a working v1, starts it locally, and hands back a URL. Use when: /app-builder:new-app, 'build me an app', 'make me an app', 'I have an app idea', 'create a new app', 'start a new project', 'I want to build software', 'turn my idea into an app', 'new MERN app', 'scaffold an app from my template'. NOT for changing an app that already exists — just edit that app directly."
user_invocable: true
---

# New App

Take someone from _"I have an idea"_ to _"my app is running at this URL"_ in one
conversation, then leave them able to keep changing it by just talking to you.

**Assume the person you are talking to has never written code.** They should never
need to open a terminal, read an error, or know what MongoDB is. You do all of it.

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
   ("Building your sign-in screen…"), not command output.
5. **Never invent that something works.** Verify the app actually loads before saying
   it's ready. If a step fails, say so and fix it.
6. **Don't stop to ask what you can safely decide.** Colors, field names, page layout,
   which pages exist — make the call, build it, and let them react to something real.

---

## Cost & duration

One full run is roughly **15–35 minutes** of wall clock for a simple app (most of it
downloads and you writing code), and consumes a large amount of context — it reads the
template, writes the spec, and writes v1. For a complex app, build a deliberately small
v1 and say what you deferred. This skill makes network calls (a git clone and npm
installs) and writes files to disk inside a new folder it creates.

---

## Workflow checklist

Keep this visible and tick items off as you go — it survives context compaction.

```
Building <App Name>:
- [ ] Phase 0 — Preflight: Node 20+, git, and a database available
- [ ] Phase 1 — Name the app and choose where it lives
- [ ] Phase 2 — Start the download + install in the BACKGROUND
- [ ] Phase 3 — Interview: 8 plain-English questions
- [ ] Phase 4 — Confirm the plan in plain English (their last chance to redirect)
- [ ] Phase 5 — Write the spec files into the project
- [ ] Phase 6 — Finish setup (rename, settings file, database connection)
- [ ] Phase 7 — Build v1
- [ ] Phase 8 — Start it, verify it loads, hand over the URL
- [ ] Phase 9 — Handoff: tell them how to keep editing by talking
```

---

## Phase guide — read the file for the phase you are running

| Phase         | File                                                           | Covers                                                              |
| ------------- | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| 0–2 Setup     | [workflow/1-setup.md](workflow/1-setup.md)                     | Preflight checks, naming, folder choice, background clone + install |
| 3–4 Interview | [workflow/2-interview.md](workflow/2-interview.md)             | The 8 questions, what to infer, the confirmation summary            |
| 5–6 Spec      | [workflow/3-spec.md](workflow/3-spec.md)                       | Writing `docs/` spec + `CLAUDE.md`, finishing configuration         |
| 7 Build       | [workflow/4-build.md](workflow/4-build.md)                     | Build order, what v1 must include, verification gates               |
| 8–9 Run       | [workflow/5-run-and-handoff.md](workflow/5-run-and-handoff.md) | Starting both servers, verifying, the handoff message               |

## Reference — load on demand

| File                                                         | When                                                                                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `ARCHITECTURE.md` **in the new project**                     | Phase 7, before writing any code. This is the authoritative map of the template — it ships inside every generated app. Read it. |
| [reference/build-patterns.md](reference/build-patterns.md)   | Phase 7 — copy-ready code for the pieces the template lacks: API client, auth context, protected routes, a full CRUD resource   |
| [reference/troubleshooting.md](reference/troubleshooting.md) | Any phase — a command failed, a port is busy, no database, Node too old                                                         |

---

## The stack they are getting (for your reference, not theirs)

Two independent npm projects in one folder, cloned from
`https://github.com/thomsonm685/MERN-TEMPLATE.git`:

- **backend/** — Node 20+, Express 5, MongoDB via Mongoose 8, TypeScript, Better Auth
  (cookie sessions), Zod-validated env, Pino logging, helmet/cors/rate-limiting already wired.
- **frontend/** — Vite 6, React 19 (React Compiler on), Tailwind CSS v4, shadcn/ui,
  React Router 7, TypeScript.

Sign-up, log-in, sessions and sign-out already work out of the box, served by Better Auth at
`/api/auth/*`, and `frontend/src/lib/auth-client.ts` is the browser client. Do not rebuild any
of that — extend it. Never hand-roll token storage; the session is an httpOnly cookie.

**The full map of the template is `ARCHITECTURE.md` at the root of the new project.**
Read it in Phase 7. It documents the conventions that will break the build if ignored
(most importantly: backend relative imports must end in `.js`, and every API response
uses the `successResponse`/`errorResponse` envelope).

---

## Gotchas

- **The interview happens while the download runs.** Start the clone and `npm install`
  in the background (Phase 2) _before_ asking the 8 questions, then wait for it at the
  start of Phase 6. Doing it in order wastes three minutes of their time watching a
  progress bar.
- **`npm install` runs in three places** — repo root, `backend/`, and `frontend/`. They
  are separate projects with separate lockfiles. Installing only at the root leaves you
  with nothing runnable.
- **`JWT_SECRET` must be at least 32 characters** or the backend exits at boot with a
  validation error and no server. Generate it with `openssl rand -hex 32` — never use a
  placeholder.
- **Delete `plugins/` and `.git` from the clone.** The clone carries this very plugin
  and the template's git history. The new app needs neither; re-init a fresh repo.
- **No database is the most common blocker.** Check for it in Phase 0, before they have
  invested any time. Order of preference: something already listening on 27017 → Docker
  → MongoDB Atlas free tier (walk them through it in the browser). See
  `reference/troubleshooting.md`.
- **Two servers must run at once, both in the background.** Backend on 3000, frontend on 5173. If you run either in the foreground the conversation locks up.
- **Give them the frontend URL (5173), never the backend one (3000).** Port 3000 shows
  JSON and will make them think it's broken.
- **Vite picks a different port if 5173 is taken.** Read the actual port out of the dev
  server output — don't assume.
- **Check you are in a local session before promising a URL.** In a cloud session the
  app runs on Anthropic's infrastructure, so `http://localhost:5173` points at a machine
  that isn't theirs and the handoff is a dead end. If `hostname` and the working
  directory look like a managed sandbox rather than their own computer, say so early and
  ask them to start a local session instead. The desktop app, the CLI, and IDE
  extensions all give you a real local machine; cloud sessions do not.
- **Build small on purpose.** A v1 with three screens that works beats twelve screens
  that half-work. They will ask for more the moment they see something real, and that
  conversation is far more productive than guessing up front.

---

## What good looks like

A run succeeded when **all** of these are true:

- The person answered about eight friendly questions and never saw a terminal.
- A new folder exists with a working app — not the unchanged template. Their words
  appear in the interface; the name is theirs everywhere (browser tab, page headings,
  `package.json`, database name).
- Sign-up and log-in actually work against a live database.
- At least one thing that is _specific to their idea_ works end to end — they can create
  a record, see it listed, and it survives a page refresh.
- `npm run typecheck` and `npm run lint` pass in both `backend/` and `frontend/`.
- The frontend URL was opened and verified to render before it was handed over.
- `docs/` holds the spec, and `CLAUDE.md` exists so the next session starts informed.
- The last message tells them, in plain English, how to ask for changes.
