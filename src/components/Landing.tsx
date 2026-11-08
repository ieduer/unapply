import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import {
  officialSchoolCount,
  officialUndergraduateCount,
  officialVocationalCount,
} from '../data/schoolCatalogSummary'
import { researchSummary } from '../data/researchSummary'
import { originOptions, type OriginRegion } from '../data/origins'
import type { OriginPrefs } from '../data/originBranch'
import { planFlow } from '../engine/flowPlan'
import { OriginBranch } from './OriginBranch'
import { useLocale } from '../i18n/react'

interface Props {
  origin: OriginRegion | null
  originPrefs: OriginPrefs
  onOriginChange: (origin: OriginRegion) => void
  onOriginPrefsChange: (prefs: OriginPrefs) => void
  /** 「開始減法」：App 依 planFlow 進 #/filter 或 #/global。 */
  onStart: () => void
  onWorld: () => void
  onHkMoTw: () => void
  onOverseas: () => void
  onSearch: () => void
  onContribute: () => void
}

export function Landing({ origin, originPrefs, onOriginChange, onOriginPrefsChange, onStart, onWorld, onHkMoTw, onOverseas, onSearch, onContribute }: Props) {
  const { t, n } = useLocale()
  // 2026-11-08 批 G6：首頁只有一個主按鈕；流程由目的地決定（planFlow），其餘入口縮成一行「只瀏覽」文字鏈接
  const plan = origin ? planFlow(origin, originPrefs.destinations, originPrefs.qualification) : null
  const places = plan ? plan.globalDestinations.map((d) => t(`ui.dest.${d}`)).join(t('ui.common.listJoiner')) : ''
  const planLine = !plan ? '' : plan.stages.length === 2
    ? t('ui.landing.plan.both', { places })
    : plan.entry === 'filter' ? t('ui.landing.plan.mainland') : t('ui.landing.plan.global', { places })
  return (
    <div className="min-h-screen app-canvas text-fog-100 flex flex-col">
    <SiteHeader brand={t('ui.landing.brand')} />
    <main className="flex-1 text-fog-100 flex flex-col items-center justify-between px-5 sm:px-6 py-6 sm:py-10">

      <section className="w-full max-w-5xl flex flex-1 flex-col justify-center gap-8 sm:gap-12 py-10 sm:py-16">
        {/* 2026-11-08 批 G5：首頁只留大標、校數、起點題與按鈕；方法與說明在 About */}
        <div className="max-w-3xl">
          <h1 className="serif text-5xl sm:text-7xl leading-none text-fog-100">
            {t('ui.landing.title')}
          </h1>
          <p className="mt-5 mono text-sm text-fog-500">
            {t('ui.landing.counts', { total: n(officialSchoolCount), undergrad: n(officialUndergraduateCount), vocational: n(officialVocationalCount) })}
          </p>
        </div>

        <div className="border border-ink-800 bg-ink-900/78 p-5 sm:p-6 flex flex-col gap-4 backdrop-blur-xl">
          <h2 className="serif text-2xl" id="landing-origin-title">{t('ui.landing.originTitle')}</h2>
          <div className="grid gap-2 sm:grid-cols-5" role="group" aria-labelledby="landing-origin-title">
            {originOptions.map((option) => {
              const active = option.id === origin
              const label = t(`origin.${option.id}.label`)
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onOriginChange(option.id)}
                  aria-pressed={active}
                  aria-label={label}
                  data-origin-card={option.id}
                  className={[
                    'text-left rounded-xl border px-3 py-3 min-h-[52px] flex items-center',
                    active
                      ? 'border-accent-500 bg-accent-500/10 text-fog-100'
                      : 'border-ink-700 bg-ink-950 text-fog-300 hover:border-fog-500 hover:text-fog-100',
                  ].join(' ')}
                >
                  <span className="serif text-base leading-snug">{label}</span>
                </button>
              )
            })}
          </div>

          {origin && <OriginBranch origin={origin} prefs={originPrefs} onChange={onOriginPrefsChange} />}

          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={onStart}
                disabled={!plan}
                data-landing-start={plan?.entry ?? 'none'}
                className={[
                  'px-7 py-4 sm:py-3 rounded-xl font-semibold text-base transition-colors min-h-[52px]',
                  plan ? 'bg-accent-500 text-ink-950 hover:bg-accent-400' : 'bg-ink-800 text-fog-500 cursor-not-allowed',
                ].join(' ')}
              >
                {t('ui.landing.start')}
              </button>
              <p className="text-sm text-fog-300 leading-relaxed" data-landing-plan aria-live="polite">{plan ? planLine : t('ui.landing.plan.pickOrigin')}</p>
            </div>
            <p className="text-sm text-fog-500 flex flex-wrap items-center gap-x-2" data-landing-browse>
              <span>{t('ui.landing.browse')}</span>
              <button type="button" onClick={onSearch} className="inline-flex items-center min-h-[40px] underline hover:text-accent-500" data-landing-search>{t('ui.landing.browse.search')}</button>
              <span aria-hidden="true">·</span>
              <button type="button" onClick={onWorld} className="inline-flex items-center min-h-[40px] underline hover:text-accent-500">{t('ui.landing.browse.world')}</button>
              <span aria-hidden="true">·</span>
              <button type="button" onClick={onHkMoTw} className="inline-flex items-center min-h-[40px] underline hover:text-accent-500">{t('ui.landing.browse.hkmotw')}</button>
              <span aria-hidden="true">·</span>
              <button type="button" onClick={onOverseas} className="inline-flex items-center min-h-[40px] underline hover:text-accent-500">{t('ui.landing.browse.overseas')}</button>
            </p>
          </div>
        </div>

        <div className="grid border-y border-ink-800 bg-ink-900/70 backdrop-blur-xl sm:grid-cols-3">
          <MetricCard
            label={t('ui.landing.metric.crowdSchools.label')}
            value={n(researchSummary.crowdMatchedSchools)}
          />
          <MetricCard
            label={t('ui.landing.metric.crowdValues.label')}
            value={n(researchSummary.crowdValuesAccepted)}
          />
          <MetricCard
            label={t('ui.landing.metric.portals.label')}
            value={n(researchSummary.provincePortals)}
          />
        </div>

        <div className="border border-ink-800 bg-ink-900/78 p-5 sm:p-6 flex flex-col gap-4 backdrop-blur-xl">
          <div className="flex flex-col gap-2">
            <h2 className="serif text-2xl">{t('ui.landing.contribTitle')}</h2>
            <p className="text-sm text-fog-400 leading-relaxed">{t('ui.landing.contribLede')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onContribute}
              className="px-5 py-3 rounded-xl border border-accent-500/40 bg-accent-500/10 text-accent-600 text-sm hover:bg-accent-500/15 min-h-[48px]"
            >
              {t('ui.landing.contribCta')}
            </button>
            <a
              className="tap text-xs mono text-fog-500 hover:text-accent-500"
              href="https://github.com/ieduer/unapply/issues?q=is%3Aissue+label%3Adata-contribution"
              target="_blank"
              rel="noreferrer noopener"
            >
              {t('ui.landing.contribReview')}
            </a>
          </div>
        </div>
      </section>

    </main>
    <SiteFooter />
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-ink-800 p-4 flex flex-col gap-2 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="mono text-xs uppercase tracking-[0.22em] text-fog-500">{label}</p>
      <p className="serif text-3xl text-fog-100">{value}</p>
    </div>
  )
}
