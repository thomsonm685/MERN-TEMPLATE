# Phase 7 — Hand over, and offer to build

The project is set up, specced, and connected to two running databases. Nothing specific
to their idea is built yet, and the handoff has to be honest about that — otherwise they
go looking for their app and find the template's login screen.

---

## 7.1 Before you say anything

Confirm, for yourself, all of it:

- [ ] `APP_BUILDER_SETUP_COMPLETE` appeared, and all three `npm install`s finished.
- [ ] All six `seed-documentation/*.csv` sheets are filled, with no placeholder rows left
      (`RT-001`, `PV-01` and `FR-001` ship blank — they should now hold real rows).
- [ ] `CLAUDE.md` and `docs/YOUR-APP.md` exist.
- [ ] `backend/.env` has a 64-character `JWT_SECRET`, the slug in `MONGODB_URI`, and all
      five `POSTGRES_*` lines.
- [ ] `npm run db` printed both connection lines and is still running.
- [ ] Typecheck, lint and tests pass in both projects.

If any of those is false, fix it before writing the handoff. Never describe a step as done
because it should have worked.

---

## 7.2 The handoff message

Plain English. No file paths except the folder they'd actually open, no port numbers, no
technology names they didn't ask for.

```
Done — <App Name> is set up and ready to build.

What exists right now:
  • The project, in a folder called <slug>
  • Your plan, written down in full — every screen, every piece of
    information it keeps, and every rule we agreed
  • Accounts and sign-in, working already
  • Your app's storage, running on your own computer — nothing to
    install, nothing to sign up for

What doesn't exist yet: the parts that make it *yours* — logging a walk,
the list of dogs, the screens we talked about. That's the next step, and
it takes about twenty minutes.

Want me to build the first version now?
```

Then `AskUserQuestion`: **"Yes — build it"** / **"Not now"**.

---

## 7.3 If they say build it

Stay in the same conversation and follow
[../reference/build-v1.md](../reference/build-v1.md) — build order, what v1 must include,
the verification gates, starting both servers, and the app handoff. Read, in this order:

1. `ARCHITECTURE.md` in the new project — the conventions that break the build if ignored.
   Most importantly: backend relative imports must end in `.js`, and every API response
   goes through the `successResponse`/`errorResponse` envelope.
2. The six spec sheets you just wrote. They are the brief.
3. `../reference/build-v1.md`, and `../reference/build-patterns.md` for copy-ready code —
   the API client, the auth context, protected routes, a full CRUD resource.

Keep `npm run db` running throughout, and give them **the frontend address only** — port
3000 shows raw data and will make them think it's broken.

Then run the `code-report` skill with status `applied`, and give them the link alongside
the app URL. It is a one-page record of what was built and where, which is the thing they
can actually show someone else.

---

## 7.4 If they say not now

Tell them exactly how to pick it back up, in one short block:

```
No problem. When you're ready, open this folder in Claude Code and say
"build it" — everything we talked about is written down in there, so
you won't have to repeat yourself.

To change the plan before building, just tell me what's different.
```

---

## 7.5 Tell them how to keep working

Once the app is built, the way they change it is by describing the change:

```
Add a notes box to each entry
Make the buttons green instead of blue
I want to see how many I did this week at the top
Let me upload a photo with each one
The sign-up page is confusing — simplify it
```

Two habits worth giving them explicitly:

1. **After any sizeable change, ask for a code report.** The `code-report` skill publishes
   a one-page summary of what changed, where, and why. Tell them the phrase: _"show me a
   code report"_. It is how a non-technical owner keeps a real record of their own app
   without reading code.
2. **Once the app settles, get the reference built.** The `app-docs` skill turns the spec
   and the real code into a single documentation page — every screen, every record, every
   rule — that they can open or send to anyone. The phrase is _"document my app"_. Worth
   doing after v1 works, not before: it documents what exists.
3. **The databases have to be running.** If the app stops loading after they restart their
   computer, the fix is almost always "start the databases again" — and they can just say
   that.
