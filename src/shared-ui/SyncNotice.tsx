/**
 * 三個階段標籤（可選）。不傳就用預設值——就是原本寫死的字串，逐字不變；
 * 姊妹站 path.bdfz.net 不傳，nope.bdfz.net 傳入三語翻譯（2026-11-08 批 G3）。
 */
export interface SyncNoticeLabels {
  verified: string
  error: string
  syncing: string
}

const defaultLabels: SyncNoticeLabels = { verified: '已核验', error: '核验未完成', syncing: '同步核验中' }

interface Props {
  /** 'idle' 不顯示；'verified'、'error' 各有固定配色；其餘視為同步中。 */
  phase: string
  message: string
  labels?: Partial<SyncNoticeLabels>
}

/**
 * 學習記錄同步狀態提示，兩個姊妹站共用。
 * 說明文字不降低透明度：提示條裡的每個字在兩套色系下都要看得清。
 */
export function SyncNotice({ phase, message, labels }: Props) {
  if (phase === 'idle') return null
  const tone =
    phase === 'verified'
      ? 'border-emerald-300/40 bg-emerald-950 text-emerald-50'
      : phase === 'error'
        ? 'border-rose-300/40 bg-rose-950 text-rose-50'
        : 'border-accent-500 bg-ink-900 text-fog-100'
  const text: SyncNoticeLabels = { ...defaultLabels, ...labels }
  const label = phase === 'verified' ? text.verified : phase === 'error' ? text.error : text.syncing

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
