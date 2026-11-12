// 問卷前置資料（學校目錄＋逐校招生專業摘要）的下載進度：載入畫面用它顯示百分比，
// 讓慢網路的使用者看得到「還在下載」而不是一個不動的畫面（2026-11-12 批 H1）。
export interface CatalogProgress {
  /** 0–100；兩個檔案合計。總量未知時為 null。 */
  percent: number | null
  /** 任一檔案正在自動重試 */
  retrying: boolean
}

interface Entry { loaded: number; total: number; attempt: number }

const entries = new Map<string, Entry>()
const listeners = new Set<() => void>()
let snapshot: CatalogProgress = { percent: null, retrying: false }

function recompute() {
  let loaded = 0
  let total = 0
  let retrying = false
  for (const entry of entries.values()) {
    loaded += Math.min(entry.loaded, entry.total)
    total += entry.total
    if (entry.attempt > 0 && entry.loaded < entry.total) retrying = true
  }
  const percent = total > 0 ? Math.min(100, Math.floor((loaded / total) * 100)) : null
  if (percent === snapshot.percent && retrying === snapshot.retrying) return
  snapshot = { percent, retrying }
  listeners.forEach((listener) => listener())
}

/** 回報一個檔案的進度；total 是 manifest 記的解壓後位元組數。 */
export function reportCatalogProgress(key: string, loaded: number, total: number, attempt: number) {
  entries.set(key, { loaded, total, attempt })
  recompute()
}

/** 一個檔案載完（或從快取拿到）：算作 100%。 */
export function completeCatalogProgress(key: string, total: number) {
  entries.set(key, { loaded: total, total, attempt: 0 })
  recompute()
}

/** 載入失敗後重試前清掉：百分比從頭算。 */
export function resetCatalogProgress(key: string) {
  entries.delete(key)
  recompute()
}

export function subscribeCatalogProgress(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getCatalogProgress(): CatalogProgress {
  return snapshot
}

// —— 問卷前置資料「正在下載」的追蹤：字型等裝飾資源等它們結束才開始載（src/lib/fontLoading.ts）。
let criticalInFlight = 0
let criticalWaiters: (() => void)[] = []

/** 登記一個問卷前置資料的下載；結束（成功或失敗）時自動除名。回傳原 promise。 */
export function trackCriticalLoad<T>(promise: Promise<T>): Promise<T> {
  criticalInFlight += 1
  const done = () => {
    criticalInFlight -= 1
    if (criticalInFlight === 0) {
      const waiters = criticalWaiters
      criticalWaiters = []
      waiters.forEach((resolve) => resolve())
    }
  }
  promise.then(done, done)
  return promise
}

/** 目前登記的下載都結束時 resolve；沒有下載在進行就立刻 resolve。 */
export function whenCriticalLoadsSettle(): Promise<void> {
  if (criticalInFlight === 0) return Promise.resolve()
  return new Promise((resolve) => { criticalWaiters.push(resolve) })
}
