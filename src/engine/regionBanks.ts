// 按目的地分題庫（2026-11-08 批 G6 擴充；站長「徹底優化題目，不同地區可以不一樣，以效度為準」）。
// 每個題庫（香港／澳門／臺灣／海外）把候選題放進該題庫的池（含起點：管道只算適用你起點的）逐條核效度，只出通過的題：
//   1 來源：取值來自 P0／P1（候選題定義裡寫明來源與層級；鏈接層級由 authority_tiers 判定，audit:regions 核對）。
//   2 覆蓋：池內有已知取值的機構 ≥60%。
//   3 區分力：去掉「單選就劃光全池」與「劃不掉任何一所」的選項後還有選項。
//   4 準確：機器解析或人工判讀的取值，抽樣（不足 20 則全量）對照原句 ≥95%——證據在 data/research/question_validity/，
//     本引擎只用判讀為 confirmed 的取值（例：港澳院校內地生管道），audit:regions 核對比率。
//   5 疑罪從無：未知值永不劃掉；requires 題（只想讀）未知也保留。
//   6 題數與順序：每個題庫最多 8 題，按「預期劃掉數（各選項單選劃掉數的平均）× 覆蓋率」排序。
//   另：題庫池少於 10 所不出題（減法沒有意義，只列池）。
// 純函式、語言中立：輸出題號、選項值與劃掉數、原因碼；展示層翻譯。不進 AnswerMap、不進 DimensionId、不進 A+ 學習證據、不送 Function。
import type { OriginRegion } from '../data/origins'
import type { GlobalDestination } from './flowPlan'
import { applicableChannels, type GlobalPoolItem } from './globalFilter'

export type BankId = GlobalDestination
/** 題庫順序＝目的地順序。 */
export const BANKS: readonly BankId[] = ['hk', 'mo', 'tw', 'overseas']

export type RegionQuestionId = 'wanted' | 'regions' | 'families' | 'hkFunding' | 'channels'
export type QuestionKind = 'strike' | 'requires'

export const VALIDITY = { minCoverage: 0.6, minPool: 10, maxQuestions: 8, minAccuracy: 0.95, minSample: 20 } as const

export interface BankContext {
  /** GRAS 學科代碼 → 門類代碼。 */
  familyOf: ReadonlyMap<string, string>
  /** 門類與學科的顯示順序（GRAS）。 */
  familyOrder: readonly string[]
  subjectOrder: readonly string[]
  origin: OriginRegion | null
  /** 香港教資會資助大學（官方名單）。 */
  ugcFunded: ReadonlySet<string>
  /** 原句人工判讀為 confirmed 的管道（`${institutionId}|${channelCode}`）。 */
  confirmedChannels: ReadonlySet<string>
}

export interface CandidateDef {
  id: RegionQuestionId
  kind: QuestionKind
  banks: readonly BankId[]
  /** 取值來源與層級（P0 官方／P1 權威平台）。 */
  source: { tier: 'P0' | 'P1'; ref: string; url: string }
  /** 機構在本題的取值；null＝未知。 */
  values: (item: GlobalPoolItem, ctx: BankContext) => readonly string[] | null
  /** 選項顯示順序。 */
  order?: (ctx: BankContext) => readonly string[]
  /** 是否需要原句抽樣核對（準確度標準 4）。 */
  sampled: boolean
}

const GRAS = { tier: 'P1' as const, ref: '軟科世界一流學科排名 GRAS 2026', url: 'https://www.shanghairanking.com/rankings/gras/2026' }

export const CANDIDATES: readonly CandidateDef[] = [
  {
    id: 'wanted', kind: 'requires', banks: BANKS, source: GRAS, sampled: false,
    values: (item) => item.subjects ?? null,
    order: (ctx) => ctx.subjectOrder,
  },
  {
    id: 'regions', kind: 'strike', banks: BANKS, source: GRAS, sampled: false,
    values: (item) => [item.region],
  },
  {
    id: 'families', kind: 'strike', banks: BANKS, source: GRAS, sampled: false,
    values: (item, ctx) => (item.subjects ? [...new Set(item.subjects.map((s) => ctx.familyOf.get(s) ?? ''))].filter(Boolean).sort() : null),
    order: (ctx) => ctx.familyOrder,
  },
  {
    id: 'hkFunding', kind: 'strike', banks: ['hk'], source: { tier: 'P0', ref: '大學教育資助委員會「教資會資助大學」', url: 'https://www.ugc.edu.hk/big5/ugc/site/fund_inst.html' }, sampled: true,
    values: (item, ctx) => (item.destination === 'hk' ? [ctx.ugcFunded.has(item.id) ? 'ugc' : 'other'] : null),
    order: () => ['ugc', 'other'],
  },
  {
    id: 'channels', kind: 'strike', banks: ['hk', 'mo', 'tw'], source: { tier: 'P0', ref: '各院校官方招生頁（港澳臺院校池，原句人工判讀 confirmed）', url: '' }, sampled: true,
    values: (item, ctx) => {
      const own = applicableChannels(item, ctx.origin)
      if (!own) return null
      const confirmed = own.filter((code) => ctx.confirmedChannels.has(`${item.id}|${code}`))
      return confirmed.length ? confirmed : null
    },
  },
]

export interface EvaluatedOption { value: string; crossed: number }
export interface EvaluatedQuestion {
  id: RegionQuestionId
  kind: QuestionKind
  source: CandidateDef['source']
  known: number
  coverage: number
  options: EvaluatedOption[]
  expectedCrossed: number
  score: number
}
export type RejectReason = 'pool_small' | 'coverage' | 'no_effect' | 'over_limit'
export interface RejectedQuestion { id: RegionQuestionId; reason: RejectReason; known: number; coverage: number }
export interface BankPlan { bank: BankId; pool: number; questions: EvaluatedQuestion[]; rejected: RejectedQuestion[] }

/** 單一機構在某題、給定選擇下是否被劃掉（未知永不劃掉）。 */
function crossedBy(kind: QuestionKind, values: readonly string[] | null, chosen: ReadonlySet<string>): boolean {
  if (!values || values.length === 0 || chosen.size === 0) return false
  if (kind === 'strike') return values.every((v) => chosen.has(v))
  return !values.some((v) => chosen.has(v))
}

/** 一個題庫的出題計畫：每個候選題核覆蓋、區分力，排序、截到 8 題。 */
export function evaluateBank(bank: BankId, pool: readonly GlobalPoolItem[], ctx: BankContext): BankPlan {
  const rejected: RejectedQuestion[] = []
  const passed: EvaluatedQuestion[] = []
  for (const def of CANDIDATES.filter((c) => c.banks.includes(bank))) {
    const vals = pool.map((item) => def.values(item, ctx))
    const known = vals.filter((v) => v && v.length).length
    const coverage = pool.length ? known / pool.length : 0
    if (pool.length < VALIDITY.minPool) { rejected.push({ id: def.id, reason: 'pool_small', known, coverage }); continue }
    if (coverage < VALIDITY.minCoverage) { rejected.push({ id: def.id, reason: 'coverage', known, coverage }); continue }
    const present = new Set(vals.flatMap((v) => v ?? []))
    const order = def.order ? def.order(ctx).filter((v) => present.has(v)) : []
    const rest = [...present].filter((v) => !order.includes(v))
    const counts = new Map<string, number>()
    for (const v of vals) for (const x of v ?? []) counts.set(x, (counts.get(x) ?? 0) + 1)
    rest.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b, 'en'))
    const options = [...order, ...rest]
      .map((value) => ({ value, crossed: vals.filter((v) => crossedBy(def.kind, v, new Set([value]))).length }))
      .filter((o) => o.crossed > 0 && o.crossed < pool.length)
    if (!options.length) { rejected.push({ id: def.id, reason: 'no_effect', known, coverage }); continue }
    const expectedCrossed = options.reduce((s, o) => s + o.crossed, 0) / options.length
    passed.push({ id: def.id, kind: def.kind, source: def.source, known, coverage, options, expectedCrossed, score: expectedCrossed * coverage })
  }
  passed.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  for (const q of passed.slice(VALIDITY.maxQuestions)) rejected.push({ id: q.id, reason: 'over_limit', known: q.known, coverage: q.coverage })
  return { bank, pool: pool.length, questions: passed.slice(0, VALIDITY.maxQuestions), rejected }
}

/** 作答：題庫 → 題號 → 選中的選項值；'directHire'＝非大學路徑題（批 G7，src/engine/directHire.ts，不劃掉學校）。 */
export type BankAnswers = Partial<Record<BankId, Partial<Record<RegionQuestionId | 'directHire', string[]>>>>

/** 只留出題計畫裡存在的題與選項。 */
export function normalizeBankAnswers(answers: BankAnswers | null | undefined, plans: readonly BankPlan[], pathQuestionBanks: ReadonlySet<BankId> = new Set()): BankAnswers {
  const out: BankAnswers = {}
  for (const plan of plans) {
    const given = answers?.[plan.bank]
    if (!given) continue
    const bankOut: Partial<Record<RegionQuestionId | 'directHire', string[]>> = {}
    for (const q of plan.questions) {
      const allowed = new Set(q.options.map((o) => o.value))
      const picked = [...new Set((given[q.id] ?? []).filter((v) => typeof v === 'string' && allowed.has(v)))].sort()
      if (picked.length) bankOut[q.id] = picked
    }
    // 非大學路徑題只在該題庫出題時保留，值只能是 consider／no 其一
    const path = given.directHire?.[0]
    if (pathQuestionBanks.has(plan.bank) && (path === 'consider' || path === 'no')) bankOut.directHire = [path]
    if (Object.keys(bankOut).length) out[plan.bank] = bankOut
  }
  return out
}

export interface BankReason { question: RegionQuestionId; values: string[] }
export type BankUnknown = 'subjects_no_gras' | 'channels_unconfirmed' | 'channels_none_applicable'
export interface BankKept { item: GlobalPoolItem; unknown: BankUnknown[] }
export interface BankCrossed { item: GlobalPoolItem; reasons: BankReason[] }
export interface BankResult { bank: BankId; pool: number; kept: BankKept[]; crossed: BankCrossed[] }

/** 某題庫的減法結果（題目只算出題計畫裡的）；可傳 uptoQuestion 只算前幾題（逐題流程的即時剩餘）。 */
export function computeBank(plan: BankPlan, pool: readonly GlobalPoolItem[], answers: BankAnswers, ctx: BankContext, uptoQuestion = Infinity): BankResult {
  const given = answers[plan.bank] ?? {}
  const questions = plan.questions.slice(0, uptoQuestion)
  const defs = new Map(CANDIDATES.map((c) => [c.id, c]))
  const kept: BankKept[] = []
  const crossed: BankCrossed[] = []
  for (const item of pool) {
    const reasons: BankReason[] = []
    const unknown = new Set<BankUnknown>()
    for (const q of questions) {
      const chosen = new Set(given[q.id] ?? [])
      if (!chosen.size) continue
      const values = defs.get(q.id)!.values(item, ctx)
      if (crossedBy(q.kind, values, chosen)) reasons.push({ question: q.id, values: [...(values ?? [])] })
      else if (!values || !values.length) {
        if (q.id === 'wanted' || q.id === 'families') unknown.add('subjects_no_gras')
        if (q.id === 'channels') unknown.add((applicableChannels(item, ctx.origin)?.length ?? 0) > 0 ? 'channels_unconfirmed' : 'channels_none_applicable')
      }
    }
    if (reasons.length) crossed.push({ item, reasons })
    else kept.push({ item, unknown: [...unknown] })
  }
  return { bank: plan.bank, pool: pool.length, kept, crossed }
}

// ---- 分享：只含選項鍵（目的地與各題庫各題的選項值），不含起點、資格或個人資料 ----
export function encodeBankAnswers(destinations: readonly BankId[], answers: BankAnswers): string {
  const params = new URLSearchParams()
  if (destinations.length) params.set('d', destinations.join('|'))
  for (const bank of BANKS) for (const [q, values] of Object.entries(answers[bank] ?? {})) if (values?.length) params.set(`${bank}.${q}`, values.join('|'))
  return params.toString()
}

export function decodeBankAnswers(query: string): { destinations: BankId[]; answers: BankAnswers } | null {
  const params = new URLSearchParams(query.replace(/^\?/, ''))
  const keys = [...params.keys()]
  if (!keys.length) return null
  let destinations = (params.get('d') ?? '').split('|').filter((d): d is BankId => (BANKS as readonly string[]).includes(d))
  // 批 G2 的舊鏈接（p＝池）換算成目的地
  if (!destinations.length && params.has('p')) {
    const pools = (params.get('p') ?? '').split('|')
    destinations = [...(pools.includes('hkmotw') ? (['hk', 'mo', 'tw'] as BankId[]) : []), ...(pools.includes('overseas') ? (['overseas'] as BankId[]) : [])]
  }
  const answers: BankAnswers = {}
  for (const key of keys) {
    const [bank, q] = key.split('.')
    if (!q || !(BANKS as readonly string[]).includes(bank) || !(CANDIDATES.some((c) => c.id === q) || q === 'directHire')) continue
    const target = (answers[bank as BankId] ??= {})
    target[q as RegionQuestionId | 'directHire'] = (params.get(key) ?? '').split('|').filter(Boolean)
  }
  if (!destinations.length && !Object.keys(answers).length) return null
  return { destinations, answers }
}

export const BANK_STORAGE_KEY = 'unapply.regionBanks.v1'
