import { useEffect, useState } from 'react'
import { applyThemeState, getThemePreset, loadThemeState, saveThemeState, type ThemeState } from '../shared-ui/theme'
import { nextThemePreset } from '../lib/themeCycle'
import { useLocale } from '../i18n/react'

/**
 * 色系一鍵切換（2026-11-08 批 G5，取代頁頭的色系彈層）：色點＋目前色系名（窄螢幕只顯示色點），點一下切到下一套並記住。
 * 切換當下關掉所有 transition（.theme-switching），避免文字在兩套顏色之間出現看不清的中間色。
 */
export function ThemeToggle() {
  const { t } = useLocale()
  const [state, setState] = useState<ThemeState>(() => loadThemeState())
  useEffect(() => { applyThemeState(state) }, [state])
  const current = getThemePreset(state.presetId)
  const next = nextThemePreset(state)
  const label = (id: string) => t(`ui.theme.${id}.label`)
  const toggle = () => {
    const nextState: ThemeState = { presetId: next.id }
    const root = document.documentElement
    root.classList.add('theme-switching')
    applyThemeState(nextState)
    saveThemeState(nextState)
    void getComputedStyle(root).color // 在關掉 transition 的狀態下先算完新樣式
    root.classList.remove('theme-switching')
    setState(nextState)
  }
  return (
    <button
      type="button"
      onClick={toggle}
      data-theme-toggle={current.id}
      aria-label={t('ui.theme.toggleAria', { current: label(current.id), next: label(next.id) })}
      title={t('ui.theme.toggleAria', { current: label(current.id), next: label(next.id) })}
      className="shrink-0 inline-flex items-center gap-2 min-h-[44px] min-w-[44px] justify-center rounded-full border border-ink-700 bg-ink-900 px-3 text-xs text-fog-200 normal-case tracking-normal font-sans hover:border-accent-500"
    >
      <span aria-hidden="true" className="h-3.5 w-3.5 rounded-full border border-ink-700" style={{ backgroundColor: current.palette.accent500 }} />
      <span className="hidden sm:inline whitespace-nowrap">{label(current.id)}</span>
    </button>
  )
}
