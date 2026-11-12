import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { mountUnapplyIdentity } from './lib/bdfzIdentity'
import { applyThemeState, loadThemeState } from './shared-ui/theme'
import { DEFAULT_LOCALE, adoptLoadedLocale, applyDocumentLocale, getLocale, initialLocale, loadLocale, readStoredLocale } from './i18n/core'

mountUnapplyIdentity()
applyThemeState(loadThemeState())

/** 首繪最多為語言檔等這麼久；慢網路下超過就先用正體首繪，字典到了再切（批 H1：空白頁比先看到正體更糟）。 */
const LOCALE_FIRST_PAINT_BUDGET_MS = 3500

// 語言：已存的或瀏覽器推測的語言不是 zh-Hant 時，先把字典載下來再首繪，避免閃出正體再切換；
// 等待有上限，逾時或載不到就先留在 zh-Hant（來源語言永不缺鍵），字典之後到了再自動切過去。
async function boot() {
  const wanted = initialLocale()
  if (wanted !== DEFAULT_LOCALE) {
    const pending = loadLocale(wanted)
    const inTime = await Promise.race([
      pending.then(() => true, () => false),
      new Promise<boolean>((resolve) => { window.setTimeout(() => resolve(false), LOCALE_FIRST_PAINT_BUDGET_MS) }),
    ])
    if (inTime) {
      adoptLoadedLocale(wanted)
    } else {
      applyDocumentLocale()
      // 使用者在這段時間自己切過語言（已存了別的選擇，或當前已不是預設）就不搶
      pending
        .then(() => { if (getLocale() === DEFAULT_LOCALE && (readStoredLocale() ?? wanted) === wanted) adoptLoadedLocale(wanted) })
        .catch(() => undefined)
    }
  } else {
    applyDocumentLocale()
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
