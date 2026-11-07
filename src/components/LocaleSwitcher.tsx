import { useState } from 'react'
import { LOCALES, LOCALE_NAMES, type Locale } from '../i18n/core'
import { useLocale } from '../i18n/react'

/**
 * 頭部三態語言切換：正體／简体／EN。存 localStorage（unapply.locale.v1），不進 hash 路由。
 * 字典先載再切；載不到就留在原語言並以 title 提示（不彈窗、不打斷）。
 */
export function LocaleSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useLocale()
  const [busy, setBusy] = useState<Locale | null>(null)
  const [failed, setFailed] = useState<Locale | null>(null)
  const pick = (next: Locale) => {
    if (next === locale || busy) return
    setBusy(next)
    setFailed(null)
    setLocale(next).catch(() => setFailed(next)).finally(() => setBusy(null))
  }
  return (
    <div role="group" aria-label={t('ui.locale.aria')} className={['inline-flex rounded-full border border-ink-700 bg-ink-900 overflow-hidden text-xs', className].join(' ')}>
      {LOCALES.map((item) => {
        const active = item === locale
        return (
          <button
            key={item}
            type="button"
            lang={item}
            onClick={() => pick(item)}
            aria-pressed={active}
            disabled={busy !== null}
            title={failed === item ? t('ui.locale.loadFailed') : undefined}
            className={[
              'px-3 min-h-[36px] font-semibold tracking-normal normal-case',
              active ? 'bg-accent-500 text-ink-950' : 'text-fog-300 hover:text-fog-100',
              busy === item ? 'text-fog-500' : '',
            ].join(' ')}
          >
            {LOCALE_NAMES[item]}
          </button>
        )
      })}
    </div>
  )
}
