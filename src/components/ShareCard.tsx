import type { FilterResult } from '../engine/filter'
import { useLocale } from '../i18n/react'
import { Rich } from '../i18n/rich'
import { schoolDisplayName } from '../lib/i18nLabels'

export function ShareCard({ result }: { result: FilterResult }) {
  const { t } = useLocale()
  const { stats, kept } = result
  const top = kept.slice(0, 6)
  return (
    <div
      className="relative rounded-3xl bg-ink-900 border border-ink-800 p-8 overflow-hidden"
      style={{ fontFamily: 'var(--font-serif)' }}
    >
      <div className="flex items-center justify-between text-xs mono uppercase tracking-[0.3em] text-fog-500">
        <span>{t('ui.share.brand')}</span>
        <span>{t('ui.share.title')}</span>
      </div>

      <div className="mt-10 flex flex-col gap-2">
        <p className="text-sm text-fog-500">{t('ui.share.from')}</p>
        <div className="flex items-baseline gap-3">
          <span className="mono text-5xl text-fog-100">{stats.totalInput}</span>
          <span className="text-fog-500">{t('ui.share.schoolsAmong')}</span>
        </div>
        <p className="text-sm text-fog-500 mt-2">{t('ui.share.crossedOut')}</p>
        <div className="flex items-baseline gap-3">
          <span className="mono text-6xl text-accent-500 font-bold">{stats.excludedCount}</span>
          <span className="text-fog-500">{t('ui.share.schools')}</span>
        </div>
        <p className="mt-3 text-base text-fog-300"><Rich k="ui.share.remaining" params={{ kept: <span className="mono">{stats.keptCount}</span> }} /></p>
      </div>

      {top.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-2">
          {top.map((s) => (
            <span
              key={s.id}
              className="text-xs border border-ink-700 px-3 py-1.5 rounded-full text-fog-300"
            >
              {schoolDisplayName(s)}
            </span>
          ))}
          {kept.length > top.length && (
            <span className="text-xs text-fog-500 py-1.5">{t('ui.share.more', { n: kept.length - top.length })}</span>
          )}
        </div>
      )}

      <div className="mt-10 pt-6 border-t border-ink-800 text-xs mono text-fog-500 leading-relaxed">
        <p>{t('ui.share.tagline')}</p>
        <p className="mt-1">nope.bdfz.net · {new Date().toISOString().slice(0, 10)}</p>
      </div>

      <div
        className="absolute top-6 right-6 w-14 h-14 rounded-full bg-accent-500/10 border border-accent-500/30 flex items-center justify-center"
      >
        <div className="w-6 h-[2px] bg-accent-500 rotate-45 absolute" />
        <div className="w-6 h-[2px] bg-accent-500 -rotate-45 absolute" />
      </div>
    </div>
  )
}
