import {
  lazy,
  useMemo,
  useState,
  useCallback,
  useEffect,
  useSyncExternalStore,
  Suspense,
  type ReactNode,
} from 'react'
import { SyncNotice } from './shared-ui/SyncNotice'
import { ThemeCustomizer } from './shared-ui/ThemeCustomizer'
import { candidateProvinceOptions, defaultCandidateProvince } from './data/admissionAuthorities'
import type { CandidateProvince } from './data/admissionAuthorities'
import { readStoredOrigin, saveOrigin, type OriginRegion } from './data/origins'
import { emptyOriginPrefs, normalizeOriginPrefs, readStoredOriginPrefs, saveOriginPrefs, type OriginPrefs } from './data/originBranch'
import type { ProgramIndexPayload } from './data/programsTypes'
import { loadProgramIndex } from './lib/programsData'
import type { School } from './data/schools'
import { filterSchools } from './engine/filter'
import type { AnswerMap } from './engine/filter'
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

type Route =
  | { name: 'landing' }
  | { name: 'filter' }
  | { name: 'result' }
  | { name: 'about' }
  | { name: 'contribute' }
  | { name: 'world' }
  | { name: 'hkmotw' }
  | { name: 'overseas'; region: string | null; inst: string | null }
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
  if (head === 'overseas') return { name: 'overseas', region: id ? decodeURIComponent(id) : null, inst: third ? decodeURIComponent(third) : null }
  if (head === 'school' && id) return { name: 'school', id: decodeURIComponent(id) }
  return { name: 'landing' }
}

function navigate(route: Route) {
  let hash = '#/'
  if (route.name === 'filter') hash = '#/filter'
  else if (route.name === 'result') hash = '#/result'
  else if (route.name === 'about') hash = '#/about'
  else if (route.name === 'contribute') hash = '#/contribute'
  else if (route.name === 'world') hash = '#/world'
  else if (route.name === 'hkmotw') hash = '#/hkmotw'
  else if (route.name === 'overseas') hash = route.region ? `#/overseas/${encodeURIComponent(route.region)}${route.inst ? `/${encodeURIComponent(route.inst)}` : ''}` : '#/overseas'
  else if (route.name === 'school') hash = `#/school/${encodeURIComponent(route.id)}`
  if (window.location.hash !== hash) window.location.hash = hash
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
    <main className="min-h-screen app-canvas text-fog-100 flex items-center justify-center px-5">
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
  // 提示文字以鍵翻譯（ui.aplus.*）；shared-ui 的 SyncNotice 階段標籤（已核验／核验未完成／同步核验中）與 path.bdfz.net 逐位元組相同，不在本站翻譯。
  return <SyncNotice phase={status.phase} message={t(status.messageKey)} />
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
  const [answers, setAnswers] = useState<AnswerMap>({})
  // 考生地區是篩選上下文，不是問卷答案：A6 的招生管道逐省不同，
  // 但它不能進 AnswerMap，否則會污染學習證據契約。
  const [candidateProvince, setCandidateProvinceState] = useState<CandidateProvince>(readStoredCandidateProvince)
  // 所在地／升學身份是起點（決定從哪個題庫開始），同樣不進 AnswerMap。
  const [origin, setOriginState] = useState<OriginRegion | null>(() => readStoredOrigin())
  // 起點分支（批 E2）：資格與範圍，同樣只存 localStorage、不進 AnswerMap；換起點時無效的值歸零。
  const [originPrefs, setOriginPrefsState] = useState<OriginPrefs>(() => normalizeOriginPrefs(readStoredOrigin(), readStoredOriginPrefs()))
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

  useEffect(() => {
    const onHash = () => setRoute(parseRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

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

  const setOrigin = useCallback((next: OriginRegion) => {
    setOriginState(next)
    saveOrigin(next)
    setOriginPrefsState((current) => {
      const normalized = normalizeOriginPrefs(next, current)
      saveOriginPrefs(normalized)
      return normalized
    })
  }, [])

  const setOriginPrefs = useCallback((next: OriginPrefs) => {
    const normalized = origin ? normalizeOriginPrefs(origin, next) : emptyOriginPrefs
    setOriginPrefsState(normalized)
    saveOriginPrefs(normalized)
  }, [origin])

  const go = useCallback((r: Route) => {
    navigate(r)
    setRoute(r)
  }, [])

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
  }, [])

  const handleFinish = useCallback(() => {
    if (!result) return
    const evidence = buildUnapplyResultEvidence(result.stats, getSessionKey(), window.location.href)
    if (evidence) {
      void syncUnapplyProgress(evidence.progress)
      void recordUnapplyEvent(evidence.event)
    }
    completeUnapplyAPlusSession(answers, candidateProvince).then(() => undefined).catch(() => undefined)
    go({ name: 'result' })
  }, [answers, candidateProvince, result, go])

  const startMainland = useCallback(() => {
    beginUnapplyAPlusSession().then(() => undefined).catch(() => undefined)
    go({ name: 'filter' })
  }, [go])

  const goOverseas = useCallback((region: string | null = null, inst: string | null = null) => go({ name: 'overseas', region, inst }), [go])

  const landingPage = (
    <Landing
      origin={origin}
      originPrefs={originPrefs}
      onOriginChange={setOrigin}
      onOriginPrefsChange={setOriginPrefs}
      onStart={startMainland}
      onWorld={() => go({ name: 'world' })}
      onHkMoTw={() => go({ name: 'hkmotw' })}
      onOverseas={() => goOverseas()}
      onAbout={() => go({ name: 'about' })}
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
          programsIndex={programsIndex}
          candidateProvince={candidateProvince}
          onCandidateProvinceChange={setCandidateProvince}
          onRestart={() => {
            resetUnapplyAPlusSession()
            setAnswers({})
            go({ name: 'filter' })
          }}
          onRelax={() => go({ name: 'filter' })}
          onSchool={(id) => go({ name: 'school', id })}
          onAbout={() => go({ name: 'about' })}
          onContribute={() => go({ name: 'contribute' })}
          onWorld={() => go({ name: 'world' })}
          onHkMoTw={() => go({ name: 'hkmotw' })}
          onOverseas={() => goOverseas()}
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
      <ThemeCustomizer />
      <EvidenceSyncNotice status={evidenceStatus} />
    </>
  )
}
