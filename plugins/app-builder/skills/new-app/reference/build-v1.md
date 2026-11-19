# Building v1 — the optional continuation

This skill's job ends when the project is set up and specced (Phase 7). If they say
"build it" — then or in a later conversation — this file is the build plan.

**Read `ARCHITECTURE.md` at the root of the new project before writing a single line.**
It is the authoritative map of this stack and it documents the conventions that silently
break the build. Do not skip it because the template "looks like a normal Express app".
The brief is `seed-documentation/*.csv`; copy-ready code is in
[build-patterns.md](build-patterns.md).

Keep `npm run db` running the whole time.

---

---

## What v1 must include

Non-negotiable, in this order:

1. **Backend data + API for their core thing** — model, validation, controller, routes,
   mounted in `app.ts`.
2. **A frontend API client** (`src/lib/api.ts`) — the template has none.
3. **Auth in the browser** — the `useAuth` adapter over the template's Better Auth client, login and signup pages,
   protected routes. The backend half already exists; the frontend half does not.
4. **Their main screen** — whatever they chose in Q6, working against real data.
5. **Create + list + view for their core thing** — the loop that makes the app theirs.
6. **Their name and their words throughout** — page headings, empty states, button
   labels, browser tab. No occurrence of the word "Template" anywhere they can see.
7. **Their colour** applied in `frontend/src/index.css`.

Anything beyond that is v2. Tell them what you deferred rather than silently building it.

---

## Build order (each step compiles before the next)

```
1. Model(s)           backend/src/models/<Thing>.ts
2. Validation         add chains to backend/src/middleware/validation.ts
3. Controller         backend/src/controllers/<thing>Controller.ts
4. Routes             backend/src/routes/<thing>.ts
5. Mount              backend/src/app.ts  (before notFoundHandler)
   → cd backend && npm run typecheck        ← must pass
6. API client         frontend/src/lib/api.ts
7. Auth context       frontend/src/lib/auth.tsx
8. Auth pages         frontend/src/pages/Login.tsx, Signup.tsx
9. Protected route    frontend/src/components/ProtectedRoute.tsx
10. Main screen       frontend/src/pages/<Main>.tsx
11. Detail + create   frontend/src/pages/<Thing>Detail.tsx, create form/dialog
12. Routes + shell    frontend/src/App.tsx, nav/header component
13. Theme             frontend/src/index.css (accent colour)
    → cd frontend && npm run typecheck && npm run lint   ← must pass
```

**Pull any shadcn component you need** rather than hand-rolling one:

```bash
cd frontend && npx shadcn@latest add input label dialog form select textarea badge dropdown-menu avatar sonner
```

They land in `src/components/ui/` and match the existing `button`/`card`/`separator`.

---

## The rules that will bite you

Full detail is in `ARCHITECTURE.md` §3 and §8. The four that cause almost every failure:

1. **Backend relative imports end in `.js`** — `import User from '../models/User.js'`,
   even though the file is `User.ts`. Omit it and the server dies at runtime.
2. **Every response uses the envelope** — `successResponse(data, msg)` /
   `errorResponse(msg, 'CODE')` from `utils/helpers.js`. The frontend branches on
   `error.code`, never on message text.
3. **Frontend fetches relative `/api/...` paths** — the Vite proxy handles the rest.
   A hardcoded `http://localhost:3000` breaks production and trips CORS.
4. **Unused imports fail the frontend build** (`noUnusedLocals`). Clean as you go.

Also: scope every user-owned document with a `user` field and filter every query by
`req.authUser!.id`. An app where one person can read another's data is not shippable, and
retrofitting ownership later touches every query.

---

## Verification gate — do not proceed until all four pass

```bash
cd <project>/backend  && npm run typecheck && npm run lint && npm test
cd <project>/frontend && npm run typecheck && npm run lint
```

If tests you didn't write now fail, you changed behaviour the template's smoke tests
depend on — fix the code, not the test. The frontend's `Home.test.tsx` asserts on the
old placeholder text; if you replaced or removed that page, update or delete that test
to match the real page, and say so.

Add at least one test of your own for the core thing — an API smoke test in
`backend/tests/` following `health.test.ts` is the cheapest meaningful one.

---

## Keep them in the loop

Two or three short status lines across the whole build, in their language:

> "Building the part that remembers your dogs and walks…"
> "Adding sign-in…"
> "Putting the screens together…"

Not: "Scaffolding the Mongoose schema and wiring the CRUD controller." And never paste
command output at them.

---

## Starting it and handing it over

Do not rush this, and do not announce success before you have seen the page render.

---

### Start both servers

Two servers, **both in the background**. Running either in the foreground locks up the
conversation.

```bash
cd <project>/backend  && npm run dev     # run_in_background: true → port 3000
cd <project>/frontend && npm run dev     # run_in_background: true → port 5173
```

### Verify — in this order

1. **Backend is alive:**

   ```bash
   curl -s http://localhost:3000/health
   ```

   Expect `{"status":"ok",...}`. If it's empty, read the backend's background output.
   The usual causes: no database reachable, or `JWT_SECRET` shorter than 32 characters.

2. **Find the real frontend port.** Vite moves to 5174, 5175… if 5173 is taken. Read the
   actual `Local: http://localhost:____/` line out of the frontend output. Never assume.

3. **The page actually renders.** Fetch it, or open it in the browser with the
   `claude-in-chrome` tools if available and take a look. `curl -s http://localhost:<port>`
   returning the HTML shell is the minimum bar; seeing the rendered page is the real one.

4. **The core loop works end to end.** Sign up a test account and create one record —
   through the browser if you have it, otherwise against the API:

   ```bash
   # -c keeps the session cookie; Better Auth has no bearer token to copy.
   curl -s -c /tmp/app-check.txt -X POST http://localhost:3000/api/auth/sign-up/email \
     -H 'Content-Type: application/json' \
     -d '{"email":"test@theirdomain.test","password":"password123","name":"Test User","firstName":"Test","lastName":"User"}'

   curl -s -b /tmp/app-check.txt http://localhost:3000/api/auth/get-session
   ```

   A user object back from `get-session` means auth, the database and the session cookie all
   work. Then create one of _their_ things with `-b /tmp/app-check.txt`. **Only now is the app
   verified.** Clean up the test account afterwards.

   Use a throwaway domain like `.test`, not `example.com` — if you later wire up email,
   Resend rejects `example.com` recipients outright.

If anything fails, fix it and re-verify. Never hand over a URL you haven't loaded.

---

### The handoff message

The last message they read. Warm, plain, specific, and short. No jargon, no next-steps
lecture, no bullet list of technologies.

```
🎉 Your app is running — open this in your browser:

    http://localhost:5173

Make an account with any email and password (it's all on your own computer),
and you'll land on your walks list. Add a dog, log a walk, and it'll still be
there tomorrow.

Everything lives in the folder `dog-walk-tracker`.

**To change anything, just tell me.** Things like:
  • "Add a notes box to each walk"
  • "Make the buttons green"
  • "I want to see how many walks I did this week"
  • "Let me add photos of the dogs"

You don't need to know any of the technical words — describe what you want the
way you'd describe it to a person.

**To stop it:** close this window, or just tell me "stop the app".
**To start it again later:** open this folder in Claude Code and say "start my app" —
that starts the storage and the app together, in the right order.

One thing I left for later, whenever you want it: sending clients a summary email.
```

Adapt every line to their actual app. The example changes are especially important —
they teach, by example, that plain requests are the interface.

Then run the `code-report` skill with status `applied` and give them that link too. It is
a one-page record of what was built, where, and why — the thing they can show someone
else without anyone reading code.

---

## Staying available for edits

After handoff, you are in normal editing mode. For every subsequent request:

- **Read `CLAUDE.md` and `ARCHITECTURE.md` first** if this is a fresh session.
- Make the change, run the typecheck and lint gates, and confirm the app still loads.
- Report back in the same plain language: _"Done — refresh the page and you'll see the
  notes box on each walk."_
- Keep `docs/YOUR-APP.md` and the spec sheets current when a change adds a real feature.
  A stale spec is worse than none.
- **The databases must be running.** `npm run db` in `backend/` is a long-lived process;
  it dies when their machine restarts. If the app stops loading, start it again before
  debugging anything else — and teach them the phrase "start my app", which should start
  the databases and both servers.
- Dev servers hot-reload. Backend changes restart automatically via `tsx watch`, frontend
  changes appear instantly. They should almost never need to restart anything — if you
  changed `backend/.env`, though, that needs a restart, so do it for them.
