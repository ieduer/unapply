import type { ReactNode } from 'react'
import {
  adultHigherEducationCount,
  officialSchoolCount,
  officialUndergraduateCount,
  officialVocationalCount,
} from '../data/schoolCatalogSummary'
import { programsManifest } from '../data/programsManifest'
import { overseasManifest } from '../data/overseasManifest'
import { useLocale } from '../i18n/react'
import { Rich, type RichParams } from '../i18n/rich'
import { LocaleSwitcher } from './LocaleSwitcher'
import { TierBadge } from './TierBadge'
import { worldAtlasManifest } from '../data/worldAtlasManifest'
import { authorityTiersSource } from '../data/authorityTiers'
import { linkCheckBaseline } from '../data/linkCheckBaseline'
import { dbManifest } from '../data/dbManifest'

interface Props { onBack: () => void }

const ext = (href: string) => (children: ReactNode) => (
  <span className="inline-flex items-center gap-1 align-baseline">
    <a className="text-accent-500 hover:text-accent-400 mono break-all" href={href} target="_blank" rel="noreferrer noopener">{children}</a>
    <TierBadge url={href} />
  </span>
)
const own = (href: string) => (children: ReactNode) => (
  <a className="text-accent-500 hover:text-accent-400 mono break-all" href={href} target="_blank" rel="noreferrer noopener">{children}</a>
)
const site = (href: string) => (children: ReactNode) => (
  <a className="text-accent-500 hover:text-accent-400" href={href} target="_blank" rel="noreferrer noopener">{children}</a>
)

/** 一條來源／方法條目：模板裡的 <a1> 以 href 包成外部鏈接。 */
function Li({ k, params, href }: { k: string; params?: RichParams; href?: string }) {
  return <li><Rich k={k} params={params} slots={href ? { a1: ext(href) } : undefined} /></li>
}

/** 關於頁：長段落逐段一鍵（ui.about.*），鏈接文字在模板裡、網址在這裡；數字由 manifest 帶入。 */
export function AboutPage({ onBack }: Props) {
  const { t, n } = useLocale()
  const o = overseasManifest.counts
  return (
    <main className="min-h-screen app-canvas text-fog-100">
      <header className="sticky top-0 z-10 backdrop-blur bg-ink-950/80 border-b border-ink-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <button onClick={onBack} className="text-xs mono uppercase tracking-[0.2em] text-fog-500 hover:text-accent-500 min-h-[44px] -my-3 py-3">
            {t('ui.common.back')}
          </button>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <span className="mono text-xs text-fog-500">{t('ui.about.brand')}</span>
          </div>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24 flex flex-col gap-8 sm:gap-10 text-fog-300 leading-relaxed text-sm sm:text-base">
        <div>
          <h1 className="serif text-3xl text-fog-100 mb-4">{t('ui.about.why.title')}</h1>
          <p>{t('ui.about.why.p1', { total: n(officialSchoolCount) })}</p>
          <p className="mt-3">{t('ui.about.why.p2')}</p>
        </div>

        <div>
          <h2 className="serif text-2xl text-fog-100 mb-4">{t('ui.about.dims.title')}</h2>
          <p className="text-sm text-fog-500 mb-4">{t('ui.about.dims.note')}</p>
          <ul className="flex flex-col gap-3 list-disc pl-5">
            <Li k="ui.about.dims.A" />
            <Li k="ui.about.dims.E" />
            <Li k="ui.about.dims.B" />
            <Li k="ui.about.dims.C" />
          </ul>
        </div>

        <div>
          <h2 className="serif text-2xl text-fog-100 mb-4">{t('ui.about.sources.title')}</h2>
          <h3 className="serif text-lg text-fog-100 mt-3 mb-2">{t('ui.about.sources.officialTitle')}</h3>
          <ul className="flex flex-col gap-2 text-sm">
            <Li k="ui.about.sources.moeList" params={{ total: n(officialSchoolCount), undergrad: n(officialUndergraduateCount), vocational: n(officialVocationalCount), adult: n(adultHigherEducationCount) }} href="https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/202606/t20260618_1441074.html" />
            <Li k="ui.about.sources.doubleFirst" href="https://www.moe.gov.cn/srcsite/A22/s7065/202202/t20220211_598710.html" />
            <Li k="ui.about.sources.p985" href="https://www.moe.gov.cn/srcsite/A22/s7065/200612/t20061206_128833.html" />
            <Li k="ui.about.sources.eval" href="https://www.chinadegrees.cn/xwyyjsjyxx/xkpgjg/" />
            <Li k="ui.about.sources.chsi" href="https://gaokao.chsi.com.cn/" />
            <Li k="ui.about.sources.cma" href="https://www.cma.gov.cn/2011xzt/essay/" />
            <Li k="ui.about.sources.mee" href="https://www.mee.gov.cn/hjzl/sthjzk/zghjzkgb/" />
            <Li k="ui.about.sources.camet" href="https://www.camet.org.cn/xytj/tjxx/" />
            <Li k="ui.about.sources.yicai" href="https://www.yicai.com/topic/" />
            <Li k="ui.about.sources.mca" href="https://www.mca.gov.cn/" />
            <Li k="ui.about.sources.langAtlas" href="https://www.cssn.cn/" />
          </ul>
          <h3 className="serif text-lg text-fog-100 mt-4 mb-2">{t('ui.about.sources.atlasTitle')}</h3>
          <ul className="flex flex-col gap-2 text-sm">
            <Li k="ui.about.sources.gras" href="https://www.shanghairanking.com/rankings/gras/2026" />
            <Li k="ui.about.sources.wikidata" href="https://www.wikidata.org/" />
            <Li k="ui.about.sources.naturalEarth" href="https://www.naturalearthdata.com/" />
            <Li k="ui.about.sources.catalog" href="http://www.moe.gov.cn/srcsite/A08/moe_1034/s3882/202604/t20260427_1434931.html" />
            <li>
              <Rich
                k="ui.about.sources.subjectTables"
                params={{ schools: n(programsManifest.counts.schools) }}
                slots={{
                  a1: ext('https://jyt.hubei.gov.cn/bmdt/ztzl/gxzs/xxgk/ywgg/202502/t20250228_5559043.shtml'),
                  a2: ext('https://jyt.jiangsu.gov.cn/art/2025/2/20/art_58320_11496337.html'),
                  a3: ext('https://www.shmeea.edu.cn/page/08000/20250221/19115.html'),
                  a4: ext('https://www.zjzs.net/col/col369/index.html'),
                  a5: ext('https://www.sdzk.cn/NewsInfo.aspx?NewsID=6819'),
                  a6: ext('https://www.haeea.cn/a/202504/43488_e2b7c248.shtml'),
                  a7: ext('https://www.nm.zsks.cn/kszs/ptgk/zcfg/202503/t20250318_45530.html'),
                }}
              />
            </li>
            <Li k="ui.about.sources.strongBase" href="http://www.moe.gov.cn/srcsite/A15/moe_776/s3258/202001/t20200115_415589.html" />
            <Li k="ui.about.sources.directHire" params={{ rendered: worldAtlasManifest.counts.programs, unverified: worldAtlasManifest.counts.programsUnverified }} />
            <Li k="ui.about.sources.joint" href="https://www.crs.jsj.edu.cn/" />
            <li>
              <Rich
                k="ui.about.sources.hkmotw"
                slots={{
                  a1: ext('https://portal.dsedj.gov.mo/webdsejspace/internet/Inter_main_page.jsp?id=80123'),
                  a2: ext('https://rusen.stust.edu.tw/cpx/index.html'),
                  a3: ext('https://cmn-hant.overseas.ncnu.edu.tw/'),
                }}
              />
            </li>
            <Li
              k="ui.about.sources.overseasLayer"
              params={{ institutions: o.institutions, portals: o.portals.total, visa: o.visa.total, verified: o.byStatus.verified, high: o.byConfidence.high, medium: o.byConfidence.medium, blocked: o.byStatus.blocked, notFound: o.byStatus.not_found, needsReview: o.byStatus.needs_review }}
              href="https://github.com/ieduer/unapply/blob/master/docs/MAINTENANCE_MANUAL.md"
            />
          </ul>
          <h3 className="serif text-lg text-fog-100 mt-4 mb-2">{t('ui.about.sources.crowdTitle')}</h3>
          <ul className="flex flex-col gap-2 text-sm">
            <Li k="ui.about.sources.collegeschat" href="https://github.com/CollegesChat/university-information" />
            <Li k="ui.about.sources.userContrib" href="https://github.com/ieduer/unapply/issues?q=label%3Adata-contribution" />
          </ul>
        </div>

        <div data-authority-tiers>
          <h2 className="serif text-2xl text-fog-100 mb-4">{t('ui.about.tiers.title')}</h2>
          <p className="text-sm">{t('ui.about.tiers.intro')}</p>
          <ul className="flex flex-col gap-2 text-sm list-disc pl-5 mt-3">
            <Li k="ui.about.tiers.p0" />
            <Li k="ui.about.tiers.p1" />
            <Li k="ui.about.tiers.p2" />
          </ul>
          <p className="mt-3 text-sm" data-tier-footer-note>{t('ui.about.tiers.footer')}</p>
          <p className="mt-3 text-sm"><Rich k="ui.about.tiers.rule" slots={{ a1: ext('https://github.com/ieduer/unapply/blob/master/docs/MAINTENANCE_MANUAL.md') }} /></p>
          <p className="mt-2 text-sm text-fog-500">
            <Rich
              k="ui.about.tiers.data"
              params={{ rules: n(authorityTiersSource.counts.rules), urls: n(linkCheckBaseline.counts.urls) }}
              slots={{ a1: ext('https://github.com/ieduer/unapply/blob/master/data/research/authority_tiers.2026-11-07.csv'), a2: ext('https://github.com/ieduer/unapply/blob/master/data/research/link_check.2026-11-07.summary.json') }}
            />
          </p>
        </div>

        <div data-db-section data-db-version={dbManifest.version}>
          <h2 className="serif text-2xl text-fog-100 mb-4">{t('ui.about.db.title')}</h2>
          <p className="text-sm">{t('ui.about.db.intro', { institutions: n(dbManifest.counts.institutions), crosswalk: n(dbManifest.counts.crosswalk), channels: n(dbManifest.counts.channels), conditions: n(dbManifest.counts.conditions), sources: n(dbManifest.counts.sources), validity: n(dbManifest.counts.validity) })}</p>
          <p className="mt-3 text-sm"><Rich k="ui.about.db.rule" /></p>
          <p className="mt-3 text-sm text-fog-500">
            <Rich
              k="ui.about.db.links"
              params={{ version: <code className="mono">{dbManifest.version}</code> }}
              slots={{
                a1: own(dbManifest.latestPath),
                a2: own('https://github.com/ieduer/unapply/blob/master/docs/DB_API.md'),
                a3: own('https://github.com/ieduer/unapply/blob/master/docs/DB_SCHEMA.md'),
                a4: own('https://github.com/ieduer/unapply/blob/master/docs/ANNUAL_UPDATE.md'),
              }}
            />
          </p>
        </div>

        <div>
          <h2 className="serif text-2xl text-fog-100 mb-4">{t('ui.about.scope.title')}</h2>
          <ul className="flex flex-col gap-2 text-sm list-disc pl-5">
            <li>{t('ui.about.scope.counts', { total: n(officialSchoolCount), adult: n(adultHigherEducationCount) })}</li>
            <li>{t('ui.about.scope.curated')}</li>
            <Li k="ui.about.scope.presumption" />
            <li>{t('ui.about.scope.hidden')}</li>
          </ul>
        </div>

        <div>
          <h2 className="serif text-2xl text-fog-100 mb-4">{t('ui.about.method.title')}</h2>
          <ul className="flex flex-col gap-2 text-sm list-disc pl-5">
            <Li k="ui.about.method.presumption" />
            <Li k="ui.about.method.evidence" />
            <Li k="ui.about.method.prior" />
            <Li k="ui.about.method.noDefault" />
            <Li k="ui.about.method.derivation" />
            <Li k="ui.about.method.neutral" />
            <Li k="ui.about.method.nonCommercial" />
            <Li k="ui.about.method.noAdvice" />
          </ul>
        </div>

        <div>
          <h2 className="serif text-2xl text-fog-100 mb-4">{t('ui.about.language.title')}</h2>
          <p className="text-sm">{t('ui.about.language.text')}</p>
        </div>

        <div>
          <h2 className="serif text-2xl text-fog-100 mb-4">{t('ui.about.roadmap.title')}</h2>
          <p>{t('ui.about.roadmap.intro')}</p>
          <ul className="flex flex-col gap-2 text-sm list-disc pl-5 mt-3">
            <Li k="ui.about.roadmap.s0" />
            <Li k="ui.about.roadmap.s1" />
            <Li k="ui.about.roadmap.s2" />
            <Li k="ui.about.roadmap.s3" params={{ institutions: o.institutions, regions: o.regions }} />
            <Li k="ui.about.roadmap.s45" />
            <Li k="ui.about.roadmap.global" />
          </ul>
          <p className="mt-3 text-sm text-fog-500">
            <Rich k="ui.about.roadmap.link" slots={{ a1: ext('https://github.com/ieduer/unapply/blob/master/docs/GLOBAL_ROADMAP.md') }} />
          </p>
        </div>

        <div>
          <h2 className="serif text-2xl text-fog-100 mb-4">{t('ui.about.sisters.title')}</h2>
          <ul className="flex flex-col gap-2 text-sm list-disc pl-5">
            <li><Rich k="ui.about.sisters.path" slots={{ a1: site('https://path.bdfz.net') }} /></li>
            <li><Rich k="ui.about.sisters.nope" slots={{ a1: site('https://nope.bdfz.net') }} /></li>
            <li><Rich k="ui.about.sisters.gk" slots={{ a1: site('https://gk.rdfzer.com/#advice-top') }} /></li>
            <li><Rich k="ui.about.sisters.my" slots={{ a1: site('https://my.bdfz.net') }} /></li>
          </ul>
        </div>

        <div className="border border-ink-800 bg-ink-900/60 rounded-xl px-4 py-4">
          <h2 className="serif text-xl text-fog-100 mb-3">{t('ui.about.useful.title')}</h2>
          <p className="text-sm text-fog-400 leading-relaxed">{t('ui.about.useful.text')}</p>
        </div>
      </section>
    </main>
  )
}
