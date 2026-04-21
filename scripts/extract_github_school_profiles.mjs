import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const sourcePath = '/tmp/China-Education-Data/数据收集-高等教育/04-数据宽表/高等教育数据宽表v20230118.csv';
const outputPath = path.join(repoRoot, 'data', 'research', 'github_school_profiles.2026-04-21.csv');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"') {
        if (next === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
      continue;
    }

    if (char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }

    if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    if (char === '\r') continue;
    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function csvEscape(value) {
  const text = value ?? '';
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

const text = await fs.readFile(sourcePath, 'utf8');
const rows = parseCsv(text).filter((row) => row.some((cell) => cell !== ''));
const [header, ...body] = rows;
const columns = Object.fromEntries(header.map((name, index) => [name, index]));

const outputRows = [
  ['moeCode', 'schoolName', 'website', 'schoolAddress', 'sourceTitle', 'sourceUrl', 'sourceDate', 'confidence', 'notes'],
];

for (const row of body) {
  const moeCode = (row[columns['学校标识码']] ?? '').trim().replace(/\.0$/, '');
  const schoolName = (row[columns['学校名称']] ?? '').trim();
  const website = (row[columns['学校官网']] ?? '').trim().replace(/\/+$/, '/');
  const schoolAddress = (row[columns['学校地址']] ?? '').trim();
  if (!moeCode || !schoolName || !website) continue;

  outputRows.push([
    moeCode,
    schoolName,
    website,
    schoolAddress,
    'DaoSword China-Education-Data 高等教育宽表',
    'https://github.com/DaoSword/China-Education-Data',
    '2026-04-21',
    'medium',
    'GitHub 补充源；链接本身为学校官网域名，建议后续优先以教育部门或学校官网目录复核。',
  ]);
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, outputRows.map((row) => row.map(csvEscape).join(',')).join('\n') + '\n', 'utf8');
console.log(`wrote ${outputPath}`);
console.log(`rows ${outputRows.length - 1}`);
