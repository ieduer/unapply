// 港澳臺院校池（批 D3）：payload 完整性、只收官方核查通過的來源、資料形狀可供 S3 沿用。build 之前 data:hkmotw 必須先生成 payload。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { hkmotwManifest } from '../src/data/hkmotwManifest.ts'
import type { HkMoTwPoolPayload } from '../src/data/hkmotwTypes.ts'
import type { WorldAtlasPayload } from '../src/data/worldAtlasTypes.ts'
import { originOptions } from '../src/data/origins.ts'

const payload = JSON.parse(readFileSync(new URL('../public/data/hkmotw/pool.json', import.meta.url), 'utf8')) as HkMoTwPoolPayload
const atlas = JSON.parse(readFileSync(new URL('../public/data/atlas/world-atlas.json', import.meta.url), 'utf8')) as WorldAtlasPayload

const SECOND_LEVEL = new Set(['ac', 'edu', 'co', 'com', 'org', 'gov', 'net'])
const registrableDomain = (hostname: string) => {
  const parts = hostname.toLowerCase().split('.')
  if (parts.length <= 2) return parts.join('.')
  if (parts[parts.length - 1].length === 2 && SECOND_LEVEL.has(parts[parts.length - 2])) return parts.slice(-3).join('.')
  return parts.slice(-2).join('.')
}

test('manifest 與 payload 一致（版本、各類數量）', () => {
  assert.equal(payload.version, hkmotwManifest.version)
  assert.equal(payload.regions.length, hkmotwManifest.counts.regions)
  assert.equal(payload.institutions.length, hkmotwManifest.counts.institutions)
  assert.equal(payload.institutions.reduce((n, i) => n + i.channels.length, 0), hkmotwManifest.counts.channels)
  assert.equal(payload.institutions.filter((i) => i.channels.length > 0).length, hkmotwManifest.counts.institutionsWithChannels)
  assert.equal(payload.institutions.filter((i) => i.atlasId).length, hkmotwManifest.counts.linkedToAtlas)
  assert.equal(payload.reviewRequired.institutions.length, hkmotwManifest.counts.reviewRequiredInstitutions)
  assert.equal(payload.reviewRequired.channels.length, hkmotwManifest.counts.reviewRequiredChannels)
  for (const code of ['HK', 'MO', 'TW'] as const) assert.equal(payload.institutions.filter((i) => i.region === code).length, hkmotwManifest.counts.byRegion[code])
  assert.match(payload.generatedAt, /^\d{4}-\d{2}-\d{2}$/)
})

test('三個地區都有院校；香港至少含八所大學、澳門用官方名單十所、臺灣兩個聯招會', () => {
  assert.deepEqual(payload.regions.map((r) => r.code), ['HK', 'MO', 'TW'])
  assert.ok(hkmotwManifest.counts.byRegion.HK >= 8)
  assert.equal(hkmotwManifest.counts.byRegion.MO, 10)
  assert.equal(hkmotwManifest.counts.byRegion.TW, 2)
  const ids = payload.institutions.map((i) => i.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const inst of payload.institutions) {
    assert.ok(inst.nameZh && inst.nameEn && inst.kindZh && inst.regionZh, inst.id)
    assert.match(inst.website, /^https?:\/\//, inst.id)
    assert.match(inst.listSource.url, /^https?:\/\//, inst.id)
    assert.match(inst.listSource.date, /^\d{4}-\d{2}-\d{2}$/, inst.id)
  }
})

test('每條招生管道：官方來源 https、來源網域與機構官網一致、HTTP 200、帶讀取日與核對日；條件結構可供 S3 沿用', () => {
  let channels = 0
  for (const inst of payload.institutions) {
    const site = registrableDomain(new URL(inst.website).hostname)
    for (const channel of inst.channels) {
      channels += 1
      assert.match(channel.source.url, /^https:\/\//, inst.id)
      assert.equal(registrableDomain(new URL(channel.source.url).hostname), site, `${inst.id} 來源網域`)
      assert.equal(channel.source.httpStatus, 200, inst.id)
      assert.match(channel.source.date, /^\d{4}-\d{2}-\d{2}$/, inst.id)
      assert.match(channel.source.verifiedAt, /^\d{4}-\d{2}-\d{2}$/, inst.id)
      assert.ok(channel.audienceZh && channel.channelZh && channel.level, inst.id)
      assert.ok(['mainland_gaokao', 'hk_macao_students'].includes(channel.audience), inst.id)
      assert.deepEqual(Object.keys(channel.conditions).sort(), ['applicationWindow', 'english', 'score', 'tuition'])
    }
  }
  assert.ok(channels >= 20, String(channels))
})

test('核不過的不上線：待覆核清單帶原因，且不出現在機構／管道裡', () => {
  const live = new Set(payload.institutions.map((i) => i.id))
  for (const row of payload.reviewRequired.institutions) { assert.ok(!live.has(row.id), row.id); assert.ok(row.reason.length > 0, row.id) }
  for (const row of payload.reviewRequired.channels) assert.ok(row.reason.length > 0, row.institutionId)
  // 香港都會大學：研究時對腳本回驗證頁留在待覆核清單；2026-11-08 批 G4 真實瀏覽器覆核讀到 → 上線，管道為獨立招生（原文）。
  const hkmu = payload.institutions.find((i) => i.id === 'hk-hkmu')!
  assert.ok(hkmu && !payload.reviewRequired.institutions.some((r) => r.id === 'hk-hkmu'))
  assert.equal(hkmu.channels[0].channel, 'independent'); assert.match(hkmu.channels[0].notes, /independent enrollment methods/)
  // 港城大：頁面原文為「中国内地高考单独招生」、不參加統招（批 G4 矛盾處理）
  const cityu = payload.institutions.find((i) => i.id === 'hk-cityu')!
  assert.equal(cityu.channels[0].channel, 'mainland_gaokao_separate'); assert.match(cityu.channels[0].channelZh, /不參加統招/)
  assert.match(cityu.channels[0].conditions.tuition, /240,000/); assert.match(cityu.channels[0].conditions.english, /110分或以上/)
})

test('臺灣：陸生聯招會學士班未招生、只有碩博；海外聯招會為港澳學生管道', () => {
  const rusen = payload.institutions.find((i) => i.id === 'tw-rusen')!
  assert.equal(rusen.channels.length, 1)
  assert.equal(rusen.channels[0].channel, 'postgraduate_only')
  assert.match(rusen.channels[0].conditions.score, /學士班目前未招生/)
  assert.match(rusen.channels[0].source.url, /^https:\/\/rusen\.stust\.edu\.tw\//)
  const overseas = payload.institutions.find((i) => i.id === 'tw-overseas')!
  assert.equal(overseas.channels[0].audience, 'hk_macao_students')
  assert.match(overseas.channels[0].source.url, /^https:\/\/cmn-hant\.overseas\.ncnu\.edu\.tw\//)
})

test('與世界學科地圖對得上：atlasId 都在地圖 payload 裡且地區一致', () => {
  const byId = new Map(atlas.institutions.map((i) => [i.id, i]))
  const regionMap: Record<string, string> = { HK: 'China-Hong Kong', MO: 'China-Macau', TW: 'China-Taiwan' }
  for (const inst of payload.institutions) {
    if (!inst.atlasId) continue
    const atlasInst = byId.get(inst.atlasId)
    assert.ok(atlasInst, `${inst.id} atlasId ${inst.atlasId}`)
    assert.equal(atlasInst!.region, regionMap[inst.region], inst.id)
  }
  assert.ok(hkmotwManifest.counts.linkedToAtlas >= 8)
})

test('起點選項：港澳臺三個起點沒有本地題庫（2026-11-08 批 G5 起起點卡不帶提示文字）', () => {
  for (const id of ['hk', 'mo', 'tw']) {
    const option = originOptions.find((o) => o.id === id)!
    assert.equal(option.hasLocalPool, false)
    assert.equal('hint' in option, false)
  }
})
