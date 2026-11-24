---
name: app-docs
description: "Build a Stripe-style reference site for an app — one self-contained HTML file with a sidebar, light/dark themes, a code rail, per-page 'Copy for LLM' markdown, and hash routing. Grounded strictly in the repository and, for apps built from the MERN template, in the filled-in seed-documentation sheets. Use when: /app-builder:app-docs, 'document my app', 'build the docs', 'write the reference', 'make a docs site', 'I need documentation for this', 'document what we built', or after an app's first version is working. For loose notes or a folder of files, this is the wrong tool."
user_invocable: true
---

# App Docs

One file. Open it by double-clicking, host it anywhere, send it to anyone. No build step
on the reader's side, no network, no server.

The page is the same shape as the Stripe API reference — that is where its proportions
came from — but the design is already decided and lives in `assets/shell.html`. **Your job
is content, never CSS.** The shell carries 18 KB of stylesheet, the hash router, the theme
toggle, the markdown view, the code-sample language switcher, the on-this-page contents,
and the anchor-copy behaviour. You write pages; the build script assembles them.

---

## The pipeline

```bash
# 1. author the pages file (see reference/page-plan.md for the shape and the markup)
#    /tmp/<slug>-docs.json
# 2. build - from the skill directory
node scripts/build-docs.mjs /tmp/<slug>-docs.json <project>/docs/<slug>-reference.html
# 3. open it and look at it before you say it's done
```

The script prints `<path> N pages / NN KB` and the page order. It validates before
writing: a nav entry naming a missing page, a page missing from the nav, a page with no
`title`/`left`/`md`, or a page whose `left` has no `<h1>` all exit 2 with the specific
problem. It never writes half a site.

**Re-running it overwrites the whole file.** That is the intended way to update docs —
edit the pages file, rebuild. Never hand-edit the built HTML; the next build discards it.

---

## What to write about

For an app built from this template, the brief already exists:

| Source                          | Gives you                                                 |
| ------------------------------- | --------------------------------------------------------- |
| `seed-documentation/*.csv`      | Pages, data model, routes, user stories, design decisions |
| `CLAUDE.md`, `docs/YOUR-APP.md` | What it is, what was deliberately left out                |
| `ARCHITECTURE.md`               | The stack and the conventions                             |
| The actual code                 | What is **true**, which outranks all of the above         |

Where the spec and the code disagree, **the code wins and you say so in the page.** A spec
sheet describes intent; someone reading the reference is trying to work with what exists.

Everything you write must come from the repository. Do not invent endpoints, fields,
environment variables, URLs, limits, or behaviour. If something matters and you can't
determine it, write what you do know and name the gap in a callout — a documented unknown
is useful, a confident guess is a trap.

See [reference/page-plan.md](reference/page-plan.md) for the recommended page set, the
pages file format, and the markup vocabulary the shell styles.

---

## Workflow checklist

```
Docs for <App Name>:
- [ ] 1. Read the spec sheets, CLAUDE.md, ARCHITECTURE.md
- [ ] 2. Read the real code — models, routes, pages — and note where it differs
- [ ] 3. Decide the page list and the nav grouping
- [ ] 4. Write the pages file: left (html), right (code rail), md (for Copy for LLM)
- [ ] 5. Build it
- [ ] 6. Open it in a browser: click through every nav item, toggle the theme
- [ ] 7. Tell them where it is, in plain English
```

---

## Verify it, don't assume it

The build script proves the file is well-formed. It cannot prove the page is readable.
Open the built file and check, at minimum:

- Every nav link loads a page with a heading — click them all, there won't be many.
- The theme toggle works in both directions.
- "View as Markdown" shows the `md` you wrote, not an empty box.
- No mojibake (`â€"` where an em dash should be). If you see it, the shell lost its
  `<meta charset>` — restore it rather than replacing the dashes.

If `claude-in-chrome` is available, serve the folder and look at it:

```bash
cd <project>/docs && python3 -m http.server 8711 --bind 127.0.0.1
```

Then navigate to `http://127.0.0.1:8711/<file>.html`. A `file://` URL will not open in the
browser tools. Stop the server when you're done.

---

## Gotchas

- **`md` is not optional and is not decorative.** It powers "Copy for LLM", which is how
  someone pastes a page into a chat and asks a question about their own app. Write it as
  real markdown prose, not a stripped-tags version of `left`.
- **Every page needs a `<h1>` in `left`.** The on-this-page contents and the document
  title are derived from it.
- **The class is `callout-warning`, not `callout-warn`.** The page this shell was taken
  from gets that wrong in two places and those callouts render unstyled. Check yours.
- **The right rail is optional per page and shouldn't be forced.** A conceptual page with
  nothing to show in code is better with an empty rail than with filler.
- **Escape code samples.** `left` and `right` are HTML strings: `<` and `&` inside a
  `<code>` block must be `&lt;` and `&amp;`, and the JSON file needs its own escaping on
  top. Author them carefully, then look at the rendered page.
- **Don't document the template, document their app.** Nobody needs a page about Express 5
  conventions. They need to know what their own routes do.
- **Keep it short enough to read.** Eight to fifteen pages is a reference. Forty is a
  landfill, and a non-technical owner will open it once.
