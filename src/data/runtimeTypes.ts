import type { DimensionId } from './dimensions'

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
