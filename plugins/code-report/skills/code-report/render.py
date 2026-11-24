#!/usr/bin/env python3
"""Turn a small JSON description of a change set into one self-contained page.

Why a renderer and not a template to copy: the slow, error-prone part of
writing one of these by hand is the HTML, and the HTML is the part that never
varies. Writing JSON instead means the only thing authored per report is the
content - file, lines, what, why - which is the whole point of the report.

    python3 render.py report.json out.html
    cat report.json | python3 render.py - out.html

The top-level sections are optional and a missing key is never an error: the
section is left out. Inside `changes` it is the opposite. Every entry must
carry the exact location (`file` + `lines`, or `new_file`) and the exact code
(`code`, or `before`/`after`), and the renderer exits 2 if one does not. A
report that says "tightened the validation" without showing the lines is the
failure this format exists to prevent, so it is enforced here rather than
trusted to the author.
"""

from __future__ import annotations

import html
import json
import re
import sys
from typing import Any

# --------------------------------------------------------------------------
# input
# --------------------------------------------------------------------------

STATUSES = {
    "proposed": ("PROPOSED", "Not applied. Nothing has been changed yet."),
    "applied": ("APPLIED", "Changes are in the working tree."),
}


def load(path: str) -> dict[str, Any]:
    raw = sys.stdin.read() if path == "-" else open(path, encoding="utf-8").read()
    data = json.loads(raw)
    status = str(data.get("status", "")).lower()
    if status not in STATUSES:
        die(f"status must be one of {sorted(STATUSES)}, got {data.get('status')!r}")
    if not data.get("changes"):
        die("at least one entry in `changes` is required - that is the report")
    for i, c in enumerate(data["changes"]):
        for required in ("file", "what", "why"):
            if not c.get(required):
                die(f"changes[{i}] is missing {required!r}")
        where = f"changes[{i}] ({c.get('file')})"
        if not code_blocks(c):
            die(
                f"{where} shows no code. Every change shows the exact code: "
                "`before` + `after` for an edit, `before` alone for a deletion, "
                "`code` for a new block or whole new file."
            )
        if not lines_of(c) and not c.get("new_file"):
            die(
                f"{where} has no `lines`. Run `grep -n` or `git diff -U0` and "
                'write the real numbers, e.g. "341" or "60-120". Set '
                '"new_file": true only if the file does not exist yet.'
            )
    return data


def die(message: str) -> None:
    sys.stderr.write(f"code-report: {message}\n")
    raise SystemExit(2)


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------


def e(value: Any) -> str:
    return html.escape("" if value is None else str(value), quote=True)


def lines_of(change: dict[str, Any]) -> str:
    raw = change.get("lines") or change.get("line")
    if raw is None:
        return ""
    if isinstance(raw, (list, tuple)):
        return ", ".join(str(x) for x in raw)
    return str(raw)


def line_numbers(change: dict[str, Any], count: int) -> list[int] | None:
    """The gutter numbers for a block of `count` lines, or None if unknowable.

    Numbers go beside the code whenever they can be worked out, so the order is
    widest-net: an explicit `line_start`, then a comma list that lines up one
    number per line of code, then the first number of the range, then 1 for a
    new file. Only a change with no location at all renders bare.
    """
    raw = lines_of(change)
    nums = [int(n) for n in re.findall(r"\d+", raw)]

    if change.get("line_start"):
        start = int(change["line_start"])
    elif "," in raw and len(nums) > 1:
        # Disjoint lines. Numbering sequentially from the first would be a false
        # claim, so it only works when the list is one number per line of code;
        # otherwise split the entry, or set `line_start`.
        return nums if len(nums) == count else None
    elif nums:
        start = nums[0]
    elif change.get("new_file"):
        start = 1
    else:
        return None
    return [start + k for k in range(count)]


def as_text(value: Any) -> str:
    """Code may be a string or a list of lines; a list is kinder to write in JSON."""
    if isinstance(value, (list, tuple)):
        return "\n".join(str(x) for x in value)
    return str(value)


def code_blocks(change: dict[str, Any]) -> list[tuple[str, str, bool]]:
    """(caption, text, number_it) in render order.

    `before`/`after` is the exact-edit form: a reader can apply it by hand and a
    reviewer can see what is being overwritten. `code` is the single-block form,
    for a new file or an addition that replaces nothing.
    """
    out: list[tuple[str, str, bool]] = []
    before, after = change.get("before"), change.get("after")
    deletion = before is not None and (after is None or not as_text(after).strip())

    if before is not None:
        caption = change.get("before_label") or ("removed" if deletion else "replace this")
        out.append((caption, as_text(before), True))
    if after is not None and not deletion:
        out.append((change.get("after_label") or "with this", as_text(after), True))
    if change.get("code") is not None:
        default = "new file" if change.get("new_file") else "added"
        out.append((change.get("code_label") or default, as_text(change["code"]), True))
    return [(cap, text, num) for cap, text, num in out if text.strip()]


def anchor(change: dict[str, Any], i: int) -> str:
    base = str(change.get("file", "")).replace("/", "-").replace(".", "-")
    return f"c{i + 1}-{base}".strip("-").lower()


def plural(n: int, word: str) -> str:
    return f"{n} {word}" + ("" if n == 1 else "s")


# --------------------------------------------------------------------------
# sections
# --------------------------------------------------------------------------


def banner(data: dict[str, Any]) -> str:
    status = str(data["status"]).lower()
    label, default_note = STATUSES[status]
    note = data.get("status_note") or default_note

    bits = []
    for key, prefix in (("repo", ""), ("branch", "branch "), ("commit", "")):
        if data.get(key):
            bits.append(f"{prefix}{e(data[key])}")
    if "deployed" in data:
        bits.append("deployed" if data["deployed"] else "not deployed")
    if "pushed" in data:
        bits.append("pushed" if data["pushed"] else "local only")

    meta = f'<p class="meta">{" &middot; ".join(bits)}</p>' if bits else ""
    return f"""<div class="banner {status}">
    <p class="label">{e(label)}</p>
    <p class="note">{e(note)}</p>
    {meta}
  </div>"""


def tally(data: dict[str, Any]) -> str:
    changes = data["changes"]
    files = {c.get("file") for c in changes}
    parts = [plural(len(changes), "change"), f"across {plural(len(files), 'file')}"]

    fresh = len({c.get("file") for c in changes if c.get("new_file")})
    if fresh:
        parts.append(f"{fresh} new")

    surfaces: dict[str, int] = {}
    for c in changes:
        if c.get("surface"):
            surfaces[c["surface"]] = surfaces.get(c["surface"], 0) + 1
    if surfaces:
        order = sorted(surfaces.items(), key=lambda kv: (-kv[1], kv[0]))
        parts.append(" &middot; ".join(f"{n} {e(s)}" for s, n in order))
    return f'<p class="tally">{" &nbsp;|&nbsp; ".join(parts)}</p>'


def change_card(change: dict[str, Any], i: int) -> str:
    lines = lines_of(change)
    where = e(change["file"]) + (f'<span class="ln">:{e(lines)}</span>' if lines else "")
    surface = (
        f'<span class="surface">{e(change["surface"])}</span>'
        if change.get("surface")
        else ""
    )
    is_new = bool(change.get("new_file"))
    state = (
        '<span class="surface new">new file</span>'
        if is_new
        else '<span class="surface">existing file</span>'
    )
    code = "".join(
        code_block(cap, text, change, numbered)
        for cap, text, numbered in code_blocks(change)
    )
    return f"""<article class="change" id="{e(anchor(change, i))}">
    <header>
      <a class="where" href="#{e(anchor(change, i))}">{where}</a>
      {surface}
      {state}
    </header>
    <p class="what">{e(change["what"])}</p>
    <p class="why"><span>Why</span> {e(change["why"])}</p>
    {code}
  </article>"""


def code_block(caption: str, text: str, change: dict[str, Any], numbered: bool) -> str:
    """One captioned block, line numbers down the left wherever they are known.

    The gutter is a separate <pre> so that selecting the code does not drag the
    numbers along with it - the block is meant to be copied and applied.
    """
    body = text.rstrip("\n")
    nums = line_numbers(change, body.count("\n") + 1) if numbered else None
    loc = e(change["file"]) + (f":{nums[0]}" if nums else "")
    gutter = ""
    if nums:
        column = "\n".join(str(n) for n in nums)
        gutter = f'<pre class="gut" aria-hidden="true"><code>{column}</code></pre>'
    return f"""<p class="caption">{e(caption)} <span class="loc">{loc}</span></p>
    <div class="codeblock">{gutter}<pre class="src"><code>{e(body)}</code></pre></div>"""


def simple_list(title: str, items: Any, kind: str) -> str:
    """One list section. Accepts plain strings or {item, why} objects."""
    if not items:
        return ""
    rows = []
    for entry in items:
        if isinstance(entry, dict):
            head = e(entry.get("item") or entry.get("what") or "")
            why = entry.get("why")
            rows.append(
                f"<li><b>{head}</b>" + (f"<span> {e(why)}</span>" if why else "") + "</li>"
            )
        else:
            rows.append(f"<li>{e(entry)}</li>")
    return f"""<section class="{kind}">
    <h2>{e(title)}</h2>
    <ul>{"".join(rows)}</ul>
  </section>"""


# --------------------------------------------------------------------------
# page
# --------------------------------------------------------------------------

def page(data: dict[str, Any]) -> str:
    title = data.get("title") or "Code Report"
    subtitle = data.get("subtitle") or ""
    cards = "\n  ".join(change_card(c, i) for i, c in enumerate(data["changes"]))

    sections = "\n  ".join(
        filter(
            None,
            [
                simple_list("How it was verified", data.get("verification"), "verify"),
                simple_list("Risk and downstream", data.get("risk"), "risk"),
                simple_list("Not done, and why", data.get("deferred"), "deferred"),
                simple_list("Next", data.get("next"), "next"),
            ],
        )
    )

    sub = f'<p class="standfirst">{e(subtitle)}</p>' if subtitle else ""
    footer = (
        f'<footer>{e(data["footer"])}</footer>' if data.get("footer") else ""
    )

    return f"""<title>{e(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  :root{{
    --ink:#16191d; --paper:#f6f7f9; --card:#ffffff; --muted:#5b6472;
    --faint:#8b949f; --rule:#dde1e6; --accent:#35557a; --code:#eceff2;
    --amber:#8a5712; --amber-bg:#fbf1e0; --green:#1b6248; --green-bg:#e3f1eb;
    --sans:"Public Sans",ui-sans-serif,system-ui,-apple-system,sans-serif;
    --mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  }}
  @media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{
    --ink:#e7eaee; --paper:#14171b; --card:#1b1f24; --muted:#9aa3ae;
    --faint:#6d7682; --rule:#2b3139; --accent:#8fb3d9; --code:#1f242a;
    --amber:#e0a559; --amber-bg:#2e2516; --green:#6fc3a0; --green-bg:#152a22;
  }}}}
  :root[data-theme="dark"]{{
    --ink:#e7eaee; --paper:#14171b; --card:#1b1f24; --muted:#9aa3ae;
    --faint:#6d7682; --rule:#2b3139; --accent:#8fb3d9; --code:#1f242a;
    --amber:#e0a559; --amber-bg:#2e2516; --green:#6fc3a0; --green-bg:#152a22;
  }}
  *,*::before,*::after{{box-sizing:border-box}}
  body{{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);
    font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}}
  .wrap{{max-width:900px;margin:0 auto;padding:40px 22px 80px}}
  h1{{font-size:clamp(1.6rem,3.6vw,2.2rem);line-height:1.15;letter-spacing:-.015em;
    font-weight:700;margin:0 0 10px;text-wrap:balance}}
  .standfirst{{color:var(--muted);font-size:1.03rem;margin:0 0 26px;max-width:70ch}}

  /* status banner - the first thing read, so it is unmistakable */
  .banner{{border-radius:10px;padding:16px 20px;margin:0 0 22px;border:1px solid transparent}}
  .banner .label{{font-family:var(--mono);font-weight:700;font-size:13px;
    letter-spacing:.16em;margin:0 0 6px}}
  .banner .note{{margin:0;font-size:15px}}
  .banner .meta{{font-family:var(--mono);font-size:12.5px;margin:8px 0 0;opacity:.85}}
  .banner.proposed{{background:var(--amber-bg);border-color:var(--amber);color:var(--amber)}}
  .banner.applied{{background:var(--green-bg);border-color:var(--green);color:var(--green)}}
  .banner .note,.banner .meta{{color:inherit}}

  .tally{{font-family:var(--mono);font-size:12.5px;color:var(--faint);
    margin:0 0 24px;padding-bottom:16px;border-bottom:1px solid var(--rule)}}

  .change{{background:var(--card);border:1px solid var(--rule);border-radius:10px;
    padding:18px 20px;margin:0 0 14px}}
  .change header{{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 14px;
    margin-bottom:10px}}
  .where{{font-family:var(--mono);font-weight:500;font-size:14px;color:var(--accent);
    text-decoration:none;word-break:break-all}}
  .where:hover{{text-decoration:underline}}
  .where .ln{{font-weight:700}}
  .surface{{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;
    text-transform:uppercase;color:var(--faint);border:1px solid var(--rule);
    border-radius:4px;padding:2px 7px;white-space:nowrap}}
  .surface.new{{color:var(--green);border-color:var(--green);font-weight:500}}
  .what{{margin:0 0 6px;font-weight:500}}
  .why{{margin:0;color:var(--muted);font-size:15px}}
  .why span{{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;
    text-transform:uppercase;color:var(--faint);margin-right:7px}}
  .caption{{font-family:var(--mono);font-size:11px;letter-spacing:.06em;
    text-transform:uppercase;color:var(--faint);margin:16px 0 5px}}
  .caption .loc{{font-family:var(--mono);text-transform:none;letter-spacing:0;
    color:var(--accent);margin-left:8px}}
  .codeblock{{display:flex;background:var(--code);border:1px solid var(--rule);
    border-radius:7px;overflow:hidden;margin:0 0 4px}}
  pre{{font-family:var(--mono);font-size:12.5px;line-height:1.55;margin:0;
    padding:13px 15px;background:none}}
  pre.gut{{flex:0 0 auto;padding-right:11px;text-align:right;color:var(--faint);
    border-right:1px solid var(--rule);user-select:none;-webkit-user-select:none}}
  pre.src{{flex:1 1 auto;overflow-x:auto;white-space:pre}}
  pre code{{background:none;padding:0}}

  section{{margin-top:34px}}
  h2{{font-size:1.1rem;font-weight:600;letter-spacing:-.008em;margin:0 0 12px;
    padding-bottom:8px;border-bottom:1px solid var(--rule)}}
  section ul{{margin:0;padding-left:1.15em}}
  section li{{margin-bottom:9px}}
  section li b{{font-weight:600}}
  section li span{{color:var(--muted)}}
  .deferred li b{{color:var(--amber)}}
  footer{{margin-top:38px;padding-top:18px;border-top:1px solid var(--rule);
    color:var(--faint);font-size:14px}}
</style>

<div class="wrap">
  <h1>{e(title)}</h1>
  {sub}
  {banner(data)}
  {tally(data)}
  {cards}
  {sections}
  {footer}
</div>
"""


def main() -> None:
    if len(sys.argv) != 3:
        die("usage: render.py <report.json|-> <out.html>")
    data = load(sys.argv[1])
    with open(sys.argv[2], "w", encoding="utf-8") as fh:
        fh.write(page(data))
    n = len(data["changes"])
    files = len({c.get("file") for c in data["changes"]})
    print(f"{sys.argv[2]}  [{data['status']}]  {n} changes / {files} files")


if __name__ == "__main__":
    main()
