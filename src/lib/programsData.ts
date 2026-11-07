import { programsManifest } from '../data/programsManifest'
import type { ProgramCatalogPayload, ProgramOfferingsPayload } from '../data/programsTypes'

let catalogPromise: Promise<ProgramCatalogPayload> | null = null
let offeringsPromise: Promise<ProgramOfferingsPayload> | null = null

async function fetchPayload<T>(path: string): Promise<T> {
  const response = await fetch(`${path}?v=${encodeURIComponent(programsManifest.version)}`, {
    credentials: 'same-origin',
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error(`programs payload request failed: ${response.status} ${response.statusText}`)
  return response.json() as Promise<T>
}

/** 教育部本科專業目錄（883 種）：給起點條件的專業選單用，約 30 KiB。 */
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

/** 逐校招生專業與選考要求：只在結果頁、學校詳情或起點條件生效時載入。 */
export function loadProgramOfferings(): Promise<ProgramOfferingsPayload> {
  if (!offeringsPromise) {
    offeringsPromise = fetchPayload<ProgramOfferingsPayload>(programsManifest.offeringsPath)
      .then((payload) => {
        const counts = programsManifest.counts
        const offerings = Array.isArray(payload.schools) ? payload.schools.reduce((n, s) => n + (s.programs?.length ?? 0), 0) : -1
        if (payload.version !== programsManifest.version
          || payload.schools?.length !== counts.schools
          || offerings !== counts.offerings
          || payload.strongBase?.length !== counts.strongBase) {
          throw new Error('招生專業資料不完整，請重新載入')
        }
        return payload
      })
      .catch((error: unknown) => { offeringsPromise = null; throw error })
  }
  return offeringsPromise
}

/** App 持有的起點條件層狀態：偏好＋懶載入的逐校資料。 */
export interface ProgramsLayerState {
  prefs: import('../data/programPrefs').ProgramPrefs
  payload: ProgramOfferingsPayload | null
  status: 'idle' | 'loading' | 'ready' | 'error'
}
