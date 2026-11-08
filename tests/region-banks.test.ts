// 按目的地分題庫（2026-11-08 批 G6 擴充，站長「徹底優化題目，不同地區可以不一樣，以效度為準」）閘門：
// 六條效度標準（來源、覆蓋、區分力、準確、疑罪從無、題數與順序）＋池規模；不同起點／目的地出不同題；
// 被捨棄的候選題（英語、學費、澳門公私立、香港 GRAS）有可重算的理由；分享只含選項鍵；與學習證據無交集。
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { buildGlobalPool, poolFor, type GlobalPoolItem } from '../src/engine/globalFilter.ts'
import {
  BANKS, CANDIDATES, VALIDITY, computeBank, decodeBankAnswers, encodeBankAnswers, evaluateBank, normalizeBankAnswers,
  type BankContext, type BankId,
} from '../src/engine/regionBanks.ts'
import { questionEvidence } from '../src/data/questionEvidence.ts'
import { tierOf } from '../src/lib/authorityTier.ts'
import type { OriginRegion } from '../src/data/origins.ts'
import type { OverseasIndexPayload, OverseasRegionPayload } from '../src/data/overseasTypes.ts'
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
  ugcFunded: new Set<string>(questionEvidence.ugcFunded.ids),
  confirmedChannels: new Set<string>(questionEvidence.channelChecks.confirmed),
})
const planFor = (bank: BankId, origin: OriginRegion | null) => evaluateBank(bank, poolFor(items, [bank], origin), ctxFor(origin))
const ids = (bank: BankId, origin: OriginRegion | null) => planFor(bank, origin).questions.map((q) => q.id)

test('各題庫最終題目（當時值）：海外 3、香港對大陸起點 2／其他起點 1、澳門 0、臺灣 0', () => {
  for (const origin of ORIGINS) assert.deepEqual(ids('overseas', origin), ['wanted', 'families', 'regions'], origin)
  assert.deepEqual(ids('hk', 'cn-mainland'), ['hkFunding', 'channels'])
  for (const origin of ['hk', 'mo', 'tw', 'overseas'] as const) assert.deepEqual(ids('hk', origin), ['hkFunding'], origin)
  for (const origin of ORIGINS) { assert.deepEqual(ids('mo', origin), [], origin); assert.deepEqual(ids('tw', origin), [], origin) }
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
  assert.equal(moCn.rejected.find((r) => r.id === 'channels')?.reason, 'coverage') // 原句確認 3/10
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

test('被捨棄的候選（不進引擎）：英語總分、國際生學費覆蓋不足——以海外層地區檔重算', () => {
  const dir = `${root}/public/data/overseas/regions/`
  const inst = readdirSync(dir).flatMap((f) => (JSON.parse(readFileSync(dir + f, 'utf8')) as OverseasRegionPayload).institutions).filter((i) => !/^China-/.test(i.region))
  assert.equal(inst.length, 388)
  const overall = inst.filter((i) => i.english.quotes.some((q) => /IELTS/i.test(q.text) && /overall[^0-9.]{0,40}?[4-8](?:\.[05])?\b|[4-8]\.[05]\s*overall/i.test(q.text.replace(/<[^>]+>/g, ' '))))
  assert.ok(overall.length / inst.length < VALIDITY.minCoverage, `IELTS overall ${overall.length}/${inst.length}`)
  const tuition = inst.filter((i) => i.tuition.quotes.length > 0)
  assert.ok(tuition.length / inst.length < VALIDITY.minCoverage, `tuition ${tuition.length}/${inst.length}`)
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
