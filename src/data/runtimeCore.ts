// 瘦身目錄（schools.core.json）的編解碼：純函式，建置腳本、瀏覽器載入器與測試共用。
//
// 為什麼要有它（2026-11-12 批 H1）：canonical schools.json 有 12.9 MB，其中 87.7% 是每個生活維度取值的
// 票數與分佈（qualityEvidence 的 sampleSize／valueCounts 等）。引擎判定只讀來源／範圍／年份，
// 票數只有學校詳情頁會顯示。瀏覽器進問卷前因此只需要「去掉票數」的目錄（約為原來的六分之一），
// 票數按省分桶、進詳情頁才載。canonical schools.json 不變，Function 重算仍用它。
import type { DimensionId } from './dimensions'
import type { QualityEvidenceCore, QualityEvidenceMeta, SchoolQualityEvidenceCoreMap, SchoolQualityEvidenceMap } from './runtimeTypes'
import type { CanonicalSchool, School } from './schools'

/** 編碼格式版本：改編碼方式（不是改資料）時加一，讓帶版本參數的網址跟著變。 */
export const SCHOOLS_CORE_FORMAT = 1

export type CoreSchoolRow = Omit<School, 'qualityEvidence'> & {
  /** 維度 → evidenceShapes 的索引 */
  qe?: Record<string, number>
}

export interface SchoolsCorePayload {
  version: string
  format: number
  /** 去重後的最小證據（來源／範圍／年份／置信度）；全池只有個位數種。 */
  evidenceShapes: QualityEvidenceCore[]
  schools: CoreSchoolRow[]
}

/** 完整證據 → 引擎所需的最小欄位。欄位順序固定，去重鍵才穩定。 */
export function toEvidenceCore(meta: QualityEvidenceCore): QualityEvidenceCore {
  const core: QualityEvidenceCore = { source: meta.source, confidence: meta.confidence }
  if (meta.scope !== undefined) core.scope = meta.scope
  if (meta.year !== undefined) core.year = meta.year
  return core
}

export function encodeSchoolsCore(schools: readonly CanonicalSchool[], version: string): SchoolsCorePayload {
  const evidenceShapes: QualityEvidenceCore[] = []
  const indexByKey = new Map<string, number>()
  const rows = schools.map((school) => {
    const { qualityEvidence, ...rest } = school
    if (!qualityEvidence) return rest as CoreSchoolRow
    const qe: Record<string, number> = {}
    for (const [dimension, meta] of Object.entries(qualityEvidence) as [DimensionId, QualityEvidenceMeta][]) {
      const core = toEvidenceCore(meta)
      const key = JSON.stringify(core)
      let index = indexByKey.get(key)
      if (index === undefined) {
        index = evidenceShapes.length
        evidenceShapes.push(core)
        indexByKey.set(key, index)
      }
      qe[dimension] = index
    }
    return { ...rest, qe } as CoreSchoolRow
  })
  return { version, format: SCHOOLS_CORE_FORMAT, evidenceShapes, schools: rows }
}

/** 瘦身目錄 → 引擎與頁面用的 School[]。同一種最小證據共用一個凍結物件（沒有人會改它）。 */
export function decodeSchoolsCore(payload: SchoolsCorePayload): School[] {
  if (!payload || payload.format !== SCHOOLS_CORE_FORMAT || !Array.isArray(payload.evidenceShapes) || !Array.isArray(payload.schools)) {
    throw new Error('schools core payload has an unknown format')
  }
  const shapes = payload.evidenceShapes.map((shape) => Object.freeze({ ...shape }))
  return payload.schools.map((row) => {
    const { qe, ...rest } = row
    if (!qe) return rest as School
    const qualityEvidence: SchoolQualityEvidenceCoreMap = {}
    for (const [dimension, index] of Object.entries(qe)) {
      const shape = shapes[index]
      if (!shape) throw new Error('schools core payload references a missing evidence shape')
      qualityEvidence[dimension as DimensionId] = shape
    }
    return { ...rest, qualityEvidence } as School
  })
}

/** evidence 省桶：教育部代碼 → 完整證據。 */
export type EvidenceBucket = Record<string, SchoolQualityEvidenceMap>
