// 海外機構「錄取條件原文」（2026-11-08 批 G8，R1 研究：reports/operations/nope-global-roadmap-20261107/r1-overseas/）。
// 只做展示：英語要求（IELTS／TOEFL 最低總分）與國際生本科年學費，連同原句、來源頁與抓取日；覆蓋遠低於 60%，不出題（docs/QUESTION_VALIDITY.md）。
// 規則版本 r1-2026-11-08u；終版抽樣英語 45/45、學費全量 22/22——研究會話寫明這是樣本內準確率，年度重跑須重新抽樣。
// fail-closed：兩檔 SHA-256 與列數、抽取列數、數值、原句、https 來源、規則版本任一不符就不產出。
//   node scripts/build_overseas_requirements.mjs
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const die = (m) => { console.error(`build_overseas_requirements: ${m}`); process.exit(1) }
const FILES = {
  english: { path: 'data/research/overseas_english.2026-11-08.csv', sha256: 'd8a026f77fc7e688f5dd2ed8bf96681d38c42c5242477e51898a7c6032d9cd4d', rows: 403, extracted: 52 },
  tuition: { path: 'data/research/overseas_tuition.2026-11-08.csv', sha256: '773830665d67e994199a2c635047812de856cd9ba0ee0f39316086cec043f518', rows: 403, extracted: 22 },
}
const RULES = 'r1-2026-11-08u'

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
const load = (f) => {
  const buf = readFileSync(join(root, f.path))
  const hash = createHash('sha256').update(buf).digest('hex')
  if (hash !== f.sha256) die(`${f.path} sha256 ${hash} != pinned ${f.sha256}`)
  const rows = parseCsv(buf.toString('utf8'))
  if (rows.length !== f.rows) die(`${f.path}: ${rows.length} rows != ${f.rows}`)
  for (const r of rows) if (r.rulesVersion !== RULES) die(`${f.path}: ${r.institutionId} rules ${r.rulesVersion}`)
  return rows
}
const overseas = JSON.parse(readFileSync(join(root, 'public/data/overseas/index.json'), 'utf8'))
const known = new Set(overseas.institutions.map((i) => i.id))
const num = (v) => (v === '' ? null : Number(v))
const clip = (s, n = 320) => (s.length > n ? `${s.slice(0, n - 1)}…` : s).replace(/ ⏎ /g, ' · ')
const https = (u, id) => { if (!/^https:\/\//.test(u)) die(`${id}: source must be https (${u})`); return u }

const institutions = {}
const english = load(FILES.english).filter((r) => r.englishStatus === 'extracted')
if (english.length !== FILES.english.extracted) die(`english extracted ${english.length} != ${FILES.english.extracted}`)
for (const r of english) {
  if (!known.has(r.institutionId)) die(`english: ${r.institutionId} not in the overseas layer`)
  const ielts = num(r.ieltsOverallMin), toefl = num(r.toeflIbtMin), toeflBand = num(r.toeflIbtBandMin)
  if (ielts === null && toefl === null && toeflBand === null) die(`english: ${r.institutionId} has no value`)
  if (ielts !== null && !(ielts >= 4 && ielts <= 9)) die(`english: ${r.institutionId} IELTS ${ielts}`)
  if (!r.englishQuote) die(`english: ${r.institutionId} has no quote`)
  ;(institutions[r.institutionId] ??= {}).english = { ielts, toefl, toeflBand, scope: r.englishScope, quote: clip(r.englishQuote), quoteToefl: r.englishQuoteToefl ? clip(r.englishQuoteToefl) : null, url: https(r.englishSourceUrl, r.institutionId), fetchedAt: r.fetchedAt.slice(0, 10) }
}
const tuition = load(FILES.tuition).filter((r) => r.tuitionStatus === 'extracted')
if (tuition.length !== FILES.tuition.extracted) die(`tuition extracted ${tuition.length} != ${FILES.tuition.extracted}`)
for (const r of tuition) {
  if (!known.has(r.institutionId)) die(`tuition: ${r.institutionId} not in the overseas layer`)
  const min = num(r.tuitionMin), max = num(r.tuitionMax)
  if (!(min !== null && min >= 0) || (max !== null && max < min)) die(`tuition: ${r.institutionId} amounts ${r.tuitionMin}–${r.tuitionMax}`)
  if (!/^[A-Z]{3}$/.test(r.currency)) die(`tuition: ${r.institutionId} currency ${r.currency}`)
  if (!r.tuitionQuote) die(`tuition: ${r.institutionId} has no quote`)
  ;(institutions[r.institutionId] ??= {}).tuition = { min, max, currency: r.currency, academicYear: r.academicYear || null, basis: r.tuitionBasis, quote: clip(r.tuitionQuote), url: https(r.tuitionSourceUrl, r.institutionId), fetchedAt: r.fetchedAt.slice(0, 10) }
}
const payload = { schema: 'nope.overseas.requirements.v1', rulesVersion: RULES, generatedAt: '2026-11-08', counts: { institutions: Object.keys(institutions).length, english: english.length, tuition: tuition.length, layer: overseas.institutions.length }, sources: Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, { path: f.path, sha256: f.sha256 }])), validation: 'R1 終版：英語抽樣 45/45（另 7 筆逐筆核對）、學費全量 22/22；樣本內準確率，年度重跑須重新抽樣', institutions }
const json = JSON.stringify(payload)
writeFileSync(join(root, 'public/data/overseas/requirements.json'), json + '\n')
const version = createHash('sha256').update(json).digest('hex').slice(0, 12)
writeFileSync(join(root, 'src/data/overseasRequirementsManifest.ts'), `// Generated by scripts/build_overseas_requirements.mjs. Do not edit by hand.\n// 海外機構錄取條件原文（批 G8，R1）：英語要求與國際生年學費，只作展示、不出題。\nexport const overseasRequirementsManifest = ${JSON.stringify({ version, path: '/data/overseas/requirements.json', counts: payload.counts, rulesVersion: RULES }, null, 1)} as const\n`)
console.log(JSON.stringify({ version, ...payload.counts, bytes: json.length }))
