// 按目的地分題庫（2026-11-08 批 G6 擴充，站長「徹底優化題目，不同地區可以不一樣，以效度為準」）閘門：
// 六條效度標準（來源、覆蓋、區分力、準確、疑罪從無、題數與順序）＋池規模；不同起點／目的地出不同題；
// 被捨棄的候選題（英語、學費、澳門公私立、香港 GRAS）有可重算的理由；分享只含選項鍵；與學習證據無交集。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildGlobalPool, poolFor, type GlobalPoolItem } from '../src/engine/globalFilter.ts'
import {
  BANKS, CANDIDATES, VALIDITY, computeBank, decodeBankAnswers, encodeBankAnswers, evaluateBank, normalizeBankAnswers,
  type BankContext, type BankId,
} from '../src/engine/regionBanks.ts'
import { questionEvidence } from '../src/data/questionEvidence.ts'
import { bankEvidence } from '../src/lib/bankEvidence.ts'
import { tierOf } from '../src/lib/authorityTier.ts'
import type { OriginRegion } from '../src/data/origins.ts'
import type { OverseasIndexPayload } from '../src/data/overseasTypes.ts'
import type { HkMoTwPoolPayload } from '../src/data/hkmotwTypes.ts'
import type { WorldAtlasPayload } from '../src/data/worldAtlasTypes.ts'

const root = new URL('..', import.meta.url).pathname
const read = (p: string) => readFileSync(`${root}/${p}`, 'utf8')
const overseas = JSON.parse(read('public/data/overseas/index.json')) as OverseasIndexPayload
const hkmotw = JSON.parse(read('public/data/hkmotw/pool.json')) as HkMoTwPoolPayload
const atlas = JSON.parse(read('public/data/atlas/world-atlas.json')) as WorldAtlasPayload
const items = buildGlobalPool(overseas, hkmotw, atlas)
const ORIGINS: OriginRegion[] = ['cn-mainland', 'hk', 'mo', 'tw', 'overseas']
const ctxFor = (origin: OriginRegion | null): BankContext => ({
  familyOf: new Map(atlas.subjects.map((s) => [s.code, s.family])),
  familyOrder: atlas.families.map((f) => f.code),
  subjectOrder: atlas.subjects.map((s) => s.code),
  origin,
  ...bankEvidence(),
})
const planFor = (bank: BankId, origin: OriginRegion | null) => evaluateBank(bank, poolFor(items, [bank], origin), ctxFor(origin))
const ids = (bank: BankId, origin: OriginRegion | null) => planFor(bank, origin).questions.map((q) => q.id)

test('各題庫最終題目（當時值）：海外 3、香港對大陸起點 2／其他起點 1、澳門 0、臺灣 0', () => {
  for (const origin of ORIGINS) assert.deepEqual(ids('overseas', origin), ['wanted', 'families', 'regions'], origin)
  // 批 G8：香港年學費題（非香港起點）、澳門公立／私立題（大陸起點的澳門池扣掉只招研究生的聖若瑟後剩 9 所 < 10，不出題）
  assert.deepEqual(ids('hk', 'cn-mainland'), ['hkFunding', 'hkTuitionCap', 'channels'])
  assert.deepEqual(ids('hk', 'hk'), ['hkFunding'])
  for (const origin of ['mo', 'tw', 'overseas'] as const) assert.deepEqual(ids('hk', origin), ['hkFunding', 'hkTuitionCap'], origin)
  assert.deepEqual(ids('mo', 'cn-mainland'), [])
  assert.equal(planFor('mo', 'cn-mainland').pool, 9)
  for (const origin of ['hk', 'mo', 'tw', 'overseas'] as const) assert.deepEqual(ids('mo', origin), ['moOwnership'], origin)
  for (const origin of ORIGINS) assert.deepEqual(ids('tw', origin), [], origin)
  // 不同起點／目的地出不同題
  assert.notDeepEqual(ids('hk', 'cn-mainland'), ids('hk', 'hk'))
  assert.notDeepEqual(ids('hk', 'cn-mainland'), ids('overseas', 'cn-mainland'))
})

test('標準 1 來源：每個出現的題都來自 P0／P1，鏈接層級與 authority_tiers 一致', () => {
  for (const origin of ORIGINS) for (const bank of BANKS) for (const q of planFor(bank, origin).questions) {
    assert.ok(['P0', 'P1'].includes(q.source.tier), `${bank} ${q.id}`)
    if (q.source.url) assert.equal(tierOf(q.source.url), q.source.tier, `${q.id} ${q.source.url}`)
  }
  const channels = CANDIDATES.find((c) => c.id === 'channels')!
  assert.equal(channels.source.tier, 'P0') // 各院校官方招生頁＝機構本身的官方網域（P0 定義）
})

test('標準 2 覆蓋 ≥60%、標準 3 區分力：沒有單選就劃光全池或劃不掉任何一所的選項；池少於 10 所不出題', () => {
  for (const origin of ORIGINS) for (const bank of BANKS) {
    const plan = planFor(bank, origin)
    for (const q of plan.questions) {
      assert.ok(q.coverage >= VALIDITY.minCoverage, `${origin} ${bank} ${q.id} ${q.coverage}`)
      assert.ok(q.options.length > 0)
      for (const o of q.options) assert.ok(o.crossed > 0 && o.crossed < plan.pool, `${bank} ${q.id} ${o.value} ${o.crossed}/${plan.pool}`)
    }
    if (plan.pool < VALIDITY.minPool) assert.equal(plan.questions.length, 0)
    for (const r of plan.rejected) assert.ok(['pool_small', 'coverage', 'no_effect', 'over_limit'].includes(r.reason))
  }
  // 具體捨棄理由
  const hkCn = planFor('hk', 'cn-mainland')
  assert.equal(hkCn.rejected.find((r) => r.id === 'wanted')?.reason, 'coverage') // GRAS 7/16
  assert.equal(hkCn.rejected.find((r) => r.id === 'regions')?.reason, 'no_effect') // 只有一個地區
  const moCn = planFor('mo', 'cn-mainland')
  assert.equal(moCn.rejected.find((r) => r.id === 'channels')?.reason, 'pool_small') // 批 G8：聖若瑟對內地只招研究生，池 9 所
  const moHk = planFor('mo', 'hk')
  const own = moHk.questions.find((q) => q.id === 'moOwnership')!
  assert.deepEqual([own.known, moHk.pool, own.options.map((o) => `${o.value}:${o.crossed}`).join(',')], [6, 10, 'public:3,private:3'])
  const hkTw = planFor('hk', 'tw')
  const cap = hkTw.questions.find((q) => q.id === 'hkTuitionCap')!
  assert.deepEqual([cap.known, hkTw.pool, cap.single, cap.options.map((o) => `${o.value}:${o.crossed}`).join(',')], [14, 16, true, '150000:9,200000:7,250000:1'])
  assert.equal(planFor('hk', 'hk').rejected.find((r) => r.id === 'hkTuitionCap')?.reason, 'coverage') // 只對非香港起點
  assert.equal(planFor('tw', 'cn-mainland').rejected[0].reason, 'pool_small')
})

test('標準 4 準確：只用原句判讀為 confirmed 的管道；判讀全量 ≥20 筆；教資會名單 8/8 對到官方頁', () => {
  const checks = questionEvidence.channelChecks
  assert.ok(checks.checked >= VALIDITY.minSample)
  assert.equal(checks.confirmed.length + checks.unconfirmed.length + checks.notBachelor.length, checks.checked)
  // 題目實際用到的取值全部是 confirmed（準確率 100%，≥95%）
  const ctx = ctxFor('cn-mainland')
  const def = CANDIDATES.find((c) => c.id === 'channels')!
  for (const item of poolFor(items, ['hk', 'mo'], 'cn-mainland')) for (const code of def.values(item, ctx) ?? []) assert.ok(ctx.confirmedChannels.has(`${item.id}|${code}`), `${item.id} ${code}`)
  // 未確認的保持未知（不劃）
  for (const key of checks.unconfirmed) {
    const [id] = key.split('|')
    const item = items.find((i) => i.id === id)!
    assert.equal(def.values(item, ctx), null, key)
  }
  assert.equal(questionEvidence.ugcFunded.ids.length, 8)
  assert.deepEqual([...questionEvidence.ugcFunded.ids].sort(), ['hk-cityu', 'hk-cuhk', 'hk-eduhk', 'hk-hkbu', 'hk-hku', 'hk-hkust', 'hk-lingnan', 'hk-polyu'])
})

test('標準 5 疑罪從無：未知永不劃掉（requires 題也一樣）；未確認管道寫明未知原因', () => {
  const plan = planFor('hk', 'cn-mainland')
  const pool = poolFor(items, ['hk'], 'cn-mainland')
  const ctx = ctxFor('cn-mainland')
  const everyChannel = plan.questions.find((q) => q.id === 'channels')!.options.map((o) => o.value)
  const r = computeBank(plan, pool, { hk: { channels: everyChannel } }, ctx)
  for (const id of ['hk-lingnan', 'hk-hsuhk', 'hk-thei', 'hk-hkapa']) {
    const kept = r.kept.find((k) => k.item.id === id)
    assert.ok(kept, id)
    assert.ok(kept!.unknown.includes('channels_unconfirmed'), id)
  }
  assert.ok(r.kept.find((k) => k.item.id === 'hk-sfu')!.unknown.includes('channels_none_applicable'))
  // requires：沒有 GRAS 資料的機構（若出現在題庫裡）保留
  const synthetic: GlobalPoolItem[] = poolFor(items, ['overseas']).slice(0, 12).map((i, n) => (n === 0 ? { ...i, subjects: null } : i))
  const sPlan = evaluateBank('overseas', synthetic, ctxFor('overseas'))
  const wanted = sPlan.questions.find((q) => q.id === 'wanted')!
  const res = computeBank(sPlan, synthetic, { overseas: { wanted: [wanted.options[0].value] } }, ctxFor('overseas'))
  assert.ok(res.kept.some((k) => k.item.key === synthetic[0].key && k.unknown.includes('subjects_no_gras')))
})

test('標準 6 題數與順序：每個題庫 ≤8 題，按「預期劃掉數 × 覆蓋率」由高到低', () => {
  for (const origin of ORIGINS) for (const bank of BANKS) {
    const qs = planFor(bank, origin).questions
    assert.ok(qs.length <= VALIDITY.maxQuestions)
    for (let i = 1; i < qs.length; i += 1) assert.ok(qs[i - 1].score >= qs[i].score, `${bank} ${qs[i - 1].id} ${qs[i].id}`)
    for (const q of qs) assert.ok(Math.abs(q.score - q.expectedCrossed * q.coverage) < 1e-9)
  }
})

test('被捨棄的候選（不進引擎）：英語總分、國際生學費覆蓋不足——批 G8 起以 R1 研究資料重算（海外題庫池）', () => {
  const pool = new Set(poolFor(items, ['overseas'], 'cn-mainland').map((i) => i.id))
  assert.equal(pool.size, 388)
  const rows = (p: string) => readFileSync(`${root}/${p}`, 'utf8').trim().split('\n').slice(1)
  const english = JSON.parse(read('public/data/overseas/requirements.json')) as { institutions: Record<string, { english?: unknown; tuition?: unknown }> }
  const withEnglish = Object.entries(english.institutions).filter(([id, r]) => pool.has(id) && r.english).length
  const withTuition = Object.entries(english.institutions).filter(([id, r]) => pool.has(id) && r.tuition).length
  assert.deepEqual([withEnglish, withTuition], [47, 20])
  assert.ok(withEnglish / pool.size < VALIDITY.minCoverage && withTuition / pool.size < VALIDITY.minCoverage)
  assert.equal(rows('data/research/overseas_english.2026-11-08.csv').length >= 403, true)
})

test('作答正規化與分享：只留出題計畫裡的題與選項；分享只含選項鍵並可往返；舊 G2 鏈接 p＝換算成目的地', () => {
  const plans = (['hk', 'overseas'] as BankId[]).map((b) => planFor(b, 'cn-mainland'))
  const answers = normalizeBankAnswers({ hk: { hkFunding: ['other', 'nope'], regions: ['China-Hong Kong'] }, overseas: { regions: ['Japan', 'Atlantis'], wanted: ['AS0210'] }, mo: { channels: ['independent'] } }, plans)
  assert.deepEqual(answers, { hk: { hkFunding: ['other'] }, overseas: { regions: ['Japan'], wanted: ['AS0210'] } })
  const q = encodeBankAnswers(['hk', 'overseas'], answers)
  assert.equal(/origin|qual|user|name|mail|session/i.test(q), false)
  const back = decodeBankAnswers(q)!
  assert.deepEqual(back.destinations, ['hk', 'overseas'])
  assert.deepEqual(normalizeBankAnswers(back.answers, plans), answers)
  assert.deepEqual(decodeBankAnswers('p=hkmotw')!.destinations, ['hk', 'mo', 'tw'])
  assert.equal(decodeBankAnswers(''), null)
})

test('題文三語齊：每個候選題的標題與說明、香港院校類型選項', () => {
  const zhHant = JSON.parse(read('src/i18n/locales/zh-Hant.json')) as Record<string, string>
  const en = JSON.parse(read('src/i18n/locales/en.json')) as Record<string, string>
  const zhHans = JSON.parse(read('public/i18n/zh-Hans.json')) as Record<string, string>
  const keys = [...CANDIDATES.flatMap((c) => [`ui.global.q.${c.id}.title`, `ui.global.q.${c.id}.hint`]), 'ui.global.funding.ugc', 'ui.global.funding.other', 'ui.global.unknown.channels_unconfirmed', 'ui.global.unknown.subjects_no_gras', 'ui.global.unknown.channels_none_applicable', 'ui.runner.autoSkip']
  for (const k of keys) for (const dict of [zhHant, en, zhHans]) assert.ok(dict[k]?.trim(), k)
  // 題目文字一句
  for (const c of CANDIDATES) assert.ok(!/[。.].+[。.]/.test(zhHant[`ui.global.q.${c.id}.title`]), c.id)
})

// ---- 批 G7：非大學路徑題（企業直招，src/engine/directHire.ts）
import { DIRECT_HIRE_RULE, entriesFor, isVerifiedDirectHire, planDirectHire, visibleDirectHire } from '../src/engine/directHire.ts'

test('直招題效度：官方頁 P0 且信心 high／medium＝已核；已核 ≥2 且覆蓋 ≥60% 才出題（當時值：大陸 2/3 出、海外 24/25 出、香港 1 條不出、澳門臺灣 0）', () => {
  const programs = atlas.programs
  const plan = (d: Parameters<typeof planDirectHire>[0]) => planDirectHire(d, programs)
  const mainland = plan('cn-mainland'), hk = plan('hk'), overseasPlan = plan('overseas'), mo = plan('mo'), tw = plan('tw')
  assert.deepEqual([mainland.verified.length, mainland.total, mainland.question], [2, 3, true])
  assert.deepEqual([hk.verified.length, hk.total, hk.question], [1, 1, false])
  assert.deepEqual([overseasPlan.verified.length, overseasPlan.total, overseasPlan.question], [24, 25, true])
  assert.deepEqual([mo.total, mo.question, tw.total, tw.question], [0, false, 0, false])
  for (const p of [mainland, hk, overseasPlan]) {
    for (const e of p.verified) { assert.equal(tierOf(e.officialUrl), 'P0', e.id); assert.ok(['high', 'medium'].includes(e.confidence)) }
    assert.equal(p.question, p.verified.length >= DIRECT_HIRE_RULE.minVerified && p.coverage >= DIRECT_HIRE_RULE.minCoverage)
  }
  // 目的地互不重疊、合起來是全部條目
  const all = (['cn-mainland', 'hk', 'mo', 'tw', 'overseas'] as const).flatMap((d) => entriesFor(d, programs).map((e) => e.id))
  assert.equal(all.length, programs.length)
  assert.equal(new Set(all).size, programs.length)
  assert.equal(programs.filter(isVerifiedDirectHire).length, 27)
})

test('直招題作答：不考慮＝不列；海外去掉已劃掉的國家；可只看支薪／含在職學位；只在出題的題庫保留作答，分享可往返', () => {
  const overseasPlan = planDirectHire('overseas', atlas.programs)
  assert.deepEqual(visibleDirectHire(overseasPlan, 'no'), [])
  const struck = new Set(['United Kingdom'])
  const left = visibleDirectHire(overseasPlan, 'consider', { struckCountries: struck })
  assert.ok(left.length > 0 && left.every((e) => e.country !== 'United Kingdom'))
  assert.ok(visibleDirectHire(overseasPlan, 'consider', { paidOnly: true }).every((e) => e.paid === 'yes' || e.paid === 'stipend'))
  assert.ok(visibleDirectHire(overseasPlan, 'consider', { degreeOnly: true }).every((e) => e.degree === 'yes' || e.degree === 'partial'))
  const plans = BANKS.map((b) => planFor(b, 'hk'))
  const normalized = normalizeBankAnswers({ overseas: { directHire: ['consider'] }, hk: { directHire: ['no'] } }, plans, new Set<BankId>(['overseas']))
  assert.deepEqual(normalized.overseas?.directHire, ['consider'])
  assert.equal(normalized.hk?.directHire, undefined)
  const decoded = decodeBankAnswers(encodeBankAnswers(['overseas'], normalized))!
  assert.deepEqual(decoded.answers.overseas?.directHire, ['consider'])
  const zhHant = JSON.parse(read('src/i18n/locales/zh-Hant.json')) as Record<string, string>
  for (const k of ['ui.global.q.directHire.title', 'ui.global.q.directHire.hint', 'ui.paths.answer.consider', 'ui.paths.answer.no']) assert.ok(zhHant[k], k)
})

// ---- 批 G8：R2 入庫（澳門公私立、香港學費、澳門管道與聖若瑟、參與名單）
import { notRecruitingFor } from '../src/engine/globalFilter.ts'
import { participationLists } from '../src/data/participationLists.ts'

test('聖若瑟大學：對內地考生只招研究生（官方：目前不招內地本科，不算進池）；對港澳與其他起點照常', () => {
  const usj = items.find((i) => i.id === 'mo-usj')!
  assert.deepEqual([...usj.postgradOnlyFor], ['mainland_gaokao'])
  assert.equal(usj.noUndergrad, false)
  assert.equal(notRecruitingFor(usj, 'cn-mainland'), true)
  for (const o of ['hk', 'mo', 'tw', 'overseas', null] as const) assert.equal(notRecruitingFor(usj, o), false, String(o))
  assert.equal(poolFor(items, ['mo'], 'cn-mainland').some((i) => i.id === 'mo-usj'), false)
  assert.equal(poolFor(items, ['mo'], 'hk').some((i) => i.id === 'mo-usj'), true)
  // 陸生聯招會照舊（招生委員會，全部只招碩博）
  assert.deepEqual(items.filter((i) => i.noUndergrad).map((i) => i.id), ['tw-rusen'])
})

test('澳門管道（R2 原句）：旅遊大學獨立招生、理工與城大單獨招生、鏡湖與中西網上報名系統直接報名，皆 confirmed；公私立只用逐校原句', () => {
  const confirmed = new Set<string>(questionEvidence.channelChecks.confirmed)
  for (const k of ['mo-utm|independent', 'mo-mpu|mainland_gaokao_separate', 'mo-cityu|mainland_gaokao_separate', 'mo-kwnc|direct_online_application', 'mo-mmc|direct_online_application', 'mo-um|independent', 'mo-must|independent']) assert.ok(confirmed.has(k), k)
  assert.ok(questionEvidence.channelChecks.notBachelor.includes('mo-usj|postgraduate_only'))
  assert.deepEqual([...questionEvidence.macauOwnership.public].sort(), ['mo-mpu', 'mo-um', 'mo-utm'])
  assert.deepEqual([...questionEvidence.macauOwnership.private].sort(), ['mo-mim', 'mo-mmc', 'mo-usj'])
  assert.equal(questionEvidence.macauOwnership.unknown.length, 4)
  // 未寫明的 4 所永不劃掉
  const plan = planFor('mo', 'hk')
  const pool = poolFor(items, ['mo'], 'hk')
  for (const v of ['public', 'private']) {
    const r = computeBank(plan, pool, { mo: { moOwnership: [v] } }, ctxFor('hk'))
    for (const id of questionEvidence.macauOwnership.unknown) assert.ok(r.kept.some((k) => k.item.id === id && k.unknown.includes('ownership_unstated')), `${v} ${id}`)
  }
})

test('香港年學費題：最低年學費高於門檻才劃掉；讀不到（都會、聖方濟各）保留；學費全量 14 筆原句含金額；單選', () => {
  assert.equal(questionEvidence.hkTuition.rows.length, 14)
  assert.deepEqual([...questionEvidence.hkTuition.blocked], ['hk-hkmu'])
  assert.deepEqual([...questionEvidence.hkTuition.notApplicable], ['hk-sfu'])
  const plan = planFor('hk', 'tw')
  const pool = poolFor(items, ['hk'], 'tw')
  const r = computeBank(plan, pool, { hk: { hkTuitionCap: ['200000'] } }, ctxFor('tw'))
  const minOf = new Map(questionEvidence.hkTuition.rows.map((x) => [x.id, x.min]))
  for (const c of r.crossed) assert.ok((minOf.get(c.item.id) ?? 0) > 200000, c.item.id)
  for (const k of r.kept) assert.ok(!minOf.has(k.item.id) || minOf.get(k.item.id)! <= 200000, k.item.id)
  assert.ok(r.kept.some((k) => k.item.id === 'hk-hkmu' && k.unknown.includes('tuition_unread')))
  assert.deepEqual(normalizeBankAnswers({ hk: { hkTuitionCap: ['150000', '250000'] } }, [plan]).hk?.hkTuitionCap, ['150000'])
})

test('參與名單（R2）：澳門＝聯招平台院校目錄（只收本科 320 列 → 316 校）、臺灣＝學測名單（450 列 → 448 校）；全部對到教育部 2026 名單', () => {
  const gatzs = participationLists['gatzs-current'], gsat = participationLists['tw-gsat-2026']
  assert.deepEqual([gatzs.origin, gatzs.channel, gatzs.listed, gatzs.count], ['mo', 'joint-admission', 320, 316])
  assert.deepEqual([gsat.origin, gsat.channel, gsat.listed, gsat.count], ['tw', 'tw-gsat', 450, 448])
  const schools = new Set((JSON.parse(read('public/data/runtime/schools.json')) as { id: string }[]).map((s) => s.id))
  for (const l of [gatzs, gsat]) { for (const id of l.schoolIds) assert.ok(schools.has(id), id); assert.equal(new Set(l.schoolIds).size, l.schoolIds.length) }
  const zhHant = JSON.parse(read('src/i18n/locales/zh-Hant.json')) as Record<string, string>
  for (const id of Object.keys(participationLists)) for (const k of ['name', 'year', 'link']) assert.ok(zhHant[`ui.result.route.list.${id}.${k}`], `${id} ${k}`)
})
