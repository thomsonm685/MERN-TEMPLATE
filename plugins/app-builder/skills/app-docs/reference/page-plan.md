# The pages file, and the markup the shell styles

Two halves: the shape of the file you hand to `build-docs.mjs`, and the HTML vocabulary
that already has styling. Writing markup outside this vocabulary is how a page ends up
looking almost right.

---

## The pages file

```json
{
  "meta": {
    "name": "Dog Walk",
    "sub": "Tracker",
    "title": "Dog Walk Tracker Reference",
    "description": "Every screen, every record, and every rule in the app.",
    "storePrefix": "dog-walk-tracker-docs",
    "shareBase": ""
  },
  "nav": [
    "introduction",
    "getting-started",
    { "group": "Screens", "pages": ["screens/walks", "screens/dogs"] },
    { "group": "Data", "pages": [{ "page": "data/walk", "label": "The Walk record" }] }
  ],
  "pages": {
    "introduction": {
      "title": "Dog Walk Tracker",
      "left": "<h1>Dog Walk Tracker</h1>\n<p class=\"lede\">…</p>",
      "right": "",
      "md": "# Dog Walk Tracker\n\n…"
    }
  }
}
```

| Field                | Notes                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `meta.name` / `sub`  | The two halves of the wordmark, top left. `sub` defaults to "Reference".                             |
| `meta.title`         | Browser tab, and the suffix on every page title. Required.                                           |
| `meta.storePrefix`   | Namespace for the theme/language preferences in `localStorage`. Defaults to `<name>-docs`.           |
| `meta.shareBase`     | Prefix for the URL the `#` anchor copies. Leave empty for a local file; set it once it has a home.   |
| `nav`                | Order **is** the page order — prev/next and the home page come from it. Strings or `{group, pages}`. |
| `pages[route].md`    | Markdown source for "Copy for LLM". Required, and written as prose.                                  |
| `pages[route].right` | The code rail. Optional per page.                                                                    |

Routes with a `/` (`screens/walks`) are fine and read well in the URL. A page in a group
gets nav key `res:<group>:<last-segment>`; a flat page gets `concept:<route>`. The script
derives both — you never write nav keys.

---

## A page set that works for an app from this template

Eight to twelve pages. Adjust to the app; don't pad.

| Page                | Holds                                                                             |
| ------------------- | --------------------------------------------------------------------------------- |
| `introduction`      | What the app is, who it's for, the one-paragraph version of how it works          |
| `getting-started`   | How to run it: the three commands, the URL, making the first account              |
| `concepts`          | The two or three nouns the app is built around, in their words                    |
| **Screens** (group) | One page per real screen: what it's for, what's on it, what a person can do there |
| **Data** (group)    | One page per model: every field, type, whether it's required, and what it means   |
| **API** (group)     | One page per resource: the routes, their inputs, their responses, their errors    |
| `auth`              | How accounts and sessions work, and what is private to whom                       |
| `changing-it`       | How the owner asks for changes, and what's deliberately not built yet             |

The last one matters more than it looks. It is the page a non-technical owner actually
needs, and no generated reference ever includes it.

---

## The markup vocabulary

All of this is already styled. Use it; don't invent classes.

### Page opening

```html
<h1>The athlete record</h1>
<div class="endpoint-line">
  <span class="method method-get">PAGE</span><span class="path">/athletes/:id</span>
</div>
<p class="lede">The page a coach actually lands on.</p>
```

`endpoint-line` is for a page that documents a route or a screen; skip it on conceptual
pages. `method` takes `method-get`, `method-post`, `method-patch`, `method-put` or
`method-delete` — and `PAGE` is a legitimate pseudo-method for a screen.

The `lede` paragraph goes directly after the `<h1>` (or after the endpoint line). The
on-this-page contents is inserted after it automatically.

### Structure

```html
<h2 class="section">The two stores, and why it matters</h2>
<p>
  Body copy. <code>inline code</code>, <strong>bold</strong>, <em>italic</em>, and
  <a href="#/product-law">links to other pages</a> all work.
</p>
```

Cross-page links are `href="#/<route>"`. Use them liberally — they are what makes it a
reference rather than a pile of pages.

### Callouts

```html
<div class="callout">
  <p><strong>Lead with the point.</strong> Then the detail.</p>
</div>
<div class="callout callout-note"><p>Useful aside.</p></div>
<div class="callout callout-warning"><p>Something that will cost them a day.</p></div>
```

The class is `callout-warning`. `callout-warn` is not a class and renders unstyled.

### Tables

```html
<table class="doc-table">
  <thead>
    <tr>
      <th>Field</th>
      <th>Type</th>
      <th>Notes</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>durationMinutes</code></td>
      <td>Number</td>
      <td>1–600</td>
    </tr>
  </tbody>
</table>
```

### Badges

```html
<span class="badge badge-new">New</span>
<span class="badge badge-preview">Preview</span>
<span class="badge badge-beta">Beta</span>
<span class="badge badge-deprecated">Deprecated</span>
```

### The code rail (`right`)

One or more cards. Each card has a bar (title or language tabs, plus a copy button) and
one or more bodies.

```html
<div class="code-panel">
  <div class="code-card">
    <div class="code-bar">
      <span class="code-title">Creating a walk</span>
      <button class="copy-btn" title="Copy">Copy</button>
    </div>
    <pre class="code-body is-active"><code>POST /api/walks
{ &quot;dog&quot;: &quot;…&quot;, &quot;durationMinutes&quot;: 35 }</code></pre>
  </div>
</div>
```

With language tabs — the choice is remembered across pages, so use the **same label set**
everywhere (`curl` / `JavaScript`, or `Request` / `Response`, but not both):

```html
<div class="code-card">
  <div class="code-bar">
    <div class="lang-tabs" role="tablist">
      <button class="lang-tab is-active" role="tab" data-lang="curl">curl</button>
      <button class="lang-tab" role="tab" data-lang="js">JavaScript</button>
    </div>
    <button class="copy-btn" title="Copy">Copy</button>
  </div>
  <pre class="code-body is-active" data-lang="curl"><code>curl …</code></pre>
  <pre class="code-body" data-lang="js"><code>await fetch(…)</code></pre>
</div>
```

Exactly one body per card carries `is-active`. Escape `<`, `>` and `&` inside `<code>`.

### Field lists

For a data model page, when a table is too flat:

```html
<div class="fields">
  <div class="field">
    <div class="f-head">
      <span class="f-name">durationMinutes</span>
      <span class="f-type">number</span>
      <span class="f-required">Required</span>
    </div>
    <div class="f-desc"><p>How long the walk lasted, in minutes.</p></div>
    <div class="f-constraint">1–600</div>
  </div>
</div>
```

---

## Writing the `md`

Plain markdown, written to be read on its own — someone pastes it into a chat and asks a
question. Mirror the page's structure, keep the facts, drop the chrome:

```markdown
# The Walk record

One walk, logged by one walker. Stored in MongoDB, scoped to the signed-in user.

Fields: dog (required, references Dog), startedAt (required, date),
durationMinutes (required, 1–600), notes (optional, free text).

A walk is only ever visible to the account that created it — every query filters by user.
```

Do not paste HTML into `md`, and do not leave it as a one-line stub. A reader who hits
"Copy for LLM" on a stub gets a worse answer than if the button weren't there.
