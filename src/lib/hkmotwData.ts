import { t } from '../i18n/core'
import { hkmotwManifest } from '../data/hkmotwManifest'
import type { HkMoTwPoolPayload } from '../data/hkmotwTypes'
import { fetchJson } from './fetchJson'

let poolPromise: Promise<HkMoTwPoolPayload> | null = null

/** 港澳臺院校池（約 30 KiB）：只在 #/hkmotw 與需要時載入，並核對 manifest 的版本與數量。 */
export function loadHkMoTwPool(): Promise<HkMoTwPoolPayload> {
  if (!poolPromise) {
    poolPromise = fetchJson<HkMoTwPoolPayload>(`${hkmotwManifest.path}?v=${encodeURIComponent(hkmotwManifest.version)}`)
      .then((payload) => {
        const counts = hkmotwManifest.counts
        const channels = payload.institutions?.reduce((n, i) => n + (i.channels?.length ?? 0), 0)
        if (payload.version !== hkmotwManifest.version || payload.institutions?.length !== counts.institutions || channels !== counts.channels || payload.regions?.length !== counts.regions) {
          throw new Error(t('ui.data.error.hkmotw'))
        }
        return payload
      })
      .catch((error: unknown) => { poolPromise = null; throw error })
  }
  return poolPromise
}
