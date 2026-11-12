// 多語言核心（無 React 依賴；engine／data／Function 不得匯入本模組——引擎保持語言中立，見 docs/MAINTENANCE_MANUAL.md §5.3）。
// 三語：zh-Hant（來源語言，打包進主包，永不缺鍵）、zh-Hans（建置期由 zh-Hant 字級轉換生成，懶載）、en（站方翻譯，懶載）。
// 語言只是展示層：不進 AnswerMap、不進 A+ 證據、不進 hash 路由；存 localStorage `unapply.locale.v1`。
import zhHant from './locales/zh-Hant.json'
import { i18nManifest } from '../data/i18nManifest'
import { fetchJson } from '../lib/fetchJson'

export type Locale = 'zh-Hant' | 'zh-Hans' | 'en'
export const LOCALES: readonly Locale[] = ['zh-Hant', 'zh-Hans', 'en']
export const DEFAULT_LOCALE: Locale = 'zh-Hant'
export const LOCALE_STORAGE_KEY = 'unapply.locale.v1'
/** 切換器上的語言名稱，各自以該語言的字形呈現（不翻譯、不轉字形）。 */
export const LOCALE_NAMES: Record<Locale, string> = { 'zh-Hant': '正體', 'zh-Hans': '简体', en: 'EN' } // i18n-literal
/** Intl 用的 BCP 47 標籤。 */
export const LOCALE_TAGS: Record<Locale, string> = { 'zh-Hant': 'zh-Hant-TW', 'zh-Hans': 'zh-Hans-CN', en: 'en-US' }

type Dict = Record<string, string>
export type TranslateParams = Record<string, string | number>

const SOURCE: Dict = zhHant as Dict
const dicts: Partial<Record<Locale, Dict>> = { 'zh-Hant': SOURCE }
// Vite 以 import.meta.env 注入；tsx／Node 測試環境沒有它。
const DEV = Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV)
const loading = new Map<Locale, Promise<Dict>>()
const listeners = new Set<() => void>()
let current: Locale = DEFAULT_LOCALE
const warned = new Set<string>()

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as string[]).includes(value)
}

/** 由瀏覽器語言推測：zh-TW／zh-HK／zh-MO／zh-Hant* → zh-Hant；zh-CN／zh-SG／zh-Hans* → zh-Hans；en* → en；其餘 zh-Hant。 */
export function detectLocale(languages: readonly string[] = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : []): Locale {
  for (const raw of languages) {
    const tag = String(raw || '').toLowerCase()
    if (!tag) continue
    if (/^zh(-hant|-tw|-hk|-mo)(-|$)/.test(tag)) return 'zh-Hant'
    if (/^zh(-hans|-cn|-sg)(-|$)/.test(tag)) return 'zh-Hans'
    if (/^en(-|$)/.test(tag)) return 'en'
    if (tag === 'zh') return 'zh-Hant'
  }
  return DEFAULT_LOCALE
}

export function readStoredLocale(): Locale | null {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    return isLocale(stored) ? stored : null
  } catch {
    return null
  }
}

function saveLocale(locale: Locale) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // 存不下就算了，本次會話仍然生效
  }
}

/** 首次載入時的語言：已存的 > 瀏覽器推測。 */
export function initialLocale(): Locale {
  return readStoredLocale() ?? detectLocale()
}

export function getLocale(): Locale {
  return current
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/**
 * index.html 行內腳本提早發出的字典請求（`window.__nopeEarlyLocale`）：語言與網址都相符才用，而且只用一次。
 * 網址含內容版本；行內腳本裡的版本是建置時由 vite.config.ts 填入的，與這裡的 manifest 同源。
 */
function takeEarlyLocale(locale: Locale, url: string): Promise<Dict> | null {
  if (typeof window === 'undefined') return null
  const holder = window as Window & { __nopeEarlyLocale?: { locale?: string; url?: string; promise?: Promise<unknown> } | null }
  const early = holder.__nopeEarlyLocale
  if (!early || early.locale !== locale || early.url !== url || !early.promise) return null
  holder.__nopeEarlyLocale = null
  return early.promise as Promise<Dict>
}

/** 載入某語言的字典（zh-Hant 已在主包；其餘自 public/i18n/<locale>.json 懶載並核對鍵數）。 */
export function loadLocale(locale: Locale): Promise<Dict> {
  const ready = dicts[locale]
  if (ready) return Promise.resolve(ready)
  const pending = loading.get(locale)
  if (pending) return pending
  const url = `${i18nManifest.basePath}/${locale}.json?v=${encodeURIComponent(i18nManifest.version)}`
  const accept = (dict: Dict) => {
    if (!dict || typeof dict !== 'object' || Object.keys(dict).length !== i18nManifest.counts.keys) throw new Error(`i18n payload for ${locale} is incomplete`)
    return dict
  }
  // index.html 的小段行內腳本會在主包還在下載時就先去抓這份字典（批 H2）；有就接手，沒有、失敗或內容不對就照常下載。
  const early = takeEarlyLocale(locale, url)
  const promise = (early ? early.then(accept).catch(() => fetchJson<Dict>(url).then(accept)) : fetchJson<Dict>(url).then(accept))
    .then((dict) => {
      dicts[locale] = dict
      return dict
    })
    .catch((error: unknown) => { loading.delete(locale); throw error })
  loading.set(locale, promise)
  return promise
}

/**
 * 切換語言：先載字典再切，避免閃出鍵名；載入失敗則維持原語言並拋錯（呼叫端決定是否提示）。
 * 同步 <html lang>、document.title、meta description。
 */
export async function setLocale(locale: Locale, { persist = true }: { persist?: boolean } = {}): Promise<Locale> {
  await loadLocale(locale)
  current = locale
  if (persist) saveLocale(locale)
  applyDocumentLocale()
  listeners.forEach((listener) => listener())
  return locale
}

/** 啟動時用：字典已在手上就直接切（不存儲；存儲只在使用者按切換器時發生）。 */
export function adoptLoadedLocale(locale: Locale) {
  if (!dicts[locale]) throw new Error(`locale ${locale} not loaded`)
  current = locale
  applyDocumentLocale()
  listeners.forEach((listener) => listener())
}

export function applyDocumentLocale() {
  if (typeof document === 'undefined') return
  document.documentElement.lang = t('meta.htmlLang')
  document.title = t('meta.title')
  const description = document.querySelector('meta[name="description"]')
  if (description) description.setAttribute('content', t('meta.description'))
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match))
}

/**
 * 翻譯：目前語言 → zh-Hant 來源 → 鍵名（dev 警告；test:i18n 會把缺鍵當失敗）。
 * 佔位符 ICU 風格 {name}；值由呼叫端代入，永不翻譯。
 */
export function t(key: string, params?: TranslateParams): string {
  const dict = dicts[current]
  const value = dict?.[key] ?? SOURCE[key]
  if (value === undefined) {
    if (DEV && !warned.has(key)) {
      warned.add(key)
      console.warn(`[i18n] missing key: ${key}`)
    }
    return key
  }
  return interpolate(value, params)
}

/** 原始模板（未代入佔位符），給富文本渲染用；缺鍵回鍵名。 */
export function tpl(key: string): string {
  const dict = dicts[current]
  const value = dict?.[key] ?? SOURCE[key]
  if (value === undefined) {
    if (DEV && !warned.has(key)) {
      warned.add(key)
      console.warn(`[i18n] missing key: ${key}`)
    }
    return key
  }
  return value
}

/** 有鍵就翻，沒鍵就用後備（資料驅動的取值：取值原文即後備）。 */
export function tOr(key: string, fallback: string, params?: TranslateParams): string {
  const dict = dicts[current]
  const value = dict?.[key] ?? SOURCE[key]
  return value === undefined ? fallback : interpolate(value, params)
}

export function hasKey(key: string): boolean {
  return key in SOURCE
}

/** 千分位依語言（zh 與 en 的千分位相同，但 Intl 標籤要一致）。 */
export function formatNumber(value: number): string {
  return value.toLocaleString(LOCALE_TAGS[current])
}

/** 清單連接符：zh「、」／en「, 」。 */
export function joinList(items: readonly string[]): string {
  return items.join(t('ui.common.listJoiner'))
}

/** 綁定到指定語言的翻譯函數（React hook 用；也讓測試不經 fetch 就能逐語言比對）。 */
export function translatorFor(locale: Locale) {
  const dict = dicts[locale]
  const lookup = (key: string) => dict?.[key] ?? SOURCE[key]
  return {
    t: (key: string, params?: TranslateParams): string => {
      const value = lookup(key)
      return value === undefined ? key : interpolate(value, params)
    },
    tOr: (key: string, fallback: string, params?: TranslateParams): string => {
      const value = lookup(key)
      return value === undefined ? fallback : interpolate(value, params)
    },
    n: (value: number): string => value.toLocaleString(LOCALE_TAGS[locale]),
  }
}

/** 給測試與建置腳本用：直接安裝字典（不經 fetch）。 */
export function installDictionary(locale: Locale, dict: Record<string, string>) {
  dicts[locale] = dict
}

/** 給測試用：所有已載入字典。 */
export function loadedDictionaries(): Partial<Record<Locale, Dict>> {
  return dicts
}
