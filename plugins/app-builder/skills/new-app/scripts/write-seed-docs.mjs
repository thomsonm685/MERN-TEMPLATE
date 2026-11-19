#!/usr/bin/env node
/**
 * write-seed-docs.mjs — fill seed-documentation/*.csv from one JSON plan file.
 *
 *   node scripts/write-seed-docs.mjs <plan.json> <project-root>
 *
 * Why this exists: the six sheets are CSV, cross-reference each other by ID, and
 * carry prose that contains commas, quotes and newlines. Hand-writing them with
 * sed or a heredoc produces files that open in Sheets with the columns shifted by
 * one, which is worse than leaving them blank. This parses the real headers out of
 * the shipped files, so a renamed column or a typo'd field is an error here rather
 * than a silently-dropped value.
 *
 * The two key/value sheets (Overview, Design) keep their Field/Description rows and
 * row order exactly as shipped — only the Value column is written. The four list
 * sheets have their placeholder row replaced by your rows.
 *
 * See reference/spec-json.md for the JSON shape.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const SHEETS = {
  overview: { file: 'App Outline - Application Overview.csv', kind: 'keyed', keyColumn: 'Field' },
  design: { file: 'App Outline - Design & Style Guide.csv', kind: 'keyed', keyColumn: 'Element' },
  requirements: { file: 'App Outline - Functional Requirements (User Stories).csv', kind: 'rows' },
  pages: { file: 'App Outline - Application Pages_Views.csv', kind: 'rows' },
  models: { file: 'App Outline - Data Model (Database Structure).csv', kind: 'rows' },
  routes: { file: 'App Outline - API Routes and Core Logic.csv', kind: 'rows' },
};

/** RFC 4180 parse. Returns an array of row arrays. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let i = 0;
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  while (i < src.length) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function serializeField(value) {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function serializeCsv(rows) {
  return rows.map((row) => row.map(serializeField).join(',')).join('\n') + '\n';
}

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(2);
}

const [planPath, projectRoot] = process.argv.slice(2);
if (!planPath || !projectRoot) {
  fail('usage: node write-seed-docs.mjs <plan.json> <project-root>');
}
if (!existsSync(planPath)) fail(`plan file not found: ${planPath}`);

let plan;
try {
  plan = JSON.parse(readFileSync(planPath, 'utf8'));
} catch (err) {
  fail(`plan file is not valid JSON: ${err.message}`);
}

const unknownSheets = Object.keys(plan).filter((key) => !(key in SHEETS));
if (unknownSheets.length) {
  fail(
    `unknown top-level key(s): ${unknownSheets.join(', ')}. Expected: ${Object.keys(SHEETS).join(', ')}`,
  );
}

const seedDir = path.join(projectRoot, 'seed-documentation');
if (!existsSync(seedDir)) fail(`no seed-documentation/ folder in ${projectRoot}`);

const summary = [];

for (const [key, sheet] of Object.entries(SHEETS)) {
  const target = path.join(seedDir, sheet.file);
  if (!existsSync(target)) fail(`missing sheet: ${sheet.file}`);
  const data = plan[key];
  if (data == null) {
    summary.push(`  ${sheet.file} — untouched (no "${key}" in the plan)`);
    continue;
  }

  const rows = parseCsv(readFileSync(target, 'utf8'));
  const header = rows[0];

  if (sheet.kind === 'keyed') {
    if (typeof data !== 'object' || Array.isArray(data)) {
      fail(`"${key}" must be an object of { "<${sheet.keyColumn}>": "<value>" }`);
    }
    const keyIndex = header.indexOf(sheet.keyColumn);
    const valueIndex = header.indexOf('Value');
    const notesIndex = header.indexOf('Notes');
    if (keyIndex === -1 || valueIndex === -1) {
      fail(`${sheet.file} has no "${sheet.keyColumn}"/"Value" columns — header changed?`);
    }
    const known = new Map();
    rows.slice(1).forEach((row, offset) => known.set(row[keyIndex], offset + 1));
    const unknownFields = Object.keys(data).filter((field) => !known.has(field));
    if (unknownFields.length) {
      fail(
        `${sheet.file}: no such ${sheet.keyColumn.toLowerCase()}: ${unknownFields.join(', ')}\n` +
          `  valid: ${[...known.keys()].filter(Boolean).join(' | ')}`,
      );
    }
    let written = 0;
    for (const [field, raw] of Object.entries(data)) {
      const rowIndex = known.get(field);
      const row = rows[rowIndex];
      while (row.length < header.length) row.push('');
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        row[valueIndex] = raw.value ?? '';
        if (notesIndex !== -1 && raw.notes != null) row[notesIndex] = raw.notes;
      } else {
        row[valueIndex] = Array.isArray(raw) ? raw.join('; ') : (raw ?? '');
      }
      if (String(row[valueIndex]).trim()) written += 1;
    }
    const blank = rows.slice(1).filter((row) => !String(row[valueIndex] ?? '').trim()).length;
    writeFileSync(target, serializeCsv(rows), 'utf8');
    summary.push(`  ${sheet.file} — ${written} filled, ${blank} left blank`);
    continue;
  }

  if (!Array.isArray(data)) fail(`"${key}" must be an array of row objects`);
  const unknownColumns = new Set();
  const out = [header];
  for (const entry of data) {
    if (typeof entry !== 'object' || Array.isArray(entry) || entry == null) {
      fail(`"${key}" rows must be objects keyed by column name`);
    }
    for (const column of Object.keys(entry)) {
      if (!header.includes(column)) unknownColumns.add(column);
    }
    out.push(
      header.map((column) => {
        const value = entry[column];
        return Array.isArray(value) ? value.join('; ') : (value ?? '');
      }),
    );
  }
  if (unknownColumns.size) {
    fail(
      `${sheet.file}: no such column(s): ${[...unknownColumns].join(', ')}\n` +
        `  valid: ${header.join(' | ')}`,
    );
  }
  if (out.length === 1)
    fail(`"${key}" is empty — every sheet needs at least one row, or omit the key`);
  writeFileSync(target, serializeCsv(out), 'utf8');
  summary.push(`  ${sheet.file} — ${out.length - 1} row(s)`);
}

console.log('seed-documentation written:');
console.log(summary.join('\n'));
