// S1 專業／選考科目資料層的 payload 型別（public/data/programs/*.json）。
// 這一層在 AnswerMap 之外：它是起點條件與展示資料，不是問卷答案，也不進 A+ 學習證據契約。

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

export type ProgramCatalogMatch = 'code' | 'name' | 'name_base' | 'class' | 'none'

/** 一所學校的一個招生專業（類）。鍵名刻意短：9,534 條要懶載入。 */
export interface ProgramOffering {
  /** 招生專業（類）名稱，國標目錄／省表原文。 */
  n: string
  /** 校區／醫學院標籤（有獨立招生代碼時），空＝本部或不分。 */
  c: string
  /** 對應到的國標專業代碼；按專業類招生或試驗班時為空。 */
  k: string
  /** 國標專業類代碼；試驗班為空。 */
  cl: string
  /** 選考要求圖樣：'none' 或 P/C/B/Z/H/G 的子集（固定序）。 */
  r: string
  m: ProgramCatalogMatch
  /** 列到它的省表（HB|JS|SH|ZJ）。 */
  p: string
}

export interface SchoolPrograms {
  moeCode: string
  provinces: string[]
  programs: ProgramOffering[]
}

export interface ProgramSource {
  title: string
  publisher: string
  url: string
  date: string
  province?: string
}

export interface ProgramOfferingsPayload {
  version: string
  admissionYear: number
  catalogYear: number
  provinceSources: Record<string, { sourceId: string; nameZh: string }>
  sources: Record<string, ProgramSource>
  schools: SchoolPrograms[]
  strongBase: { moeCode: string; sourceId: string; since: number }[]
}
