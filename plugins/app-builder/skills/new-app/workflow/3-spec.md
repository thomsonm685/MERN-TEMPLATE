# Phase 5 — Write the spec

The spec is not paperwork. It is what lets the next conversation — days later, with no
memory of this one — pick up exactly where you left off, and it is what the build reads
from. Three artefacts, three different readers.

**First: check the background install finished.** Grep the Phase 2 task output for
`APP_BUILDER_SETUP_COMPLETE`. If it isn't there yet, say you're finishing the download
and wait. If it failed, read the output yourself and see `reference/troubleshooting.md` —
don't show them the error.

---

## 5.1 The six spec sheets — write them with the script

`seed-documentation/` ships six blank CSVs. They are the structured source of truth and
their IDs cross-reference each other.

**Do not write these by hand, and do not use `sed` on them.** They contain prose with
commas and quotes, and a single unquoted comma shifts every later column by one — which
is worse than leaving the sheet blank, because it looks filled in. Write one JSON plan
file and run the writer:

```bash
# from the skill directory
node scripts/write-seed-docs.mjs /tmp/<slug>-plan.json <absolute project path>
```

The writer parses the real headers out of the shipped files, so a mistyped field name or
column is an error you see immediately rather than a value silently dropped. It keeps the
`Field`/`Description` rows and row order of the two key-value sheets exactly as shipped
and fills only the `Value` column; it replaces the placeholder row in the four list
sheets. **The exact JSON shape is in [../reference/spec-json.md](../reference/spec-json.md)
— read it before writing the plan file.**

What goes in each sheet:

| Sheet                                                      | Fill with                                                                                                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `App Outline - Application Overview.csv`                   | Name, tagline, goal, audience, problem, roles, auth method, monetization, constraints, out of scope. Tech stack rows are fixed — see the interview file. |
| `App Outline - Functional Requirements (User Stories).csv` | One `FR-001`… row per thing a user can do, with acceptance criteria and `Required`/`Nice to have`.                                                       |
| `App Outline - Application Pages_Views.csv`                | One `PV-01`… row per page: route path, access level, purpose, what's on it, which `RT-` routes it calls.                                                 |
| `App Outline - Data Model (Database Structure).csv`        | One row **per field per model** — including the existing `User` fields, so the sheet is complete. Set `Sensitive` to `Yes` on anything from Q10.         |
| `App Outline - API Routes and Core Logic.csv`              | One `RT-001`… row per endpoint, including the seven the template already provides.                                                                       |
| `App Outline - Design & Style Guide.csv`                   | Colours as hex, fonts, radius, tone, icon library (Lucide), UI framework (shadcn/ui), accessibility target (WCAG 2.2 AA).                                |

Cross-reference properly — `FR-002` naming `PV-03` and `RT-002` is the whole point of the
IDs. A sheet of orphaned rows is barely better than a blank one.

Leave a field blank rather than inventing it. `Key Differentiator` on a weekend project is
honestly blank; a made-up differentiator is a lie the next person has to discover.

Then read the result back and confirm the row counts match what you intended:

```bash
head -3 "<project>/seed-documentation/App Outline - Application Overview.csv"
```

---

## 5.2 `docs/YOUR-APP.md` — for them

Plain English, no jargon. The Phase 4 summary, expanded: what the app is, who it's for,
what it will do, what is deliberately not in the first version, and how to ask for
changes. This is the file they'll actually open in six weeks.

---

## 5.3 `CLAUDE.md` — for the next session

Short and factual, at the project root. Claude Code loads it automatically, which is what
makes "just talk to it" work later.

````markdown
# <App Name>

<One-sentence description.> Built for <audience>.

## Read first

- `ARCHITECTURE.md` — the stack, the file map, and the conventions that break the
  build if ignored. Read it before writing code.
- `seed-documentation/*.csv` — the spec: pages, data model, routes, user stories.
- `docs/YOUR-APP.md` — what this app is, in plain English.

## Status

Set up, specced, **not built yet.** The template is untouched: auth works, nothing
else is specific to this app. Build from the spec sheets.

## This app specifically

- **Models to add:** <Thing>, <Thing> (User already exists)
- **Routes to add:** /api/<thing> (CRUD, all behind `requireAuth`)
- **Pages to add:** / (<main screen>), /<thing>/:id, /settings (login/signup exist)
- **Accent colour:** <name> <hex> — goes in `frontend/src/index.css`
- **Auth:** <one line from Q4>

## Running it

```bash
cd backend && npm run db     # local MongoDB + Postgres, leave it running
cd backend && npm run dev    # port 3000
cd frontend && npm run dev   # port 5173 ← this is the one to open
```
````

## Not in the plan (deliberately)

- <from the out-of-scope list>

## Working with the person who owns this

They are non-technical. Explain changes in plain English, don't show them errors, and
verify the app still loads after every change. After any sizeable change, run the
`code-report` skill so they get a readable record of what changed.

```

```
