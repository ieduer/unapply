// 資料備註的對外顯示（2026-11-08 批 G6，主會話裁定 C）：資料檔保留完整核查紀錄，畫面只顯示對使用者有用的部分——
// 以「，；。」切成子句，含內部核查字樣（JavaScript 載入、驗證頁、403、robots、待人工覆核、真實瀏覽器覆核、腳本讀到…）的子句不顯示；括號內的同類說明一併去掉。
const INTERNAL = /JavaScript|驗證頁|验证页|\b403\b|robots|人工覆核|真實瀏覽器|真实浏览器|腳本|脚本|本站未讀到|本站未读到|研究時|研究时|Cloudflare/i

export function publicNote(text: string | null | undefined): string {
  if (!text) return ''
  const withoutAsides = text.replace(/（[^）]*）|\([^)]*\)/g, (aside) => (INTERNAL.test(aside) ? '' : aside))
  return withoutAsides
    .split(/[，；。]/)
    .map((clause) => clause.trim())
    .filter((clause) => clause && !INTERNAL.test(clause))
    .join('，')
}

export function isInternalNote(text: string): boolean {
  return INTERNAL.test(text)
}
