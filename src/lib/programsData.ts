import { t } from '../i18n/core'
import { programsManifest } from '../data/programsManifest'
import type { ProgramBucket, ProgramCatalogPayload, ProgramIndexPayload } from '../data/programsTypes'
import { fetchJson, type FetchJsonOptions } from './fetchJson'
import { completeCatalogProgress, reportCatalogProgress, resetCatalogProgress, trackCriticalLoad } from './loadProgress'

let catalogPromise: Promise<ProgramCatalogPayload> | null = null
let indexPromise: Promise<ProgramIndexPayload> | null = null
const bucketPromises = new Map<string, Promise<ProgramBucket>>()

function fetchPayload<T>(path: string, options?: FetchJsonOptions): Promise<T> {
  return fetchJson<T>(`${path}?v=${encodeURIComponent(programsManifest.version)}`, options)
}

const INDEX_PROGRESS_KEY = 'programs'

/** 教育部本科專業目錄（883 種）：給起點條件的專業選單用，約 100 KiB。 */
export function loadProgramCatalog(): Promise<ProgramCatalogPayload> {
  if (!catalogPromise) {
    catalogPromise = fetchPayload<ProgramCatalogPayload>(programsManifest.catalogPath)
      .then((payload) => {
        const counts = programsManifest.counts
        if (payload.version !== programsManifest.version
          || payload.disciplines?.length !== counts.disciplines
          || payload.classes?.length !== counts.classes
          || payload.programs?.length !== counts.catalogPrograms) {
          throw new Error(t('ui.data.error.programCatalog'))
        }
        return payload
      })
      .catch((error: unknown) => { catalogPromise = null; throw error })
  }
  return catalogPromise
}

/** 每校摘要（2,952 校中有資料的）：結果頁的起點條件層、卡片計數用；約 150 KiB gzip。 */
export function loadProgramIndex(): Promise<ProgramIndexPayload> {
  if (!indexPromise) {
    indexPromise = trackCriticalLoad(fetchPayload<ProgramIndexPayload>(programsManifest.indexPath, {
      onProgress: ({ loaded, attempt }) => reportCatalogProgress(INDEX_PROGRESS_KEY, loaded, programsManifest.indexBytes, attempt),
    }))
      .then((payload) => {
        const counts = programsManifest.counts
        const entries = payload.schools && typeof payload.schools === 'object' ? Object.values(payload.schools) : []
        const undergraduate = entries.reduce((n, s) => n + (s?.u ?? 0), 0)
        const vocational = entries.reduce((n, s) => n + (s?.v ?? 0), 0)
        if (payload.version !== programsManifest.version
          || entries.length !== counts.schools
          || entries.filter((s) => s.u > 0).length !== counts.undergraduateSchools
          || undergraduate !== counts.undergraduateOfferings
          || vocational !== counts.vocationalOfferings
          || payload.patterns?.length !== counts.patterns
          || payload.catalogCodes?.length !== counts.catalogPrograms
          || payload.strongBase?.length !== counts.strongBase) {
          throw new Error(t('ui.data.error.programIndex'))
        }
        completeCatalogProgress(INDEX_PROGRESS_KEY, programsManifest.indexBytes)
        return payload
      })
      .catch((error: unknown) => { indexPromise = null; resetCatalogProgress(INDEX_PROGRESS_KEY); throw error })
  }
  return indexPromise
}

/** 一個省的完整招生專業清單（學校詳情用）；省份用教育部主表的繁體口徑。 */
export function loadProgramBucket(province: string): Promise<ProgramBucket> {
  const file = (programsManifest.bucketFileByProvince as Record<string, string>)[province.trim()]
  if (!file) return Promise.resolve({})
  if (!bucketPromises.has(file)) {
    const promise = fetchPayload<ProgramBucket>(`${programsManifest.bucketsBasePath}/${file}`)
      .then((bucket) => {
        if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) throw new Error(t('ui.data.error.programBucket'))
        return bucket
      })
      .catch((error: unknown) => { bucketPromises.delete(file); throw error })
    bucketPromises.set(file, promise)
  }
  return bucketPromises.get(file)!
}
