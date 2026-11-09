import { useState } from 'react'
import { LOCALES, type Locale } from '../i18n/core'
import { useLocale } from '../i18n/react'

// 各語言以自己的文字標示自己（不隨介面語言翻譯）
const SHORT: Record<Locale, string> = { 'zh-Hant': '正', 'zh-Hans': '简', en: 'EN' } // i18n-literal

/**
 * 頁頭語言切換（2026-11-08 批 G9：三段式改為單鍵循環 正體 → 简体 → EN → 正體）。按鈕顯示目前語言縮寫，
 * aria-label 說出目前語言與點擊後的語言；與色系按鈕同尺寸同樣式。存 localStorage（unapply.locale.v1，不變）。
 * 字典先載再切；載不到就留在原語言並以 title 提示（不彈窗、不打斷）。
 */
export function LocaleSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useLocale()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const next = LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length]
  const aria = t('ui.locale.toggleAria', { current: t(`ui.locale.name.${locale}`), next: t(`ui.locale.name.${next}`) })
  const cycle = () => {
    if (busy) return
    setBusy(true)
    setFailed(false)
    setLocale(next).catch(() => setFailed(true)).finally(() => setBusy(false))
  }
  return (
    <button
      type="button"
      lang={locale}
      onClick={cycle}
      disabled={busy}
      aria-label={aria}
      title={failed ? t('ui.locale.loadFailed') : aria}
      data-locale-toggle={locale}
      className={['shrink-0 inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] rounded-ctl border border-ink-700 bg-ink-900 px-3 text-xs text-fog-100 font-semibold normal-case tracking-normal font-sans hover:border-accent-500', className].join(' ')}
    >
      <span>{SHORT[locale]}</span>
      <span aria-hidden="true" className="text-fog-500 font-normal">⇄</span>
    </button>
  )
}
