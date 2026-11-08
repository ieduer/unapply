import { useCallback, useEffect, useRef, useState } from 'react'
import { applyThemeState, getThemePreset, loadThemeState, saveThemeState, themePresets, type ThemePreset, type ThemeState } from './theme'

/**
 * 色系面板的文字（可選）。不傳就用下面的預設值——就是原本寫死的字串，逐字不變；
 * 姊妹站 path.bdfz.net 不傳，nope.bdfz.net 傳入三語翻譯（2026-11-08 批 G3）。
 */
export interface ThemeCustomizerLabels {
  title: string
  close: string
  sample: string
  presets: Record<ThemePreset['id'], { label: string; description: string }>
}

const defaultLabels: ThemeCustomizerLabels = {
  title: '色系',
  close: '關閉',
  sample: '文字',
  presets: {
    paper: { label: getThemePreset('paper').label, description: getThemePreset('paper').description },
    ink: { label: getThemePreset('ink').label, description: getThemePreset('ink').description },
  },
}

/**
 * 擺放方式（可選）：'floating'（預設）＝右上角固定浮鈕，與原本逐字相同；
 * 'inline'＝觸發鈕在頁頭的正常文檔流裡，面板是錨定觸發鈕的彈層（點外部或 Esc 關閉、焦點回到觸發鈕、自動留在視窗內；
 * 窄螢幕只顯示色點，名稱放在 aria-label）。2026-11-08 起 nope.bdfz.net 用 inline；path.bdfz.net 不傳，維持 floating。
 */
export type ThemeCustomizerPlacement = 'floating' | 'inline'

/** 右上角的色系切換。只有兩套，每一套的文字對比度都過了閘門。 */
export function ThemeCustomizer({ labels, placement = 'floating' }: { labels?: Partial<ThemeCustomizerLabels>; placement?: ThemeCustomizerPlacement } = {}) {
  const text: ThemeCustomizerLabels = { ...defaultLabels, ...labels, presets: { ...defaultLabels.presets, ...labels?.presets } }
  const [open, setOpen] = useState(false)
  const [themeState, setThemeState] = useState<ThemeState>(() => loadThemeState())
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [shift, setShift] = useState(0)

  useEffect(() => {
    applyThemeState(themeState)
    saveThemeState(themeState)
  }, [themeState])

  // inline 彈層：右對齊觸發鈕，超出視窗時水平平移，四邊至少留 12px
  const place = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const rect = root.getBoundingClientRect()
    const width = Math.min(256, window.innerWidth - 24)
    let next = 0
    if (rect.right - width < 12) next = rect.right - width - 12
    if (rect.right > window.innerWidth - 12) next = rect.right - (window.innerWidth - 12)
    setShift(next)
  }, [])

  useEffect(() => {
    if (placement !== 'inline' || !open) return
    const onPointer = (event: PointerEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false) }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); buttonRef.current?.focus() } }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
    }
  }, [placement, open, place])

  const active = themePresets.find((preset) => preset.id === themeState.presetId) ?? themePresets[0]

  const presetButtons = (
    <div className="mt-3 grid gap-2">
      {themePresets.map((preset) => {
        const selected = preset.id === themeState.presetId
        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={selected}
            onClick={() => setThemeState({ presetId: preset.id })}
            className={[
              'w-full rounded-xl border px-3 py-3 text-left transition-colors min-h-[56px]',
              selected ? 'border-accent-500 bg-accent-500/10' : 'border-ink-700 hover:border-fog-500',
            ].join(' ')}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="serif text-base text-fog-100">{text.presets[preset.id].label}</p>
                <p className="mt-1 text-xs text-fog-300">{text.presets[preset.id].description}</p>
              </div>
              <span
                aria-hidden="true"
                className="flex h-7 w-12 shrink-0 items-center justify-center rounded-md border border-ink-700 text-xs"
                style={{ backgroundColor: preset.palette.ink950, color: preset.palette.fog100 }}
              >
                {text.sample}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )

  if (placement === 'inline') {
    return (
      <div ref={rootRef} className="relative inline-flex shrink-0" data-theme-customizer="inline">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => { if (!open) place(); setOpen((value) => !value) }}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={`${text.title} · ${text.presets[active.id].label}`}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-ink-700 bg-ink-900 min-h-[44px] min-w-[44px] px-3 text-sm text-fog-100 hover:border-accent-500 normal-case tracking-normal font-sans"
        >
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: active.palette.accent500 }} />
          <span className="hidden sm:inline whitespace-nowrap">{text.title} · {text.presets[active.id].label}</span>
        </button>
        {open && (
          <section
            role="dialog"
            aria-label={text.title}
            className="absolute top-[calc(100%+0.5rem)] right-0 z-50 w-[min(16rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-ink-700 bg-ink-900 px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.25)] normal-case tracking-normal font-sans text-left"
            style={shift ? { transform: `translateX(${-shift}px)` } : undefined}
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="serif text-lg text-fog-100">{text.title}</h2>
              <button
                type="button"
                onClick={() => { setOpen(false); buttonRef.current?.focus() }}
                className="text-sm text-fog-300 hover:text-fog-100 min-h-[40px] px-2"
              >
                {text.close}
              </button>
            </div>
            {presetButtons}
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="fixed top-[calc(env(safe-area-inset-top)+3.75rem)] right-3 sm:right-6 z-40 pointer-events-none">
      <div className="pointer-events-auto flex flex-col items-end gap-3 w-[min(16rem,calc(100vw-1.5rem))]">
        {open && (
          <section className="w-full rounded-2xl border border-ink-700 bg-ink-900 px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between gap-4">
              <h2 className="serif text-lg text-fog-100">{text.title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-fog-300 hover:text-fog-100 min-h-[40px] px-2"
              >
                {text.close}
              </button>
            </div>

            <div className="mt-3 grid gap-2">
              {themePresets.map((preset) => {
                const selected = preset.id === themeState.presetId
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setThemeState({ presetId: preset.id })}
                    className={[
                      'w-full rounded-xl border px-3 py-3 text-left transition-colors min-h-[56px]',
                      selected ? 'border-accent-500 bg-accent-500/10' : 'border-ink-700 hover:border-fog-500',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="serif text-base text-fog-100">{text.presets[preset.id].label}</p>
                        <p className="mt-1 text-xs text-fog-300">{text.presets[preset.id].description}</p>
                      </div>
                      <span
                        aria-hidden="true"
                        className="flex h-7 w-12 shrink-0 items-center justify-center rounded-md border border-ink-700 text-xs"
                        style={{ backgroundColor: preset.palette.ink950, color: preset.palette.fog100 }}
                      >
                        {text.sample}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-2xl border border-ink-700 bg-ink-900 px-3.5 py-2.5 text-sm text-fog-100 hover:border-accent-500 min-h-[44px] shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
        >
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: active.palette.accent500 }} />
          <span>{text.title} · {text.presets[active.id].label}</span>
        </button>
      </div>
    </div>
  )
}
