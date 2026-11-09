import { useLocale } from '../i18n/react'

export interface CycleOption<T extends string | number> { value: T; label: string }

/**
 * 單鍵循環切換（2026-11-08 批 G9，站長「能合併點擊切換的都設置合併點擊切換」）：顯示目前值，點一下換下一個，
 * 最後一個之後回到第一個。aria-label 說出目前值與點擊後的值；只用於互斥、選項少、有自然順序的單選。
 * 樣式與頁頭的色系、語言按鈕同一套（方角 2px、1px 邊框、高 44px）。
 */
export function CycleButton<T extends string | number>({ name, value, options, onChange, data, prefix }: {
  name: string
  value: T
  options: readonly CycleOption<T>[]
  onChange: (next: T) => void
  /** 測試與驗收用：data-cycle 寫控制項名稱，data-cycle-value 寫目前值。 */
  data: string
  /** 按鈕內、目前值之前的固定字（例：「每科取前」）。 */
  prefix?: string
}) {
  const { t } = useLocale()
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  const current = options[index]
  const next = options[(index + 1) % options.length]
  const aria = t('ui.cycle.aria', { name, current: current.label, next: next.label })
  return (
    <button
      type="button"
      onClick={() => onChange(next.value)}
      aria-label={aria}
      title={aria}
      data-cycle={data}
      data-cycle-value={String(current.value)}
      className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-ctl border border-ink-700 bg-ink-900 text-sm text-fog-100 hover:border-accent-500"
    >
      {prefix && <span className="text-fog-500">{prefix}</span>}
      <span className="font-semibold">{current.label}</span>
      <span aria-hidden="true" className="text-xs text-fog-500">⇄</span>
    </button>
  )
}
