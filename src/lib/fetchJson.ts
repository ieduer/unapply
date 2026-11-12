// 資料檔下載（2026-11-12 批 H1）。
//
// 之前每個載入器都用 AbortSignal.timeout(15–20 秒) 當「整體時限」：慢網路下檔案還在正常下載就被砍掉
// （1.1 MB 的學校目錄在 60 KB/s 下必然逾時→「目錄載入失敗」），被砍掉的請求不進快取，重試又從零開始，
// 於是同一位使用者怎麼重試都失敗。這裡改成：
//   - 只在「一段時間完全沒有收到任何資料」才放棄（斷流逾時），不設整體時限；
//   - 自動重試並退避；4xx（除 408／429）不重試；
//   - 回報進度（已收位元組；總量由呼叫端從 manifest 給，因為壓縮傳輸下 Content-Length 不是解壓後大小）。
// 規則：本站所有資料檔都走這裡，不要再對資料下載設整體時限（維護手冊 §5.6）。

export type DataLoadFailure = 'offline' | 'stalled' | 'network' | 'http' | 'parse'

export class DataLoadError extends Error {
  readonly kind: DataLoadFailure
  readonly status: number | null
  constructor(kind: DataLoadFailure, message: string, status: number | null = null) {
    super(message)
    this.name = 'DataLoadError'
    this.kind = kind
    this.status = status
  }
}

export interface FetchJsonProgress {
  /** 已收到的位元組（解壓後） */
  loaded: number
  /** 第幾次嘗試（0 起算；>0 表示正在重試） */
  attempt: number
}

export interface FetchJsonOptions {
  /** 連續多久沒有收到任何資料就放棄這次嘗試（毫秒） */
  stallMs?: number
  /** 失敗後自動重試的次數 */
  retries?: number
  onProgress?: (progress: FetchJsonProgress) => void
}

const DEFAULT_STALL_MS = 25000
const DEFAULT_RETRIES = 2

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => { globalThis.setTimeout(resolve, ms) })
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function retryable(error: DataLoadError): boolean {
  if (error.kind === 'offline') return false
  if (error.kind === 'http') return error.status === 408 || error.status === 429 || (error.status !== null && error.status >= 500)
  return true
}

async function attemptFetch<T>(url: string, stallMs: number, attempt: number, onProgress?: (progress: FetchJsonProgress) => void): Promise<T> {
  if (isOffline()) throw new DataLoadError('offline', 'offline')
  const controller = new AbortController()
  let stalled = false
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined
  const arm = () => {
    if (timer !== undefined) globalThis.clearTimeout(timer)
    timer = globalThis.setTimeout(() => { stalled = true; controller.abort() }, stallMs)
  }
  arm()
  try {
    const response = await fetch(url, { credentials: 'same-origin', signal: controller.signal })
    if (!response.ok) throw new DataLoadError('http', `request failed: ${response.status} ${response.statusText}`, response.status)
    arm()
    onProgress?.({ loaded: 0, attempt })
    let text: string
    const reader = response.body && typeof response.body.getReader === 'function' ? response.body.getReader() : null
    if (reader) {
      const decoder = new TextDecoder()
      const parts: string[] = []
      let loaded = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        loaded += value.byteLength
        parts.push(decoder.decode(value, { stream: true }))
        arm()
        onProgress?.({ loaded, attempt })
      }
      parts.push(decoder.decode())
      text = parts.join('')
    } else {
      text = await response.text()
    }
    try {
      return JSON.parse(text) as T
    } catch {
      throw new DataLoadError('parse', 'response is not complete JSON')
    }
  } catch (error) {
    if (error instanceof DataLoadError) throw error
    if (stalled) throw new DataLoadError('stalled', `no data received for ${stallMs} ms`)
    if (isOffline()) throw new DataLoadError('offline', 'offline')
    throw new DataLoadError('network', error instanceof Error ? error.message : String(error))
  } finally {
    if (timer !== undefined) globalThis.clearTimeout(timer)
  }
}

/** 下載並解析一個 JSON 資料檔；失敗時拋 DataLoadError。 */
export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const stallMs = options.stallMs ?? DEFAULT_STALL_MS
  const retries = options.retries ?? DEFAULT_RETRIES
  let last: DataLoadError | null = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) await wait(Math.min(700 * 2 ** (attempt - 1), 4000))
    try {
      return await attemptFetch<T>(url, stallMs, attempt, options.onProgress)
    } catch (error) {
      last = error instanceof DataLoadError ? error : new DataLoadError('network', error instanceof Error ? error.message : String(error))
      if (!retryable(last)) break
    }
  }
  throw last ?? new DataLoadError('network', 'request failed')
}

/** 把載入錯誤轉成翻譯鍵與參數（頁面顯示人話，不顯示 “signal timed out” 之類的原文）。 */
export function describeLoadError(error: unknown): { key: string; params?: Record<string, string | number> } | null {
  if (!(error instanceof DataLoadError)) return null
  if (error.kind === 'offline') return { key: 'ui.data.error.offline' }
  if (error.kind === 'http') return { key: 'ui.data.error.server', params: { status: error.status ?? 0 } }
  if (error.kind === 'parse') return { key: 'ui.data.error.incomplete' }
  return { key: 'ui.data.error.network' }
}
