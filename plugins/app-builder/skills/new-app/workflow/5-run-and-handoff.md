# Phases 8–9 — Start it, verify it, hand it over

The moment this whole skill exists for. Do not rush it and do not announce success
before you have seen the page render.

---

## Phase 8 — Start both servers

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

## Phase 9 — The handoff

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
**To start it again later:** open this folder in Claude Code and say "start my app".

One thing I left for later, whenever you want it: sending clients a summary email.
```

Adapt every line to their actual app. The example changes are especially important —
they teach, by example, that plain requests are the interface.

---

## Staying available for edits

After handoff, you are in normal editing mode. For every subsequent request:

- **Read `CLAUDE.md` and `ARCHITECTURE.md` first** if this is a fresh session.
- Make the change, run the typecheck and lint gates, and confirm the app still loads.
- Report back in the same plain language: _"Done — refresh the page and you'll see the
  notes box on each walk."_
- Keep `docs/YOUR-APP.md` and the spec sheets current when a change adds a real feature.
  A stale spec is worse than none.
- Dev servers hot-reload. Backend changes restart automatically via `tsx watch`, frontend
  changes appear instantly. They should almost never need to restart anything — if you
  changed `backend/.env`, though, that needs a restart, so do it for them.
