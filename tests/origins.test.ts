// 起點分支（批 E2；2026-11-08 批 G6 改為資格＋目的地）閘門：資格／目的地不進 AnswerMap 與 learning-manifest；資格 token 全部存在於 S3 資料；過濾只用保留語義、永不減少機構數；
// 官方管道與資格來源只有 verified＋https＋同網域才上鏈接；三語鍵齊；manifest 雜湊可重算。
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { gzipSync } from 'node:zlib'
import { originManifest } from '../src/data/originManifest.ts'
import { originSources } from '../src/data/originSources.ts'
import {
  DESTINATIONS, GAOKAO_TOKEN, LEGACY_ORIGIN_PREFS_STORAGE_KEY, LOCAL_ENTRY_SOURCES, MAINLAND_CHANNELS, MAINLAND_ORIGIN_SOURCES, ORIGIN_PREFS_STORAGE_KEY, QUALIFICATIONS_BY_ORIGIN, QUALIFICATION_OPTIONS,
  SOURCE_ORG_BY_DOMAIN, defaultDestinations, emptyOriginPrefs, isQualification, liveSourceLinks, migrateOriginPrefsV1, normalizeOriginPrefs, originPrefsFor, qualificationTokens, type Qualification,
} from '../src/data/originBranch.ts'
import { originOptions } from '../src/data/origins.ts'
import { DIMENSIONS } from '../src/data/dimensions.ts'
import { allQuestions } from '../src/data/questions.ts'
import { countListed, markInstitution, type QualificationsPayload } from '../src/lib/originLayer.ts'
import { buildUnapplyResultEvidence } from '../src/lib/learningEvidence.ts'
import type { OverseasRegionPayload } from '../src/data/overseasTypes.ts'

const root = new URL('..', import.meta.url).pathname
const read = (p: string) => readFileSync(`${root}/${p}`, 'utf8')
const payloadText = read('public/data/overseas/qualifications.json')
const payload = JSON.parse(payloadText) as QualificationsPayload
const regionDir = `${root}/public/data/overseas/regions/`
const regions = readdirSync(regionDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(regionDir + f, 'utf8')) as OverseasRegionPayload)
const institutions = regions.flatMap((r) => r.institutions)
const zhHant = JSON.parse(read('src/i18n/locales/zh-Hant.json')) as Record<string, string>
const en = JSON.parse(read('src/i18n/locales/en.json')) as Record<string, string>
const zhHans = JSON.parse(read('public/i18n/zh-Hans.json')) as Record<string, string>
const research = JSON.parse(read('data/research/origin_sources.2026-11-07.json')) as { sources: { url: string; status: string; finalUrl: string; domain: string }[] }

test('起點／資格／目的地不進 AnswerMap、DimensionId、learning-manifest 與 A+ 證據', () => {
  assert.equal(ORIGIN_PREFS_STORAGE_KEY, 'unapply.originPrefs.v2')
  assert.equal(LEGACY_ORIGIN_PREFS_STORAGE_KEY, 'unapply.originPrefs.v1')
  assert.equal(Object.keys(DIMENSIONS).length, 45)
  assert.equal(allQuestions.length, 45)
  assert.ok(!Object.keys(DIMENSIONS).some((k) => /^O\d/.test(k)))
  const fn = read('functions/api/learning/[action].ts')
  assert.equal(/originPrefs|qualification|scope|destination/i.test(fn), false, 'Function 不認識起點分支欄位')
  const manifest = JSON.parse(read('public/learning-manifest.json')) as { manifestDigest: string; itemCount: number }
  assert.equal(manifest.manifestDigest, 'sha256:136c786802e02d452210574756f5bef291c120e5edd7beee0c30856826636a99')
  assert.equal(manifest.itemCount, 1)
  const evidence = buildUnapplyResultEvidence({ totalInput: 2952, keptCount: 9, excludedCount: 2943, answeredCount: 8, byQuestion: {} }, 'canary', 'https://nope.bdfz.net/#/result')!
  assert.equal(/qualification|scope|origin|destination/i.test(JSON.stringify(evidence)), false)
  // originBranch 只碰 localStorage，不匯入 bdfzIdentity／trustedAPlus／learningEvidence
  const src = read('src/data/originBranch.ts')
  assert.equal(/bdfzIdentity|trustedAPlus|learningEvidence|i18n\//.test(src), false)
})

test('起點集合不變（5 個）；資格只對非大陸起點；目的地多選至少一個、預設＝起點本地；換起點重設；v1 範圍遷移', () => {
  assert.deepEqual(originOptions.map((o) => o.id), ['cn-mainland', 'hk', 'mo', 'tw', 'overseas'])
  assert.deepEqual([...DESTINATIONS], originOptions.map((o) => o.id))
  assert.deepEqual(QUALIFICATIONS_BY_ORIGIN['cn-mainland'], [])
  assert.equal(QUALIFICATIONS_BY_ORIGIN.hk.length, 3)
  assert.equal(QUALIFICATIONS_BY_ORIGIN.mo.length, 3)
  assert.equal(QUALIFICATIONS_BY_ORIGIN.tw.length, 3)
  assert.equal(QUALIFICATIONS_BY_ORIGIN.overseas.length, 13)
  assert.equal(Object.keys(QUALIFICATION_OPTIONS).length, 18)
  for (const q of Object.keys(QUALIFICATION_OPTIONS)) assert.ok(isQualification(q))
  // 預設＝起點本地；未選起點＝中國大陸
  for (const o of originOptions) assert.deepEqual(defaultDestinations(o.id), [o.id])
  assert.deepEqual(defaultDestinations(null), ['cn-mainland'])
  assert.deepEqual(emptyOriginPrefs, { qualification: null, destinations: ['cn-mainland'] })
  // 換起點：資格清空、目的地回到該起點預設
  for (const o of originOptions) assert.deepEqual(originPrefsFor(o.id), { qualification: null, destinations: [o.id] })
  // 正規化：資格不屬於該起點→null；大陸起點沒有資格；目的地排序去重、去掉無效值、空＝預設
  assert.deepEqual(normalizeOriginPrefs('hk', { qualification: 'uk-alevel', destinations: ['overseas', 'hk', 'hk'] }), { qualification: null, destinations: ['hk', 'overseas'] })
  assert.deepEqual(normalizeOriginPrefs('overseas', { qualification: 'uk-alevel', destinations: [] }), { qualification: 'uk-alevel', destinations: ['overseas'] })
  assert.deepEqual(normalizeOriginPrefs('cn-mainland', { qualification: 'hkdse', destinations: ['mars' as never, 'tw'] }), { qualification: null, destinations: ['tw'] })
  assert.deepEqual(normalizeOriginPrefs(null, { qualification: 'ib', destinations: [] }), emptyOriginPrefs)
  // v1 → v2：local→起點本地；abroad→起點以外全部（海外起點＝海外＋港澳臺）；both→全部；沒有 scope→預設
  assert.deepEqual(migrateOriginPrefsV1('mo', { qualification: null, scope: 'local' }).destinations, ['mo'])
  assert.deepEqual(migrateOriginPrefsV1('hk', { qualification: 'hkdse', scope: 'local' }), { qualification: 'hkdse', destinations: ['hk'] })
  assert.deepEqual(migrateOriginPrefsV1('cn-mainland', { scope: 'abroad' }).destinations, ['hk', 'mo', 'tw', 'overseas'])
  assert.deepEqual(migrateOriginPrefsV1('hk', { scope: 'abroad' }).destinations, ['cn-mainland', 'mo', 'tw', 'overseas'])
  assert.deepEqual(migrateOriginPrefsV1('overseas', { scope: 'abroad' }).destinations, ['hk', 'mo', 'tw', 'overseas'])
  assert.deepEqual(migrateOriginPrefsV1('tw', { scope: 'both' }).destinations, [...DESTINATIONS])
  assert.deepEqual(migrateOriginPrefsV1('tw', { qualification: 'nonsense', scope: 'weird' }), { qualification: null, destinations: ['tw'] })
  assert.deepEqual(migrateOriginPrefsV1(null, null), emptyOriginPrefs)
  // 澳門的 local 不會被帶到香港起點：換起點一律重設（App.setOrigin 用 originPrefsFor）
  const app = read('src/App.tsx')
  assert.ok(/const fresh = originPrefsFor\(next\)/.test(app), 'setOrigin 重設資格與目的地')
  assert.ok(/removeItem\(GLOBAL_STORAGE_KEY\)/.test(app), 'setOrigin 重設全球減法選擇')
})

test('資格 token 全部存在於 S3 資料（qualifications.json 與地區檔），大陸起點以高考 token＋gaokaoPolicy=accepted', () => {
  const listedTokens = new Set(institutions.flatMap((i) => i.qualifications.listed))
  for (const [id, option] of Object.entries(QUALIFICATION_OPTIONS)) {
    for (const token of option.tokens) {
      assert.ok(listedTokens.has(token), `${id}: token ${token} 不在 S3 資料`)
      assert.ok(Array.isArray(payload.tokens[token]) && payload.tokens[token].length > 0, `${id}: token ${token} 不在 qualifications.json`)
    }
  }
  assert.ok(listedTokens.has(GAOKAO_TOKEN))
  assert.deepEqual(qualificationTokens('cn-mainland', emptyOriginPrefs), { tokens: [GAOKAO_TOKEN], gaokao: true })
  assert.deepEqual(qualificationTokens('hk', { qualification: 'hkdse', destinations: ['hk'] }), { tokens: ['HKDSE'], gaokao: false })
  assert.deepEqual(qualificationTokens('hk', emptyOriginPrefs), { tokens: [], gaokao: false })
  assert.deepEqual(payload.gaokaoAccepted, institutions.filter((i) => i.gaokaoPolicy === 'accepted').map((i) => i.id).sort())
  assert.equal(payload.gaokaoAccepted.length, 7) // 2026-11-08 批 G4 瀏覽器覆核後（當時值；G4 前為 4）
  // payload 與地區檔逐 token 一致
  for (const [token, ids] of Object.entries(payload.tokens)) {
    assert.deepEqual(ids, institutions.filter((i) => i.qualifications.listed.includes(token)).map((i) => i.id).sort(), token)
  }
  assert.equal(Object.keys(payload.tokens).length, listedTokens.size)
})

test('過濾只用保留語義：標示永不減少機構數，listed＋unread＝total，未寫明一律未知', () => {
  for (const q of Object.keys(QUALIFICATION_OPTIONS) as Qualification[]) {
    const { tokens } = qualificationTokens('overseas', { qualification: q, destinations: ['overseas'] })
    const marks = institutions.map((i) => markInstitution(i.qualifications.listed, i.gaokaoPolicy, tokens, false))
    assert.equal(marks.length, institutions.length)
    const counts = countListed(payload, tokens, false)
    assert.equal(counts.total, institutions.length)
    assert.equal(counts.listed + counts.unread, counts.total)
    assert.equal(counts.listed, marks.filter((m) => m.listed).length, q)
    if (tokens.length === 0) assert.equal(counts.listed, 0)
    for (const m of marks) assert.ok(m.matched.every((t) => tokens.includes(t)))
  }
  const gaokao = countListed(payload, [GAOKAO_TOKEN], true)
  assert.equal(gaokao.listed, new Set([...(payload.tokens[GAOKAO_TOKEN] ?? []), ...payload.gaokaoAccepted]).size)
  assert.ok(gaokao.listed >= 4)
  // gaokaoPolicy=not_accepted 的機構也只是未標示，不會被劃掉
  const notAccepted = institutions.filter((i) => i.gaokaoPolicy === 'not_accepted')
  assert.ok(notAccepted.length >= 1)
  for (const i of notAccepted) assert.equal(markInstitution(i.qualifications.listed, i.gaokaoPolicy, [GAOKAO_TOKEN], true).gaokao, false)
  // 地區子集計數
  const uk = regions.find((r) => r.region.slug === 'united-kingdom')!
  const ukCounts = countListed(payload, ['A-Level'], false, uk.institutions.map((i) => i.id))
  assert.equal(ukCounts.total, uk.institutions.length)
  assert.equal(ukCounts.listed, uk.institutions.filter((i) => i.qualifications.listed.includes('A-Level')).length)
})

test('官方頁：只有 verified＋https＋同網域才 live；needs_review／blocked 管道不上鏈接；每條資格與管道引用的來源都在清單裡', () => {
  const hostUnder = (url: string, domain: string) => { const h = new URL(url).hostname.toLowerCase(); const d = domain.toLowerCase(); return h === d || h.endsWith(`.${d}`) }
  const byUrl = new Map(research.sources.map((s) => [s.url, s]))
  for (const [url, entry] of Object.entries(originSources)) {
    const r = byUrl.get(url)
    assert.ok(r, `${url} 不在研究子集`)
    assert.equal(entry.status, r!.status)
    assert.equal(entry.live, r!.status === 'verified' && /^https:\/\//.test(url) && hostUnder(r!.finalUrl || url, r!.domain), url)
    assert.match(entry.fetchedAt, /^\d{4}-\d{2}-\d{2}$/)
  }
  assert.equal(Object.keys(originSources).length, originManifest.counts.sources)
  assert.equal(Object.values(originSources).filter((s) => s.live).length, originManifest.counts.sourcesLive)
  for (const option of Object.values(QUALIFICATION_OPTIONS)) for (const url of option.sources) assert.ok(url in originSources, url)
  for (const url of MAINLAND_ORIGIN_SOURCES) assert.ok(url in originSources, url)
  for (const [region, channels] of Object.entries(MAINLAND_CHANNELS)) {
    for (const channel of channels) {
      for (const url of channel.sources) assert.ok(url in originSources, `${region} ${channel.id} ${url}`)
      if (channel.status === 'verified') assert.ok(channel.sources.some((url) => originSources[url].live), `${region} ${channel.id} 至少一個官方頁上線`)
      else assert.equal(channel.sources.filter((url) => originSources[url].live).length, 0, `${region} ${channel.id} needs_review 不上鏈接`)
      assert.ok(`ui.channels.${channel.key}.title` in zhHant && `ui.channels.${channel.key}.summary` in zhHant, channel.key)
    }
  }
  // 政府／官方網域白名單：全部上線鏈接的網域都在這些尾綴下
  const allowed = ['.gov.hk', '.gov.mo', '.gov.cn', '.gov.uk', '.gov.au', '.gov.sg', '.gov.my', '.gov.in', '.govt.nz', '.go.jp', '.go.kr', '.edu.hk', '.edu.mo', '.edu.tw', '.edu.cn', '.edu.au', '.edu.my', '.ac.jp', '.kmk.org', 'gatzs.com.cn', 'ucas.com', 'collegeboard.org', 'act.org', 'commonapp.org', 'uni-assist.de', 'hochschulstart.de', 'daad.de', 'onisep.fr', 'campusfrance.org', 'dongzong.my', 'ontario.ca', 'canada.ca', 'cao.ie', 'nuffic.nl', 'jupas.edu.hk', 'moe.gov.sg', 'chsi.com.cn', '.gouv.fr']
  for (const [url, entry] of Object.entries(originSources)) if (entry.live) assert.ok(allowed.some((suffix) => entry.domain.endsWith(suffix.replace(/^\./, '')) || new URL(url).hostname.endsWith(suffix)), `${url} 網域不在白名單`)
  // 不存個人資料
  assert.equal(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(read('src/data/originSources.ts') + payloadText), false)
})

test('官方頁鏈接文字用乾淨機構名：每個 live 官方頁的網域都有三語名稱；本地入學入口與管道來源都在清單裡', () => {
  for (const entry of Object.values(originSources)) {
    if (!entry.live) continue
    const org = SOURCE_ORG_BY_DOMAIN[entry.domain]
    assert.ok(org, `${entry.domain} 缺乾淨名稱`)
    for (const dict of [zhHant, en, zhHans]) assert.ok(dict[`ui.source.${org}`]?.trim(), `ui.source.${org}`)
  }
  for (const [region, urls] of Object.entries(LOCAL_ENTRY_SOURCES)) {
    for (const url of urls) assert.ok(url in originSources, `${region} ${url}`)
    assert.ok(liveSourceLinks(urls).length > 0, `${region} 本地入學入口至少一個 live`)
  }
  // liveSourceLinks：只留 live、同網域只留第一個
  const sample = [...MAINLAND_ORIGIN_SOURCES]
  const links = liveSourceLinks(sample)
  assert.ok(links.every(({ url }) => originSources[url].live))
  assert.equal(new Set(links.map(({ url }) => originSources[url].domain)).size, links.length)
  assert.equal(links.some(({ url }) => url === 'http://www.moe.gov.cn/'), false, 'http 的教育部首頁不上鏈接')
})

test('使用者可見的選項提示與管道摘要不含內部核查備註（三語）', () => {
  const internal = /被擋|robots|連線重置|连线重置|403|本站未讀到|本站未读到|驗證頁|验证页|JavaScript|核查時|核查时|按規則不上鏈接|blocked|crawl|connection reset|could not be read|did not read/i
  const keys = [
    ...Object.keys(QUALIFICATION_OPTIONS).map((q) => `origin.qual.${q}.hint`),
    ...Object.values(MAINLAND_CHANNELS).flat().map((c) => `ui.channels.${c.key}.summary`),
    'ui.branch.officialInfo', 'ui.branch.destTitle', 'ui.branch.destNote',
  ]
  for (const k of keys) for (const [name, dict] of [['zh-Hant', zhHant], ['en', en], ['zh-Hans', zhHans]] as const) {
    assert.ok(dict[k]?.trim(), `${name} ${k}`)
    assert.equal(internal.test(dict[k]), false, `${name} ${k}: ${dict[k]}`)
  }
  // 「本站未讀到：verified」這類自相矛盾的拼接不再存在
  assert.equal('ui.branch.sourceUnread' in zhHant, false)
  assert.equal(/sourceUnread|statusVerified|statusUnread/.test(read('src/components/OriginBranch.tsx') + read('src/components/MainlandChannels.tsx')), false)
})

test('三語鍵齊：資格、目的地、官方管道、海外層標示、結果頁「下一步」與「你這條管道」', () => {
  const keys: string[] = []
  for (const q of Object.keys(QUALIFICATION_OPTIONS)) keys.push(`origin.qual.${q}.label`, `origin.qual.${q}.hint`)
  for (const d of DESTINATIONS) keys.push(`ui.dest.${d}`)
  keys.push('ui.branch.qualTitle', 'ui.branch.destTitle', 'ui.branch.destNote', 'ui.branch.destLastAria', 'ui.branch.officialInfo', 'ui.branch.skip')
  keys.push('ui.channels.title', 'ui.channels.note')
  keys.push('ui.overseas.qual.listed', 'ui.overseas.qual.listedGaokao', 'ui.overseas.qual.unread', 'ui.overseas.qual.counts', 'ui.overseas.qual.selector', 'ui.overseas.qual.none', 'ui.overseas.qual.gaokaoOption', 'ui.overseas.qual.rule')
  keys.push('ui.result.next.title', 'ui.result.next.note', 'ui.result.next.go', 'ui.result.next.goPool', 'ui.result.next.onlyMainland', 'ui.result.next.addDestinations')
  keys.push('ui.result.route.title', 'ui.result.route.listed', 'ui.result.route.noList', 'ui.result.route.listPdf', 'ui.result.route.listLine', 'ui.result.route.onlyListed', 'ui.result.route.listedEmpty', 'ui.result.route.badge', 'ui.runner.a6.hkmotwNote')
  keys.push('ui.landing.plan.mainland', 'ui.landing.plan.both', 'ui.landing.plan.global', 'ui.landing.plan.pickOrigin', 'ui.landing.browse', 'ui.landing.browse.world', 'ui.landing.browse.hkmotw', 'ui.landing.browse.overseas', 'ui.runner.autoSkipS1')
  for (const k of keys) {
    assert.ok(k in zhHant && k in en && k in zhHans, k)
    assert.ok(zhHant[k].trim() && en[k].trim() && zhHans[k].trim(), k)
  }
  // 舊三套範圍題的鍵已刪
  for (const k of Object.keys(zhHant)) assert.equal(/^origin\.scope\.|^ui\.branch\.scopeTitle\.|^ui\.result\.cross\./.test(k), false, k)
  // 2026-11-08 批 G5：起點卡不帶提示文字，origin.<id>.hint 鍵已刪
  for (const o of originOptions) assert.equal(`origin.${o.id}.hint` in zhHant, false)
})

test('manifest：雜湊可重算、gzip ≤ 20 KiB、與 S3 版本綁定', () => {
  const recomputed = createHash('sha256').update(JSON.stringify({ ...payload, version: '' })).digest('hex').slice(0, 12)
  assert.equal(recomputed, originManifest.version)
  assert.equal(payload.version, originManifest.version)
  assert.equal(payload.overseasVersion, originManifest.overseasVersion)
  assert.equal(payload.institutions, originManifest.counts.institutions)
  assert.equal(originManifest.counts.institutions, 403)
  assert.ok(gzipSync(Buffer.from(payloadText)).length <= 20 * 1024)
  assert.equal(originManifest.path, '/data/overseas/qualifications.json')
  assert.equal(originManifest.counts.institutionsWithTokens, new Set(Object.values(payload.tokens).flat()).size)
})
