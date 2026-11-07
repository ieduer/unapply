#!/usr/bin/env node
// S1 專業／選考科目資料層 → 前端懶載入 payload（兩層）。
//
//   node scripts/build_programs_layer.mjs     # 讀 data/research，寫 public/data/programs/{catalog.json,index.json,schools/programs-NN.json} 與 src/data/programsManifest.ts
//
// 第一層 index.json：每校一條緊湊摘要（本科／專科數、各專業類的選考圖樣、按類招生的類、對到具體專業的代碼與圖樣、
//   試驗班圖樣），結果頁的起點條件層只用它，2,952 校約 1 MB、gzip 約 150 KiB。
// 第二層 schools/programs-NN.json：逐校完整招生專業清單，按教育部省份分桶（沿用 runtime 校區分桶的編號），只在學校詳情載入。
// 這一層不進 43 題、不進 AnswerMap、不進 public/data/runtime/（export_runtime_payloads.ts 會先 rm -rf 它）。
// 前端 src/lib/programsData.ts 用 manifest 的版本雜湊與各類數量核對 payload，數量不符就拒收。

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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
const offeringRows = parseCsv(gunzipSync(readFileSync(join(researchDir, 'program_offerings.2027.all.csv.gz'))).toString('utf8'))
const strongRows = parseCsv(readFileSync(join(researchDir, 'strong_base_schools.2026.csv'), 'utf8'))
const offeringsMeta = JSON.parse(readFileSync(join(researchDir, 'program_offerings.2027.all.meta.json'), 'utf8'))
const { officialSchools } = await import(pathToFileURL(join(root, 'src', 'data', 'officialSchools.ts')).href)
const { campusBucketFileByProvince } = await import(pathToFileURL(join(root, 'src', 'data', 'campusProvinceBuckets.ts')).href)
const provinceByCode = new Map(officialSchools.map((s) => [s.moeCode, s.province]))

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
const catalogIndexByCode = new Map(catalog.programs.map((p, i) => [p.code, i]))

// ---------- 逐校：第二層完整清單＋第一層摘要 ----------
const VALID_PATTERN = /^(none|[PCBZHG]{1,3})$/
const patternIndex = new Map([['none', 0]])
const patterns = ['none']
const patIdx = (p) => { if (!patternIndex.has(p)) { patternIndex.set(p, patterns.length); patterns.push(p) } return patternIndex.get(p) }
const full = new Map()   // moeCode → programs[]
const index = {}         // moeCode → summary
for (const r of offeringRows) {
  if (!VALID_PATTERN.test(r.requirementPattern)) die(`${r.schoolName} ${r.programName} 選考圖樣不合法：「${r.requirementPattern}」（衝突列不得進前端）`)
  if (r.conflict) die(`${r.schoolName} ${r.programName} 有跨省衝突，不得進前端`)
  if (!provinceByCode.has(r.moeCode)) die(`${r.schoolName} ${r.moeCode} 不在教育部主表`)
  const level = r.level === '專科' ? 'v' : 'u'
  const program = { n: r.programName, c: r.campusLabel, l: level, k: r.catalogCode, cl: r.catalogClassCode, r: r.requirementPattern, m: r.catalogMatch, p: r.provinces }
  ;(full.get(r.moeCode) ?? full.set(r.moeCode, []).get(r.moeCode)).push(program)
  const s = index[r.moeCode] ?? (index[r.moeCode] = { u: 0, v: 0, x: 0, p: new Set(), c: {}, g: new Set(), k: [], e: [] })
  for (const tag of r.provinces.split('|')) s.p.add(tag)
  if (level === 'v') { s.v += 1; continue }
  s.u += 1
  const pi = patIdx(r.requirementPattern)
  if (r.catalogMatch === 'none') { s.x += 1; s.e.push(pi); continue }
  if (!r.catalogClassCode) { s.x += 1; s.e.push(pi); continue } // 交叉學科門類直屬等無專業類者
  ;(s.c[r.catalogClassCode] ??= []).push(pi)
  if (r.catalogMatch === 'class') s.g.add(r.catalogClassCode)
  else if (r.catalogCode && catalogIndexByCode.has(r.catalogCode)) s.k.push([catalogIndexByCode.get(r.catalogCode), pi])
}
for (const s of Object.values(index)) { s.p = [...s.p].sort().join('|'); s.g = [...s.g].sort(); if (s.g.length === 0) delete s.g; if (s.k.length === 0) delete s.k; if (s.e.length === 0) delete s.e }

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

// ---------- 分桶（沿用 runtime 校區分桶的省份→檔名編號） ----------
const bucketFileByProvince = Object.fromEntries(Object.entries(campusBucketFileByProvince).map(([province, file]) => [province, file.replace(/^campus-/, 'programs-')]))
const buckets = new Map()
for (const [moeCode, programs] of full) {
  const file = bucketFileByProvince[provinceByCode.get(moeCode)] ?? die(`${moeCode} 省份沒有分桶檔名`)
  ;(buckets.get(file) ?? buckets.set(file, {}).get(file))[moeCode] = programs
}

const schoolsWithPrograms = Object.keys(index).length
const undergraduateSchools = Object.values(index).filter((s) => s.u > 0).length
const undergraduateOfferings = Object.values(index).reduce((n, s) => n + s.u, 0)
const vocationalOfferings = Object.values(index).reduce((n, s) => n + s.v, 0)
if (schoolsWithPrograms !== offeringsMeta.counts.schoolsWithOfferings || undergraduateOfferings + vocationalOfferings !== offeringsMeta.counts.offerings) {
  die(`payload 計數與 program_offerings.2027.all.meta.json 不符：${schoolsWithPrograms} 校／${undergraduateOfferings + vocationalOfferings} 條`)
}

const indexPayload = {
  version: '',
  admissionYear: 2027,
  catalogYear: 2026,
  patterns,
  catalogCodes: catalog.programs.map((p) => p.code),
  provinceSources: Object.fromEntries(Object.entries(PROVINCE_SOURCE).map(([tag, id]) => [tag, { sourceId: id, nameZh: PROVINCE_ZH[tag] }])),
  sources,
  strongBase: strongBase.sort((a, b) => a.moeCode.localeCompare(b.moeCode)),
  schools: Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b))),
}
const bucketEntries = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([file, data]) => [file, JSON.stringify(data)])
const version = createHash('sha256').update(JSON.stringify(catalog)).update(JSON.stringify(indexPayload)).update(bucketEntries.map(([f, t]) => f + t).join('')).digest('hex').slice(0, 12)
catalog.version = version
indexPayload.version = version

rmSync(outDir, { recursive: true, force: true })
mkdirSync(join(outDir, 'schools'), { recursive: true })
writeFileSync(join(outDir, 'catalog.json'), JSON.stringify(catalog))
writeFileSync(join(outDir, 'index.json'), JSON.stringify(indexPayload))
let bucketBytes = 0
for (const [file, text] of bucketEntries) { writeFileSync(join(outDir, 'schools', file), text); bucketBytes += Buffer.byteLength(text) }
const manifest = {
  version,
  catalogPath: '/data/programs/catalog.json',
  indexPath: '/data/programs/index.json',
  bucketsBasePath: '/data/programs/schools',
  bucketFileByProvince,
  admissionYear: 2027,
  catalogYear: 2026,
  counts: {
    disciplines: catalog.disciplines.length,
    classes: catalog.classes.length,
    catalogPrograms: catalog.programs.length,
    patterns: patterns.length,
    schools: schoolsWithPrograms,
    undergraduateSchools,
    undergraduateOfferings,
    vocationalOfferings,
    buckets: bucketEntries.length,
    strongBase: strongBase.length,
    sources: Object.keys(sources).length,
  },
}
writeFileSync(join(root, 'src', 'data', 'programsManifest.ts'),
  `// Generated by scripts/build_programs_layer.mjs. Do not edit by hand.\nexport const programsManifest = ${JSON.stringify(manifest, null, 2)} as const\n`)
const kib = (name) => (readFileSync(join(outDir, name)).length / 1024).toFixed(0)
console.log(`wrote public/data/programs/catalog.json (${kib('catalog.json')} KiB), index.json (${kib('index.json')} KiB), schools/ ${bucketEntries.length} buckets (${(bucketBytes / 1024).toFixed(0)} KiB) version ${version}`)
console.log(JSON.stringify(manifest.counts))
