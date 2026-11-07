import { EvidenceNotice } from './EvidenceNotice'
import { LocaleSwitcher } from './LocaleSwitcher'
import {
  officialSchoolCount,
  officialUndergraduateCount,
  officialVocationalCount,
} from '../data/schoolCatalogSummary'
import { contributionHighlights, researchSummary } from '../data/researchSummary'
import { getOriginOption, originOptions, type OriginRegion } from '../data/origins'
import { useLocale } from '../i18n/react'
import { Rich } from '../i18n/rich'

interface Props {
  origin: OriginRegion | null
  onOriginChange: (origin: OriginRegion) => void
  onStart: () => void
  onWorld: () => void
  onHkMoTw: () => void
  onOverseas: () => void
  onAbout: () => void
  onContribute: () => void
}

export function Landing({ origin, onOriginChange, onStart, onWorld, onHkMoTw, onOverseas, onAbout, onContribute }: Props) {
  const { t, tOr, n } = useLocale()
  const originOption = origin ? getOriginOption(origin) : null
  const isHkMoTw = origin === 'hk' || origin === 'mo' || origin === 'tw'
  const isOverseas = origin === 'overseas'
  const routeKey = isHkMoTw ? 'ui.landing.noPool.route.hkmotw' : isOverseas ? 'ui.landing.noPool.route.overseas' : 'ui.landing.noPool.route.other'
  return (
    <main className="min-h-screen app-canvas text-fog-100 flex flex-col items-center justify-between px-5 sm:px-6 py-6 sm:py-10">
      <div
        className="w-full max-w-5xl flex items-center justify-between gap-3 text-xs mono uppercase tracking-[0.2em] sm:tracking-[0.25em] text-fog-500"
      >
        <span>{t('ui.landing.brand')}</span>
        <div className="flex items-center gap-2 sm:gap-3">
          <LocaleSwitcher />
          <button
            onClick={onAbout}
            className="hover:text-accent-500 transition-colors min-h-[44px] -my-3 py-3 px-2"
          >
            {t('ui.common.about')}
          </button>
        </div>
      </div>

      <section className="w-full max-w-5xl flex flex-1 flex-col justify-center gap-8 sm:gap-12 py-10 sm:py-16">
        <div
          className="max-w-3xl"
        >
          <p className="mono text-xs uppercase tracking-[0.28em] text-accent-500">{t('ui.landing.kicker')}</p>
          <h1 className="mt-5 serif text-5xl sm:text-7xl leading-none text-fog-100">
            {t('ui.landing.title')}
          </h1>
          <p className="mt-6 max-w-2xl text-base sm:text-lg text-fog-300 leading-relaxed">
            {t('ui.landing.lede')}
          </p>
          <p className="mt-4 mono text-sm text-fog-500">
            {t('ui.landing.counts', { total: n(officialSchoolCount), undergrad: n(officialUndergraduateCount), vocational: n(officialVocationalCount) })}
          </p>
        </div>

        <div className="border border-ink-800 bg-ink-900/78 p-5 sm:p-6 flex flex-col gap-4 backdrop-blur-xl">
          <div className="flex flex-col gap-2">
            <p className="mono text-xs uppercase tracking-[0.24em] text-fog-500">{t('ui.landing.originKicker')}</p>
            <h2 className="serif text-2xl">{t('ui.landing.originTitle')}</h2>
            <p className="text-sm text-fog-400 leading-relaxed">
              {t('ui.landing.originLede')}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-5" role="group" aria-label={t('ui.landing.originGroupAria')}>
            {originOptions.map((option) => {
              const active = option.id === origin
              return (
                <button
                  key={option.id}
                  onClick={() => onOriginChange(option.id)}
                  aria-pressed={active}
                  className={[
                    'text-left rounded-xl border px-3 py-3 min-h-[56px] flex flex-col gap-1',
                    active
                      ? 'border-accent-500 bg-accent-500/10 text-fog-100'
                      : 'border-ink-700 bg-ink-950 text-fog-300 hover:border-fog-500 hover:text-fog-100',
                  ].join(' ')}
                >
                  <span className="serif text-base leading-snug">{t(`origin.${option.id}.label`)}</span>
                  <span className="text-xs text-fog-500 leading-snug">{option.hasLocalPool ? t('ui.landing.poolReady') : t('ui.landing.poolBuilding')}</span>
                </button>
              )
            })}
          </div>

          {!originOption && (
            <p className="text-sm text-fog-500">{t('ui.landing.pickOriginHint')}</p>
          )}
          {originOption && !originOption.hasLocalPool && (
            <p className="text-sm text-fog-300 leading-relaxed">
              <Rich k="ui.landing.noPool" params={{ origin: t(`origin.${originOption.id}.label`), hint: t(`origin.${originOption.id}.hint`), route: t(routeKey) }} />
            </p>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            {originOption?.hasLocalPool !== false ? (
              <>
                <button
                  onClick={onStart}
                  disabled={!originOption}
                  className={[
                    'px-7 py-4 sm:py-3 rounded-xl font-semibold text-base transition-colors min-h-[52px]',
                    originOption ? 'bg-accent-500 text-ink-950 hover:bg-accent-400' : 'bg-ink-800 text-fog-500 cursor-not-allowed',
                  ].join(' ')}
                >
                  {t('ui.landing.start')}
                </button>
                <button
                  onClick={onWorld}
                  className="px-6 py-4 sm:py-3 rounded-xl border border-ink-700 text-base text-fog-100 hover:border-accent-500 min-h-[52px]"
                >
                  {t('ui.landing.world')}
                </button>
              </>
            ) : isHkMoTw ? (
              <>
                <button
                  onClick={onHkMoTw}
                  className="px-7 py-4 sm:py-3 bg-accent-500 text-ink-950 rounded-xl font-semibold text-base hover:bg-accent-400 transition-colors min-h-[52px]"
                >
                  {t('ui.landing.hkmotw')}
                </button>
                <button
                  onClick={onWorld}
                  className="px-6 py-4 sm:py-3 rounded-xl border border-ink-700 text-base text-fog-100 hover:border-accent-500 min-h-[52px]"
                >
                  {t('ui.landing.world')}
                </button>
                <button
                  onClick={onStart}
                  className="px-6 py-4 sm:py-3 rounded-xl border border-ink-700 text-base text-fog-100 hover:border-accent-500 min-h-[52px]"
                >
                  {t('ui.landing.enterMainland')}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onOverseas}
                  className="px-7 py-4 sm:py-3 bg-accent-500 text-ink-950 rounded-xl font-semibold text-base hover:bg-accent-400 transition-colors min-h-[52px]"
                >
                  {t('ui.landing.overseas')}
                </button>
                <button
                  onClick={onWorld}
                  className="px-6 py-4 sm:py-3 rounded-xl border border-ink-700 text-base text-fog-100 hover:border-accent-500 min-h-[52px]"
                >
                  {t('ui.landing.world')}
                </button>
                <button
                  onClick={onStart}
                  className="px-6 py-4 sm:py-3 rounded-xl border border-ink-700 text-base text-fog-100 hover:border-accent-500 min-h-[52px]"
                >
                  {t('ui.landing.enterMainland')}
                </button>
              </>
            )}
            <span className="text-xs mono text-fog-500">{t('ui.landing.dynamicNote')}</span>
          </div>
        </div>

        <EvidenceNotice />

        <div className="grid border-y border-ink-800 bg-ink-900/70 backdrop-blur-xl sm:grid-cols-3">
          <MetricCard
            label={t('ui.landing.metric.crowdSchools.label')}
            value={n(researchSummary.crowdMatchedSchools)}
            detail={t('ui.landing.metric.crowdSchools.detail')}
          />
          <MetricCard
            label={t('ui.landing.metric.crowdValues.label')}
            value={n(researchSummary.crowdValuesAccepted)}
            detail={t('ui.landing.metric.crowdValues.detail')}
          />
          <MetricCard
            label={t('ui.landing.metric.portals.label')}
            value={n(researchSummary.provincePortals)}
            detail={t('ui.landing.metric.portals.detail')}
          />
        </div>

        <div className="border border-ink-800 bg-ink-900/78 p-5 sm:p-6 flex flex-col gap-4 backdrop-blur-xl">
          <div className="flex flex-col gap-2">
            <p className="mono text-xs uppercase tracking-[0.24em] text-fog-500">{t('ui.landing.contribKicker')}</p>
            <h2 className="serif text-2xl">{t('ui.landing.contribTitle')}</h2>
            <p className="text-sm text-fog-400 leading-relaxed">
              {t('ui.landing.contribLede')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {contributionHighlights.map((item, index) => (
              <span key={item} className="rounded-full border border-ink-700 bg-ink-950 px-3 py-1 text-xs text-fog-300">
                {tOr(`ui.landing.contribHighlight.${index + 1}`, item)}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onContribute}
              className="px-5 py-3 rounded-xl border border-accent-500/40 bg-accent-500/10 text-accent-600 text-sm hover:bg-accent-500/15 min-h-[48px]"
            >
              {t('ui.landing.contribCta')}
            </button>
            <a
              className="text-xs mono text-fog-500 hover:text-accent-500"
              href="https://github.com/ieduer/unapply/issues?q=is%3Aissue+label%3Adata-contribution"
              target="_blank"
              rel="noreferrer noopener"
            >
              {t('ui.landing.contribReview')}
            </a>
          </div>
        </div>
      </section>

      <footer className="w-full max-w-5xl pt-6 border-t border-ink-800">
        <div className="grid gap-3 sm:gap-2">
          <FooterGroup
            label={t('ui.landing.footer.sisterSites')}
            items={[
              { href: 'https://path.bdfz.net', text: t('ui.landing.footer.path') },
              { href: 'https://gk.rdfzer.com/#advice-top', text: t('ui.landing.footer.gk') },
              { href: 'https://my.bdfz.net', text: t('ui.landing.footer.my') },
            ]}
          />
          <FooterGroup
            label={t('ui.landing.footer.authoritative')}
            items={[
              { href: 'https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/202606/t20260618_1441074.html', text: t('ui.landing.footer.moe') },
              { href: 'https://www.cma.gov.cn/', text: t('ui.landing.footer.cma') },
              { href: 'https://www.yicai.com/topic/100311963/', text: t('ui.landing.footer.yicai') },
              { href: 'https://www.chinadegrees.cn/xwyyjsjyxx/xkpgjg/', text: t('ui.landing.footer.disciplineEval') },
              { href: 'https://www.shanghairanking.com/rankings/gras/2026', text: t('ui.landing.footer.gras') },
            ]}
          />
          <FooterGroup
            label={t('ui.landing.footer.openSource')}
            items={[
              { href: 'https://github.com/ieduer/unapply', text: 'ieduer/unapply' },
              { href: 'https://github.com/CollegesChat/university-information', text: 'CollegesChat' },
            ]}
          />
        </div>
        <div className="mt-3 px-1 text-xs mono text-fog-500 leading-relaxed">
          {t('ui.landing.footer.licence')}
        </div>
      </footer>
    </main>
  )
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border-b border-ink-800 p-4 flex flex-col gap-2 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="mono text-xs uppercase tracking-[0.22em] text-fog-500">{label}</p>
      <p className="serif text-3xl text-fog-100">{value}</p>
      <p className="text-xs text-fog-500 leading-relaxed">{detail}</p>
    </div>
  )
}

function FooterGroup({
  label,
  items,
}: {
  label: string
  items: { href: string; text: string }[]
}) {
  return (
    <section className="border border-ink-800 sm:border-0 bg-ink-900/65 sm:bg-transparent px-4 py-3 sm:px-0 sm:py-0">
      <p className="mono text-xs uppercase tracking-[0.18em] text-fog-300">{label}</p>
      <div className="mt-2 flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-x-3 sm:gap-y-1 text-xs mono text-fog-500 leading-relaxed">
        {items.map((item) => (
          <a
            key={item.href}
            className="hover:text-accent-500 break-all"
            href={item.href}
            target="_blank"
            rel="noreferrer noopener"
          >
            {item.text}
          </a>
        ))}
      </div>
    </section>
  )
}
