import type { ReactNode } from 'react'
import { SiteHeader } from './SiteHeader'
import {
  officialSchoolCount,
  officialUndergraduateCount,
  officialVocationalCount,
} from '../data/schoolCatalogSummary'
import { researchSummary } from '../data/researchSummary'
import { getOriginOption, originOptions, type OriginRegion } from '../data/origins'
import type { OriginPrefs } from '../data/originBranch'
import { OriginBranch } from './OriginBranch'
import { useLocale } from '../i18n/react'

interface Props {
  origin: OriginRegion | null
  originPrefs: OriginPrefs
  onOriginChange: (origin: OriginRegion) => void
  onOriginPrefsChange: (prefs: OriginPrefs) => void
  onStart: () => void
  onWorld: () => void
  onHkMoTw: () => void
  onOverseas: () => void
  onGlobal: () => void
  onAbout: () => void
  onContribute: () => void
}

export function Landing({ origin, originPrefs, onOriginChange, onOriginPrefsChange, onStart, onWorld, onHkMoTw, onOverseas, onGlobal, onAbout, onContribute }: Props) {
  const { t, n } = useLocale()
  const originOption = origin ? getOriginOption(origin) : null
  const isHkMoTw = origin === 'hk' || origin === 'mo' || origin === 'tw'
  return (
    <div className="min-h-screen app-canvas text-fog-100 flex flex-col">
    <SiteHeader brand={t('ui.landing.brand')} actions={[{ label: t('ui.common.about'), onClick: onAbout }]} />
    <main className="flex-1 text-fog-100 flex flex-col items-center justify-between px-5 sm:px-6 py-6 sm:py-10 page-end-space">

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
          <h2 className="serif text-2xl">{t('ui.landing.originTitle')}</h2>
          <div className="grid gap-2 sm:grid-cols-5" role="group" aria-label={t('ui.landing.originGroupAria')}>
            {originOptions.map((option) => {
              const active = option.id === origin
              return (
                <button
                  key={option.id}
                  onClick={() => onOriginChange(option.id)}
                  aria-pressed={active}
                  className={[
                    'text-left rounded-xl border px-3 py-3 min-h-[52px] flex items-center',
                    active
                      ? 'border-accent-500 bg-accent-500/10 text-fog-100'
                      : 'border-ink-700 bg-ink-950 text-fog-300 hover:border-fog-500 hover:text-fog-100',
                  ].join(' ')}
                >
                  <span className="serif text-base leading-snug">{t(`origin.${option.id}.label`)}</span>
                </button>
              )
            })}
          </div>

          {origin && <OriginBranch origin={origin} prefs={originPrefs} onChange={onOriginPrefsChange} />}

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
                {/* 2026-11-08 批 G2：港澳臺／海外起點在資格與範圍之後先走全球減法（展示層，不進 AnswerMap）；直接看池的入口保留為次按鈕 */}
                <button
                  onClick={onGlobal}
                  data-landing-global
                  className="px-7 py-4 sm:py-3 bg-accent-500 text-ink-950 rounded-xl font-semibold text-base hover:bg-accent-400 transition-colors min-h-[52px]"
                >
                  {t('ui.landing.global')}
                </button>
                <button
                  onClick={onHkMoTw}
                  className="px-6 py-4 sm:py-3 rounded-xl border border-ink-700 text-base text-fog-100 hover:border-accent-500 min-h-[52px]"
                >
                  {t('ui.landing.hkmotwDirect')}
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
                {/* 2026-11-08 批 G2：港澳臺／海外起點在資格與範圍之後先走全球減法（展示層，不進 AnswerMap）；直接看池的入口保留為次按鈕 */}
                <button
                  onClick={onGlobal}
                  data-landing-global
                  className="px-7 py-4 sm:py-3 bg-accent-500 text-ink-950 rounded-xl font-semibold text-base hover:bg-accent-400 transition-colors min-h-[52px]"
                >
                  {t('ui.landing.global')}
                </button>
                <button
                  onClick={onOverseas}
                  className="px-6 py-4 sm:py-3 rounded-xl border border-ink-700 text-base text-fog-100 hover:border-accent-500 min-h-[52px]"
                >
                  {t('ui.landing.overseasDirect')}
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

      {/* 2026-11-08 批 G5（站長指示，取代 G1 的頁尾分組）：三行精簡頁尾；分級標籤只在 About */}
      <footer className="w-full max-w-5xl pt-4 border-t border-ink-800 text-xs mono text-fog-500 leading-relaxed flex flex-col" data-landing-footer>
        <p className="flex flex-wrap items-center gap-x-2" data-footer-line="sisters">
          <span className="text-fog-300">{t('ui.landing.footer.sisters')}</span>
          <FooterLink href="https://path.bdfz.net" title={t('ui.landing.footer.path')}>path</FooterLink>
          <Dot />
          <FooterLink href="https://gk.rdfzer.com/#advice-top" title={t('ui.landing.footer.gk')}>gk</FooterLink>
          <Dot />
          <FooterLink href="https://my.bdfz.net" title={t('ui.landing.footer.my')}>my</FooterLink>
        </p>
        <p className="flex flex-wrap items-center gap-x-2" data-footer-line="sources">
          <span className="text-fog-300">{t('ui.landing.footer.sources')}</span>
          <FooterLink href="https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/202606/t20260618_1441074.html" title={t('ui.landing.footer.moe.title')}>{t('ui.landing.footer.moe')}</FooterLink>
          <Dot />
          <FooterLink href="https://www.cma.gov.cn/" title={t('ui.landing.footer.cma.title')}>{t('ui.landing.footer.cma')}</FooterLink>
          <Dot />
          <FooterLink href="https://www.chinadegrees.cn/xwyyjsjyxx/xkpgjg/" title={t('ui.landing.footer.disciplineEval.title')}>{t('ui.landing.footer.disciplineEval')}</FooterLink>
          <Dot />
          <FooterLink href="https://www.shanghairanking.com/rankings/gras/2026" title={t('ui.landing.footer.gras.title')}>{t('ui.landing.footer.gras')}</FooterLink>
          <Dot />
          <FooterLink href="https://www.yicai.com/topic/" title={t('ui.landing.footer.yicai.title')}>{t('ui.landing.footer.yicai')}</FooterLink>
          <Dot />
          <span className="text-fog-300">{t('ui.landing.footer.openSource')}</span>
          <FooterLink href="https://github.com/ieduer/unapply" title={t('ui.landing.footer.unapply.title')}>ieduer/unapply</FooterLink>
          <Dot />
          <FooterLink href="https://github.com/CollegesChat/university-information" title={t('ui.landing.footer.collegeschat.title')}>CollegesChat</FooterLink>
        </p>
        <p className="py-2.5" data-footer-line="licence">{t('ui.landing.footer.licence')}</p>
      </footer>
    </main>
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

function FooterLink({ href, title, children }: { href: string; title: string; children: ReactNode }) {
  return (
    <a className="inline-flex items-center min-h-[40px] hover:text-accent-500" href={href} title={title} aria-label={title} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  )
}

function Dot() {
  return <span aria-hidden="true">·</span>
}
