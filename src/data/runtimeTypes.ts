import type { DimensionId } from './dimensions'

export type QualitySourceKind = 'official' | 'authoritative' | 'crowd'

/**
 * 引擎判定「這個取值有沒有硬篩選權」所需的最小欄位（engine/filter.ts isHardFilterableQuality 只讀這些）。
 * 瀏覽器載入的瘦身目錄 schools.core.json 每個取值只帶這一層；票數與分佈在詳情頁按省再載（2026-11-12 批 H1）。
 */
export interface QualityEvidenceCore {
  source: QualitySourceKind
  confidence: 'high' | 'medium' | 'low'
  scope?: 'school' | 'campus' | 'unverified'
  year?: number
}

/** 完整證據（含票數與分佈）：建置側、canonical schools.json（Function 重算用）、evidence 省桶。 */
export interface QualityEvidenceMeta extends QualityEvidenceCore {
  sampleSize: number
  winningVotes: number
  classifiedSampleSize?: number
  unclassifiedResponses?: number
  valueCounts?: Record<string, number>
}

export interface ResearchEvidence {
  title: string
  url: string
  date?: string
  confidence?: 'high' | 'medium' | 'low'
  note?: string
}

export interface CampusResearchRecord {
  campusName: string
  campusAddress?: string
  province?: string
  city?: string
  district?: string
  lat?: number
  lng?: number
  undergraduateScope?: string
  freshmanOnly?: string
  mainCampusType?: string
  nearestMetroStation?: string
  metroDistanceKm?: number
  sourceTitle?: string
  sourceUrl?: string
  sourceDate?: string
  confidence?: 'high' | 'medium' | 'low'
  notes?: string
}

export interface ProvinceAdmissionPortal {
  authorityName: string
  portalUrl: string
  scoreQueryUrl?: string
  planQueryUrl?: string
  sourceTitle: string
  sourceUrl: string
  sourceDate?: string
  confidence?: 'high' | 'medium' | 'low'
  notes?: string
}

export type SchoolResearchEvidenceMap = Partial<Record<DimensionId, ResearchEvidence[]>>

export type SchoolQualityEvidenceMap = Partial<Record<DimensionId, QualityEvidenceMeta>>
export type SchoolQualityEvidenceCoreMap = Partial<Record<DimensionId, QualityEvidenceCore>>

// 招生管道：「學校 × 省份 × 年度」，不是布林旗標。
// 'all' 出現在列表裡代表該管道適用於該校全部招生省份。
export interface SchoolAdmissionChannels {
  schoolName: string
  year: number | null
  regularProvinces: string[]
  comprehensiveProvinces: string[]
  source: {
    title: string
    url: string
    date?: string
    confidence?: string
  }
  notes?: string
}
