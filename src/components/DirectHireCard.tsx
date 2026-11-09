import type { AtlasProgram } from '../data/worldAtlasTypes'
import { useLocale } from '../i18n/react'
import { TierBadge } from './TierBadge'

/** 企業直招條目卡（原在 WorldAtlasPage；2026-11-08 批 G7 抽出，全球學科地圖、`#/global` 與大陸結果頁的「非大學路徑」共用）。 */
export function DirectHireCard({ program, expanded, onOpen, onClose }: { program: AtlasProgram; expanded: boolean; onOpen?: () => void; onClose: () => void }) {
  const { t, tOr, locale } = useLocale()
  const en = locale === 'en'
  const paid = program.paid === 'yes' ? t('ui.world.program.paid.yes') : program.paid === 'stipend' ? t('ui.world.program.paid.stipend') : program.paid === 'no' ? t('ui.world.program.paid.no') : t('ui.world.program.unverified')
  const degree = program.degree === 'yes' ? t('ui.world.program.degree.yes') : program.degree === 'partial' ? t('ui.world.program.degree.partial') : program.degree === 'no' ? t('ui.world.program.degree.no') : t('ui.world.program.unverified')
  // 含在職學位（degree=yes）與混合入口（degree=partial）沿用既有 Dyson／Goldman Sachs／Siemens／Shopify 口徑一併列入，並明示標籤。
  const degreeBadge = program.degree === 'yes' ? t('ui.world.program.degreeBadge') : program.degree === 'partial' ? t('ui.world.program.degreeBadge.partial') : null
  const country = tOr(`ui.world.program.country.${program.regionKey}`, en ? program.country : program.regionZh)
  const kind = tOr(`ui.world.program.kind.${program.kind}`, en ? program.kind : program.kindZh)
  return (
    <article className={['rounded-panel border px-4 py-3 flex flex-col gap-2 h-full', expanded ? 'border-accent-500/40 bg-ink-900' : 'border-ink-800 bg-ink-900'].join(' ')} data-program={program.id} data-degree={program.degree}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mono text-xs uppercase tracking-[0.2em] text-fog-500">{`${country} · ${en ? program.city : program.cityZh} · ${kind}`}</p>
          <h3 className="serif text-lg text-fog-100 mt-1">{en ? `${program.orgEn}: ${program.programEn}` : `${program.orgZh}：${program.programZh}`}</h3>
          <p className="text-xs text-fog-500">{en ? `${program.orgZh} · ${program.programZh}` : `${program.orgEn} · ${program.programEn}`}</p>
          {degreeBadge && <p className="mt-1"><span className="inline-block rounded-ctl border border-accent-500/40 bg-accent-500/10 px-2 py-px text-xs mono text-accent-600" data-degree-badge={program.degree}>{degreeBadge}</span></p>}
        </div>
        {expanded
          ? <button onClick={onClose} className="text-xs mono uppercase tracking-[0.2em] text-fog-500 hover:text-accent-500 min-h-[44px] px-2">{t('ui.common.close')}</button>
          : onOpen && <button onClick={onOpen} className="text-xs mono uppercase tracking-[0.2em] text-fog-500 hover:text-accent-500 min-h-[44px] px-2">{t('ui.world.program.expand')}</button>}
      </div>
      <p className="text-sm text-fog-300 leading-relaxed"><b className="text-fog-100">{t('ui.world.program.eligibility')}</b>{program.eligibilityZh}</p>
      {expanded && (
        <>
          <p className="text-sm text-fog-300 leading-relaxed"><b className="text-fog-100">{t('ui.world.program.offers')}</b>{program.offersZh}</p>
          <p className="text-xs text-fog-500 leading-relaxed">
            {t('ui.world.program.paid')}{paid} ·{' '}
            {t('ui.world.program.degree')}{degree} ·
            {program.sinceYear ? t('ui.world.program.since', { year: program.sinceYear }) : ''} {t('ui.world.program.status', { status: program.status })}
          </p>
          {program.notesZh && <p className="text-xs text-fog-500 leading-relaxed">{program.notesZh}</p>}
        </>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mono text-fog-500 mt-auto pt-1">
        {program.officialUrl && <span className="inline-flex items-center gap-1"><a className="tap underline hover:text-accent-500" href={program.officialUrl} target="_blank" rel="noreferrer noopener">{t('ui.world.program.officialPage')}</a><TierBadge url={program.officialUrl} /></span>}
        <span className="inline-flex items-center gap-1"><a className="tap underline hover:text-accent-500" href={program.sourceUrl} target="_blank" rel="noreferrer noopener">{t('ui.world.program.source')}</a><TierBadge url={program.sourceUrl} /></span>
        <span>{t('ui.world.program.verified', { verifiedAt: program.verifiedAt, confidence: t(`ui.world.confidence.${program.confidence}`) })}</span>
      </div>
    </article>
  )
}
