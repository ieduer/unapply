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
import { getOriginOption, type OriginRegion } from '../data/origins'

interface Props {
  origin: OriginRegion | null
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

const UNREAD = '官方頁未讀到'

/**
 * 海外可申請學校（路線圖 S3）。只抄各機構官方國際本科招生頁、各國官方申請平台與簽證主管機關頁的原文片段，
 * 不解讀、不換算、不代表錄取可能；排名數字只描述學科分佈。核查不過的鏈接不上線，只寫「官方頁本站未讀到」與原因。
 * 它不是題庫、不替任何人劃掉學校；所在地只決定先看哪裡，之後可以跨區看。
 */
export function OverseasPage({ origin, regionSlug, institutionId, onNavigate, onBack, onAbout, onWorld, onHkMoTw, onStartMainland }: Props) {
  const [index, setIndex] = useState<OverseasIndexPayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

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
          <p className="mono text-xs text-fog-500 uppercase tracking-[0.2em]">overseas</p>
          <h1 className="serif text-2xl">海外可申請學校載入失敗</h1>
          <p className="text-sm text-fog-500 leading-relaxed">{loadError}</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => { setLoadError(null); setReloadToken((t) => t + 1) }} className="px-5 py-3 rounded-full bg-accent-500 text-ink-950 text-sm font-semibold hover:bg-accent-400">重試載入</button>
            <button onClick={onBack} className="px-5 py-3 rounded-full border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500">返回首頁</button>
          </div>
        </section>
      </main>
    )
  }
  if (!index) {
    return (
      <main className="min-h-screen app-canvas text-fog-100 flex items-center justify-center px-5">
        <p className="mono text-xs uppercase tracking-[0.2em] text-fog-500">loading overseas admissions</p>
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

  return (
    <main className="min-h-screen app-canvas text-fog-100">
      <header className="border-b border-ink-800 bg-ink-900/70 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between text-xs mono uppercase tracking-[0.2em] text-fog-500">
          <button onClick={onBack} className="hover:text-accent-500 min-h-[44px] -my-3 py-3">← 回首頁</button>
          <span className="hidden sm:inline">nope.bdfz.net · 海外可申請學校 · {index.version}</span>
          <button onClick={onAbout} className="hover:text-accent-500 min-h-[44px] -my-3 py-3">about</button>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-24 flex flex-col gap-8">
        <div className="max-w-3xl flex flex-col gap-3">
          <p className="mono text-xs uppercase tracking-[0.28em] text-accent-500">跨區可選池 · 海外（路線圖 S3）</p>
          <h1 className="serif text-3xl sm:text-5xl leading-tight">海外的學校怎麼招國際學生？只抄官方頁原文。</h1>
          <p className="text-sm sm:text-base text-fog-300 leading-relaxed">
            這一頁把全球學科地圖（GRAS 2026 前 50）裡 <b className="text-fog-100">{totals.institutions}</b> 所非中國大陸機構的官方國際本科招生頁、
            各國官方申請平台與簽證主管機關頁放在一起：<b className="text-fog-100">只抄官方頁原文片段，不解讀、不換算</b>，每段都帶來源與抓取日。
            它<b className="text-fog-100">不代表錄取可能</b>，排名數字只描述學科分佈；學費、語言分數可能是研究生或單項，以原句為準。
            核查不過的鏈接不上線，只寫「{UNREAD}」與原因；年度隨 GRAS 更新重核。
          </p>
          <p className="text-xs mono text-fog-500 leading-relaxed">
            機構 {totals.institutions} · 官方頁已讀到 {totals.verified} · 招生頁鏈接已核 {totals.linkLive} · 未讀到 {totals.unread} · 申請平台鏈接 {totals.portalsLive} · 簽證頁鏈接 {totals.visaLive} · 資料日 {index.generatedAt}
          </p>
          {originOption && !originOption.hasLocalPool && (
            <div className="border border-ink-800 bg-ink-900 rounded-xl px-4 py-3 text-sm text-fog-300 leading-relaxed">
              你選的起點是 <b className="text-fog-100">{originOption.label}</b>：{originOption.hint}。先看這裡各地區的招生頁原文，
              也可以 <button onClick={onWorld} className="underline hover:text-accent-500">看全球學科地圖</button>
              {(origin === 'hk' || origin === 'mo' || origin === 'tw') && <>、<button onClick={onHkMoTw} className="underline hover:text-accent-500">看港澳臺院校池</button></>}
              {' '}或 <button onClick={onStartMainland} className="underline hover:text-accent-500">進中國大陸題庫</button>。
            </div>
          )}
        </div>

        {regionSlug && !regionRow && (
          <div className="border border-ink-800 bg-ink-900 rounded-xl px-4 py-3 text-sm text-fog-300 leading-relaxed">
            找不到地區「{regionSlug}」。<button onClick={() => onNavigate(null)} className="underline hover:text-accent-500">回地區清單</button>
          </div>
        )}

        {regionRow ? (
          <RegionSection key={`${regionRow.slug}|${institutionId ?? ''}`} row={regionRow} index={index} institutionId={institutionId} onBackToList={() => onNavigate(null)} onWorld={onWorld} />
        ) : (
          <RegionList regions={index.regions} onOpen={(slug) => onNavigate(slug)} />
        )}

        <footer className="pt-6 border-t border-ink-800 text-xs mono text-fog-500 leading-relaxed">
          <p>只抄官方頁原文，核查不過的鏈接不上線；排名不是推薦，任何欄位都不是錄取可能。</p>
          <p>資料日 {index.generatedAt} · 了解 <button onClick={onAbout} className="hover:text-accent-500 underline">數據來源與方法論</button> · 看 <button onClick={onWorld} className="hover:text-accent-500 underline">全球學科地圖</button> · 跨區看 <button onClick={onHkMoTw} className="hover:text-accent-500 underline">港澳臺院校池</button></p>
        </footer>
      </section>
    </main>
  )
}

function RegionList({ regions, onOpen }: { regions: OverseasRegionRow[]; onOpen: (slug: string) => void }) {
  return (
    <section className="flex flex-col gap-4" aria-label="地區清單">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="serif text-2xl">先選一個國家或地區</h2>
        <span className="text-xs mono text-fog-500">按機構數排序 · {regions.length} 個</span>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {regions.map((r) => (
          <li key={r.slug}>
            <button
              onClick={() => onOpen(r.slug)}
              className="w-full text-left border border-ink-800 bg-ink-900/78 backdrop-blur-xl rounded-xl p-4 flex flex-col gap-2 hover:border-accent-500 min-h-[96px]"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="serif text-xl leading-snug">{r.nameZh}</span>
                <span className="text-xs mono text-fog-500 truncate">{r.code}</span>
              </span>
              <span className="text-sm text-fog-300">機構 <b className="text-fog-100">{r.institutions}</b> · 官方頁已讀到 {r.verified} · 未讀到 {r.unread}</span>
              <span className="text-xs mono text-fog-500">申請平台鏈接 {r.portalsLive}／{r.portals} · 簽證頁鏈接 {r.visaLive}／{r.visa}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function RegionSection({ row, index, institutionId, onBackToList, onWorld }: { row: OverseasRegionRow; index: OverseasIndexPayload; institutionId: string | null; onBackToList: () => void; onWorld: () => void }) {
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
  const ordered = useMemo(() => {
    const list = payload ? payload.institutions : []
    // 官方頁已讀到的排前面（字母序），未讀到的排後面（字母序）；不按任何分數排。
    return [...list].sort((a, b) => Number(b.status === 'verified') - Number(a.status === 'verified') || a.nameEn.localeCompare(b.nameEn, 'en'))
  }, [payload])

  return (
    <section className="flex flex-col gap-6" aria-label={`${row.nameZh} 地區`}>
      <div className="flex flex-col gap-2">
        <button onClick={onBackToList} className="self-start text-xs mono uppercase tracking-[0.2em] text-fog-500 hover:text-accent-500 min-h-[40px]">← 全部地區</button>
        <h2 className="serif text-3xl leading-tight">{row.nameZh} <span className="text-fog-500 text-xl">· {row.code}</span></h2>
        <p className="text-sm text-fog-300 leading-relaxed">
          機構 <b className="text-fog-100">{row.institutions}</b>（官方頁已讀到 {row.verified}、招生頁鏈接已核 {row.linkLive}、未讀到 {row.unread}）· 申請平台 {row.portals}（鏈接 {row.portalsLive}）· 簽證主管機關頁 {row.visa}（鏈接 {row.visaLive}）。
          所在地只決定先看哪裡；想比較學科分佈可以 <button onClick={onWorld} className="underline hover:text-accent-500">回全球學科地圖</button>。
        </p>
      </div>

      {error && (
        <div className="border border-ink-800 bg-ink-900 rounded-xl px-4 py-3 text-sm text-fog-300 leading-relaxed flex flex-wrap items-center gap-3">
          <span>{error}</span>
          <button onClick={() => { setError(null); setReloadToken((t) => t + 1) }} className="px-4 py-2 rounded-full bg-accent-500 text-ink-950 text-sm font-semibold hover:bg-accent-400">重試載入</button>
        </div>
      )}
      {!payload && !error && <p className="mono text-xs uppercase tracking-[0.2em] text-fog-500">loading {row.slug}</p>}

      {payload && (
        <>
          <Block title="申請平台與官方資訊入口" count={payload.portals.length} note="名稱與角色標籤是編輯說明；對象、費用、時程只抄頁面原文。各校共用的非政府平台要有機構官方頁鏈到它才上鏈接。">
            {payload.portals.length === 0 ? <Empty text={`${UNREAD}：這個地區本站未核到可上線的申請平台或資訊入口。`} /> : (
              <ul className="flex flex-col gap-3">{payload.portals.map((p, i) => <PortalCard key={`${p.name}-${i}`} portal={p} />)}</ul>
            )}
          </Block>

          <Block title="簽證主管機關頁" count={payload.visa.length} note="只收政府主管機關或其委託機構的官方頁；財力、語言、保險、費用、時程只抄原文。被擋者只寫主管機關名與「核查時被擋」。">
            {payload.visa.length === 0 ? <Empty text={`${UNREAD}：這個地區本站未核到簽證主管機關頁。`} /> : (
              <ul className="flex flex-col gap-3">{payload.visa.map((v, i) => <VisaCard key={`${v.category}-${i}`} visa={v} />)}</ul>
            )}
          </Block>

          <Block title="機構" count={summaries.length} note="「GRAS 前 50 學科 n 個」只描述這所機構在哪些學科排名前列，不是推薦，也不是錄取難度。展開看招生頁原文；缺的寫「官方頁未讀到」。">
            <ul className="flex flex-col gap-3">
              {ordered.map((inst) => (
                <InstitutionRow key={inst.id} inst={inst} open={openId === inst.id} onToggle={() => setOpenId(openId === inst.id ? null : inst.id)} autoScroll={institutionId === inst.id} />
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

function SourceLine({ url, live, date, prefix = '來源' }: { url: string; live: boolean; date?: string; prefix?: string }) {
  let host = url
  try { host = new URL(url).hostname } catch { /* 原樣顯示 */ }
  return (
    <p className="text-xs mono text-fog-500 break-all leading-relaxed">
      {prefix}：{live ? <a className="underline hover:text-accent-500" href={url} target="_blank" rel="noreferrer noopener">{url} ↗</a> : <span>{host}（未上鏈接）</span>}
      {date && <> · 抓取 {date}</>}
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

function PortalCard({ portal }: { portal: OverseasPortal }) {
  const hasQuotes = portal.quotes.audience.length + portal.quotes.fees.length + portal.quotes.timeline.length > 0
  return (
    <li className="border border-ink-800 bg-ink-900/78 backdrop-blur-xl rounded-xl p-4 flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h4 className="text-base text-fog-100 font-semibold leading-snug">{portal.name}</h4>
          <p className="text-xs mono text-fog-500">{portal.typeZh} · {portal.domainClassZh}{portal.domainClass === 'official-platform' && <> · {portal.corroborating} 所機構官方頁鏈到此平台</>}</p>
          <p className="text-sm text-fog-300 leading-relaxed">{portal.roleLabel}</p>
        </div>
        <StatusBadge text={portal.linkLive ? '官方頁已核' : portal.statusZh} />
      </div>
      {hasQuotes ? (
        <dl className="grid gap-2">
          <PlainQuotes label="對象" items={portal.quotes.audience} />
          <PlainQuotes label="費用" items={portal.quotes.fees} />
          <PlainQuotes label="時程" items={portal.quotes.timeline} />
        </dl>
      ) : <p className="text-xs text-fog-500">對象／費用／時程：{UNREAD}。</p>}
      {portal.linkLive && portal.url ? <SourceLine url={portal.url} live date={portal.fetchedAt} prefix="官方頁" /> : (
        <p className="text-xs mono text-fog-500 leading-relaxed break-words">官方頁本站未讀到{portal.note ? `：${portal.note}` : ''}{portal.domain ? ` · ${portal.domain}` : ''} · 核對 {portal.fetchedAt}</p>
      )}
    </li>
  )
}

function VisaCard({ visa }: { visa: OverseasVisa }) {
  const q = visa.quotes
  const hasQuotes = q.financial.length + q.language.length + q.insurance.length + q.fee.length + q.timeline.length > 0
  return (
    <li className="border border-ink-800 bg-ink-900/78 backdrop-blur-xl rounded-xl p-4 flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h4 className="text-base text-fog-100 font-semibold leading-snug">{visa.category}</h4>
          <p className="text-sm text-fog-300 leading-relaxed">{visa.authority}</p>
        </div>
        <StatusBadge text={visa.linkLive ? '官方頁已核' : visa.statusZh} />
      </div>
      {hasQuotes ? (
        <dl className="grid gap-2">
          <PlainQuotes label="財力" items={q.financial} />
          <PlainQuotes label="語言" items={q.language} />
          <PlainQuotes label="保險" items={q.insurance} />
          <PlainQuotes label="費用" items={q.fee} />
          <PlainQuotes label="時程" items={q.timeline} />
        </dl>
      ) : <p className="text-xs text-fog-500">財力／語言／保險／費用／時程：{UNREAD}。</p>}
      {visa.linkLive && visa.url ? <SourceLine url={visa.url} live date={visa.fetchedAt} prefix="官方頁" /> : (
        <p className="text-xs mono text-fog-500 leading-relaxed break-words">官方頁本站未讀到{visa.note ? `：${visa.note}` : ''}{visa.domain ? ` · ${visa.domain}` : ''} · 核對 {visa.fetchedAt}</p>
      )}
    </li>
  )
}

function institutionBadge(inst: OverseasInstitutionSummary): string {
  if (inst.linkLive) return '招生頁已核'
  if (inst.confidence === 'medium') return '另一官方網域 · 待確認'
  if (inst.status === 'blocked') return '核查時被擋'
  if (inst.status === 'needs_review') return '待人工覆核'
  return '官方頁未找到'
}

function InstitutionRow({ inst, open, onToggle, autoScroll }: { inst: OverseasInstitutionDetail; open: boolean; onToggle: () => void; autoScroll: boolean }) {
  const ref = useRef<HTMLLIElement | null>(null)
  useEffect(() => {
    if (autoScroll && ref.current) ref.current.scrollIntoView({ block: 'start' })
  }, [autoScroll])
  return (
    <li ref={ref} className="border border-ink-800 bg-ink-900/78 backdrop-blur-xl rounded-xl p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <h4 className="serif text-xl leading-snug break-words">
            {inst.nameZh ? <>{inst.nameZh} <span className="text-fog-500 text-base">· {inst.nameEn}</span></> : inst.nameEn}
          </h4>
          <p className="text-xs mono text-fog-500">GRAS 2026 前 50 學科 {inst.subjects} 個（只描述學科分佈）{inst.dataAcademicYear ? ` · 資料學年 ${inst.dataAcademicYear}` : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <StatusBadge text={institutionBadge(inst)} />
          <a className="text-xs mono text-accent-500 hover:text-accent-400" href={inst.website} target="_blank" rel="noreferrer noopener">官網 ↗</a>
          <button onClick={onToggle} aria-expanded={open} className="text-xs mono text-accent-500 hover:text-accent-400 min-h-[32px] px-1">{open ? '收起' : '招生條件'}</button>
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
  if (quotes.length === 0) return <p className="text-sm text-fog-500">{UNREAD}{emptyNote ? `（${emptyNote}）` : ''}。</p>
  return <>{quotes.map((q, i) => <Quote key={i} quote={q} />)}</>
}

function InstitutionDetail({ inst }: { inst: OverseasInstitutionDetail }) {
  const a = inst.admissions
  return (
    <dl className="flex flex-col gap-3 text-sm text-fog-300 leading-relaxed">
      <Field label="國際本科招生頁">
        {a.linkLive && a.url ? (
          <>
            <p><a className="underline text-fog-100 hover:text-accent-500 break-words" href={a.url} target="_blank" rel="noreferrer noopener">{a.title || a.url} ↗</a></p>
            <SourceLine url={a.url} live date={inst.fetchedAt} />
          </>
        ) : a.confidence === 'medium' ? (
          <>
            <p className="text-fog-100 break-words">{a.title || '（頁面標題未讀到）'}</p>
            <p className="text-xs mono text-fog-500 break-all">{a.externalDomain} · {a.note}</p>
          </>
        ) : <p>{a.note}</p>}
      </Field>

      <Field label="高考採認">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge text={inst.gaokao.policyZh} />
          <span className="text-xs text-fog-500">分類只看字樣；以下原句不改寫，請自行讀原句。</span>
        </div>
        <Quotes quotes={inst.gaokao.quotes} emptyNote="頁面未出現高考／Gaokao 字樣" />
      </Field>

      <Field label="接受的學歷資格">
        <Chips items={inst.qualifications.listed} />
        <Quotes quotes={inst.qualifications.quotes} />
      </Field>

      <Field label="英語要求">
        <Chips items={inst.english.tests} />
        {(inst.english.ielts || inst.english.toefl) && (
          <p className="text-xs text-fog-500">原句第一個分數：{inst.english.ielts ? `IELTS ${inst.english.ielts}` : ''}{inst.english.ielts && inst.english.toefl ? ' · ' : ''}{inst.english.toefl ? `TOEFL ${inst.english.toefl}` : ''}（可能是總分，也可能是單項，以原句為準）</p>
        )}
        <Quotes quotes={inst.english.quotes} />
      </Field>

      <Field label="其他語言">
        <Chips items={inst.otherLanguage.listed} />
        <Quotes quotes={inst.otherLanguage.quotes} />
      </Field>

      <Field label="國際生學費">
        {inst.tuition.quotes.length > 0 && <p className="text-xs text-fog-500">原句不區分本科／研究生，金額以原句為準。</p>}
        <Quotes quotes={inst.tuition.quotes} />
      </Field>

      <Field label="申請管道">
        <Chips items={inst.channels.listed} />
        <Quotes quotes={inst.channels.quotes} />
      </Field>

      <Field label="申請時程">
        <Quotes quotes={inst.timeline.quotes} />
      </Field>

      <Field label="資料學年">
        <p>{inst.dataAcademicYear ?? `${UNREAD}。`}</p>
      </Field>

      <Field label="來源與抓取日">
        <p className="text-xs mono text-fog-500">抓取 {inst.fetchedAt} · 嘗試讀取 {inst.pagesFetched} 頁 · 官方頁狀態：{a.statusZh}{a.confidence ? `（${a.confidence === 'high' ? '同官網網域' : '另一官方網域'}）` : ''}</p>
        {inst.sources.length === 0 ? <p className="text-sm text-fog-500">{UNREAD}。</p> : (
          <ul className="flex flex-col gap-1">
            {inst.sources.map((s) => (
              <li key={s.url} className="text-xs mono text-fog-500 break-all leading-relaxed">
                {s.live ? <a className="underline hover:text-accent-500" href={s.url} target="_blank" rel="noreferrer noopener">{s.url} ↗</a> : <span>{hostOf(s.url)}（未上鏈接）</span>}
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
  const unread = institutions.filter((i) => i.status !== 'verified')
  const medium = institutions.filter((i) => i.confidence === 'medium')
  if (unread.length === 0 && medium.length === 0) return null
  const name = (i: OverseasInstitutionSummary) => i.nameZh ?? i.nameEn
  return (
    <div className="border border-ink-800 bg-ink-900 rounded-xl px-4 py-3 text-xs text-fog-500 leading-relaxed flex flex-col gap-1">
      {unread.length > 0 && <p>另有 {unread.length} 所機構的官方頁本站讀不到（對聲明身分的爬蟲回驗證頁、robots 不允許、純 JavaScript 或未找到對應頁），按規則不上線招生頁鏈接、待人工覆核：{unread.map(name).join('、')}。</p>}
      {medium.length > 0 && <p>{medium.length} 所機構的招生頁在學校另一官方網域，待人工確認後才上鏈接：{medium.map(name).join('、')}。</p>}
    </div>
  )
}
