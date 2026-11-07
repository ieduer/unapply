import { useEffect, useMemo, useState } from 'react'
import type { HkMoTwChannel, HkMoTwInstitution, HkMoTwPoolPayload, HkMoTwRegion } from '../data/hkmotwTypes'
import { loadHkMoTwPool } from '../lib/hkmotwData'
import { getOriginOption, type OriginRegion } from '../data/origins'
import type { OriginPrefs } from '../data/originBranch'
import { MainlandChannels } from './MainlandChannels'
import { useLocale } from '../i18n/react'
import { Rich } from '../i18n/rich'
import { LocaleSwitcher } from './LocaleSwitcher'

interface Props {
  origin: OriginRegion | null
  originPrefs: OriginPrefs
  onBack: () => void
  onAbout: () => void
  onWorld: () => void
  onStartMainland: () => void
}

const ORIGIN_REGION: Partial<Record<OriginRegion, HkMoTwRegion>> = { hk: 'HK', mo: 'MO', tw: 'TW' }

/**
 * 港澳臺院校池（路線圖 S2 後半）。只列官方來源核查通過的機構與招生管道；它不是題庫、不排除任何學校，
 * 所在地只決定先看哪個地區，大陸起點的用戶也能跨區來看（跨國規則）。
 * 院校名、地區名、管道與條件文字是 payload 的官方原文（正體），不翻譯、不轉字形；介面文案走 ui.hkmotw.*。
 */
export function HkMoTwPage({ origin, originPrefs, onBack, onAbout, onWorld, onStartMainland }: Props) {
  const { t } = useLocale()
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
          <p className="mono text-xs text-fog-500 uppercase tracking-[0.2em]">{t('ui.hkmotw.kicker')}</p>
          <h1 className="serif text-2xl">{t('ui.hkmotw.loadFailed')}</h1>
          <p className="text-sm text-fog-500 leading-relaxed">{loadError}</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => { setLoadError(null); setReloadToken((t) => t + 1) }} className="px-5 py-3 rounded-full bg-accent-500 text-ink-950 text-sm font-semibold hover:bg-accent-400">{t('ui.common.retryLoad')}</button>
            <button onClick={onBack} className="px-5 py-3 rounded-full border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500">{t('ui.common.backHome')}</button>
          </div>
        </section>
      </main>
    )
  }
  if (!payload) {
    return (
      <main className="min-h-screen app-canvas text-fog-100 flex items-center justify-center px-5">
        <p className="mono text-xs uppercase tracking-[0.2em] text-fog-500">{t('ui.hkmotw.loading')}</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen app-canvas text-fog-100">
      <header className="border-b border-ink-800 bg-ink-900/70 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3 text-xs mono uppercase tracking-[0.2em] text-fog-500">
          <button onClick={onBack} className="hover:text-accent-500 min-h-[44px] -my-3 py-3">{t('ui.hkmotw.backHome')}</button>
          <span className="hidden sm:inline">{t('ui.hkmotw.brand', { version: payload.version })}</span>
          <div className="flex items-center gap-2 sm:gap-3">
            <LocaleSwitcher />
            <button onClick={onAbout} className="hover:text-accent-500 min-h-[44px] -my-3 py-3">{t('ui.common.about')}</button>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-24 flex flex-col gap-8">
        <div className="max-w-3xl flex flex-col gap-3">
          <p className="mono text-xs uppercase tracking-[0.28em] text-accent-500">{t('ui.hkmotw.stepKicker')}</p>
          <h1 className="serif text-3xl sm:text-5xl leading-tight">{t('ui.hkmotw.title')}</h1>
          <p className="text-sm sm:text-base text-fog-300 leading-relaxed">
            <Rich k="ui.hkmotw.lede" />
          </p>
          {originOption && !originOption.hasLocalPool && ORIGIN_REGION[origin!] && (
            <div className="border border-ink-800 bg-ink-900 rounded-xl px-4 py-3 text-sm text-fog-300 leading-relaxed">
              <Rich
                k="ui.hkmotw.originNote"
                params={{ origin: t(`origin.${originOption.id}.label`) }}
                slots={{
                  a1: (children) => <button onClick={onWorld} className="underline hover:text-accent-500">{children}</button>,
                  a2: (children) => <button onClick={onStartMainland} className="underline hover:text-accent-500">{children}</button>,
                }}
              />
              {originPrefs.qualification && <p className="mt-1 text-xs mono text-fog-500">{t('ui.overseas.qual.selector')}{t('ui.common.colon')}{t(`origin.qual.${originPrefs.qualification}.label`)}</p>}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label={t('ui.hkmotw.regionGroupAria')}>
          {(['all', ...payload.regions.map((r) => r.code)] as (HkMoTwRegion | 'all')[]).map((code) => {
            const active = region === code
            const label = code === 'all' ? t('ui.hkmotw.regionAll', { n: payload.institutions.length }) : t('ui.hkmotw.regionCount', { region: payload.regions.find((r) => r.code === code)?.nameZh ?? code, n: counts.get(code) ?? 0 })
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
                    {inst.atlasId && <> · <button onClick={onWorld} className="underline hover:text-accent-500">{t('ui.hkmotw.onAtlas')}</button></>}
                  </p>
                </div>
                <a className="text-xs mono text-accent-500 hover:text-accent-400 break-all" href={inst.website} target="_blank" rel="noreferrer noopener">{t('ui.hkmotw.website')}</a>
              </div>
              {inst.channels.length === 0 ? (
                <p className="text-sm text-fog-500">{t('ui.hkmotw.noChannels')}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {inst.channels.map((channel, index) => (
                    <ChannelRow key={`${inst.id}-${index}`} channel={channel} open={openId === `${inst.id}-${index}`} onToggle={() => setOpenId(openId === `${inst.id}-${index}` ? null : `${inst.id}-${index}`)} />
                  ))}
                </ul>
              )}
              {inst.notes && <p className="text-xs text-fog-500 leading-relaxed">{inst.notes}</p>}
              <p className="text-xs mono text-fog-500 break-all">{t('ui.hkmotw.listSource')}<a className="hover:text-accent-500 underline" href={inst.listSource.url} target="_blank" rel="noreferrer noopener">{inst.listSource.title}</a> · {inst.listSource.date}</p>
            </li>
          ))}
        </ul>

        <ReviewNote payload={payload} />

        {(origin === 'hk' || origin === 'mo' || origin === 'tw') && <MainlandChannels region={origin} />}

        <footer className="pt-6 border-t border-ink-800 text-xs mono text-fog-500 leading-relaxed">
          <p>{t('ui.hkmotw.footer.rule')}</p>
          <p>
            <Rich
              k="ui.hkmotw.footer.links"
              params={{ date: payload.generatedAt }}
              slots={{
                a1: (children) => <button onClick={onAbout} className="hover:text-accent-500 underline">{children}</button>,
                a2: (children) => <button onClick={onWorld} className="hover:text-accent-500 underline">{children}</button>,
              }}
            />
          </p>
        </footer>
      </section>
    </main>
  )
}

function ChannelRow({ channel, open, onToggle }: { channel: HkMoTwChannel; open: boolean; onToggle: () => void }) {
  const { t } = useLocale()
  const c = channel.conditions
  const hasDetails = Boolean(c.score || c.english || c.tuition || c.applicationWindow || channel.notes)
  return (
    <li className="border border-ink-800 bg-ink-950 rounded-lg px-3 py-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="text-fog-100 font-semibold">{channel.audienceZh}</span>
        <span className="text-fog-300">{channel.channelZh}</span>
        <span className="text-xs mono text-fog-500">{channel.level}{channel.validFor ? ` · ${channel.validFor}` : t('ui.hkmotw.channel.yearMissing')}</span>
        {hasDetails && (
          <button onClick={onToggle} aria-expanded={open} className="ml-auto text-xs mono text-accent-500 hover:text-accent-400 min-h-[32px]">
            {open ? t('ui.hkmotw.channel.collapse') : t('ui.hkmotw.channel.expand')}
          </button>
        )}
      </div>
      {open && hasDetails && (
        <dl className="grid gap-2 text-sm text-fog-300 leading-relaxed">
          {c.score && <Row label={t('ui.hkmotw.channel.score')}>{c.score}</Row>}
          {c.english && <Row label={t('ui.hkmotw.channel.english')}>{c.english}</Row>}
          {c.tuition && <Row label={t('ui.hkmotw.channel.tuition')}>{c.tuition}</Row>}
          {c.applicationWindow && <Row label={t('ui.hkmotw.channel.window')}>{c.applicationWindow}</Row>}
          {channel.notes && <Row label={t('ui.hkmotw.channel.notes')}>{channel.notes}</Row>}
        </dl>
      )}
      <p className="text-xs mono text-fog-500 break-all">
        {t('ui.hkmotw.channel.source')}<a className="hover:text-accent-500 underline" href={channel.source.url} target="_blank" rel="noreferrer noopener">{channel.source.title}</a> · {t('ui.hkmotw.channel.read', { date: channel.source.date })} · {t('ui.hkmotw.channel.verified', { date: channel.source.verifiedAt })}
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
  const { t } = useLocale()
  const { institutions, channels } = payload.reviewRequired
  if (institutions.length === 0 && channels.length === 0) return null
  const nameById = new Map(payload.institutions.map((i) => [i.id, i.nameZh]))
  const names = [...institutions.map((i) => i.nameZh), ...channels.map((c) => nameById.get(c.institutionId) ?? c.institutionId)]
  return (
    <div className="border border-ink-800 bg-ink-900 rounded-xl px-4 py-3 text-xs text-fog-500 leading-relaxed">
      {t('ui.hkmotw.review', { institutions: institutions.length, channels: channels.length, names: names.join(t('ui.common.listJoiner')) })}
    </div>
  )
}

export type { HkMoTwInstitution }
