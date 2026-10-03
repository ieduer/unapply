interface Props {
  /** 'idle' 不顯示；'verified'、'error' 各有固定配色；其餘視為同步中。 */
  phase: string
  message: string
}

/**
 * 學習記錄同步狀態提示，兩個姊妹站共用。
 * 說明文字不降低透明度：提示條裡的每個字在兩套色系下都要看得清。
 */
export function SyncNotice({ phase, message }: Props) {
  if (phase === 'idle') return null
  const tone =
    phase === 'verified'
      ? 'border-emerald-300/40 bg-emerald-950 text-emerald-50'
      : phase === 'error'
        ? 'border-rose-300/40 bg-rose-950 text-rose-50'
        : 'border-accent-500 bg-ink-900 text-fog-100'
  const label = phase === 'verified' ? '已核验' : phase === 'error' ? '核验未完成' : '同步核验中'

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-1/2 z-50 w-[min(92vw,34rem)] -translate-x-1/2 rounded-xl border px-4 py-3 text-sm shadow-2xl ${tone}`}
    >
      <span className="font-semibold">{label}</span>
      <span className="ml-2">{message}</span>
    </div>
  )
}
