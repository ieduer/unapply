import { jointProgramsManifest } from '../data/jointProgramsManifest'
import type { JointIndexPayload, JointItemsPayload } from '../data/jointTypes'

let indexPromise: Promise<JointIndexPayload> | null = null
let itemsPromise: Promise<JointItemsPayload> | null = null

async function fetchPayload<T>(path: string): Promise<T> {
  const response = await fetch(`${path}?v=${encodeURIComponent(jointProgramsManifest.version)}`, { credentials: 'same-origin', signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`joint payload request failed: ${response.status} ${response.statusText}`)
  return response.json() as Promise<T>
}

/** 每校中外合作辦學計數（結果卡片用，約 20 KiB）。 */
export function loadJointIndex(): Promise<JointIndexPayload> {
  if (!indexPromise) {
    indexPromise = fetchPayload<JointIndexPayload>(jointProgramsManifest.indexPath)
      .then((payload) => {
        const entries = Object.values(payload.schools ?? {})
        if (payload.version !== jointProgramsManifest.version || entries.length !== jointProgramsManifest.counts.schools || entries.reduce((n, e) => n + e.i + e.p, 0) !== jointProgramsManifest.counts.matched) throw new Error('中外合作辦學資料不完整，請重新載入')
        return payload
      })
      .catch((error: unknown) => { indexPromise = null; throw error })
  }
  return indexPromise
}

/** 逐校機構／項目清單（學校詳情用）。 */
export function loadJointItems(): Promise<JointItemsPayload> {
  if (!itemsPromise) {
    itemsPromise = fetchPayload<JointItemsPayload>(jointProgramsManifest.itemsPath)
      .then((payload) => {
        const total = Object.values(payload.items ?? {}).reduce((n, list) => n + list.length, 0)
        if (payload.version !== jointProgramsManifest.version || total !== jointProgramsManifest.counts.matched || (payload.unmatched?.length ?? -1) !== jointProgramsManifest.counts.unmatched) throw new Error('中外合作辦學清單不完整，請重新載入')
        return payload
      })
      .catch((error: unknown) => { itemsPromise = null; throw error })
  }
  return itemsPromise
}
