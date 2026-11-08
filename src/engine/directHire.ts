// 非大學路徑：企業直招（2026-11-08 批 G7，路線圖目標第 5 條「企業直招也列入減法選項」）。純函式、語言中立。
// 條目來自全球學科地圖的直招層（world-atlas programs，建置期已濾掉 unverified）；依使用者目的地的國家／地區過濾。
// 「你考不考慮不讀大學、直接進企業的路徑？」同樣走效度規則（docs/QUESTION_VALIDITY.md）：
//   來源＝條目自己的官方頁且 authority_tiers 判定 P0、核對信心 high／medium（＝已核）；已核 ≥2 條且已核／全部 ≥60% 才出題。
// 這題不劃掉任何學校：選「不考慮」只讓結果頁不列這一區。不進 AnswerMap、不進 A+ 學習證據。
import { tierOf } from '../lib/authorityTier'
import type { BankId } from './regionBanks'

export interface DirectHireEntry {
  id: string
  country: string
  officialUrl: string
  confidence: string
  /** yes／no／stipend／unknown */
  paid: string
  /** yes／no／partial／unknown */
  degree: string
}

export type PathDestination = BankId | 'cn-mainland'
export const DIRECT_HIRE_RULE = { minVerified: 2, minCoverage: 0.6 } as const
/** 目的地 → 直招條目的 country 欄；海外＝其他所有國家。 */
export const DIRECT_HIRE_COUNTRY: Readonly<Record<Exclude<PathDestination, 'overseas'>, string>> = { 'cn-mainland': 'China', hk: 'Hong Kong', mo: 'Macao', tw: 'Taiwan' }
const NON_OVERSEAS = new Set(Object.values(DIRECT_HIRE_COUNTRY))

export type PathAnswer = 'consider' | 'no'
export const PATH_ANSWERS: readonly PathAnswer[] = ['consider', 'no']
export const DIRECT_HIRE_QUESTION = 'directHire' as const

export function entriesFor<T extends DirectHireEntry>(destination: PathDestination, entries: readonly T[]): T[] {
  return entries.filter((e) => (destination === 'overseas' ? !NON_OVERSEAS.has(e.country) : e.country === DIRECT_HIRE_COUNTRY[destination]))
}

/** 已核：官方頁是 P0，且核對信心 high／medium。 */
export function isVerifiedDirectHire(entry: DirectHireEntry): boolean {
  return tierOf(entry.officialUrl) === 'P0' && (entry.confidence === 'high' || entry.confidence === 'medium')
}

export interface PathPlan<T extends DirectHireEntry = DirectHireEntry> {
  destination: PathDestination
  total: number
  verified: T[]
  coverage: number
  /** 出不出「考不考慮直招」這題。 */
  question: boolean
}

export function planDirectHire<T extends DirectHireEntry>(destination: PathDestination, entries: readonly T[]): PathPlan<T> {
  const all = entriesFor(destination, entries)
  const verified = all.filter(isVerifiedDirectHire)
  const coverage = all.length ? verified.length / all.length : 0
  return { destination, total: all.length, verified, coverage, question: verified.length >= DIRECT_HIRE_RULE.minVerified && coverage >= DIRECT_HIRE_RULE.minCoverage }
}

export function normalizePathAnswer(value: unknown): PathAnswer | null {
  const v = Array.isArray(value) ? value[0] : value
  return v === 'consider' || v === 'no' ? v : null
}

/** 結果頁要列的直招：答「不考慮」＝不列；海外再去掉使用者已劃掉的國家；可只看支薪、只看含在職學位。 */
export function visibleDirectHire<T extends DirectHireEntry>(plan: PathPlan<T>, answer: PathAnswer | null, opts: { struckCountries?: ReadonlySet<string>; paidOnly?: boolean; degreeOnly?: boolean } = {}): T[] {
  if (answer === 'no') return []
  return plan.verified.filter((e) => !(opts.struckCountries?.has(e.country))
    && (!opts.paidOnly || e.paid === 'yes' || e.paid === 'stipend')
    && (!opts.degreeOnly || e.degree === 'yes' || e.degree === 'partial'))
}
