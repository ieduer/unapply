// React 端：訂閱語言變更。元件在頂層呼叫 useLocale()，語言切換時整頁重繪；useMemo 內用到翻譯的要把回傳的 t 放進依賴。
import { useMemo, useSyncExternalStore } from 'react'
import { getLocale, setLocale, subscribeLocale, translatorFor, type Locale } from './core'

export function useLocale() {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale)
  // 綁定當前 locale 的 t／tOr／n：引用隨語言變，useMemo／useCallback 把它們放進依賴即可自動重算。
  const bound = useMemo(() => translatorFor(locale), [locale])
  return { locale, t: bound.t, tOr: bound.tOr, n: bound.n, setLocale }
}

export type { Locale }
