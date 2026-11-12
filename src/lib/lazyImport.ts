// 懶載 chunk 的 importer 包裝（批 H2）：網路不穩時 import() 失敗會自動再試幾次（退避），
// 同一個 importer 的成功結果只會有一份（瀏覽器的模組快取），所以 React.lazy 與預取可以共用。
// 重試仍失敗就把錯誤拋出去，由 PageErrorBoundary 顯示說明。
const RETRIES = 2

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => { globalThis.setTimeout(resolve, ms) })
}

export function retryingImport<T>(importer: () => Promise<T>, retries = RETRIES): () => Promise<T> {
  const attempt = (left: number): Promise<T> => importer().catch((error: unknown) => {
    if (left <= 0) throw error
    return wait(600 * (retries - left + 1)).then(() => attempt(left - 1))
  })
  return () => attempt(retries)
}
