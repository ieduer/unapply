import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { HkMoTwInstitution, HkMoTwPoolPayload } from '../data/hkmotwTypes'
import type { OverseasIndexPayload, OverseasInstitutionSummary } from '../data/overseasTypes'
import type { WorldAtlasPayload } from '../data/worldAtlasTypes'
import { getOriginOption, type OriginRegion } from '../data/origins'
import { qualificationTokens, type OriginPrefs } from '../data/originBranch'
import {
  CHANNEL_AUDIENCES,
  GLOBAL_POOLS,
  GLOBAL_STORAGE_KEY,
  HKMOTW_REGION_CODE,
  audienceForOrigin,
  buildGlobalPool,
  computeGlobal,
  decodeGlobalSelection,
  defaultPools,
  emptyGlobalSelection,
  encodeGlobalSelection,
  globalOptions,
  normalizeGlobalSelection,
  qualificationMark,
  type GlobalPool,
  type GlobalPoolItem,
  type GlobalReason,
  type GlobalSelection,
} from '../engine/globalFilter'
import { loadHkMoTwPool } from '../lib/hkmotwData'
import { loadOverseasIndex } from '../lib/overseasData'
import { loadWorldAtlas } from '../lib/atlasData'
import { loadQualificationsIndex, type QualificationsPayload } from '../lib/originLayer'
import { generateShareImage } from '../lib/share'
import { useLocale } from '../i18n/react'
import type { Locale } from '../i18n/core'
import { Rich } from '../i18n/rich'
import { LocaleSwitcher } from './LocaleSwitcher'

interface Props {
  origin: OriginRegion | null
  originPrefs: OriginPrefs
  onBack: () => void
  onAbout: () => void
  onWorld: () => void
  onHkMoTw: () => void
  onOverseas: (region?: string, inst?: string) => void
}

interface Loaded { overseas: OverseasIndexPayload; hkmotw: HkMoTwPoolPayload; atlas: WorldAtlasPayload }

const KEPT_PAGE = 60

/** 存的選擇綁定起點：換了起點（池的預設跟著變）就回到預設，不沿用別的起點留下的選擇。 */
function readStored(origin: OriginRegion | null): Partial<GlobalSelection> | null {
  try {
    const raw = window.localStorage.getItem(GLOBAL_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { v?: number; origin?: string | null; selection?: Partial<GlobalSelection> }
    return parsed?.v === 1 && (parsed.origin ?? null) === origin ? parsed.selection ?? null : null
  } catch {
    return null
  }
}

function saveStored(selection: GlobalSelection | null, origin: OriginRegion | null) {
  try {
    if (!selection) window.localStorage.removeItem(GLOBAL_STORAGE_KEY)
    else window.localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify({ v: 1, origin, selection }))
  } catch {
    // 存不下就算了，本次會話仍然生效
  }
}

/** 分享鏈接裡的查詢串（#/global?…）；沒有就回空字串。 */
function shareQueryFromHash(): string {
  const hash = window.location.hash
  const i = hash.indexOf('?')
  return i === -1 ? '' : hash.slice(i + 1)
}

const toggle = <T extends string>(list: readonly T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

/**
 * 全球池減法（路線圖 S4 完成定義，批 G2）。展示層：池＝海外可申請學校層＋港澳臺院校池；題目全部可跳過、只用已入庫的官方或權威資料；
 * 劃掉的每一所都有逐條原因（題目＋規則＋該校取值）；資格只標示不劃掉；取值未知永不劃掉。
 * 選擇只存 localStorage（unapply.globalSubtraction.v1），不進 AnswerMap、不進 A+ 學習證據、不送 Function；分享只含選項鍵。
 */
export function GlobalSubtraction({ origin, originPrefs, onBack, onAbout, onWorld, onHkMoTw, onOverseas }: Props) {
  const { t, locale, n } = useLocale()
  const [data, setData] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  // 使用者改過的選擇；null＝沿用初始（分享鏈接 > 已存 > 依起點預設）
  const [edited, setEdited] = useState<GlobalSelection | null>(null)
  const [sharedDismissed, setSharedDismissed] = useState(false)
  const [shareQuery] = useState(() => shareQueryFromHash())
  const [qualPayload, setQualPayload] = useState<QualificationsPayload | null>(null)
  const [showSubjects, setShowSubjects] = useState(false)
  const [keptLimit, setKeptLimit] = useState(KEPT_PAGE)
  const [copied, setCopied] = useState(false)
  const shareRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    Promise.all([loadOverseasIndex(), loadHkMoTwPool(), loadWorldAtlas()])
      .then(([overseas, hkmotw, atlas]) => { if (alive) setData({ overseas, hkmotw, atlas }) })
      .catch((error: unknown) => { if (alive) setLoadError(error instanceof Error ? error.message : String(error)) })
    return () => { alive = false }
  }, [reloadToken])

  const { tokens, gaokao } = qualificationTokens(origin, originPrefs)
  const tokenKey = tokens.join('|')
  const needQual = tokens.length > 0 || gaokao
  useEffect(() => {
    if (!needQual || qualPayload) return
    let alive = true
    loadQualificationsIndex()
      .then((payload) => { if (alive) setQualPayload(payload) })
      .catch(() => { /* 載不到就不標示，資格本來就不劃掉 */ })
    return () => { alive = false }
  }, [needQual, qualPayload])
  const qualHits = useMemo(() => {
    if (!needQual || !qualPayload) return null
    const hit = new Set<string>()
    for (const token of tokenKey.split('|').filter(Boolean)) for (const id of qualPayload.tokens[token] ?? []) hit.add(id)
    if (gaokao) for (const id of qualPayload.gaokaoAccepted) hit.add(id)
    return hit
  }, [needQual, qualPayload, tokenKey, gaokao])

  const items = useMemo(() => (data ? buildGlobalPool(data.overseas, data.hkmotw, data.atlas) : []), [data])
  const familyOf = useMemo(() => new Map((data?.atlas.subjects ?? []).map((s) => [s.code, s.family])), [data])
  const fallbackPools = useMemo(() => defaultPools(origin, originPrefs.scope), [origin, originPrefs.scope])
  const allOptions = useMemo(() => (data ? globalOptions(items, GLOBAL_POOLS, data.atlas) : null), [data, items])

  // 初始選擇：分享鏈接 > 已存 > 依起點預設（由資料與起點推出，不在 effect 裡 setState）
  const initial = useMemo(() => {
    if (!data || !allOptions) return null
    const shared = decodeGlobalSelection(shareQuery, allOptions, familyOf)
    if (shared) return { selection: shared, shared: true }
    return { selection: normalizeGlobalSelection(readStored(origin) ?? { pools: fallbackPools }, allOptions, familyOf, fallbackPools), shared: false }
  }, [data, allOptions, familyOf, fallbackPools, shareQuery, origin])
  const selection = edited ?? initial?.selection ?? null
  const sharedLoaded = Boolean(initial?.shared) && !sharedDismissed && !edited
  useEffect(() => {
    // 分享鏈接載入後：存成自己的選擇並把網址收回 #/global（只含選項鍵，存著也無害）
    if (!initial?.shared) return
    saveStored(initial.selection, origin)
    try { window.history.replaceState(null, '', '#/global') } catch { /* 留著查詢串也無害 */ }
  }, [initial, origin])

  const update = useCallback((next: Partial<GlobalSelection>) => {
    if (!allOptions || !selection) return
    const normalized = normalizeGlobalSelection({ ...selection, ...next }, allOptions, familyOf, selection.pools)
    setEdited(normalized)
    saveStored(normalized, origin)
    setKeptLimit(KEPT_PAGE)
  }, [allOptions, familyOf, selection, origin])

  const redo = () => {
    if (!allOptions) return
    const fresh = normalizeGlobalSelection(emptyGlobalSelection(fallbackPools), allOptions, familyOf, fallbackPools)
    setEdited(fresh)
    saveStored(null, origin)
    setSharedDismissed(true)
    setKeptLimit(KEPT_PAGE)
  }

  const userAudience = audienceForOrigin(origin)
  const result = useMemo(() => (selection ? computeGlobal(items, selection, { familyOf, userAudience }) : null), [items, selection, familyOf, userAudience])
  const activeOptions = useMemo(() => (data && selection ? globalOptions(items, selection.pools, data.atlas) : null), [data, items, selection])
  // 展示順序：你所在地區的機構在前；港澳臺起點院校池在前，其餘海外層在前；同組保持資料原序
  const keptSorted = useMemo(() => {
    if (!result) return []
    const local = origin === 'hk' ? HKMOTW_REGION_CODE.HK : origin === 'mo' ? HKMOTW_REGION_CODE.MO : origin === 'tw' ? HKMOTW_REGION_CODE.TW : null
    const poolRank = (pool: GlobalPool) => (local ? (pool === 'hkmotw' ? 0 : 1) : (pool === 'overseas' ? 0 : 1))
    return result.kept.map((k, i) => ({ k, i })).sort((a, b) => Number(a.k.item.region !== local) - Number(b.k.item.region !== local) || poolRank(a.k.item.pool) - poolRank(b.k.item.pool) || a.i - b.i).map(({ k }) => k)
  }, [result, origin])

  const overseasById = useMemo(() => new Map((data?.overseas.institutions ?? []).map((i) => [i.id, i])), [data])
  const hkmotwById = useMemo(() => new Map((data?.hkmotw.institutions ?? []).map((i) => [i.id, i])), [data])
  const regionRows = useMemo(() => new Map((data?.overseas.regions ?? []).map((r) => [r.code, r])), [data])
  const subjectByCode = useMemo(() => new Map((data?.atlas.subjects ?? []).map((s) => [s.code, s])), [data])
  const familyByCode = useMemo(() => new Map((data?.atlas.families ?? []).map((f) => [f.code, f])), [data])

  const regionLabel = (code: string) => { const row = regionRows.get(code); return locale === 'en' || !row ? code : row.nameZh }
  const subjectLabel = (code: string) => { const s = subjectByCode.get(code); if (!s) return code; return locale === 'en' ? s.nameEn : locale === 'zh-Hans' ? s.nameZhHans || s.nameZh : s.nameZh }
  const familyLabel = (code: string) => { const f = familyByCode.get(code); if (!f) return code; return locale === 'en' ? f.nameEn : f.nameZh }
  const joiner = t('ui.common.listJoiner')

  if (loadError) {
    return (
      <main className="min-h-screen app-canvas text-fog-100 flex items-center justify-center px-5">
        <section className="w-full max-w-md border border-ink-800 bg-ink-900 rounded-xl p-6 flex flex-col gap-4">
          <p className="mono text-xs text-fog-500 uppercase tracking-[0.2em]">{t('ui.global.kicker')}</p>
          <h1 className="serif text-2xl">{t('ui.global.loadFailed')}</h1>
          <p className="text-sm text-fog-500 leading-relaxed">{loadError}</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => { setLoadError(null); setReloadToken((v) => v + 1) }} className="px-5 py-3 rounded-full bg-accent-500 text-ink-950 text-sm font-semibold hover:bg-accent-400">{t('ui.common.retryLoad')}</button>
            <button onClick={onBack} className="px-5 py-3 rounded-full border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500">{t('ui.common.backHome')}</button>
          </div>
        </section>
      </main>
    )
  }
  if (!data || !selection || !result || !activeOptions) {
    return (
      <main className="min-h-screen app-canvas text-fog-100 flex items-center justify-center px-5">
        <p className="mono text-xs uppercase tracking-[0.2em] text-fog-500">{t('ui.global.loading')}</p>
      </main>
    )
  }

  const originOption = origin ? getOriginOption(origin) : null
  const poolTotals: Record<GlobalPool, number> = { overseas: data.overseas.institutions.length, hkmotw: data.hkmotw.institutions.length }
  const includesHkMoTw = selection.pools.includes('hkmotw')
  const includesOverseas = selection.pools.includes('overseas')
  const struckFamilies = new Set(selection.struckFamilies)
  const shareUrl = `${window.location.origin}${window.location.pathname}#/global${(() => { const q = encodeGlobalSelection(selection); return q ? `?${q}` : '' })()}`
  const qualificationLabel = origin === 'cn-mainland' ? t('ui.overseas.qual.gaokaoOption') : originPrefs.qualification ? t(`origin.qual.${originPrefs.qualification}.label`) : ''
  const platformRegions = includesOverseas ? activeOptions.regions.filter((code) => (regionRows.get(code)?.portalsLive ?? 0) > 0 && !selection.struckRegions.includes(code)) : []

  const reasonText = (reason: GlobalReason): string => {
    const question = t(`ui.global.q.${reason.question}.title`)
    const rule = t(`ui.global.reason.rule.${reason.rule}`)
    let value = ''
    if (reason.question === 'regions') value = regionLabel(reason.region)
    else if (reason.question === 'families') value = t('ui.global.reason.value.families', { families: reason.families.map(familyLabel).join(joiner), subjects: reason.subjects.map(subjectLabel).join(joiner) })
    else if (reason.question === 'wanted') value = t('ui.global.reason.value.wanted', { subjects: reason.subjects.map(subjectLabel).join(joiner), wanted: reason.wanted.map(subjectLabel).join(joiner) })
    else value = reason.audiences.map((a) => t(`ui.global.audience.${a}`)).join(joiner)
    return t('ui.global.reason.line', { question, rule, value })
  }

  const copyShare = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 2000) } catch { setCopied(false) }
  }
  const downloadShare = async () => {
    if (!shareRef.current) return
    await generateShareImage(shareRef.current, `unapply-global-${Date.now()}.png`)
  }

  const chip = (active: boolean, struckStyle: boolean) => [
    'px-3 min-h-[40px] rounded-full border text-sm text-left',
    active
      ? struckStyle ? 'border-accent-500 bg-accent-500/10 text-fog-100 line-through decoration-accent-500' : 'border-accent-500 bg-accent-500/10 text-fog-100'
      : 'border-ink-700 bg-ink-950 text-fog-300 hover:border-fog-500 hover:text-fog-100',
  ].join(' ')

  return (
    <main className="min-h-screen app-canvas text-fog-100">
      <header className="border-b border-ink-800 bg-ink-900/70 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3 text-xs mono uppercase tracking-[0.2em] text-fog-500">
          <button onClick={onBack} className="hover:text-accent-500 min-h-[44px] -my-3 py-3">{t('ui.global.backHome')}</button>
          <span className="hidden sm:inline">{t('ui.global.brand')}</span>
          <div className="flex items-center gap-2 sm:gap-3">
            <LocaleSwitcher />
            <button onClick={onAbout} className="hover:text-accent-500 min-h-[44px] -my-3 py-3">{t('ui.common.about')}</button>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-24 flex flex-col gap-8" data-global-page>
        <div className="max-w-3xl flex flex-col gap-3">
          <p className="mono text-xs uppercase tracking-[0.28em] text-accent-500">{t('ui.global.kicker')}</p>
          <h1 className="serif text-3xl sm:text-5xl leading-tight">{t('ui.global.title')}</h1>
          <p className="text-sm sm:text-base text-fog-300 leading-relaxed">{t('ui.global.lede')}</p>
          {originOption && <p className="text-xs mono text-fog-500">{t('ui.global.origin', { origin: t(`origin.${originOption.id}.label`) })}{qualificationLabel ? ` · ${t('ui.overseas.qual.selector')}${t('ui.common.colon')}${qualificationLabel}` : ''}</p>}
          {sharedLoaded && <p className="text-sm text-fog-100 border border-accent-500/40 bg-accent-500/10 rounded-xl px-4 py-3" data-global-shared>{t('ui.global.share.loaded')}</p>}
        </div>

        <div className="px-4 sm:px-5 py-3 border border-ink-800 bg-ink-900 rounded-xl flex flex-wrap items-center justify-between gap-3" data-global-counts={`${result.counts.kept}/${result.counts.pool}`}>
          <p className="text-sm sm:text-base text-fog-100"><Rich k="ui.global.counts" params={{ kept: n(result.counts.kept), pool: n(result.counts.pool), crossed: n(result.counts.crossed) }} /></p>
          <p className="text-xs mono text-fog-500">{t('ui.global.countsByPool', { overseas: n(result.counts.keptByPool.overseas), overseasTotal: n(includesOverseas ? poolTotals.overseas : 0), hkmotw: n(result.counts.keptByPool.hkmotw), hkmotwTotal: n(includesHkMoTw ? poolTotals.hkmotw : 0) })}</p>
          <button onClick={redo} className="px-4 min-h-[40px] rounded-full border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500" data-global-redo>{t('ui.global.redo')}</button>
        </div>

        <Block title={t('ui.global.pools.title')} hint={t('ui.global.pools.note')} data="pools">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('ui.global.pools.title')}>
            {GLOBAL_POOLS.map((pool) => {
              const active = selection.pools.includes(pool)
              return (
                <button key={pool} type="button" aria-pressed={active} data-global-pool={pool} className={chip(active, false)}
                  onClick={() => { const next = toggle(selection.pools, pool); if (next.length) update({ pools: next }) }}>
                  {t(`ui.global.pool.${pool}`, { n: n(poolTotals[pool]) })}
                </button>
              )
            })}
          </div>
        </Block>

        <Block index={1} title={t('ui.global.q.regions.title')} hint={t('ui.global.q.regions.hint')} data="regions">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('ui.global.q.regions.title')}>
            {activeOptions.regions.map((code) => {
              const active = selection.struckRegions.includes(code)
              return (
                <button key={code} type="button" aria-pressed={active} data-global-region={code} className={chip(active, true)} onClick={() => update({ struckRegions: toggle(selection.struckRegions, code) })}>
                  {active ? t('ui.world.struckPrefix') : ''}{regionLabel(code)} <span className="mono text-xs text-fog-500">{activeOptions.regionCounts[code]}</span>
                </button>
              )
            })}
          </div>
        </Block>

        <Block index={2} title={t('ui.global.q.families.title')} hint={t('ui.global.q.families.hint')} data="families">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('ui.global.q.families.title')}>
            {data.atlas.families.map((family) => {
              const active = selection.struckFamilies.includes(family.code)
              return (
                <button key={family.code} type="button" aria-pressed={active} data-global-family={family.code} className={chip(active, true)} onClick={() => update({ struckFamilies: toggle(selection.struckFamilies, family.code) })}>
                  {active ? t('ui.world.struckPrefix') : ''}{familyLabel(family.code)}
                </button>
              )
            })}
          </div>
        </Block>

        <Block index={3} title={t('ui.global.q.wanted.title')} hint={t('ui.global.q.wanted.hint')} data="wanted">
          {selection.wantedSubjects.length > 0 && <p className="text-sm text-fog-300">{t('ui.global.q.wanted.chosen', { subjects: selection.wantedSubjects.map(subjectLabel).join(joiner) })}</p>}
          <button type="button" aria-expanded={showSubjects} onClick={() => setShowSubjects((v) => !v)} className="self-start px-4 min-h-[40px] rounded-full border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500" data-global-wanted-toggle>
            {showSubjects ? t('ui.global.q.wanted.collapse') : t('ui.global.q.wanted.toggle', { n: selection.wantedSubjects.length })}
          </button>
          {showSubjects && (
            <div className="flex flex-col gap-3">
              {data.atlas.families.filter((f) => !struckFamilies.has(f.code)).map((family) => (
                <div key={family.code} className="flex flex-col gap-2">
                  <p className="mono text-xs uppercase tracking-[0.18em] text-fog-500">{familyLabel(family.code)}</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label={familyLabel(family.code)}>
                    {data.atlas.subjects.filter((s) => s.family === family.code).map((subject) => {
                      const active = selection.wantedSubjects.includes(subject.code)
                      return (
                        <button key={subject.code} type="button" aria-pressed={active} data-global-subject={subject.code} className={chip(active, false)} onClick={() => update({ wantedSubjects: toggle(selection.wantedSubjects, subject.code) })}>
                          {subjectLabel(subject.code)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Block>

        {includesHkMoTw && (
          <Block index={4} title={t('ui.global.q.channels.title')} hint={t('ui.global.q.channels.hint')} data="channels">
            {userAudience ? (
              <div className="flex flex-wrap gap-2" role="group" aria-label={t('ui.global.q.channels.title')}>
                {CHANNEL_AUDIENCES.map((audience) => {
                  const active = selection.struckAudiences.includes(audience)
                  return (
                    <button key={audience} type="button" aria-pressed={active} data-global-audience={audience} className={chip(active, true)} onClick={() => update({ struckAudiences: toggle(selection.struckAudiences, audience) })}>
                      {active ? t('ui.world.struckPrefix') : ''}{t(`ui.global.audience.${audience}`)}{audience === userAudience ? <span className="text-xs text-fog-500"> · {t('ui.global.audience.yours')}</span> : null}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-fog-300" data-global-channels-na>{t('ui.global.q.channels.noAudience', { origin: originOption ? t(`origin.${originOption.id}.label`) : t('ui.global.originUnset') })}</p>
            )}
          </Block>
        )}

        {includesOverseas && (
          <Block title={t('ui.global.platforms.title')} hint={t('ui.global.platforms.note')} data="platforms">
            {platformRegions.length === 0 ? <p className="text-sm text-fog-500">{t('ui.global.platforms.none')}</p> : (
              <p className="text-sm text-fog-300 leading-relaxed flex flex-wrap gap-x-3 gap-y-1">
                {platformRegions.map((code) => (
                  <button key={code} type="button" onClick={() => onOverseas(regionRows.get(code)!.slug)} className="underline hover:text-accent-500 min-h-[32px]">
                    {t('ui.global.platforms.item', { region: regionLabel(code), n: regionRows.get(code)!.portalsLive })}
                  </button>
                ))}
              </p>
            )}
          </Block>
        )}

        {qualHits && qualificationLabel && <p className="text-sm text-fog-300 border border-ink-800 bg-ink-900 rounded-xl px-4 py-3" data-global-qual-note>{t('ui.global.qual.note', { qualification: qualificationLabel })}</p>}

        <section className="flex flex-col gap-3" data-global-kept={result.counts.kept}>
          <h2 className="serif text-2xl">{t('ui.global.kept.title', { n: n(result.counts.kept) })}</h2>
          {result.kept.length === 0 ? <p className="text-sm text-fog-300" data-global-empty>{t('ui.global.kept.empty')}</p> : (
            <ul className="flex flex-col gap-2">
              {keptSorted.slice(0, keptLimit).map(({ item, unknown }) => (
                <ItemRow key={item.key} item={item} locale={locale} overseas={overseasById.get(item.id)} hkmotw={hkmotwById.get(item.id)} regionLabel={regionLabel} qual={qualificationMark(item, qualHits)} qualificationLabel={qualificationLabel}
                  onOverseas={() => onOverseas(regionRows.get(item.region)?.slug, item.id)} onHkMoTw={onHkMoTw}>
                  {unknown.length > 0 && <p className="text-xs text-fog-500">{unknown.map((u) => t(`ui.global.unknown.${u}`)).join(joiner)}</p>}
                </ItemRow>
              ))}
            </ul>
          )}
          {result.kept.length > keptLimit && (
            <button type="button" onClick={() => setKeptLimit(result.kept.length)} className="self-start px-4 min-h-[40px] rounded-full border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500" data-global-more>
              {t('ui.global.kept.more', { n: n(result.kept.length) })}
            </button>
          )}
        </section>

        {result.crossed.length > 0 && (
          <details className="border border-ink-800 bg-ink-900 rounded-xl px-4 py-3" data-global-crossed={result.counts.crossed}>
            <summary className="cursor-pointer serif text-lg min-h-[40px] flex items-center">{t('ui.global.crossed.title', { n: n(result.counts.crossed) })}</summary>
            <ul className="mt-3 flex flex-col gap-2">
              {result.crossed.map(({ item, reasons }) => (
                <ItemRow key={item.key} item={item} locale={locale} overseas={overseasById.get(item.id)} hkmotw={hkmotwById.get(item.id)} regionLabel={regionLabel} qual={null} qualificationLabel="" crossed
                  onOverseas={() => onOverseas(regionRows.get(item.region)?.slug, item.id)} onHkMoTw={onHkMoTw}>
                  <ul className="flex flex-col gap-1 text-xs text-fog-300 leading-relaxed" data-global-reasons={reasons.length}>
                    {reasons.map((reason, i) => <li key={i} data-global-reason={reason.rule}>{reasonText(reason)}</li>)}
                  </ul>
                </ItemRow>
              ))}
            </ul>
          </details>
        )}

        <section className="flex flex-col gap-3 border border-ink-800 bg-ink-900 rounded-xl p-4" data-global-share>
          <h2 className="serif text-xl">{t('ui.global.share.title')}</h2>
          <p className="text-xs text-fog-500 leading-relaxed">{t('ui.global.share.note')}</p>
          <input readOnly value={shareUrl} aria-label={t('ui.global.share.title')} className="w-full max-w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-xs mono text-fog-300" onFocus={(e) => e.currentTarget.select()} data-global-share-url />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copyShare} className="px-4 min-h-[40px] rounded-full bg-accent-500 text-ink-950 text-sm font-semibold hover:bg-accent-400">{copied ? t('ui.global.share.copied') : t('ui.global.share.copy')}</button>
            <button type="button" onClick={downloadShare} className="px-4 min-h-[40px] rounded-full border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500">{t('ui.global.share.image')}</button>
          </div>
          <div className="overflow-hidden">
            <div ref={shareRef} className="rounded-2xl bg-ink-900 border border-ink-800 p-6 flex flex-col gap-3 max-w-xl" data-global-share-card>
              <p className="text-xs mono uppercase tracking-[0.3em] text-fog-500">{t('ui.share.brand')} · {t('ui.global.share.card.title')}</p>
              <p className="serif text-2xl text-fog-100">{t('ui.global.share.card.counts', { kept: n(result.counts.kept), pool: n(result.counts.pool) })}</p>
              <ShareLine label={t('ui.global.pools.title')} values={selection.pools.map((p) => t(`ui.common.${p === 'overseas' ? 'overseasPool' : 'hkmotwPool'}`))} />
              <ShareLine label={t('ui.global.q.regions.title')} values={selection.struckRegions.map(regionLabel)} />
              <ShareLine label={t('ui.global.q.families.title')} values={selection.struckFamilies.map(familyLabel)} />
              <ShareLine label={t('ui.global.q.wanted.title')} values={selection.wantedSubjects.map(subjectLabel)} />
              {includesHkMoTw && <ShareLine label={t('ui.global.q.channels.title')} values={selection.struckAudiences.map((a) => t(`ui.global.audience.${a}`))} />}
              <p className="text-xs mono text-fog-500">nope.bdfz.net · {new Date().toISOString().slice(0, 10)}</p>
            </div>
          </div>
        </section>

        <footer className="pt-6 border-t border-ink-800 text-xs mono text-fog-500 leading-relaxed flex flex-col gap-1">
          <p>{t('ui.global.footer.rule', { overseasDate: data.overseas.generatedAt, hkmotwDate: data.hkmotw.generatedAt, year: data.atlas.ranking.year })}</p>
          <p>
            <Rich
              k="ui.global.footer.links"
              slots={{
                a1: (children: ReactNode) => <button onClick={() => onOverseas()} className="hover:text-accent-500 underline">{children}</button>,
                a2: (children: ReactNode) => <button onClick={onHkMoTw} className="hover:text-accent-500 underline">{children}</button>,
                a3: (children: ReactNode) => <button onClick={onWorld} className="hover:text-accent-500 underline">{children}</button>,
                a4: (children: ReactNode) => <button onClick={onAbout} className="hover:text-accent-500 underline">{children}</button>,
              }}
            />
          </p>
        </footer>
      </section>
    </main>
  )
}

function Block({ index, title, hint, data, children }: { index?: number; title: string; hint: string; data: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3" data-global-question={data}>
      <h2 className="serif text-xl sm:text-2xl leading-snug">{index ? <span className="mono text-accent-500 text-base mr-2">{index}</span> : null}{title}</h2>
      <p className="text-xs sm:text-sm text-fog-500 leading-relaxed max-w-3xl">{hint}</p>
      {children}
    </section>
  )
}

function ShareLine({ label, values }: { label: string; values: string[] }) {
  const { t } = useLocale()
  return <p className="text-sm text-fog-300 leading-relaxed"><span className="text-fog-500">{label}</span>{t('ui.common.colon')}{values.length ? values.join(t('ui.common.listJoiner')) : t('ui.global.share.card.none')}</p>
}

function ItemRow({ item, locale, overseas, hkmotw, regionLabel, qual, qualificationLabel, crossed, onOverseas, onHkMoTw, children }: {
  item: GlobalPoolItem; locale: Locale; overseas?: OverseasInstitutionSummary; hkmotw?: HkMoTwInstitution; regionLabel: (code: string) => string
  qual: ReturnType<typeof qualificationMark>; qualificationLabel: string; crossed?: boolean; onOverseas: () => void; onHkMoTw: () => void; children?: ReactNode
}) {
  const { t } = useLocale()
  const nameEn = overseas?.nameEn ?? hkmotw?.nameEn ?? item.id
  const nameZh = overseas?.nameZh ?? hkmotw?.nameZh ?? null
  const primary = locale === 'en' ? nameEn : nameZh ?? nameEn
  const secondary = locale === 'en' ? nameZh : nameZh ? nameEn : null
  const website = overseas?.website ?? hkmotw?.website ?? null
  return (
    <li className={['border rounded-xl px-4 py-3 flex flex-col gap-2', crossed ? 'border-ink-800 bg-ink-950' : 'border-ink-800 bg-ink-900/78'].join(' ')} data-global-item={item.key}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
        <h3 className="serif text-lg leading-snug">{primary}{secondary ? <span className="text-fog-500 text-sm"> · {secondary}</span> : null}</h3>
        <p className="text-xs mono text-fog-500">{regionLabel(item.region)} · {t(`ui.global.item.pool.${item.pool}`)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mono">
        {website && <a className="text-accent-500 hover:text-accent-400 underline break-all" href={website} target="_blank" rel="noreferrer noopener">{t('ui.global.item.website')}</a>}
        {item.pool === 'overseas' && overseas && (
          <button type="button" onClick={onOverseas} className="text-fog-300 hover:text-accent-500 underline text-left">
            {overseas.linkLive ? t('ui.global.item.admissions.live') : t('ui.global.item.admissions.unread')}
          </button>
        )}
        {item.pool === 'hkmotw' && hkmotw && (
          <>
            <span className="text-fog-300">{hkmotw.channels.length ? t('ui.global.item.hkmotw.channels', { channels: [...new Set(hkmotw.channels.map((c) => c.channelZh))].join(t('ui.common.listJoiner')) }) : t('ui.global.item.hkmotw.none')}</span>
            <button type="button" onClick={onHkMoTw} className="text-fog-300 hover:text-accent-500 underline">{t('ui.global.item.hkmotw.open')}</button>
          </>
        )}
        {qual === 'listed' && <span className="text-fog-100 border border-accent-500/40 rounded-full px-2 py-0.5" data-global-qual="listed">{t('ui.global.qual.listed', { qualification: qualificationLabel })}</span>}
        {qual === 'unread' && <span className="text-fog-500" data-global-qual="unread">{t('ui.global.qual.unread')}</span>}
      </div>
      {children}
    </li>
  )
}
