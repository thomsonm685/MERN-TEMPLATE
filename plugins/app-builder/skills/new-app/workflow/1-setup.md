# Phases 0–2 — Preflight, naming, and the background install

Goal: by the end of this file, the download and install are running invisibly while you
start the interview. The person should feel like nothing technical happened.

---

## Phase 0 — Preflight

Run this once. It is silent to the user unless something is missing.

```bash
echo "node: $(node -v 2>/dev/null || echo MISSING)"
echo "npm: $(npm -v 2>/dev/null || echo MISSING)"
echo "git: $(git --version 2>/dev/null || echo MISSING)"
echo "host: $(hostname) | cwd: $(pwd)"
```

**What to look for:**

| Result                        | Action                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `node` missing or below v20   | Stop. Send them to <https://nodejs.org> for the "LTS" download, wait, re-check. See `reference/troubleshooting.md`. |
| `npm` below v10               | Usually fixed by the same Node LTS install. `npm i -g npm` if not.                                                  |
| `git` missing                 | Stop. On Mac, `xcode-select --install` triggers the official installer. On Windows, <https://git-scm.com>.          |
| Host/cwd looks like a sandbox | You are in a cloud session. Say so now and ask them to reopen this in the desktop app or CLI. See the gotcha.       |

**There is no database check.** The template starts its own MongoDB and Postgres from
downloaded binaries (Phase 6), so there is nothing to install and nothing to detect.
Never send anyone to a database signup page.

Say only: _"Quick check that everything I need is on your computer… all good."_ — or the
one specific thing they must do.

---

## Phase 0.5 — Are you already standing in a clone of the template?

Some people install the plugin by cloning this repo (see `scripts/install-plugins.sh` in
it), and then say "build me an app" **from inside that clone**. Cloning again into a
subfolder would nest the template inside itself. Check first:

```bash
# "in-place" if all three are here and this is the template, not an app built from it
if [ -f ARCHITECTURE.md ] && [ -d backend ] && [ -d frontend ] && [ -d plugins/app-builder ]; then
  echo "in-place"; else echo "fresh"; fi
```

| Result     | Path                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| `fresh`    | Normal. Phase 1 picks a new folder, Phase 2 clones into it.              |
| `in-place` | Use this folder. Skip the clone — see "Phase 2, in-place variant" below. |

`plugins/app-builder` is the tell: an app already built from the template has
`ARCHITECTURE.md`, `backend/` and `frontend/`, but the plugin folder is stripped during
setup. If `plugins/app-builder` is absent, this is somebody's **existing app** — stop.
Don't re-scaffold over their work; ask what they want changed instead.

In-place also needs one thing said out loud, because it is irreversible-ish: the folder
stops being a copy of the template and becomes their app. Confirm in a line — _"I'll turn
this folder into your app, rather than making a new one. The starter files get replaced by
yours. OK?"_ — and offer the fresh path if they hesitate.

---

## Phase 1 — Name and location

On the in-place path, still ask for the name — it sets the package names, the title and
the database names — but the folder is already decided, so skip the location question.

Ask for the name if they haven't said it. Then derive:

- **slug** — lowercase, hyphens, no spaces (`Dog Walk Tracker` → `dog-walk-tracker`).
  This becomes the folder name, the package names, and both database names.
- **location** — default to `<current working directory>/<slug>`. Confirm in one line:
  _"I'll create it in a new folder called `dog-walk-tracker` inside your current folder —
  sound good?"_

Refuse to continue if the target folder already exists and is not empty. Offer
`<slug>-2` instead rather than overwriting anything.

---

## Phase 2 — Start the download and install in the background

Do this **immediately after the name is settled and before the interview.** It takes a
few minutes and there is no reason for them to wait through it.

Write a setup script and run it with `run_in_background: true`:

```bash
cat > /tmp/app-builder-setup.sh <<'SETUP'
set -e
TARGET="$1"
git clone --depth 1 https://github.com/thomsonm685/MERN-TEMPLATE.git "$TARGET"
cd "$TARGET"
rm -rf .git plugins .claude .claude-plugin docs/first-app.html scripts/install-plugins.sh
rmdir scripts 2>/dev/null || true
git init -q && git branch -M main
npm install --no-audit --fund=false
(cd backend && npm install --no-audit --fund=false)
(cd frontend && npm install --no-audit --fund=false)
echo "APP_BUILDER_SETUP_COMPLETE"
SETUP
bash /tmp/app-builder-setup.sh "<absolute path to target folder>"
```

Notes on that script:

- The clone is **HTTPS and the repo is public** — no SSH key, no GitHub account needed.
- The `rm -rf` line strips everything that belongs to the template and not to their app:
  its git history, this plugin's own folder, the template's `refresh-docs` skill, its
  plugin marketplace manifest, the getting-started guide, and the plugin installer. All of
  it rides along in the clone. Then a fresh empty repo is created. **If the template gains
  another template-only file, add it here** — the strip list is the one piece of this skill
  that goes stale silently.
- Three installs, three separate projects. Root is tooling only; the app lives in
  `backend/` and `frontend/`.
- The backend install pulls a platform-specific Postgres binary (~130 MB inside
  `node_modules`). That is expected, and it is what makes Phase 6 need no installer.
- `APP_BUILDER_SETUP_COMPLETE` is the sentinel you will grep for at the start of Phase 5.

Tell them one friendly line — _"I'm downloading the starter project in the background
while we talk. Let's get into your idea."_ — and go straight to the interview.

**If the clone fails** (no network, GitHub unreachable): say so plainly, retry once, then
stop. Don't run an interview on a broken setup.

---

## Phase 2, in-place variant

When Phase 0.5 said `in-place`, there is nothing to clone — the files are already here.
Run this in the background instead, from the folder itself:

```bash
cat > /tmp/app-builder-setup.sh <<'SETUP'
set -e
cd "$1"
rm -rf .git plugins .claude .claude-plugin docs/first-app.html scripts/install-plugins.sh
rmdir scripts 2>/dev/null || true
git init -q && git branch -M main
npm install --no-audit --fund=false
(cd backend && npm install --no-audit --fund=false)
(cd frontend && npm install --no-audit --fund=false)
echo "APP_BUILDER_SETUP_COMPLETE"
SETUP
bash /tmp/app-builder-setup.sh "<absolute path to this folder>"
```

Same strip list, same three installs, same sentinel — only the clone is skipped. Three
things to know:

- **The plugin you are running is in `plugins/app-builder`, and this deletes it.** That is
  correct: `claude plugin install` copied it into Claude Code's own plugin directory when
  they installed it, so the skill keeps working in every folder. Their app does not need a
  copy of its own scaffolder. If they want the template itself again later, they re-clone it.
- **If `node_modules` already exists**, the installs are near-instant, so the interview has
  less cover. Don't pad it — just ask the questions.
- **`.devdata` may already exist** from someone running `npm run db` in the template. It
  holds the `template` database, not theirs; leaving it is harmless, and Phase 6 creates
  their own database inside the same server.
