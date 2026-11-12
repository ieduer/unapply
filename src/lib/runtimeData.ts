import { t } from '../i18n/core'
import type { School } from '../data/schools'
import type { CampusResearchRecord } from '../data/runtimeTypes'
import { campusBucketFileByProvince } from '../data/campusProvinceBuckets'
import { evidenceBucketFileByProvince } from '../data/evidenceProvinceBuckets'
import { decodeSchoolsCore, type EvidenceBucket, type SchoolsCorePayload } from '../data/runtimeCore'
import { runtimeDataManifest } from '../data/runtimeManifest'
import { fetchJson, type FetchJsonOptions } from './fetchJson'
import { completeCatalogProgress, reportCatalogProgress, resetCatalogProgress, trackCriticalLoad } from './loadProgress'

type CampusProvinceBucket = Record<string, CampusResearchRecord[]>

let schoolsPromise: Promise<School[]> | null = null
const campusBucketPromises = new Map<string, Promise<CampusProvinceBucket>>()
const evidenceBucketPromises = new Map<string, Promise<EvidenceBucket>>()

function fetchRuntimeJson<T>(pathname: string, versionSuffix = '', options?: FetchJsonOptions): Promise<T> {
  const separator = pathname.includes('?') ? '&' : '?'
  return fetchJson<T>(`${pathname}${separator}v=${encodeURIComponent(runtimeDataManifest.version + versionSuffix)}`, options)
}

/**
 * 學校目錄（2,952 所）。瀏覽器載的是瘦身目錄 schools.core.json：除了生活維度證據的票數與分佈以外，
 * 與 canonical schools.json 逐欄相同（建置時自我核對、tests/runtime-core.test.ts 另核對引擎結果一致）；
 * 票數在學校詳情頁用 loadQualityEvidence 按省再載。Function 重算仍讀 canonical schools.json。
 */
export function loadSchools(): Promise<School[]> {
  if (!schoolsPromise) {
    const progressKey = 'schools'
    const total = runtimeDataManifest.schoolsCoreBytes
    // 一開始就登記總量：兩個檔的進度是合併計算的，等到第一筆資料到了才登記的話，另一個檔一開始回報分母就變大、百分比會倒退
    reportCatalogProgress(progressKey, 0, total, 0)
    schoolsPromise = trackCriticalLoad(fetchRuntimeJson<SchoolsCorePayload>(runtimeDataManifest.schoolsCorePath, `.${runtimeDataManifest.schoolsCoreFormat}`, {
      onProgress: ({ loaded, attempt }) => reportCatalogProgress(progressKey, loaded, total, attempt),
    })).then((payload) => {
      if (!payload || payload.version !== runtimeDataManifest.version || payload.format !== runtimeDataManifest.schoolsCoreFormat) {
        throw new Error(t('ui.data.error.schools'))
      }
      const loaded = decodeSchoolsCore(payload)
      if (loaded.length !== runtimeDataManifest.counts.schools
        || loaded.some((school) => !school || typeof school.moeCode !== 'string')
        || new Set(loaded.map((school) => school.moeCode)).size !== loaded.length) {
        throw new Error(t('ui.data.error.schools'))
      }
      completeCatalogProgress(progressKey, total)
      return loaded
    }).catch((error: unknown) => {
      schoolsPromise = null
      resetCatalogProgress(progressKey)
      throw error
    })
  }
  return schoolsPromise
}

export function loadCampusesByProvince(province: string): Promise<CampusProvinceBucket> {
  const key = province.trim()
  if (!key) return Promise.resolve({})
  const fileName = campusBucketFileByProvince[key]
  if (!fileName) return Promise.resolve({})

  if (!campusBucketPromises.has(key)) {
    const bucketPath = `${runtimeDataManifest.campusesBasePath}/${fileName}`
    const promise = fetchRuntimeJson<CampusProvinceBucket>(bucketPath).catch((error: unknown) => {
      campusBucketPromises.delete(key)
      throw error
    })
    campusBucketPromises.set(key, promise)
  }

  return campusBucketPromises.get(key)!
}

/** 一個省的生活維度完整證據（票數與分佈；教育部代碼 → 維度 → 證據）。學校詳情頁才載。 */
export function loadQualityEvidence(province: string): Promise<EvidenceBucket> {
  const key = province.trim()
  if (!key) return Promise.resolve({})
  const fileName = evidenceBucketFileByProvince[key]
  if (!fileName) return Promise.resolve({})

  if (!evidenceBucketPromises.has(key)) {
    const promise = fetchRuntimeJson<EvidenceBucket>(`${runtimeDataManifest.evidenceBasePath}/${fileName}`)
      .then((bucket) => {
        if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) throw new Error(t('ui.data.error.schools'))
        return bucket
      })
      .catch((error: unknown) => {
        evidenceBucketPromises.delete(key)
        throw error
      })
    evidenceBucketPromises.set(key, promise)
  }

  return evidenceBucketPromises.get(key)!
}
