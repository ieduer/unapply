// 港澳臺院校池 payload 的型別（public/data/hkmotw/pool.json，由 scripts/build_hkmotw_pool.mjs 生成）。
// 結構刻意做成「機構／招生管道／條件／來源／有效期」五層，S3 海外學校沿用同一形狀。
// 這一層不進任何題目、不進 AnswerMap，也不進 A+ 學習證據契約；它只是跨區可選池與管道說明。

export type HkMoTwRegion = 'HK' | 'MO' | 'TW'

export interface HkMoTwSource {
  title: string
  url: string
  /** 來源頁發布／讀取日。 */
  date: string
  httpStatus: 200
  /** 本站核對連通與網域一致的日期。 */
  verifiedAt: string
}

export interface HkMoTwChannel {
  audience: 'mainland_gaokao' | 'hk_macao_students'
  audienceZh: string
  channel: string
  channelZh: string
  /** 學士／副學位／碩博等。 */
  level: string
  /** 適用的招生年度或學年；空＝來源頁未標年份。 */
  validFor: string
  conditions: { score: string; english: string; tuition: string; applicationWindow: string }
  source: HkMoTwSource
  notes: string
}

export interface HkMoTwInstitution {
  id: string
  region: HkMoTwRegion
  regionZh: string
  nameZh: string
  nameEn: string
  kind: string
  kindZh: string
  website: string
  listSource: { title: string; url: string; date: string }
  /** 在世界學科地圖（GRAS）裡的機構 id；不在榜上為 null。 */
  atlasId: string | null
  notes: string
  channels: HkMoTwChannel[]
}

export interface HkMoTwPoolPayload {
  version: string
  generatedAt: string
  regions: { code: HkMoTwRegion; nameZh: string }[]
  institutions: HkMoTwInstitution[]
  /** 核不過的機構／管道只記數量與原因，不上線（路線圖對外鏈接規則）。 */
  reviewRequired: { institutions: { id: string; nameZh: string; region: string; reason: string }[]; channels: { institutionId: string; channel: string; reason: string }[] }
  sources: { institutions: string; channels: string }
}
