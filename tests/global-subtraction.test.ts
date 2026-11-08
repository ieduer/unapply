// 全球池減法（批 G2；2026-11-08 批 G6 依目的地重做）閘門：池只含所選目的地且去重、題目按相關性出現、
// 管道只算適用你起點的本科管道、官方明確不招本科的不算進剩下、未知值永不劃掉、資格永不劃掉、
// 與 AnswerMap／DimensionId／learning manifest／Function 無交集、分享往返一致且只含選項鍵、三語鍵齊全。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  CHANNEL_QUESTION_MIN, GLOBAL_DESTINATIONS, GLOBAL_QUESTIONS, GLOBAL_STORAGE_KEY, HKMOTW_REGION_CODE, REGION_QUESTION_MIN, SUBJECT_QUESTION_MIN,
  applicableChannels, audienceForOrigin, buildGlobalPool, computeGlobal, decodeGlobalSelection, emptyGlobalSelection, encodeGlobalSelection,
  globalOptions, globalQuestionPlan, normalizeGlobalSelection, poolFor, qualificationMark, type GlobalDestination, type GlobalPoolItem, type GlobalSelection,
} from '../src/engine/globalFilter.ts'
import type { OriginRegion } from '../src/data/origins.ts'
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
const options = globalOptions(atlas)
const sel = (origin: OriginRegion | null, patch: Partial<GlobalSelection> = {}): GlobalSelection => normalizeGlobalSelection({ ...emptyGlobalSelection(), ...patch }, items, origin, options, familyOf)
const run = (origin: OriginRegion | null, patch: Partial<GlobalSelection> = {}) => computeGlobal(items, sel(origin, patch), { familyOf, origin })
const all = GLOBAL_DESTINATIONS

test('池：院校池 28＋海外層 403 去重（院校池 atlasId＝海外層 id 只算一所）；目的地由地區決定；海外＝去掉港澳臺三地區', () => {
  assert.equal(hkmotw.institutions.length, 28)
  assert.equal(overseas.institutions.length, 403)
  // 10 所以 atlasId 對上；澳門城市大學沒有連到 GRAS，以同地區英文名對上（批 G6）
  const twins = items.filter((i) => i.pool === 'hkmotw' && i.overseasId).length
  assert.equal(twins, 11)
  assert.equal(items.find((i) => i.id === 'mo-cityu')?.overseasId, 'RG00015')
  assert.equal(items.filter((i) => i.pool === 'overseas' && i.destination === 'mo').length, 0)
  assert.equal(items.length, 28 + 403 - twins)
  assert.equal(new Set(items.map((i) => i.key)).size, items.length)
  for (const item of items) {
    if (item.pool === 'hkmotw') assert.ok(Array.isArray(item.channels))
    else { assert.equal(item.channels, null); assert.equal(item.overseasId, item.id) }
    if (item.destination === 'overseas') assert.ok(!Object.values(HKMOTW_REGION_CODE).includes(item.region), item.key)
    else assert.equal(item.region, HKMOTW_REGION_CODE[item.destination.toUpperCase() as 'HK' | 'MO' | 'TW'], item.key)
  }
  // 臺灣：院校池 2 筆管道彙整（其中陸生聯招會只招碩博）＋海外層 4 所臺灣大學
  assert.equal(items.filter((i) => i.destination === 'tw' && i.pool === 'overseas').length, 4)
  assert.deepEqual(items.filter((i) => i.noUndergrad).map((i) => i.id), ['tw-rusen'])
  // 跳過全部題目：一所都不劃；不招本科的不算進池
  const none = run('cn-mainland', { destinations: [...all] })
  assert.equal(none.counts.crossed, 0)
  assert.equal(none.counts.noUndergrad, 1)
  assert.equal(none.counts.pool, items.length - 2) // 減去陸生聯招會（不招本科）與海外聯招會（港澳學生管道，不屬大陸考生）
  assert.equal(none.counts.kept, none.counts.pool)
})

test('只選港澳臺或海外：池裡沒有任何中國大陸院校；目的地子集正確', () => {
  for (const d of all) {
    const pool = poolFor(items, [d])
    assert.ok(pool.length > 0, d)
    assert.ok(pool.every((i) => i.destination === d), d)
    assert.equal(pool.some((i) => i.region === 'China'), false)
  }
  assert.equal(poolFor(items, ['hk']).length, 16)
  assert.equal(poolFor(items, ['mo']).length, 10) // 院校池 10；海外層澳門 4 所都與院校池重複
  assert.equal(poolFor(items, ['tw']).length, 1 + 4)
})

test('題目按相關性出現：地區 ≥2、GRAS 資料 ≥5、適用你的管道 ≥2 種才出題；不出的題的選擇被正規化掉', () => {
  assert.equal(REGION_QUESTION_MIN, 2); assert.equal(SUBJECT_QUESTION_MIN, 5); assert.equal(CHANNEL_QUESTION_MIN, 2)
  // 香港考生只看香港：地區只有 1 個 → 不問；香港院校池 7 所有 GRAS → 問學科；香港院校沒有記錄港澳學生管道 → 不問管道
  const hkOnly = globalQuestionPlan(poolFor(items, ['hk']), 'hk')
  assert.equal(hkOnly.regions, null)
  assert.equal(hkOnly.subjects, true)
  assert.equal(hkOnly.channels, null)
  // 澳門考生只看澳門：地區 1、GRAS 4（<5）→ 學科不問
  const moOnly = globalQuestionPlan(poolFor(items, ['mo']), 'mo')
  assert.equal(moOnly.regions, null)
  assert.equal(moOnly.subjects, false)
  assert.ok(moOnly.subjectItems < SUBJECT_QUESTION_MIN)
  // 大陸考生看香港：管道題列內地高考生的本科管道（≥2 種），不含港澳學生管道、不含只招碩博
  const cnHk = globalQuestionPlan(poolFor(items, ['hk']), 'cn-mainland')
  assert.ok(cnHk.channels && cnHk.channels.length >= 2)
  assert.ok(cnHk.channels!.every((c) => c !== 'joint_admission_overseas' && c !== 'postgraduate_only'))
  // 海外：多個國家 → 地區題出現；院校池以外沒有管道題
  const overseasOnly = globalQuestionPlan(poolFor(items, ['overseas']), 'overseas')
  assert.ok(overseasOnly.regions && overseasOnly.regions.length > 10)
  assert.equal(overseasOnly.channels, null)
  // 不出的題：選擇被丟掉
  const n = normalizeGlobalSelection({ destinations: ['hk'], struckRegions: ['China-Hong Kong'], struckChannels: ['independent'] }, items, 'hk', options, familyOf)
  assert.deepEqual(n.struckRegions, [])
  assert.deepEqual(n.struckChannels, [])
})

test('(a) 地區：劃掉的地區全部機構劃掉、原因帶該校地區碼；地區全劃則剩 0 且每所都有原因', () => {
  const r = run('cn-mainland', { destinations: [...all], struckRegions: ['United Kingdom', 'China-Hong Kong'] })
  for (const c of r.crossed) {
    assert.ok(['United Kingdom', 'China-Hong Kong'].includes(c.item.region))
    assert.deepEqual(c.reasons, [{ question: 'regions', rule: 'region_struck', region: c.item.region }])
  }
  assert.equal(r.counts.crossed, poolFor(items, all).filter((i) => ['United Kingdom', 'China-Hong Kong'].includes(i.region)).length)
  const plan = globalQuestionPlan(poolFor(items, all), 'cn-mainland')
  const everything = run('cn-mainland', { destinations: [...all], struckRegions: [...plan.regions!] })
  assert.equal(everything.counts.kept, 0)
  assert.equal(everything.counts.crossed, everything.counts.pool)
  for (const c of everything.crossed) assert.ok(c.reasons.length > 0 && c.reasons.every((x) => x.question === 'regions' && x.region === c.item.region), c.item.key)
})

test('(b1)(b2) 學科：所有前 50 學科都在劃掉的門類才劃；只想讀的學科沒有前 50 席位才劃；GRAS 無資料保留', () => {
  const r = run('overseas', { destinations: [...all], struckFamilies: ['AS04', 'AS05'] })
  for (const c of r.crossed) {
    const reason = c.reasons.find((x) => x.question === 'families')!
    assert.equal(reason.rule, 'all_top50_in_struck_families')
    assert.ok(c.item.subjects && c.item.subjects.every((s) => ['AS04', 'AS05'].includes(familyOf.get(s)!)), c.item.key)
  }
  for (const k of r.kept) if (!k.item.subjects) assert.ok(k.unknown.includes('subjects_no_gras'), k.item.key)
  assert.ok(r.counts.crossed > 0)
  const w = run('overseas', { destinations: [...all], wantedSubjects: ['AS0210'] })
  for (const k of w.kept) assert.ok(!k.item.subjects || k.item.subjects.includes('AS0210'), k.item.key)
  const contradictory = sel('overseas', { destinations: [...all], struckFamilies: ['AS02'], wantedSubjects: ['AS0210', 'AS0101'] })
  assert.deepEqual(contradictory.wantedSubjects, ['AS0101'])
})

test('(c) 管道：只看適用你起點的本科管道；全被劃掉才劃；沒有記錄適用你的管道＝未知保留；香港考生看不到內地高考生管道', () => {
  // 大陸考生：劃掉「獨立招生」→ 只有獨立招生一條適用管道的院校被劃，其餘保留
  const cn = run('cn-mainland', { destinations: ['hk', 'mo'], struckChannels: ['independent'] })
  for (const c of cn.crossed) {
    const own = applicableChannels(c.item, 'cn-mainland')!
    assert.deepEqual(c.reasons, [{ question: 'channels', rule: 'all_applicable_channels_struck', channels: own }])
    assert.deepEqual(own, ['independent'])
  }
  assert.ok(cn.counts.crossed > 0)
  assert.ok(cn.kept.filter((k) => applicableChannels(k.item, 'cn-mainland')?.length === 0).every((k) => k.unknown.includes('channels_none_applicable')))
  // 香港考生：港校只記錄了內地高考生管道 → 對香港考生「適用的管道」為空；內地管道永不出現在他的題或卡片
  for (const item of poolFor(items, ['hk'])) assert.deepEqual(applicableChannels(item, 'hk'), [], item.key)
  assert.equal(audienceForOrigin('hk'), 'hk_macao_students')
  // 臺灣／海外／未選：管道對象未入庫 → 沒有適用管道 → 管道題永不出現、永不劃
  for (const origin of ['tw', 'overseas', null] as const) {
    assert.equal(audienceForOrigin(origin), null)
    assert.equal(globalQuestionPlan(poolFor(items, all), origin).channels, null)
  }
  // 海外層永不受管道題影響
  assert.equal(applicableChannels(items.find((i) => i.pool === 'overseas')!, 'cn-mainland'), null)
})

test('官方明確不招本科（陸生聯招會只招碩博）：不算進池與剩下，另列；地區題也不會劃到它', () => {
  const r = run('cn-mainland', { destinations: ['tw'] })
  assert.deepEqual(r.noUndergrad.map((i) => i.id), ['tw-rusen'])
  assert.equal(r.kept.some((k) => k.item.id === 'tw-rusen'), false)
  assert.equal(r.crossed.some((c) => c.item.id === 'tw-rusen'), false)
  // 大陸考生看臺灣：海外聯招會（只記錄港澳學生管道）不是他的管道彙整，不算進他的池；4 所臺灣大學保留
  assert.equal(r.counts.pool, 4)
  assert.equal(r.kept.some((k) => k.item.id === 'tw-overseas'), false)
  // 香港考生看臺灣：海外聯招會是他的管道；陸生聯招會不屬於他，連「不招本科」一節也不出現
  const hk = run('hk', { destinations: ['tw'] })
  assert.ok(hk.kept.some((k) => k.item.id === 'tw-overseas'))
  assert.equal(hk.counts.noUndergrad, 0)
  // 臺灣考生（管道對象未入庫）：兩個委員會都照常保留／另列（疑罪從無）
  const tw = run('tw', { destinations: ['tw'] })
  assert.ok(tw.kept.some((k) => k.item.id === 'tw-overseas'))
  assert.equal(tw.counts.noUndergrad, 1)
  // 不選臺灣就不出現
  assert.equal(run('cn-mainland', { destinations: ['hk'] }).counts.noUndergrad, 0)
})

test('未知值永不劃掉；「官方頁本站未讀到」不是取值', () => {
  const s = sel('cn-mainland', { destinations: [...all], struckFamilies: ['AS01'], wantedSubjects: ['AS0501'], struckChannels: ['independent'] })
  const r = computeGlobal(items, s, { familyOf, origin: 'cn-mainland' })
  for (const c of r.crossed) for (const reason of c.reasons) assert.ok(GLOBAL_QUESTIONS.includes(reason.question))
  const flipped: GlobalPoolItem[] = items.map((i) => (i.pool === 'overseas' ? { ...i, status: 'not_found' as const } : i))
  assert.deepEqual(computeGlobal(flipped, s, { familyOf, origin: 'cn-mainland' }).crossed.map((c) => c.item.key), r.crossed.map((c) => c.item.key))
  const noGras = items.filter((i) => !i.subjects)
  assert.equal(computeGlobal(noGras, s, { familyOf, origin: 'cn-mainland' }).crossed.filter((c) => c.reasons.some((x) => x.question !== 'channels')).length, 0)
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
  assert.ok(items.some((i) => i.pool === 'hkmotw' && i.overseasId))
  assert.equal(computeGlobal.length, 3)
  assert.equal(qualificationMark(items[0], null), null)
})

test('分享往返一致：只含選項鍵（目的地、地區、學科、管道碼）；舊 G2 鏈接（p＝池）換算成目的地；未知鍵丟掉', () => {
  const s = sel('cn-mainland', { destinations: ['hk', 'overseas'], struckRegions: ['United States', 'China-Hong Kong'], struckFamilies: ['AS05'], wantedSubjects: ['AS0210', 'AS0101'], struckChannels: ['independent'] })
  const q = encodeGlobalSelection(s)
  assert.deepEqual(decodeGlobalSelection(q, items, 'cn-mainland', options, familyOf), s)
  assert.deepEqual(decodeGlobalSelection(`?${q}`, items, 'cn-mainland', options, familyOf), s)
  assert.equal(encodeGlobalSelection(decodeGlobalSelection(q, items, 'cn-mainland', options, familyOf)!), q)
  assert.deepEqual([...new URLSearchParams(q).keys()].sort(), ['c', 'd', 'f', 'r', 'w'])
  assert.equal(/origin|qual|scope|user|name|mail|session/i.test(q), false)
  assert.equal(decodeGlobalSelection('', items, null, options, familyOf), null)
  assert.equal(decodeGlobalSelection('x=1', items, null, options, familyOf), null)
  assert.deepEqual(decodeGlobalSelection('p=hkmotw', items, null, options, familyOf)!.destinations, ['hk', 'mo', 'tw'])
  assert.deepEqual(decodeGlobalSelection('p=overseas|hkmotw&c=mainland_gaokao', items, 'cn-mainland', options, familyOf)!.struckChannels, [])
  assert.deepEqual(decodeGlobalSelection('d=overseas&r=Atlantis|Japan', items, null, options, familyOf)!.struckRegions, ['Japan'])
  const destinationsOnly = normalizeGlobalSelection({ destinations: [] }, items, null, options, familyOf, ['tw'] as GlobalDestination[])
  assert.deepEqual(destinationsOnly.destinations, ['tw'])
})

test('不進 AnswerMap／DimensionId／learning manifest／Function／A+ 證據；引擎不匯入 i18n 或學習記錄模組', () => {
  assert.equal(GLOBAL_STORAGE_KEY, 'unapply.globalSubtraction.v2')
  assert.equal(Object.keys(DIMENSIONS).length, 45)
  assert.equal(allQuestions.length, 45)
  const engine = read('src/engine/globalFilter.ts')
  assert.equal(/from '\.\.\/(i18n|lib\/(bdfzIdentity|trustedAPlus|learningEvidence))|from '\.\/filter'|AnswerMap|DimensionId/.test(engine.replace(/^\s*\/\/.*$/gm, '')), false)
  const page = read('src/components/GlobalSubtraction.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.equal(/bdfzIdentity|trustedAPlus|learningEvidence|recordUnapply|syncUnapply|AnswerMap/.test(page), false)
  const fn = read('functions/api/learning/[action].ts')
  assert.equal(/globalSubtraction|struckRegions|wantedSubjects|struckChannels|destination/i.test(fn), false)
  const manifest = JSON.parse(read('public/learning-manifest.json')) as { manifestDigest: string; itemCount: number }
  assert.equal(manifest.manifestDigest, 'sha256:136c786802e02d452210574756f5bef291c120e5edd7beee0c30856826636a99')
  assert.equal(manifest.itemCount, 1)
  assert.equal(/global/i.test(read('public/learning-manifest.json')), false)
  const evidence = buildUnapplyResultEvidence({ totalInput: 2952, keptCount: 9, excludedCount: 2943, answeredCount: 8, byQuestion: {} }, 'canary', 'https://nope.bdfz.net/#/result')!
  assert.equal(/global|struck|wanted|destination/i.test(JSON.stringify(evidence)), false)
  for (const k of ['d', 'r', 'f', 'w', 'c']) assert.ok(!(k in DIMENSIONS))
})

test('三語鍵齊全：題目、規則、未知、管道碼、目的地、本地入學、不招本科', () => {
  const zhHant = JSON.parse(read('src/i18n/locales/zh-Hant.json')) as Record<string, string>
  const en = JSON.parse(read('src/i18n/locales/en.json')) as Record<string, string>
  const zhHans = JSON.parse(read('public/i18n/zh-Hans.json')) as Record<string, string>
  const channelCodes = [...new Set(hkmotw.institutions.flatMap((i) => i.channels.map((c) => c.channel)))]
  const keys = [
    ...GLOBAL_QUESTIONS.flatMap((q) => [`ui.global.q.${q}.title`, `ui.global.q.${q}.hint`]),
    ...channelCodes.map((c) => `ui.global.channel.${c}`),
    ...all.map((d) => `ui.dest.${d}`),
    ...['hk', 'mo', 'tw'].map((d) => `ui.global.localEntry.${d}`),
    'ui.global.reason.line', 'ui.global.counts', 'ui.global.share.note', 'ui.global.footer.rule', 'ui.global.dest.title', 'ui.global.dest.note', 'ui.global.dest.fallback',
    'ui.global.noUndergrad.title', 'ui.global.noUndergrad.note', 'ui.global.noUndergrad.source', 'ui.global.item.channels', 'ui.global.item.channelsNone',
    'ui.global.backToMainland', 'ui.global.doMainland', 'ui.global.noOrigin', 'ui.global.noQuestions', 'ui.global.kept.emptyPool', 'ui.about.roadmap.global',
  ]
  for (const k of keys) for (const [name, dict] of [['zh-Hant', zhHant], ['en', en], ['zh-Hans', zhHans]] as const) assert.ok(dict[k] && dict[k].trim(), `${name} ${k}`)
  const engine = read('src/engine/globalFilter.ts')
  for (const rule of engine.matchAll(/rule: '([a-z0-9_]+)'/g)) assert.ok(`ui.global.reason.rule.${rule[1]}` in zhHant, rule[1])
  for (const u of engine.matchAll(/unknown\.push\('([a-z_]+)'\)/g)) assert.ok(`ui.global.unknown.${u[1]}` in zhHant, u[1])
})
