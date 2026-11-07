#!/usr/bin/env node
// S1 專業／選考科目資料層 → 前端懶載入 payload。
//
//   node scripts/build_programs_layer.mjs     # 讀 data/research，寫 public/data/programs/{catalog,offerings}.json 與 src/data/programsManifest.ts
//
// 這一層不進 43 題、不進 AnswerMap、不進 public/data/runtime/（export_runtime_payloads.ts 會先 rm -rf 它）。
// 前端 src/lib/programsData.ts 用 manifest 的版本雜湊與各類數量核對 payload，數量不符就拒收。

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const researchDir = join(root, 'data', 'research')
const outDir = join(root, 'public', 'data', 'programs')

function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1 } else if (ch === '"') quoted = false; else cell += ch }
    else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [header, ...body] = rows
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])))
}
const die = (m) => { console.error(`build_programs_layer: ${m}`); process.exit(1) }

const registry = JSON.parse(readFileSync(join(researchDir, 's1_sources.json'), 'utf8'))
const sourceById = Object.fromEntries(registry.sources.map((s) => [s.id, s]))
const catalogRows = parseCsv(readFileSync(join(researchDir, 'bk_catalog.2026.csv'), 'utf8'))
const offeringRows = parseCsv(readFileSync(join(researchDir, 'program_offerings.2027.csv'), 'utf8'))
const strongRows = parseCsv(readFileSync(join(researchDir, 'strong_base_schools.2026.csv'), 'utf8'))
const offeringsMeta = JSON.parse(readFileSync(join(researchDir, 'program_offerings.2027.meta.json'), 'utf8'))

// ---------- 目錄 ----------
const disciplines = new Map(), classes = new Map()
for (const r of catalogRows) {
  if (!disciplines.has(r.disciplineCode)) disciplines.set(r.disciplineCode, { code: r.disciplineCode, name: r.disciplineName })
  if (r.classCode && !classes.has(r.classCode)) classes.set(r.classCode, { code: r.classCode, name: r.className, discipline: r.disciplineCode })
}
const catalogSource = sourceById['moe-bk-catalog-2026']
const catalog = {
  version: '',
  year: 2026,
  disciplines: [...disciplines.values()].sort((a, b) => a.code.localeCompare(b.code)),
  classes: [...classes.values()].sort((a, b) => a.code.localeCompare(b.code)),
  programs: catalogRows.map((r) => ({ code: r.code, name: r.name, class: r.classCode, discipline: r.disciplineCode, special: r.special === 'T', controlled: r.controlled === 'K' })),
  source: { title: catalogSource.title, url: catalogSource.pageUrl, date: catalogSource.publishedDate },
}
if (catalog.programs.length !== catalogSource.expected.programs || catalog.classes.length !== catalogSource.expected.classes || catalog.disciplines.length !== catalogSource.expected.disciplines) {
  die(`目錄計數不符：${catalog.disciplines.length}/${catalog.classes.length}/${catalog.programs.length}`)
}

// ---------- 逐校招生專業 ----------
const VALID_PATTERN = /^(none|[PCBZHG]{1,3})$/
const bySchool = new Map()
for (const r of offeringRows) {
  if (!VALID_PATTERN.test(r.requirementPattern)) die(`${r.schoolName} ${r.programName} 選考圖樣不合法：「${r.requirementPattern}」（衝突列不得進前端）`)
  if (r.conflict) die(`${r.schoolName} ${r.programName} 有跨省衝突，不得進前端`)
  const entry = bySchool.get(r.moeCode) ?? bySchool.set(r.moeCode, { moeCode: r.moeCode, provinces: new Set(), programs: [] }).get(r.moeCode)
  for (const p of r.provinces.split('|')) entry.provinces.add(p)
  entry.programs.push({ n: r.programName, c: r.campusLabel, k: r.catalogCode, cl: r.catalogClassCode, r: r.requirementPattern, m: r.catalogMatch, p: r.provinces })
}
const PROVINCE_SOURCE = { HB: 'hubei-xkkm-2027', JS: 'jiangsu-xkkm-2027', SH: 'shanghai-xkkm-2027', ZJ: 'zhejiang-xkkm-2027' }
const PROVINCE_ZH = { HB: '湖北', JS: '江蘇', SH: '上海', ZJ: '浙江' }
const usedSourceIds = new Set([...Object.values(PROVINCE_SOURCE), 'moe-bk-catalog-2026', 'moe-qiangji-2020-schools'])

// ---------- 強基 ----------
const strongBase = []
for (const r of strongRows) {
  if (r.inMoePool !== 'yes') continue
  const sourceId = r.evidenceYear === '2020' ? 'moe-qiangji-2020-schools' : registry.sources.find((s) => s.moeCode === r.moeCode && s.id.startsWith('qiangji-'))?.id
  if (!sourceId) die(`強基 ${r.schoolName} 找不到來源 id`)
  usedSourceIds.add(sourceId)
  strongBase.push({ moeCode: r.moeCode, sourceId, since: Number(r.listedSince) })
}

const sources = {}
for (const id of usedSourceIds) {
  const s = sourceById[id] ?? die(`registry 缺 ${id}`)
  sources[id] = { title: s.title, publisher: s.publisher, url: s.pageUrl, date: s.publishedDate, ...(s.province ? { province: s.province } : {}) }
}

const offerings = {
  version: '',
  admissionYear: 2027,
  catalogYear: 2026,
  provinceSources: Object.fromEntries(Object.entries(PROVINCE_SOURCE).map(([tag, id]) => [tag, { sourceId: id, nameZh: PROVINCE_ZH[tag] }])),
  sources,
  schools: [...bySchool.values()].sort((a, b) => a.moeCode.localeCompare(b.moeCode)).map((s) => ({ moeCode: s.moeCode, provinces: [...s.provinces].sort(), programs: s.programs })),
  strongBase: strongBase.sort((a, b) => a.moeCode.localeCompare(b.moeCode)),
  inputs: offeringsMeta.inputs,
}
const offeringCount = offerings.schools.reduce((n, s) => n + s.programs.length, 0)
if (offerings.schools.length !== offeringsMeta.counts.schoolsWithOfferings || offeringCount !== offeringsMeta.counts.offerings) {
  die(`payload 計數與 program_offerings.2027.meta.json 不符：${offerings.schools.length} 校／${offeringCount} 條`)
}

const version = createHash('sha256').update(JSON.stringify(catalog)).update(JSON.stringify(offerings)).digest('hex').slice(0, 12)
catalog.version = version
offerings.version = version
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'catalog.json'), JSON.stringify(catalog))
writeFileSync(join(outDir, 'offerings.json'), JSON.stringify(offerings))
const manifest = {
  version,
  catalogPath: '/data/programs/catalog.json',
  offeringsPath: '/data/programs/offerings.json',
  admissionYear: 2027,
  catalogYear: 2026,
  counts: {
    disciplines: catalog.disciplines.length,
    classes: catalog.classes.length,
    catalogPrograms: catalog.programs.length,
    schools: offerings.schools.length,
    offerings: offeringCount,
    strongBase: strongBase.length,
    sources: Object.keys(sources).length,
  },
}
writeFileSync(join(root, 'src', 'data', 'programsManifest.ts'),
  `// Generated by scripts/build_programs_layer.mjs. Do not edit by hand.\nexport const programsManifest = ${JSON.stringify(manifest, null, 2)} as const\n`)
const kib = (name) => (readFileSync(join(outDir, name)).length / 1024).toFixed(0)
console.log(`wrote public/data/programs/catalog.json (${kib('catalog.json')} KiB), offerings.json (${kib('offerings.json')} KiB) version ${version}`)
console.log(JSON.stringify(manifest.counts))
