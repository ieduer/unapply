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

/** 插入一份樣式表；回傳的 promise 在它載入完成（或失敗）時結束，已經插過就立刻結束。 */
function insertStylesheet(name: string, href: string, cors: boolean): Promise<void> {
  if (document.querySelector(`link[data-font-css="${name}"]`)) return Promise.resolve()
  return new Promise((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    if (cors) link.crossOrigin = 'anonymous'
    link.dataset.fontCss = name
    link.addEventListener('load', () => resolve(), { once: true })
    link.addEventListener('error', () => resolve(), { once: true })
    document.head.appendChild(link)
  })
}

/** 等畫面上正在載的字型檔載完（最多等 limitMs）：先讓瀏覽器排一次版，它才知道要抓哪幾個檔。 */
function pendingFontsSettle(limitMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, limitMs)
    const done = () => { window.clearTimeout(timer); resolve() }
    const afterLayout = () => { if (document.fonts?.ready) document.fonts.ready.then(done, done); else done() }
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(() => window.requestAnimationFrame(afterLayout))
    else afterLayout()
  })
}

/** 本站小子集的字最多等這麼久；逾時就不再等，直接接上共用分片。 */
const SITE_SUBSET_WAIT_MS = 15000

/**
 * 排程載入網路字型：只做一次。等問卷前置資料（學校目錄、招生專業摘要）目前的下載都結束（成功或失敗）才插入樣式表。
 * 呼叫時機由 App 決定（首屏畫完、瀏覽器空閒、而且要預載的資料已經開始下載之後）。
 *
 * 順序很重要（批 H2）：先插入本站常用字的小子集（scripts/build_site_font.py 產生，public/fonts/；字族 HuWenMingChaoNope
 * 在 --font-serif 排第一，子集沒有的字自動落到後面的 HuWenMingChao），**等它的樣式表與畫面上用到的字都載完**，才插入共用分片與
 * Google Fonts。共用分片的樣式表有一年快取、回訪時瞬間生效，而本站樣式表要先向伺服器確認；兩份同時插入的話，那一小段時間
 * 瀏覽器只看得到共用分片，會把首頁的二十多片（約 1.5 MB）全抓回來，小子集就白做了。
 */
export function scheduleWebFonts() {
  if (scheduled || typeof document === 'undefined') return
  scheduled = true
  if (prefersSystemFonts()) return
  void whenCriticalLoadsSettle()
    .then(() => insertStylesheet('site', SITE_FONT_CSS, false))
    .then(() => pendingFontsSettle(SITE_SUBSET_WAIT_MS))
    .then(() => {
      void insertStylesheet('huwen', HUWEN_FONT_CSS, true)
      void insertStylesheet('google', GOOGLE_FONT_CSS, false)
    })
}
