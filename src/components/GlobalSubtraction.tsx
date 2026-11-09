import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { HkMoTwInstitution, HkMoTwPoolPayload } from '../data/hkmotwTypes'
import type { OverseasIndexPayload, OverseasInstitutionSummary } from '../data/overseasTypes'
import type { WorldAtlasPayload } from '../data/worldAtlasTypes'
import type { OriginRegion } from '../data/origins'
import { LOCAL_ENTRY_SOURCES, liveSourceLinks, qualificationTokens, type OriginPrefs } from '../data/originBranch'
import { questionEvidence } from '../data/questionEvidence'
import { bankEvidence } from '../lib/bankEvidence'
import {
  GLOBAL_DESTINATIONS,
  LEGACY_GLOBAL_STORAGE_KEYS,
  applicableChannels,
  audienceForOrigin,
  buildGlobalPool,
  notRecruitingFor,
  poolFor,
  qualificationMark,
  type GlobalDestination,
  type GlobalPoolItem,
} from '../engine/globalFilter'
import {
  BANK_STORAGE_KEY,
  computeBank,
  decodeBankAnswers,
  encodeBankAnswers,
  evaluateBank,
  normalizeBankAnswers,
  type BankAnswers,
  type BankContext,
  type BankId,
  type BankPlan,
  type BankReason,
  type EvaluatedQuestion,
  type RegionQuestionId,
} from '../engine/regionBanks'
import { loadHkMoTwPool } from '../lib/hkmotwData'
import { loadOverseasIndex } from '../lib/overseasData'
import { loadWorldAtlas } from '../lib/atlasData'
import { loadQualificationsIndex, type QualificationsPayload } from '../lib/originLayer'
import { generateShareImage } from '../lib/share'
import { useTransientNotice } from '../lib/useTransientNotice'
import { DIRECT_HIRE_QUESTION, normalizePathAnswer, planDirectHire, type PathAnswer } from '../engine/directHire'
import { GrasSummary, NonUniversityPaths } from './ResultExtras'
import { useLocale } from '../i18n/react'
import type { Locale } from '../i18n/core'
import { Rich } from '../i18n/rich'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'

interface Props {
  origin: OriginRegion | null
  originPrefs: OriginPrefs
  /** 在結果頁改目的地時同步回首頁的選擇（保留中國大陸是否在內）。 */
  onOriginPrefsChange: (prefs: OriginPrefs) => void
  /** 流程含中國大陸階段時：回到大陸結果（已走完）或去做大陸題（未走完）。 */
  mainlandStage: 'answered' | 'unanswered' | null
  onBackToMainland: () => void
  onBack: () => void
  onHkMoTw: () => void
  onOverseas: (region?: string, inst?: string) => void
}

interface Loaded { overseas: OverseasIndexPayload; hkmotw: HkMoTwPoolPayload; atlas: WorldAtlasPayload }

const KEPT_PAGE = 60
const STEP_STORAGE_KEY = 'unapply.regionStep.v1'

function readStoredAnswers(origin: OriginRegion | null): BankAnswers | null {
  try {
    for (const key of LEGACY_GLOBAL_STORAGE_KEYS) window.localStorage.removeItem(key)
    const raw = window.localStorage.getItem(BANK_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { v?: number; origin?: string | null; answers?: BankAnswers }
    return parsed?.v === 1 && (parsed.origin ?? null) === origin ? parsed.answers ?? null : null
  } catch {
    return null
  }
}

function saveStoredAnswers(answers: BankAnswers | null, origin: OriginRegion | null) {
  try {
    if (!answers) window.localStorage.removeItem(BANK_STORAGE_KEY)
    else window.localStorage.setItem(BANK_STORAGE_KEY, JSON.stringify({ v: 1, origin, answers }))
  } catch {
    // 存不下就算了，本次會話仍然生效
  }
}

function readStoredStep(): number | 'result' | null {
  try {
    const raw = window.sessionStorage.getItem(STEP_STORAGE_KEY)
    if (raw === 'result') return 'result'
    const n = raw === null ? NaN : Number(raw)
    return Number.isInteger(n) && n >= 0 ? n : null
  } catch {
    return null
  }
}

function saveStoredStep(step: number | 'result' | null) {
  try {
    if (step === null) window.sessionStorage.removeItem(STEP_STORAGE_KEY)
    else window.sessionStorage.setItem(STEP_STORAGE_KEY, String(step))
  } catch {
    // 存不下就算了
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
 * 全球減法（批 G2；2026-11-08 批 G6 依目的地重做；批 G6 擴充：按目的地分題庫、題目以效度篩選，一題一頁）。
 * 題目由 src/engine/regionBanks.ts 依池與起點逐題核效度後才出；作答只存 localStorage（unapply.regionBanks.v1），
 * 不進 AnswerMap、不進 A+ 學習證據、不送 Function；分享只含選項鍵。
 */
export function GlobalSubtraction({ origin, originPrefs, onOriginPrefsChange, mainlandStage, onBackToMainland, onBack, onHkMoTw, onOverseas }: Props) {
  const { t, locale, n } = useLocale()
  const [data, setData] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [shareQuery] = useState(() => shareQueryFromHash())
  const [answers, setAnswersState] = useState<BankAnswers | null>(null)
  const [step, setStepState] = useState<number | 'result' | null>(() => (shareQueryFromHash() ? 'result' : readStoredStep()))
  const [sharedLoaded, setSharedLoaded] = useState(false)
  const [qualPayload, setQualPayload] = useState<QualificationsPayload | null>(null)
  const [keptLimit, setKeptLimit] = useState<Record<string, number>>({})
  const [copied, setCopied] = useState(false)
  const [keepOne, showKeepOne] = useTransientNotice()
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

  // 分享鏈接：目的地同步回首頁（保留中國大陸是否在內）、作答存成自己的，網址收回 #/global
  const shared = useMemo(() => (shareQuery ? decodeBankAnswers(shareQuery) : null), [shareQuery])
  const prefKey = originPrefs.destinations.filter((d) => d !== 'cn-mainland').join('|')
  const destinations = useMemo<GlobalDestination[]>(() => {
    if (shared?.destinations.length && !sharedLoaded) return shared.destinations
    return prefKey ? (prefKey.split('|') as GlobalDestination[]) : [...GLOBAL_DESTINATIONS]
  }, [prefKey, shared, sharedLoaded])
  const usedFallback = prefKey === '' && !shared?.destinations.length

  const items = useMemo(() => (data ? buildGlobalPool(data.overseas, data.hkmotw, data.atlas) : []), [data])
  const ctx = useMemo<BankContext | null>(() => (data ? {
    familyOf: new Map(data.atlas.subjects.map((s) => [s.code, s.family])),
    familyOrder: data.atlas.families.map((f) => f.code),
    subjectOrder: data.atlas.subjects.map((s) => s.code),
    origin,
    ...bankEvidence(),
  } : null), [data, origin])
  const pools = useMemo(() => new Map(destinations.map((d) => [d, poolFor(items, [d], origin)])), [items, destinations, origin])
  const plans = useMemo<BankPlan[]>(() => (ctx ? destinations.map((d) => evaluateBank(d, pools.get(d) ?? [], ctx)) : []), [ctx, destinations, pools])
  // 非大學路徑題（批 G7）：該目的地已核企業直招 ≥2 條且覆蓋 ≥60% 才在題庫最後一步出現（src/engine/directHire.ts）
  const pathPlans = useMemo(() => new Map(destinations.map((d) => [d, planDirectHire(d, data?.atlas.programs ?? [])])), [data, destinations])
  const pathBanks = useMemo(() => new Set(destinations.filter((d) => pathPlans.get(d)?.question)), [destinations, pathPlans])
  const steps = useMemo(() => plans.flatMap((plan) => {
    const total = plan.questions.length + (pathBanks.has(plan.bank) ? 1 : 0)
    return [
      ...plan.questions.map((q, i) => ({ plan, q: q as EvaluatedQuestion | typeof DIRECT_HIRE_QUESTION, index: i, total })),
      ...(pathBanks.has(plan.bank) ? [{ plan, q: DIRECT_HIRE_QUESTION as EvaluatedQuestion | typeof DIRECT_HIRE_QUESTION, index: plan.questions.length, total }] : []),
    ]
  }), [plans, pathBanks])

  // 作答初始化：自己改過的 > 分享鏈接 > 已存（同起點）> 空（由資料推出，不在 render 裡 setState）
  const effectiveAnswers = useMemo<BankAnswers>(() => {
    if (!plans.length) return {}
    if (answers) return normalizeBankAnswers(answers, plans, pathBanks)
    if (shared && !sharedLoaded) return normalizeBankAnswers(shared.answers, plans, pathBanks)
    return normalizeBankAnswers(readStoredAnswers(origin), plans, pathBanks)
  }, [answers, plans, pathBanks, shared, sharedLoaded, origin])

  useEffect(() => {
    if (!shared || sharedLoaded || !plans.length) return
    const keepMainland = originPrefs.destinations.includes('cn-mainland')
    if (shared.destinations.length) onOriginPrefsChange({ ...originPrefs, destinations: [...(keepMainland ? ['cn-mainland' as const] : []), ...shared.destinations] })
    saveStoredAnswers(normalizeBankAnswers(shared.answers, plans, pathBanks), origin)
    try { window.history.replaceState(null, '', '#/global') } catch { /* 留著查詢串也無害 */ }
    // 只做一次：分享的目的地寫回首頁後，prefKey 就等於分享的目的地
  }, [shared, sharedLoaded, plans]) // eslint-disable-line react-hooks/exhaustive-deps

  const setAnswers = useCallback((next: BankAnswers) => {
    const normalized = normalizeBankAnswers(next, plans, pathBanks)
    setAnswersState(normalized)
    setSharedLoaded(true)
    saveStoredAnswers(normalized, origin)
  }, [plans, pathBanks, origin])

  const currentStep: number | 'result' = step === 'result' || !steps.length ? 'result' : Math.min(step ?? 0, steps.length - 1)
  const goStep = useCallback((next: number | 'result') => {
    setStepState(next)
    saveStoredStep(next)
    window.scrollTo(0, 0)
  }, [])
  // 換題：焦點移到題目標題（第一次由 App 處理）
  const firstStep = useRef(true)
  useEffect(() => {
    if (firstStep.current) { firstStep.current = false; return }
    const heading = document.querySelector<HTMLElement>('main h1, main [data-question-title]')
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }) }
  }, [currentStep])

  const results = useMemo(() => (ctx ? plans.map((plan) => computeBank(plan, pools.get(plan.bank) ?? [], effectiveAnswers, ctx)) : []), [ctx, plans, pools, effectiveAnswers])
  const noUndergradByBank = useMemo(() => {
    const audience = audienceForOrigin(origin)
    const out = new Map<BankId, GlobalPoolItem[]>()
    for (const d of destinations) out.set(d, items.filter((i) => i.destination === d && notRecruitingFor(i, origin) && (!i.committee || audience === null || Boolean(i.channels?.some((c) => c.audience === audience)))))
    return out
  }, [items, destinations, origin])

  const overseasById = useMemo(() => new Map((data?.overseas.institutions ?? []).map((i) => [i.id, i])), [data])
  const hkmotwById = useMemo(() => new Map((data?.hkmotw.institutions ?? []).map((i) => [i.id, i])), [data])
  const regionRows = useMemo(() => new Map((data?.overseas.regions ?? []).map((r) => [r.code, r])), [data])
  const subjectByCode = useMemo(() => new Map((data?.atlas.subjects ?? []).map((s) => [s.code, s])), [data])
  const familyByCode = useMemo(() => new Map((data?.atlas.families ?? []).map((f) => [f.code, f])), [data])

  const regionLabel = (code: string) => { const row = regionRows.get(code); return locale === 'en' || !row ? code : row.nameZh }
  const subjectLabel = (code: string) => { const s = subjectByCode.get(code); if (!s) return code; return locale === 'en' ? s.nameEn : locale === 'zh-Hans' ? s.nameZhHans || s.nameZh : s.nameZh }
  const familyLabel = (code: string) => { const f = familyByCode.get(code); if (!f) return code; return locale === 'en' ? f.nameEn : f.nameZh }
  const channelLabel = (code: string) => t(`ui.global.channel.${code}`)
  const optionLabel = (q: RegionQuestionId, value: string) => (q === 'regions' ? regionLabel(value) : q === 'families' ? familyLabel(value) : q === 'wanted' ? subjectLabel(value) : q === 'channels' ? channelLabel(value) : q === 'moOwnership' ? t(`ui.global.ownership.${value}`) : q === 'hkTuitionCap' ? t('ui.global.tuitionCap.option', { amount: n(Number(value)) }) : t(`ui.global.funding.${value}`))
  const joiner = t('ui.common.listJoiner')

  if (loadError) {
    return (
      <main className="min-h-screen app-canvas text-fog-100 flex items-center justify-center px-5">
        <section className="w-full max-w-md border border-ink-800 bg-ink-900 rounded-panel p-6 flex flex-col gap-4">
          <h1 className="serif text-2xl">{t('ui.global.loadFailed')}</h1>
          <p className="text-sm text-fog-500 leading-relaxed">{loadError}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => { setLoadError(null); setReloadToken((v) => v + 1) }} className="px-5 min-h-[44px] rounded-ctl bg-accent-500 text-ink-950 text-sm font-semibold hover:bg-accent-400">{t('ui.common.retryLoad')}</button>
            <button type="button" onClick={onBack} className="px-5 min-h-[44px] rounded-ctl border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500">{t('ui.common.backHome')}</button>
          </div>
        </section>
      </main>
    )
  }
  if (!data || !ctx) {
    return (
      <main className="min-h-screen app-canvas text-fog-100 flex items-center justify-center px-5" data-loading="">
        <p className="mono text-xs uppercase tracking-[0.2em] text-fog-500">{t('ui.global.loading')}</p>
      </main>
    )
  }

  const qualificationLabel = origin === 'cn-mainland' ? t('ui.overseas.qual.gaokaoOption') : originPrefs.qualification ? t(`origin.qual.${originPrefs.qualification}.label`) : ''
  const totalPool = results.reduce((s, r) => s + r.pool, 0)
  const totalKept = results.reduce((s, r) => s + r.kept.length, 0)
  const totalCrossed = totalPool - totalKept

  // ---------------- 一題一頁 ----------------
  if (currentStep !== 'result') {
    const { plan, q, index, total } = steps[currentStep]
    const isPath = q === DIRECT_HIRE_QUESTION
    const qid = isPath ? DIRECT_HIRE_QUESTION : q.id
    const chosen = effectiveAnswers[plan.bank]?.[qid] ?? []
    const live = computeBank(plan, pools.get(plan.bank) ?? [], effectiveAnswers, ctx, isPath ? Infinity : index + 1)
    // 路徑題單選：再點一次＝取消
    const pick = (value: string) => setAnswers({ ...effectiveAnswers, [plan.bank]: { ...(effectiveAnswers[plan.bank] ?? {}), [qid]: isPath || q.single ? (chosen[0] === value ? [] : [value]) : toggle(chosen, value) } })
    const isLast = currentStep === steps.length - 1
    const next = () => goStep(isLast ? 'result' : currentStep + 1)
    const skip = () => { setAnswers({ ...effectiveAnswers, [plan.bank]: { ...(effectiveAnswers[plan.bank] ?? {}), [qid]: [] } }); next() }
    const prev = () => (currentStep === 0 ? onBack() : goStep(currentStep - 1))
    const progress = t('ui.global.step.progress', { bank: t(`ui.dest.${plan.bank}`), index: index + 1, total })
    return (
      <main className="min-h-screen app-canvas text-fog-100 flex flex-col">
        <SiteHeader
          search={false}
          sticky
          width="max-w-2xl"
          brand={t('ui.global.brand')}
          back={{ label: currentStep === 0 ? t('ui.global.step.back') : t('ui.global.step.prev'), onClick: prev }}
          center={<span className="mono text-fog-500">{progress}</span>}
          actions={[{ label: t('ui.global.step.skip'), onClick: skip }]}
          footer={
            <>
              <p className="sm:hidden px-3 pb-1.5 text-xs mono text-fog-500">{progress}</p>
              <div className="h-[2px] bg-ink-800"><div className="h-full bg-accent-500 transition-all duration-500" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} /></div>
            </>
          }
        />
        <section className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 pt-6 pb-10 flex flex-col gap-6" data-global-step={`${plan.bank}:${qid}`}>
          <div key={`${plan.bank}:${qid}`} className="question-enter flex flex-col gap-3">
            <p className="mono text-xs uppercase tracking-[0.2em] text-accent-500">{t(`ui.dest.${plan.bank}`)}</p>
            <h2 className="serif text-2xl sm:text-3xl leading-snug" data-question-title>{t(`ui.global.q.${qid}.title`)}</h2>
            <p className="text-sm text-fog-500 leading-relaxed">{t(`ui.global.q.${qid}.hint`, { n: n(pathPlans.get(plan.bank)?.verified.length ?? 0) })}</p>
          </div>
          {isPath
            ? (
              <div className="flex flex-wrap gap-2" role="group" aria-label={t('ui.global.q.directHire.title')} data-global-options={DIRECT_HIRE_QUESTION}>
                {(['consider', 'no'] as const).map((value) => (
                  <button key={value} type="button" aria-pressed={chosen.includes(value)} data-global-option={value} onClick={() => pick(value)}
                    className={['px-4 min-h-[44px] rounded-ctl border text-sm text-left', chosen.includes(value) ? 'border-accent-500 bg-accent-500/10 text-fog-100' : 'border-ink-700 bg-ink-950 text-fog-300 hover:border-fog-500 hover:text-fog-100'].join(' ')}>
                    {t(`ui.paths.answer.${value}`, { n: n(pathPlans.get(plan.bank)?.verified.length ?? 0) })}
                  </button>
                ))}
              </div>
            )
            : <QuestionOptions q={q} chosen={chosen} pick={pick} optionLabel={optionLabel} familyOf={ctx.familyOf} familyOrder={ctx.familyOrder} familyLabel={familyLabel} />}
        </section>
        <div className="sticky bottom-0 z-30 border-t border-ink-800 bg-ink-950/95 backdrop-blur" data-global-step-bar>
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-fog-300" data-global-live={`${live.kept.length}/${live.pool}`}>{t('ui.global.step.remaining', { bank: t(`ui.dest.${plan.bank}`), kept: n(live.kept.length), pool: n(live.pool) })}</p>
            <button type="button" onClick={next} className="px-6 min-h-[48px] rounded-ctl bg-accent-500 text-ink-950 font-semibold text-base hover:bg-accent-400 shrink-0" data-global-next>
              {isLast ? t('ui.global.step.results') : t('ui.global.step.next')}
            </button>
          </div>
        </div>
        <SiteFooter width="max-w-2xl" />
      </main>
    )
  }

  // ---------------- 結果 ----------------
  const shareUrl = `${window.location.origin}${window.location.pathname}#/global${(() => { const q = encodeBankAnswers(destinations, effectiveAnswers); return q ? `?${q}` : '' })()}`
  const itemDisplayName = (item: GlobalPoolItem): string => {
    const hk = item.pool === 'hkmotw' ? hkmotwById.get(item.id) : undefined
    const os = overseasById.get(item.overseasId ?? item.id)
    const en = hk?.nameEn ?? os?.nameEn ?? item.id
    return locale === 'en' ? en : hk?.nameZh ?? os?.nameZh ?? en
  }
  const tuitionOf = (id: string) => questionEvidence.hkTuition.rows.find((r) => r.id === id)
  const tuitionText = (id: string) => { const r = tuitionOf(id); return r ? t(`ui.global.tuition.${r.basis}`, { min: n(r.min), max: n(r.max), range: r.max > r.min ? `${n(r.min)}–${n(r.max)}` : n(r.min), year: r.academicYear }) : '' }
  const reasonText = (reason: BankReason, item?: GlobalPoolItem): string => (reason.question === 'hkTuitionCap' && item
    ? t('ui.global.reason.short', { question: t('ui.global.q.hkTuitionCap.title'), value: tuitionText(item.id) })
    : t('ui.global.reason.short', { question: t(`ui.global.q.${reason.question}.title`), value: reason.values.map((v) => optionLabel(reason.question, v)).join(joiner) }))
  const redo = () => { setAnswers({}); saveStoredAnswers(null, origin); setKeptLimit({}); goStep(steps.length ? 0 : 'result') }
  const syncDestinations = (next: readonly GlobalDestination[]) => {
    setSharedLoaded(true)
    const keepMainland = originPrefs.destinations.includes('cn-mainland')
    onOriginPrefsChange({ ...originPrefs, destinations: [...(keepMainland ? ['cn-mainland' as const] : []), ...GLOBAL_DESTINATIONS.filter((d) => next.includes(d))] })
  }
  const copyShare = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 2000) } catch { setCopied(false) }
  }
  const downloadShare = async () => {
    if (!shareRef.current) return
    await generateShareImage(shareRef.current, `unapply-global-${Date.now()}.png`)
  }
  const chip = (active: boolean) => ['px-3 min-h-[44px] rounded-ctl border text-sm text-left', active ? 'border-accent-500 bg-accent-500/10 text-fog-100' : 'border-ink-700 bg-ink-950 text-fog-300 hover:border-fog-500 hover:text-fog-100'].join(' ')
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
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8 pb-16 flex flex-col gap-8" data-global-page data-global-result>
        <div className="max-w-3xl flex flex-col gap-3">
          <h1 className="serif text-3xl sm:text-5xl leading-tight">{t('ui.global.result.title')}</h1>
          {origin
            ? <p className="text-xs mono text-fog-500">{t('ui.global.origin', { origin: t(`origin.${origin}.label`) })}{qualificationLabel ? ` · ${t('ui.overseas.qual.selector')}${t('ui.common.colon')}${qualificationLabel}` : ''}</p>
            : <p className="text-sm text-fog-300" data-global-no-origin><button type="button" onClick={onBack} className="underline hover:text-accent-500 min-h-[40px]">{t('ui.global.noOrigin')}</button></p>}
          {shared && !sharedLoaded && <p className="text-sm text-fog-100 border border-accent-500/40 bg-accent-500/10 rounded-panel px-4 py-3" data-global-shared>{t('ui.global.share.loaded')}</p>}
        </div>

        <div className="px-4 sm:px-5 py-3 border border-ink-800 bg-ink-900 rounded-panel flex flex-wrap items-center justify-between gap-3" data-global-counts={`${totalKept}/${totalPool}`}>
          <p className="text-sm sm:text-base text-fog-100"><Rich k="ui.global.counts" params={{ kept: n(totalKept), pool: n(totalPool), crossed: n(totalCrossed) }} /></p>
          <div className="flex flex-wrap gap-2">
            {mainlandStage && (
              <button type="button" onClick={onBackToMainland} className="px-4 min-h-[44px] rounded-ctl border border-accent-500/40 bg-accent-500/10 text-accent-600 text-sm hover:bg-accent-500/15" data-global-back-mainland={mainlandStage}>
                {mainlandStage === 'answered' ? t('ui.global.backToMainland') : t('ui.global.doMainland')}
              </button>
            )}
            {steps.length > 0 && <button type="button" onClick={() => goStep(0)} className="px-4 min-h-[44px] rounded-ctl border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500" data-global-edit>{t('ui.global.result.edit')}</button>}
            <button type="button" onClick={redo} className="px-4 min-h-[44px] rounded-ctl border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500" data-global-redo>{t('ui.global.redo')}</button>
          </div>
        </div>

        <section className="flex flex-col gap-3" data-global-question="destinations">
          <h2 className="serif text-xl">{t('ui.global.dest.title')}</h2>
          <p className="text-xs sm:text-sm text-fog-500 leading-relaxed">{usedFallback ? t('ui.global.dest.fallback') : t('ui.global.dest.note')}</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('ui.global.dest.title')}>
            {GLOBAL_DESTINATIONS.map((destination) => {
              const active = destinations.includes(destination)
              const last = active && destinations.length === 1
              return (
                <button key={destination} type="button" aria-pressed={active} data-global-destination={destination} className={chip(active)}
                  aria-label={last ? t('ui.branch.destLastAria', { place: t(`ui.dest.${destination}`) }) : t(`ui.dest.${destination}`)}
                  onClick={() => { if (last) showKeepOne(); else syncDestinations(toggle(destinations, destination)) }}>
                  <span aria-hidden="true" className="mono text-xs mr-1">{active ? '✓' : '+'}</span>{t(`ui.dest.${destination}`)}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-accent-600 leading-relaxed min-h-[1.25rem]" role="status" aria-live="polite" data-dest-keep-one={keepOne ? 'shown' : ''}>{keepOne ? t('ui.branch.destKeepOne') : ''}</p>
        </section>

        {qualHits && qualificationLabel && destinations.includes('overseas') && <p className="text-sm text-fog-300 border border-ink-800 bg-ink-900 rounded-panel px-4 py-3" data-global-qual-note>{t('ui.global.qual.note', { qualification: qualificationLabel })}</p>}

        {results.map((result) => {
          const plan = plans.find((p) => p.bank === result.bank)!
          const noUndergrad = noUndergradByBank.get(result.bank) ?? []
          const limit = keptLimit[result.bank] ?? KEPT_PAGE
          const keptSorted = [...result.kept].sort((a, b) => Number(a.item.pool !== 'hkmotw') - Number(b.item.pool !== 'hkmotw'))
          const platformRegions = result.bank === 'overseas' ? [...new Set(result.kept.map((k) => k.item.region))].filter((code) => (regionRows.get(code)?.portalsLive ?? 0) > 0) : []
          return (
            <section key={result.bank} className="flex flex-col gap-3" data-global-bank={result.bank} data-global-kept={result.kept.length}>
              <h2 className="serif text-2xl">{t('ui.global.result.bank', { bank: t(`ui.dest.${result.bank}`), kept: n(result.kept.length), pool: n(result.pool) })}</h2>
              {plan.questions.length === 0 && <p className="text-sm text-fog-500" data-global-no-questions>{t('ui.global.result.noQuestions')}</p>}
              {result.pool === 0 ? <p className="text-sm text-fog-300" data-global-empty>{t('ui.global.kept.emptyPool')}</p> : result.kept.length === 0 ? (
                <div className="flex flex-col gap-3 border border-ink-800 bg-ink-900 rounded-panel px-4 py-4" data-global-empty>
                  <p className="text-sm text-fog-300">{t('ui.global.kept.empty')}</p>
                  <button type="button" onClick={redo} className="self-start px-4 min-h-[44px] rounded-ctl border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500">{t('ui.global.redo')}</button>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {keptSorted.slice(0, limit).map(({ item, unknown }) => itemRow(item, {
                    qual: qualificationMark(item, qualHits),
                    children: (
                      <>
                        {/* 批 G8：香港院校內地／非本地生年學費（官方原文；本地考生不顯示） */}
                        {item.destination === 'hk' && origin !== 'hk' && tuitionOf(item.id) && (
                          <p className="text-xs text-fog-300 leading-relaxed" data-global-tuition={item.id}>
                            {t('ui.global.tuition.label')}{tuitionText(item.id)}{' '}
                            <a className="tap underline hover:text-accent-500" href={tuitionOf(item.id)!.url} target="_blank" rel="noreferrer noopener">{t('ui.global.tuition.source')} ↗</a>
                          </p>
                        )}
                        {unknown.length > 0 ? <p className="text-xs text-fog-500">{unknown.map((u) => t(`ui.global.unknown.${u}`)).join(joiner)}</p> : null}
                      </>
                    ),
                  }))}
                </ul>
              )}
              {result.kept.length > limit && (
                <button type="button" onClick={() => setKeptLimit((m) => ({ ...m, [result.bank]: result.kept.length }))} className="self-start px-4 min-h-[44px] rounded-ctl border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500" data-global-more>
                  {t('ui.global.kept.more', { n: n(result.kept.length) })}
                </button>
              )}
              {platformRegions.length > 0 && (
                <details className="border border-ink-800 bg-ink-900 rounded-panel px-4 py-3" data-global-platforms>
                  <summary className="cursor-pointer serif text-lg min-h-[44px] flex items-center">{t('ui.global.platforms.title')}</summary>
                  <p className="mt-2 text-xs text-fog-500 leading-relaxed">{t('ui.global.platforms.note')}</p>
                  <p className="mt-2 text-sm text-fog-300 leading-relaxed flex flex-wrap gap-x-3 gap-y-1">
                    {platformRegions.map((code) => (
                      <button key={code} type="button" onClick={() => onOverseas(regionRows.get(code)!.slug)} className="underline hover:text-accent-500 min-h-[40px]">
                        {t('ui.global.platforms.item', { region: regionLabel(code), n: regionRows.get(code)!.portalsLive })}
                      </button>
                    ))}
                  </p>
                </details>
              )}
              {noUndergrad.length > 0 && (
                <details className="border border-ink-800 bg-ink-900 rounded-panel px-4 py-3" data-global-no-undergrad={noUndergrad.length}>
                  <summary className="cursor-pointer serif text-lg min-h-[44px] flex items-center">{t(origin === 'cn-mainland' ? 'ui.global.noUndergrad.titleMainland' : 'ui.global.noUndergrad.title', { n: n(noUndergrad.length) })}</summary>
                  <p className="mt-2 text-xs text-fog-500 leading-relaxed">{t('ui.global.noUndergrad.note')}</p>
                  <ul className="mt-3 flex flex-col gap-2">
                    {noUndergrad.map((item) => {
                      const source = hkmotwById.get(item.id)?.channels.find((c) => c.channel === 'postgraduate_only')?.source.url
                      return itemRow(item, { children: source ? <p className="text-xs mono"><a className="tap underline text-fog-300 hover:text-accent-500" href={source} target="_blank" rel="noreferrer noopener">{t('ui.global.noUndergrad.source')} ↗</a></p> : null })
                    })}
                  </ul>
                </details>
              )}
              {result.crossed.length > 0 && (
                <details className="border border-ink-800 bg-ink-900 rounded-panel px-4 py-3" data-global-crossed={result.crossed.length}>
                  <summary className="cursor-pointer serif text-lg min-h-[44px] flex items-center">{t('ui.global.crossed.title', { n: n(result.crossed.length) })}</summary>
                  <ul className="mt-3 flex flex-col gap-2">
                    {result.crossed.map(({ item, reasons }) => itemRow(item, {
                      crossed: true,
                      children: <ul className="flex flex-col gap-1 text-xs text-fog-300 leading-relaxed" data-global-reasons={reasons.length}>{reasons.map((reason, i) => <li key={i} data-global-reason={reason.question}>{reasonText(reason, item)}</li>)}</ul>,
                    }))}
                  </ul>
                </details>
              )}
            </section>
          )
        })}

        {/* 批 G7：按 GRAS 學科彙總剩下機構（只是彙總，不改剩下的）；非大學路徑（企業直招，依目的地與路徑題作答） */}
        <GrasSummary items={results.flatMap((r) => r.kept.map((k) => k.item))} subjects={data.atlas.subjects} itemName={itemDisplayName} />
        <NonUniversityPaths
          destinations={destinations}
          answers={Object.fromEntries(destinations.map((d) => [d, normalizePathAnswer(effectiveAnswers[d]?.directHire) as PathAnswer | null]))}
          struckCountries={new Set(effectiveAnswers.overseas?.regions ?? [])}
        />

        <section className="flex flex-col gap-3 border border-ink-800 bg-ink-900 rounded-panel p-4" data-global-share>
          <h2 className="serif text-xl">{t('ui.global.share.title')}</h2>
          <p className="text-xs text-fog-500 leading-relaxed">{t('ui.global.share.note')}</p>
          <input readOnly value={shareUrl} aria-label={t('ui.global.share.title')} className="w-full max-w-full rounded-ctl border border-ink-700 bg-ink-950 px-3 py-2 text-xs mono text-fog-300 min-h-[40px]" onFocus={(e) => e.currentTarget.select()} data-global-share-url />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copyShare} className="px-4 min-h-[44px] rounded-ctl bg-accent-500 text-ink-950 text-sm font-semibold hover:bg-accent-400">{copied ? t('ui.global.share.copied') : t('ui.global.share.copy')}</button>
            <button type="button" onClick={downloadShare} className="px-4 min-h-[44px] rounded-ctl border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500">{t('ui.global.share.image')}</button>
          </div>
          <div className="overflow-hidden">
            <div ref={shareRef} className="rounded-panel bg-ink-900 border border-ink-800 p-6 flex flex-col gap-3 max-w-xl" data-global-share-card>
              <p className="text-xs mono uppercase tracking-[0.3em] text-fog-500">{t('ui.share.brand')} · {t('ui.global.share.card.title')}</p>
              <p className="serif text-2xl text-fog-100">{t('ui.global.share.card.counts', { kept: n(totalKept), pool: n(totalPool) })}</p>
              {plans.flatMap((plan) => plan.questions.map((q) => (
                <ShareLine key={`${plan.bank}:${q.id}`} label={`${t(`ui.dest.${plan.bank}`)} · ${t(`ui.global.q.${q.id}.title`)}`} values={(effectiveAnswers[plan.bank]?.[q.id] ?? []).map((v) => optionLabel(q.id, v))} />
              )))}
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

/** 一題的選項：多選；「只想讀哪些學科」按門類分組。數字＝單選這一項會劃掉幾所。 */
function QuestionOptions({ q, chosen, pick, optionLabel, familyOf, familyOrder, familyLabel }: {
  q: EvaluatedQuestion; chosen: readonly string[]; pick: (value: string) => void; optionLabel: (q: RegionQuestionId, value: string) => string
  familyOf: ReadonlyMap<string, string>; familyOrder: readonly string[]; familyLabel: (code: string) => string
}) {
  const { t } = useLocale()
  const button = (value: string, crossed: number) => {
    const active = chosen.includes(value)
    const struck = q.kind === 'strike'
    return (
      <button key={value} type="button" aria-pressed={active} data-global-option={value} onClick={() => pick(value)}
        className={['px-3 min-h-[44px] rounded-ctl border text-sm text-left', active ? ['border-accent-500 bg-accent-500/10 text-fog-100', struck ? 'line-through decoration-accent-500' : ''].join(' ') : 'border-ink-700 bg-ink-950 text-fog-300 hover:border-fog-500 hover:text-fog-100'].join(' ')}>
        {active && struck ? t('ui.world.struckPrefix') : ''}{optionLabel(q.id, value)} <span className="mono text-xs text-fog-500">{crossed}</span>
      </button>
    )
  }
  if (q.id === 'wanted') {
    return (
      <div className="flex flex-col gap-4" data-global-options={q.id}>
        {familyOrder.map((family) => {
          const opts = q.options.filter((o) => familyOf.get(o.value) === family)
          if (!opts.length) return null
          return (
            <div key={family} className="flex flex-col gap-2">
              <p className="mono text-xs uppercase tracking-[0.18em] text-fog-500">{familyLabel(family)}</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label={familyLabel(family)}>{opts.map((o) => button(o.value, o.crossed))}</div>
            </div>
          )
        })}
      </div>
    )
  }
  return <div className="flex flex-wrap gap-2" role="group" aria-label={t(`ui.global.q.${q.id}.title`)} data-global-options={q.id}>{q.options.map((o) => button(o.value, o.crossed))}</div>
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
  // 港澳臺考生看自己所在地的院校（聯合招生委員會這類管道彙整除外）：本地入學入口，只有官方頁 live 才上鏈接
  const localEntry = (origin === 'hk' || origin === 'mo' || origin === 'tw') && item.destination === origin && !item.committee ? origin : null
  const localLinks = localEntry ? liveSourceLinks(LOCAL_ENTRY_SOURCES[localEntry]) : []
  // 港澳臺機構在海外層的頁是「非本地生」國際招生頁（批 G6c）：起點＝該機構所在地的本地考生不顯示（本地管道已有本地入學行），
  // 其他起點標明是非本地生的招生條件；資格標示也來自同一頁，本地考生同樣不顯示。
  const localStudent = item.destination !== 'overseas' && item.destination === origin
  const nonLocalPage = item.destination !== 'overseas'
  return (
    <li className={['border rounded-ctl px-4 py-3 flex flex-col gap-2', crossed ? 'border-ink-800 bg-ink-950' : 'border-ink-800 bg-ink-900/78'].join(' ')} data-global-item={item.key}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
        <h3 className="serif text-lg leading-snug">{primary}{secondary ? <span className="text-fog-500 text-sm"> · {secondary}</span> : null}</h3>
        <p className="text-xs mono text-fog-500">{regionLabel(item.region)}</p>
      </div>
      {localEntry ? (
        // 本地入學一句話（批 G6c）：鏈接嵌在句中，分號／句號跟著文字走，不再被拆成以分號開頭的另一行
        <p className="text-xs text-fog-300 leading-relaxed" data-global-channels="local">
          <Rich
            k={`ui.global.localEntry.line.${localEntry}`}
            slots={{ a1: (children) => (localLinks.length > 0
              ? <a className="underline hover:text-accent-500" href={localLinks[0].url} target="_blank" rel="noreferrer noopener" data-local-entry-link>{children} ↗</a>
              : <span>{children}</span>) }}
          />
          {localLinks.slice(1).map(({ url, org }) => <span key={url}> · <a className="underline hover:text-accent-500" href={url} target="_blank" rel="noreferrer noopener">{t(`ui.source.${org}`)} ↗</a></span>)}
        </p>
      ) : item.pool === 'overseas' && item.destination !== 'overseas' && audienceForOrigin(origin) ? (
        <p className="text-xs text-fog-500 leading-relaxed" data-global-channels="none">{t('ui.global.item.channelsNone')}</p>
      ) : item.pool === 'hkmotw' && !notRecruitingFor(item, origin) ? (
        <div className="text-xs text-fog-300 leading-relaxed flex flex-col gap-1" data-global-channels={own && own.length ? own.join('|') : 'none'}>
          {own && own.length > 0
            ? <p>{t('ui.global.item.channels', { channels: own.map(channelLabel).join(t('ui.common.listJoiner')) })}</p>
            : <p className="text-fog-500">{t('ui.global.item.channelsNone')}</p>}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mono">
        {website && <a className="tap text-accent-500 hover:text-accent-400 underline break-all" href={website} target="_blank" rel="noreferrer noopener">{t('ui.global.item.website')}</a>}
        {overseas && !localStudent && (
          <button type="button" onClick={onOverseas} className="tap text-fog-300 hover:text-accent-500 underline text-left" data-global-admissions={nonLocalPage ? 'non-local' : 'international'}>
            {nonLocalPage
              ? (overseas.linkLive ? t('ui.global.item.admissions.nonLocal') : t('ui.global.item.admissions.nonLocalUnread'))
              : (overseas.linkLive ? t('ui.global.item.admissions.live') : t('ui.global.item.admissions.unread'))}
          </button>
        )}
        {item.pool === 'hkmotw' && <button type="button" onClick={onHkMoTw} className="tap text-fog-300 hover:text-accent-500 underline">{t('ui.global.item.hkmotw.open')}</button>}
        {qual === 'listed' && !localStudent && <span className="text-fog-100 border border-accent-500/40 rounded-ctl px-2 py-0.5" data-global-qual="listed">{t('ui.global.qual.listed', { qualification: qualificationLabel })}</span>}
        {qual === 'unread' && item.status === 'verified' && !localStudent && <span className="text-fog-500" data-global-qual="unread">{t('ui.global.qual.unread')}</span>}
      </div>
      {children}
    </li>
  )
}
