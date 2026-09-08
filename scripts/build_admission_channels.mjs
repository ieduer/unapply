#!/usr/bin/env node
//
// 由 data/research/admission_channels.*.csv 生成 src/data/admissionChannels.ts。
//
// 為什麼要有這一層：A6 之前把 `regular_gaokao` 硬編碼給全部 2919 所學校，
// 等於在沒有任何來源的情況下斷言「每所學校都能靠填志願進」。實際上一批學校
// 本科只走綜合評價（須另行報名 + 校測），而且是逐省不同的——上海科技大學 2025 年
// 在 18 省是綜評、只有安徽走普通本科批；中國科學院大學在北京則是綜評與普通一批並行。
//
// 因此這裡記錄的是「學校 × 省份 × 年度」的招生管道，不是布林旗標。
// 未收錄的學校一律回到 regular 先驗，不誤殺。

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const researchDir = path.join(repoRoot, 'data', 'research');
const outputPath = path.join(repoRoot, 'src', 'data', 'admissionChannels.ts');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ',') { row.push(field); field = ''; continue; }
    if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (char === '\r') continue;
    field += char;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((entry) => entry.some((cell) => cell.trim() !== ''));
}

// 'unpublished_pilot' 是一個刻意的第三態：學校章程說「另在部分省份試點普通本科批次錄取」，
// 但名單既不在章程也不在簡章裡（只在各省招生計劃）。既不能當成「全國都有常規批」，
// 也不能當成「全國都沒有」——所以單獨標出來，只提示不排除。
const REGULAR_SENTINELS = new Set(['all', 'unpublished_pilot']);

// 全站的省份字串是繁體（'江蘇'、'廣東'、'山東'…），來自教育部主表。
// 招生章程原文是簡體，兩邊不統一時逐省匹配會靜默失效：
// '江苏' 永遠等不到 '江蘇'，於是落到「收錄了但沒覆蓋該省」分支、回到 regular 先驗，
// 看起來一切正常，實際上整條規則沒生效。所以這裡做別名歸一 + 白名單硬校驗。
const PROVINCE_ALIASES = {
  江苏: '江蘇', 广东: '廣東', 广西: '廣西', 山东: '山東', 辽宁: '遼寧', 陕西: '陝西',
  云南: '雲南', 贵州: '貴州', 甘肃: '甘肅', 重庆: '重慶', 内蒙古: '內蒙古', 宁夏: '寧夏',
  黑龙江: '黑龍江', 台湾: '臺灣', 澳门: '澳門',
};

function canonicalProvince(name, canonicalSet) {
  const trimmed = name.trim();
  if (canonicalSet.has(trimmed)) return trimmed;
  const aliased = PROVINCE_ALIASES[trimmed];
  if (aliased && canonicalSet.has(aliased)) return aliased;
  return null;
}

function parseProvinceList(raw, canonicalSet, problems, label) {
  const value = (raw ?? '').trim();
  if (!value || value === 'none') return [];
  if (REGULAR_SENTINELS.has(value)) return [value];
  const out = [];
  for (const item of value.split('|').map((entry) => entry.trim()).filter(Boolean)) {
    const canonical = canonicalProvince(item, canonicalSet);
    if (!canonical) {
      problems.push(`${label}：省份「${item}」不在教育部主表的省份集合里（全站用繁体，如「江蘇」「廣東」）`);
      continue;
    }
    out.push(canonical);
  }
  return out;
}

async function resolveLatestCsv() {
  const entries = await fs.readdir(researchDir);
  const matches = entries.filter((name) => /^admission_channels\..*\.csv$/.test(name)).sort();
  if (matches.length === 0) {
    throw new Error(`找不到 data/research/admission_channels.*.csv；A6 招生管道層不能靜默留空。`);
  }
  return path.join(researchDir, matches[matches.length - 1]);
}

async function main() {
  const csvPath = await resolveLatestCsv();
  const rows = parseCsv(await fs.readFile(csvPath, 'utf8'));
  const header = rows[0].map((cell) => cell.trim());
  const officialModuleUrl = pathToFileURL(path.join(repoRoot, 'src', 'data', 'officialSchools.ts')).href;
  const { officialSchools } = await import(officialModuleUrl);
  const officialByCode = new Map(officialSchools.map((school) => [school.moeCode, school]));
  const canonicalProvinces = new Set(officialSchools.map((school) => school.province).filter(Boolean));

  const records = {};
  const problems = [];

  for (const row of rows.slice(1)) {
    const item = Object.fromEntries(header.map((key, index) => [key, (row[index] ?? '').trim()]));
    const moeCode = item.moeCode;
    if (!moeCode) continue;

    // 硬失敗而不是靜默跳過：校名或代碼一旦漂移，規則會無聲失效，
    // 那正是 A6 這次出問題的模式。
    const official = officialByCode.get(moeCode);
    if (!official) {
      problems.push(`moeCode ${moeCode}（${item.schoolName}）不在教育部主表中`);
      continue;
    }
    const officialName = official.nameSimplified ?? official.name;
    if (item.schoolName && item.schoolName !== officialName) {
      problems.push(`moeCode ${moeCode} 校名不一致：CSV 写 ${item.schoolName}，主表是 ${officialName}`);
      continue;
    }
    if (!item.sourceUrl) {
      problems.push(`moeCode ${moeCode}（${officialName}）缺少 sourceUrl；招生管道结论必须可追溯`);
      continue;
    }

    const label = `moeCode ${moeCode}（${officialName}）`;
    const regularProvinces = parseProvinceList(item.regularProvinces, canonicalProvinces, problems, `${label} regularProvinces`);
    const comprehensiveProvinces = parseProvinceList(item.comprehensiveProvinces, canonicalProvinces, problems, `${label} comprehensiveProvinces`);
    if (regularProvinces.length === 0 && comprehensiveProvinces.length === 0) {
      problems.push(`moeCode ${moeCode}（${officialName}）两个管道都为空，这条记录没有意义`);
      continue;
    }

    records[moeCode] = {
      schoolName: officialName,
      year: Number(item.year) || null,
      regularProvinces,
      comprehensiveProvinces,
      source: {
        title: item.sourceTitle,
        url: item.sourceUrl,
        date: item.sourceDate || undefined,
        confidence: item.confidence || undefined,
      },
      notes: item.notes || undefined,
    };
  }

  if (problems.length > 0) {
    console.error('招生管道数据校验失败：');
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }

  const sorted = Object.fromEntries(Object.entries(records).sort(([left], [right]) => left.localeCompare(right)));
  const output = `// Generated by scripts/build_admission_channels.mjs. Do not edit by hand.\n`
    + `// Source: ${path.relative(repoRoot, csvPath)}\n`
    + `//\n`
    + `// 只收有官方招生章程佐證的結論。沒有記錄的學校在 A6 一律落回 regular 先驗，\n`
    + `// 寧可少排除，不可誤殺。\n\n`
    + `import type { SchoolAdmissionChannels } from './runtimeTypes'\n\n`
    + `export const admissionChannelsByMoeCode: Record<string, SchoolAdmissionChannels> = ${JSON.stringify(sorted, null, 2)}\n\n`
    + `export const admissionChannelMeta = ${JSON.stringify({
      generatedAt: new Date().toISOString(),
      input: path.relative(repoRoot, csvPath),
      schoolCount: Object.keys(sorted).length,
    }, null, 2)}\n`;

  await fs.writeFile(outputPath, output, 'utf8');
  console.log(`wrote ${path.relative(repoRoot, outputPath)}`);
  console.log(`admission channel schools: ${Object.keys(sorted).length}`);
}

await main();
