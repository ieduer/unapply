// 全球池減法（批 G2，路線圖 S4 完成定義）閘門：每題規則、未知值永不劃掉、資格永不劃掉、地區全劃剩 0 且原因可追溯、
// 與 AnswerMap／DimensionId／learning manifest／Function 無交集、分享往返一致且只含選項鍵、三語鍵齊全。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  CHANNEL_AUDIENCES, GLOBAL_POOLS, GLOBAL_QUESTIONS, GLOBAL_STORAGE_KEY, HKMOTW_REGION_CODE,
  audienceForOrigin, buildGlobalPool, computeGlobal, decodeGlobalSelection, defaultPools, emptyGlobalSelection, encodeGlobalSelection,
  globalOptions, normalizeGlobalSelection, qualificationMark, type GlobalPoolItem, type GlobalSelection,
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
const familyOf = new Map(atlas.subjects.map((s) => [s.code, s.family]))
const options = globalOptions(items, GLOBAL_POOLS, atlas)
const sel = (patch: Partial<GlobalSelection> = {}): GlobalSelection => normalizeGlobalSelection({ ...emptyGlobalSelection(), ...patch }, options, familyOf)
const ctx = { familyOf, userAudience: audienceForOrigin('cn-mainland') }

test('池：海外層 403＋港澳臺院校池 28（當時值；2026-11-08 批 G4 香港都會大學上線，前為 27）；地區碼與 GRAS 一致；港澳臺池地區對到海外層同一套地區碼；GRAS 學科只取前 50', () => {
  assert.equal(items.filter((i) => i.pool === 'overseas').length, overseas.institutions.length)
  assert.equal(items.filter((i) => i.pool === 'hkmotw').length, hkmotw.institutions.length)
  assert.equal(overseas.institutions.length, 403)
  assert.equal(hkmotw.institutions.length, 28)
  assert.equal(new Set(items.map((i) => i.key)).size, items.length)
  const overseasRegions = new Set(overseas.regions.map((r) => r.code))
  for (const code of Object.values(HKMOTW_REGION_CODE)) assert.ok(overseasRegions.has(code), code)
  for (const item of items) {
    if (item.subjects) for (const s of item.subjects) assert.ok(familyOf.has(s), `${item.key} ${s}`)
    if (item.pool === 'overseas') { assert.ok(item.subjects && item.subjects.length > 0, item.key); assert.equal(item.audiences, null) }
    else assert.ok(Array.isArray(item.audiences))
  }
  // 港澳臺池：對到 GRAS 的 10 所有學科，其餘 GRAS 無資料（未知）
  assert.equal(items.filter((i) => i.pool === 'hkmotw' && i.subjects).length, hkmotw.institutions.filter((i) => i.atlasId).length)
  // 跳過全部題目：一所都不劃
  const none = computeGlobal(items, sel(), ctx)
  assert.equal(none.counts.crossed, 0)
  assert.equal(none.counts.kept, items.length)
  assert.equal(none.counts.pool, 431)
})

test('(a) 地區：劃掉的地區全部機構劃掉、原因帶該校地區碼；兩個池同時作用；地區全劃則剩 0 且每所都有原因', () => {
  const r = computeGlobal(items, sel({ struckRegions: ['United Kingdom', 'China-Hong Kong'] }), ctx)
  for (const c of r.crossed) {
    assert.ok(['United Kingdom', 'China-Hong Kong'].includes(c.item.region))
    assert.deepEqual(c.reasons, [{ question: 'regions', rule: 'region_struck', region: c.item.region }])
  }
  assert.equal(r.counts.crossed, items.filter((i) => ['United Kingdom', 'China-Hong Kong'].includes(i.region)).length)
  assert.ok(r.crossed.some((c) => c.item.pool === 'hkmotw') && r.crossed.some((c) => c.item.pool === 'overseas'))
  for (const k of r.kept) assert.ok(!['United Kingdom', 'China-Hong Kong'].includes(k.item.region))
  const all = computeGlobal(items, sel({ struckRegions: [...options.regions] }), ctx)
  assert.equal(all.counts.kept, 0)
  assert.equal(all.counts.crossed, items.length)
  for (const c of all.crossed) assert.ok(c.reasons.length > 0 && c.reasons.every((x) => x.question === 'regions' && x.region === c.item.region), c.item.key)
  assert.equal(all.counts.byQuestion.regions, items.length)
})

test('(b1) 門類：只有所有前 50 學科都落在被劃掉的門類才劃掉；GRAS 無資料的保持未知、保留', () => {
  const r = computeGlobal(items, sel({ struckFamilies: ['AS04', 'AS05'] }), ctx)
  for (const c of r.crossed) {
    const reason = c.reasons.find((x) => x.question === 'families')!
    assert.equal(reason.rule, 'all_top50_in_struck_families')
    assert.ok(c.item.subjects && c.item.subjects.every((s) => ['AS04', 'AS05'].includes(familyOf.get(s)!)), c.item.key)
    assert.deepEqual(reason.subjects, [...c.item.subjects!])
  }
  for (const k of r.kept) {
    if (k.item.subjects) assert.ok(k.item.subjects.some((s) => !['AS04', 'AS05'].includes(familyOf.get(s)!)), k.item.key)
    else assert.ok(k.unknown.includes('subjects_no_gras'), k.item.key)
  }
  assert.ok(r.counts.crossed > 0)
  // 五個門類全劃：有 GRAS 資料的全部劃掉，港澳臺池無資料的 17 所保留（未知）
  const all = computeGlobal(items, sel({ struckFamilies: atlas.families.map((f) => f.code) }), ctx)
  assert.equal(all.counts.kept, items.filter((i) => !i.subjects).length)
  assert.ok(all.kept.every((k) => k.item.pool === 'hkmotw' && k.unknown.includes('subjects_no_gras')))
})

test('(b2) 只想讀：機構在所選學科有前 50 席位才保留；GRAS 無資料保留；已劃門類下的學科被正規化移除', () => {
  const r = computeGlobal(items, sel({ wantedSubjects: ['AS0210'] }), ctx)
  for (const k of r.kept) assert.ok(!k.item.subjects || k.item.subjects.includes('AS0210'), k.item.key)
  for (const c of r.crossed) {
    assert.deepEqual(c.reasons.map((x) => x.rule), ['no_top50_in_wanted'])
    assert.ok(c.item.subjects && !c.item.subjects.includes('AS0210'))
  }
  assert.ok(r.counts.kept > 0 && r.counts.crossed > 0)
  const contradictory = sel({ struckFamilies: ['AS02'], wantedSubjects: ['AS0210', 'AS0101'] })
  assert.deepEqual(contradictory.wantedSubjects, ['AS0101'])
})

test('(c) 港澳臺管道：只作用於院校池；已記錄管道全劃且含你這類考生的管道才劃；未記錄或你的管道未入庫＝未知保留', () => {
  const mainland = computeGlobal(items, sel({ struckAudiences: ['mainland_gaokao'] }), { familyOf, userAudience: 'mainland_gaokao' })
  for (const c of mainland.crossed) {
    assert.equal(c.item.pool, 'hkmotw')
    assert.deepEqual(c.reasons, [{ question: 'channels', rule: 'all_recorded_channels_struck', audiences: [...c.item.audiences!] }])
    assert.ok(c.item.audiences!.every((a) => a === 'mainland_gaokao'))
  }
  assert.equal(mainland.counts.crossed, items.filter((i) => i.pool === 'hkmotw' && i.audiences!.length > 0 && i.audiences!.every((a) => a === 'mainland_gaokao')).length)
  assert.ok(mainland.kept.filter((k) => k.item.pool === 'hkmotw' && k.item.audiences!.length === 0).every((k) => k.unknown.includes('channels_none_recorded')))
  // 港澳學生：內地高考生管道不是他的管道 → 劃掉內地高考生管道不影響只錄內地生的院校（未知）
  const hk = computeGlobal(items, sel({ struckAudiences: ['mainland_gaokao'] }), { familyOf, userAudience: 'hk_macao_students' })
  assert.equal(hk.counts.crossed, 0)
  assert.ok(hk.kept.some((k) => k.unknown.includes('channels_own_route_unrecorded')))
  // 港澳學生劃掉自己的管道：只有記錄了港澳學生管道的院校被劃
  const hkOwn = computeGlobal(items, sel({ struckAudiences: ['hk_macao_students'] }), { familyOf, userAudience: 'hk_macao_students' })
  assert.ok(hkOwn.crossed.every((c) => c.item.audiences!.includes('hk_macao_students')))
  // 臺灣／海外起點：你這類考生的管道未入庫 → 永不劃
  for (const origin of ['tw', 'overseas', null] as const) {
    assert.equal(audienceForOrigin(origin), null)
    assert.equal(computeGlobal(items, sel({ struckAudiences: [...CHANNEL_AUDIENCES] }), { familyOf, userAudience: null }).counts.crossed, 0)
  }
  // 海外層永不受管道題影響
  assert.ok(computeGlobal(items, sel({ struckAudiences: [...CHANNEL_AUDIENCES] }), ctx).crossed.every((c) => c.item.pool === 'hkmotw'))
})

test('未知值永不劃掉；「官方頁本站未讀到」不是取值：未讀到的機構只在地區題被劃（地區永遠已知）', () => {
  const unread = items.filter((i) => i.pool === 'overseas' && i.status !== 'verified')
  assert.ok(unread.length > 0)
  const s = sel({ struckFamilies: ['AS01'], wantedSubjects: ['AS0501'], struckAudiences: [...CHANNEL_AUDIENCES] })
  const r = computeGlobal(items, s, ctx)
  for (const c of r.crossed) for (const reason of c.reasons) assert.ok(GLOBAL_QUESTIONS.includes(reason.question))
  // 同一份資料、狀態從 verified 改成 not_found：結果不變（狀態不是劃掉依據）
  const flipped: GlobalPoolItem[] = items.map((i) => (i.pool === 'overseas' ? { ...i, status: 'not_found' as const } : i))
  assert.deepEqual(computeGlobal(flipped, s, ctx).crossed.map((c) => c.item.key), r.crossed.map((c) => c.item.key))
  // 沒有 GRAS 資料：學科兩題都保留
  const noGras = items.filter((i) => !i.subjects)
  const r2 = computeGlobal(noGras, sel({ struckFamilies: atlas.families.map((f) => f.code), wantedSubjects: ['AS0101'] }), ctx)
  assert.equal(r2.counts.crossed, 0)
})

test('資格永不劃掉：標示只有 listed／unread／na，與減法結果無關', () => {
  const hits = new Set<string>(quals.tokens['A-Level'] ?? [])
  assert.ok(hits.size > 0)
  const s = sel({ struckRegions: ['Japan'] })
  const base = computeGlobal(items, s, ctx)
  // computeGlobal 不接受資格參數；標示另算，不改計數
  assert.equal(computeGlobal.length, 3)
  const marks = items.map((i) => qualificationMark(i, hits))
  assert.ok(marks.includes('listed') && marks.includes('unread') && marks.includes('na'))
  for (const item of items) {
    const m = qualificationMark(item, hits)
    if (item.pool === 'hkmotw') assert.equal(m, 'na')
    else if (m === 'listed') { assert.ok(hits.has(item.id)); assert.equal(item.status, 'verified') }
  }
  assert.equal(qualificationMark(items[0], null), null)
  assert.equal(computeGlobal(items, s, ctx).counts.kept, base.counts.kept)
})

test('預設池：港澳臺起點兩者（local＝院校池、abroad＝海外層）、海外起點海外層、大陸或未選兩者', () => {
  assert.deepEqual(defaultPools('hk', null), ['overseas', 'hkmotw'])
  assert.deepEqual(defaultPools('mo', 'both'), ['overseas', 'hkmotw'])
  assert.deepEqual(defaultPools('tw', 'local'), ['hkmotw'])
  assert.deepEqual(defaultPools('hk', 'abroad'), ['overseas'])
  assert.deepEqual(defaultPools('overseas', 'both'), ['overseas'])
  assert.deepEqual(defaultPools('cn-mainland', 'abroad'), ['overseas', 'hkmotw'])
  assert.deepEqual(defaultPools(null, null), ['overseas', 'hkmotw'])
  const onlyOverseas = computeGlobal(items, sel({ pools: ['overseas'] }), ctx)
  assert.equal(onlyOverseas.counts.pool, 403)
  assert.equal(onlyOverseas.counts.byPool.hkmotw, 0)
  // 正規化：未知鍵丟掉、池不得為空
  const n = normalizeGlobalSelection({ pools: [], struckRegions: ['Atlantis', 'Japan'], struckFamilies: ['AS99'], wantedSubjects: ['XX'], struckAudiences: ['nobody' as never] }, options, familyOf, ['overseas'])
  assert.deepEqual(n, { pools: ['overseas'], struckRegions: ['Japan'], struckFamilies: [], wantedSubjects: [], struckAudiences: [] })
})

test('分享往返一致：只含選項鍵（無起點、資格、個人資料）；未知鍵丟掉；沒有選項回 null', () => {
  const s = sel({ pools: ['overseas', 'hkmotw'], struckRegions: ['United States', 'China-Hong Kong', 'Japan'], struckFamilies: ['AS05'], wantedSubjects: ['AS0210', 'AS0101'], struckAudiences: ['mainland_gaokao'] })
  const q = encodeGlobalSelection(s)
  assert.deepEqual(decodeGlobalSelection(q, options, familyOf), s)
  assert.deepEqual(decodeGlobalSelection(`?${q}`, options, familyOf), s)
  assert.equal(encodeGlobalSelection(decodeGlobalSelection(q, options, familyOf)!), q)
  const keys = [...new URLSearchParams(q).keys()].sort()
  assert.deepEqual(keys, ['c', 'f', 'p', 'r', 'w'])
  assert.equal(/origin|qual|scope|user|name|mail|session/i.test(q), false)
  assert.equal(decodeGlobalSelection('', options, familyOf), null)
  assert.equal(decodeGlobalSelection('x=1', options, familyOf), null)
  assert.deepEqual(decodeGlobalSelection('r=Atlantis|Japan', options, familyOf)!.struckRegions, ['Japan'])
  // 地區碼含空格與連字號也能往返
  const spaced = sel({ struckRegions: ['United Kingdom', 'China-Macau'] })
  assert.deepEqual(decodeGlobalSelection(encodeGlobalSelection(spaced), options, familyOf), spaced)
})

test('不進 AnswerMap／DimensionId／learning manifest／Function／A+ 證據；引擎不匯入 i18n 或學習記錄模組', () => {
  assert.equal(GLOBAL_STORAGE_KEY, 'unapply.globalSubtraction.v1')
  assert.equal(Object.keys(DIMENSIONS).length, 45)
  assert.equal(allQuestions.length, 45)
  const engine = read('src/engine/globalFilter.ts')
  assert.equal(/from '\.\.\/(i18n|lib\/(bdfzIdentity|trustedAPlus|learningEvidence))|from '\.\/filter'|AnswerMap|DimensionId/.test(engine.replace(/^\s*\/\/.*$/gm, '')), false)
  // 去掉註解（文件說明會寫「不進 AnswerMap」）後只看程式
  const page = read('src/components/GlobalSubtraction.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.equal(/bdfzIdentity|trustedAPlus|learningEvidence|recordUnapply|syncUnapply|AnswerMap/.test(page), false)
  const fn = read('functions/api/learning/[action].ts')
  assert.equal(/globalSubtraction|struckRegions|wantedSubjects/i.test(fn), false)
  const manifest = JSON.parse(read('public/learning-manifest.json')) as { manifestDigest: string; itemCount: number }
  assert.equal(manifest.manifestDigest, 'sha256:136c786802e02d452210574756f5bef291c120e5edd7beee0c30856826636a99')
  assert.equal(manifest.itemCount, 1)
  assert.equal(/global/i.test(read('public/learning-manifest.json')), false)
  const evidence = buildUnapplyResultEvidence({ totalInput: 2952, keptCount: 9, excludedCount: 2943, answeredCount: 8, byQuestion: {} }, 'canary', 'https://nope.bdfz.net/#/result')!
  assert.equal(/global|struck|wanted/i.test(JSON.stringify(evidence)), false)
  // 選項鍵不與任何 DimensionId 撞名
  for (const k of ['p', 'r', 'f', 'w', 'c']) assert.ok(!(k in DIMENSIONS))
})

test('三語鍵齊全：題目、規則、未知、管道對象、池、入口與 About', () => {
  const zhHant = JSON.parse(read('src/i18n/locales/zh-Hant.json')) as Record<string, string>
  const en = JSON.parse(read('src/i18n/locales/en.json')) as Record<string, string>
  const zhHans = JSON.parse(read('public/i18n/zh-Hans.json')) as Record<string, string>
  const keys = [
    ...GLOBAL_QUESTIONS.flatMap((q) => [`ui.global.q.${q}.title`, `ui.global.q.${q}.hint`]),
    ...['region_struck', 'all_top50_in_struck_families', 'no_top50_in_wanted', 'all_recorded_channels_struck'].map((r) => `ui.global.reason.rule.${r}`),
    ...['subjects_no_gras', 'channels_none_recorded', 'channels_own_route_unrecorded'].map((u) => `ui.global.unknown.${u}`),
    ...CHANNEL_AUDIENCES.map((a) => `ui.global.audience.${a}`),
    ...GLOBAL_POOLS.flatMap((p) => [`ui.global.pool.${p}`, `ui.global.item.pool.${p}`]),
    'ui.global.reason.line', 'ui.global.counts', 'ui.global.share.note', 'ui.global.footer.rule',
    'ui.landing.global', 'ui.landing.hkmotwDirect', 'ui.landing.overseasDirect', 'ui.result.cross.global', 'ui.about.roadmap.global',
  ]
  for (const k of keys) for (const [name, dict] of [['zh-Hant', zhHant], ['en', en], ['zh-Hans', zhHans]] as const) assert.ok(dict[k] && dict[k].trim(), `${name} ${k}`)
  // 規則鍵與引擎原因碼一一對應（以引擎原始碼為準）
  const engine = read('src/engine/globalFilter.ts')
  for (const rule of engine.matchAll(/rule: '([a-z0-9_]+)'/g)) assert.ok(`ui.global.reason.rule.${rule[1]}` in zhHant, rule[1])
  for (const u of engine.matchAll(/unknown\.push\('([a-z_]+)'\)/g)) assert.ok(`ui.global.unknown.${u[1]}` in zhHant, u[1])
})
