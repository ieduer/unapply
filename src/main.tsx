import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { mountUnapplyIdentity } from './lib/bdfzIdentity'
import { applyThemeState, loadThemeState } from './shared-ui/theme'
import { DEFAULT_LOCALE, adoptLoadedLocale, applyDocumentLocale, initialLocale, loadLocale } from './i18n/core'

mountUnapplyIdentity()
applyThemeState(loadThemeState())

// 語言：已存的或瀏覽器推測的語言不是 zh-Hant 時，先把字典載下來再首繪，避免閃出正體再切換；載不到就留在 zh-Hant（來源語言永不缺鍵）。
async function boot() {
  const wanted = initialLocale()
  if (wanted !== DEFAULT_LOCALE) {
    try {
      await loadLocale(wanted)
      adoptLoadedLocale(wanted)
    } catch {
      applyDocumentLocale()
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
