import { t } from '../i18n/core'
import { overseasManifest } from '../data/overseasManifest'
import type { OverseasIndexPayload, OverseasRegionPayload } from '../data/overseasTypes'
import { fetchJson } from './fetchJson'

let indexPromise: Promise<OverseasIndexPayload> | null = null
const regionPromises = new Map<string, Promise<OverseasRegionPayload>>()

function fetchPayload<T>(path: string): Promise<T> {
  return fetchJson<T>(`${path}?v=${encodeURIComponent(overseasManifest.version)}`)
}

/** 海外可申請學校索引（每機構一條摘要＋地區清單，約 17 KiB gzip）：只在 #/overseas 與需要時載入，並核對 manifest 的版本與數量。 */
export function loadOverseasIndex(): Promise<OverseasIndexPayload> {
  if (!indexPromise) {
    indexPromise = fetchPayload<OverseasIndexPayload>(overseasManifest.indexPath)
      .then((payload) => {
        const counts = overseasManifest.counts
        const institutions = Array.isArray(payload.institutions) ? payload.institutions : []
        if (payload.version !== overseasManifest.version
          || payload.regions?.length !== counts.regions
          || institutions.length !== counts.institutions
          || institutions.filter((i) => i.linkLive).length !== counts.admissionsLinksLive
          || institutions.filter((i) => i.status === 'verified').length !== counts.byStatus.verified) {
          throw new Error(t('ui.data.error.overseasIndex'))
        }
        return payload
      })
      .catch((error: unknown) => { indexPromise = null; throw error })
  }
  return indexPromise
}

/** 一個地區的完整資料（機構全欄原文片段、申請平台、簽證頁）；只在進入地區頁時載入。 */
export function loadOverseasRegion(slug: string): Promise<OverseasRegionPayload> {
  if (!/^[a-z0-9-]{2,64}$/.test(slug)) return Promise.reject(new Error(t('ui.data.error.regionSlug')))
  if (!regionPromises.has(slug)) {
    const promise = fetchPayload<OverseasRegionPayload>(`${overseasManifest.regionsBasePath}/${slug}.json`)
      .then((payload) => {
        if (payload.version !== overseasManifest.version || payload.region?.slug !== slug || !Array.isArray(payload.institutions) || !Array.isArray(payload.portals) || !Array.isArray(payload.visa)) {
          throw new Error(t('ui.data.error.overseasRegion'))
        }
        return payload
      })
      .catch((error: unknown) => { regionPromises.delete(slug); throw error })
    regionPromises.set(slug, promise)
  }
  return regionPromises.get(slug)!
}
