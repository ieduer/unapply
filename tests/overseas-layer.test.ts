// 海外可申請學校層（批 S3）：計數與研究 coverage 一致、鏈接上線規則、https 與網域、無電郵、index 體積、兩層一致、manifest 雜湊決定性、不進題目。
// build 之前 data:overseas 必須先生成 payload。
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { gzipSync } from 'node:zlib'
import { overseasManifest } from '../src/data/overseasManifest.ts'
import type { OverseasIndexPayload, OverseasInstitutionDetail, OverseasRegionPayload } from '../src/data/overseasTypes.ts'
import type { WorldAtlasPayload } from '../src/data/worldAtlasTypes.ts'
import { originOptions } from '../src/data/origins.ts'
import { DIMENSIONS } from '../src/data/dimensions.ts'
import { allQuestions } from '../src/data/questions.ts'

const indexText = readFileSync(new URL('../public/data/overseas/index.json', import.meta.url), 'utf8')
const index = JSON.parse(indexText) as OverseasIndexPayload
const regionDir = new URL('../public/data/overseas/regions/', import.meta.url)
const regionFiles = readdirSync(regionDir).filter((f) => f.endsWith('.json')).sort()
const regions = Object.fromEntries(regionFiles.map((f) => [f, JSON.parse(readFileSync(new URL(f, regionDir), 'utf8')) as OverseasRegionPayload]))
const regionList = Object.values(regions)
const atlas = JSON.parse(readFileSync(new URL('../public/data/atlas/world-atlas.json', import.meta.url), 'utf8')) as WorldAtlasPayload
const meta = JSON.parse(readFileSync(new URL('../data/research/overseas_admissions.2026-11-07.meta.json', import.meta.url), 'utf8')) as { counts: Record<string, Record<string, number>> }

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const hostUnder = (url: string, domain: string | null) => {
  if (!domain) return false
  const host = new URL(url).hostname.toLowerCase()
  const d = domain.toLowerCase()
  return host === d || host.endsWith(`.${d}`)
}
const allDetails = (): OverseasInstitutionDetail[] => regionList.flatMap((r) => r.institutions)

// 研究 coverage.md 2026-11-07 的口徑（當時值）：verified 343／needs_review 2／blocked 42／not_found 16；高信心 336、中信心 7；平台 91（verified 63）；簽證 90（verified 47）。
test('計數與研究 coverage 一致：403 所、343／2／42／16、高信心 336、中信心 7；平台 63/91、簽證 47/90；44 個地區', () => {
  const c = overseasManifest.counts
  assert.equal(c.institutions, 403)
  assert.deepEqual(c.byStatus, { verified: 343, needs_review: 2, blocked: 42, not_found: 16 })
  assert.deepEqual(c.byConfidence, { high: 336, medium: 7 })
  assert.equal(c.admissionsLinksLive, 336)
  assert.equal(c.regions, 44)
  assert.deepEqual(c.portals, { total: 91, verified: 63, live: 63 })
  assert.deepEqual(c.visa, { total: 90, verified: 47, live: 47 })
  assert.equal(c.byStatus.verified, c.byConfidence.high + c.byConfidence.medium)
  // meta.json（入庫時寫入）與 manifest 一致
  assert.equal(meta.counts.institutions.verified, c.byStatus.verified)
  assert.equal(meta.counts.institutions.high, c.byConfidence.high)
  assert.equal(meta.counts.portals.verified, c.portals.verified)
  assert.equal(meta.counts.visa.verified, c.visa.verified)
  // payload 本身
  assert.equal(index.institutions.length, c.institutions)
  assert.equal(index.regions.length, c.regions)
  assert.equal(index.institutions.filter((i) => i.status === 'verified').length, c.byStatus.verified)
  assert.equal(index.institutions.filter((i) => i.linkLive).length, c.admissionsLinksLive)
  assert.equal(index.institutions.filter((i) => i.nameZh).length, c.nameZhHant)
  assert.equal(regionList.reduce((n, r) => n + r.portals.length, 0), c.portals.total)
  assert.equal(regionList.reduce((n, r) => n + r.visa.length, 0), c.visa.total)
  assert.match(index.generatedAt, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(index.generatedAt, overseasManifest.generatedAt)
})

test('兩層一致：地區檔每條機構都在 index 且摘要欄位相同；index 每條機構都在對應地區檔；地區列計數對得上', () => {
  const summaryById = new Map(index.institutions.map((i) => [i.id, i]))
  assert.equal(summaryById.size, index.institutions.length, 'id 唯一')
  const seen = new Set<string>()
  for (const [file, region] of Object.entries(regions)) {
    assert.equal(region.version, index.version, file)
    assert.equal(`${region.region.slug}.json`, file)
    const row = index.regions.find((r) => r.slug === region.region.slug)
    assert.ok(row, `${file} 在 index.regions`)
    assert.equal(row!.file, file)
    assert.equal(row!.nameZh, region.region.nameZh)
    assert.equal(region.institutions.length, row!.institutions, `${file} 機構數`)
    assert.equal(region.institutions.filter((i) => i.status === 'verified').length, row!.verified)
    assert.equal(region.institutions.filter((i) => i.linkLive).length, row!.linkLive)
    assert.equal(region.institutions.filter((i) => i.status !== 'verified').length, row!.unread)
    assert.equal(region.portals.length, row!.portals)
    assert.equal(region.portals.filter((p) => p.linkLive).length, row!.portalsLive)
    assert.equal(region.visa.length, row!.visa)
    assert.equal(region.visa.filter((v) => v.linkLive).length, row!.visaLive)
    for (const inst of region.institutions) {
      const s = summaryById.get(inst.id)
      assert.ok(s, `${inst.id} 在 index`)
      assert.equal(s!.region, region.region.code)
      for (const key of ['nameEn', 'nameZh', 'website', 'subjects', 'status', 'confidence', 'linkLive', 'gaokaoPolicy', 'dataAcademicYear', 'fetchedAt'] as const) assert.deepEqual(inst[key], s![key], `${inst.id} ${key}`)
      assert.deepEqual(inst.has, s!.has, `${inst.id} has`)
      assert.ok(!seen.has(inst.id), `${inst.id} 只在一個地區檔`)
      seen.add(inst.id)
    }
  }
  assert.equal(seen.size, index.institutions.length, 'index 每條機構都在某個地區檔')
  assert.equal(regionFiles.length, index.regions.length)
  // 地區按機構數排序
  for (let i = 1; i < index.regions.length; i += 1) assert.ok(index.regions[i - 1].institutions >= index.regions[i].institutions)
})

test('鏈接規則：招生頁只有 verified+high 才 linkLive 且 https；medium 不給 URL 只給網域與說明；其餘寫「官方頁本站未讀到」', () => {
  for (const inst of allDetails()) {
    const a = inst.admissions
    assert.equal(a.linkLive, inst.status === 'verified' && inst.confidence === 'high', inst.id)
    assert.equal(a.linkLive, inst.linkLive, inst.id)
    if (a.linkLive) {
      assert.ok(a.url && /^https:\/\//.test(a.url), `${inst.id} 招生頁 https`)
      assert.ok(!/jsessionid/i.test(a.url!), inst.id)
      const site = new URL(inst.website).hostname
      // 招生頁主機與官網同可註冊網域：取官網主機去掉 www 後的尾段比對
      const base = site.replace(/^www\./, '')
      assert.ok(hostUnder(a.url!, base) || new URL(a.url!).hostname.split('.').slice(-2).join('.') === base.split('.').slice(-2).join('.'), `${inst.id} ${a.url} 不在 ${site} 網域`)
      assert.equal(a.note, undefined)
    } else {
      assert.equal(a.url, undefined, `${inst.id} 非 verified+high 不得有 URL`)
      if (inst.confidence === 'medium') { assert.ok(a.externalDomain && a.note?.includes('另一官方網域'), inst.id); assert.equal(inst.status, 'verified') }
      else { assert.ok(a.note?.startsWith('官方頁本站未讀到'), `${inst.id} ${a.note}`); assert.notEqual(inst.status, 'verified') }
    }
    assert.match(inst.website, /^https?:\/\//)
    // 片段：每段 ≤ 280 字、都有來源；live 的來源必為 https 且機構招生頁上線
    for (const group of [inst.gaokao.quotes, inst.qualifications.quotes, inst.english.quotes, inst.otherLanguage.quotes, inst.tuition.quotes, inst.channels.quotes, inst.timeline.quotes]) {
      for (const q of group) {
        assert.ok(q.text.replace(/^…/, '').replace(/…$/, '').length <= 280, `${inst.id} 片段過長`)
        assert.match(q.url, /^https?:\/\//)
        if (q.live) { assert.ok(inst.linkLive, inst.id); assert.match(q.url, /^https:\/\//) }
      }
    }
    for (const s of inst.sources) { assert.match(s.url, /^https?:\/\//); if (s.live) { assert.ok(inst.linkLive); assert.match(s.url, /^https:\/\//) } }
    // 高考採認：分類有原句才不是 not_stated；頁面標籤齊
    assert.equal(inst.gaokao.quotes.length > 0, inst.gaokaoPolicy !== 'not_stated', inst.id)
    assert.ok(inst.gaokao.policyZh.length > 0)
    assert.equal(inst.has.gaokao, inst.gaokao.quotes.length > 0)
    assert.equal(inst.has.tuition, inst.tuition.quotes.length > 0)
  }
})

test('國家層：平台 verified+high（official-platform 需機構頁佐證）才上鏈接；簽證 verified 才上鏈接；上線鏈接 https 且在記錄網域下；被擋者只留主管機關名與原因', () => {
  for (const region of regionList) {
    for (const p of region.portals) {
      assert.equal(p.linkLive, p.status === 'verified', `${region.region.code} ${p.name}`)
      if (p.linkLive) {
        assert.ok(p.url && /^https:\/\//.test(p.url), p.name)
        assert.ok(hostUnder(p.url!, p.domain), `${p.name} ${p.url} 不在 ${p.domain}`)
        if (p.domainClass === 'official-platform') assert.ok(p.corroborating >= 1, `${p.name} 無機構頁佐證`)
        assert.ok(!/jsessionid/i.test(p.url!))
      } else {
        assert.equal(p.url, undefined, p.name)
        assert.ok(p.statusZh.length > 0 && typeof p.note === 'string', p.name)
      }
      assert.ok(p.typeZh && p.domainClassZh && p.roleLabel, p.name)
      for (const arr of Object.values(p.quotes)) for (const t of arr) assert.ok(t.replace(/^…/, '').replace(/…$/, '').length <= 280)
    }
    for (const v of region.visa) {
      assert.equal(v.linkLive, v.status === 'verified', `${region.region.code} ${v.category}`)
      assert.ok(v.authority.length > 0, v.category)
      if (v.linkLive) { assert.ok(v.url && /^https:\/\//.test(v.url)); assert.ok(hostUnder(v.url!, v.domain), `${v.category} ${v.url}`) } else { assert.equal(v.url, undefined); assert.ok(typeof v.note === 'string') }
      for (const arr of Object.values(v.quotes)) for (const t of arr) assert.ok(t.replace(/^…/, '').replace(/…$/, '').length <= 280)
    }
  }
})

test('不存個人資料：兩層 payload 都沒有電郵樣式、會話字串，也不帶 pageMatchScore', () => {
  for (const text of [indexText, ...regionFiles.map((f) => readFileSync(new URL(f, regionDir), 'utf8'))]) {
    assert.equal(EMAIL.test(text), false)
    assert.equal(/jsessionid|PHPSESSID|sessionid=/i.test(text), false)
    assert.equal(/pageMatchScore/.test(text), false)
  }
})

test('index.json gzip ≤ 200 KiB；地區檔只在進入地區頁時載入', () => {
  const gz = gzipSync(Buffer.from(indexText)).length
  assert.ok(gz <= 200 * 1024, `index gzip ${gz}`)
  assert.equal(gz, overseasManifest.counts.indexGzipBytes)
  assert.equal(overseasManifest.indexPath, '/data/overseas/index.json')
  assert.equal(overseasManifest.regionsBasePath, '/data/overseas/regions')
})

test('manifest 雜湊決定性：版本＝index 與各地區檔（版本留空、slug 序）內容的 SHA-256 前 12 位，不含建置時間', () => {
  const hash = createHash('sha256')
  hash.update(JSON.stringify({ ...index, version: '' }))
  for (const file of regionFiles) hash.update('\n').update(JSON.stringify({ ...regions[file], version: '' }))
  assert.equal(hash.digest('hex').slice(0, 12), overseasManifest.version)
  assert.equal(index.version, overseasManifest.version)
  assert.equal(/generatedAt":"\d{4}-\d{2}-\d{2}"/.test(indexText), true)
  assert.equal(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(indexText.replace(/"crawl":\{[^}]*\}/, '')), false, 'payload 不含時間戳（抓取期間除外）')
})

test('與世界學科地圖對得上：每所機構都是地圖上的非大陸機構，官網與地圖一致，學科數＝地圖席位數', () => {
  const byId = new Map(atlas.institutions.map((i) => [i.id, i]))
  for (const inst of index.institutions) {
    const a = byId.get(inst.id)
    assert.ok(a, `${inst.id} 在地圖`)
    assert.notEqual(a!.region, 'China')
    assert.equal(a!.region, inst.region)
    assert.equal(a!.website?.url, inst.website, `${inst.id} 官網`)
    assert.equal(Object.keys(a!.ranks).length, inst.subjects, `${inst.id} 學科數`)
  }
  assert.equal(index.institutions.length, atlas.institutions.filter((i) => i.region !== 'China').length, '地圖上的非大陸機構全部入層')
})

test('起點選項：其他國家或地區的提示指向海外機構招生頁（S3）；這一層不進題目（45 題不變）', () => {
  const overseas = originOptions.find((o) => o.id === 'overseas')!
  assert.equal(overseas.hasLocalPool, false)
  assert.match(overseas.hint, /海外機構招生頁已上線（S3）/)
  assert.equal(Object.keys(DIMENSIONS).length, 45)
  assert.equal(allQuestions.length, 45)
  assert.ok(!Object.keys(DIMENSIONS).some((k) => /overseas|visa|gaokao/i.test(k)))
})
