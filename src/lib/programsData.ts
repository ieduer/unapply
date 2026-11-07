import { programsManifest } from '../data/programsManifest'
import type { ProgramBucket, ProgramCatalogPayload, ProgramIndexPayload } from '../data/programsTypes'

let catalogPromise: Promise<ProgramCatalogPayload> | null = null
let indexPromise: Promise<ProgramIndexPayload> | null = null
const bucketPromises = new Map<string, Promise<ProgramBucket>>()

async function fetchPayload<T>(path: string): Promise<T> {
  const response = await fetch(`${path}?v=${encodeURIComponent(programsManifest.version)}`, {
    credentials: 'same-origin',
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error(`programs payload request failed: ${response.status} ${response.statusText}`)
  return response.json() as Promise<T>
}

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
          throw new Error('專業目錄資料不完整，請重新載入')
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
    indexPromise = fetchPayload<ProgramIndexPayload>(programsManifest.indexPath)
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
          throw new Error('招生專業資料不完整，請重新載入')
        }
        return payload
      })
      .catch((error: unknown) => { indexPromise = null; throw error })
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
        if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) throw new Error('招生專業清單格式不對，請重新載入')
        return bucket
      })
      .catch((error: unknown) => { bucketPromises.delete(file); throw error })
    bucketPromises.set(file, promise)
  }
  return bucketPromises.get(file)!
}

/** App 持有的起點條件層狀態：偏好＋懶載入的每校摘要。 */
export interface ProgramsLayerState {
  prefs: import('../data/programPrefs').ProgramPrefs
  index: ProgramIndexPayload | null
  status: 'idle' | 'loading' | 'ready' | 'error'
}
