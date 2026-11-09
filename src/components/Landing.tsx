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
import { atlasThumb } from '../data/atlasThumb'

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
    <main className="flex-1 text-fog-100 px-4 sm:px-6 pt-4 sm:pt-8 pb-10">

      <section className="w-full max-w-5xl mx-auto flex flex-col gap-6 sm:gap-8">
        {/* 2026-11-08 批 G9：收緊頁頭下的留白（不再垂直置中、去掉大 padding）；桌面兩欄——左大標與校數、右「全球學科地圖」特色卡；手機特色卡在起點題之前 */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:items-start lg:gap-8">
          <div className="max-w-3xl">
            <h1 className="serif text-4xl sm:text-6xl lg:text-7xl leading-none text-fog-100">
              {t('ui.landing.title')}
            </h1>
            <p className="mt-4 mono text-sm text-fog-500">
              {t('ui.landing.counts', { total: n(officialSchoolCount), undergrad: n(officialUndergraduateCount), vocational: n(officialVocationalCount) })}
            </p>
          </div>
          <WorldMapFeature onWorld={onWorld} />
        </div>

        <div className="border border-ink-800 bg-ink-900/78 rounded-panel p-5 sm:p-6 flex flex-col gap-4 backdrop-blur-xl" data-landing-origin>
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
                    'text-left rounded-ctl border px-3 py-3 min-h-[52px] flex items-center',
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
                  'px-7 py-4 sm:py-3 rounded-ctl font-semibold text-base transition-colors min-h-[52px]',
                  plan ? 'bg-accent-500 text-ink-950 hover:bg-accent-400' : 'bg-ink-800 text-fog-500 cursor-not-allowed',
                ].join(' ')}
              >
                {t('ui.landing.start')}
              </button>
              <p className="text-sm text-fog-300 leading-relaxed" data-landing-plan aria-live="polite">{plan ? planLine : t('ui.landing.plan.pickOrigin')}</p>
            </div>
          </div>
        </div>

        {/* 批 G9：其餘三個入口改為一排方角連結磚（手機一欄、桌面三欄）；原「只瀏覽：」那行刪除 */}
        <nav aria-label={t('ui.landing.tiles.aria')} className="grid gap-px sm:grid-cols-3 border border-ink-800 bg-ink-800 rounded-panel overflow-hidden" data-landing-tiles>
          {([['search', onSearch], ['hkmotw', onHkMoTw], ['overseas', onOverseas]] as const).map(([key, onClick]) => (
            <button key={key} type="button" onClick={onClick} data-landing-tile={key} {...(key === 'search' ? { 'data-landing-search': '' } : {})}
              className="text-left bg-ink-900 hover:bg-ink-950 px-4 py-4 min-h-[76px] flex flex-col gap-1">
              <span className="serif text-lg text-fog-100">{t(`ui.landing.tile.${key}.title`)} <span aria-hidden="true" className="text-accent-500">→</span></span>
              <span className="text-xs text-fog-500 leading-relaxed">{t(`ui.landing.tile.${key}.desc`)}</span>
            </button>
          ))}
        </nav>

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

        <div className="border border-ink-800 bg-ink-900/78 rounded-panel p-5 sm:p-6 flex flex-col gap-4 backdrop-blur-xl">
          <div className="flex flex-col gap-2">
            <h2 className="serif text-2xl">{t('ui.landing.contribTitle')}</h2>
            <p className="text-sm text-fog-400 leading-relaxed">{t('ui.landing.contribLede')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onContribute}
              className="px-5 py-3 rounded-ctl border border-accent-500/40 bg-accent-500/10 text-accent-600 text-sm hover:bg-accent-500/15 min-h-[48px]"
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

/**
 * 首頁「全球學科地圖」特色卡（批 G9）：建置期由 atlas 生成的靜態縮圖（陸地輪廓＋機構點，scripts/build_atlas_thumb.mjs），
 * 用色系變數著色；只有一個主按鈕進地圖。手機高度控制在一屏的三分之一內。
 */
function WorldMapFeature({ onWorld }: { onWorld: () => void }) {
  const { t, n } = useLocale()
  const dots = atlasThumb.dots.split(' ').map((p) => p.split(',').map(Number))
  const dotPath = dots.map(([x, y]) => `M${x - 2.6} ${y}a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0`).join('')
  return (
    <section className="border border-ink-800 bg-ink-900/78 rounded-panel p-4 sm:p-5 flex flex-col gap-2 sm:gap-3 backdrop-blur-xl" data-landing-world>
      <div className="flex items-center justify-between gap-3">
        <h2 className="serif text-lg sm:text-2xl text-fog-100 min-w-0">{t('ui.landing.world.title')}</h2>
        <button type="button" onClick={onWorld} data-landing-world-go className="shrink-0 inline-flex items-center gap-2 min-h-[44px] px-4 rounded-ctl bg-accent-500 text-ink-950 text-sm font-semibold hover:bg-accent-400">
          {t('ui.landing.world.go')} <span aria-hidden="true">→</span>
        </button>
      </div>
      <p className="text-sm text-fog-300 leading-snug">{t('ui.landing.world.lede', { subjects: n(atlasThumb.subjects) })} <span className="hidden sm:inline mono text-xs text-fog-500 whitespace-nowrap">{t('ui.landing.world.meta', { institutions: n(atlasThumb.institutions) })}</span></p>
      <svg viewBox={`0 0 ${atlasThumb.width} ${atlasThumb.height}`} preserveAspectRatio="xMidYMid meet" className="w-full h-auto max-h-[16vh] sm:max-h-[18vh] lg:max-h-none border border-ink-800 rounded-panel bg-ink-950" role="img" aria-label={t('ui.landing.world.mapAria')} data-landing-world-map>
        <path d={atlasThumb.land} className="atlas-land" />
        <path d={dotPath} className="atlas-dot" />
      </svg>
    </section>
  )
}
