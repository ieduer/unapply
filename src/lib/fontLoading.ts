// 網路字型的載入時機（2026-11-12 批 H1）。
//
// 字型是裝飾，資料是功能。正文字體湖文明朝體即使用了共用分片，首頁也要抓二十多片、合計約 1.5 MB，
// 而且瀏覽器以最高優先級下載字型；在慢網路上它會和問卷要用的學校目錄搶頻寬。
// 所以字型樣式表不寫在 index.html（那樣一開頁就開始下載），而是由這裡在
// 「首屏已經畫出來、而且問卷前置資料沒有在下載」時才插入；之前文字用系統襯線字顯示（font-display: swap）。
// 省流量模式（Save-Data）與 2G 連線不載網路字型。沒有 JavaScript 時走 index.html 的 <noscript>。
import { SITE_FONT_CSS } from '../data/siteFontCss'
import { whenCriticalLoadsSettle } from './loadProgress'

/** 湖文明朝體共用分片（mx.bdfz.net；90 片 unicode-range，瀏覽器只抓畫面上用到的字）。v1 不可變；換字形時 mx 出 v2 再改這裡。 */
export const HUWEN_FONT_CSS = 'https://mx.bdfz.net/fonts/huwen/v1/HuWenMingChao.4eeeeaf657.css'
/** 等寬、無襯線與襯線後備字（Google Fonts）。 */
export const GOOGLE_FONT_CSS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Serif+SC:wght@500;600;700&family=Noto+Serif+TC:wght@500;600;700&family=Space+Grotesk:wght@400;500;700&display=swap'

let scheduled = false

/** 省流量或極慢連線：不載網路字型（只有部分瀏覽器提供這些訊號；沒有訊號時照常載）。 */
export function prefersSystemFonts(nav: { connection?: { saveData?: boolean; effectiveType?: string } } = typeof navigator !== 'undefined' ? navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } } : {}): boolean {
  const connection = nav.connection
  if (!connection) return false
  return connection.saveData === true || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g'
}

function insertStylesheet(name: string, href: string, cors: boolean) {
  if (document.querySelector(`link[data-font-css="${name}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  if (cors) link.crossOrigin = 'anonymous'
  link.dataset.fontCss = name
  document.head.appendChild(link)
}

/**
 * 排程載入網路字型：只做一次。等問卷前置資料（學校目錄、招生專業摘要）目前的下載都結束（成功或失敗）才插入樣式表。
 * 呼叫時機由 App 決定（首屏畫完、瀏覽器空閒、而且要預載的資料已經開始下載之後）。
 */
export function scheduleWebFonts() {
  if (scheduled || typeof document === 'undefined') return
  scheduled = true
  if (prefersSystemFonts()) return
  void whenCriticalLoadsSettle().then(() => {
    // 本站常用字的小子集（批 H2；scripts/build_site_font.py 產生，public/fonts/）：首頁與作答流程會出現的字各自切成小檔，
    // 字族 HuWenMingChaoNope 在 --font-serif 排第一（src/index.css），子集沒有的字自動落到後面的 HuWenMingChao（共用分片）。
    insertStylesheet('site', SITE_FONT_CSS, false)
    insertStylesheet('huwen', HUWEN_FONT_CSS, true)
    insertStylesheet('google', GOOGLE_FONT_CSS, false)
  })
}
