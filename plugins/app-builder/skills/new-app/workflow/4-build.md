# Phase 7 — Build v1

**Read `ARCHITECTURE.md` at the root of the new project before writing a single line.**
It is the authoritative map of this stack and it documents the conventions that silently
break the build. Do not skip it because the template "looks like a normal Express app".

Copy-ready code for everything below is in
[../reference/build-patterns.md](../reference/build-patterns.md).

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
