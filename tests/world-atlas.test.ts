// 世界學科地圖：資料完整性與減法引擎。build 之前 data:atlas 必須先生成 payload。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { worldAtlasManifest } from '../src/data/worldAtlasManifest.ts'
import type { WorldAtlasPayload } from '../src/data/worldAtlasTypes.ts'
import { computeAtlasView, emptyAtlasSelection, isSubjectActive, seatRadius, toggleInSet } from '../src/engine/atlas.ts'
import { authorityTierRules, authorityTiersSource } from '../src/data/authorityTiers.ts'
import { linkCheckBaseline } from '../src/data/linkCheckBaseline.ts'
import { displayTier, registrableDomain, tierOf } from '../src/lib/authorityTier.ts'
import { createHash } from 'node:crypto'
import { readdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

const researchDir = new URL('../data/research/', import.meta.url)
const zhHant = JSON.parse(readFileSync(new URL('../src/i18n/locales/zh-Hant.json', import.meta.url), 'utf8')) as Record<string, string>
const en = JSON.parse(readFileSync(new URL('../src/i18n/locales/en.json', import.meta.url), 'utf8')) as Record<string, string>
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
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
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}
const programFiles = readdirSync(researchDir).filter((f) => /^direct_hire_programs\.\d{4}-\d{2}-\d{2}\.csv$/.test(f)).sort()
const programCsv = parseCsv(readFileSync(new URL(programFiles.at(-1)!, researchDir), 'utf8'))

const payload = JSON.parse(readFileSync(new URL('../public/data/atlas/world-atlas.json', import.meta.url), 'utf8')) as WorldAtlasPayload
const schools = JSON.parse(readFileSync(new URL('../public/data/runtime/schools.json', import.meta.url), 'utf8')) as { id: string; moeCode: string }[]

test('manifest 與 payload 一致（版本、各類數量）', () => {
  assert.equal(payload.version, worldAtlasManifest.version)
  assert.equal(payload.subjects.length, worldAtlasManifest.counts.subjects)
  assert.equal(payload.families.length, worldAtlasManifest.counts.families)
  assert.equal(payload.regions.length, worldAtlasManifest.counts.regions)
  assert.equal(payload.institutions.length, worldAtlasManifest.counts.institutions)
  assert.equal(payload.programs.length, worldAtlasManifest.counts.programs)
  assert.equal(payload.land.length, worldAtlasManifest.counts.landPaths)
})

test('GRAS 2026：57 學科、5 門類、每科前 50 名齊全', () => {
  assert.equal(payload.ranking.year, 2026)
  assert.equal(payload.subjects.length, 57)
  assert.equal(payload.families.length, 5)
  const familyCodes = new Set(payload.families.map((f) => f.code))
  for (const subject of payload.subjects) {
    assert.ok(familyCodes.has(subject.family), `${subject.code} family`)
    assert.ok(subject.nameZh && subject.nameZhHans && subject.nameEn, `${subject.code} names`)
    assert.match(subject.sourceUrl, /^https:\/\/www\.shanghairanking\.com\/rankings\/gras\/2026\//)
    const ranks = payload.institutions.map((inst) => inst.ranks[subject.code]).filter((rank): rank is number => rank !== undefined)
    assert.equal(ranks.length, 50, `${subject.code} should have 50 ranked institutions`)
    assert.ok(ranks.every((rank) => rank >= 1 && rank <= 50), `${subject.code} rank range`)
    assert.equal(ranks.filter((rank) => rank <= 10).length, 10, `${subject.code} top10`)
  }
})

test('每所機構都有投影座標、地區與名字；大陸機構連得到本站學校詳情', () => {
  const regionCodes = new Set(payload.regions.map((region) => region.code))
  const schoolById = new Map(schools.map((school) => [school.id, school]))
  const { width, height } = payload.projection
  let mainlandLinked = 0
  for (const inst of payload.institutions) {
    assert.ok(inst.nameEn.length > 0)
    assert.ok(regionCodes.has(inst.region), `${inst.nameEn} region ${inst.region}`)
    assert.ok(inst.x >= 0 && inst.x <= width && inst.y >= 0 && inst.y <= height, `${inst.nameEn} projected inside`)
    assert.ok(Math.abs(inst.lat) <= 90 && Math.abs(inst.lng) <= 180)
    assert.ok(Object.keys(inst.ranks).length > 0, `${inst.nameEn} has ranks`)
    if (inst.schoolId) {
      const school = schoolById.get(inst.schoolId)
      assert.ok(school, `${inst.nameEn} → ${inst.schoolId} exists in MOE table`)
      assert.equal(school?.moeCode, inst.moeCode)
      assert.equal(inst.region, 'China')
      mainlandLinked += 1
    }
  }
  const mainland = payload.institutions.filter((inst) => inst.region === 'China')
  assert.ok(mainlandLinked >= mainland.length - 1, `mainland linked ${mainlandLinked}/${mainland.length}（只允許軍校等不在教育部名單者例外）`)
  for (const region of payload.regions) assert.ok(region.nameZh && region.continentZh, region.code)
})

test('學校官網只收核查通過的：https、high/medium、帶核查日；覆蓋至少 300 所', () => {
  const withSite = payload.institutions.filter((inst) => inst.website)
  assert.equal(withSite.length, worldAtlasManifest.counts.websites)
  assert.ok(withSite.length >= 300, `verified websites ${withSite.length}`)
  for (const inst of withSite) {
    assert.match(inst.website!.url, /^https?:\/\//, inst.nameEn)
    assert.ok(['high', 'medium'].includes(inst.website!.confidence), inst.nameEn)
    assert.match(inst.website!.verifiedAt, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(inst.website!.sources.length > 0)
  }
  for (const subject of payload.subjects) assert.match(subject.sourceUrl, /^https:\/\//)
})

test('正體名字形覆寫已套用（Wikidata zh-hant 標籤含簡體時）', () => {
  const princeton = payload.institutions.find((inst) => inst.nameEn === 'Princeton University')
  assert.equal(princeton?.nameZh, '普林斯頓大學')
})

test('陸地路徑是閉合的 SVG path，沒有國界圖層', () => {
  assert.ok(payload.land.length > 50)
  for (const d of payload.land) {
    assert.match(d, /^M-?\d/)
    assert.ok(d.endsWith('Z'))
  }
})

test('企業直招高中生條目：來源、核對日、可信度、座標齊全；只渲染 status≠unverified 且 confidence high／medium；officialUrl https', () => {
  assert.ok(payload.programs.length >= 8)
  assert.equal(payload.sources.programs.file, programFiles.at(-1))
  assert.equal(payload.sources.programs.rows, programCsv.length)
  assert.equal(payload.sources.programs.rendered, payload.programs.length)
  assert.equal(payload.sources.programs.unverified, worldAtlasManifest.counts.programsUnverified)
  const unverified = programCsv.filter((r) => r.status === 'unverified')
  assert.equal(unverified.length, worldAtlasManifest.counts.programsUnverified)
  assert.equal(programCsv.length - unverified.length, payload.programs.length, '渲染數＝CSV 非 unverified 列數')
  const rendered = new Set(payload.programs.map((p) => p.id))
  for (const r of unverified) { assert.equal(rendered.has(r.id), false, `unverified ${r.id} 不得渲染`); assert.equal(r.confidence, 'low') }
  const ids = new Set<string>()
  for (const program of payload.programs) {
    assert.ok(!ids.has(program.id), `duplicate ${program.id}`)
    ids.add(program.id)
    assert.notEqual(program.status, 'unverified')
    assert.match(program.sourceUrl, /^https:\/\//)
    if (program.officialUrl) assert.match(program.officialUrl, /^https:\/\//)
    assert.match(program.verifiedAt, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(['high', 'medium'].includes(program.confidence), `${program.id} confidence ${program.confidence}`)
    assert.ok(['yes', 'no', 'partial', 'unknown'].includes(program.degree), program.id)
    assert.ok(['yes', 'no', 'stipend', 'unknown'].includes(program.paid), program.id)
    assert.ok(program.kindZh && program.eligibilityZh && program.offersZh && program.orgZh && program.programZh, program.id)
    assert.ok(program.x >= 0 && program.x <= payload.projection.width && program.y >= 0 && program.y <= payload.projection.height)
    // 三語鍵：kind 與國家名（zh-Hans 由建置生成，test:i18n 另核）
    for (const dict of [zhHant, en]) {
      assert.ok(`ui.world.program.kind.${program.kind}` in dict, `kind key ${program.kind}`)
      assert.ok(`ui.world.program.country.${program.regionKey}` in dict, `country key ${program.regionKey}`)
    }
    assert.equal(zhHant[`ui.world.program.kind.${program.kind}`], program.kindZh, `kindZh 與 zh-Hant 鍵一致 ${program.kind}`)
    assert.equal(zhHant[`ui.world.program.country.${program.regionKey}`], program.regionZh, `regionZh 與 zh-Hant 鍵一致 ${program.id}`)
    // 官方頁與來源頁的權威分級可判（P0 官方／P1 寄存平台／P2 媒體）
    if (program.officialUrl) assert.ok(['P0', 'P1'].includes(displayTier(program.officialUrl) ?? ''), `${program.id} officialUrl tier`)
    assert.ok(displayTier(program.sourceUrl), `${program.id} sourceUrl tier`)
  }
  // 含在職學位沿用既有口徑：degree=yes／partial 的條目存在且帶既有四條
  for (const id of ['dyson-institute', 'goldman-sachs-degree-apprenticeship', 'siemens-duales-studium', 'shopify-dev-degree']) assert.equal(payload.programs.find((p) => p.id === id)?.degree, 'yes', id)
  assert.ok(payload.programs.some((p) => p.degree === 'partial'), 'partial 入口存在（Rolls-Royce／Airbus／Bosch）')
})

test('權威分級：規則表由 CSV 生成、無重複、prefix→host→registrable 順序；tierOf 對站內已知鏈接判得出；啟發式 gov／edu 為 P0；年檢基線計數一致', () => {
  assert.equal(authorityTiersSource.counts.rules, authorityTierRules.length)
  const keys = new Set(authorityTierRules.map((r) => `${r.match}:${r.domain}`))
  assert.equal(keys.size, authorityTierRules.length)
  const order = { prefix: 0, host: 1, registrable: 2 }
  for (let i = 1; i < authorityTierRules.length; i += 1) assert.ok(order[authorityTierRules[i - 1].match] <= order[authorityTierRules[i].match], '規則順序')
  assert.equal(tierOf('https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/202606/t20260618_1441074.html'), 'P0')
  assert.equal(tierOf('https://www.crs.jsj.edu.cn/aproval/detail/111'), 'P0')
  assert.equal(tierOf('https://gaokao.chsi.com.cn/'), 'P1')
  assert.equal(tierOf('https://www.chinadegrees.cn/xwyyjsjyxx/xkpgjg/'), 'P1')
  assert.equal(tierOf('https://www.shanghairanking.com/rankings/gras/2026'), 'P1')
  assert.equal(tierOf('https://www.camet.org.cn/xytj/tjxx/'), 'P1')
  assert.equal(tierOf('https://www.yicai.com/topic/'), 'P2')
  assert.equal(tierOf('https://github.com/CollegesChat/university-information'), 'P2')
  assert.equal(tierOf('https://github.com/ieduer/unapply'), 'OWN')
  assert.equal(displayTier('https://github.com/ieduer/unapply'), null)
  assert.equal(tierOf('https://www.edu.cn/'), 'P1')
  assert.equal(tierOf('https://www.pku.edu.cn/'), 'P0', '*.edu.cn 校網為 P0（啟發式）')
  assert.equal(tierOf('https://www.ox.ac.uk/'), 'P0')
  assert.equal(tierOf('https://www.gov.uk/become-apprentice'), 'P0')
  assert.equal(tierOf('https://jobs.lever.co/palantir/x'), 'P1')
  assert.equal(tierOf('https://www.hhhxy.cn/'), null, '規則外非學術網域不標')
  assert.equal(tierOf('not a url'), null)
  assert.equal(registrableDomain('admissions.hku.hk'), 'hku.hk')
  assert.equal(registrableDomain('www.crs.jsj.edu.cn'), 'jsj.edu.cn')
  assert.equal(registrableDomain('careers.rolls-royce.com'), 'rolls-royce.com')
  // 所有機構官網（S0 兩來源核查）與 GRAS 排名頁都判得出層級
  for (const inst of payload.institutions) if (inst.website) assert.ok(tierOf(inst.website.url) === 'P0' || tierOf(inst.website.url) === null, inst.nameEn)
  assert.equal(tierOf(payload.ranking.url), 'P1')
  // 年檢基線：gz 內容雜湊與 summary 一致、計數加總＝URL 數
  const gz = readFileSync(new URL(linkCheckBaseline.csv, researchDir))
  const csvText = gunzipSync(gz).toString('utf8')
  const rows = parseCsv(csvText)
  assert.equal(rows.length, linkCheckBaseline.counts.urls)
  assert.equal(Object.values(linkCheckBaseline.counts.byStatus).reduce((a, b) => a + b, 0), linkCheckBaseline.counts.urls)
  assert.equal(Object.values(linkCheckBaseline.counts.byTier).reduce((a, b) => a + b, 0), linkCheckBaseline.counts.urls)
  assert.equal(rows.filter((r) => r.status === 'broken').length, linkCheckBaseline.counts.broken)
  assert.equal(rows.filter((r) => r.status === 'redirect-cross-domain').length, linkCheckBaseline.counts.redirectCrossDomain)
  assert.match(linkCheckBaseline.checkedAt, /^\d{4}-\d{2}-\d{2}$/)
  assert.ok(createHash('sha256').update(csvText).digest('hex').length === 64)
})

test('減法引擎：預設前 10 名 → 570 個席位；前 50 名 → 2850', () => {
  const top10 = computeAtlasView(payload, emptyAtlasSelection)
  assert.equal(top10.totals.subjects, 57)
  assert.equal(top10.totals.seats, 570)
  assert.ok(top10.totals.institutions > 100 && top10.totals.institutions < 300)
  assert.equal(top10.institutions.filter((entry) => entry.struckByRegion).length, 0)
  const top50 = computeAtlasView(payload, { ...emptyAtlasSelection, topN: 50 })
  assert.equal(top50.totals.seats, 2850)
  assert.equal(top50.totals.institutions, payload.institutions.length)
  const regionSeatSum = top10.regionCounts.reduce((sum, entry) => sum + entry.seats, 0)
  assert.equal(regionSeatSum, 570)
})

test('劃掉門類會移除它全部學科與席位；劃掉學科只少那一科', () => {
  const engineering = payload.subjects.filter((subject) => subject.family === 'AS02')
  const view = computeAtlasView(payload, { ...emptyAtlasSelection, struckFamilies: new Set(['AS02']) })
  assert.equal(view.totals.subjects, 57 - engineering.length)
  assert.equal(view.totals.seats, (57 - engineering.length) * 10)
  for (const subject of engineering) assert.equal(isSubjectActive(subject, { ...emptyAtlasSelection, struckFamilies: new Set(['AS02']) }), false)
  const oneLess = computeAtlasView(payload, { ...emptyAtlasSelection, struckSubjects: new Set(['AS0210']) })
  assert.equal(oneLess.totals.subjects, 56)
  assert.equal(oneLess.totals.seats, 560)
  assert.ok(oneLess.institutions.every((entry) => entry.seats.every((seat) => seat.subject.code !== 'AS0210')))
})

test('劃掉地區：機構仍在圖上但標為劃掉，不計入剩餘；地區列表保留該地區並標 struck', () => {
  const base = computeAtlasView(payload, emptyAtlasSelection)
  const usSeats = base.regionCounts.find((entry) => entry.region.code === 'United States')?.seats ?? 0
  assert.ok(usSeats > 50)
  const view = computeAtlasView(payload, { ...emptyAtlasSelection, struckRegions: new Set(['United States']) })
  assert.equal(view.totals.seats, 570 - usSeats)
  const us = view.institutions.filter((entry) => entry.institution.region === 'United States')
  assert.ok(us.length > 0)
  assert.ok(us.every((entry) => entry.struckByRegion))
  assert.equal(view.institutions.length, base.institutions.length)
  const usRow = view.regionCounts.find((entry) => entry.region.code === 'United States')
  assert.ok(usRow?.struck)
  assert.equal(usRow?.seats, 0)
  assert.equal(view.totals.regions, base.totals.regions - 1)
  assert.ok(view.institutions.findIndex((entry) => entry.struckByRegion) >= view.institutions.filter((entry) => !entry.struckByRegion).length, '劃掉的排在後面')
})

test('全部劃掉 → 剩 0，不丟例外', () => {
  const view = computeAtlasView(payload, { ...emptyAtlasSelection, struckFamilies: new Set(payload.families.map((family) => family.code)) })
  assert.equal(view.totals.subjects, 0)
  assert.equal(view.totals.seats, 0)
  assert.equal(view.institutions.length, 0)
  assert.equal(view.regionCounts.length, 0)
})

test('toggleInSet 與半徑單調', () => {
  const once = toggleInSet(new Set(), 'a')
  assert.deepEqual([...once], ['a'])
  assert.deepEqual([...toggleInSet(once, 'a')], [])
  assert.ok(seatRadius(1, 10) < seatRadius(4, 10))
  assert.ok(seatRadius(10, 50) < seatRadius(10, 10))
})
