// 全球池減法（路線圖 S4 完成定義「任一起點都能走完減法並得到可追溯的剩餘集合」，批 G2，DECISIONS.md）。
// 池＝海外可申請學校層（S3，GRAS 2026 前 50 的非大陸機構）＋港澳臺院校池（S2 後半）；題目只用已入庫的官方或權威資料：
//   地區（GRAS 地區碼）、GRAS 2026 學科門類／學科（前 50 席位）、港澳臺池已記錄的招生管道對象類型。
// 純函式、語言中立：輸出逐條機器原因碼（題目＋規則＋該校取值），展示層（src/components/GlobalSubtraction.tsx）翻譯。
// 疑罪從無：取值未知（GRAS 無資料、港澳臺池未記錄管道、你這類考生的管道未入庫）永不劃掉；資格只標示、永不劃掉；
// 「官方頁本站未讀到」不是取值，永不作劃掉依據。
// 這一層是展示層：不進 AnswerMap、不進 DimensionId、不進 A+ 學習證據、不送 Function（tests/global-subtraction.test.ts 斷言）。
import type { HkMoTwPoolPayload, HkMoTwRegion } from '../data/hkmotwTypes'
import type { OriginRegion } from '../data/origins'
import type { Scope } from '../data/originBranch'
import type { OverseasIndexPayload, OverseasStatus } from '../data/overseasTypes'
import type { WorldAtlasPayload } from '../data/worldAtlasTypes'

export type GlobalPool = 'overseas' | 'hkmotw'
export const GLOBAL_POOLS: readonly GlobalPool[] = ['overseas', 'hkmotw']

/** 港澳臺池已記錄的管道對象（hkmotw_admission_channels 的 audience 欄）。 */
export type ChannelAudience = 'mainland_gaokao' | 'hk_macao_students'
export const CHANNEL_AUDIENCES: readonly ChannelAudience[] = ['mainland_gaokao', 'hk_macao_students']

/** 港澳臺池地區 → GRAS 地區碼（與海外層同一套，讓「地區」題同時作用於兩個池）。 */
export const HKMOTW_REGION_CODE: Record<HkMoTwRegion, string> = { HK: 'China-Hong Kong', MO: 'China-Macau', TW: 'China-Taiwan' }

export interface GlobalPoolItem {
  /** `${pool}:${id}`，在全池唯一。 */
  key: string
  pool: GlobalPool
  id: string
  /** GRAS 地區碼。 */
  region: string
  /** GRAS 2026 前 50 的學科代碼（排序）；null＝GRAS 無資料（未知）。 */
  subjects: readonly string[] | null
  /** 港澳臺池已記錄管道的對象（排序去重）；海外層為 null（不適用）；港澳臺池未記錄任何管道為 []（未知）。 */
  audiences: readonly ChannelAudience[] | null
  /** 海外層的官方頁核查狀態（只供資格標示用；不作劃掉依據）；港澳臺池為 null。 */
  status: OverseasStatus | null
}

export interface GlobalSelection {
  pools: readonly GlobalPool[]
  /** (a) 一定不去的國家／地區（GRAS 地區碼）。 */
  struckRegions: readonly string[]
  /** (b1) 一定不讀的 GRAS 學科門類代碼。 */
  struckFamilies: readonly string[]
  /** (b2) 只想讀的 GRAS 學科代碼（requires）。 */
  wantedSubjects: readonly string[]
  /** (c) 不會走的港澳臺招生管道對象類型。 */
  struckAudiences: readonly ChannelAudience[]
}

export const emptyGlobalSelection = (pools: readonly GlobalPool[] = GLOBAL_POOLS): GlobalSelection => ({ pools: [...pools], struckRegions: [], struckFamilies: [], wantedSubjects: [], struckAudiences: [] })

export type GlobalQuestion = 'regions' | 'families' | 'wanted' | 'channels'
export const GLOBAL_QUESTIONS: readonly GlobalQuestion[] = ['regions', 'families', 'wanted', 'channels']

/** 劃掉原因（機器碼）：題目＋規則＋該校取值。 */
export type GlobalReason =
  | { question: 'regions'; rule: 'region_struck'; region: string }
  | { question: 'families'; rule: 'all_top50_in_struck_families'; families: string[]; subjects: string[] }
  | { question: 'wanted'; rule: 'no_top50_in_wanted'; wanted: string[]; subjects: string[] }
  | { question: 'channels'; rule: 'all_recorded_channels_struck'; audiences: ChannelAudience[] }

/** 保留下來但某題取值未知的原因（展示用「保持未知」）。 */
export type GlobalUnknown = 'subjects_no_gras' | 'channels_none_recorded' | 'channels_own_route_unrecorded'

export interface GlobalKept { item: GlobalPoolItem; unknown: GlobalUnknown[] }
export interface GlobalCrossed { item: GlobalPoolItem; reasons: GlobalReason[] }

export interface GlobalResult {
  kept: GlobalKept[]
  crossed: GlobalCrossed[]
  counts: {
    pool: number
    byPool: Record<GlobalPool, number>
    kept: number
    keptByPool: Record<GlobalPool, number>
    crossed: number
    /** 每題劃掉的機構數（一所可被多題劃掉，故總和可大於 crossed）。 */
    byQuestion: Record<GlobalQuestion, number>
  }
}

export interface GlobalContext {
  /** 學科代碼 → 門類代碼（GRAS 2026）。 */
  familyOf: ReadonlyMap<string, string>
  /** 你這類考生在港澳臺池裡的管道對象（由起點推出）；null＝你這類考生的管道未入庫。 */
  userAudience: ChannelAudience | null
}

/** 起點 → 港澳臺池裡「你這類考生」的管道對象：大陸＝內地高考生；港澳＝港澳學生；臺灣／海外／未選＝未入庫。 */
export function audienceForOrigin(origin: OriginRegion | null): ChannelAudience | null {
  if (origin === 'cn-mainland') return 'mainland_gaokao'
  if (origin === 'hk' || origin === 'mo') return 'hk_macao_students'
  return null
}

/** 依起點與範圍的預設池：港澳臺起點預設兩者（local＝只港澳臺池、abroad＝只海外層）；海外起點預設海外層；大陸或未選＝兩者。可切換。 */
export function defaultPools(origin: OriginRegion | null, scope: Scope | null): GlobalPool[] {
  if (origin === 'overseas') return ['overseas']
  if (origin === 'hk' || origin === 'mo' || origin === 'tw') {
    if (scope === 'local') return ['hkmotw']
    if (scope === 'abroad') return ['overseas']
  }
  return ['overseas', 'hkmotw']
}

const sortedUnique = <T extends string>(values: Iterable<T>): T[] => [...new Set(values)].sort()

/** 由三個既有 payload 組成全球池（海外層 403＋港澳臺池 27，當時值）。 */
export function buildGlobalPool(overseas: Pick<OverseasIndexPayload, 'institutions'>, hkmotw: Pick<HkMoTwPoolPayload, 'institutions'>, atlas: Pick<WorldAtlasPayload, 'institutions'>): GlobalPoolItem[] {
  const ranks = new Map(atlas.institutions.map((i) => [i.id, Object.keys(i.ranks)]))
  const gras = (id: string | null): string[] | null => {
    if (!id) return null
    const subjects = ranks.get(id)
    return subjects && subjects.length > 0 ? [...subjects].sort() : null
  }
  const items: GlobalPoolItem[] = []
  for (const inst of overseas.institutions) {
    items.push({ key: `overseas:${inst.id}`, pool: 'overseas', id: inst.id, region: inst.region, subjects: gras(inst.id), audiences: null, status: inst.status })
  }
  for (const inst of hkmotw.institutions) {
    const audiences = sortedUnique(inst.channels.map((c) => c.audience).filter((a): a is ChannelAudience => (CHANNEL_AUDIENCES as readonly string[]).includes(a)))
    items.push({ key: `hkmotw:${inst.id}`, pool: 'hkmotw', id: inst.id, region: HKMOTW_REGION_CODE[inst.region], subjects: gras(inst.atlasId), audiences, status: null })
  }
  return items
}

export interface GlobalOptions {
  regions: readonly string[]
  families: readonly string[]
  subjects: readonly string[]
}

/** 只保留池裡真的存在的選項鍵；去重排序；想讀的學科若屬於已劃掉的門類則丟掉（兩題不互相矛盾）。 */
export function normalizeGlobalSelection(selection: Partial<GlobalSelection> | null | undefined, options: GlobalOptions, familyOf: ReadonlyMap<string, string>, fallbackPools: readonly GlobalPool[] = GLOBAL_POOLS): GlobalSelection {
  const pick = <T extends string>(values: unknown, allowed: readonly T[]): T[] => sortedUnique((Array.isArray(values) ? values : []).filter((v): v is T => typeof v === 'string' && (allowed as readonly string[]).includes(v)))
  const pools = pick(selection?.pools, GLOBAL_POOLS)
  const struckFamilies = pick(selection?.struckFamilies, options.families)
  const struck = new Set(struckFamilies)
  return {
    pools: pools.length ? GLOBAL_POOLS.filter((p) => pools.includes(p)) : [...fallbackPools],
    struckRegions: pick(selection?.struckRegions, options.regions),
    struckFamilies,
    wantedSubjects: pick(selection?.wantedSubjects, options.subjects).filter((s) => !struck.has(familyOf.get(s) ?? '')),
    struckAudiences: pick(selection?.struckAudiences, CHANNEL_AUDIENCES),
  }
}

/** 減法本體。題目全部可跳過（空陣列＝跳過）；一所機構被任一題命中即劃掉，原因逐條保留。 */
export function computeGlobal(items: readonly GlobalPoolItem[], selection: GlobalSelection, context: GlobalContext): GlobalResult {
  const pools = new Set(selection.pools)
  const regions = new Set(selection.struckRegions)
  const families = new Set(selection.struckFamilies)
  const wanted = new Set(selection.wantedSubjects)
  const audiences = new Set(selection.struckAudiences)
  const kept: GlobalKept[] = []
  const crossed: GlobalCrossed[] = []
  const byQuestion: Record<GlobalQuestion, number> = { regions: 0, families: 0, wanted: 0, channels: 0 }
  const byPool: Record<GlobalPool, number> = { overseas: 0, hkmotw: 0 }
  const keptByPool: Record<GlobalPool, number> = { overseas: 0, hkmotw: 0 }
  for (const item of items) {
    if (!pools.has(item.pool)) continue
    byPool[item.pool] += 1
    const reasons: GlobalReason[] = []
    const unknown: GlobalUnknown[] = []
    // (a) 地區：地區碼一定已知。
    if (regions.has(item.region)) reasons.push({ question: 'regions', rule: 'region_struck', region: item.region })
    // (b1) 門類：只有「所有前 50 學科都落在被劃掉的門類」才劃掉；GRAS 無資料＝未知、保留。
    // (b2) 只想讀：機構在所選學科至少有一個前 50 席位才保留；GRAS 無資料＝未知、保留。
    if (families.size > 0 || wanted.size > 0) {
      if (!item.subjects) unknown.push('subjects_no_gras')
      else {
        const subjects = [...item.subjects]
        const fams = sortedUnique(subjects.map((s) => context.familyOf.get(s) ?? ''))
        if (families.size > 0 && fams.every((f) => f && families.has(f))) reasons.push({ question: 'families', rule: 'all_top50_in_struck_families', families: fams, subjects })
        if (wanted.size > 0 && !subjects.some((s) => wanted.has(s))) reasons.push({ question: 'wanted', rule: 'no_top50_in_wanted', wanted: [...wanted].sort(), subjects })
      }
    }
    // (c) 港澳臺管道：只對港澳臺池；機構「已記錄的所有管道」都被劃掉、而且你這類考生的管道在已記錄之列才劃掉；
    //     沒有記錄任何管道、或你這類考生的管道未入庫＝未知、保留。
    if (audiences.size > 0 && item.audiences) {
      if (item.audiences.length === 0) unknown.push('channels_none_recorded')
      else if (!context.userAudience || !item.audiences.includes(context.userAudience)) unknown.push('channels_own_route_unrecorded')
      else if (item.audiences.every((a) => audiences.has(a))) reasons.push({ question: 'channels', rule: 'all_recorded_channels_struck', audiences: [...item.audiences] })
    }
    if (reasons.length) {
      crossed.push({ item, reasons })
      for (const q of new Set(reasons.map((r) => r.question))) byQuestion[q] += 1
    } else {
      kept.push({ item, unknown })
      keptByPool[item.pool] += 1
    }
  }
  return { kept, crossed, counts: { pool: byPool.overseas + byPool.hkmotw, byPool, kept: kept.length, keptByPool, crossed: crossed.length, byQuestion } }
}

/** 池裡實際出現的選項（地區按機構數排序；門類與學科照 GRAS 順序）。 */
export function globalOptions(items: readonly GlobalPoolItem[], pools: readonly GlobalPool[], atlas: Pick<WorldAtlasPayload, 'families' | 'subjects'>): GlobalOptions & { regionCounts: Record<string, number> } {
  const active = new Set(pools)
  const regionCounts: Record<string, number> = {}
  for (const item of items) if (active.has(item.pool)) regionCounts[item.region] = (regionCounts[item.region] ?? 0) + 1
  const regions = Object.keys(regionCounts).sort((a, b) => regionCounts[b] - regionCounts[a] || a.localeCompare(b, 'en'))
  return { regions, regionCounts, families: atlas.families.map((f) => f.code), subjects: atlas.subjects.map((s) => s.code) }
}

/** 資格標示（保留語義，永不劃掉）：海外層 verified 機構命中 token → listed；其餘海外層 → unread（保留）；港澳臺池 → na（資格標示只適用於海外層）。 */
export type QualificationMarkCode = 'listed' | 'unread' | 'na'
export function qualificationMark(item: GlobalPoolItem, hits: ReadonlySet<string> | null): QualificationMarkCode | null {
  if (!hits) return null
  if (item.pool !== 'overseas') return 'na'
  return item.status === 'verified' && hits.has(item.id) ? 'listed' : 'unread'
}

// ---- 分享：只含選項鍵（池、地區碼、門類／學科代碼、管道對象），不含任何個人資料或起點／資格 ----
const SHARE_KEYS = { pools: 'p', struckRegions: 'r', struckFamilies: 'f', wantedSubjects: 'w', struckAudiences: 'c' } as const

export function encodeGlobalSelection(selection: GlobalSelection): string {
  const params = new URLSearchParams()
  for (const [field, key] of Object.entries(SHARE_KEYS) as [keyof GlobalSelection, string][]) {
    const values = selection[field]
    if (values.length) params.set(key, values.join('|'))
  }
  return params.toString()
}

export function decodeGlobalSelection(query: string, options: GlobalOptions, familyOf: ReadonlyMap<string, string>): GlobalSelection | null {
  const params = new URLSearchParams(query.replace(/^\?/, ''))
  if (![...Object.values(SHARE_KEYS)].some((k) => params.has(k))) return null
  const raw: Partial<Record<keyof GlobalSelection, string[]>> = {}
  for (const [field, key] of Object.entries(SHARE_KEYS) as [keyof GlobalSelection, string][]) raw[field] = (params.get(key) ?? '').split('|').filter(Boolean)
  return normalizeGlobalSelection(raw as Partial<GlobalSelection>, options, familyOf)
}

export const GLOBAL_STORAGE_KEY = 'unapply.globalSubtraction.v1'
