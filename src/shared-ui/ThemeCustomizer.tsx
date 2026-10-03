import { useEffect, useState } from 'react'
import { applyThemeState, loadThemeState, saveThemeState, themePresets, type ThemeState } from './theme'

/** 右上角的色系切換。只有兩套，每一套的文字對比度都過了閘門。 */
export function ThemeCustomizer() {
  const [open, setOpen] = useState(false)
  const [themeState, setThemeState] = useState<ThemeState>(() => loadThemeState())

  useEffect(() => {
    applyThemeState(themeState)
    saveThemeState(themeState)
  }, [themeState])

  const active = themePresets.find((preset) => preset.id === themeState.presetId) ?? themePresets[0]

  return (
    <div className="fixed top-[calc(env(safe-area-inset-top)+3.75rem)] right-3 sm:right-6 z-40 pointer-events-none">
      <div className="pointer-events-auto flex flex-col items-end gap-3 w-[min(16rem,calc(100vw-1.5rem))]">
        {open && (
          <section className="w-full rounded-2xl border border-ink-700 bg-ink-900 px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between gap-4">
              <h2 className="serif text-lg text-fog-100">色系</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-fog-300 hover:text-fog-100 min-h-[40px] px-2"
              >
                關閉
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
                        <p className="serif text-base text-fog-100">{preset.label}</p>
                        <p className="mt-1 text-xs text-fog-300">{preset.description}</p>
                      </div>
                      <span
                        aria-hidden="true"
                        className="flex h-7 w-12 shrink-0 items-center justify-center rounded-md border border-ink-700 text-xs"
                        style={{ backgroundColor: preset.palette.ink950, color: preset.palette.fog100 }}
                      >
                        文字
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
          <span>色系 · {active.label}</span>
        </button>
      </div>
    </div>
  )
}
