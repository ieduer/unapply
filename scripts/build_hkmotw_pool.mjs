#!/usr/bin/env node
// S2 後半（批 D3）：港澳臺院校池 → 前端懶載入 payload。
//
//   node scripts/build_hkmotw_pool.mjs     # 讀 data/research/hkmotw_*.csv（取最新日期），寫 public/data/hkmotw/pool.json 與 src/data/hkmotwManifest.ts
//
// 原則（路線圖「對外鏈接規則」）：只收官方來源；每條管道都要有來源 URL、來源網域與機構網域一致、實際連通（httpStatus 200）與核對日；
// status 不是 verified 的機構／管道不進 payload（留在 CSV 供人工覆核，數量寫進 manifest 的 reviewRequired）。
// 這一層不進任何題目與引擎，只是可選池與管道說明；資料結構（機構／管道／條件／來源／有效期）留給 S3 海外學校沿用。

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const researchDir = join(root, 'data', 'research')
const die = (m) => { console.error(`build_hkmotw_pool: ${m}`); process.exit(1) }

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
function latestFile(prefix) {
  const files = readdirSync(researchDir).filter((f) => f.startsWith(prefix) && f.endsWith('.csv')).sort()
  if (!files.length) die(`missing ${prefix}*.csv`)
  return join(researchDir, files[files.length - 1])
}
const SECOND_LEVEL = new Set(['ac', 'edu', 'co', 'com', 'org', 'gov', 'net'])
function registrableDomain(hostname) {
  const parts = hostname.toLowerCase().replace(/\.$/, '').split('.')
  if (parts.length <= 2) return parts.join('.')
  if (parts[parts.length - 1].length === 2 && SECOND_LEVEL.has(parts[parts.length - 2])) return parts.slice(-3).join('.')
  return parts.slice(-2).join('.')
}

const REGION_ZH = { HK: '香港', MO: '澳門', TW: '臺灣' }
const KIND_ZH = { university: '大學', college: '學院', institute: '學院', academy: '學院', joint_admission_committee: '聯合招生委員會' }
const AUDIENCE_ZH = { mainland_gaokao: '內地高考生', hk_macao_students: '港澳學生' }
const CHANNEL_ZH = {
  independent: '獨立招生（直接向院校申請）',
  jee_early_batch: '統招提前批（經省考試院填報志願）',
  jee_volunteer: '統招（經省考試院填報志願）',
  mainland_gaokao: '內地高考招生（管道細節待人工覆核）',
  mainland_students_admitted: '招收內地學生（報名方式待人工覆核）',
  joint_admission_overseas: '海外聯招（聯合分發／各校單獨招生）',
  postgraduate_only: '目前只招碩博士班；學士班未招生',
  unknown: '待人工覆核',
}

const institutionsPath = latestFile('hkmotw_institutions.')
const channelsPath = latestFile('hkmotw_admission_channels.')
const institutionRows = parseCsv(readFileSync(institutionsPath, 'utf8'))
const channelRows = parseCsv(readFileSync(channelsPath, 'utf8'))
const geo = parseCsv(readFileSync(latestFile('gras_institutions_geo.'), 'utf8'))
const atlasIdByNameEn = new Map(geo.map((g) => [g.nameEn, g.univCode]))

const institutions = []; const reviewRequired = { institutions: [], channels: [] }
const ids = new Set()
for (const r of institutionRows) {
  if (!r.id || ids.has(r.id)) die(`機構 id 缺少或重複：${r.id}`)
  ids.add(r.id)
  if (!REGION_ZH[r.region]) die(`${r.id}: 地區 ${r.region} 不認得`)
  if (!KIND_ZH[r.kind]) die(`${r.id}: kind ${r.kind} 不認得`)
  if (!/^https?:\/\//.test(r.website)) die(`${r.id}: website 不是 http(s) 網址`)
  if (!/^https?:\/\//.test(r.listSourceUrl) || !/^\d{4}-\d{2}-\d{2}$/.test(r.listSourceDate)) die(`${r.id}: 名單來源缺網址或日期`)
  if (r.status !== 'verified') { reviewRequired.institutions.push({ id: r.id, nameZh: r.nameZh, region: r.region, reason: r.notes }); continue }
  const atlasId = r.atlasNameEn ? atlasIdByNameEn.get(r.atlasNameEn) : null
  if (r.atlasNameEn && !atlasId) die(`${r.id}: atlasNameEn「${r.atlasNameEn}」在 gras_institutions_geo 找不到`)
  institutions.push({ id: r.id, region: r.region, regionZh: REGION_ZH[r.region], nameZh: r.nameZh, nameEn: r.nameEn, kind: r.kind, kindZh: KIND_ZH[r.kind], website: r.website, listSource: { title: r.listSourceTitle, url: r.listSourceUrl, date: r.listSourceDate }, atlasId: atlasId ?? null, notes: r.notes, channels: [] })
}
const byId = new Map(institutions.map((i) => [i.id, i]))
for (const r of channelRows) {
  if (!ids.has(r.institutionId)) die(`管道列指向不存在的機構 ${r.institutionId}`)
  if (!AUDIENCE_ZH[r.audience]) die(`${r.institutionId}: audience ${r.audience} 不認得`)
  if (!CHANNEL_ZH[r.channel]) die(`${r.institutionId}: channel ${r.channel} 不認得`)
  if (r.status !== 'verified') { reviewRequired.channels.push({ institutionId: r.institutionId, channel: r.channel, reason: r.notes }); continue }
  const inst = byId.get(r.institutionId)
  if (!inst) { reviewRequired.channels.push({ institutionId: r.institutionId, channel: r.channel, reason: '機構本身待覆核' }); continue }
  if (!/^https:\/\//.test(r.sourceUrl)) die(`${r.institutionId}: 來源網址必須是 https`)
  if (registrableDomain(new URL(r.sourceUrl).hostname) !== registrableDomain(new URL(inst.website).hostname)) die(`${r.institutionId}: 來源網域 ${new URL(r.sourceUrl).hostname} 與機構官網 ${new URL(inst.website).hostname} 不一致`)
  if (r.httpStatus !== '200') die(`${r.institutionId}: 來源 HTTP ${r.httpStatus}，未連通不得收`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.verifiedAt) || !/^\d{4}-\d{2}-\d{2}$/.test(r.sourceDate)) die(`${r.institutionId}: 缺核對日`)
  inst.channels.push({ audience: r.audience, audienceZh: AUDIENCE_ZH[r.audience], channel: r.channel, channelZh: CHANNEL_ZH[r.channel], level: r.level, validFor: r.validFor, conditions: { score: r.scoreRequirement, english: r.englishRequirement, tuition: r.tuition, applicationWindow: r.applicationWindow }, source: { title: r.sourceTitle, url: r.sourceUrl, date: r.sourceDate, httpStatus: 200, verifiedAt: r.verifiedAt }, notes: r.notes })
}
const payload = {
  version: '',
  generatedAt: [...institutionRows.map((r) => r.listSourceDate), ...channelRows.map((r) => r.verifiedAt)].filter(Boolean).sort().pop(),
  regions: Object.entries(REGION_ZH).map(([code, nameZh]) => ({ code, nameZh })),
  // 地區順序 HK → MO → TW；地區內保留 CSV 的登記順序（香港：教資會資助八校先列、其後其他院校；澳門：教青局名單順序）。
  institutions: institutions.map((inst, order) => ({ inst, order })).sort((a, b) => Object.keys(REGION_ZH).indexOf(a.inst.region) - Object.keys(REGION_ZH).indexOf(b.inst.region) || a.order - b.order).map(({ inst }) => inst),
  reviewRequired,
  sources: { institutions: institutionsPath.split('/').pop(), channels: channelsPath.split('/').pop() },
}
payload.version = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 12)
const outDir = join(root, 'public', 'data', 'hkmotw')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'pool.json'), JSON.stringify(payload))
const counts = {
  regions: payload.regions.length,
  institutions: institutions.length,
  byRegion: Object.fromEntries(Object.keys(REGION_ZH).map((code) => [code, institutions.filter((i) => i.region === code).length])),
  channels: institutions.reduce((n, i) => n + i.channels.length, 0),
  institutionsWithChannels: institutions.filter((i) => i.channels.length > 0).length,
  linkedToAtlas: institutions.filter((i) => i.atlasId).length,
  reviewRequiredInstitutions: reviewRequired.institutions.length,
  reviewRequiredChannels: reviewRequired.channels.length,
}
const manifest = { version: payload.version, path: '/data/hkmotw/pool.json', generatedAt: payload.generatedAt, counts }
writeFileSync(join(root, 'src', 'data', 'hkmotwManifest.ts'), `// Generated by scripts/build_hkmotw_pool.mjs. Do not edit by hand.\nexport const hkmotwManifest = ${JSON.stringify(manifest, null, 2)} as const\n`)
console.log(`wrote public/data/hkmotw/pool.json (${(Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(0)} KiB) version ${payload.version}`)
console.log(JSON.stringify(counts))
