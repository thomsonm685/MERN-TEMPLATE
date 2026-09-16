---
name: refresh-docs
description: "Re-audit this template repo and bring its three documents back in line with what the code actually does — the beginner's getting-started guide (docs/first-app.html, published as an Artifact), README.md, and ARCHITECTURE.md. Use when: /refresh-docs, 'update the guide', 'refresh the docs', 'the template changed', 'audit the repo and update the docs', 'is the getting-started guide still accurate', after changing scripts, env vars, ports, dependencies, or the app-builder skill. NOT for documenting a generated app — that app has its own CLAUDE.md."
user_invocable: true
---

# Refresh Docs

This repo carries three documents with three different readers. They drift the moment
the code changes. This skill re-reads the repo, finds the drift, and fixes only what is
actually wrong.

| Document              | Reader                                                           | Standard                                                   |
| --------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| `docs/first-app.html` | Someone who has never written code and may never open a terminal | **Ruthlessly minimal.** Only what they'd get stuck without |
| `README.md`           | A developer who just cloned this repo                            | Accurate and complete on setup, scripts, API surface, env  |
| `ARCHITECTURE.md`     | Claude or an engineer about to write code here                   | Exhaustive: file map, conventions, gotchas                 |

The guide is published as an Artifact. **Update it in place** — never publish a new one:

```
URL: https://claude.ai/code/artifact/c2c958d3-e624-43e4-9493-8ca296f25554
```

---

## The restraint rule — read this before touching the guide

The guide's whole value is that a nervous beginner can read it in four minutes and not
feel stupid. Every line you add costs them something. **The default answer to "should
this go in the guide?" is no.**

A change earns a place in `docs/first-app.html` **only** if one of these is true:

1. It changes a command or sentence they have to type.
2. It adds something they must install, sign up for, or pay for.
3. It changes the address they open, or the port it's on.
4. It changes what Claude asks them during the interview.
5. It creates a new way to get stuck that they could not diagnose or recover from alone.

If none of those are true, the change belongs in `README.md` or `ARCHITECTURE.md`, and
the guide stays exactly as it is.

**Never** goes in the guide: new dependencies, version bumps, new API routes, new models,
refactors, folder moves, test changes, CI changes, lint rules, Docker details, anything
about TypeScript, or any word a beginner would have to look up.

Correcting something already in the guide that has become **wrong** is not an addition —
that is the highest-priority fix, and it doesn't count against restraint. So is deleting
a step that no longer exists. The guide should get shorter about as often as it grows.

---

## Workflow checklist

```
Refresh Docs:
- [ ] Step 1: Audit — read the repo and list what actually changed
- [ ] Step 2: Triage each finding into guide / README / ARCHITECTURE / nothing
- [ ] Step 3: Fix the guide (corrections first, additions only if they pass the rule)
- [ ] Step 4: Update README.md
- [ ] Step 5: Update ARCHITECTURE.md
- [ ] Step 6: Prettier, then republish the Artifact to the SAME url
- [ ] Step 7: Report what changed and — just as important — what you left alone
```

---

## Step 1 — Audit

Read these, in this order. They are the only places a change can affect a beginner.

```bash
cd <repo root>
git log --oneline -20                       # what's happened recently
git diff --stat HEAD~5 2>/dev/null | tail -20
```

| Read                                                         | Looking for                                                                                                                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/package.json`, `frontend/package.json`              | `engines.node` (the guide names a Node version), added/removed **scripts**, new deps that need a service or key                                          |
| `backend/.env.example`                                       | Any **new required** variable. A new one that has no default and can't be auto-generated is a beginner blocker — it means a new signup or a new question |
| `backend/src/config/env.ts`                                  | The Zod schema is the real source of truth for what's required at boot                                                                                   |
| `frontend/vite.config.ts`                                    | `server.port` and the `/api` proxy target — the guide names port **5173**                                                                                |
| `docker-compose.yml`                                         | Added services a beginner would now need running                                                                                                         |
| `backend/src/app.ts`                                         | Mounted routes (README's API table)                                                                                                                      |
| `backend/src/models/*.ts`                                    | Models (ARCHITECTURE's data-model section)                                                                                                               |
| `plugins/app-builder/skills/new-app/workflow/2-interview.md` | **The guide lists the interview questions. If they changed here, the guide is now lying.**                                                               |
| `plugins/app-builder/skills/new-app/SKILL.md`                | The quoted duration ("fifteen to thirty-five minutes") and the install command                                                                           |
| `README.md`                                                  | Anything it claims that is no longer true                                                                                                                |

Write the findings down as a short list before changing anything. An audit that goes
straight to editing always over-edits.

## Step 2 — Triage

For each finding, name its destination out loud: **guide / README / ARCHITECTURE /
nothing**. Apply the restraint rule above. Expect most findings to land in README or
ARCHITECTURE, and many in _nothing_.

## Step 3 — The guide (`docs/first-app.html`)

It is a self-contained HTML file with no build step. Two things to respect when editing:

- **The `.for-app` / `.for-terminal` pair.** The page has a toggle between the Claude
  desktop app and the terminal. Any step that differs between the two needs _both_
  variants, or one audience gets a broken instruction. Check both after editing.
- **Theme tokens.** Colors come from CSS variables defined in `:root`, then redefined
  under `@media (prefers-color-scheme: dark)` and `:root[data-theme='dark']`. Never
  write a raw hex value into a component rule — it will be unreadable in one theme.

Keep the voice: second person, short sentences, no jargon, no exclamation marks, and
never a technical term without a plain-English gloss in the same sentence.

## Step 4 — `README.md`

Developer-facing, so the standard is completeness, not restraint. Keep current: the stack
list and versions, prerequisites, the setup commands, both script tables, the API surface
table, and the env var block. If `.env.example` gained a variable, README gains a row.

## Step 5 — `ARCHITECTURE.md`

Update the file map if files were added or moved, the API and data-model tables, the
conventions if a lint rule or tsconfig flag changed, and the gotchas list if you hit
something new while working. This file is what Claude reads before writing code here —
a stale entry here causes real bugs, so it gets the most thorough pass.

## Step 6 — Format and republish

```bash
cd <repo root> && npx prettier@3 --write README.md ARCHITECTURE.md "docs/*.html"
```

Then republish the guide with the **Artifact** tool, passing the URL above as `url` so it
updates in place and keeps its link. Keep the favicon (🪄) and the title
("Make Your First App") stable — people find the tab by its icon.

If nothing in the guide needed changing, **do not republish it.** Say so instead.

## Step 7 — Report

State three things:

1. What you changed in each file.
2. What you found but deliberately left out of the guide, and why it failed the
   restraint rule. This is the most useful part of the report — it shows the guide is
   being protected, not neglected.
3. Anything you could not verify and a human should check.

---

## Gotchas

- **The guide quotes the interview questions verbatim.** They live in
  `plugins/app-builder/skills/new-app/workflow/2-interview.md`. Changing them there and
  not here is the most likely drift in this repo, and the most confusing for a beginner —
  they get asked something the guide never mentioned.
- **The guide names port 5173 in two places** — the payoff line in step 4 and the
  "wall of text" entry in troubleshooting. If `vite.config.ts` changes the port, both must
  change together. Grep for it rather than trusting this count to stay current.
- **Republishing without `url` creates a second artifact**, silently, and everyone's
  existing link keeps pointing at the stale one. Always pass the URL.
- **`docs/first-app.html` and `.claude/` must not ship inside generated apps.** The
  app-builder scaffold step strips them; if you add another template-only file here, add
  it to that `rm -rf` list in
  `plugins/app-builder/skills/new-app/workflow/1-setup.md` too.
- **A version bump is not a guide change.** Node going from 20 to 22 in `engines` only
  matters to the guide if the guide names a version — it currently doesn't, on purpose.
- **Don't let the guide absorb the README.** Every refresh is a chance for it to creep
  toward being a manual. If it has grown past roughly four minutes of reading, cut
  something before you add anything.

## What good looks like

- Every statement in the guide is true of the repo as it stands today.
- The guide is the same length or shorter, unless a genuine new blocker appeared.
- Both the app and terminal paths were checked, not just the default one.
- README and ARCHITECTURE absorbed everything the guide correctly refused.
- The Artifact was updated at its existing URL, or deliberately not republished.
- The report names what was left out, not just what went in.
