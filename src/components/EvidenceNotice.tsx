import { DIMENSION_GROUPS } from '../data/dimensions'
import { useLocale } from '../i18n/react'
import { dimensionLabel } from '../lib/i18nLabels'

/**
 * 匿名生活回報暫不參與整校排除的說明。
 * collapseOnMobile（2026-11-08 批 G4，問卷頁）：手機（<640px）收成一行可展開的摘要，避免在頁頭下方先佔一大塊；桌面維持完整說明。
 */
export function EvidenceNotice({ collapseOnMobile = false }: { collapseOnMobile?: boolean }) {
  const { t } = useLocale()
  const dimensions = <p className="mt-2">{DIMENSION_GROUPS.B.map((id) => dimensionLabel(id)).join(t('ui.common.listJoiner'))}。</p>
  const full = (
    <aside className="rounded-lg border border-amber-500/20 bg-ink-900 px-4 py-3 text-xs text-fog-300 leading-relaxed">
      <p className="text-fog-100 font-medium">{t('ui.evidence.title')}</p>
      <p className="mt-1">{t('ui.evidence.note')}</p>
      <details className="mt-2">
        <summary className="cursor-pointer text-accent-500 py-2.5">{t('ui.evidence.details')}</summary>
        {dimensions}
        <p className="mt-1">{t('ui.evidence.detailsNote')}</p>
      </details>
    </aside>
  )
  if (!collapseOnMobile) return full
  return (
    <>
      <details className="group sm:hidden rounded-lg border border-amber-500/20 bg-ink-900 px-4 text-xs text-fog-300 leading-relaxed" data-evidence-notice="compact">
        <summary className="cursor-pointer py-3 text-fog-100 font-medium truncate group-open:whitespace-normal">{t('ui.evidence.title')}</summary>
        <div className="pb-3">
          <p>{t('ui.evidence.note')}</p>
          {dimensions}
          <p className="mt-1">{t('ui.evidence.detailsNote')}</p>
        </div>
      </details>
      <div className="max-sm:hidden">{full}</div>
    </>
  )
}
