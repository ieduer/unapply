import {
  lazy,
  useMemo,
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  Suspense,
  type ReactNode,
} from 'react'
import { SyncNotice } from './shared-ui/SyncNotice'
import { candidateProvinceOptions, defaultCandidateProvince } from './data/admissionAuthorities'
import type { CandidateProvince } from './data/admissionAuthorities'
import { readStoredOrigin, saveOrigin, type OriginRegion } from './data/origins'
import { normalizeOriginPrefs, originPrefsFor, readStoredOriginPrefs, saveOriginPrefs, type OriginPrefs } from './data/originBranch'
import { mainlandAutoSkip, planFlow } from './engine/flowPlan'
import { BANK_STORAGE_KEY } from './engine/regionBanks'
import { consumeExplicitNavigation, hashOf, markExplicitNavigation, recallScroll, rememberScroll } from './lib/router'
import type { ProgramIndexPayload } from './data/programsTypes'
import { loadProgramIndex } from './lib/programsData'
import type { School } from './data/schools'
import { filterSchools } from './engine/filter'
import type { AnswerMap, AnswerValue } from './engine/filter'
import { allQuestions } from './data/questions'
import { getSessionKey, recordUnapplyEvent, syncUnapplyProgress } from './lib/bdfzIdentity'
import { buildUnapplyResultEvidence } from './lib/learningEvidence'
import { loadSchools } from './lib/runtimeData'
import {
  beginUnapplyAPlusSession,
  completeUnapplyAPlusSession,
  getUnapplyAPlusStatus,
  recordUnapplyAPlusAnswers,
  resetUnapplyAPlusSession,
  resumeUnapplyAPlusRecovery,
  subscribeUnapplyAPlusStatus,
} from './lib/trustedAPlus'
import type { UnapplyAPlusSyncStatus } from './lib/trustedAPlus'
import { useLocale } from './i18n/react'

import { Landing } from './components/Landing'
import { QuestionRunner } from './components/QuestionRunner'
import { ResultPage } from './components/ResultPage'
import { AboutPage } from './components/AboutPage'
import { SchoolDetail } from './components/SchoolDetail'
import { ContributePage } from './components/ContributePage'

// 世界學科地圖只在進入 #/world 時載入，首頁與問卷的主包不帶它。
const WorldAtlasPage = lazy(() => import('./components/WorldAtlasPage').then((module) => ({ default: module.WorldAtlasPage })))
// 港澳臺院校池同樣只在進入 #/hkmotw 時載入。
const HkMoTwPage = lazy(() => import('./components/HkMoTwPage').then((module) => ({ default: module.HkMoTwPage })))
// 海外可申請學校（S3）只在進入 #/overseas 時載入；地區檔再按需載。
const OverseasPage = lazy(() => import('./components/OverseasPage').then((module) => ({ default: module.OverseasPage })))
// 全球池減法（批 G2，展示層）只在進入 #/global 時載入。
const GlobalSubtraction = lazy(() => import('./components/GlobalSubtraction').then((module) => ({ default: module.GlobalSubtraction })))

type Route =
  | { name: 'landing' }
  | { name: 'filter' }
  | { name: 'result' }
  | { name: 'about' }
  | { name: 'contribute' }
  | { name: 'world' }
  | { name: 'hkmotw' }
  | { name: 'overseas'; region: string | null; inst: string | null }
  | { name: 'global' }
  | { name: 'school'; id: string }

function parseRoute(): Route {
  // 去掉 # 和可能的查詢串（供 ContributePage 自行解析）
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  if (!raw) return { name: 'landing' }
  const [head, id, third] = raw.split('/')
  if (head === 'filter') return { name: 'filter' }
  if (head === 'result') return { name: 'result' }
  if (head === 'about') return { name: 'about' }
  if (head === 'contribute') return { name: 'contribute' }
  if (head === 'world') return { name: 'world' }
  if (head === 'hkmotw') return { name: 'hkmotw' }
  if (head === 'global') return { name: 'global' }
  if (head === 'overseas') return { name: 'overseas', region: id ? decodeURIComponent(id) : null, inst: third ? decodeURIComponent(third) : null }
  if (head === 'school' && id) return { name: 'school', id: decodeURIComponent(id) }
  return { name: 'landing' }
}

function hashFor(route: Route): string {
  let hash = '#/'
  if (route.name === 'filter') hash = '#/filter'
  else if (route.name === 'result') hash = '#/result'
  else if (route.name === 'about') hash = '#/about'
  else if (route.name === 'contribute') hash = '#/contribute'
  else if (route.name === 'world') hash = '#/world'
  else if (route.name === 'hkmotw') hash = '#/hkmotw'
  else if (route.name === 'global') hash = '#/global'
  else if (route.name === 'overseas') hash = route.region ? `#/overseas/${encodeURIComponent(route.region)}${route.inst ? `/${encodeURIComponent(route.inst)}` : ''}` : '#/overseas'
  else if (route.name === 'school') hash = `#/school/${encodeURIComponent(route.id)}`
  return hash
}

function navigate(route: Route) {
  const hash = hashFor(route)
  if (window.location.hash !== hash) window.location.hash = hash
}

// 大陸 45 題的作答只存在本分頁（sessionStorage）：重新載入後接著做，關掉分頁就清掉；不含個人資料。
const ANSWERS_STORAGE_KEY = 'unapply.answers.v1'
/** 本分頁是否走完過大陸階段（到過結果頁）：全球頁的「回到大陸結果」用。 */
const MAINLAND_DONE_STORAGE_KEY = 'unapply.mainlandDone.v1'

function readMainlandDone(): boolean {
  try { return window.sessionStorage.getItem(MAINLAND_DONE_STORAGE_KEY) === '1' } catch { return false }
}

function saveMainlandDone(done: boolean) {
  try {
    if (done) window.sessionStorage.setItem(MAINLAND_DONE_STORAGE_KEY, '1')
    else window.sessionStorage.removeItem(MAINLAND_DONE_STORAGE_KEY)
  } catch {
    // 存不下就算了
  }
}

function readStoredAnswers(): AnswerMap {
  try {
    const raw = window.sessionStorage.getItem(ANSWERS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const ids = new Set<string>(allQuestions.map((question) => question.id))
    const out: AnswerMap = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!ids.has(key)) continue
      if (value === null || typeof value === 'string' || (Array.isArray(value) && value.every((v) => typeof v === 'string'))) out[key as keyof AnswerMap] = value as AnswerValue
    }
    return out
  } catch {
    return {}
  }
}

function saveStoredAnswers(answers: AnswerMap) {
  try {
    if (Object.keys(answers).length === 0) window.sessionStorage.removeItem(ANSWERS_STORAGE_KEY)
    else window.sessionStorage.setItem(ANSWERS_STORAGE_KEY, JSON.stringify(answers))
  } catch {
    // 存不下就算了，本次會話仍然生效
  }
}

function routeNeedsSchools(route: Route): boolean {
  return route.name === 'filter' || route.name === 'result' || route.name === 'school' || route.name === 'contribute'
}

function CatalogLoading({
  error,
  onBack,
  onRetry,
}: {
  error: string | null;
  onBack: () => void;
  onRetry: () => void;
}) {
  const { t } = useLocale()
  return (
    <main className="min-h-screen app-canvas text-fog-100 flex items-center justify-center px-5" data-loading={error ? undefined : ''}>
      <section className="w-full max-w-md border border-ink-800 bg-ink-900 rounded-xl p-6 flex flex-col gap-4">
        <p className="mono text-xs text-fog-500 uppercase tracking-[0.2em]">{t('ui.app.catalogKicker')}</p>
        <h1 className="serif text-2xl">{error ? t('ui.app.catalogLoadFailed') : t('ui.app.catalogLoading')}</h1>
        <p className="text-sm text-fog-500 leading-relaxed">
          {error ?? t('ui.app.catalogLoadingNote')}
        </p>
        <div className="flex flex-wrap gap-3">
          {error && (
            <button
              onClick={onRetry}
              className="px-5 py-3 rounded-full bg-accent-500 text-ink-950 text-sm font-semibold hover:bg-accent-400"
            >
              {t('ui.common.retryLoad')}
            </button>
          )}
          <button
            onClick={onBack}
            className="px-5 py-3 rounded-full border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500"
          >
            {t('ui.common.backHome')}
          </button>
        </div>
      </section>
    </main>
  )
}

function PageLoading() {
  const { t } = useLocale()
  return (
    <main className="min-h-screen app-canvas text-fog-100 flex items-center justify-center px-5">
      <p className="mono text-xs uppercase tracking-[0.2em] text-fog-500">{t('ui.app.loading')}</p>
    </main>
  )
}

function EvidenceSyncNotice({ status }: { status: UnapplyAPlusSyncStatus }) {
  const { t } = useLocale()
  // 提示文字以鍵翻譯（ui.aplus.*）；shared-ui 的 SyncNotice 階段標籤由本站傳入三語值（2026-11-08 批 G3；path.bdfz.net 不傳，維持原字串）。
  return <SyncNotice phase={status.phase} message={t(status.messageKey)} labels={{ verified: t('ui.sync.verified'), error: t('ui.sync.error'), syncing: t('ui.sync.syncing') }} />
}

const CANDIDATE_PROVINCE_STORAGE_KEY = 'unapply.candidateProvince.v1'

function readStoredCandidateProvince(): CandidateProvince {
  try {
    const stored = window.localStorage.getItem(CANDIDATE_PROVINCE_STORAGE_KEY)
    if (stored && (candidateProvinceOptions as string[]).includes(stored)) {
      return stored as CandidateProvince
    }
  } catch {
    // 隱私模式/禁用儲存時直接用預設，不讓它變成報錯
  }
  return defaultCandidateProvince
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute())
  const [answers, setAnswersState] = useState<AnswerMap>(() => readStoredAnswers())
  const setAnswers = useCallback((next: AnswerMap) => {
    setAnswersState(next)
    saveStoredAnswers(next)
  }, [])
  const [mainlandDone, setMainlandDoneState] = useState(() => readMainlandDone())
  const setMainlandDone = useCallback((done: boolean) => {
    setMainlandDoneState(done)
    saveMainlandDone(done)
  }, [])
  // 考生地區是篩選上下文，不是問卷答案：A6 的招生管道逐省不同，
  // 但它不能進 AnswerMap，否則會污染學習證據契約。
  const [candidateProvince, setCandidateProvinceState] = useState<CandidateProvince>(readStoredCandidateProvince)
  // 所在地／升學身份是起點（決定從哪個題庫開始），同樣不進 AnswerMap。
  const [origin, setOriginState] = useState<OriginRegion | null>(() => readStoredOrigin())
  // 起點之後的資格與目的地（批 G6），同樣只存 localStorage、不進 AnswerMap；換起點時重設。
  const [originPrefs, setOriginPrefsState] = useState<OriginPrefs>(() => readStoredOriginPrefs(readStoredOrigin()))
  // 逐校招生專業摘要：S1／S2 兩題的學校取值由它算，所以和學校目錄一樣是問卷的前置資料（Function 重算用同一份）。
  const [programsIndex, setProgramsIndex] = useState<ProgramIndexPayload | null>(null)
  const [programsError, setProgramsError] = useState<string | null>(null)
  const [schools, setSchools] = useState<School[] | null>(null)
  const [schoolLoadError, setSchoolLoadError] = useState<string | null>(null)
  const evidenceStatus = useSyncExternalStore(
    subscribeUnapplyAPlusStatus,
    getUnapplyAPlusStatus,
    getUnapplyAPlusStatus,
  )

  // 捲動與焦點（批 G6）：站內導航捲到頂部；瀏覽器返回／前進還原離開時的位置；路由變化後焦點移到頁面主標題。
  const routeKey = hashFor(route)
  const routeKeyRef = useRef(routeKey)
  const firstRoute = useRef(true)
  useEffect(() => {
    // 捲動位置由本站按路由記錄與還原；關掉瀏覽器的自動還原，免得返回時先套用上一頁的位置
    try { if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual' } catch { /* 舊瀏覽器 */ }
    const onHash = (event: HashChangeEvent) => {
      // go() 已經渲染了新路由時不要記（那時已捲到頂部）；返回／前進與頁內鏈接才記離開頁的位置
      if (routeKeyRef.current !== hashOf(event.newURL)) rememberScroll(hashOf(event.oldURL), window.scrollY)
      setRoute(parseRoute())
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useLayoutEffect(() => {
    routeKeyRef.current = routeKey
    if (firstRoute.current) { firstRoute.current = false; consumeExplicitNavigation(); return }
    const top = consumeExplicitNavigation() ? 0 : recallScroll(routeKey)
    window.scrollTo(0, top)
    const restore = window.setTimeout(() => { if (top > 0) window.scrollTo(0, top) }, 120)
    // 懶載頁面與資料載入後才有主標題：最多等 9 秒；使用者已經把焦點移走就不搶
    let tries = 0
    // 點擊導航時被點的按鈕可能還握著焦點（舊頁還沒卸載）：它或 body 都算「使用者還沒自己移走焦點」
    const before = document.activeElement
    // 懶載頁面切換期間舊頁還留在畫面上（React 保留舊內容直到新頁載好）：先拿到的可能是舊頁標題，
    // 它被換掉後焦點會掉回 body——所以在等待期內持續檢查，已聚焦的標題不在了就改聚焦新頁標題。
    let focused: HTMLElement | null = null
    const focusHeading = () => {
      const active = document.activeElement
      const idle = !active || active === document.body || active === before || (focused !== null && active === focused)
      if (!idle) return // 使用者（或頁面自己的換題焦點）已經移走焦點，不搶
      if (!focused || !focused.isConnected) {
        // 載入畫面（data-loading）的標題不算：它馬上會被頁面換掉
        const heading = document.querySelector<HTMLElement>('main:not([data-loading]) h1') ?? document.querySelector<HTMLElement>('main:not([data-loading]) h2')
        if (heading) {
          if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
          heading.focus({ preventScroll: true })
          focused = heading
        }
      }
      if (tries < 60) { tries += 1; focusTimer = window.setTimeout(focusHeading, 150) }
    }
    let focusTimer = window.setTimeout(focusHeading, 0)
    return () => { window.clearTimeout(restore); window.clearTimeout(focusTimer) }
  }, [routeKey])

  useEffect(() => {
    const recover = () => {
      resumeUnapplyAPlusRecovery().then(() => undefined).catch(() => undefined)
    }
    recover()
    window.addEventListener('online', recover)
    return () => window.removeEventListener('online', recover)
  }, [])

  const setCandidateProvince = useCallback((province: CandidateProvince) => {
    setCandidateProvinceState(province)
    try {
      window.localStorage.setItem(CANDIDATE_PROVINCE_STORAGE_KEY, province)
    } catch {
      // 存不下就算了，本次會話仍然生效
    }
  }, [])

  // 換起點：資格清空、目的地重設為該起點預設、全球減法選擇重設（批 G6 裁定 A）；點同一個起點不動。
  const setOrigin = useCallback((next: OriginRegion) => {
    if (next === origin) return
    setOriginState(next)
    saveOrigin(next)
    const fresh = originPrefsFor(next)
    setOriginPrefsState(fresh)
    saveOriginPrefs(fresh)
    try { window.localStorage.removeItem(BANK_STORAGE_KEY); window.sessionStorage.removeItem('unapply.regionStep.v1') } catch { /* 存不下就算了 */ }
  }, [origin])

  const setOriginPrefs = useCallback((next: OriginPrefs) => {
    const normalized = normalizeOriginPrefs(origin, next)
    setOriginPrefsState(normalized)
    saveOriginPrefs(normalized)
  }, [origin])

  const go = useCallback((r: Route) => {
    rememberScroll(window.location.hash ? hashOf(window.location.hash) : '#/', window.scrollY)
    markExplicitNavigation()
    navigate(r)
    setRoute(r)
  }, [])

  // 起點與目的地 → 流程（純函式 planFlow；不碰 AnswerMap）
  const plan = useMemo(() => planFlow(origin, originPrefs.destinations, originPrefs.qualification), [origin, originPrefs])

  useEffect(() => {
    if (!routeNeedsSchools(route) || schools || schoolLoadError) return
    let alive = true
    void loadSchools()
      .then((loadedSchools) => {
        if (alive) setSchools(loadedSchools)
      })
      .catch((err: unknown) => {
        if (!alive) return
        setSchoolLoadError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      alive = false
    }
  }, [route, schoolLoadError, schools])

  useEffect(() => {
    if (route.name === 'filter') {
      beginUnapplyAPlusSession().then(() => undefined).catch(() => undefined)
    }
  }, [route.name])

  // 每校招生專業摘要（約 150 KiB gzip）與學校目錄一起作為問卷／結果／詳情的前置資料；完整清單在詳情頁按省分桶再載。
  useEffect(() => {
    if (!routeNeedsSchools(route) || programsIndex || programsError) return
    let alive = true
    // loadProgramIndex 內部快取同一個 promise，重複進入不會重抓。
    loadProgramIndex()
      .then((payload) => { if (alive) setProgramsIndex(payload) })
      .catch((err: unknown) => { if (alive) setProgramsError(err instanceof Error ? err.message : String(err)) })
    return () => { alive = false }
  }, [programsError, programsIndex, route])

  // 篩選上下文：考生省份（A6）＋逐校招生專業摘要（S1／S2）。Function 重算時用同一份釘定的 payload 建同樣的上下文。
  const filterContext = useMemo(() => ({ candidateProvince, programs: programsIndex ?? undefined }), [candidateProvince, programsIndex])
  const result = useMemo(
    () => schools ? filterSchools(schools, answers, filterContext) : null,
    [answers, filterContext, schools],
  )
  const retrySchoolLoad = useCallback(() => {
    setSchoolLoadError(null)
    setSchools(null)
    setProgramsError(null)
    setProgramsIndex(null)
  }, [])

  const handleAnswerChange = useCallback((nextAnswers: AnswerMap, changedQuestionId: string) => {
    setAnswers(nextAnswers)
    recordUnapplyAPlusAnswers(nextAnswers, changedQuestionId).then(() => undefined).catch(() => undefined)
  }, [setAnswers])

  const handleFinish = useCallback(() => {
    if (!result) return
    const evidence = buildUnapplyResultEvidence(result.stats, getSessionKey(), window.location.href)
    if (evidence) {
      void syncUnapplyProgress(evidence.progress)
      void recordUnapplyEvent(evidence.event)
    }
    completeUnapplyAPlusSession(answers, candidateProvince).then(() => undefined).catch(() => undefined)
    setMainlandDone(true)
    go({ name: 'result' })
  }, [answers, candidateProvince, result, go, setMainlandDone])

  // 進大陸題（任何入口）：使用者明確要看中國大陸，目的地補上中國大陸，流程與「下一步」「回到大陸結果」才一致
  const startMainland = useCallback(() => {
    if (!originPrefs.destinations.includes('cn-mainland')) setOriginPrefs({ ...originPrefs, destinations: ['cn-mainland', ...originPrefs.destinations] })
    beginUnapplyAPlusSession().then(() => undefined).catch(() => undefined)
    go({ name: 'filter' })
  }, [go, originPrefs, setOriginPrefs])

  // 首頁唯一的主按鈕：含中國大陸先進大陸 45 題，否則直接進全球減法
  const startFlow = useCallback(() => {
    if (plan.entry === 'filter') startMainland()
    else go({ name: 'global' })
  }, [plan.entry, startMainland, go])

  const mainlandAnswered = mainlandDone

  const goOverseas = useCallback((region: string | null = null, inst: string | null = null) => go({ name: 'overseas', region, inst }), [go])

  const landingPage = (
    <Landing
      origin={origin}
      originPrefs={originPrefs}
      onOriginChange={setOrigin}
      onOriginPrefsChange={setOriginPrefs}
      onStart={startFlow}
      onWorld={() => go({ name: 'world' })}
      onHkMoTw={() => go({ name: 'hkmotw' })}
      onOverseas={() => goOverseas()}
      onContribute={() => go({ name: 'contribute' })}
    />
  )

  if (routeNeedsSchools(route) && (!schools || schoolLoadError || !programsIndex || programsError)) {
    return (
      <>
        <CatalogLoading error={schoolLoadError ?? programsError} onBack={() => go({ name: 'landing' })} onRetry={retrySchoolLoad} />
        <EvidenceSyncNotice status={evidenceStatus} />
      </>
    )
  }

  let page: ReactNode = null

  if (route.name === 'landing') {
    page = landingPage
  } else if (route.name === 'filter') {
    if (schools) {
      page = (
        <QuestionRunner
          allSchools={schools}
          origin={origin}
          autoSkip={mainlandAutoSkip(origin)}
          answers={answers}
          candidateProvince={candidateProvince}
          onCandidateProvinceChange={setCandidateProvince}
          programs={programsIndex}
          onAnswerChange={handleAnswerChange}
          onFinish={handleFinish}
          onBack={() => go({ name: 'landing' })}
        />
      )
    }
  } else if (route.name === 'result') {
    if (result) {
      page = (
        <ResultPage
          result={result}
          answers={answers}
          origin={origin}
          originPrefs={originPrefs}
          plan={plan}
          programsIndex={programsIndex}
          candidateProvince={candidateProvince}
          onCandidateProvinceChange={setCandidateProvince}
          onRestart={() => {
            resetUnapplyAPlusSession()
            setAnswers({})
            setMainlandDone(false)
            go({ name: 'filter' })
          }}
          onRelax={() => go({ name: 'filter' })}
          onSchool={(id) => go({ name: 'school', id })}
          onAbout={() => go({ name: 'about' })}
          onContribute={() => go({ name: 'contribute' })}
          onWorld={() => go({ name: 'world' })}
          onHkMoTw={() => go({ name: 'hkmotw' })}
          onOverseas={() => goOverseas()}
          onGlobal={() => go({ name: 'global' })}
          onHome={() => go({ name: 'landing' })}
        />
      )
    }
  } else if (route.name === 'about') {
    page = <AboutPage onBack={() => go({ name: 'landing' })} />
  } else if (route.name === 'world') {
    page = (
      <WorldAtlasPage
        origin={origin}
        onBack={() => go({ name: 'landing' })}
        onAbout={() => go({ name: 'about' })}
        onSchool={(id) => go({ name: 'school', id })}
        onStartMainland={startMainland}
        onHkMoTw={() => go({ name: 'hkmotw' })}
        onOverseas={goOverseas}
      />
    )
  } else if (route.name === 'hkmotw') {
    page = (
      <HkMoTwPage
        origin={origin}
        originPrefs={originPrefs}
        onBack={() => go({ name: 'landing' })}
        onAbout={() => go({ name: 'about' })}
        onWorld={() => go({ name: 'world' })}
        onStartMainland={startMainland}
      />
    )
  } else if (route.name === 'overseas') {
    page = (
      <OverseasPage
        origin={origin}
        originPrefs={originPrefs}
        onOriginPrefsChange={setOriginPrefs}
        regionSlug={route.region}
        institutionId={route.inst}
        onNavigate={(region, inst) => goOverseas(region, inst ?? null)}
        onBack={() => go({ name: 'landing' })}
        onAbout={() => go({ name: 'about' })}
        onWorld={() => go({ name: 'world' })}
        onHkMoTw={() => go({ name: 'hkmotw' })}
        onStartMainland={startMainland}
      />
    )
  } else if (route.name === 'global') {
    page = (
      <GlobalSubtraction
        origin={origin}
        originPrefs={originPrefs}
        onOriginPrefsChange={setOriginPrefs}
        mainlandStage={plan.stages.includes('mainland') ? (mainlandAnswered ? 'answered' : 'unanswered') : null}
        onBackToMainland={() => (mainlandAnswered ? go({ name: 'result' }) : startMainland())}
        onBack={() => go({ name: 'landing' })}
        onHkMoTw={() => go({ name: 'hkmotw' })}
        onOverseas={(region, inst) => goOverseas(region ?? null, inst ?? null)}
      />
    )
  } else if (route.name === 'contribute') {
    if (schools) page = <ContributePage schools={schools} onBack={() => go({ name: 'result' })} />
  } else if (route.name === 'school') {
    if (schools) {
      const school = schools.find(s => s.id === route.id)
      page = school
        ? (
          <SchoolDetail
            school={school}
            programsIndex={programsIndex}
            answers={answers}
            candidateProvince={candidateProvince}
            onCandidateProvinceChange={setCandidateProvince}
            onBack={() => history.length > 1 ? history.back() : go({ name: 'result' })}
          />
        )
        : landingPage
    }
  }

  return (
    <>
      <Suspense fallback={<PageLoading />}>
        {page}
      </Suspense>
      {/* 色系切換改在各頁共用頁頭 SiteHeader 內（inline），不再全域浮在右上角（2026-11-08 修頁頭重疊） */}
      <EvidenceSyncNotice status={evidenceStatus} />
    </>
  )
}
