#!/usr/bin/env node
/**
 * build-docs.mjs — assemble a Stripe-style reference page from a pages file.
 *
 *   node scripts/build-docs.mjs <pages.json> <output.html>
 *
 * The shell (18 KB of CSS, the hash router, the theme and markdown toggles, the
 * code-sample language switcher, the on-this-page TOC) lives in
 * assets/shell.html and never changes. This script injects two things into it:
 * the sidebar markup and the page data. Everything else you author is content.
 *
 * It validates before it writes: every nav entry must name a real page, every
 * page must appear in the nav exactly once, and every page needs a title, `left`
 * and `md`. A page that exists but is unreachable is the failure this catches —
 * it looks fine in the file and is invisible in the browser.
 *
 * See reference/page-plan.md for the content conventions and the class inventory.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHELL = path.join(HERE, '..', 'assets', 'shell.html');

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(2);
}

const [pagesPath, outPath] = process.argv.slice(2);
if (!pagesPath || !outPath) fail('usage: node build-docs.mjs <pages.json> <output.html>');
if (!existsSync(pagesPath)) fail(`pages file not found: ${pagesPath}`);
if (!existsSync(SHELL)) fail(`shell asset missing: ${SHELL}`);

let spec;
try {
  spec = JSON.parse(readFileSync(pagesPath, 'utf8'));
} catch (err) {
  fail(`pages file is not valid JSON: ${err.message}`);
}

const meta = spec.meta ?? {};
const nav = spec.nav;
const pages = spec.pages;
if (!Array.isArray(nav) || nav.length === 0) fail('"nav" must be a non-empty array');
if (!pages || typeof pages !== 'object') fail('"pages" must be an object keyed by route');
for (const key of ['name', 'title']) {
  if (!meta[key]) fail(`meta.${key} is required`);
}

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CHEV =
  '<svg class="chev" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">' +
  '<path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" ' +
  'stroke-linecap="round" stroke-linejoin="round"/></svg>';

// --- walk the nav: collect order, nav keys, and build the markup -------------
const order = [];
const navKeys = new Map();
const seen = new Set();
const navHtml = [];
let flatBuffer = [];

const flushFlat = () => {
  if (flatBuffer.length) {
    navHtml.push(`<ul class="nav-list">\n${flatBuffer.join('\n')}\n</ul>`);
    flatBuffer = [];
  }
};

const addPage = (route, groupSlug, label) => {
  if (!(route in pages)) fail(`nav names a page that doesn't exist: "${route}"`);
  if (seen.has(route)) fail(`page "${route}" appears in the nav more than once`);
  seen.add(route);
  order.push(route);
  const key = groupSlug ? `res:${groupSlug}:${slug(route.split('/').pop())}` : `concept:${slug(route)}`;
  navKeys.set(route, key);
  const text = label ?? pages[route].navLabel ?? pages[route].title;
  return `<li><a class="nav-link" data-key="${esc(key)}" href="#/${esc(route)}">${esc(text)}</a></li>`;
};

for (const entry of nav) {
  if (typeof entry === 'string') {
    flatBuffer.push(addPage(entry, null));
    continue;
  }
  if (entry && entry.page) {
    flatBuffer.push(addPage(entry.page, null, entry.label));
    continue;
  }
  if (entry && entry.group) {
    if (!Array.isArray(entry.pages) || entry.pages.length === 0) {
      fail(`nav group "${entry.group}" has no pages`);
    }
    flushFlat();
    const gs = slug(entry.group);
    const items = entry.pages.map((p) =>
      typeof p === 'string' ? addPage(p, gs) : addPage(p.page, gs, p.label),
    );
    navHtml.push(
      `<div class="nav-group"><button class="nav-group-hdr" aria-expanded="true">${esc(entry.group)}` +
        `${CHEV}</button><ul class="nav-list">\n${items.join('\n')}\n</ul></div>`,
    );
    continue;
  }
  fail(`unrecognised nav entry: ${JSON.stringify(entry)}`);
}
flushFlat();

const orphans = Object.keys(pages).filter((route) => !seen.has(route));
if (orphans.length) {
  fail(
    `these pages are not in the nav, so nothing can reach them: ${orphans.join(', ')}\n` +
      `  add them to "nav", or delete them from "pages"`,
  );
}

// --- build the data blob ----------------------------------------------------
const data = {};
order.forEach((route, i) => {
  const page = pages[route];
  for (const field of ['title', 'left', 'md']) {
    if (!page[field] || !String(page[field]).trim()) {
      fail(`page "${route}" is missing "${field}"`);
    }
  }
  if (!/<h1[\s>]/.test(page.left)) fail(`page "${route}" has no <h1> in its "left" html`);
  const prev = order[i - 1];
  const next = order[i + 1];
  data[route] = {
    title: page.title,
    navKey: navKeys.get(route),
    res: navKeys.get(route).startsWith('res:') ? navKeys.get(route).split(':')[1] : null,
    left: page.left,
    right: page.right ?? '',
    md: page.md,
    prev: prev ? { r: prev, t: pages[prev].title } : null,
    next: next ? { r: next, t: pages[next].title } : null,
  };
});

// --- render -----------------------------------------------------------------
const brand = meta.name;
const brandSub = meta.sub ?? 'Reference';
const out = readFileSync(SHELL, 'utf8')
  .replaceAll('__NAV__', navHtml.join('\n'))
  .replaceAll('__DATA__', JSON.stringify(data).replace(/<\/script>/gi, '<\\/script>'))
  .replaceAll('__BRAND_SUB__', esc(brandSub))
  .replaceAll('__BRAND__', esc(brand))
  .replaceAll('__DESCRIPTION__', esc(meta.description ?? meta.title))
  .replaceAll('__TITLE__', esc(meta.title))
  .replaceAll('__HOME__', esc(order[0]))
  .replaceAll('__SHARE_BASE__', meta.shareBase ?? '')
  .replaceAll('__STORE__', slug(meta.storePrefix ?? `${brand}-docs`));

const leftover = [...new Set(out.match(/__[A-Z_]+__/g) ?? [])];
if (leftover.length) fail(`shell still has unfilled placeholders: ${leftover.join(', ')}`);

mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
writeFileSync(outPath, out, 'utf8');

const kb = (n) => `${Math.round(n / 102.4) / 10} KB`;
console.log(`${outPath}  ${order.length} pages / ${kb(out.length)}`);
console.log(`  order: ${order.join(' → ')}`);
