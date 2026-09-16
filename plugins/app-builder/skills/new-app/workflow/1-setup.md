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
echo "mongo27017: $( (nc -z localhost 27017 >/dev/null 2>&1 && echo OPEN) || echo closed)"
echo "docker: $( (docker info >/dev/null 2>&1 && echo RUNNING) || echo no)"
```

**What to look for:**

| Result                                   | Action                                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node` missing or below v20              | Stop. Send them to <https://nodejs.org> for the "LTS" download, wait, re-check. See `reference/troubleshooting.md`.                              |
| `git` missing                            | Stop. On Mac, `xcode-select --install` triggers the official installer.                                                                          |
| `mongo27017: OPEN`                       | Best case — a database is already running. Use `mongodb://localhost:27017/<slug>`.                                                               |
| `mongo27017: closed` + `docker: RUNNING` | Use Docker later: `docker compose up -d mongo`.                                                                                                  |
| Neither                                  | Database decision needed — go to the Atlas path in `reference/troubleshooting.md` **now**, before the interview. Never discover this at Phase 8. |

Say only: _"Quick check that everything I need is on your computer… all good."_ — or the
one specific thing they must do.

---

## Phase 1 — Name and location

Ask for the name if they haven't said it. Then derive:

- **slug** — lowercase, hyphens, no spaces (`Dog Walk Tracker` → `dog-walk-tracker`).
  This becomes the folder name, the package names, and the database name.
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
rm -rf .git plugins .claude docs/first-app.html
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
- `rm -rf .git plugins .claude docs/first-app.html` strips the four things that belong to
  the template and not to their app: its git history, this plugin's own folder, the
  template's `refresh-docs` skill, and the template's getting-started guide. All four
  ride along in the clone. Then a fresh empty repo is created. If the template gains
  another template-only file, add it here.
- Three installs, three separate projects. Root is tooling only; the app lives in
  `backend/` and `frontend/`.
- `APP_BUILDER_SETUP_COMPLETE` is the sentinel you will grep for at the start of Phase 6.

Tell them one friendly line — _"I'm downloading the starter project in the background
while we talk. Let's get into your idea."_ — and go straight to the interview.

**If the clone fails** (no network, GitHub unreachable): say so plainly, retry once, then
stop. Don't start the interview on a broken setup.
