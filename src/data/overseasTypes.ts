// 海外可申請學校層（路線圖 S3）payload 的型別：public/data/overseas/index.json 與 regions/<slug>.json，由 scripts/build_overseas_layer.mjs 生成。
// 兩層：index 給地區清單與機構列表（每機構一條摘要）；地區檔只在進入地區頁時載入（全欄原文片段＋國家層申請平台＋簽證主管機關頁）。
// 這一層只抄官方頁原文、不解讀、不進任何題目／引擎／AnswerMap／A+ 證據；任何欄位都不表示錄取可能。

/** unsafe（2026-11-08 批 G4，只見於國家層）：官方網域疑遭劫持，不上鏈接也不輸出網址與網域。 */
export type OverseasStatus = 'verified' | 'needs_review' | 'blocked' | 'not_found' | 'unsafe'
export type OverseasConfidence = 'high' | 'medium'
export type GaokaoPolicy = 'accepted' | 'not_accepted' | 'conflicting' | 'separate_channel' | 'mentioned' | 'not_stated'

export interface OverseasRegionRow {
  code: string
  slug: string
  nameZh: string
  file: string
  institutions: number
  verified: number
  /** 招生頁可上鏈接（verified 且 high）的機構數。 */
  linkLive: number
  /** 官方頁本站未讀到（blocked／not_found／needs_review）的機構數。 */
  unread: number
  portals: number
  portalsLive: number
  visa: number
  visaLive: number
}

export interface OverseasInstitutionSummary {
  id: string
  nameEn: string
  /** 正體中文名；Wikidata 無正體標籤者為 null（只顯示英文名）。 */
  nameZh: string | null
  region: string
  /** S0 已核查的學校官網。 */
  website: string
  /** GRAS 2026 前 50 的學科數——只描述學科分佈，不是推薦。 */
  subjects: number
  status: OverseasStatus
  confidence: OverseasConfidence | null
  /** 招生頁是否上鏈接：只有 status=verified 且 confidence=high。 */
  linkLive: boolean
  gaokaoPolicy: GaokaoPolicy
  dataAcademicYear: string | null
  fetchedAt: string
  has: { gaokao: boolean; qualifications: boolean; english: boolean; otherLanguage: boolean; tuition: boolean; channels: boolean; timeline: boolean }
}

/** 官方頁原文片段：text 照抄（含截斷省略號），url 為來源頁；live 只在機構招生頁上線且來源在官網網域內時為 true。 */
export interface OverseasQuote {
  label?: string
  text: string
  url: string
  live: boolean
}

export interface OverseasAdmissions {
  status: OverseasStatus
  statusZh: string
  confidence: OverseasConfidence | null
  linkLive: boolean
  /** 只在 linkLive 時給。 */
  url?: string
  title?: string
  /** medium：學校另一官方網域（只顯示主機名，不出鏈接）；high＋reviewedAt：人工確認屬該校的另一官方網域（已上鏈接）。 */
  externalDomain?: string
  /** 2026-11-08 批 G1 起：招生頁在學校另一官方網域、人工確認後上鏈接者的確認日（overseas_admissions 的 reviewedAt）。 */
  reviewedAt?: string
  /** 不上鏈接時的說明（正體中文）。 */
  note?: string
}

export interface OverseasInstitutionDetail extends OverseasInstitutionSummary {
  wikidata: string | null
  admissions: OverseasAdmissions
  gaokao: { policy: GaokaoPolicy; policyZh: string; quotes: OverseasQuote[] }
  qualifications: { listed: string[]; quotes: OverseasQuote[] }
  /** ielts／toefl 是原句第一個分數，可能是總分也可能是單項；頁面只能連同原句展示。 */
  english: { tests: string[]; ielts: string | null; toefl: string | null; quotes: OverseasQuote[] }
  otherLanguage: { listed: string[]; quotes: OverseasQuote[] }
  tuition: { quotes: OverseasQuote[] }
  channels: { listed: string[]; quotes: OverseasQuote[] }
  timeline: { quotes: OverseasQuote[] }
  sources: { url: string; live: boolean }[]
  pagesFetched: number
}

export interface OverseasPortal {
  name: string
  type: string
  typeZh: string
  domainClass: 'gov' | 'public-agency' | 'official-platform'
  domainClassZh: string
  /** 編輯標籤（不是頁面事實）。 */
  roleLabel: string
  domain: string | null
  status: OverseasStatus
  statusZh: string
  /** verified 且 high（official-platform 需有機構頁佐證）才上鏈接。 */
  linkLive: boolean
  /** 幾所機構的官方頁鏈到這個平台網域。 */
  corroborating: number
  fetchedAt: string
  quotes: { audience: string[]; fees: string[]; timeline: string[]; other: string[] }
  url?: string
  pageTitle?: string | null
  note?: string
}

export interface OverseasVisa {
  category: string
  authority: string
  domain: string | null
  status: OverseasStatus
  statusZh: string
  /** verified 才上鏈接；被擋者只寫主管機關名與「核查時被擋」。 */
  linkLive: boolean
  fetchedAt: string
  quotes: { financial: string[]; language: string[]; insurance: string[]; fee: string[]; timeline: string[]; other: string[] }
  url?: string
  pageTitle?: string | null
  note?: string
}

export interface OverseasIndexPayload {
  version: string
  generatedAt: string
  source: { research: string; files: Record<string, string>; crawl: { startedAt: string; finishedAt: string } }
  regions: OverseasRegionRow[]
  institutions: OverseasInstitutionSummary[]
}

export interface OverseasRegionPayload {
  version: string
  generatedAt: string
  region: { code: string; slug: string; nameZh: string }
  portals: OverseasPortal[]
  visa: OverseasVisa[]
  institutions: OverseasInstitutionDetail[]
}
