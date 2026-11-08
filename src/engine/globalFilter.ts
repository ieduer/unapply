// 全球池減法（路線圖 S4 完成定義「任一起點都能走完減法並得到可追溯的剩餘集合」，批 G2；2026-11-08 批 G6 依目的地重做）。
// 池＝所選目的地的機構：香港／澳門／臺灣＝港澳臺院校池該地區＋海外可申請學校層（S3）裡同地區、未與院校池重複的機構；
//   海外＝海外可申請學校層去掉港澳臺三地區。院校池與海外層同一所（院校池 atlasId＝海外層 id）只算一所（院校池那筆，帶海外層招生頁）。
// 題目只用已入庫的官方或權威資料，而且只在「問了劃得動」時出現：
//   地區（池內地區 ≥2）、GRAS 2026 學科門類／學科（池內有 GRAS 資料的機構 ≥5）、
//   港澳臺院校池已記錄、而且適用你這個起點的本科招生管道類型（≥2 種）。
// 官方已明確「目前不招本科」的條目（所有已記錄管道都只招碩博士）不算進池與剩下，另列一節（已知事實，不是未知）。
// 純函式、語言中立：輸出逐條機器原因碼（題目＋規則＋該校取值），展示層（src/components/GlobalSubtraction.tsx）翻譯。
// 疑罪從無：取值未知（GRAS 無資料、沒有記錄適用你的管道）永不劃掉；資格只標示、永不劃掉；「官方頁本站未讀到」不是取值，永不作劃掉依據。
// 這一層是展示層：不進 AnswerMap、不進 DimensionId、不進 A+ 學習證據、不送 Function（tests/global-subtraction.test.ts 斷言）。
import type { HkMoTwPoolPayload, HkMoTwRegion } from '../data/hkmotwTypes'
import type { OriginRegion } from '../data/origins'
import type { OverseasIndexPayload, OverseasStatus } from '../data/overseasTypes'
import type { WorldAtlasPayload } from '../data/worldAtlasTypes'
import { GLOBAL_DESTINATIONS, type GlobalDestination } from './flowPlan'

export { GLOBAL_DESTINATIONS, type GlobalDestination }

/** 資料來源（機構卡怎麼畫）：海外可申請學校層或港澳臺院校池。 */
export type GlobalPool = 'overseas' | 'hkmotw'

/** 港澳臺池已記錄的管道對象（hkmotw_admission_channels 的 audience 欄）。 */
export type ChannelAudience = 'mainland_gaokao' | 'hk_macao_students'
export const CHANNEL_AUDIENCES: readonly ChannelAudience[] = ['mainland_gaokao', 'hk_macao_students']

/** 港澳臺池地區 → GRAS 地區碼（與海外層同一套）。 */
export const HKMOTW_REGION_CODE: Record<HkMoTwRegion, string> = { HK: 'China-Hong Kong', MO: 'China-Macau', TW: 'China-Taiwan' }
const DESTINATION_OF_REGION: Record<string, GlobalDestination> = { 'China-Hong Kong': 'hk', 'China-Macau': 'mo', 'China-Taiwan': 'tw' }
const HKMOTW_DESTINATION: Record<HkMoTwRegion, GlobalDestination> = { HK: 'hk', MO: 'mo', TW: 'tw' }

/** 題目出現門檻（批 G6 裁定 B）。 */
export const REGION_QUESTION_MIN = 2
export const SUBJECT_QUESTION_MIN = 5
export const CHANNEL_QUESTION_MIN = 2

/** 只招碩博士、不招本科的管道碼（陸生聯招會 2026 只辦理碩博士班）。 */
export const NON_UNDERGRAD_CHANNELS: readonly string[] = ['postgraduate_only']

export interface GlobalChannel { code: string; audience: ChannelAudience; undergrad: boolean }

export interface GlobalPoolItem {
  /** `${pool}:${id}`，在全池唯一。 */
  key: string
  pool: GlobalPool
  id: string
  /** GRAS 地區碼。 */
  region: string
  destination: GlobalDestination
  /** GRAS 2026 前 50 的學科代碼（排序）；null＝GRAS 無資料（未知）。 */
  subjects: readonly string[] | null
  /** 港澳臺池已記錄的管道（排序）；海外層為 null（不適用）；港澳臺池未記錄任何管道為 []。 */
  channels: readonly GlobalChannel[] | null
  /** 海外層招生頁的機構 id（海外層自己＝id；院校池與海外層重複者＝海外層 id；其餘 null）。 */
  overseasId: string | null
  /** 海外層的官方頁核查狀態（只供資格標示；不作劃掉依據）。 */
  status: OverseasStatus | null
  /** 官方已明確目前不招本科（已記錄管道全部是非本科管道）。 */
  noUndergrad: boolean
  /** 聯合招生委員會（臺灣陸生聯招會／海外聯招會）：是管道彙整，不是單一院校。 */
  committee: boolean
}

export interface GlobalSelection {
  /** 池的目的地（不含中國大陸；至少一個）。 */
  destinations: readonly GlobalDestination[]
  /** (a) 一定不去的國家／地區（GRAS 地區碼）。 */
  struckRegions: readonly string[]
  /** (b1) 一定不讀的 GRAS 學科門類代碼。 */
  struckFamilies: readonly string[]
  /** (b2) 只想讀的 GRAS 學科代碼（requires）。 */
  wantedSubjects: readonly string[]
  /** (c) 不會走的招生管道類型（只限適用你起點的管道碼）。 */
  struckChannels: readonly string[]
}

export const emptyGlobalSelection = (destinations: readonly GlobalDestination[] = GLOBAL_DESTINATIONS): GlobalSelection => ({ destinations: [...destinations], struckRegions: [], struckFamilies: [], wantedSubjects: [], struckChannels: [] })

export type GlobalQuestion = 'regions' | 'families' | 'wanted' | 'channels'
export const GLOBAL_QUESTIONS: readonly GlobalQuestion[] = ['regions', 'families', 'wanted', 'channels']

/** 劃掉原因（機器碼）：題目＋規則＋該校取值。 */
export type GlobalReason =
  | { question: 'regions'; rule: 'region_struck'; region: string }
  | { question: 'families'; rule: 'all_top50_in_struck_families'; families: string[]; subjects: string[] }
  | { question: 'wanted'; rule: 'no_top50_in_wanted'; wanted: string[]; subjects: string[] }
  | { question: 'channels'; rule: 'all_applicable_channels_struck'; channels: string[] }

/** 保留下來但某題取值未知的原因（展示用「保持未知」）。 */
export type GlobalUnknown = 'subjects_no_gras' | 'channels_none_applicable'

export interface GlobalKept { item: GlobalPoolItem; unknown: GlobalUnknown[] }
export interface GlobalCrossed { item: GlobalPoolItem; reasons: GlobalReason[] }

export interface GlobalResult {
  kept: GlobalKept[]
  crossed: GlobalCrossed[]
  /** 官方明確目前不招本科、不算進池的條目（所選目的地內）。 */
  noUndergrad: GlobalPoolItem[]
  counts: {
    pool: number
    byDestination: Record<GlobalDestination, number>
    kept: number
    keptByDestination: Record<GlobalDestination, number>
    crossed: number
    noUndergrad: number
    /** 每題劃掉的機構數（一所可被多題劃掉，故總和可大於 crossed）。 */
    byQuestion: Record<GlobalQuestion, number>
  }
}

export interface GlobalContext {
  /** 學科代碼 → 門類代碼（GRAS 2026）。 */
  familyOf: ReadonlyMap<string, string>
  /** 起點（決定「適用你」的管道對象）；未選＝null。 */
  origin: OriginRegion | null
}

/** 起點 → 港澳臺池裡「你這類考生」的管道對象：大陸＝內地高考生；港澳＝港澳學生；臺灣／海外／未選＝未入庫。 */
export function audienceForOrigin(origin: OriginRegion | null): ChannelAudience | null {
  if (origin === 'cn-mainland') return 'mainland_gaokao'
  if (origin === 'hk' || origin === 'mo') return 'hk_macao_students'
  return null
}

/** 這所機構適用你這個起點的本科管道碼（排序去重）；院校池以外為 null（不適用管道題）。 */
export function applicableChannels(item: GlobalPoolItem, origin: OriginRegion | null): string[] | null {
  if (!item.channels) return null
  const audience = audienceForOrigin(origin)
  if (!audience) return []
  return sortedUnique(item.channels.filter((c) => c.audience === audience && c.undergrad).map((c) => c.code))
}

const sortedUnique = <T extends string>(values: Iterable<T>): T[] => [...new Set(values)].sort()

/** 由既有 payload 組成全球池（海外層＋港澳臺院校池，去重）；atlas 省略時學科一律未知（只用來計數）。 */
export function buildGlobalPool(overseas: Pick<OverseasIndexPayload, 'institutions'>, hkmotw: Pick<HkMoTwPoolPayload, 'institutions'>, atlas?: Pick<WorldAtlasPayload, 'institutions'> | null): GlobalPoolItem[] {
  const ranks = new Map((atlas?.institutions ?? []).map((i) => [i.id, Object.keys(i.ranks)]))
  const gras = (id: string | null): string[] | null => {
    if (!id) return null
    const subjects = ranks.get(id)
    return subjects && subjects.length > 0 ? [...subjects].sort() : null
  }
  const overseasById = new Map(overseas.institutions.map((i) => [i.id, i]))
  // 院校池與海外層同一所：先看 atlasId；沒有連到 GRAS 的再看同地區英文名（去掉冠詞與標點後相等），例：澳門城市大學
  const nameKey = (region: string, nameEn: string) => `${region}|${nameEn.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim()}`
  const overseasByName = new Map(overseas.institutions.map((i) => [nameKey(i.region, i.nameEn), i]))
  const merged = new Set<string>()
  const items: GlobalPoolItem[] = []
  for (const inst of hkmotw.institutions) {
    const twin = (inst.atlasId ? overseasById.get(inst.atlasId) : undefined) ?? overseasByName.get(nameKey(HKMOTW_REGION_CODE[inst.region], inst.nameEn))
    if (twin) merged.add(twin.id)
    const channels: GlobalChannel[] = inst.channels
      .filter((c): c is typeof c & { audience: ChannelAudience } => (CHANNEL_AUDIENCES as readonly string[]).includes(c.audience))
      .map((c) => ({ code: c.channel, audience: c.audience, undergrad: !NON_UNDERGRAD_CHANNELS.includes(c.channel) }))
      .sort((a, b) => a.code.localeCompare(b.code) || a.audience.localeCompare(b.audience))
    items.push({
      key: `hkmotw:${inst.id}`, pool: 'hkmotw', id: inst.id, region: HKMOTW_REGION_CODE[inst.region], destination: HKMOTW_DESTINATION[inst.region],
      subjects: gras(inst.atlasId ?? twin?.id ?? null), channels, overseasId: twin?.id ?? null, status: twin?.status ?? null,
      noUndergrad: channels.length > 0 && channels.every((c) => !c.undergrad),
      committee: inst.kind === 'joint_admission_committee',
    })
  }
  for (const inst of overseas.institutions) {
    if (merged.has(inst.id)) continue
    items.push({ key: `overseas:${inst.id}`, pool: 'overseas', id: inst.id, region: inst.region, destination: DESTINATION_OF_REGION[inst.region] ?? 'overseas', subjects: gras(inst.id), channels: null, overseasId: inst.id, status: inst.status, noUndergrad: false, committee: false })
  }
  return items
}

/**
 * 聯合招生委員會（陸生聯招會、海外聯招會）是某一類考生的管道彙整，不是院校：資料已記錄它只服務別類考生、而你這類考生已知時，
 * 它不屬於你的池（不是劃掉；你這類考生未入庫時照常保留）。一般院校永遠相關。
 */
export function relevantTo(item: GlobalPoolItem, origin: OriginRegion | null | undefined): boolean {
  if (!item.committee || !item.channels || item.channels.length === 0 || origin === undefined) return true
  const audience = audienceForOrigin(origin)
  return !audience || item.channels.some((c) => c.audience === audience)
}

/** 所選目的地的池（不含「目前不招本科」的條目；給了起點時也不含只服務別類考生的招生委員會）。 */
export function poolFor(items: readonly GlobalPoolItem[], destinations: readonly GlobalDestination[], origin?: OriginRegion | null): GlobalPoolItem[] {
  const set = new Set(destinations)
  return items.filter((i) => set.has(i.destination) && !i.noUndergrad && relevantTo(i, origin))
}

export interface GlobalQuestionPlan {
  /** 池內地區（按機構數排序）；null＝不出題（池內地區 <2）。 */
  regions: readonly string[] | null
  regionCounts: Record<string, number>
  /** 學科兩題是否出現（池內有 GRAS 資料的機構 ≥5）。 */
  subjects: boolean
  subjectItems: number
  /** 適用你起點的管道碼；null＝不出題（<2 種）。 */
  channels: readonly string[] | null
  /** 每個管道碼有幾所機構記錄（適用你的）。 */
  channelCounts: Record<string, number>
}

/** 題目按相關性出現（批 G6 裁定 B）：問了劃不動的題不出。 */
export function globalQuestionPlan(pool: readonly GlobalPoolItem[], origin: OriginRegion | null): GlobalQuestionPlan {
  const regionCounts: Record<string, number> = {}
  for (const item of pool) regionCounts[item.region] = (regionCounts[item.region] ?? 0) + 1
  const regions = Object.keys(regionCounts).sort((a, b) => regionCounts[b] - regionCounts[a] || a.localeCompare(b, 'en'))
  const subjectItems = pool.filter((i) => i.subjects).length
  const channelCounts: Record<string, number> = {}
  for (const item of pool) for (const code of applicableChannels(item, origin) ?? []) channelCounts[code] = (channelCounts[code] ?? 0) + 1
  const channels = Object.keys(channelCounts).sort((a, b) => channelCounts[b] - channelCounts[a] || a.localeCompare(b, 'en'))
  return {
    regions: regions.length >= REGION_QUESTION_MIN ? regions : null,
    regionCounts,
    subjects: subjectItems >= SUBJECT_QUESTION_MIN,
    subjectItems,
    channels: channels.length >= CHANNEL_QUESTION_MIN ? channels : null,
    channelCounts,
  }
}

export interface GlobalOptions {
  families: readonly string[]
  subjects: readonly string[]
}

/**
 * 只保留池裡真的存在、而且題目有出現的選項鍵；去重排序；想讀的學科若屬於已劃掉的門類則丟掉（兩題不互相矛盾）。
 * 目的地空＝fallback（至少一個）。
 */
export function normalizeGlobalSelection(
  selection: Partial<GlobalSelection> | null | undefined,
  items: readonly GlobalPoolItem[],
  origin: OriginRegion | null,
  options: GlobalOptions,
  familyOf: ReadonlyMap<string, string>,
  fallbackDestinations: readonly GlobalDestination[] = GLOBAL_DESTINATIONS,
): GlobalSelection {
  const pick = <T extends string>(values: unknown, allowed: readonly T[]): T[] => sortedUnique((Array.isArray(values) ? values : []).filter((v): v is T => typeof v === 'string' && (allowed as readonly string[]).includes(v)))
  const chosen = pick(selection?.destinations, GLOBAL_DESTINATIONS)
  const destinations = GLOBAL_DESTINATIONS.filter((d) => (chosen.length ? chosen : fallbackDestinations).includes(d))
  const plan = globalQuestionPlan(poolFor(items, destinations, origin), origin)
  const struckFamilies = plan.subjects ? pick(selection?.struckFamilies, options.families) : []
  const struck = new Set(struckFamilies)
  return {
    destinations,
    struckRegions: plan.regions ? pick(selection?.struckRegions, plan.regions) : [],
    struckFamilies,
    wantedSubjects: plan.subjects ? pick(selection?.wantedSubjects, options.subjects).filter((s) => !struck.has(familyOf.get(s) ?? '')) : [],
    struckChannels: plan.channels ? pick(selection?.struckChannels, plan.channels) : [],
  }
}

/** 減法本體。題目全部可跳過（空陣列＝跳過）；一所機構被任一題命中即劃掉，原因逐條保留。 */
export function computeGlobal(items: readonly GlobalPoolItem[], selection: GlobalSelection, context: GlobalContext): GlobalResult {
  const destinations = new Set(selection.destinations)
  const regions = new Set(selection.struckRegions)
  const families = new Set(selection.struckFamilies)
  const wanted = new Set(selection.wantedSubjects)
  const channels = new Set(selection.struckChannels)
  const kept: GlobalKept[] = []
  const crossed: GlobalCrossed[] = []
  const noUndergrad: GlobalPoolItem[] = []
  const byQuestion: Record<GlobalQuestion, number> = { regions: 0, families: 0, wanted: 0, channels: 0 }
  const zero = (): Record<GlobalDestination, number> => ({ hk: 0, mo: 0, tw: 0, overseas: 0 })
  const byDestination = zero()
  const keptByDestination = zero()
  for (const item of items) {
    if (!destinations.has(item.destination) || !relevantTo(item, context.origin)) continue
    if (item.noUndergrad) { noUndergrad.push(item); continue }
    byDestination[item.destination] += 1
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
    // (c) 管道：只對院校池；適用你起點的本科管道全部被劃掉才劃掉；沒有記錄適用你的管道＝未知、保留。
    if (channels.size > 0) {
      const own = applicableChannels(item, context.origin)
      if (own && own.length === 0) unknown.push('channels_none_applicable')
      else if (own && own.every((c) => channels.has(c))) reasons.push({ question: 'channels', rule: 'all_applicable_channels_struck', channels: own })
    }
    if (reasons.length) {
      crossed.push({ item, reasons })
      for (const q of new Set(reasons.map((r) => r.question))) byQuestion[q] += 1
    } else {
      kept.push({ item, unknown })
      keptByDestination[item.destination] += 1
    }
  }
  const pool = Object.values(byDestination).reduce((a, b) => a + b, 0)
  return { kept, crossed, noUndergrad, counts: { pool, byDestination, kept: kept.length, keptByDestination, crossed: crossed.length, noUndergrad: noUndergrad.length, byQuestion } }
}

/** 門類與學科照 GRAS 順序。 */
export function globalOptions(atlas: Pick<WorldAtlasPayload, 'families' | 'subjects'>): GlobalOptions {
  return { families: atlas.families.map((f) => f.code), subjects: atlas.subjects.map((s) => s.code) }
}

/** 資格標示（保留語義，永不劃掉）：有海外層招生頁的 verified 機構命中 token → listed；其餘有海外層頁的 → unread（保留）；沒有海外層頁 → na。 */
export type QualificationMarkCode = 'listed' | 'unread' | 'na'
export function qualificationMark(item: GlobalPoolItem, hits: ReadonlySet<string> | null): QualificationMarkCode | null {
  if (!hits) return null
  if (!item.overseasId) return 'na'
  return item.status === 'verified' && hits.has(item.overseasId) ? 'listed' : 'unread'
}

// ---- 分享：只含選項鍵（目的地、地區碼、門類／學科代碼、管道碼），不含任何個人資料或起點／資格 ----
const SHARE_KEYS = { destinations: 'd', struckRegions: 'r', struckFamilies: 'f', wantedSubjects: 'w', struckChannels: 'c' } as const

export function encodeGlobalSelection(selection: GlobalSelection): string {
  const params = new URLSearchParams()
  for (const [field, key] of Object.entries(SHARE_KEYS) as [keyof GlobalSelection, string][]) {
    const values = selection[field]
    if (values.length) params.set(key, values.join('|'))
  }
  return params.toString()
}

/** 讀分享鏈接；批 G2 的舊鏈接（p＝池）換算成目的地：overseas→海外、hkmotw→香港＋澳門＋臺灣。 */
export function decodeGlobalSelection(query: string, items: readonly GlobalPoolItem[], origin: OriginRegion | null, options: GlobalOptions, familyOf: ReadonlyMap<string, string>): GlobalSelection | null {
  const params = new URLSearchParams(query.replace(/^\?/, ''))
  if (![...Object.values(SHARE_KEYS), 'p'].some((k) => params.has(k))) return null
  const raw: Partial<Record<keyof GlobalSelection, string[]>> = {}
  for (const [field, key] of Object.entries(SHARE_KEYS) as [keyof GlobalSelection, string][]) raw[field] = (params.get(key) ?? '').split('|').filter(Boolean)
  if (!raw.destinations?.length && params.has('p')) {
    const pools = (params.get('p') ?? '').split('|')
    raw.destinations = [...(pools.includes('hkmotw') ? ['hk', 'mo', 'tw'] : []), ...(pools.includes('overseas') ? ['overseas'] : [])]
  }
  return normalizeGlobalSelection(raw as Partial<GlobalSelection>, items, origin, options, familyOf)
}

export const GLOBAL_STORAGE_KEY = 'unapply.globalSubtraction.v2'
/** 批 G2 的舊鍵（池＋管道對象）；讀到就刪。 */
export const LEGACY_GLOBAL_STORAGE_KEY = 'unapply.globalSubtraction.v1'
