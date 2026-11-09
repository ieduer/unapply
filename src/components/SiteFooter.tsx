import type { MouseEvent, ReactNode } from 'react'
import { useLocale } from '../i18n/react'
import { navigateHash } from '../lib/router'

/**
 * 全站共用頁尾（2026-11-08 批 G5 三行；批 G6：about 從頁頭移到第一行末端，所有頁面都有）。
 * 第一行：姊妹站 path · gk · my · 關於；第二行：來源與開源；第三行：授權與免責。全名放 title／aria-label，觸控高度 40px。
 */
export function SiteFooter({ width = 'max-w-5xl' }: { width?: 'max-w-2xl' | 'max-w-3xl' | 'max-w-5xl' }) {
  const { t } = useLocale()
  const toAbout = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    navigateHash('#/about')
  }
  return (
    <footer className={[width, 'w-full mx-auto px-4 sm:px-6 pt-4 pb-2 border-t border-ink-800 text-xs mono text-fog-500 leading-relaxed flex flex-col page-end-space'].join(' ')} data-site-footer>
      <p className="flex flex-wrap items-center gap-x-2" data-footer-line="sisters">
        <span className="text-fog-300">{t('ui.landing.footer.sisters')}</span>
        <FooterLink href="https://path.bdfz.net" title={t('ui.landing.footer.path')}>path</FooterLink>
        <Dot />
        <FooterLink href="https://gk.rdfzer.com/#advice-top" title={t('ui.landing.footer.gk')}>gk</FooterLink>
        <Dot />
        <FooterLink href="https://my.bdfz.net" title={t('ui.landing.footer.my')}>my</FooterLink>
        <Dot />
        <a className="inline-flex items-center min-h-[44px] sm:min-h-[40px] hover:text-accent-500 text-fog-300" href="#/about" onClick={toAbout} data-footer-about>{t('ui.common.about')}</a>
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
  )
}

function FooterLink({ href, title, children }: { href: string; title: string; children: ReactNode }) {
  return (
    <a className="inline-flex items-center min-h-[44px] sm:min-h-[40px] hover:text-accent-500" href={href} title={title} aria-label={title} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  )
}

function Dot() {
  return <span aria-hidden="true">·</span>
}
