// 只讀資料庫 /db/v1（路線圖 S5，批 F2）閘門：manifest 與 latest.json 自洽、資料集與引用檔 sha256 一致、id 格式、crosswalk 雙向一致、
// 每筆 channel／condition 都有 validity、sources 全部 https 且有分級、引用的實體都存在、體積上限、版本雜湊可重算、_headers 只動 /db/*、三語鍵齊全。
// build 之前 data:db 必須先生成 public/db/v1/。
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import test from 'node:test'
import { gzipSync } from 'node:zlib'
import { dbManifest } from '../src/data/dbManifest.ts'

const root = new URL('..', import.meta.url).pathname
const pub = (p: string) => `${root}public${p}`
const read = (p: string) => readFileSync(`${root}${p}`)
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex')
const latestText = readFileSync(pub('/db/v1/latest.json'), 'utf8')
type DatasetMeta = { path: string; count: number; sha256: string; bytes: number; gzipBytes?: number; file?: string }
const latest = JSON.parse(latestText) as { schema: string; schemaVersion: number; version: string; generatedAt: string; base: string; manifest: { path: string; sha256: string; bytes: number }; datasets: Record<string, DatasetMeta>; references: { count: number; bytes: number }; usage: string; contract: string }
const manifestText = readFileSync(pub(latest.manifest.path), 'utf8')
const manifest = JSON.parse(manifestText) as { version: string; base: string; generatedAt: string; schemaVersion: number; datasets: Record<string, DatasetMeta>; references: { name: string; path: string; sha256: string; bytes: number }[]; counts: Record<string, number>; usage: string }
const ds = <T,>(name: string) => JSON.parse(readFileSync(pub(manifest.datasets[name].path), 'utf8')) as T
type Inst = { id: string; scheme: string; code: string; region: string; website: string | null; websiteTier: string | null; sourceId: string | null; name: Record<string, string | null> }
type Channel = { id: string; kind: string; institutionId: string | null; sourceId: string | null; officialSourceId?: string | null }
type Condition = { id: string; subjectId: string; type: string; valueRaw: string | null; valueRawRef?: { path: string }; valueNorm: unknown; sourceId: string | null; status: string }
type Source = { id: string; url: string; tier: string; status: string; linkable: boolean; sha256: string | null; domain: string }
const institutions = ds<{ count: number; records: Inst[] }>('institutions')
const crosswalk = ds<{ count: number; pairs: { a: string; b: string; relation: string }[]; byId: Record<string, { id: string; relation: string }[]> }>('crosswalk')
const channels = ds<{ count: number; records: Channel[] }>('channels')
const conditions = ds<{ count: number; records: Condition[] }>('conditions.index')
const sources = ds<{ count: number; records: Source[]; excludedInsecure: { url: string }[] }>('sources')
const validity = ds<{ count: number; records: Record<string, { academicYear: string | null; validFrom: string | null; validTo: string | null; fetchedAt: string | null; reviewedAt: string | null; nextReviewDue: string; family: string }> }>('validity')

test('latest.json：schema、指向的版本目錄存在且只有這一個版本、manifest sha256 一致、≤10 KiB；src/data/dbManifest.ts 同步', () => {
  assert.equal(latest.schema, 'nope.db.latest.v1')
  assert.equal(latest.schemaVersion, 1)
  assert.match(latest.version, /^[0-9a-f]{12}$/)
  assert.equal(latest.base, `/db/v1/${latest.version}/`)
  assert.ok(Buffer.byteLength(latestText) <= 10 * 1024, `latest.json ${Buffer.byteLength(latestText)} B`)
  assert.ok(statSync(pub(`/db/v1/${latest.version}`)).isDirectory())
  const versions = readdirSync(pub('/db/v1')).filter((d) => /^[0-9a-f]{12}$/.test(d))
  assert.deepEqual(versions, [latest.version], '只保留當前版本目錄')
  assert.equal(sha(manifestText), latest.manifest.sha256)
  assert.equal(Buffer.byteLength(manifestText), latest.manifest.bytes)
  assert.equal(manifest.version, latest.version)
  assert.equal(manifest.generatedAt, latest.generatedAt)
  assert.match(latest.generatedAt, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(dbManifest.version, latest.version)
  assert.equal(dbManifest.latestPath, '/db/v1/latest.json')
  assert.deepEqual(dbManifest.counts, manifest.counts)
  assert.match(latest.usage, /不表示錄取可能/)
  assert.match(latest.contract, /docs\/DB_API\.md$/)
})

test('manifest：六個資料集與 latest 一致、檔案 sha256／位元組相符；84 個引用檔存在且 sha256 一致；版本雜湊可重算', () => {
  assert.deepEqual(Object.keys(manifest.datasets).sort(), ['channels', 'conditions.index', 'crosswalk', 'institutions', 'sources', 'validity'])
  for (const [name, m] of Object.entries(manifest.datasets)) {
    assert.equal(m.path, `${manifest.base}${name}.json`)
    const buf = readFileSync(pub(m.path))
    assert.equal(sha(buf), m.sha256, `${name} sha256`)
    assert.equal(buf.length, m.bytes, `${name} bytes`)
    assert.equal(latest.datasets[name].sha256, m.sha256)
    assert.equal(latest.datasets[name].count, m.count)
    assert.equal(JSON.parse(buf.toString('utf8')).count, m.count)
  }
  assert.equal(manifest.references.length, latest.references.count)
  assert.ok(manifest.references.length >= 80)
  for (const r of manifest.references) {
    assert.match(r.path, /^\/data\//, r.path)
    assert.ok(existsSync(pub(r.path)), `reference ${r.path}`)
    const buf = readFileSync(pub(r.path))
    assert.equal(sha(buf), r.sha256, `reference sha256 ${r.path}`)
    assert.equal(buf.length, r.bytes)
  }
  const recomputed = sha(JSON.stringify({ schemaVersion: manifest.schemaVersion, datasets: Object.fromEntries(Object.entries(manifest.datasets).map(([k, m]) => [k, m.sha256])), references: manifest.references.map((r) => [r.path, r.sha256]) })).slice(0, 12)
  assert.equal(recomputed, manifest.version, '版本＝內容雜湊')
})

test('institution：id 格式、無重複、每筆有來源；四種 scheme 計數；官網都有分級', () => {
  const RE: Record<string, RegExp> = { moe: /^moe:\d{10}$/, gras: /^gras:R[A-Z]\d{5}$/, crs: /^crs:\d+$/, hkmotw: /^hkmotw:(hk|mo|tw)-[a-z0-9-]+$/ }
  const ids = new Set<string>()
  for (const i of institutions.records) {
    assert.ok(RE[i.scheme]?.test(i.id), i.id)
    assert.equal(i.id, `${i.scheme}:${i.code}`)
    assert.ok(!ids.has(i.id), `dup ${i.id}`); ids.add(i.id)
    assert.ok(i.sourceId, `${i.id} sourceId`)
    if (i.website) assert.ok(['P0', 'P1', 'P2'].includes(i.websiteTier ?? ''), `${i.id} websiteTier`)
    assert.ok(Object.values(i.name).some(Boolean), `${i.id} name`)
  }
  const by = (s: string) => institutions.records.filter((i) => i.scheme === s).length
  assert.equal(by('moe'), 2952)
  assert.equal(by('gras'), 544)
  assert.ok(by('crs') >= 400)
  assert.ok(by('hkmotw') >= 27)
  assert.equal(institutions.count, institutions.records.length)
})

test('crosswalk：端點都存在、雙向一致（same_institution 對稱、part_of ↔ has_part）；GRAS↔moe 與教育部主表一致', () => {
  const ids = new Set(institutions.records.map((i) => i.id))
  const inverse: Record<string, string> = { same_institution: 'same_institution', part_of: 'has_part' }
  for (const p of crosswalk.pairs) {
    assert.ok(ids.has(p.a) && ids.has(p.b), `${p.a} ↔ ${p.b}`)
    assert.ok(crosswalk.byId[p.a]?.some((x) => x.id === p.b && x.relation === p.relation), `byId ${p.a} → ${p.b}`)
    assert.ok(crosswalk.byId[p.b]?.some((x) => x.id === p.a && x.relation === inverse[p.relation]), `byId ${p.b} → ${p.a}`)
  }
  const total = Object.values(crosswalk.byId).reduce((n, a) => n + a.length, 0)
  assert.equal(total, crosswalk.pairs.length * 2, 'byId 只由 pairs 展開')
  const grasMoe = crosswalk.pairs.filter((p) => p.a.startsWith('gras:') && p.b.startsWith('moe:'))
  assert.ok(grasMoe.length >= 130, `gras↔moe ${grasMoe.length}`)
  assert.ok(crosswalk.pairs.some((p) => p.a.startsWith('hkmotw:') && p.b.startsWith('gras:')))
  assert.ok(crosswalk.pairs.some((p) => p.a.startsWith('crs:') && p.relation === 'part_of'))
  // 北京大學：GRAS 與教育部同一機構
  assert.ok(crosswalk.byId['moe:4111010001']?.some((x) => x.id === 'gras:RC00002'))
})

test('channel／condition：每筆都有 validity（含 nextReviewDue）；引用的機構、來源、主體都存在；條件至少有原文或指向或正規化值', () => {
  const instIds = new Set(institutions.records.map((i) => i.id))
  const srcIds = new Set(sources.records.map((s) => s.id))
  const chIds = new Set(channels.records.map((c) => c.id))
  assert.equal(validity.count, channels.records.length + conditions.records.length)
  for (const c of channels.records) {
    const v = validity.records[c.id]
    assert.ok(v, `validity ${c.id}`)
    assert.match(v.nextReviewDue, /^\d{4}-\d{2}-\d{2}$/)
    if (c.institutionId) assert.ok(instIds.has(c.institutionId), `${c.id} → ${c.institutionId}`)
    if (c.sourceId) assert.ok(srcIds.has(c.sourceId), `${c.id} source`)
    if (c.officialSourceId) assert.ok(srcIds.has(c.officialSourceId), `${c.id} official source`)
  }
  const refs = new Set(manifest.references.map((r) => r.path))
  for (const c of conditions.records) {
    assert.ok(validity.records[c.id], `validity ${c.id}`)
    assert.ok(instIds.has(c.subjectId) || chIds.has(c.subjectId) || /^(region|dataset):/.test(c.subjectId), `${c.id} subject ${c.subjectId}`)
    if (c.sourceId) assert.ok(srcIds.has(c.sourceId), `${c.id} source`)
    if (c.valueRawRef) assert.ok(refs.has(c.valueRawRef.path), `${c.id} ref ${c.valueRawRef.path}`)
    assert.ok(c.valueRaw != null || c.valueRawRef || c.valueNorm != null, `${c.id} value`)
  }
  for (const [id, v] of Object.entries(validity.records)) {
    for (const k of ['validFrom', 'validTo', 'reviewedAt'] as const) if (v[k]) assert.match(v[k]!, /^\d{4}-\d{2}-\d{2}$/, `${id} ${k}`)
    if (v.validFrom && v.validTo) assert.ok(v.validFrom <= v.validTo, id)
  }
  const kinds = new Set(channels.records.map((c) => c.kind))
  for (const k of ['a6_admission_route', 'hkmotw_channel', 'national_portal', 'joint_program_entry', 'direct_hire']) assert.ok(kinds.has(k), k)
  assert.equal(channels.records.filter((c) => c.kind === 'joint_program_entry').length, 1834)
  assert.equal(channels.records.filter((c) => c.kind === 'national_portal').length, 91)
})

test('source：全部 https、有分級（P0／P1／P2，無 OWN）、id＝網址雜湊、無重複；linkable 只給 verified', () => {
  const ids = new Set<string>()
  for (const s of sources.records) {
    assert.match(s.url, /^https:\/\//, s.url)
    assert.ok(['P0', 'P1', 'P2'].includes(s.tier), `${s.url} tier`)
    assert.equal(s.id, `src:${sha(s.url).slice(0, 16)}`)
    assert.ok(!ids.has(s.id)); ids.add(s.id)
    if (s.linkable) assert.equal(s.status, 'verified', s.url)
    if (s.sha256) assert.match(s.sha256, /^[0-9a-f]{64}$/)
  }
  assert.equal(sources.count, sources.records.length)
  for (const x of sources.excludedInsecure) assert.ok(!/^https:\/\//.test(x.url))
})

test('體積上限：institutions gzip ≤ 500 KiB；latest ≤ 10 KiB；序列化後無電郵字樣', () => {
  const inst = readFileSync(pub(manifest.datasets.institutions.path))
  assert.ok(gzipSync(inst, { level: 9 }).length <= 500 * 1024)
  assert.ok(Buffer.byteLength(latestText) <= 10 * 1024)
  for (const m of Object.values(manifest.datasets)) assert.equal(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(readFileSync(pub(m.path), 'utf8')), false, m.path)
})

test('_headers：只有 /db/* 規則（CORS GET、版本目錄 immutable、latest 300 秒）；不碰 /api/ 與既有資產', () => {
  const h = read('public/_headers').toString('utf8')
  const rules = h.split('\n').filter((l) => l && !l.startsWith('#') && !/^\s/.test(l))
  assert.deepEqual(rules, ['/db/*', '/db/v1/latest.json', '/db/v1/:version/*'])
  assert.match(h, /\/db\/\*\n {2}Access-Control-Allow-Origin: \*\n {2}Access-Control-Allow-Methods: GET/)
  assert.match(h, /\/db\/v1\/latest\.json\n {2}Cache-Control: public, max-age=300/)
  assert.match(h, /\/db\/v1\/:version\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/)
  assert.equal(/\/api\//.test(rules.join('\n')), false)
})

test('三語鍵齊全：About 資料庫段（zh-Hant／en 來源與 zh-Hans 生成檔）', () => {
  const zh = JSON.parse(read('src/i18n/locales/zh-Hant.json').toString('utf8')) as Record<string, string>
  const en = JSON.parse(read('src/i18n/locales/en.json').toString('utf8')) as Record<string, string>
  const hans = JSON.parse(read('public/i18n/zh-Hans.json').toString('utf8')) as Record<string, string>
  for (const k of ['ui.about.db.title', 'ui.about.db.intro', 'ui.about.db.links', 'ui.about.db.rule']) for (const d of [zh, en, hans]) assert.ok(d[k]?.trim(), k)
  // 2026-11-08 批 G5：「不代表錄取可能」全站在 About 只說一次（方法論「不提供志願填報建議」條），資料庫段改寫「不作推薦」
  assert.match(zh['ui.about.db.rule'], /不作推薦/)
  assert.match(zh['ui.about.method.noAdvice'], /不代表錄取可能/)
  const aboutHits = Object.entries(zh).filter(([k, v]) => k.startsWith('ui.about.') && /錄取可能/.test(v)).map(([k]) => k)
  assert.deepEqual(aboutHits, ['ui.about.method.noAdvice'])
  const allHits = Object.entries(zh).filter(([, v]) => /不代表錄取可能/.test(v)).map(([k]) => k).sort()
  // 2026-11-08 批 G6：結果頁那一次移到「下一步」段（ui.result.next.note；跨國並列段已刪）
  assert.deepEqual(allHits, ['ui.about.method.noAdvice', 'ui.result.next.note'])
})
