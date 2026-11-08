// 「參與你這條管道」的官方院校名單（批 G6，主會話裁定 B）：只收官方原檔取得、可解析、釘了 SHA-256 的名單。
//   香港：教育局「2026/27 學年內地高校招收香港中學文憑考試學生計劃 參與院校名單」PDF（165 所；由 extract_hk_dse_participation.mjs 轉成 CSV）。
//   澳門：港澳臺聯招平台「院校信息」按省目錄（批 G8，R2 真實瀏覽器抄錄；只收標「本科生招生」者；頁面未標學年＝平台現行目錄）。
//   臺灣：平台學測專區「招生簡章」按省名單（批 G8，R2 抄錄；學年依 2026-02-26 公告記 2026）。
//   名稱對教育部名單：括號全半形統一後逐字相等 → 教育部舊名 → 站方校區／學部對照（data/research/participation/campus_parent_map.<日期>.csv）；任一對不到就不產出。
// fail-closed：原檔雜湊不符、CSV 行數不符、任一 schoolId 不在教育部 2026 名單，一律不產出。
// 產出：src/data/participationLists.ts（展示層用；不進 AnswerMap、不進 A+ 學習證據、不改大陸剩餘計數）。
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const die = (message) => { console.error(`build_participation_lists: ${message}`); process.exit(1) }

const LISTS = [
  {
    id: 'hk-dse-2026',
    origin: 'hk',
    channel: 'hk-dse-scheme',
    year: '2026/27',
    pdf: 'data/research/participation/edb_hk_dse_scheme_2026_27_list.pdf',
    sha256: 'c8bf73cb50c08307cd3d7fd7f8e5433190904f37478276daf87a7dda34ac92da',
    csv: 'data/research/participation/hk_dse_scheme_2026_27.csv',
    rows: 165,
    url: 'https://www.edb.gov.hk/attachment/tc/edu-system/postsecondary/policy-doc/pilot-scheme/scheme_2026/list.pdf',
    publisher: 'edbHk',
    fetchedAt: '2026-11-08',
  },
  {
    id: 'gatzs-current',
    origin: 'mo',
    channel: 'joint-admission',
    year: 'current',
    names: 'data/research/participation/gatzs_participants.2026-11-08.csv',
    sha256: '62cd937a3a400839307232e60c6b685695e2f7d646065cb36fe535e68d712177',
    rows: 345,
    keep: (r) => r.undergraduate === 'yes',
    kept: 320,
    url: 'https://www.gatzs.com.cn/yxxx/welcome.action',
    publisher: 'gatzs',
    fetchedAt: '2026-11-08',
  },
  {
    id: 'tw-gsat-2026',
    origin: 'tw',
    channel: 'tw-gsat',
    year: '2026',
    names: 'data/research/participation/tw_gsat_participants.2026-11-08.csv',
    sha256: '59ed1eefdcb30e443167c9903f6ed041d780c0c8722ce0a8148589a1aa84c893',
    rows: 450,
    keep: () => true,
    kept: 450,
    url: 'https://www.gatzs.com.cn/xcbm/gatzs/zsjz',
    publisher: 'gatzs',
    fetchedAt: '2026-11-08',
  },
]

const schools = JSON.parse(readFileSync(join(root, 'public/data/runtime/schools.json'), 'utf8'))
const ids = new Set(schools.map((s) => s.id))
const idByMoe = new Map(schools.filter((s) => s.moeCode).map((s) => [`moe:${s.moeCode}`, s.id]))
const norm = (name) => name.replace(/\(/g, '（').replace(/\)/g, '）').trim()
const byName = new Map(schools.filter((s) => s.moeCode).map((s) => [norm(s.nameSimplified ?? s.name), `moe:${s.moeCode}`]))
function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i += 1 } else q = false } else cell += ch }
    else if (ch === '"') q = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [head, ...rest] = rows
  return rest.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((k, i) => [k, r[i] ?? ''])))
}
const former = new Map(parseCsv(readFileSync(join(root, 'data/research/moe_former_names.2026-06-17.csv'), 'utf8')).map((r) => [norm(r.formerName), `moe:${r.moeCode}`]))
const campus = new Map(parseCsv(readFileSync(join(root, 'data/research/participation/campus_parent_map.2026-11-08.csv'), 'utf8')).map((r) => [norm(r.listedName), r.moeId]))
const out = {}
for (const list of LISTS) {
  if (list.names) {
    const text = readFileSync(join(root, list.names))
    const hash = createHash('sha256').update(text).digest('hex')
    if (hash !== list.sha256) die(`${list.id}: CSV sha256 ${hash} != pinned ${list.sha256}`)
    const rows = parseCsv(text.toString('utf8'))
    if (rows.length !== list.rows) die(`${list.id}: ${rows.length} rows != ${list.rows}`)
    const used = rows.filter(list.keep)
    if (used.length !== list.kept) die(`${list.id}: ${used.length} undergraduate rows != ${list.kept}`)
    const via = { exact: 0, former: 0, campus: 0 }
    const schoolIds = new Set()
    for (const r of used) {
      const name = norm(r.institutionNameZh)
      const moeId = byName.get(name) ?? former.get(name) ?? campus.get(name)
      if (!moeId) die(`${list.id}: ${r.province} ${r.institutionNameZh} matches no MOE 2026 school`)
      via[byName.has(name) ? 'exact' : former.has(name) ? 'former' : 'campus'] += 1
      const id = idByMoe.get(moeId)
      if (!id || !ids.has(id)) die(`${list.id}: ${moeId} not in the runtime catalog`)
      schoolIds.add(id)
    }
    out[list.id] = { id: list.id, origin: list.origin, channel: list.channel, year: list.year, count: schoolIds.size, newlyJoined: 0, listed: used.length, matched: via, source: { url: list.url, sha256: list.sha256, publisher: list.publisher, fetchedAt: list.fetchedAt }, schoolIds: [...schoolIds].sort() }
    continue
  }
  const hash = createHash('sha256').update(readFileSync(join(root, list.pdf))).digest('hex')
  if (hash !== list.sha256) die(`${list.id}: PDF sha256 ${hash} != pinned ${list.sha256}`)
  const lines = readFileSync(join(root, list.csv), 'utf8').trim().split('\n')
  const header = lines.shift()
  if (header !== 'province,nameZhHant,nameEn,isNew,schoolId,match') die(`${list.id}: unexpected CSV header`)
  if (lines.length !== list.rows) die(`${list.id}: ${lines.length} rows != ${list.rows}`)
  const schoolIds = []
  for (const line of lines) {
    const cells = []
    let cur = ''; let quoted = false
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i]
      if (quoted) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i += 1 } else if (c === '"') quoted = false; else cur += c }
      else if (c === '"') quoted = true
      else if (c === ',') { cells.push(cur); cur = '' }
      else cur += c
    }
    cells.push(cur)
    const id = cells[4]
    if (!ids.has(id)) die(`${list.id}: schoolId ${id} not in the MOE 2026 catalog`)
    schoolIds.push(id)
  }
  if (new Set(schoolIds).size !== schoolIds.length) die(`${list.id}: duplicate schoolId`)
  out[list.id] = { id: list.id, origin: list.origin, channel: list.channel, year: list.year, count: schoolIds.length, newlyJoined: lines.filter((l) => l.split(',')[3] === '1').length, source: { url: list.url, sha256: list.sha256, publisher: list.publisher, fetchedAt: list.fetchedAt }, schoolIds: [...schoolIds].sort() }
}
const ts = `// Generated by scripts/build_participation_lists.mjs from data/research/participation/. Do not edit by hand.
// 官方「參與院校名單」（展示層）：結果頁對該起點加「參與你這條管道名單」標示與「只看名單內」切換；不改大陸剩餘計數與學習證據。
export interface ParticipationList { id: string; origin: 'hk' | 'mo' | 'tw'; channel: string; year: string; count: number; newlyJoined: number; listed?: number; matched?: { exact: number; former: number; campus: number }; source: { url: string; sha256: string; publisher: string; fetchedAt: string }; schoolIds: readonly string[] }
export const participationLists: Record<string, ParticipationList> = ${JSON.stringify(out, null, 2)}
`
writeFileSync(join(root, 'src/data/participationLists.ts'), ts)
console.log(JSON.stringify(Object.values(out).map((l) => ({ id: l.id, count: l.count, listed: l.listed, matched: l.matched, newlyJoined: l.newlyJoined }))))
