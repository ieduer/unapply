#!/usr/bin/env node
// 中外合作辦學資料層 → 前端懶載入 payload（兩層）。
//
//   node scripts/build_joint_layer.mjs     # 讀 data/research/joint_programs.<最新日期>.csv，寫 public/data/joint/{index,items}.json 與 src/data/jointProgramsManifest.ts
//
// index.json：每校機構數／項目數／港澳臺合作數／仍在名單數（結果卡片用）；items.json：逐校完整條目（學校詳情用）＋對不到主表的條目。
// 不進 43＋2 題、不進 AnswerMap、不進 public/data/runtime/。前端 src/lib/jointData.ts 以 manifest 核對版本與數量。

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const researchDir = join(root, 'data', 'research')
const die = (m) => { console.error(`build_joint_layer: ${m}`); process.exit(1) }
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
const files = readdirSync(researchDir).filter((f) => /^joint_programs\.\d{4}-\d{2}-\d{2}\.csv$/.test(f)).sort()
if (!files.length) die('missing data/research/joint_programs.<date>.csv')
const csvPath = join(researchDir, files[files.length - 1])
const date = /(\d{4}-\d{2}-\d{2})/.exec(csvPath)[1]
const rows = parseCsv(readFileSync(csvPath, 'utf8'))
const meta = JSON.parse(readFileSync(csvPath.replace(/\.csv$/, '.meta.json'), 'utf8'))
const { officialSchools } = await import(pathToFileURL(join(root, 'src', 'data', 'officialSchools.ts')).href)
const moeCodes = new Set(officialSchools.map((s) => s.moeCode))

const items = {}; const unmatched = []; const index = {}
const toItem = (r) => {
  if (!['institution', 'project'].includes(r.kind)) die(`${r.id}: kind ${r.kind}`)
  if (!['sino_foreign', 'mainland_hkmotw', 'foreign_independent'].includes(r.cooperationType)) die(`${r.id}: cooperationType ${r.cooperationType}`)
  if (!['listed', 'suspended', 'merged', 'terminated'].includes(r.status)) die(`${r.id}: status ${r.status}`)
  if (!/^https:\/\/www\.crs\.jsj\.edu\.cn\/aproval\/detail\/\d+$/.test(r.sourceUrl)) die(`${r.id}: sourceUrl`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.fetchedAt)) die(`${r.id}: fetchedAt`)
  return { id: Number(r.id), kind: r.kind, coop: r.cooperationType, name: r.name, annotation: r.annotation, status: r.status, foreign: r.foreignPartner, chinese: r.chinesePartner, legalPerson: r.legalPerson, level: r.level, levelLists: r.levelLists, programs: r.programs, enrolmentYears: r.enrolmentYears, enrolmentEndYear: r.enrolmentEndYear ? Number(r.enrolmentEndYear) : null, admissionMode: r.admissionMode, licenseKind: r.licenseKind, licenseNo: r.licenseNo, validUntil: r.validUntil, province: r.province, url: r.sourceUrl, fetchedAt: r.fetchedAt }
}
for (const r of rows) {
  const item = toItem(r)
  if (!r.moeCode) { unmatched.push(item); continue }
  if (!moeCodes.has(r.moeCode)) die(`${r.id}: moeCode ${r.moeCode} 不在教育部主表`)
  ;(items[r.moeCode] ??= []).push(item)
  const e = index[r.moeCode] ??= { i: 0, p: 0, hk: 0, fi: 0, live: 0 }
  if (item.kind === 'institution') e.i += 1; else e.p += 1
  if (item.coop === 'mainland_hkmotw') e.hk += 1
  if (item.coop === 'foreign_independent') e.fi += 1
  if (item.status === 'listed') e.live += 1
}
for (const list of Object.values(items)) list.sort((a, b) => (a.kind === b.kind ? a.id - b.id : a.kind === 'institution' ? -1 : 1))
const source = { title: meta.source.publisher, url: meta.source.homepage, note: meta.source.listUpdatedNote }
const indexPayload = { version: '', generatedAt: date, source, schools: Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b))) }
const itemsPayload = { version: '', items: Object.fromEntries(Object.entries(items).sort(([a], [b]) => a.localeCompare(b))), unmatched: unmatched.sort((a, b) => a.id - b.id) }
const version = createHash('sha256').update(JSON.stringify(indexPayload)).update(JSON.stringify(itemsPayload)).digest('hex').slice(0, 12)
indexPayload.version = version; itemsPayload.version = version
const outDir = join(root, 'public', 'data', 'joint')
rmSync(outDir, { recursive: true, force: true }); mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'index.json'), JSON.stringify(indexPayload))
writeFileSync(join(outDir, 'items.json'), JSON.stringify(itemsPayload))
const matched = rows.filter((r) => r.moeCode).length
const manifest = { version, indexPath: '/data/joint/index.json', itemsPath: '/data/joint/items.json', generatedAt: date, source, counts: { listed: meta.counts.listed, withDetail: rows.length, matched, unmatched: unmatched.length, schools: Object.keys(index).length, institutions: rows.filter((r) => r.kind === 'institution').length, projects: rows.filter((r) => r.kind === 'project').length, mainlandHkMoTw: rows.filter((r) => r.cooperationType === 'mainland_hkmotw').length, foreignIndependent: rows.filter((r) => r.cooperationType === 'foreign_independent').length, live: rows.filter((r) => r.status === 'listed').length } }
writeFileSync(join(root, 'src', 'data', 'jointProgramsManifest.ts'), `// Generated by scripts/build_joint_layer.mjs. Do not edit by hand.\nexport const jointProgramsManifest = ${JSON.stringify(manifest, null, 2)} as const\n`)
const kib = (name) => (readFileSync(join(outDir, name)).length / 1024).toFixed(0)
console.log(`wrote public/data/joint/index.json (${kib('index.json')} KiB), items.json (${kib('items.json')} KiB) version ${version}`)
console.log(JSON.stringify(manifest.counts))
