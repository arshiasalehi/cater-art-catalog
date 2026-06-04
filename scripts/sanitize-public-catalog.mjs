import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const inputPath = path.join(repoRoot, 'docs', 'products_export_1.csv');

const safeHeaders = [
  'Handle',
  'Title',
  'Body (HTML)',
  'Vendor',
  'Product Category',
  'Type',
  'Tags',
  'Published',
  'Variant Price',
  'Variant Compare At Price',
  'Image Src',
  'Image Position',
  'Image Alt Text',
  'SEO Title',
  'SEO Description',
  'Artist (product.metafields.custom.artist)',
  'Edition (product.metafields.custom.edition)',
  'Size (product.metafields.custom.size)',
  'Status',
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (i === 0 && char === '\ufeff') {
      continue;
    }

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function sanitizeHtml(value) {
  let html = String(value ?? '');
  html = html.replace(/<meta\b[^>]*>/gi, '');
  html = html.replace(/\sdata-[\w-]+="[^"]*"/gi, '');
  html = html.replace(/\sclass="[^"]*"/gi, '');
  html = html.replace(/\sstyle="[^"]*"/gi, '');
  html = html.replace(/\sid="[^"]*"/gi, '');
  html = html.replace(/<\/?div\b[^>]*>/gi, '');
  return html.trim();
}

const input = await fs.readFile(inputPath, 'utf8');
const sourceRows = parseCsv(input);
if (!sourceRows.length) {
  throw new Error('CSV is empty');
}

const sourceHeaders = sourceRows[0];
const headerIndex = new Map(sourceHeaders.map((header, index) => [header, index]));
const outputRows = [safeHeaders];

for (let i = 1; i < sourceRows.length; i += 1) {
  const row = sourceRows[i];
  if (!row || row.every((cell) => !String(cell ?? '').trim())) {
    continue;
  }

  const safeRow = safeHeaders.map((header) => {
    const index = headerIndex.get(header);
    let value = index === undefined ? '' : (row[index] ?? '');
    if (header === 'Body (HTML)' || header === 'SEO Description') {
      value = sanitizeHtml(value);
    }
    return value;
  });

  outputRows.push(safeRow);
}

const csv = `${outputRows.map((row) => row.map(csvEscape).join(',')).join('\n')}\n`;
await fs.writeFile(inputPath, csv, 'utf8');

console.log(`Wrote ${path.relative(repoRoot, inputPath)} with ${outputRows.length - 1} data rows.`);
