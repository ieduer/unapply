import { displayTier } from '../lib/authorityTier'
import { useLocale } from '../i18n/react'

/** 來源鏈接旁的權威分級標籤（官方／權威平台／第三方）；規則表與啟發式都不認得的網域不標。 */
export function TierBadge({ url, className }: { url?: string | null; className?: string }) {
  const { t } = useLocale()
  const tier = displayTier(url)
  if (!tier) return null
  const label = t(`ui.tier.${tier}`)
  return (
    <span
      data-tier={tier}
      className={['inline-block align-middle rounded border border-ink-700 bg-ink-950 px-1.5 py-px text-xs mono text-fog-300 leading-tight whitespace-nowrap', className ?? ''].join(' ')}
      aria-label={t('ui.tier.aria', { tier: label })}
      title={t('ui.tier.aria', { tier: label })}
    >
      {label}
    </span>
  )
}
