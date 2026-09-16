# Phases 3–4 — The interview

Eight questions. They take about five minutes and they decide everything technical.
You infer the rest and confirm it before building.

**Rules for the whole interview:**

- One question per message. Wait for the answer.
- Use `AskUserQuestion` wherever options make sense — picking from four choices is far
  easier than facing a blank box. Mark your recommendation with "(Recommended)".
- Questions 1, 2, 3, and 5 are open-ended: ask them as plain conversation, not as a
  multiple choice.
- **Never ask about technology.** Not the database, not the framework, not hosting, not
  how things should be stored. Those are decided.
- React to their answers like a person. If they say "it's for dog walkers", use the word
  _walks_ in the next question, not _records_.
- If an answer is vague, ask **one** follow-up, then move on and assume something
  sensible. You are not writing a requirements document; you are getting enough to build
  something real they can react to.

---

## The eight questions

**1. What does your app do?**

> "In a sentence or two — what does your app do, and what problem does it solve?"

Open-ended. This drives everything. If they give you one word, ask for an example of
someone using it.

**2. Who is it for?**

> "Who's going to use it? Picture one specific person."

Open-ended. Are there _different kinds_ of user (e.g. a coach and a client, a shop owner
and a customer)? If so, note both — that becomes roles.

**3. What's the main thing they do in it?**

> "When someone opens your app on a normal day, what's the one thing they came to do?"

Open-ended. This is the core action and the first screen you will build.

**4. Do people sign in?** — `AskUserQuestion`

| Option                                                         | What it means technically                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| "Yes — everyone has their own private account" _(Recommended)_ | Template auth as-is; every record scoped to `user`                        |
| "Yes — and people work together in shared groups/teams"        | Add an `Organization`/`Team` model, membership, scope records to the team |
| "Yes — and there's an admin who can see everything"            | Add an `role` field to User + admin-only routes using `adminProtect`      |
| "No — anyone can use it without an account"                    | Keep auth in the codebase, leave routes public, no login screen in v1     |

**5. What does it keep track of?**

> "What are the main _things_ your app stores? For a dog-walking app it'd be dogs,
> walks, and clients — what are yours?"

Open-ended. **This becomes the data model.** Push gently for two or three: "Anything
else it needs to remember?" For each one, ask what you'd want to know about it — one
quick follow-up covers all of them:

> "For each walk, what would you want written down — who, when, how long, anything else?"

**6. What should they see first?** — `AskUserQuestion`

| Option                                                          | Builds                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------ |
| "A list of my \<things\>, newest first" _(usually recommended)_ | List page + create form + detail view                        |
| "A dashboard with numbers and recent activity"                  | Stat cards + a short recent list                             |
| "Straight to creating a new \<thing\>"                          | Create form as the landing screen, list secondary            |
| "A calendar or schedule view"                                   | Date-grouped list (a real calendar grid is a later addition) |

**7. How should it look?** — `AskUserQuestion`

| Option                                                  | Design direction                                   |
| ------------------------------------------------------- | -------------------------------------------------- |
| "Clean and simple — get out of the way" _(Recommended)_ | Neutral zinc base, generous whitespace, one accent |
| "Warm and friendly"                                     | Rounded, softer palette, conversational copy       |
| "Bold and modern"                                       | Strong accent, larger type, more contrast          |
| "Serious and professional"                              | Dense, restrained, data-forward                    |

Then one quick follow-up: _"Any colour you want it built around? A brand colour, or
should I pick something that fits?"_ If they name a colour, convert it to oklch for
`frontend/src/index.css`. If they don't, pick one that suits the direction and move on.

**8. Anything it needs to connect to, or charge for?** — `AskUserQuestion`, multi-select

| Option                                              | Note                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| "Nothing yet — just the app" _(Recommended for v1)_ |                                                                     |
| "Take payments / subscriptions"                     | Note it for later; do **not** build Stripe in v1 unless they insist |
| "Send emails (welcome, reminders, receipts)"        | Note it for later                                                   |
| "File or photo uploads"                             | Note it for later                                                   |

Whatever they pick beyond the first, tell them plainly: _"Noted — I'll build the core
app first and we can add that next, once you've seen it working."_ Integrations in v1
triple the time-to-first-working-app and are far better added conversationally later.

---

## Inferring the rest

From those eight answers, decide the following **yourself** and put them in the plan:

- **Models and fields** — from Q5, plus `user` ownership from Q4, plus `timestamps`.
- **Pages and routes** — from Q3 and Q6: typically `/login`, `/signup`, `/` (the main
  screen), `/<thing>/:id`, `/settings`.
- **API endpoints** — standard CRUD per model, behind `requireAuth`, matching the template's
  existing route style.
- **Out of scope for v1** — anything from Q8 beyond "nothing yet", plus anything they
  mentioned in passing that isn't the core loop. Name these explicitly in the summary
  so nothing feels silently dropped.
- **Tone of the interface copy** — from Q1, Q2, and Q7.

---

## Phase 4 — Confirm the plan, in their language

Before you build anything, show a short plain-English summary. **No file names, no
technical terms, no bullet list of models.** Aim for something they could read aloud to
a friend.

```
Here's what I'm about to build you:

**Dog Walk Tracker** — for independent dog walkers who need to log
every walk and show clients what happened.

Your walkers will be able to:
  • Create an account and sign in privately
  • Add the dogs they walk, with the owner's name and any notes
  • Log a walk — which dog, when, how long, and how it went
  • See all their walks in one list, newest first, and open any one for details

It'll look clean and simple, built around a deep green.

Not in this first version (we can add these next): taking payments, sending
clients a summary email.

Give me about 15 minutes. Want me to start, or change anything first?
```

Then use `AskUserQuestion`: **"Build it"** / **"Change something first"**.

If they want changes, adjust and re-show the summary. Do not start building until they
say go — this is the single cheapest place to catch a misunderstanding.
