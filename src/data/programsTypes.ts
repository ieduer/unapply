// S1 專業／選考科目資料層的 payload 型別（public/data/programs/*）。
// 這一層在 AnswerMap 之外：它是起點條件與展示資料，不是問卷答案，也不進 A+ 學習證據契約。
//
// 兩層：index.json 是每校一條的緊湊摘要（結果頁的起點條件層只用它）；schools/programs-NN.json 是按省分桶的完整清單（學校詳情才載入）。

export type SubjectCode = 'P' | 'C' | 'B' | 'Z' | 'H' | 'G'

export interface ProgramCatalogDiscipline { code: string; name: string }
export interface ProgramCatalogClass { code: string; name: string; discipline: string }
export interface ProgramCatalogProgram {
  code: string
  name: string
  class: string
  discipline: string
  special: boolean
  controlled: boolean
}
export interface ProgramCatalogPayload {
  version: string
  year: number
  disciplines: ProgramCatalogDiscipline[]
  classes: ProgramCatalogClass[]
  programs: ProgramCatalogProgram[]
  source: { title: string; url: string; date: string }
}

export type ProgramCatalogMatch = 'code' | 'name' | 'name_base' | 'class' | 'none' | 'vocational'

/** 一所學校的一個招生專業（類）（第二層）。鍵名刻意短：近 9 萬條。 */
export interface ProgramOffering {
  /** 招生專業（類）名稱，國標目錄／省表原文。 */
  n: string
  /** 校區／醫學院標籤（有獨立招生代碼時），空＝本部或不分。 */
  c: string
  /** u＝本科、v＝高職（專科）。 */
  l: 'u' | 'v'
  /** 對應到的國標專業代碼；按專業類招生、試驗班或專科為空。 */
  k: string
  /** 國標專業類代碼；試驗班、專科為空。 */
  cl: string
  /** 選考要求圖樣：'none' 或 P/C/B/Z/H/G 的子集（固定序）。 */
  r: string
  m: ProgramCatalogMatch
  /** 列到它的省表（HB|JS|SH|ZJ）。 */
  p: string
}
export type ProgramBucket = Record<string, ProgramOffering[]>

/** 第一層：每校摘要。圖樣用 index.patterns 的下標；專業用 index.catalogCodes 的下標。 */
export interface ProgramIndexEntry {
  /** 本科招生專業（類）數。 */
  u: number
  /** 高職（專科）專業數。 */
  v: number
  /** 本科中對不到專業類的（試驗班等）數。 */
  x: number
  /** 列到它的省表（HB|JS|SH|ZJ）。 */
  p: string
  /** 專業類代碼 → 該類每個本科招生專業的圖樣下標（長度＝該類專業數）。 */
  c: Record<string, number[]>
  /** 按整個專業類招生的類（大類招生，視為涵蓋該類全部專業）。 */
  g?: string[]
  /** 對到具體國標專業的 [專業下標, 圖樣下標]。 */
  k?: [number, number][]
  /** 對不到專業類的本科專業（試驗班等）的圖樣下標。 */
  e?: number[]
}

export interface ProgramSource {
  title: string
  publisher: string
  url: string
  date: string
  province?: string
}

export interface ProgramIndexPayload {
  version: string
  admissionYear: number
  catalogYear: number
  patterns: string[]
  catalogCodes: string[]
  provinceSources: Record<string, { sourceId: string; nameZh: string }>
  sources: Record<string, ProgramSource>
  strongBase: { moeCode: string; sourceId: string; since: number }[]
  schools: Record<string, ProgramIndexEntry>
}
