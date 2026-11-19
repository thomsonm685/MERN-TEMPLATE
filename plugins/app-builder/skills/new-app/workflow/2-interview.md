# Phases 3–4 — The interview

Ten questions. They take about six minutes and they decide everything — the data model,
the screens, the look, and every row of the spec sheets. You infer the rest and confirm
it before writing anything down.

**Rules for the whole interview:**

- One question per message. Wait for the answer.
- Use `AskUserQuestion` wherever options make sense — picking from four choices is far
  easier than facing a blank box. Mark your recommendation with "(Recommended)".
- Questions 1, 2, 3, 5 and 10 are open-ended: ask them as plain conversation, not as
  multiple choice.
- **Never ask about technology.** Not the database, not the framework, not hosting, not
  how things should be stored. Those are decided.
- React to their answers like a person. If they say "it's for dog walkers", use the word
  _walks_ in the next question, not _records_.
- If an answer is vague, ask **one** follow-up, then move on and assume something
  sensible. "I don't know yet" is a fine answer — pick something and say what you picked.

---

## The ten questions

**1. What does your app do?**

> "In a sentence or two — what does your app do, and what problem does it solve?"

Open-ended. This drives everything. If they give you one word, ask for an example of
someone using it. → `Tagline`, `Problem Solved`, `Primary Goal`.

**2. Who is it for?**

> "Who's going to use it? Picture one specific person."

Open-ended. Are there _different kinds_ of user (a coach and a client, a shop owner and a
customer)? If so, note both. → `Target Audience`, `User Roles`.

**3. What's the main thing they do in it?**

> "When someone opens your app on a normal day, what's the one thing they came to do?"

Open-ended. This is the core action and the first screen in the spec. → `Core User
Workflow`, and the `FR-001` user story.

**4. Do people sign in?** — `AskUserQuestion`

| Option                                                         | What it means technically                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| "Yes — everyone has their own private account" _(Recommended)_ | Template auth as-is; every record scoped to `user`                        |
| "Yes — and people work together in shared groups/teams"        | Add an `Organization`/`Team` model, membership, scope records to the team |
| "Yes — and there's an admin who can see everything"            | Add a `role` field to User + admin-only routes                            |
| "No — anyone can use it without an account"                    | Keep auth in the codebase, leave routes public, no login screen in v1     |

→ `Authentication Method`, `User Roles`, and the `Access Level` column on every page.

**5. What does it keep track of?**

> "What are the main _things_ your app stores? For a dog-walking app it'd be dogs,
> walks, and clients — what are yours?"

Open-ended. **This becomes the data model.** Push gently for two or three: "Anything
else it needs to remember?" Then one follow-up covers the fields for all of them:

> "For each walk, what would you want written down — who, when, how long, anything else?"

→ every row of the Data Model sheet.

**6. What should they see first?** — `AskUserQuestion`

| Option                                                          | Specs                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------ |
| "A list of my \<things\>, newest first" _(usually recommended)_ | List page + create form + detail view                        |
| "A dashboard with numbers and recent activity"                  | Stat cards + a short recent list                             |
| "Straight to creating a new \<thing\>"                          | Create form as the landing screen, list secondary            |
| "A calendar or schedule view"                                   | Date-grouped list (a real calendar grid is a later addition) |

→ the Pages/Views sheet.

**7. How should it look?** — `AskUserQuestion`

| Option                                                  | Design direction                                   |
| ------------------------------------------------------- | -------------------------------------------------- |
| "Clean and simple — get out of the way" _(Recommended)_ | Neutral zinc base, generous whitespace, one accent |
| "Warm and friendly"                                     | Rounded, softer palette, conversational copy       |
| "Bold and modern"                                       | Strong accent, larger type, more contrast          |
| "Serious and professional"                              | Dense, restrained, data-forward                    |

Then two quick follow-ups in one message: _"Any colour you want it built around — a brand
colour, or should I pick something that fits? And should it be light, dark, or let people
choose?"_ If they name a colour, record the hex and convert it to oklch later for
`frontend/src/index.css`. If they don't, pick one that suits the direction and say which.

→ the Design & Style Guide sheet.

**8. Anything it needs to connect to?** — `AskUserQuestion`, multi-select

| Option                                              | Note                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| "Nothing yet — just the app" _(Recommended for v1)_ |                                                                      |
| "Take payments / subscriptions"                     | Note it for later; do **not** spec Stripe into v1 unless they insist |
| "Send emails (welcome, reminders, receipts)"        | Template has Resend wired but inert — note it as optional            |
| "File or photo uploads"                             | Template has S3 wired but inert — note it as optional                |

Whatever they pick beyond the first, tell them plainly: _"Noted — I'll put that in the
plan as a next step, and we'll build the core app first."_ → `Required Integrations`,
`Optional Integrations`, `Out of Scope`.

**9. Is this something you'll charge for?** — `AskUserQuestion`

| Option                                   | Records                                          |
| ---------------------------------------- | ------------------------------------------------ |
| "Not yet — free for now" _(Recommended)_ | `Monetization Strategy: Not charging yet`        |
| "A monthly subscription"                 | Ask for rough tiers and prices if they know them |
| "A one-off payment"                      | Note the price point if they have one            |
| "A cut of each transaction"              | Note the rate if they have one                   |

Nothing here gets built in v1. It goes in the sheet so the next person knows where it is
heading. → `Monetization Strategy`, `Pricing Tiers`.

**10. Anything it must not do, or any rules it has to follow?**

> "Last one — is there anything it definitely shouldn't do, or any rules it has to follow?
> Things like handling health or payment information, or data that has to stay in a
> particular country."

Open-ended, and the one question worth asking plainly. A "yes" here changes what is safe
to build. → `Constraints`, `Out of Scope`, and the `Sensitive` column on the data model.

If they name anything regulated — medical records, card numbers, children's data,
anything they'd call confidential — say in plain words that you'll build it so that data
is kept separate, and that someone should review it before real people's information goes
in. Record it in `Constraints`. Don't lecture, and don't refuse to continue.

---

## Inferring the rest

From those ten answers, decide the following **yourself** and put it in the plan:

- **Models and fields** — from Q5, plus `user` ownership from Q4, plus `timestamps`.
  Include the existing `User` fields so the sheet is complete.
- **Pages and routes** — from Q3 and Q6: typically `/login`, `/signup`, `/` (the main
  screen), `/<thing>/:id`, `/settings`.
- **API endpoints** — standard CRUD per model behind `requireAuth`, plus the seven the
  template already provides.
- **Tech stack rows** — fixed, and already true: React 19 + TypeScript + Vite 6 /
  Node 20 + Express 5 / MongoDB + Mongoose 8, Postgres available. Don't ask.
- **Hosting / Domain** — `Not decided yet — runs locally` unless they volunteered one.
- **Success Metrics** — infer one honest measure from Q1 and Q3.
- **Inferred Complexity** — Simple / Intermediate / Advanced, your call.
- **Tone of the interface copy** — from Q1, Q2 and Q7.

---

## Phase 4 — Read the plan back, in their language

Before you write a single file, show a short plain-English summary. **No file names, no
technical terms, no list of models.** Aim for something they could read aloud to a friend.

```
Here's what I've got:

**Dog Walk Tracker** — for independent dog walkers who need to log every
walk and show clients what happened.

Your walkers will be able to:
  • Create an account and sign in privately
  • Add the dogs they walk, with the owner's name and any notes
  • Log a walk — which dog, when, how long, and how it went
  • See every walk in one list, newest first, and open any one for details

It'll look clean and simple, built around a deep green, and people can
switch to dark mode.

Not in this first version (we can add these next): taking payments, emailing
clients a summary.

I'll write all of that down into the project now. Anything to change first?
```

Then use `AskUserQuestion`: **"That's right — write it down"** / **"Change something"**.

If they want changes, adjust and re-show the summary. Do not start Phase 5 until they say
go. This is the single cheapest place to catch a misunderstanding — the spec is about to
become the thing a build is generated from.
