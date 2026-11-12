import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// index.html 裡提早下載語言字典的行內腳本需要字典的內容版本（批 H2）。
// 版本讀自建置鏈剛產生的 src/data/i18nManifest.ts（data:i18n 在 vite build 之前跑）；讀不到或佔位符沒被換掉就讓建置失敗，
// 免得上線的頁面去要一個不存在的版本。
function earlyLocaleVersion(): Plugin {
  return {
    name: 'nope-early-locale-version',
    transformIndexHtml(html) {
      const manifest = readFileSync(new URL('./src/data/i18nManifest.ts', import.meta.url), 'utf8')
      const version = /"version":\s*"([0-9a-f]{12})"/.exec(manifest)?.[1]
      if (!version) throw new Error('i18n manifest version not found; run npm run data:i18n first')
      if (!html.includes('%NOPE_I18N_VERSION%')) throw new Error('index.html lost the %NOPE_I18N_VERSION% placeholder')
      return html.replaceAll('%NOPE_I18N_VERSION%', version)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), earlyLocaleVersion()],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
})
