import { useEffect, useMemo, useState } from 'react'
import {
  applyThemeState,
  defaultThemeState,
  getThemePreset,
  loadThemeState,
  saveThemeState,
  themePresets,
  type ThemePalette,
  type ThemeState,
} from '../lib/theme'

function PresetSwatches({ accent, palette }: { accent: string; palette: ThemePalette }) {
  return (
    <div className="flex items-center gap-1">
      <span
        className="w-3 h-3 rounded-full border border-white/10"
        style={{ background: `linear-gradient(180deg, ${palette.canvasTop}, ${palette.canvasBottom})` }}
      />
      <span className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: palette.ink800 }} />
      <span className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: accent }} />
    </div>
  )
}

export function ThemeCustomizer() {
  const [open, setOpen] = useState(false)
  const [themeState, setThemeState] = useState<ThemeState>(() => loadThemeState())

  useEffect(() => {
    applyThemeState(themeState)
    saveThemeState(themeState)
  }, [themeState])

  const activePreset = useMemo(() => getThemePreset(themeState.presetId), [themeState.presetId])

  return (
    <div className="fixed top-[calc(env(safe-area-inset-top)+3.75rem)] right-3 sm:right-6 z-40 pointer-events-none">
      <div className="pointer-events-auto flex flex-col items-end gap-3 w-[min(20rem,calc(100vw-1.5rem))] sm:w-80">
        {open && (
          <section className="w-full rounded-2xl border border-ink-700 bg-ink-900/95 backdrop-blur px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mono text-[10px] uppercase tracking-[0.2em] text-fog-500">theme</p>
                <h2 className="serif text-lg text-fog-100">自定義色系</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-fog-500 hover:text-fog-100 min-h-[40px] px-2"
              >
                關閉
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              {themePresets.map((preset) => {
                const active = preset.id === themeState.presetId
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setThemeState((current) => ({ ...current, presetId: preset.id }))}
                    className={[
                      'w-full rounded-xl border px-3 py-3 text-left transition-colors',
                      active
                        ? 'border-accent-500 bg-accent-500/8'
                        : 'border-ink-700 hover:border-fog-500',
                    ].join(' ')}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="sans text-sm text-fog-100">{preset.label}</p>
                          <p className="mt-1 text-[11px] text-fog-500">{preset.description}</p>
                        </div>
                        <PresetSwatches accent={preset.palette.accent500} palette={preset.palette} />
                      </div>
                    </button>
                  )
                })}
            </div>

            <div className="mt-4 border-t border-ink-800 pt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="sans text-sm text-fog-100">強調色</p>
                  <p className="text-[11px] text-fog-500">本地保存；不影響其他人看到的樣式。</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="color"
                    value={themeState.customAccent ?? activePreset.palette.accent500}
                    onChange={(e) => setThemeState((current) => ({ ...current, customAccent: e.target.value }))}
                    className="w-11 h-11 rounded-lg border border-ink-700 bg-transparent p-1"
                  />
                  <span className="mono text-[11px] text-fog-500">
                    {(themeState.customAccent ?? activePreset.palette.accent500).toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setThemeState((current) => ({ ...current, customAccent: undefined }))}
                  className="px-3 py-2 rounded-full border border-ink-700 text-xs text-fog-300 hover:text-fog-100 min-h-[40px]"
                >
                  跟隨預設
                </button>
                <button
                  type="button"
                  onClick={() => setThemeState(defaultThemeState)}
                  className="px-3 py-2 rounded-full border border-ink-700 text-xs text-fog-300 hover:text-fog-100 min-h-[40px]"
                >
                  恢復默認
                </button>
              </div>
            </div>
          </section>
        )}

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-2xl border border-ink-700 bg-ink-900/92 backdrop-blur px-3.5 py-2.5 text-sm text-fog-200 hover:border-accent-500 min-h-[44px] shadow-[0_10px_30px_rgba(0,0,0,0.28)]"
        >
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: themeState.customAccent ?? activePreset.palette.accent500 }} />
          <span className="mono text-xs uppercase tracking-[0.18em]">色系</span>
        </button>
      </div>
    </div>
  )
}
