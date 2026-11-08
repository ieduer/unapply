import { DIMENSION_GROUPS } from '../data/dimensions'
import { useLocale } from '../i18n/react'
import { dimensionLabel } from '../lib/i18nLabels'

export function EvidenceNotice() {
  const { t } = useLocale()
  return (
    <aside className="rounded-lg border border-amber-500/20 bg-ink-900 px-4 py-3 text-xs text-fog-300 leading-relaxed">
      <p className="text-fog-100 font-medium">{t('ui.evidence.title')}</p>
      <p className="mt-1">{t('ui.evidence.note')}</p>
      <details className="mt-2">
        <summary className="cursor-pointer text-accent-500 py-2.5">{t('ui.evidence.details')}</summary>
        <p className="mt-2">{DIMENSION_GROUPS.B.map((id) => dimensionLabel(id)).join(t('ui.common.listJoiner'))}。</p>
        <p className="mt-1">{t('ui.evidence.detailsNote')}</p>
      </details>
    </aside>
  )
}
