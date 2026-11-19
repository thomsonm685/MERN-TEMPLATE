---
name: code-report
description: Publish a one-page artifact showing the exact code that changed or will change, where (file and line numbers), and why - with a PROPOSED or APPLIED banner at the top. Works in any repo. Use when handing a change set to a coworker, a client or a reviewer, when proposing edits before making them, and after finishing work that touched more than one or two places. Re-run it to refresh the same page as work progresses. Applied reports for MODUS-Command, Everagentic and Everstream also get logged to their Linear project automatically; proposed ones do not.
---

# Code report

One page, four things per change: **what**, **where** (file and line numbers),
**why**, and **the code itself** - verbatim, as written or as it will be
written. A banner at the top says whether it is **PROPOSED** (nothing changed
yet) or **APPLIED** (it is in the tree). That is the whole format, and the
format is fixed so that filling it in is fast enough to do every time.

**Every entry shows real code at a real location, numbered.** There is no
prose-only entry, and the line numbers run down the left of each block so a
reviewer reading the page can go straight to the line in the file. A line saying "tightened the validation in builder.py" is the thing
this page exists to replace: the reader cannot review it, cannot apply it, and
cannot tell whether it was ever written. The renderer enforces this - it exits
2 and names the entry rather than publishing a page with a hole in it.

Write JSON, run the renderer, publish. You do not write HTML.

---

## The commands

```bash
# $S is this skill's own directory - it holds render.py. Resolve it once:
S=$(dirname "$(find ~/.claude -maxdepth 8 -path '*skills/code-report/render.py' 2>/dev/null | head -1)")
R=<scratchpad>/code-report.json            # the content you author
H=<scratchpad>/code-report.html            # the page; keep this path stable

# 1. author R  (see "The JSON" below, or copy $S/example.json and edit)
# 2. render
python3 $S/render.py $R $H
# 3. publish - see "Publishing" for which form
# 4. if applied and this repo has a feed, log it - see "The Linear feed"
```

The renderer prints `out.html [status] N changes / M files`. If an entry is
missing its location or its code it says which entry and exits 2; it never
emits a half page.

**Keep `$H` at the same path for the life of a change set.** Republishing the
same path in one conversation keeps the same URL, so refreshing the page as
work lands costs one call and no new link.

---

## Publishing

Two modes. Default to rolling.

**Rolling (default, fastest).** One report page per repo, reused and overwritten.

The skill is available in every project, so the rolling URL is keyed by repo - one
page per project, never one page for all of them. The state lives outside the skill
directory (`~/.claude/code-report/reports/`) so it survives a plugin update and is the
same whether the skill was installed as a plugin or copied in by hand:

```bash
ROOT=$(cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" && pwd -P)
case "$ROOT" in                                      # the three feed projects
  *All_Coding_Projects_NEW/MODUS-Command*) REPO=MODUS-Command ;;
  *All_Coding_Projects_NEW/Everagentic*)   REPO=Everagentic   ;;
  *All_Coding_Projects_NEW/Everstream*)    REPO=Everstream    ;;
  *) REPO=$(basename "$ROOT") ;;
esac
U=~/.claude/code-report/reports/$REPO.txt             # holds one URL, one line
mkdir -p ~/.claude/code-report/reports
cat $U 2>/dev/null                                    # read before publishing
```

`$REPO` keys the rolling URL, so it has to come out the same from the project
root and from any directory inside it. That is what the `case` is for: it pins
the key by path, so it holds whether or not the directory is a git repo, and a
report run from `Everstream/apps/web` still finds the project's page instead of
publishing a second one.

Those three live under `~/Downloads`, which macOS may withhold from the shell -
a `git` call there can fail with `Operation not permitted` rather than with
"not a repository". The `case` runs on the path string, so it is unaffected; if
`git` does fail that way, the report itself still needs the directory readable,
so grant the terminal access to Downloads in System Settings > Privacy &
Security > Files and Folders.

- File exists → `Artifact` with `file_path: $H`, `url: <that URL>`, `favicon: "🧾"`.
- File absent → publish with `file_path: $H` and no `url`, then
  `echo <returned URL> > $U`.
- If the update 404s or the artifact is gone, publish fresh and overwrite `$U`.
- Title stays `Code Report - $REPO` so the page keeps its identity across
  refreshes. Put the specific name of the work in `subtitle`, not the title.

**Pinned.** A report that has to stay readable after the next one is written -
something handed to a client or a reviewer, or a record of a decision. Give it
its own `title`, publish with no `url`, and leave `$U` alone.

Favicon is always `🧾`. Never change it - a report page is found by its tab.

### The Linear feed

Three projects have a Linear feed, so publishing is not the last step for them -
the report also gets an item in Linear so the team sees it land.

**Only an `applied` report goes to Linear.** Two conditions, both required:

1. `status` is `applied` - the code is in the working tree.
2. `$REPO` is one of the three below.

A `proposed` report is published and handed over as usual, and nothing is sent
to Linear. The feed is a record of what landed, so a proposal in it would read
as work that shipped, and the next person to look would stop trusting the rest.
Proposals get reviewed and change shape; some are never written at all.

That means the item is created on the first publish where `status` is `applied`,
which may be the second or third publish of a page that started out proposed.
The earlier proposed refreshes send nothing.

`$REPO` decides which project:

| `$REPO`         | Linear project             |
| --------------- | -------------------------- |
| `MODUS-Command` | MODUS Command (`P-ODY-11`) |
| `Everagentic`   | Everagentic (`P-ODY-10`)   |
| `Everstream`    | Everstream (`P-ODY-9`)     |

Anything else: skip this whole section, nothing else about the report changes.

```bash
case "$REPO" in
  MODUS-Command) LP="MODUS Command" ;;
  Everagentic)   LP="Everagentic"   ;;
  Everstream)    LP="Everstream"    ;;
  *) LP="" ;;                              # no feed - skip
esac
date "+%Y-%m-%d %H:%M"                     # for the title
echo "$LP"
```

With `$LP` set and the report `applied`, and once the `Artifact` call has
returned a URL, one `mcp__linear-server__save_issue` call does it:

- `team` - `4b014388-a684-4681-9f7f-7531aa7fcdc6` (Odyssey, the only team)
- `project` - `$LP`
- `title` - `Code report - <the report subtitle, trimmed to ~60 chars> - <YYYY-MM-DD HH:MM>`
- `addLabels` - `["Code Report"]`
- `state` - `Done`. The item is a record of something that happened, not work
  waiting to be done; leaving these open buries the project's real backlog
  within a day.
- `links` - `[{"url": "<the artifact URL>", "title": "Code report - <repo>"}]`
- `description` - the snapshot, below

`links` is the right field. `create_attachment` is for file uploads and will not
take a URL.

The description is the part that has to survive, so write it to stand alone:

```
**Status:** applied - 3 changes / 2 files
**Branch:** master @ 66426c4 - pushed: no - deployed: no

One sentence: what this change set is for. (the report's `subtitle`, verbatim)

- `core/builder.py:341-345` - what the edit does
- `core/profiles.py` (new file) - what it adds
```

**The rolling URL is shared, so the description is the real record.** A rolling
report republishes one page per repo, which means an item written this morning
links to a page showing this afternoon's change set. The link is always "the
current report for this repo", never a snapshot. Write the description so it
still tells the truth after the page has moved on, and when a report needs to
stay readable later, publish it pinned - a pinned report has its own URL and its
Linear item links to it permanently.

**One item per change set, not per publish.** Refreshing a rolling report is the
normal flow and must not produce a second item. In the conversation that created
it, re-run `save_issue` with `id: ODY-nn` to update the description instead; the
link needs no change because the URL did not change. A new change set, or a new
conversation, is a new item.

**Never block the report on Linear.** If the MCP server is not connected, or the
call fails, say so in one line and stop. The artifact is published and that is
the deliverable - do not retry in a loop, and never hold back the report URL
waiting on Linear.

### Old content goes away by itself

The renderer writes the whole page from the JSON every time, so anything not in
this run's JSON is gone. Refreshing a rolling report means editing the JSON and
re-running, not appending. **Do not keep a change in the JSON because it was
there last time** - if it is no longer part of the change set, delete it.

---

## The JSON

The top-level sections are all optional and a missing one just drops its
section - so a two-minute report is legitimate. Inside a change entry nothing
is optional except `surface`: `file`, `what`, `why`, the location and the code
are all required, and the renderer checks.

```json
{
  "status": "proposed",
  "title": "Code Report - agents",
  "subtitle": "One sentence: what this change set is for.",

  "repo": "agents",
  "branch": "master",
  "commit": "66426c4",
  "pushed": false,
  "deployed": false,

  "changes": [
    {
      "file": "core/builder.py",
      "lines": "341-345",
      "surface": "server code",
      "what": "What the edit does, one sentence, active voice.",
      "why": "What goes wrong without it. The expensive half of the report.",

      "before": ["the exact lines being replaced", "as they are on disk today"],
      "after": ["the exact lines that replace them", "character for character"]
    },
    {
      "file": "core/profiles.py",
      "new_file": true,
      "what": "...",
      "why": "...",
      "code": ["the whole new block, or the whole new file if it is short"]
    }
  ],

  "verification": ["How you know it works. Name the test or the measurement."],
  "risk": ["What this could break, and what needs a deploy or a restart."],
  "deferred": [{ "item": "What you did not do", "why": "Why not" }],
  "next": ["What happens next, if anything is waiting on someone."],
  "footer": "One closing line."
}
```

**Fields that matter and are easy to get wrong:**

- `status` — `proposed` or `applied`, nothing else. Amber banner or green one.
  If some of a set is applied and some proposed, **split it into two reports**
  rather than blurring the banner. The banner is the first thing read and it has
  to be true.
- `status_note` — overrides the banner's second line. Use it when the default is
  not quite right: `"Applied and pushed, awaiting the droplet deploy"`.
- `lines` — **required** unless the entry sets `"new_file": true`. A string, so
  `"341"`, `"60-120"` and `"72, 118, 203"` all work. It also drives the
  line-number gutter printed down the left of every code block, so get it
  right: `grep -n` or `git diff -U0` before writing it down, never a guess or a
  memory.
- `new_file` — `true` if the file does not exist yet. Every change is tagged
  `new file` or `existing file` as a chip beside the `surface` chip, and the
  tally counts the new ones, so a reader can see at a glance how much of a
  change set is additions versus edits to working code. It also exempts the
  entry from `lines` and numbers its gutter from 1.
- `line_start` — an explicit first gutter number. Only needed when `lines` is
  too irregular to parse; otherwise leave it out.
- `surface` — a short tag, rendered as a chip. Pick values that fit the repo and
  stay consistent within a report: `frontend`, `backend`, `server code`, `tests`,
  `schema`, `config`, `infra`, `prompt`, `docs`. It is what makes a mixed change
  set readable, and it is how a reader knows whether something needs a deploy or
  reloads in five seconds.
- `before` / `after` — **the form to reach for on an edit.** The exact lines on
  disk today, and the exact lines that replace them. Both render as captioned
  blocks with the real line numbers down the side, so a reviewer sees what is
  being overwritten and could apply the change by hand from the page alone. A
  deletion is `before` with `after` set to `""` - it renders once, captioned
  `removed`. Either may be a string or a list of lines; a list is far easier to
  write in JSON than one long `\n`-stitched string.
- `code` — the single-block form, for a new file, or an addition that replaces
  nothing. An entry needs `code` **or** `before`/`after`; if it has neither the
  renderer refuses it.
- Keep blocks tight. The exact lines that changed plus a line or two of context
  is right; a whole function to show a one-argument edit is not. Verbatim and
  short beats verbatim and long - but paraphrased is not an option at any
  length, and a long block beats no block.
- `code_label`, `before_label`, `after_label` — override the captions
  (`added` / `replace this` / `with this`) when something clearer fits.
- `verification` — on an `applied` report this is not optional in spirit. "The
  suite passes" is weak; name the test, the mutation you checked, or the number
  you measured.

**One change per entry, not one per file.** Two unrelated edits in one file are
two entries with the same `file` and different `lines`. The tally counts both
and says how many files they fall in.

---

---

## Getting it exact

Copy from the file, do not retype from memory. The two commands that produce
both halves of an entry:

```bash
git diff -U0 -- path/to/file           # applied: exact lines, exact numbers
grep -n "anchor text" path/to/file     # proposed: the numbers to quote
sed -n '341,345p' path/to/file         # proposed: the `before` block, verbatim
```

For a **proposed** report the `before` block comes off disk with `sed -n` and
the `after` block is what you are about to write - which means authoring the
report is authoring the edit, and applying it afterwards is mechanical. That is
the point: the page is the proposal, not a description of one.

**The gutter numbers whenever it can.** `"341"` and `"60-120"` both start it at
the right place; a new file starts at 1; `"72, 118, 203"` prints those exact
numbers if the block is three lines long. The one case it stays blank is a
comma list that does not line up one number per line of code - numbering
sequentially from 72 when the next real line is 118 is a false claim, and the
fix is to split the entry in two, which is the better report anyway.

On a `before`/`after` pair the `before` numbers are exact and the `after`
numbers are what the lines become - the same convention a diff uses.

If a change is genuinely too diffuse to show - a rename across forty files -
show the representative edit and say so in `what` ("same two-line change in 40
files, one shown"), with the file list in `next` or `risk`. Do not drop the
code.

## Standing constraints

- **Never put real data in it.** Field names, types, shapes and byte counts
  only - no customer records, readings, credentials or keys. This page gets
  shared, and a published artifact can be forwarded. The same rule covers the
  Linear description, which is read by more people than the page is.
- **A Linear item means applied code on a published page.** Create it after the
  `Artifact` call returns - never before, never for a report that was only
  rendered, and never for a `proposed` one. If the banner is amber, the feed
  stays quiet.
- **Say proposed when it is proposed.** A page that reads as applied when
  nothing has been written is the single worst failure this format has, because
  the reader stops checking.
- **Line numbers are claims.** They are what a reviewer navigates by, and a
  wrong one sends them to the wrong place and costs more than omitting it.
- **The code block is a claim too.** On an `applied` report it is what is on
  disk, not a cleaned-up version of it. On a `proposed` one it is what will be
  written, verbatim - if the edit lands differently, re-run the report.
- `applied` means **in the working tree**, nothing more. Set `"pushed": false`
  unless you watched it push and `"deployed": false` until the deploy actually
  ran - on most repos the edit landing and the edit being live are hours apart,
  and the banner is read as if it covers both.

---

## Before you hand the report over

An `applied` report in a feed repo is not delivered when the artifact URL
exists. It is delivered when the Linear item exists too. Say these out loud
against the actual tool results, not against intent:

1. **Rendered** - `render.py` exited 0 and printed the change/file tally.
2. **Published** - the `Artifact` call returned a URL.
3. **Filed** - for `MODUS-Command`, `Everagentic` and `Everstream` with an
   `applied` banner, `save_issue` returned an `ODY-nn`. If it did not, the one
   permitted outcome is saying so in a line; silently skipping it is not.
4. **State set to `Done`** on that item. A code-report item is a record of
   something that already happened. Leaving it in Backlog or Todo is not
   caution, it buries the project's real backlog - and "never self-certify
   completion" is about the TASK, which stays open for JJ, not about this
   record of the report.

The failure this exists to stop is quiet: steps 1 and 2 produce a URL that
looks like a finished deliverable, so the report gets handed over and the feed
never hears about it. Nobody notices until someone asks whether it is in
Linear.

**Other MODUS repos.** The table above is the confirmed mapping. Linear also
holds `MODUS Edge` (`P-ODY-12`) and `MODUS Product and Delivery` (`P-ODY-8`),
and the checkout has several other `MODUS-*` directories. Do not guess which
directory feeds which project - a report filed in the wrong project is worse
than one filed late. Ask JJ once for that repo, then add the row here.

---

## Worked example

`example.json` in this directory is a real report - the 66426c4 change set,
with all four optional sections filled in and all three forms shown: a `code`
addition, a `before`/`after` edit, and a new test block. Copy it and overwrite
the fields rather than starting from the schema above; it is faster and it
shows the register the `why` lines should be written in.

```bash
python3 ~/.claude/skills/code-report/render.py \
        ~/.claude/skills/code-report/example.json /tmp/example.html
```
