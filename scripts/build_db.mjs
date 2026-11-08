#!/usr/bin/env node
// 路線圖 S5（批 F2）：全球高校權威資料庫服務化——把站內各資料層組成統一 schema 的只讀、版本化、靜態資料庫。
//
//   node scripts/build_db.mjs            （npm run data:db；build 鏈在 data:i18n 之後、tsc 之前）
//
// 讀：scripts/lib/db_layers.mjs 收集的各層（教育部名單、GRAS、中外合作辦學、港澳臺池、海外層、起點官方頁、S1 專業與選考、A6、企業直招）、
//     data/research/authority_tiers.<日期>.csv（分級）、data/research/db_source_evidence.<日期>.json.gz（研究會話的逐 URL 抓取證據）、
//     data/research/link_check.<日期>.csv.gz（年檢基線）、data/research/db_https_entry.<日期>.json（http 來源的 https 入口核查）。
// 寫：public/db/v1/<version>/{manifest,institutions,crosswalk,channels,conditions.index,sources,validity}.json、public/db/v1/latest.json、src/data/dbManifest.ts。
// 大檔不重複存：S1 招生專業／選考要求、海外層原文片段、合作辦學詳情、港澳臺池、世界地圖以「既有 payload 的 URL＋sha256」列在 manifest.references。
// 決定性：不含建置時間（generatedAt 取輸入資料最晚日期）；version＝各資料集與引用檔 sha256 的雜湊前 12 碼；同輸入重建位元組相同；只保留當前版本目錄。
// fail-closed：任一來源非 https、無分級、id 不合格式、crosswalk 指向不存在的實體、channel／condition 缺 validity、latest.json > 10 KiB、institutions gzip > 500 KiB → 不產出。
// 不改任何既有 payload；不進題目／引擎／AnswerMap／A+ 證據；語言中立（名稱照各層原文）。schema 與使用契約：docs/DB_SCHEMA.md、docs/DB_API.md。
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'
import { NEXT_REVIEW, collectLayers, parseCsv } from './lib/db_layers.mjs'
import { domainOf, hostOf, loadTierRules, makeTierOf, registrableDomain } from './lib/authority_tier.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const rd = join(root, 'data', 'research')
const die = (m) => { console.error(`build_db: ${m}`); process.exit(1) }
const sha = (buf) => createHash('sha256').update(buf).digest('hex')
const latest = (re) => { const f = readdirSync(rd).filter((x) => re.test(x)).sort(); if (!f.length) die(`missing ${re}`); return f.at(-1) }
const SCHEMA_VERSION = 1
const API_BASE = '/db/v1'

const L = collectLayers(root)
const { rules, file: tierFile } = loadTierRules(rd)
const ruleTier = makeTierOf(rules)
const evidenceFile = latest(/^db_source_evidence\.\d{4}-\d{2}-\d{2}\.json\.gz$/)
const researchEvidence = JSON.parse(gunzipSync(readFileSync(join(rd, evidenceFile))).toString('utf8')).evidence
const linkCheckFile = latest(/^link_check\.\d{4}-\d{2}-\d{2}\.csv\.gz$/)
const linkCheck = new Map(parseCsv(gunzipSync(readFileSync(join(rd, linkCheckFile))).toString('utf8')).map((r) => [r.url, r]))
const httpsFile = latest(/^db_https_entry\.\d{4}-\d{2}-\d{2}\.json$/)
const httpsEntry = new Map(JSON.parse(readFileSync(join(rd, httpsFile), 'utf8')).results.map((r) => [r.url, r]))

// ---------- sources ----------
const STATUS_OF_LINKCHECK = { ok: 'verified', 'reused-s0': 'verified', 'reused-s2': 'verified', 'redirect-cross-domain': 'redirected', broken: 'broken', blocked: 'blocked', unreachable: 'unreachable', 'robots-disallow': 'robots_disallow' }
const TIER_OF_KIND = { gov: 'P0', 'public-agency': 'P0', 'exam-board': 'P0', institution: 'P0', company: 'P0', 'official-platform': 'P1', ranking: 'P1' }
const hintsByUrl = new Map()
for (const h of L.sourceHints) { if (!hintsByUrl.has(h.url)) hintsByUrl.set(h.url, []); hintsByUrl.get(h.url).push(h) }
const sourceIdOf = new Map()   // 原記錄網址 → source id（http 改 https 入口時兩者不同）
const sources = []
const excludedInsecure = []
for (const [recordedUrl, hints] of [...hintsByUrl.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
  let url = recordedUrl, httpsNote = null
  if (!/^https:\/\//.test(recordedUrl)) {
    const e = httpsEntry.get(recordedUrl)
    if (e && (e.status === 'https-ok' || e.status === 'https-redirects-to-http')) { url = e.httpsUrl; httpsNote = e.status === 'https-ok' ? `資料層記錄為 ${recordedUrl}；https 入口 ${e.checkedAt.slice(0, 10)} 核查 200` : `資料層記錄為 ${recordedUrl}；https 入口 ${e.checkedAt.slice(0, 10)} 核查可用（站方轉回其 http 頁面）` }
    else { excludedInsecure.push({ url: recordedUrl, families: [...new Set(hints.map((h) => h.ctx.family))] }); continue }
  }
  const own = hints.find((h) => h.evidence)?.evidence || null
  const res = researchEvidence[recordedUrl] || null
  const lc = linkCheck.get(recordedUrl) || null
  let status = 'recorded', http = null, finalUrl = null, sha256 = null, fetchedAt = null, evidence = null
  if (own) { status = own.status || 'verified'; http = own.http ?? null; finalUrl = own.finalUrl ?? null; sha256 = own.sha256 || null; fetchedAt = own.fetchedAt || null; evidence = own.evidence }
  else if (res) { http = res.http ?? null; finalUrl = res.finalUrl || null; sha256 = res.sha256 || null; fetchedAt = res.fetchedAt || null; status = res.status || (res.blocked ? 'blocked' : http === 200 ? 'verified' : http ? 'broken' : 'unreachable'); evidence = `${evidenceFile}（${res.from}）` }
  else if (lc) { status = STATUS_OF_LINKCHECK[lc.status] || lc.status; http = Number(lc.http) || null; finalUrl = lc.finalUrl || null; sha256 = lc.sha256 || null; fetchedAt = lc.fetchedAt || null; evidence = `${linkCheckFile}` }
  if (status === 'ok') status = 'verified'
  if (!fetchedAt) fetchedAt = hints.map((h) => h.ctx.date).filter(Boolean).sort().at(-1) || null
  const t = ruleTier(url)
  let tier = t?.tier || null, tierBy = t ? t.by : null
  if (!tier) {
    const kinds = hints.map((h) => h.ctx.kind)
    if (hints.some((h) => h.ctx.institutionDomain && registrableDomain(hostOf(url)) === domainOf(h.ctx.institutionDomain))) { tier = 'P0'; tierBy = 'context:institution-official-domain' }
    else for (const k of kinds) if (TIER_OF_KIND[k]) { tier = TIER_OF_KIND[k]; tierBy = `context:${k}`; break }
    if (!tier && hints.some((h) => h.ctx.family === 'overseas' && h.ctx.kind === 'institution')) { tier = 'P0'; tierBy = 'context:institution-other-official-domain' }
  }
  if (!tier) die(`no tier for ${url} (${hints.map((h) => h.ctx.family).join(',')})`)
  if (tier === 'OWN') die(`own-site URL used as provenance: ${url}`)
  const siteLive = hints.some((h) => h.ctx.siteLive === true)
  const siteDecided = hints.some((h) => 'siteLive' in h.ctx)
  const linkable = /^https:\/\//.test(url) && status === 'verified' && (siteDecided ? siteLive : true)
  const id = `src:${sha(url).slice(0, 16)}`
  sourceIdOf.set(recordedUrl, id); sourceIdOf.set(url, id)
  const title = hints.map((h) => h.ctx.title).find(Boolean) || null
  sources.push({ id, url, finalUrl, domain: domainOf(url), tier, tierBy, sha256, http, fetchedAt, status, linkable, title, families: [...new Set(hints.map((h) => h.ctx.family))].sort(), ...(httpsNote ? { note: httpsNote } : {}), evidence })
}
sources.sort((a, b) => (a.id < b.id ? -1 : 1))
const sourceById = new Map(sources.map((s) => [s.id, s]))
const sid = (url) => (url ? sourceIdOf.get(url) ?? null : null)

// ---------- institutions ----------
const institutions = L.institutions.map((i) => {
  // 官網分級：規則表／網域型態 → 年檢基線（大陸校網非 edu.cn 網域者，基線已依「第三方彙整來源＋頁面標題是否含校名」判 P0 並標人工覆核）→ GRAS／港澳臺官網（S0／D3 已核）為 P0。
  const t = i.website ? ruleTier(i.website) : null
  const lcw = i.website && !t ? linkCheck.get(i.website) : null
  const websiteTier = i.website ? (t?.tier || (lcw && ['P0', 'P1', 'P2'].includes(lcw.tier) ? lcw.tier : null) || (i.scheme === 'gras' || i.scheme === 'hkmotw' ? 'P0' : null)) : null
  const websiteTierReview = !!(lcw && /人工覆核/.test(lcw.tierReason || ''))
  return {
    id: i.id, scheme: i.scheme, code: i.code, kind: i.kind, name: i.name, region: i.region,
    ...(i.province ? { province: i.province } : {}), ...(i.city ? { city: i.city } : {}),
    ...(i.moeLevel ? { moeLevel: i.moeLevel } : {}), ...(i.level ? { level: i.level } : {}), ...(i.ownership ? { ownership: i.ownership } : {}),
    ...(i.cooperation ? { cooperation: i.cooperation, legalPerson: i.legalPerson, licenseNo: i.licenseNo } : {}),
    ...(i.subjectsTop50 ? { subjectsTop50: i.subjectsTop50 } : {}), ...(i.wikidata ? { wikidata: i.wikidata } : {}),
    website: i.website, websiteTier, ...(websiteTierReview ? { websiteTierReview: true } : {}),
    ...(i.websiteConfidence ? { websiteConfidence: i.websiteConfidence } : {}),
    ...(i.admissionWebsite ? { admissionWebsite: i.admissionWebsite } : {}),
    status: i.status, sourceId: sid(i.sourceUrl), reviewedAt: String(i.reviewedAt).slice(0, 10), siteRoute: i.siteRoute || null,
  }
}).sort((a, b) => (a.id < b.id ? -1 : 1))
const instIds = new Set(institutions.map((i) => i.id))
if (instIds.size !== institutions.length) die('duplicate institution id')
const ID_RE = { moe: /^moe:\d{10}$/, gras: /^gras:R[A-Z]\d{5}$/, crs: /^crs:\d+$/, hkmotw: /^hkmotw:(hk|mo|tw)-[a-z0-9-]+$/ }
for (const i of institutions) if (!ID_RE[i.scheme]?.test(i.id)) die(`institution id format ${i.id}`)
for (const i of institutions) if (!i.sourceId) die(`institution without source ${i.id}`)

// ---------- crosswalk ----------
const pairs = L.crosswalk.map((c) => ({ a: c.a, b: c.b, relation: c.relation, basis: c.basis })).sort((x, y) => (x.a + x.b < y.a + y.b ? -1 : 1))
const INVERSE = { same_institution: 'same_institution', part_of: 'has_part' }
const byId = {}
for (const p of pairs) {
  if (!instIds.has(p.a) || !instIds.has(p.b)) die(`crosswalk endpoint missing ${p.a} ↔ ${p.b}`)
  ;(byId[p.a] ||= []).push({ id: p.b, relation: p.relation })
  ;(byId[p.b] ||= []).push({ id: p.a, relation: INVERSE[p.relation] })
}
for (const k of Object.keys(byId)) byId[k].sort((x, y) => (x.id < y.id ? -1 : 1))
const crosswalkById = Object.fromEntries(Object.keys(byId).sort().map((k) => [k, byId[k]]))

// ---------- channels / conditions / validity ----------
const validity = {}
const addValidity = (id, v, family) => {
  if (validity[id]) die(`duplicate validity id ${id}`)
  if (!NEXT_REVIEW[family]) die(`no review calendar for ${family}`)
  validity[id] = { academicYear: v.academicYear ?? null, validFrom: v.validFrom ?? null, validTo: v.validTo ?? null, fetchedAt: v.fetchedAt ? String(v.fetchedAt) : null, reviewedAt: v.reviewedAt ? String(v.reviewedAt).slice(0, 10) : null, nextReviewDue: NEXT_REVIEW[family], family }
}
const channels = L.channels.map((c) => {
  addValidity(c.id, c.validity, c.family)
  const { validity: _v, sourceUrl, url, officialUrl, family, ...rest } = c
  const sourceId = sid(sourceUrl)
  if (sourceUrl && !sourceId && !excludedInsecure.some((x) => x.url === sourceUrl)) die(`channel ${c.id} source missing ${sourceUrl}`)
  return { ...rest, family, sourceId, officialSourceId: officialUrl ? sid(officialUrl) : undefined }
}).map((c) => (c.officialSourceId === undefined ? (({ officialSourceId, ...r }) => r)(c) : c)).sort((a, b) => (a.id < b.id ? -1 : 1))
const channelIds = new Set(channels.map((c) => c.id))
if (channelIds.size !== channels.length) die('duplicate channel id')
for (const c of channels) if (c.institutionId && !instIds.has(c.institutionId)) die(`channel ${c.id} → missing institution ${c.institutionId}`)
const conditions = L.conditions.map((c) => {
  addValidity(c.id, c.validity, c.family)
  const { validity: _v, sourceUrl, sourceIds, family, ...rest } = c
  const sourceId = sourceUrl ? sid(sourceUrl) : null
  if (sourceUrl && !sourceId) die(`condition ${c.id} source missing ${sourceUrl}`)
  return { ...rest, family, sourceId, ...(sourceIds ? { sourceRefs: sourceIds } : {}) }
}).sort((a, b) => (a.id < b.id ? -1 : 1))
for (const c of conditions) {
  const s = c.subjectId
  if (!(instIds.has(s) || channelIds.has(s) || s.startsWith('region:') || s.startsWith('dataset:'))) die(`condition ${c.id} subject ${s}`)
  if (c.valueRaw == null && !c.valueRawRef && c.valueNorm == null) die(`condition ${c.id} has no value`)
}
const programsIndex = JSON.parse(readFileSync(join(root, 'public/data/programs/index.json'), 'utf8'))
for (const c of conditions) if (c.sourceRefs) for (const r of c.sourceRefs) if (!programsIndex.sources[r]) die(`condition ${c.id} sourceRef ${r}`)

// ---------- references（既有 payload：URL＋sha256，不重複存） ----------
const references = L.refs.map((r) => {
  const p = join(root, 'public', r.path)
  if (!existsSync(p)) die(`reference missing ${r.path}`)
  const buf = readFileSync(p)
  return { name: r.name, path: r.path, sha256: sha(buf), bytes: buf.length, describes: r.describes, entity: r.entity }
}).sort((a, b) => (a.path < b.path ? -1 : 1))
for (const c of conditions) if (c.valueRawRef && !references.some((r) => r.path === c.valueRawRef.path)) die(`condition ${c.id} valueRawRef ${c.valueRawRef.path} not in references`)

// ---------- 寫出 ----------
const datasetBodies = {
  institutions: { schema: 'nope.db.v1.institutions', count: institutions.length, byScheme: Object.fromEntries(['moe', 'gras', 'crs', 'hkmotw'].map((s) => [s, institutions.filter((i) => i.scheme === s).length])), records: institutions },
  crosswalk: { schema: 'nope.db.v1.crosswalk', count: pairs.length, byRelation: Object.fromEntries(['same_institution', 'part_of'].map((r) => [r, pairs.filter((p) => p.relation === r).length])), pairs, byId: crosswalkById },
  channels: { schema: 'nope.db.v1.channels', count: channels.length, byKind: Object.fromEntries([...new Set(channels.map((c) => c.kind))].sort().map((k) => [k, channels.filter((c) => c.kind === k).length])), records: channels },
  'conditions.index': { schema: 'nope.db.v1.conditions-index', count: conditions.length, byType: Object.fromEntries([...new Set(conditions.map((c) => c.type))].sort().map((k) => [k, conditions.filter((c) => c.type === k).length])), records: conditions },
  sources: { schema: 'nope.db.v1.sources', count: sources.length, byTier: Object.fromEntries(['P0', 'P1', 'P2'].map((t) => [t, sources.filter((s) => s.tier === t).length])), byStatus: Object.fromEntries([...new Set(sources.map((s) => s.status))].sort().map((k) => [k, sources.filter((s) => s.status === k).length])), linkable: sources.filter((s) => s.linkable).length, excludedInsecure, records: sources },
  validity: { schema: 'nope.db.v1.validity', count: Object.keys(validity).length, calendar: NEXT_REVIEW, records: Object.fromEntries(Object.keys(validity).sort().map((k) => [k, validity[k]])) },
}
const allDates = [...Object.values(validity).flatMap((v) => [v.reviewedAt, v.fetchedAt ? v.fetchedAt.slice(0, 10) : null]), ...institutions.map((i) => i.reviewedAt)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '')).sort()
const generatedAt = allDates.at(-1)
const serialized = Object.fromEntries(Object.entries(datasetBodies).map(([k, v]) => [k, JSON.stringify({ ...v, generatedAt }) + '\n']))
const datasetMeta = Object.fromEntries(Object.entries(serialized).map(([k, s]) => [k, { file: `${k}.json`, count: datasetBodies[k].count, sha256: sha(s), bytes: Buffer.byteLength(s), gzipBytes: gzipSync(Buffer.from(s), { level: 9 }).length }]))
const version = sha(JSON.stringify({ schemaVersion: SCHEMA_VERSION, datasets: Object.fromEntries(Object.entries(datasetMeta).map(([k, m]) => [k, m.sha256])), references: references.map((r) => [r.path, r.sha256]) })).slice(0, 12)
const base = `${API_BASE}/${version}/`
const manifest = {
  schema: 'nope.db.v1.manifest', schemaVersion: SCHEMA_VERSION, version, generatedAt, base,
  contract: 'https://github.com/ieduer/unapply/blob/master/docs/DB_API.md', schemaDoc: 'https://github.com/ieduer/unapply/blob/master/docs/DB_SCHEMA.md',
  usage: '只讀、公開官方資訊的統一索引；任何欄位都不表示錄取可能或推薦，排名只描述學科分佈。Read-only index of public official information; no field indicates admission chances or a recommendation.',
  entities: ['institution', 'program', 'admission_channel', 'admission_condition', 'source', 'validity'],
  datasets: Object.fromEntries(Object.entries(datasetMeta).map(([k, m]) => [k, { path: `${base}${m.file}`, ...m }])),
  references,
  inputs: { tiers: tierFile, evidence: evidenceFile, linkCheck: linkCheckFile, httpsEntry: httpsFile, ...L.inputs },
  counts: { institutions: institutions.length, crosswalk: pairs.length, channels: channels.length, conditions: conditions.length, sources: sources.length, sourcesLinkable: datasetBodies.sources.linkable, validity: Object.keys(validity).length, references: references.length, referenceBytes: references.reduce((n, r) => n + r.bytes, 0) },
}
const manifestText = JSON.stringify(manifest, null, 1) + '\n'
const latestDoc = {
  schema: 'nope.db.latest.v1', schemaVersion: SCHEMA_VERSION, version, generatedAt, base,
  manifest: { path: `${base}manifest.json`, sha256: sha(manifestText), bytes: Buffer.byteLength(manifestText) },
  datasets: Object.fromEntries(Object.entries(datasetMeta).map(([k, m]) => [k, { path: `${base}${m.file}`, count: m.count, sha256: m.sha256, bytes: m.bytes }])),
  references: { count: references.length, bytes: manifest.counts.referenceBytes },
  contract: manifest.contract,
  usage: manifest.usage,
}
const latestText = JSON.stringify(latestDoc, null, 1) + '\n'
if (Buffer.byteLength(latestText) > 10 * 1024) die(`latest.json ${Buffer.byteLength(latestText)} B > 10 KiB`)
if (datasetMeta.institutions.gzipBytes > 500 * 1024) die(`institutions.json gzip ${datasetMeta.institutions.gzipBytes} B > 500 KiB`)
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
for (const [k, s] of Object.entries(serialized)) if (EMAIL.test(s)) die(`${k}: email-like string`)
for (const s of sources) if (!/^https:\/\//.test(s.url) || !s.tier) die(`source ${s.id} not https or no tier`)
// unsafe 網域（2026-11-08 批 G4：官方網域疑遭劫持）：任何資料集、manifest、latest 都不得出現其網址或網域字樣
if (!L.unsafeDomains.length) die('expected unsafe domain list from db_layers (overseas national portals)')
for (const d of L.unsafeDomains) for (const [k, s] of [...Object.entries(serialized), ['manifest', manifestText], ['latest', latestText]]) if (s.includes(d)) die(`${k}: contains unsafe domain ${d}`)

const outRoot = join(root, 'public', 'db', 'v1')
mkdirSync(join(outRoot, version), { recursive: true })
for (const d of readdirSync(outRoot)) if (/^[0-9a-f]{12}$/.test(d) && d !== version && statSync(join(outRoot, d)).isDirectory()) rmSync(join(outRoot, d), { recursive: true })
for (const [k, s] of Object.entries(serialized)) writeFileSync(join(outRoot, version, `${k}.json`), s)
writeFileSync(join(outRoot, version, 'manifest.json'), manifestText)
writeFileSync(join(outRoot, 'latest.json'), latestText)
const dbManifest = { version, generatedAt, base, latestPath: `${API_BASE}/latest.json`, schemaVersion: SCHEMA_VERSION, counts: manifest.counts, byScheme: datasetBodies.institutions.byScheme, latestBytes: Buffer.byteLength(latestText), institutionsGzipBytes: datasetMeta.institutions.gzipBytes }
writeFileSync(join(root, 'src', 'data', 'dbManifest.ts'), `// Generated by scripts/build_db.mjs. Do not edit by hand.\n// 只讀資料庫 /db/v1（路線圖 S5）：當前版本與計數；契約見 docs/DB_API.md。\nexport const dbManifest = ${JSON.stringify(dbManifest, null, 2)} as const\n`)
console.log(`wrote public/db/v1/${version}/ (${Object.keys(serialized).length} datasets + manifest) and latest.json (${Buffer.byteLength(latestText)} B); institutions gzip ${datasetMeta.institutions.gzipBytes} B`)
console.log(JSON.stringify(manifest.counts))
