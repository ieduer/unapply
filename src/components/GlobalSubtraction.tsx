import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { HkMoTwInstitution, HkMoTwPoolPayload } from '../data/hkmotwTypes'
import type { OverseasIndexPayload, OverseasInstitutionSummary } from '../data/overseasTypes'
import type { WorldAtlasPayload } from '../data/worldAtlasTypes'
import type { OriginRegion } from '../data/origins'
import { LOCAL_ENTRY_SOURCES, liveSourceLinks, qualificationTokens, type OriginPrefs } from '../data/originBranch'
import {
  GLOBAL_DESTINATIONS,
  GLOBAL_STORAGE_KEY,
  LEGACY_GLOBAL_STORAGE_KEY,
  applicableChannels,
  audienceForOrigin,
  buildGlobalPool,
  computeGlobal,
  decodeGlobalSelection,
  emptyGlobalSelection,
  encodeGlobalSelection,
  globalOptions,
  globalQuestionPlan,
  normalizeGlobalSelection,
  poolFor,
  qualificationMark,
  type GlobalDestination,
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
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'

interface Props {
  origin: OriginRegion | null
  originPrefs: OriginPrefs
  /** 在本頁改目的地時同步回首頁的選擇（保留中國大陸是否在內）。 */
  onOriginPrefsChange: (prefs: OriginPrefs) => void
  /** 流程含中國大陸階段時：回到大陸結果（已作答）或去做大陸題（未作答）。 */
  mainlandStage: 'answered' | 'unanswered' | null
  onBackToMainland: () => void
  onBack: () => void
  onHkMoTw: () => void
  onOverseas: (region?: string, inst?: string) => void
}

interface Loaded { overseas: OverseasIndexPayload; hkmotw: HkMoTwPoolPayload; atlas: WorldAtlasPayload }

const KEPT_PAGE = 60

/** 存的選擇綁定起點：換了起點（App 會清掉）或起點不同就不沿用。 */
function readStored(origin: OriginRegion | null): Partial<GlobalSelection> | null {
  try {
    window.localStorage.removeItem(LEGACY_GLOBAL_STORAGE_KEY)
    const raw = window.localStorage.getItem(GLOBAL_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { v?: number; origin?: string | null; selection?: Partial<GlobalSelection> }
    return parsed?.v === 2 && (parsed.origin ?? null) === origin ? parsed.selection ?? null : null
  } catch {
    return null
  }
}

function saveStored(selection: GlobalSelection | null, origin: OriginRegion | null) {
  try {
    if (!selection) window.localStorage.removeItem(GLOBAL_STORAGE_KEY)
    else window.localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify({ v: 2, origin, selection }))
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
 * 全球池減法（路線圖 S4 完成定義，批 G2；2026-11-08 批 G6 依目的地重做）。展示層：池只含所選目的地；
 * 題目只在「問了劃得動」時出現（globalQuestionPlan）；機構卡只列適用你起點的管道；官方明確不招本科的另列一節。
 * 選擇只存 localStorage（unapply.globalSubtraction.v2），不進 AnswerMap、不進 A+ 學習證據、不送 Function；分享只含選項鍵。
 */
export function GlobalSubtraction({ origin, originPrefs, onOriginPrefsChange, mainlandStage, onBackToMainland, onBack, onHkMoTw, onOverseas }: Props) {
  const { t, locale, n } = useLocale()
  const [data, setData] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  // 使用者改過的選擇；null＝沿用初始（分享鏈接 > 已存 > 依目的地）
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
  const options = useMemo(() => (data ? globalOptions(data.atlas) : null), [data])
  // 目的地：首頁選的非大陸目的地；沒有（深鏈、未選起點或只選了中國大陸）→ 港澳臺與海外全部
  const prefKey = originPrefs.destinations.filter((d) => d !== 'cn-mainland').join('|')
  const fallbackDestinations = useMemo<GlobalDestination[]>(() => (prefKey ? (prefKey.split('|') as GlobalDestination[]) : [...GLOBAL_DESTINATIONS]), [prefKey])
  const usedFallback = prefKey === ''

  // 初始選擇：分享鏈接 > 已存（同起點、目的地照首頁）> 空（由資料與起點推出，不在 effect 裡 setState）
  const initial = useMemo(() => {
    if (!data || !options) return null
    const shared = decodeGlobalSelection(shareQuery, items, origin, options, familyOf)
    if (shared) return { selection: shared, shared: true }
    const stored = readStored(origin)
    return { selection: normalizeGlobalSelection({ ...(stored ?? {}), destinations: fallbackDestinations }, items, origin, options, familyOf, fallbackDestinations), shared: false }
  }, [data, options, items, familyOf, fallbackDestinations, shareQuery, origin])
  const selection = edited ?? initial?.selection ?? null
  const sharedLoaded = Boolean(initial?.shared) && !sharedDismissed && !edited
  useEffect(() => {
    // 分享鏈接載入後：存成自己的選擇、目的地同步回首頁，並把網址收回 #/global（只含選項鍵，存著也無害）
    if (!initial?.shared) return
    saveStored(initial.selection, origin)
    try { window.history.replaceState(null, '', '#/global') } catch { /* 留著查詢串也無害 */ }
  }, [initial, origin])

  const syncDestinations = useCallback((destinations: readonly GlobalDestination[]) => {
    const keepMainland = originPrefs.destinations.includes('cn-mainland')
    const next = [...(keepMainland ? ['cn-mainland' as const] : []), ...destinations]
    if (next.join('|') !== originPrefs.destinations.join('|')) onOriginPrefsChange({ ...originPrefs, destinations: next })
  }, [originPrefs, onOriginPrefsChange])

  const update = useCallback((next: Partial<GlobalSelection>) => {
    if (!options || !selection) return
    const normalized = normalizeGlobalSelection({ ...selection, ...next }, items, origin, options, familyOf, selection.destinations)
    setEdited(normalized)
    saveStored(normalized, origin)
    setKeptLimit(KEPT_PAGE)
    if (next.destinations) syncDestinations(normalized.destinations)
  }, [options, selection, items, origin, familyOf, syncDestinations])

  const redo = () => {
    if (!options || !selection) return
    // 「重做」只清本階段的選擇（目的地保留；大陸 45 題與首頁選擇不動）
    const fresh = normalizeGlobalSelection(emptyGlobalSelection(selection.destinations), items, origin, options, familyOf, selection.destinations)
    setEdited(fresh)
    saveStored(null, origin)
    setSharedDismissed(true)
    setKeptLimit(KEPT_PAGE)
  }

  const result = useMemo(() => (selection ? computeGlobal(items, selection, { familyOf, origin }) : null), [items, selection, familyOf, origin])
  const plan = useMemo(() => (selection ? globalQuestionPlan(poolFor(items, selection.destinations, origin), origin) : null), [items, selection, origin])
  // 展示順序：你所在地的機構在前；院校池（有管道資料）在前；同組保持資料原序
  const keptSorted = useMemo(() => {
    if (!result) return []
    const local: GlobalDestination | null = origin === 'hk' || origin === 'mo' || origin === 'tw' ? origin : null
    return result.kept.map((k, i) => ({ k, i })).sort((a, b) => Number(a.k.item.destination !== local) - Number(b.k.item.destination !== local) || Number(a.k.item.pool !== 'hkmotw') - Number(b.k.item.pool !== 'hkmotw') || a.i - b.i).map(({ k }) => k)
  }, [result, origin])

  const overseasById = useMemo(() => new Map((data?.overseas.institutions ?? []).map((i) => [i.id, i])), [data])
  const hkmotwById = useMemo(() => new Map((data?.hkmotw.institutions ?? []).map((i) => [i.id, i])), [data])
  const regionRows = useMemo(() => new Map((data?.overseas.regions ?? []).map((r) => [r.code, r])), [data])
  const subjectByCode = useMemo(() => new Map((data?.atlas.subjects ?? []).map((s) => [s.code, s])), [data])
  const familyByCode = useMemo(() => new Map((data?.atlas.families ?? []).map((f) => [f.code, f])), [data])

  const regionLabel = (code: string) => { const row = regionRows.get(code); return locale === 'en' || !row ? code : row.nameZh }
  const subjectLabel = (code: string) => { const s = subjectByCode.get(code); if (!s) return code; return locale === 'en' ? s.nameEn : locale === 'zh-Hans' ? s.nameZhHans || s.nameZh : s.nameZh }
  const familyLabel = (code: string) => { const f = familyByCode.get(code); if (!f) return code; return locale === 'en' ? f.nameEn : f.nameZh }
  const channelLabel = (code: string) => t(`ui.global.channel.${code}`)
  const joiner = t('ui.common.listJoiner')

  if (loadError) {
    return (
      <main className="min-h-screen app-canvas text-fog-100 flex items-center justify-center px-5">
        <section className="w-full max-w-md border border-ink-800 bg-ink-900 rounded-xl p-6 flex flex-col gap-4">
          <h1 className="serif text-2xl">{t('ui.global.loadFailed')}</h1>
          <p className="text-sm text-fog-500 leading-relaxed">{loadError}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => { setLoadError(null); setReloadToken((v) => v + 1) }} className="px-5 min-h-[44px] rounded-full bg-accent-500 text-ink-950 text-sm font-semibold hover:bg-accent-400">{t('ui.common.retryLoad')}</button>
            <button type="button" onClick={onBack} className="px-5 min-h-[44px] rounded-full border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500">{t('ui.common.backHome')}</button>
          </div>
        </section>
      </main>
    )
  }
  if (!data || !selection || !result || !plan) {
    return (
      <main className="min-h-screen app-canvas text-fog-100 flex items-center justify-center px-5">
        <p className="mono text-xs uppercase tracking-[0.2em] text-fog-500">{t('ui.global.loading')}</p>
      </main>
    )
  }

  const struckFamilies = new Set(selection.struckFamilies)
  const shareUrl = `${window.location.origin}${window.location.pathname}#/global${(() => { const q = encodeGlobalSelection(selection); return q ? `?${q}` : '' })()}`
  const qualificationLabel = origin === 'cn-mainland' ? t('ui.overseas.qual.gaokaoOption') : originPrefs.qualification ? t(`origin.qual.${originPrefs.qualification}.label`) : ''
  const includesOverseas = selection.destinations.includes('overseas')
  const platformRegions = includesOverseas ? Object.keys(plan.regionCounts).filter((code) => (regionRows.get(code)?.portalsLive ?? 0) > 0 && !selection.struckRegions.includes(code)) : []
  const places = selection.destinations.map((d) => t(`ui.dest.${d}`)).join(joiner)
  // 題號只算出現的題
  const shownQuestions = [plan.regions ? 'regions' : '', plan.subjects ? 'families' : '', plan.subjects ? 'wanted' : '', plan.channels ? 'channels' : ''].filter(Boolean)
  const numberOf = (question: string) => shownQuestions.indexOf(question) + 1
  const anyQuestion = Boolean(plan.regions || plan.subjects || plan.channels)

  const reasonText = (reason: GlobalReason): string => {
    const question = t(`ui.global.q.${reason.question}.title`)
    const rule = t(`ui.global.reason.rule.${reason.rule}`)
    let value = ''
    if (reason.question === 'regions') value = regionLabel(reason.region)
    else if (reason.question === 'families') value = t('ui.global.reason.value.families', { families: reason.families.map(familyLabel).join(joiner), subjects: reason.subjects.map(subjectLabel).join(joiner) })
    else if (reason.question === 'wanted') value = t('ui.global.reason.value.wanted', { subjects: reason.subjects.map(subjectLabel).join(joiner), wanted: reason.wanted.map(subjectLabel).join(joiner) })
    else value = reason.channels.map(channelLabel).join(joiner)
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
    'px-3 min-h-[44px] rounded-full border text-sm text-left',
    active
      ? struckStyle ? 'border-accent-500 bg-accent-500/10 text-fog-100 line-through decoration-accent-500' : 'border-accent-500 bg-accent-500/10 text-fog-100'
      : 'border-ink-700 bg-ink-950 text-fog-300 hover:border-fog-500 hover:text-fog-100',
  ].join(' ')

  const itemRow = (item: GlobalPoolItem, extra: { crossed?: boolean; children?: ReactNode; qual?: ReturnType<typeof qualificationMark> }) => (
    <ItemRow key={item.key} item={item} locale={locale} origin={origin} overseas={item.overseasId ? overseasById.get(item.overseasId) : undefined} hkmotw={item.pool === 'hkmotw' ? hkmotwById.get(item.id) : undefined}
      regionLabel={regionLabel} channelLabel={channelLabel} qual={extra.qual ?? null} qualificationLabel={qualificationLabel} crossed={extra.crossed}
      onOverseas={() => onOverseas(regionRows.get(item.region)?.slug, item.overseasId ?? item.id)} onHkMoTw={onHkMoTw}>
      {extra.children}
    </ItemRow>
  )

  return (
    <main className="min-h-screen app-canvas text-fog-100">
      <SiteHeader brand={t('ui.global.brand')} back={{ label: t('ui.global.backHome'), onClick: onBack }} />

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-16 flex flex-col gap-8" data-global-page>
        <div className="max-w-3xl flex flex-col gap-3">
          <h1 className="serif text-3xl sm:text-5xl leading-tight">{t('ui.global.title')}</h1>
          <p className="text-sm sm:text-base text-fog-300 leading-relaxed">{t('ui.global.lede')}</p>
          {origin
            ? <p className="text-xs mono text-fog-500">{t('ui.global.origin', { origin: t(`origin.${origin}.label`) })}{qualificationLabel ? ` · ${t('ui.overseas.qual.selector')}${t('ui.common.colon')}${qualificationLabel}` : ''}</p>
            : <p className="text-sm text-fog-300" data-global-no-origin><button type="button" onClick={onBack} className="underline hover:text-accent-500 min-h-[40px]">{t('ui.global.noOrigin')}</button></p>}
          {sharedLoaded && <p className="text-sm text-fog-100 border border-accent-500/40 bg-accent-500/10 rounded-xl px-4 py-3" data-global-shared>{t('ui.global.share.loaded')}</p>}
        </div>

        <div className="px-4 sm:px-5 py-3 border border-ink-800 bg-ink-900 rounded-xl flex flex-wrap items-center justify-between gap-3" data-global-counts={`${result.counts.kept}/${result.counts.pool}`}>
          <p className="text-sm sm:text-base text-fog-100"><Rich k="ui.global.counts" params={{ kept: n(result.counts.kept), pool: n(result.counts.pool), crossed: n(result.counts.crossed) }} /></p>
          <div className="flex flex-wrap gap-2">
            {mainlandStage && (
              <button type="button" onClick={onBackToMainland} className="px-4 min-h-[44px] rounded-full border border-accent-500/40 bg-accent-500/10 text-accent-600 text-sm hover:bg-accent-500/15" data-global-back-mainland={mainlandStage}>
                {mainlandStage === 'answered' ? t('ui.global.backToMainland') : t('ui.global.doMainland')}
              </button>
            )}
            <button type="button" onClick={redo} className="px-4 min-h-[44px] rounded-full border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500" data-global-redo>{t('ui.global.redo')}</button>
          </div>
        </div>

        <Block title={t('ui.global.dest.title')} hint={usedFallback && !edited ? t('ui.global.dest.fallback') : t('ui.global.dest.note')} data="destinations">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('ui.global.dest.title')}>
            {GLOBAL_DESTINATIONS.map((destination) => {
              const active = selection.destinations.includes(destination)
              const last = active && selection.destinations.length === 1
              return (
                <button key={destination} type="button" aria-pressed={active} data-global-destination={destination} className={chip(active, false)}
                  aria-label={last ? t('ui.branch.destLastAria', { place: t(`ui.dest.${destination}`) }) : t(`ui.dest.${destination}`)}
                  onClick={() => { if (!last) update({ destinations: toggle(selection.destinations, destination) }) }}>
                  <span aria-hidden="true" className="mono text-xs mr-1">{active ? '✓' : '+'}</span>{t(`ui.dest.${destination}`)}
                </button>
              )
            })}
          </div>
        </Block>

        {!anyQuestion && <p className="text-sm text-fog-300 border border-ink-800 bg-ink-900 rounded-xl px-4 py-3" data-global-no-questions>{t('ui.global.noQuestions', { places })}</p>}

        {plan.regions && (
          <Block index={numberOf('regions')} title={t('ui.global.q.regions.title')} hint={t('ui.global.q.regions.hint')} data="regions">
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('ui.global.q.regions.title')}>
              {plan.regions.map((code) => {
                const active = selection.struckRegions.includes(code)
                return (
                  <button key={code} type="button" aria-pressed={active} data-global-region={code} className={chip(active, true)} onClick={() => update({ struckRegions: toggle(selection.struckRegions, code) })}>
                    {active ? t('ui.world.struckPrefix') : ''}{regionLabel(code)} <span className="mono text-xs text-fog-500">{plan.regionCounts[code]}</span>
                  </button>
                )
              })}
            </div>
          </Block>
        )}

        {plan.subjects && (
          <>
            <Block index={numberOf('families')} title={t('ui.global.q.families.title')} hint={t('ui.global.q.families.hint')} data="families">
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

            <Block index={numberOf('wanted')} title={t('ui.global.q.wanted.title')} hint={t('ui.global.q.wanted.hint')} data="wanted">
              {selection.wantedSubjects.length > 0 && <p className="text-sm text-fog-300">{t('ui.global.q.wanted.chosen', { subjects: selection.wantedSubjects.map(subjectLabel).join(joiner) })}</p>}
              <button type="button" aria-expanded={showSubjects} onClick={() => setShowSubjects((v) => !v)} className="self-start px-4 min-h-[44px] rounded-full border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500" data-global-wanted-toggle>
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
          </>
        )}

        {plan.channels && (
          <Block index={numberOf('channels')} title={t('ui.global.q.channels.title')} hint={t('ui.global.q.channels.hint')} data="channels">
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('ui.global.q.channels.title')}>
              {plan.channels.map((code) => {
                const active = selection.struckChannels.includes(code)
                return (
                  <button key={code} type="button" aria-pressed={active} data-global-channel={code} className={chip(active, true)} onClick={() => update({ struckChannels: toggle(selection.struckChannels, code) })}>
                    {active ? t('ui.world.struckPrefix') : ''}{channelLabel(code)} <span className="mono text-xs text-fog-500">{plan.channelCounts[code]}</span>
                  </button>
                )
              })}
            </div>
          </Block>
        )}

        {includesOverseas && platformRegions.length > 0 && (
          <Block title={t('ui.global.platforms.title')} hint={t('ui.global.platforms.note')} data="platforms">
            <p className="text-sm text-fog-300 leading-relaxed flex flex-wrap gap-x-3 gap-y-1">
              {platformRegions.map((code) => (
                <button key={code} type="button" onClick={() => onOverseas(regionRows.get(code)!.slug)} className="underline hover:text-accent-500 min-h-[40px]">
                  {t('ui.global.platforms.item', { region: regionLabel(code), n: regionRows.get(code)!.portalsLive })}
                </button>
              ))}
            </p>
          </Block>
        )}

        {qualHits && qualificationLabel && <p className="text-sm text-fog-300 border border-ink-800 bg-ink-900 rounded-xl px-4 py-3" data-global-qual-note>{t('ui.global.qual.note', { qualification: qualificationLabel })}</p>}

        <section className="flex flex-col gap-3" data-global-kept={result.counts.kept}>
          <h2 className="serif text-2xl">{t('ui.global.kept.title', { n: n(result.counts.kept) })}</h2>
          {result.kept.length === 0 ? (
            <div className="flex flex-col gap-3 border border-ink-800 bg-ink-900 rounded-xl px-4 py-4" data-global-empty>
              <p className="text-sm text-fog-300">{result.counts.pool === 0 ? t('ui.global.kept.emptyPool') : t('ui.global.kept.empty')}</p>
              {result.counts.pool > 0 && <button type="button" onClick={redo} className="self-start px-4 min-h-[44px] rounded-full border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500">{t('ui.global.redo')}</button>}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {keptSorted.slice(0, keptLimit).map(({ item, unknown }) => itemRow(item, {
                qual: qualificationMark(item, qualHits),
                children: unknown.length > 0 ? <p className="text-xs text-fog-500">{unknown.map((u) => t(`ui.global.unknown.${u}`)).join(joiner)}</p> : null,
              }))}
            </ul>
          )}
          {result.kept.length > keptLimit && (
            <button type="button" onClick={() => setKeptLimit(result.kept.length)} className="self-start px-4 min-h-[44px] rounded-full border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500" data-global-more>
              {t('ui.global.kept.more', { n: n(result.kept.length) })}
            </button>
          )}
        </section>

        {result.noUndergrad.length > 0 && (
          <details className="border border-ink-800 bg-ink-900 rounded-xl px-4 py-3" data-global-no-undergrad={result.counts.noUndergrad}>
            <summary className="cursor-pointer serif text-lg min-h-[44px] flex items-center">{t('ui.global.noUndergrad.title', { n: n(result.counts.noUndergrad) })}</summary>
            <p className="mt-2 text-xs text-fog-500 leading-relaxed">{t('ui.global.noUndergrad.note')}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {result.noUndergrad.map((item) => {
                const inst = hkmotwById.get(item.id)
                const source = inst?.channels.find((c) => c.channel === 'postgraduate_only')?.source.url
                return itemRow(item, { children: source ? <p className="text-xs mono"><a className="tap underline text-fog-300 hover:text-accent-500" href={source} target="_blank" rel="noreferrer noopener">{t('ui.global.noUndergrad.source')} ↗</a></p> : null })
              })}
            </ul>
          </details>
        )}

        {result.crossed.length > 0 && (
          <details className="border border-ink-800 bg-ink-900 rounded-xl px-4 py-3" data-global-crossed={result.counts.crossed}>
            <summary className="cursor-pointer serif text-lg min-h-[44px] flex items-center">{t('ui.global.crossed.title', { n: n(result.counts.crossed) })}</summary>
            <ul className="mt-3 flex flex-col gap-2">
              {result.crossed.map(({ item, reasons }) => itemRow(item, {
                crossed: true,
                children: (
                  <ul className="flex flex-col gap-1 text-xs text-fog-300 leading-relaxed" data-global-reasons={reasons.length}>
                    {reasons.map((reason, i) => <li key={i} data-global-reason={reason.rule}>{reasonText(reason)}</li>)}
                  </ul>
                ),
              }))}
            </ul>
          </details>
        )}

        <section className="flex flex-col gap-3 border border-ink-800 bg-ink-900 rounded-xl p-4" data-global-share>
          <h2 className="serif text-xl">{t('ui.global.share.title')}</h2>
          <p className="text-xs text-fog-500 leading-relaxed">{t('ui.global.share.note')}</p>
          <input readOnly value={shareUrl} aria-label={t('ui.global.share.title')} className="w-full max-w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-xs mono text-fog-300 min-h-[40px]" onFocus={(e) => e.currentTarget.select()} data-global-share-url />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copyShare} className="px-4 min-h-[44px] rounded-full bg-accent-500 text-ink-950 text-sm font-semibold hover:bg-accent-400">{copied ? t('ui.global.share.copied') : t('ui.global.share.copy')}</button>
            <button type="button" onClick={downloadShare} className="px-4 min-h-[44px] rounded-full border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500">{t('ui.global.share.image')}</button>
          </div>
          <div className="overflow-hidden">
            <div ref={shareRef} className="rounded-2xl bg-ink-900 border border-ink-800 p-6 flex flex-col gap-3 max-w-xl" data-global-share-card>
              <p className="text-xs mono uppercase tracking-[0.3em] text-fog-500">{t('ui.share.brand')} · {t('ui.global.share.card.title')}</p>
              <p className="serif text-2xl text-fog-100">{t('ui.global.share.card.counts', { kept: n(result.counts.kept), pool: n(result.counts.pool) })}</p>
              <ShareLine label={t('ui.global.dest.title')} values={selection.destinations.map((d) => t(`ui.dest.${d}`))} />
              {plan.regions && <ShareLine label={t('ui.global.q.regions.title')} values={selection.struckRegions.map(regionLabel)} />}
              {plan.subjects && <ShareLine label={t('ui.global.q.families.title')} values={selection.struckFamilies.map(familyLabel)} />}
              {plan.subjects && <ShareLine label={t('ui.global.q.wanted.title')} values={selection.wantedSubjects.map(subjectLabel)} />}
              {plan.channels && <ShareLine label={t('ui.global.q.channels.title')} values={selection.struckChannels.map(channelLabel)} />}
              <p className="text-xs mono text-fog-500">nope.bdfz.net · {new Date().toISOString().slice(0, 10)}</p>
            </div>
          </div>
        </section>

        <p className="pt-2 text-xs mono text-fog-500 leading-relaxed" data-global-source>{t('ui.global.footer.rule', { overseasDate: data.overseas.generatedAt, hkmotwDate: data.hkmotw.generatedAt, year: data.atlas.ranking.year })}</p>
      </section>
      <SiteFooter />
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

function ItemRow({ item, locale, origin, overseas, hkmotw, regionLabel, channelLabel, qual, qualificationLabel, crossed, onOverseas, onHkMoTw, children }: {
  item: GlobalPoolItem; locale: Locale; origin: OriginRegion | null; overseas?: OverseasInstitutionSummary; hkmotw?: HkMoTwInstitution; regionLabel: (code: string) => string; channelLabel: (code: string) => string
  qual: ReturnType<typeof qualificationMark>; qualificationLabel: string; crossed?: boolean; onOverseas: () => void; onHkMoTw: () => void; children?: ReactNode
}) {
  const { t } = useLocale()
  const nameEn = hkmotw?.nameEn ?? overseas?.nameEn ?? item.id
  const nameZh = hkmotw?.nameZh ?? overseas?.nameZh ?? null
  const primary = locale === 'en' ? nameEn : nameZh ?? nameEn
  const secondary = locale === 'en' ? nameZh : nameZh ? nameEn : null
  const website = hkmotw?.website ?? overseas?.website ?? null
  const own = applicableChannels(item, origin)
  // 港澳臺考生看自己所在地的院校（聯合招生委員會這類管道彙整除外）：本地入學入口（JUPAS／四校聯考／甄選與分發），只有官方頁 live 才上鏈接
  const localEntry = (origin === 'hk' || origin === 'mo' || origin === 'tw') && item.destination === origin && !item.committee ? origin : null
  const localLinks = localEntry ? liveSourceLinks(LOCAL_ENTRY_SOURCES[localEntry]) : []
  return (
    <li className={['border rounded-xl px-4 py-3 flex flex-col gap-2', crossed ? 'border-ink-800 bg-ink-950' : 'border-ink-800 bg-ink-900/78'].join(' ')} data-global-item={item.key}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
        <h3 className="serif text-lg leading-snug">{primary}{secondary ? <span className="text-fog-500 text-sm"> · {secondary}</span> : null}</h3>
        <p className="text-xs mono text-fog-500">{regionLabel(item.region)}</p>
      </div>
      {localEntry ? (
        <p className="text-xs text-fog-300 leading-relaxed flex flex-wrap items-center gap-x-1" data-global-channels="local">
          <span>{t('ui.global.localEntry.prefix')}</span>
          {localLinks.length > 0
            ? <a className="tap underline hover:text-accent-500" href={localLinks[0].url} target="_blank" rel="noreferrer noopener">{t(`ui.global.localEntry.${localEntry}`)} ↗</a>
            : <span>{t(`ui.global.localEntry.${localEntry}`)}</span>}
          <span>{t(`ui.global.localEntry.${localEntry}.more`)}</span>
          {localLinks.slice(1).map(({ url, org }) => <span key={url} className="inline-flex items-center gap-x-1"><span aria-hidden="true">·</span><a className="tap underline hover:text-accent-500" href={url} target="_blank" rel="noreferrer noopener">{t(`ui.source.${org}`)} ↗</a></span>)}
        </p>
      ) : item.pool === 'overseas' && item.destination !== 'overseas' && audienceForOrigin(origin) ? (
        // 港澳臺地區的海外層機構（國際生招生頁）：大陸與港澳考生有各自的管道，本站沒有這所的記錄
        <p className="text-xs text-fog-500 leading-relaxed" data-global-channels="none">{t('ui.global.item.channelsNone')}</p>
      ) : item.pool === 'hkmotw' && !item.noUndergrad ? (
        <div className="text-xs text-fog-300 leading-relaxed flex flex-col gap-1" data-global-channels={own && own.length ? own.join('|') : 'none'}>
          {own && own.length > 0
            ? <p>{t('ui.global.item.channels', { channels: own.map(channelLabel).join(t('ui.common.listJoiner')) })}</p>
            : <p className="text-fog-500">{t('ui.global.item.channelsNone')}</p>}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mono">
        {website && <a className="tap text-accent-500 hover:text-accent-400 underline break-all" href={website} target="_blank" rel="noreferrer noopener">{t('ui.global.item.website')}</a>}
        {overseas && (
          <button type="button" onClick={onOverseas} className="tap text-fog-300 hover:text-accent-500 underline text-left">
            {overseas.linkLive ? t('ui.global.item.admissions.live') : t('ui.global.item.admissions.unread')}
          </button>
        )}
        {item.pool === 'hkmotw' && <button type="button" onClick={onHkMoTw} className="tap text-fog-300 hover:text-accent-500 underline">{t('ui.global.item.hkmotw.open')}</button>}
        {qual === 'listed' && <span className="text-fog-100 border border-accent-500/40 rounded-full px-2 py-0.5" data-global-qual="listed">{t('ui.global.qual.listed', { qualification: qualificationLabel })}</span>}
        {qual === 'unread' && <span className="text-fog-500" data-global-qual="unread">{t('ui.global.qual.unread')}</span>}
      </div>
      {children}
    </li>
  )
}
