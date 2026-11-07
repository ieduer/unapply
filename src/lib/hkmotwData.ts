import { hkmotwManifest } from '../data/hkmotwManifest'
import type { HkMoTwPoolPayload } from '../data/hkmotwTypes'

let poolPromise: Promise<HkMoTwPoolPayload> | null = null

/** 港澳臺院校池（約 30 KiB）：只在 #/hkmotw 與需要時載入，並核對 manifest 的版本與數量。 */
export function loadHkMoTwPool(): Promise<HkMoTwPoolPayload> {
  if (!poolPromise) {
    poolPromise = fetch(`${hkmotwManifest.path}?v=${encodeURIComponent(hkmotwManifest.version)}`, { credentials: 'same-origin', signal: AbortSignal.timeout(20000) })
      .then((response) => {
        if (!response.ok) throw new Error(`hkmotw payload request failed: ${response.status} ${response.statusText}`)
        return response.json() as Promise<HkMoTwPoolPayload>
      })
      .then((payload) => {
        const counts = hkmotwManifest.counts
        const channels = payload.institutions?.reduce((n, i) => n + (i.channels?.length ?? 0), 0)
        if (payload.version !== hkmotwManifest.version || payload.institutions?.length !== counts.institutions || channels !== counts.channels || payload.regions?.length !== counts.regions) {
          throw new Error('港澳臺院校池資料不完整，請重新載入')
        }
        return payload
      })
      .catch((error: unknown) => { poolPromise = null; throw error })
  }
  return poolPromise
}
