// 路由小工具（批 G6）：區分「站內點擊導航」與「瀏覽器返回／前進」——前者捲到頂部，後者還原離開時的捲動位置。
// 只記在記憶體（每個 hash 一個位置），不寫儲存。
let explicit = false
const positions = new Map<string, number>()

/** 站內導航前呼叫：下一次路由變化捲到頂部。 */
export function markExplicitNavigation() {
  explicit = true
}

/** 讀一次並清掉。 */
export function consumeExplicitNavigation(): boolean {
  const value = explicit
  explicit = false
  return value
}

/** 站內鏈接用：等同點擊導航。 */
export function navigateHash(hash: string) {
  markExplicitNavigation()
  if (window.location.hash !== hash) window.location.hash = hash
}

export function hashOf(url: string): string {
  const i = url.indexOf('#')
  return i === -1 ? '#/' : url.slice(i).split('?')[0] || '#/'
}

export function rememberScroll(hash: string, y: number) {
  positions.set(hash, y)
}

export function recallScroll(hash: string): number {
  return positions.get(hash) ?? 0
}
