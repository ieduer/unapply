// 世界學科地圖的減法：劃掉門類／學科／國家地區之後，還剩哪些「學科席位」。
// 一個席位 = （機構, 學科）且該機構在該學科名次 ≤ topN。
// 純函數，沒有 DOM；tests/world-atlas.test.ts 直接測。

import type { AtlasInstitution, AtlasRegion, AtlasSubject, WorldAtlasPayload } from '../data/worldAtlasTypes'

export type AtlasTopN = 10 | 25 | 50
export const atlasTopNOptions: readonly AtlasTopN[] = [10, 25, 50]
export const defaultAtlasTopN: AtlasTopN = 10

export interface AtlasSelection {
  topN: AtlasTopN
  struckFamilies: ReadonlySet<string>
  struckSubjects: ReadonlySet<string>
  struckRegions: ReadonlySet<string>
}

export const emptyAtlasSelection: AtlasSelection = {
  topN: defaultAtlasTopN,
  struckFamilies: new Set(),
  struckSubjects: new Set(),
  struckRegions: new Set(),
}

export interface AtlasSeat {
  subject: AtlasSubject
  rank: number
}

export interface AtlasInstitutionView {
  institution: AtlasInstitution
  seats: AtlasSeat[]
  /** 該機構所在地區被劃掉：仍畫在地圖上（灰、空心），但不計入剩餘。 */
  struckByRegion: boolean
}

export interface AtlasRegionCount {
  region: AtlasRegion
  seats: number
  institutions: number
  struck: boolean
}

export interface AtlasView {
  activeSubjects: AtlasSubject[]
  /** 只含至少有一個剩餘席位的機構（含被地區劃掉的）。 */
  institutions: AtlasInstitutionView[]
  regionCounts: AtlasRegionCount[]
  totals: { subjects: number; institutions: number; regions: number; seats: number }
}

export function isSubjectActive(subject: AtlasSubject, selection: AtlasSelection): boolean {
  return !selection.struckSubjects.has(subject.code) && !selection.struckFamilies.has(subject.family)
}

export function toggleInSet(set: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(set)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

export function computeAtlasView(payload: WorldAtlasPayload, selection: AtlasSelection): AtlasView {
  const subjectByCode = new Map(payload.subjects.map((subject) => [subject.code, subject]))
  const activeSubjects = payload.subjects.filter((subject) => isSubjectActive(subject, selection))
  const activeCodes = new Set(activeSubjects.map((subject) => subject.code))

  const institutions: AtlasInstitutionView[] = []
  const seatsByRegion = new Map<string, { seats: number; institutions: number }>()

  for (const institution of payload.institutions) {
    const seats: AtlasSeat[] = []
    for (const [code, rank] of Object.entries(institution.ranks)) {
      if (rank > selection.topN || !activeCodes.has(code)) continue
      const subject = subjectByCode.get(code)
      if (subject) seats.push({ subject, rank })
    }
    if (seats.length === 0) continue
    seats.sort((a, b) => a.rank - b.rank || a.subject.code.localeCompare(b.subject.code))
    const struckByRegion = selection.struckRegions.has(institution.region)
    institutions.push({ institution, seats, struckByRegion })
    if (!struckByRegion) {
      const bucket = seatsByRegion.get(institution.region) ?? { seats: 0, institutions: 0 }
      bucket.seats += seats.length
      bucket.institutions += 1
      seatsByRegion.set(institution.region, bucket)
    }
  }

  institutions.sort((a, b) => {
    if (a.struckByRegion !== b.struckByRegion) return a.struckByRegion ? 1 : -1
    return b.seats.length - a.seats.length || a.institution.nameEn.localeCompare(b.institution.nameEn)
  })

  const regionCounts: AtlasRegionCount[] = payload.regions
    .map((region) => {
      const bucket = seatsByRegion.get(region.code)
      return {
        region,
        seats: bucket?.seats ?? 0,
        institutions: bucket?.institutions ?? 0,
        struck: selection.struckRegions.has(region.code),
      }
    })
    .filter((entry) => entry.seats > 0 || entry.struck)
    .sort((a, b) => b.seats - a.seats || a.region.nameZh.localeCompare(b.region.nameZh, 'zh-Hant'))

  const kept = institutions.filter((entry) => !entry.struckByRegion)
  return {
    activeSubjects,
    institutions,
    regionCounts,
    totals: {
      subjects: activeSubjects.length,
      institutions: kept.length,
      regions: regionCounts.filter((entry) => !entry.struck && entry.seats > 0).length,
      seats: kept.reduce((sum, entry) => sum + entry.seats.length, 0),
    },
  }
}

/** 畫點用：席位數 → 半徑（視圖座標），平方根比例，讓面積和席位數成正比。 */
export function seatRadius(seats: number, topN: AtlasTopN): number {
  const base = topN === 10 ? 2.6 : topN === 25 ? 2.2 : 1.9
  return Number((base + Math.sqrt(seats) * 1.6).toFixed(2))
}
