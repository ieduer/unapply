import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  OverseasIndexPayload,
  OverseasInstitutionDetail,
  OverseasInstitutionSummary,
  OverseasPortal,
  OverseasQuote,
  OverseasRegionPayload,
  OverseasRegionRow,
  OverseasVisa,
} from '../data/overseasTypes'
import { loadOverseasIndex, loadOverseasRegion } from '../lib/overseasData'
import { OverseasRequirements } from './OverseasRequirements'
import { getOriginOption, type OriginRegion } from '../data/origins'
import { QUALIFICATION_OPTIONS, isQualification, offeredQualifications, qualificationTokens, type OriginPrefs } from '../data/originBranch'
import { countListed, loadQualificationsIndex, markInstitution, type QualificationsPayload } from '../lib/originLayer'
import { useLocale, type Locale } from '../i18n/react'
import { Rich } from '../i18n/rich'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'

interface Props {
  origin: OriginRegion | null
  /** 起點分支（批 E2）：資格決定「校方頁面寫明接受」標示；只標示、不過濾。 */
  originPrefs: OriginPrefs
  onOriginPrefsChange: (prefs: OriginPrefs) => void
  /** 目前展開的地區（slug）；null＝地區清單。 */
  regionSlug: string | null
  /** 進入地區頁時要自動展開的機構 id（世界地圖入口用）。 */
  institutionId: string | null
  onNavigate: (regionSlug: string | null, institutionId?: string | null) => void
  onBack: () => void
  onAbout: () => void
  onWorld: () => void
  onHkMoTw: () => void
  onStartMainland: () => void
}

/** 地區名：payload 的 nameZh 是正體（資料，不轉字形）；en 用地區代碼（英文名）。 */
const regionName = (row: { code: string; nameZh: string }, locale: Locale) => (locale === 'en' ? row.code : row.nameZh)

/**
 * 海外可申請學校（路線圖 S3）。只抄各機構官方國際本科招生頁、各國官方申請平台與簽證主管機關頁的原文片段，
 * 不解讀、不換算、不代表錄取可能；排名數字只描述學科分佈。核查不過的鏈接不上線，只寫「官方頁本站未讀到」與原因。
 * 它不是題庫、不替任何人劃掉學校；所在地只決定先看哪裡，之後可以跨區看。
 * 原文片段、機構名、平台名、主管機關名與 payload 內的說明文字（note／roleLabel／typeZh）是資料，不翻譯、不轉字形；狀態與分類以代碼經 ui.overseas.* 翻譯。
 */
export function OverseasPage({ origin, originPrefs, onOriginPrefsChange, regionSlug, institutionId, onNavigate, onBack, onAbout, onWorld, onHkMoTw, onStartMainland }: Props) {
  const { t } = useLocale()
  const [index, setIndex] = useState<OverseasIndexPayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  // 資格標示（批 E2）：token 清單由起點＋資格決定；計數用懶載的 qualifications.json，載不到就只少計數行。
  const marking = useMemo(() => qualificationTokens(origin, originPrefs), [origin, originPrefs])
  const markingActive = marking.tokens.length > 0 || marking.gaokao
  const [qualIndex, setQualIndex] = useState<QualificationsPayload | null>(null)
  useEffect(() => {
    if (!markingActive || qualIndex) return
    let alive = true
    loadQualificationsIndex().then((payload) => { if (alive) setQualIndex(payload) }).catch(() => undefined)
    return () => { alive = false }
  }, [markingActive, qualIndex])
  const qualificationChoices = offeredQualifications(origin && origin !== 'cn-mainland' ? origin : 'overseas')

  useEffect(() => {
    let alive = true
    loadOverseasIndex()
      .then((loaded) => { if (alive) setIndex(loaded) })
      .catch((error: unknown) => { if (alive) setLoadError(error instanceof Error ? error.message : String(error)) })
    return () => { alive = false }
  }, [reloadToken])

  const originOption = origin ? getOriginOption(origin) : null
  const regionRow = useMemo(() => (index && regionSlug ? index.regions.find((r) => r.slug === regionSlug) ?? null : null), [index, regionSlug])

  if (loadError) {
    return (
      <main className="min-h-screen app-canvas text-fog-100 flex items-center justify-center px-5">
        <section className="w-full max-w-md border border-ink-800 bg-ink-900 rounded-xl p-6 flex flex-col gap-4">
          <p className="mono text-xs text-fog-500 uppercase tracking-[0.2em]">{t('ui.overseas.kicker')}</p>
          <h1 className="serif text-2xl">{t('ui.overseas.loadFailed')}</h1>
          <p className="text-sm text-fog-500 leading-relaxed">{loadError}</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => { setLoadError(null); setReloadToken((token) => token + 1) }} className="px-5 py-3 rounded-full bg-accent-500 text-ink-950 text-sm font-semibold hover:bg-accent-400">{t('ui.common.retryLoad')}</button>
            <button onClick={onBack} className="px-5 py-3 rounded-full border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500">{t('ui.common.backHome')}</button>
          </div>
        </section>
      </main>
    )
  }
  if (!index) {
    return (
      <main className="min-h-screen app-canvas text-fog-100 flex items-center justify-center px-5">
        <p className="mono text-xs uppercase tracking-[0.2em] text-fog-500">{t('ui.overseas.loading')}</p>
      </main>
    )
  }

  const totals = {
    institutions: index.institutions.length,
    verified: index.institutions.filter((i) => i.status === 'verified').length,
    linkLive: index.institutions.filter((i) => i.linkLive).length,
    unread: index.institutions.filter((i) => i.status !== 'verified').length,
    portalsLive: index.regions.reduce((n, r) => n + r.portalsLive, 0),
    visaLive: index.regions.reduce((n, r) => n + r.visaLive, 0),
  }
  const unread = t('ui.overseas.unread')

  return (
    <main className="min-h-screen app-canvas text-fog-100">
      <SiteHeader brand={t('ui.overseas.brand')} back={{ label: t('ui.hkmotw.backHome'), onClick: onBack }} />

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-24 flex flex-col gap-8">
        <div className="max-w-3xl flex flex-col gap-3">
          <h1 className="serif text-3xl sm:text-5xl leading-tight">{t('ui.overseas.title')}</h1>
          <p className="text-sm sm:text-base text-fog-300 leading-relaxed">
            <Rich k="ui.overseas.lede" params={{ institutions: totals.institutions, unread }} />
          </p>
          <p className="text-xs mono text-fog-500 leading-relaxed">
            {t('ui.overseas.totals', { ...totals, date: index.generatedAt })}
          </p>
          <div className="border border-ink-800 bg-ink-950/60 rounded-xl px-4 py-3 flex flex-col gap-2 text-sm" data-qualification-marking={markingActive ? 'on' : 'off'}>
            <label className="flex flex-wrap items-center gap-2 text-xs mono text-fog-500">
              <span className="uppercase tracking-[0.2em] shrink-0">{t('ui.overseas.qual.selector')}</span>
              {origin === 'cn-mainland' ? (
                <span className="text-fog-200">{t('ui.overseas.qual.gaokaoOption')}</span>
              ) : (
                <select
                  value={originPrefs.qualification ?? ''}
                  onChange={(event) => onOriginPrefsChange({ ...originPrefs, qualification: isQualification(event.target.value) ? event.target.value : null })}
                  className="bg-ink-950 border border-ink-700 rounded-lg px-2 py-2 text-fog-200 min-h-[40px] max-w-full"
                >
                  <option value="">{t('ui.overseas.qual.none')}</option>
                  {qualificationChoices.map((qualification) => <option key={qualification} value={qualification}>{t(`origin.qual.${qualification}.label`)}</option>)}
                </select>
              )}
            </label>
            {markingActive && qualIndex && (() => { const c = countListed(qualIndex, marking.tokens, marking.gaokao); return <p className="text-xs mono text-fog-500">{t('ui.overseas.qual.counts', { listed: c.listed, unread: c.unread })}</p> })()}
            {markingActive && originPrefs.qualification && QUALIFICATION_OPTIONS[originPrefs.qualification].tokens.length === 0 && <p className="text-xs text-fog-500">{t(`origin.qual.${originPrefs.qualification}.hint`)}</p>}
            <p className="text-xs text-fog-500 leading-relaxed">{t('ui.overseas.qual.rule')}</p>
          </div>
          {originOption && !originOption.hasLocalPool && (
            <div className="border border-ink-800 bg-ink-900 rounded-xl px-4 py-3 text-sm text-fog-300 leading-relaxed">
              <Rich
                k="ui.overseas.originNote"
                params={{
                  origin: t(`origin.${originOption.id}.label`),
                  hkmotw: (origin === 'hk' || origin === 'mo' || origin === 'tw') ? <Rich k="ui.overseas.originNote.hkmotw" slots={{ a3: (children) => <button onClick={onHkMoTw} className="inline-flex items-center min-h-[40px] underline hover:text-accent-500">{children}</button> }} /> : '',
                }}
                slots={{
                  a1: (children) => <button onClick={onWorld} className="inline-flex items-center min-h-[40px] underline hover:text-accent-500">{children}</button>,
                  a2: (children) => <button onClick={onStartMainland} className="inline-flex items-center min-h-[40px] underline hover:text-accent-500">{children}</button>,
                }}
              />
            </div>
          )}
        </div>

        {regionSlug && !regionRow && (
          <div className="border border-ink-800 bg-ink-900 rounded-xl px-4 py-3 text-sm text-fog-300 leading-relaxed">
            <Rich k="ui.overseas.regionNotFound" params={{ slug: regionSlug }} slots={{ a1: (children) => <button onClick={() => onNavigate(null)} className="underline hover:text-accent-500">{children}</button> }} />
          </div>
        )}

        {regionRow ? (
          <RegionSection key={`${regionRow.slug}|${institutionId ?? ''}`} row={regionRow} index={index} institutionId={institutionId} onBackToList={() => onNavigate(null)} onWorld={onWorld} marking={markingActive ? marking : null} qualIndex={qualIndex} />
        ) : (
          <RegionList regions={index.regions} onOpen={(slug) => onNavigate(slug)} />
        )}

        <footer className="pt-6 border-t border-ink-800 text-xs mono text-fog-500 leading-relaxed">
          <p>
            <Rich
              k="ui.overseas.footer.links"
              params={{ date: index.generatedAt }}
              slots={{
                a1: (children) => <button onClick={onAbout} className="hover:text-accent-500 underline">{children}</button>,
                a2: (children) => <button onClick={onWorld} className="hover:text-accent-500 underline">{children}</button>,
                a3: (children) => <button onClick={onHkMoTw} className="hover:text-accent-500 underline">{children}</button>,
              }}
            />
          </p>
        </footer>
      </section>
      <SiteFooter width="max-w-5xl" />
    </main>
  )
}

function RegionList({ regions, onOpen }: { regions: OverseasRegionRow[]; onOpen: (slug: string) => void }) {
  const { t, locale } = useLocale()
  return (
    <section className="flex flex-col gap-4" aria-label={t('ui.overseas.regions.aria')}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="serif text-2xl">{t('ui.overseas.regions.title')}</h2>
        <span className="text-xs mono text-fog-500">{t('ui.overseas.regions.sorted', { n: regions.length })}</span>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {regions.map((r) => (
          <li key={r.slug}>
            <button
              onClick={() => onOpen(r.slug)}
              className="w-full text-left border border-ink-800 bg-ink-900/78 backdrop-blur-xl rounded-xl p-4 flex flex-col gap-2 hover:border-accent-500 min-h-[96px]"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="serif text-xl leading-snug">{regionName(r, locale)}</span>
                {locale !== 'en' && <span className="text-xs mono text-fog-500 truncate">{r.code}</span>}
              </span>
              <span className="text-sm text-fog-300"><Rich k="ui.overseas.regions.card.line1" params={{ institutions: r.institutions, verified: r.verified, unread: r.unread }} /></span>
              <span className="text-xs mono text-fog-500">{t('ui.overseas.regions.card.line2', { portalsLive: r.portalsLive, portals: r.portals, visaLive: r.visaLive, visa: r.visa })}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function RegionSection({ row, index, institutionId, onBackToList, onWorld, marking, qualIndex }: { row: OverseasRegionRow; index: OverseasIndexPayload; institutionId: string | null; onBackToList: () => void; onWorld: () => void; marking: { tokens: readonly string[]; gaokao: boolean } | null; qualIndex: QualificationsPayload | null }) {
  const { t, locale } = useLocale()
  const [payload, setPayload] = useState<OverseasRegionPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [openId, setOpenId] = useState<string | null>(institutionId)

  // 父層以 `slug|institutionId` 作 key，換地區或換目標機構時整個區塊重建，狀態自然歸零。
  useEffect(() => {
    let alive = true
    loadOverseasRegion(row.slug)
      .then((loaded) => { if (alive) setPayload(loaded) })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)) })
    return () => { alive = false }
  }, [row.slug, reloadToken])

  const summaries = useMemo(() => index.institutions.filter((i) => i.region === row.code), [index, row.code])
  const regionCounts = marking && qualIndex ? countListed(qualIndex, marking.tokens, marking.gaokao, summaries.map((i) => i.id)) : null
  const ordered = useMemo(() => {
    const list = payload ? payload.institutions : []
    // 官方頁已讀到的排前面（字母序），未讀到的排後面（字母序）；不按任何分數排。
    return [...list].sort((a, b) => Number(b.status === 'verified') - Number(a.status === 'verified') || a.nameEn.localeCompare(b.nameEn, 'en'))
  }, [payload])
  const unread = t('ui.overseas.unread')

  return (
    <section className="flex flex-col gap-6" aria-label={t('ui.overseas.region.aria', { region: regionName(row, locale) })}>
      <div className="flex flex-col gap-2">
        <button onClick={onBackToList} className="self-start text-xs mono uppercase tracking-[0.2em] text-fog-500 hover:text-accent-500 min-h-[40px]">{t('ui.overseas.region.allRegions')}</button>
        <h2 className="serif text-3xl leading-tight">{regionName(row, locale)} {locale !== 'en' && <span className="text-fog-500 text-xl">· {row.code}</span>}</h2>
        <p className="text-sm text-fog-300 leading-relaxed">
          <Rich
            k="ui.overseas.region.summary"
            params={{ institutions: row.institutions, verified: row.verified, linkLive: row.linkLive, unread: row.unread, portals: row.portals, portalsLive: row.portalsLive, visa: row.visa, visaLive: row.visaLive }}
            slots={{ a1: (children) => <button onClick={onWorld} className="underline hover:text-accent-500">{children}</button> }}
          />
        </p>
        {regionCounts && <p className="text-xs mono text-fog-500" data-region-qual-counts>{t('ui.overseas.qual.counts', { listed: regionCounts.listed, unread: regionCounts.unread })}</p>}
      </div>

      {error && (
        <div className="border border-ink-800 bg-ink-900 rounded-xl px-4 py-3 text-sm text-fog-300 leading-relaxed flex flex-wrap items-center gap-3">
          <span>{error}</span>
          <button onClick={() => { setError(null); setReloadToken((token) => token + 1) }} className="px-4 py-2 rounded-full bg-accent-500 text-ink-950 text-sm font-semibold hover:bg-accent-400">{t('ui.common.retryLoad')}</button>
        </div>
      )}
      {!payload && !error && <p className="mono text-xs uppercase tracking-[0.2em] text-fog-500">{t('ui.overseas.region.loading', { slug: row.slug })}</p>}

      {payload && (
        <>
          <Block title={t('ui.overseas.portals.title')} count={payload.portals.length} note={t('ui.overseas.portals.note')}>
            {payload.portals.length === 0 ? <Empty text={t('ui.overseas.portals.empty', { unread })} /> : (
              <ul className="flex flex-col gap-3">{payload.portals.map((p, i) => <PortalCard key={`${p.name}-${i}`} portal={p} />)}</ul>
            )}
          </Block>

          <Block title={t('ui.overseas.visa.title')} count={payload.visa.length} note={t('ui.overseas.visa.note')}>
            {payload.visa.length === 0 ? <Empty text={t('ui.overseas.visa.empty', { unread })} /> : (
              <ul className="flex flex-col gap-3">{payload.visa.map((v, i) => <VisaCard key={`${v.category}-${i}`} visa={v} />)}</ul>
            )}
          </Block>

          <Block title={t('ui.overseas.institutions.title')} count={summaries.length} note={t('ui.overseas.institutions.note')}>
            <ul className="flex flex-col gap-3">
              {ordered.map((inst) => (
                <InstitutionRow key={inst.id} inst={inst} open={openId === inst.id} onToggle={() => setOpenId(openId === inst.id ? null : inst.id)} autoScroll={institutionId === inst.id} marking={marking} />
              ))}
            </ul>
          </Block>

          <UnreadNote institutions={summaries} />
        </>
      )}
    </section>
  )
}

function Block({ title, count, note, children }: { title: string; count: number; note: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="serif text-2xl">{title} <span className="text-fog-500 text-base">· {count}</span></h3>
        <p className="text-xs text-fog-500 leading-relaxed">{note}</p>
      </div>
      {children}
    </section>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-fog-500 leading-relaxed">{text}</p>
}

function StatusBadge({ text }: { text: string }) {
  return <span className="inline-block rounded-full border border-ink-700 bg-ink-950 px-2.5 py-0.5 text-xs text-fog-300 leading-5">{text}</span>
}

function SourceLine({ url, live, date, prefixKey = 'ui.overseas.source' }: { url: string; live: boolean; date?: string; prefixKey?: string }) {
  const { t } = useLocale()
  let host = url
  try { host = new URL(url).hostname } catch { /* 原樣顯示 */ }
  return (
    <p className="text-xs mono text-fog-500 break-all leading-relaxed">
      {t(prefixKey)}{t('ui.common.colon')}{live ? <a className="underline hover:text-accent-500" href={url} target="_blank" rel="noreferrer noopener">{url} ↗</a> : <span>{host}{t('ui.overseas.notLinked')}</span>}
      {date && <> · {t('ui.overseas.fetched', { date })}</>}
    </p>
  )
}

function Quote({ quote }: { quote: OverseasQuote }) {
  return (
    <blockquote className="border-l-2 border-ink-700 pl-3 flex flex-col gap-1">
      <p className="text-sm text-fog-300 leading-relaxed break-words">
        {quote.label && <span className="mono text-xs text-fog-500 mr-2">{quote.label}</span>}
        {quote.text}
      </p>
      <SourceLine url={quote.url} live={quote.live} />
    </blockquote>
  )
}

function PlainQuotes({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="grid sm:grid-cols-[5rem_1fr] gap-1 sm:gap-3">
      <dt className="text-xs mono uppercase tracking-[0.16em] text-fog-500 pt-0.5">{label}</dt>
      <dd className="flex flex-col gap-2">
        {items.map((text, i) => <blockquote key={i} className="border-l-2 border-ink-700 pl-3 text-sm text-fog-300 leading-relaxed break-words">{text}</blockquote>)}
      </dd>
    </div>
  )
}

/**
 * 未上鏈接的說明行：資料卡的來源行只寫一次「官方頁本站未讀到」、網域與核對日（2026-11-08 批 G6：不再顯示被擋、驗證頁、403 之類的內部核查原因；原因仍留在資料檔）。
 */
function UnreadLine({ domain, fetchedAt }: { note?: string; domain: string | null; fetchedAt: string }) {
  const { t } = useLocale()
  return (
    <p className="text-xs mono text-fog-500 leading-relaxed break-words">{t('ui.overseas.unreadPrefix')}{domain ? ` · ${domain}` : ''} · {t('ui.overseas.checked', { date: fetchedAt })}</p>
  )
}

function PortalCard({ portal }: { portal: OverseasPortal }) {
  const { t } = useLocale()
  const unread = t('ui.overseas.unread')
  const hasQuotes = portal.quotes.audience.length + portal.quotes.fees.length + portal.quotes.timeline.length + portal.quotes.other.length > 0
  return (
    <li className="border border-ink-800 bg-ink-900/78 backdrop-blur-xl rounded-xl p-4 flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h4 className="text-base text-fog-100 font-semibold leading-snug">{portal.name}</h4>
          <p className="text-xs mono text-fog-500">{portal.typeZh} · {portal.domainClassZh}{portal.domainClass === 'official-platform' && <> · {t('ui.overseas.portal.corroborating', { n: portal.corroborating })}</>}</p>
          <p className="text-sm text-fog-300 leading-relaxed">{portal.roleLabel}</p>
        </div>
        <StatusBadge text={portal.linkLive ? t('ui.overseas.status.verifiedLink') : t(`ui.overseas.statusCode.${portal.status}`)} />
      </div>
      {hasQuotes ? (
        <dl className="grid gap-2">
          <PlainQuotes label={t('ui.overseas.portal.quotes.audience')} items={portal.quotes.audience} />
          <PlainQuotes label={t('ui.overseas.portal.quotes.fees')} items={portal.quotes.fees} />
          <PlainQuotes label={t('ui.overseas.portal.quotes.timeline')} items={portal.quotes.timeline} />
          <PlainQuotes label={t('ui.overseas.portal.quotes.other')} items={portal.quotes.other} />
        </dl>
      ) : <p className="text-xs text-fog-500">{t('ui.overseas.portal.noQuotes', { unread })}</p>}
      {portal.linkLive && portal.url ? <SourceLine url={portal.url} live date={portal.fetchedAt} prefixKey="ui.overseas.officialPage" /> : (
        <UnreadLine note={portal.note} domain={portal.domain} fetchedAt={portal.fetchedAt} />
      )}
    </li>
  )
}

function VisaCard({ visa }: { visa: OverseasVisa }) {
  const { t } = useLocale()
  const unread = t('ui.overseas.unread')
  const q = visa.quotes
  const hasQuotes = q.financial.length + q.language.length + q.insurance.length + q.fee.length + q.timeline.length + q.other.length > 0
  return (
    <li className="border border-ink-800 bg-ink-900/78 backdrop-blur-xl rounded-xl p-4 flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h4 className="text-base text-fog-100 font-semibold leading-snug">{visa.category}</h4>
          <p className="text-sm text-fog-300 leading-relaxed">{visa.authority}</p>
        </div>
        <StatusBadge text={visa.linkLive ? t('ui.overseas.status.verifiedLink') : t(`ui.overseas.statusCode.${visa.status}`)} />
      </div>
      {hasQuotes ? (
        <dl className="grid gap-2">
          <PlainQuotes label={t('ui.overseas.visa.quotes.financial')} items={q.financial} />
          <PlainQuotes label={t('ui.overseas.visa.quotes.language')} items={q.language} />
          <PlainQuotes label={t('ui.overseas.visa.quotes.insurance')} items={q.insurance} />
          <PlainQuotes label={t('ui.overseas.visa.quotes.fee')} items={q.fee} />
          <PlainQuotes label={t('ui.overseas.visa.quotes.timeline')} items={q.timeline} />
          <PlainQuotes label={t('ui.overseas.visa.quotes.other')} items={q.other} />
        </dl>
      ) : <p className="text-xs text-fog-500">{t('ui.overseas.visa.noQuotes', { unread })}</p>}
      {visa.linkLive && visa.url ? <SourceLine url={visa.url} live date={visa.fetchedAt} prefixKey="ui.overseas.officialPage" /> : (
        <UnreadLine note={visa.note} domain={visa.domain} fetchedAt={visa.fetchedAt} />
      )}
    </li>
  )
}

function institutionBadgeKey(inst: OverseasInstitutionSummary): string {
  if (inst.linkLive) return 'ui.overseas.badge.linkLive'
  if (inst.confidence === 'medium') return 'ui.overseas.badge.medium'
  return `ui.overseas.statusCode.${inst.status}`
}

function InstitutionRow({ inst, open, onToggle, autoScroll, marking }: { inst: OverseasInstitutionDetail; open: boolean; onToggle: () => void; autoScroll: boolean; marking: { tokens: readonly string[]; gaokao: boolean } | null }) {
  const { t, locale } = useLocale()
  const ref = useRef<HTMLLIElement | null>(null)
  // 資格標示（保留語義）：寫明→徽章；未寫明→「官方頁未讀到（保留）」；永不劃掉。
  const mark = marking && inst.status === 'verified' ? markInstitution(inst.qualifications.listed, inst.gaokaoPolicy, marking.tokens, marking.gaokao) : null
  useEffect(() => {
    if (autoScroll && ref.current) ref.current.scrollIntoView({ block: 'start' })
  }, [autoScroll])
  return (
    <li ref={ref} className="border border-ink-800 bg-ink-900/78 backdrop-blur-xl rounded-xl p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <h4 className="serif text-xl leading-snug break-words">
            {locale !== 'en' && inst.nameZh ? <>{inst.nameZh} <span className="text-fog-500 text-base">· {inst.nameEn}</span></> : inst.nameEn}
          </h4>
          <p className="text-xs mono text-fog-500">{t('ui.overseas.inst.subjects', { n: inst.subjects })}{inst.dataAcademicYear ? t('ui.overseas.inst.academicYear', { year: inst.dataAcademicYear }) : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {marking && (inst.status === 'verified' || mark?.listed) && (
            <span data-qual-mark={mark?.listed ? 'listed' : 'unread'} className={['inline-block rounded-full border px-2.5 py-0.5 text-xs leading-5', mark?.listed ? 'border-accent-500/40 bg-accent-500/10 text-accent-600' : 'border-ink-700 bg-ink-950 text-fog-300'].join(' ')}>
              {mark?.listed ? (mark.gaokao && mark.matched.length === 0 ? t('ui.overseas.qual.listedGaokao') : t('ui.overseas.qual.listed', { tokens: mark.matched.join(' · ') })) : t('ui.overseas.qual.unread')}
            </span>
          )}
          <StatusBadge text={t(institutionBadgeKey(inst))} />
          <a className="tap text-xs mono text-accent-500 hover:text-accent-400" href={inst.website} target="_blank" rel="noreferrer noopener">{t('ui.overseas.inst.website')}</a>
          <button onClick={onToggle} aria-expanded={open} className="text-xs mono text-accent-500 hover:text-accent-400 min-h-[40px] px-1">{open ? t('ui.overseas.inst.collapse') : t('ui.overseas.inst.expand')}</button>
        </div>
      </div>
      {open && <InstitutionDetail inst={inst} />}
    </li>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid sm:grid-cols-[8rem_1fr] gap-1 sm:gap-3 border-t border-ink-800 pt-3">
      <dt className="text-xs mono uppercase tracking-[0.16em] text-fog-500 pt-0.5">{label}</dt>
      <dd className="flex flex-col gap-2 min-w-0">{children}</dd>
    </div>
  )
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => <li key={item} className="rounded-full border border-ink-700 bg-ink-950 px-2.5 py-0.5 text-xs text-fog-300 leading-5">{item}</li>)}
    </ul>
  )
}

function Quotes({ quotes, emptyNote }: { quotes: OverseasQuote[]; emptyNote?: string }) {
  const { t } = useLocale()
  if (quotes.length === 0) return <p className="text-sm text-fog-500">{t('ui.overseas.quotes.empty', { unread: t('ui.overseas.unread'), note: emptyNote ? t('ui.common.parenthetical', { text: emptyNote }) : '' })}</p>
  return <>{quotes.map((q, i) => <Quote key={i} quote={q} />)}</>
}

function InstitutionDetail({ inst }: { inst: OverseasInstitutionDetail }) {
  const { t } = useLocale()
  const a = inst.admissions
  const unread = t('ui.overseas.unread')
  const scores = [inst.english.ielts ? `IELTS ${inst.english.ielts}` : '', inst.english.toefl ? `TOEFL ${inst.english.toefl}` : ''].filter(Boolean).join(' · ')
  return (
    <dl className="flex flex-col gap-3 text-sm text-fog-300 leading-relaxed">
      <Field label={t('ui.overseas.field.admissions')}>
        {a.linkLive && a.url ? (
          <>
            <p><a className="underline text-fog-100 hover:text-accent-500 break-words" href={a.url} target="_blank" rel="noreferrer noopener">{a.title || a.url} ↗</a></p>
            <SourceLine url={a.url} live date={inst.fetchedAt} />
            {a.reviewedAt && a.externalDomain && <p className="text-xs text-fog-500" data-admissions-reviewed>{t('ui.overseas.inst.reviewedExternal', { domain: a.externalDomain, date: a.reviewedAt })}</p>}
          </>
        ) : a.confidence === 'medium' ? (
          <>
            <p className="text-fog-100 break-words">{a.title || t('ui.overseas.inst.titleMissing')}</p>
            <p className="text-xs mono text-fog-500 break-all">{a.externalDomain} · {a.note}</p>
          </>
        ) : <p data-admissions-unread>{t('ui.overseas.unreadPrefix')}</p>}
      </Field>

      <Field label={t('ui.overseas.field.gaokao')}>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge text={t(`ui.overseas.gaokao.${inst.gaokao.policy}`)} />
          <span className="text-xs text-fog-500">{t('ui.overseas.gaokao.note')}</span>
        </div>
        <Quotes quotes={inst.gaokao.quotes} emptyNote={t('ui.overseas.gaokao.emptyNote')} />
      </Field>

      <Field label={t('ui.overseas.field.qualifications')}>
        <Chips items={inst.qualifications.listed} />
        <Quotes quotes={inst.qualifications.quotes} />
      </Field>

      {/* 批 G8：研究抽出並核對過的英語要求與國際生年學費（官方原文） */}
      <Field label={t('ui.req.title')}>
        <OverseasRequirements id={inst.id} />
      </Field>

      <Field label={t('ui.overseas.field.english')}>
        <Chips items={inst.english.tests} />
        {scores && <p className="text-xs text-fog-500">{t('ui.overseas.english.firstScore', { scores })}</p>}
        <Quotes quotes={inst.english.quotes} />
      </Field>

      <Field label={t('ui.overseas.field.otherLanguage')}>
        <Chips items={inst.otherLanguage.listed} />
        <Quotes quotes={inst.otherLanguage.quotes} />
      </Field>

      <Field label={t('ui.overseas.field.tuition')}>
        {inst.tuition.quotes.length > 0 && <p className="text-xs text-fog-500">{t('ui.overseas.tuition.note')}</p>}
        <Quotes quotes={inst.tuition.quotes} />
      </Field>

      <Field label={t('ui.overseas.field.channels')}>
        <Chips items={inst.channels.listed} />
        <Quotes quotes={inst.channels.quotes} />
      </Field>

      <Field label={t('ui.overseas.field.timeline')}>
        <Quotes quotes={inst.timeline.quotes} />
      </Field>

      <Field label={t('ui.overseas.field.year')}>
        <p>{inst.dataAcademicYear ?? t('ui.overseas.quotes.empty', { unread, note: '' })}</p>
      </Field>

      <Field label={t('ui.overseas.field.sources')}>
        <p className="text-xs mono text-fog-500">{t('ui.overseas.sources.line', { date: inst.fetchedAt, pages: inst.pagesFetched, status: t(`ui.overseas.statusCode.${a.status}`), confidence: a.confidence ? t(`ui.overseas.confidence.${a.confidence}`) : '' })}</p>
        {inst.sources.length === 0 ? <p className="text-sm text-fog-500">{t('ui.overseas.quotes.empty', { unread, note: '' })}</p> : (
          <ul className="flex flex-col gap-1">
            {inst.sources.map((s) => (
              <li key={s.url} className="text-xs mono text-fog-500 break-all leading-relaxed">
                {s.live ? <a className="underline hover:text-accent-500" href={s.url} target="_blank" rel="noreferrer noopener">{s.url} ↗</a> : <span>{hostOf(s.url)}{t('ui.overseas.notLinked')}</span>}
              </li>
            ))}
          </ul>
        )}
      </Field>
    </dl>
  )
}

function hostOf(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

function UnreadNote({ institutions }: { institutions: OverseasInstitutionSummary[] }) {
  const { t, locale } = useLocale()
  const unread = institutions.filter((i) => i.status !== 'verified')
  const medium = institutions.filter((i) => i.confidence === 'medium')
  if (unread.length === 0 && medium.length === 0) return null
  const name = (i: OverseasInstitutionSummary) => (locale === 'en' ? i.nameEn : i.nameZh ?? i.nameEn)
  const joiner = t('ui.common.listJoiner')
  return (
    <div className="border border-ink-800 bg-ink-900 rounded-xl px-4 py-3 text-xs text-fog-500 leading-relaxed flex flex-col gap-1">
      {unread.length > 0 && <p>{t('ui.overseas.unreadNote.unread', { n: unread.length, names: unread.map(name).join(joiner) })}</p>}
      {medium.length > 0 && <p>{t('ui.overseas.unreadNote.medium', { n: medium.length, names: medium.map(name).join(joiner) })}</p>}
    </div>
  )
}
