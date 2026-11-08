// 全球池（路線圖 S4，批 G2；2026-11-08 批 G6 依目的地重做；批 G6 擴充後題目移到 src/engine/regionBanks.ts）。
// 本檔只管「池」：海外可申請學校層（S3）＋港澳臺院校池（S2 後半）組成的機構清單、目的地歸屬、去重、適用管道、
// 官方明確不招本科、招生委員會的相關性、資格標示。題目、效度與減法在 regionBanks.ts。
// 純函式、語言中立；不進 AnswerMap、不進 DimensionId、不進 A+ 學習證據、不送 Function。
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
  /** 官方已明確目前不招本科（聯合招生委員會且已記錄管道全部是非本科管道：陸生聯招會）。 */
  noUndergrad: boolean
  /** 一般院校：某類考生的已記錄管道全部是非本科管道（例：聖若瑟大學對內地高考生只招碩博，批 G8 主會話裁定 1）——只對那類考生不算進池。 */
  postgradOnlyFor: readonly ChannelAudience[]
  /** 聯合招生委員會（臺灣陸生聯招會／海外聯招會）：是管道彙整，不是單一院校。 */
  committee: boolean
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
      // 本科＝學士管道：只招碩博（postgraduate_only）或只開副學位（level 只有「副學士／高級文憑」）都不算
      .map((c) => ({ code: c.channel, audience: c.audience, undergrad: !NON_UNDERGRAD_CHANNELS.includes(c.channel) && /(^|[^副])學士/.test(c.level) && !c.level.includes('學士班未招生') }))
      .sort((a, b) => a.code.localeCompare(b.code) || a.audience.localeCompare(b.audience))
    items.push({
      key: `hkmotw:${inst.id}`, pool: 'hkmotw', id: inst.id, region: HKMOTW_REGION_CODE[inst.region], destination: HKMOTW_DESTINATION[inst.region],
      subjects: gras(inst.atlasId ?? twin?.id ?? null), channels, overseasId: twin?.id ?? null, status: twin?.status ?? null,
      noUndergrad: inst.kind === 'joint_admission_committee' && channels.length > 0 && channels.every((c) => NON_UNDERGRAD_CHANNELS.includes(c.code)),
      postgradOnlyFor: inst.kind === 'joint_admission_committee' ? [] : CHANNEL_AUDIENCES.filter((a) => { const own = channels.filter((c) => c.audience === a); return own.length > 0 && own.every((c) => NON_UNDERGRAD_CHANNELS.includes(c.code)) }),
      committee: inst.kind === 'joint_admission_committee',
    })
  }
  for (const inst of overseas.institutions) {
    if (merged.has(inst.id)) continue
    items.push({ key: `overseas:${inst.id}`, pool: 'overseas', id: inst.id, region: inst.region, destination: DESTINATION_OF_REGION[inst.region] ?? 'overseas', subjects: gras(inst.id), channels: null, overseasId: inst.id, status: inst.status, noUndergrad: false, postgradOnlyFor: [], committee: false })
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

/** 對這個起點「官方：目前不招本科」：招生委員會全部只招碩博，或一般院校對你這類考生只招碩博。 */
export function notRecruitingFor(item: GlobalPoolItem, origin: OriginRegion | null | undefined): boolean {
  if (item.noUndergrad) return true
  const audience = origin === undefined ? null : audienceForOrigin(origin)
  return audience !== null && item.postgradOnlyFor.includes(audience)
}

/** 所選目的地的池（不含對你這個起點「目前不招本科」的條目；給了起點時也不含只服務別類考生的招生委員會）。 */
export function poolFor(items: readonly GlobalPoolItem[], destinations: readonly GlobalDestination[], origin?: OriginRegion | null): GlobalPoolItem[] {
  const set = new Set(destinations)
  return items.filter((i) => set.has(i.destination) && !notRecruitingFor(i, origin) && relevantTo(i, origin))
}

/** 資格標示（保留語義，永不劃掉）：有海外層招生頁的 verified 機構命中 token → listed；其餘有海外層頁的 → unread（保留）；沒有海外層頁 → na。 */
export type QualificationMarkCode = 'listed' | 'unread' | 'na'
export function qualificationMark(item: GlobalPoolItem, hits: ReadonlySet<string> | null): QualificationMarkCode | null {
  if (!hits) return null
  if (!item.overseasId) return 'na'
  return item.status === 'verified' && hits.has(item.overseasId) ? 'listed' : 'unread'
}

/** 舊存檔鍵（批 G2 v1、批 G6 v2）；讀到就刪。新的題庫作答存 regionBanks.BANK_STORAGE_KEY。 */
export const LEGACY_GLOBAL_STORAGE_KEYS: readonly string[] = ['unapply.globalSubtraction.v1', 'unapply.globalSubtraction.v2']
