import { useEffect, useMemo, useState } from 'react'
import type { HkMoTwChannel, HkMoTwInstitution, HkMoTwPoolPayload, HkMoTwRegion } from '../data/hkmotwTypes'
import { loadHkMoTwPool } from '../lib/hkmotwData'
import { getOriginOption, type OriginRegion } from '../data/origins'

interface Props {
  origin: OriginRegion | null
  onBack: () => void
  onAbout: () => void
  onWorld: () => void
  onStartMainland: () => void
}

const ORIGIN_REGION: Partial<Record<OriginRegion, HkMoTwRegion>> = { hk: 'HK', mo: 'MO', tw: 'TW' }

/**
 * 港澳臺院校池（路線圖 S2 後半）。只列官方來源核查通過的機構與招生管道；它不是題庫、不排除任何學校，
 * 所在地只決定先看哪個地區，大陸起點的用戶也能跨區來看（跨國規則）。
 */
export function HkMoTwPage({ origin, onBack, onAbout, onWorld, onStartMainland }: Props) {
  const [payload, setPayload] = useState<HkMoTwPoolPayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [region, setRegion] = useState<HkMoTwRegion | 'all'>(() => (origin && ORIGIN_REGION[origin]) ?? 'all')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    loadHkMoTwPool()
      .then((loaded) => { if (alive) setPayload(loaded) })
      .catch((error: unknown) => { if (alive) setLoadError(error instanceof Error ? error.message : String(error)) })
    return () => { alive = false }
  }, [reloadToken])

  const originOption = origin ? getOriginOption(origin) : null
  const shown = useMemo(() => (payload ? payload.institutions.filter((i) => region === 'all' || i.region === region) : []), [payload, region])
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const inst of payload?.institutions ?? []) map.set(inst.region, (map.get(inst.region) ?? 0) + 1)
    return map
  }, [payload])

  if (loadError) {
    return (
      <main className="min-h-screen app-canvas text-fog-100 flex items-center justify-center px-5">
        <section className="w-full max-w-md border border-ink-800 bg-ink-900 rounded-xl p-6 flex flex-col gap-4">
          <p className="mono text-xs text-fog-500 uppercase tracking-[0.2em]">hk · mo · tw</p>
          <h1 className="serif text-2xl">院校池載入失敗</h1>
          <p className="text-sm text-fog-500 leading-relaxed">{loadError}</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => { setLoadError(null); setReloadToken((t) => t + 1) }} className="px-5 py-3 rounded-full bg-accent-500 text-ink-950 text-sm font-semibold hover:bg-accent-400">重試載入</button>
            <button onClick={onBack} className="px-5 py-3 rounded-full border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500">返回首頁</button>
          </div>
        </section>
      </main>
    )
  }
  if (!payload) {
    return (
      <main className="min-h-screen app-canvas text-fog-100 flex items-center justify-center px-5">
        <p className="mono text-xs uppercase tracking-[0.2em] text-fog-500">loading hk · mo · tw pool</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen app-canvas text-fog-100">
      <header className="border-b border-ink-800 bg-ink-900/70 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between text-xs mono uppercase tracking-[0.2em] text-fog-500">
          <button onClick={onBack} className="hover:text-accent-500 min-h-[44px] -my-3 py-3">← 回首頁</button>
          <span className="hidden sm:inline">nope.bdfz.net · 港澳臺院校池 · {payload.version}</span>
          <button onClick={onAbout} className="hover:text-accent-500 min-h-[44px] -my-3 py-3">about</button>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-24 flex flex-col gap-8">
        <div className="max-w-3xl flex flex-col gap-3">
          <p className="mono text-xs uppercase tracking-[0.28em] text-accent-500">跨區可選池 · 港澳臺</p>
          <h1 className="serif text-3xl sm:text-5xl leading-tight">香港、澳門、臺灣的院校，怎麼招內地與港澳學生？</h1>
          <p className="text-sm sm:text-base text-fog-300 leading-relaxed">
            這一頁只列<b className="text-fog-100">官方來源核查通過</b>的院校與招生管道：每條都帶來源網址、來源網域與機構一致、實際連通與核對日。
            它不是題庫、不替你劃掉任何學校；所在地只決定先看哪個地區，之後可以跨區看。條件與學費以各院校當年公布為準，缺的保持未知。
          </p>
          {originOption && !originOption.hasLocalPool && ORIGIN_REGION[origin!] && (
            <div className="border border-ink-800 bg-ink-900 rounded-xl px-4 py-3 text-sm text-fog-300 leading-relaxed">
              你選的起點是 <b className="text-fog-100">{originOption.label}</b>：本地的學校減法題庫還在建設中（路線圖 S4）；先看這裡的院校與管道，
              也可以 <button onClick={onWorld} className="underline hover:text-accent-500">看全球學科地圖</button> 或 <button onClick={onStartMainland} className="underline hover:text-accent-500">進中國大陸題庫</button>。
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="地區">
          {(['all', ...payload.regions.map((r) => r.code)] as (HkMoTwRegion | 'all')[]).map((code) => {
            const active = region === code
            const label = code === 'all' ? `全部 ${payload.institutions.length}` : `${payload.regions.find((r) => r.code === code)?.nameZh} ${counts.get(code) ?? 0}`
            return (
              <button
                key={code}
                onClick={() => setRegion(code)}
                aria-pressed={active}
                className={['px-4 min-h-[40px] rounded-full border', active ? 'border-accent-500 bg-accent-500/10 text-fog-100' : 'border-ink-700 bg-ink-950 text-fog-300 hover:border-fog-500 hover:text-fog-100'].join(' ')}
              >
                {label}
              </button>
            )
          })}
        </div>

        <ul className="flex flex-col gap-3">
          {shown.map((inst) => (
            <li key={inst.id} className="border border-ink-800 bg-ink-900/78 backdrop-blur-xl rounded-xl p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <h2 className="serif text-xl leading-snug">
                    {inst.nameZh} <span className="text-fog-500 text-base">· {inst.nameEn}</span>
                  </h2>
                  <p className="text-xs mono text-fog-500">
                    {inst.regionZh} · {inst.kindZh}
                    {inst.atlasId && <> · <button onClick={onWorld} className="underline hover:text-accent-500">在全球學科地圖上</button></>}
                  </p>
                </div>
                <a className="text-xs mono text-accent-500 hover:text-accent-400 break-all" href={inst.website} target="_blank" rel="noreferrer noopener">官網 ↗</a>
              </div>
              {inst.channels.length === 0 ? (
                <p className="text-sm text-fog-500">官方名單內的院校；面向內地或港澳學生的招生管道尚未核查到官方頁，保持未知。</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {inst.channels.map((channel, index) => (
                    <ChannelRow key={`${inst.id}-${index}`} channel={channel} open={openId === `${inst.id}-${index}`} onToggle={() => setOpenId(openId === `${inst.id}-${index}` ? null : `${inst.id}-${index}`)} />
                  ))}
                </ul>
              )}
              {inst.notes && <p className="text-xs text-fog-500 leading-relaxed">{inst.notes}</p>}
              <p className="text-xs mono text-fog-500 break-all">名單來源：<a className="hover:text-accent-500 underline" href={inst.listSource.url} target="_blank" rel="noreferrer noopener">{inst.listSource.title}</a> · {inst.listSource.date}</p>
            </li>
          ))}
        </ul>

        <ReviewNote payload={payload} />

        <footer className="pt-6 border-t border-ink-800 text-xs mono text-fog-500 leading-relaxed">
          <p>只收官方來源，核查不過的不上線；排名不是推薦，管道不是錄取保證。</p>
          <p>資料日 {payload.generatedAt} · 了解 <button onClick={onAbout} className="hover:text-accent-500 underline">數據來源與方法論</button> · 看 <button onClick={onWorld} className="hover:text-accent-500 underline">全球學科地圖</button></p>
        </footer>
      </section>
    </main>
  )
}

function ChannelRow({ channel, open, onToggle }: { channel: HkMoTwChannel; open: boolean; onToggle: () => void }) {
  const c = channel.conditions
  const hasDetails = Boolean(c.score || c.english || c.tuition || c.applicationWindow || channel.notes)
  return (
    <li className="border border-ink-800 bg-ink-950 rounded-lg px-3 py-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="text-fog-100 font-semibold">{channel.audienceZh}</span>
        <span className="text-fog-300">{channel.channelZh}</span>
        <span className="text-xs mono text-fog-500">{channel.level}{channel.validFor ? ` · ${channel.validFor}` : ' · 年度未標示'}</span>
        {hasDetails && (
          <button onClick={onToggle} aria-expanded={open} className="ml-auto text-xs mono text-accent-500 hover:text-accent-400 min-h-[32px]">
            {open ? '收起' : '條件與學費'}
          </button>
        )}
      </div>
      {open && hasDetails && (
        <dl className="grid gap-2 text-sm text-fog-300 leading-relaxed">
          {c.score && <Row label="成績／報考方式">{c.score}</Row>}
          {c.english && <Row label="英語">{c.english}</Row>}
          {c.tuition && <Row label="學費">{c.tuition}</Row>}
          {c.applicationWindow && <Row label="時程">{c.applicationWindow}</Row>}
          {channel.notes && <Row label="備註">{channel.notes}</Row>}
        </dl>
      )}
      <p className="text-xs mono text-fog-500 break-all">
        來源：<a className="hover:text-accent-500 underline" href={channel.source.url} target="_blank" rel="noreferrer noopener">{channel.source.title}</a> · 讀取 {channel.source.date} · 核對 {channel.source.verifiedAt}
      </p>
    </li>
  )
}

function Row({ label, children }: { label: string; children: string }) {
  return (
    <div className="grid sm:grid-cols-[7rem_1fr] gap-1 sm:gap-3">
      <dt className="text-xs mono uppercase tracking-[0.16em] text-fog-500 pt-0.5">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function ReviewNote({ payload }: { payload: HkMoTwPoolPayload }) {
  const { institutions, channels } = payload.reviewRequired
  if (institutions.length === 0 && channels.length === 0) return null
  const nameById = new Map(payload.institutions.map((i) => [i.id, i.nameZh]))
  const names = [...institutions.map((i) => i.nameZh), ...channels.map((c) => nameById.get(c.institutionId) ?? c.institutionId)]
  return (
    <div className="border border-ink-800 bg-ink-900 rounded-xl px-4 py-3 text-xs text-fog-500 leading-relaxed">
      另有 {institutions.length} 所院校、{channels.length} 條管道的官方頁本站讀不到或核不過（例如只以 JavaScript 載入、或對腳本回驗證頁），按規則不上線、待人工覆核：
      {' '}{names.join('、')}。
    </div>
  )
}

export type { HkMoTwInstitution }
