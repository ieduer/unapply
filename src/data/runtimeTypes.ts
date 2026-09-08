import type { DimensionId } from './dimensions'

export type QualitySourceKind = 'official' | 'authoritative' | 'crowd'

export interface QualityEvidenceMeta {
  source: QualitySourceKind
  confidence: 'high' | 'medium' | 'low'
  sampleSize: number
  winningVotes: number
  classifiedSampleSize?: number
  unclassifiedResponses?: number
  valueCounts?: Record<string, number>
  scope?: 'school' | 'campus' | 'unverified'
  year?: number
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
