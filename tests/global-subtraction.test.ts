// 全球池（批 G2；2026-11-08 批 G6 依目的地重做；批 G6 擴充後題目移到 regionBanks，本檔只鎖「池」）閘門：
// 院校池與海外層去重、目的地歸屬、只選港澳臺或海外時沒有任何大陸院校、本科管道只算學士、陸生聯招會不招本科、
// 招生委員會的相關性、資格標示永不劃掉、與 AnswerMap／DimensionId／learning manifest／Function 無交集、三語鍵齊。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  GLOBAL_DESTINATIONS, HKMOTW_REGION_CODE, LEGACY_GLOBAL_STORAGE_KEYS,
  applicableChannels, audienceForOrigin, buildGlobalPool, poolFor, qualificationMark, relevantTo,
} from '../src/engine/globalFilter.ts'
import type { OverseasIndexPayload } from '../src/data/overseasTypes.ts'
import type { HkMoTwPoolPayload } from '../src/data/hkmotwTypes.ts'
import type { WorldAtlasPayload } from '../src/data/worldAtlasTypes.ts'
import { DIMENSIONS } from '../src/data/dimensions.ts'
import { allQuestions } from '../src/data/questions.ts'
import { buildUnapplyResultEvidence } from '../src/lib/learningEvidence.ts'
import type { QualificationsPayload } from '../src/lib/originLayer.ts'

const root = new URL('..', import.meta.url).pathname
const read = (p: string) => readFileSync(`${root}/${p}`, 'utf8')
const overseas = JSON.parse(read('public/data/overseas/index.json')) as OverseasIndexPayload
const hkmotw = JSON.parse(read('public/data/hkmotw/pool.json')) as HkMoTwPoolPayload
const atlas = JSON.parse(read('public/data/atlas/world-atlas.json')) as WorldAtlasPayload
const quals = JSON.parse(read('public/data/overseas/qualifications.json')) as QualificationsPayload
const items = buildGlobalPool(overseas, hkmotw, atlas)
const all = GLOBAL_DESTINATIONS

test('池：院校池 28＋海外層 403 去重 11 所（atlasId 10＋同地區英文名 1）；目的地由地區決定；海外＝去掉港澳臺三地區', () => {
  assert.equal(hkmotw.institutions.length, 28)
  assert.equal(overseas.institutions.length, 403)
  const twins = items.filter((i) => i.pool === 'hkmotw' && i.overseasId).length
  assert.equal(twins, 11)
  assert.equal(items.find((i) => i.id === 'mo-cityu')?.overseasId, 'RG00015')
  assert.equal(items.length, 28 + 403 - twins)
  assert.equal(new Set(items.map((i) => i.key)).size, items.length)
  for (const item of items) {
    if (item.pool === 'hkmotw') assert.ok(Array.isArray(item.channels))
    else { assert.equal(item.channels, null); assert.equal(item.overseasId, item.id) }
    if (item.destination === 'overseas') assert.ok(!Object.values(HKMOTW_REGION_CODE).includes(item.region), item.key)
    else assert.equal(item.region, HKMOTW_REGION_CODE[item.destination.toUpperCase() as 'HK' | 'MO' | 'TW'], item.key)
  }
  assert.deepEqual(items.filter((i) => i.noUndergrad).map((i) => i.id), ['tw-rusen'])
  assert.deepEqual(items.filter((i) => i.committee).map((i) => i.id).sort(), ['tw-overseas', 'tw-rusen'])
})

test('只選港澳臺或海外：池裡沒有任何中國大陸院校；各目的地池大小', () => {
  for (const d of all) {
    const pool = poolFor(items, [d])
    assert.ok(pool.length > 0, d)
    assert.ok(pool.every((i) => i.destination === d), d)
    assert.equal(pool.some((i) => i.region === 'China'), false)
  }
  assert.equal(poolFor(items, ['hk']).length, 16)
  assert.equal(poolFor(items, ['mo']).length, 10)
  assert.equal(poolFor(items, ['tw']).length, 1 + 4)
  assert.equal(poolFor(items, ['overseas']).length, 388)
  // 起點相關：大陸考生看臺灣不含海外聯招會（只服務港澳學生）；香港考生看臺灣含海外聯招會
  assert.equal(poolFor(items, ['tw'], 'cn-mainland').length, 4)
  assert.ok(poolFor(items, ['tw'], 'hk').some((i) => i.id === 'tw-overseas'))
})

test('本科管道只算學士：只開副學位（聖方濟各大學）或只招碩博（陸生聯招會）都不是適用的本科管道；香港考生看不到內地生管道', () => {
  const sfu = items.find((i) => i.id === 'hk-sfu')!
  assert.deepEqual(applicableChannels(sfu, 'cn-mainland'), [])
  assert.equal(sfu.noUndergrad, false) // 副學位不是「官方不招本科」，只是沒有記錄學士管道
  const rusen = items.find((i) => i.id === 'tw-rusen')!
  assert.deepEqual(applicableChannels(rusen, 'cn-mainland'), [])
  for (const item of poolFor(items, ['hk'])) assert.deepEqual(applicableChannels(item, 'hk'), [], item.key)
  assert.equal(audienceForOrigin('hk'), 'hk_macao_students')
  for (const origin of ['tw', 'overseas', null] as const) assert.equal(audienceForOrigin(origin), null)
  assert.equal(applicableChannels(items.find((i) => i.pool === 'overseas')!, 'cn-mainland'), null)
  assert.equal(relevantTo(items.find((i) => i.id === 'tw-overseas')!, 'cn-mainland'), false)
  assert.equal(relevantTo(items.find((i) => i.id === 'tw-overseas')!, 'tw'), true)
})

test('資格永不劃掉：只有 listed／unread／na；院校池與海外層重複的那所用海外層的招生頁標示', () => {
  const hits = new Set<string>(quals.tokens['A-Level'] ?? [])
  const marks = items.map((i) => qualificationMark(i, hits))
  assert.ok(marks.includes('listed') && marks.includes('unread') && marks.includes('na'))
  for (const item of items) {
    const m = qualificationMark(item, hits)
    if (!item.overseasId) assert.equal(m, 'na')
    else if (m === 'listed') { assert.ok(hits.has(item.overseasId)); assert.equal(item.status, 'verified') }
  }
  assert.equal(qualificationMark(items[0], null), null)
})

test('不進 AnswerMap／DimensionId／learning manifest／Function／A+ 證據；引擎不匯入 i18n 或學習記錄模組', () => {
  assert.deepEqual([...LEGACY_GLOBAL_STORAGE_KEYS], ['unapply.globalSubtraction.v1', 'unapply.globalSubtraction.v2'])
  assert.equal(Object.keys(DIMENSIONS).length, 45)
  assert.equal(allQuestions.length, 45)
  for (const f of ['src/engine/globalFilter.ts', 'src/engine/regionBanks.ts']) {
    const engine = read(f)
    assert.equal(/from '\.\.\/(i18n|lib\/(bdfzIdentity|trustedAPlus|learningEvidence))|from '\.\/filter'|AnswerMap|DimensionId/.test(engine.replace(/^\s*\/\/.*$/gm, '')), false, f)
  }
  const page = read('src/components/GlobalSubtraction.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.equal(/bdfzIdentity|trustedAPlus|learningEvidence|recordUnapply|syncUnapply|AnswerMap/.test(page), false)
  const fn = read('functions/api/learning/[action].ts')
  assert.equal(/globalSubtraction|regionBanks|struckRegions|wantedSubjects|destination|hkFunding/i.test(fn), false)
  const manifest = JSON.parse(read('public/learning-manifest.json')) as { manifestDigest: string; itemCount: number }
  assert.equal(manifest.manifestDigest, 'sha256:136c786802e02d452210574756f5bef291c120e5edd7beee0c30856826636a99')
  assert.equal(manifest.itemCount, 1)
  const evidence = buildUnapplyResultEvidence({ totalInput: 2952, keptCount: 9, excludedCount: 2943, answeredCount: 8, byQuestion: {} }, 'canary', 'https://nope.bdfz.net/#/result')!
  assert.equal(/global|struck|wanted|destination|bank/i.test(JSON.stringify(evidence)), false)
})

test('三語鍵齊全：管道碼、目的地、本地入學、不招本科、逐題流程與結果頁', () => {
  const zhHant = JSON.parse(read('src/i18n/locales/zh-Hant.json')) as Record<string, string>
  const en = JSON.parse(read('src/i18n/locales/en.json')) as Record<string, string>
  const zhHans = JSON.parse(read('public/i18n/zh-Hans.json')) as Record<string, string>
  const channelCodes = [...new Set(hkmotw.institutions.flatMap((i) => i.channels.map((c) => c.channel)))]
  const keys = [
    ...channelCodes.map((c) => `ui.global.channel.${c}`),
    ...all.map((d) => `ui.dest.${d}`),
    ...['hk', 'mo', 'tw'].map((d) => `ui.global.localEntry.line.${d}`),
    'ui.global.item.admissions.nonLocal', 'ui.global.item.admissions.nonLocalUnread', 'ui.branch.destKeepOne',
    'ui.global.counts', 'ui.global.share.note', 'ui.global.footer.rule', 'ui.global.dest.title', 'ui.global.dest.note', 'ui.global.dest.fallback',
    'ui.global.noUndergrad.title', 'ui.global.noUndergrad.note', 'ui.global.noUndergrad.source', 'ui.global.item.channels', 'ui.global.item.channelsNone',
    'ui.global.backToMainland', 'ui.global.doMainland', 'ui.global.noOrigin', 'ui.global.kept.emptyPool', 'ui.about.roadmap.global',
    'ui.global.step.progress', 'ui.global.step.prev', 'ui.global.step.back', 'ui.global.step.next', 'ui.global.step.results', 'ui.global.step.skip', 'ui.global.step.remaining',
    'ui.global.result.title', 'ui.global.result.bank', 'ui.global.result.noQuestions', 'ui.global.result.edit', 'ui.global.reason.short',
  ]
  for (const k of keys) for (const [name, dict] of [['zh-Hant', zhHant], ['en', en], ['zh-Hans', zhHans]] as const) assert.ok(dict[k] && dict[k].trim(), `${name} ${k}`)
})

test('批 G6c：本地入學是一句話（鏈接在句中）、頁頭與可見文字不帶版本雜湊、港澳臺卡片的國際招生頁標明非本地生、至少保留一個目的地有提示', () => {
  const zhHant = JSON.parse(read('src/i18n/locales/zh-Hant.json')) as Record<string, string>
  const en = JSON.parse(read('src/i18n/locales/en.json')) as Record<string, string>
  const zhHans = JSON.parse(read('public/i18n/zh-Hans.json')) as Record<string, string>
  for (const dict of [zhHant, en, zhHans]) {
    for (const d of ['hk', 'mo', 'tw']) {
      const line = dict[`ui.global.localEntry.line.${d}`]
      assert.match(line, /<a1>[^<]+<\/a1>/, d)
      assert.doesNotMatch(line, /^[;；，,]/, d)
      assert.match(line, /[。.]$/, d)
    }
    for (const k of Object.keys(dict)) assert.equal(/^ui\.global\.localEntry\.(prefix|hk|mo|tw)(\.more)?$/.test(k), false, k)
    for (const k of ['ui.hkmotw.brand', 'ui.overseas.brand', 'ui.about.db.links']) assert.equal(dict[k].includes('{version}'), false, k)
  }
  const page = read('src/components/GlobalSubtraction.tsx')
  assert.match(page, /const localStudent = item\.destination !== 'overseas' && item\.destination === origin/)
  assert.match(page, /overseas && !localStudent &&/)
  assert.match(page, /destinations\.includes\('overseas'\) && <p[^>]*data-global-qual-note/)
  for (const f of ['src/components/OverseasPage.tsx', 'src/components/HkMoTwPage.tsx']) assert.equal(/brand=\{t\('[^']+', \{ version/.test(read(f)), false, f)
  for (const f of ['src/components/OriginBranch.tsx', 'src/components/GlobalSubtraction.tsx']) assert.match(read(f), /aria-live="polite" data-dest-keep-one=/, f)
})
