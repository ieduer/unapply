import {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useSyncExternalStore,
  lazy,
  Suspense,
  type ReactNode,
} from 'react'
import { ThemeCustomizer } from './components/ThemeCustomizer'
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

const Landing = lazy(async () => ({ default: (await import('./components/Landing')).Landing }))
const QuestionRunner = lazy(async () => ({ default: (await import('./components/QuestionRunner')).QuestionRunner }))
const ResultPage = lazy(async () => ({ default: (await import('./components/ResultPage')).ResultPage }))
const AboutPage = lazy(async () => ({ default: (await import('./components/AboutPage')).AboutPage }))
const SchoolDetail = lazy(async () => ({ default: (await import('./components/SchoolDetail')).SchoolDetail }))
const ContributePage = lazy(async () => ({ default: (await import('./components/ContributePage')).ContributePage }))

type Route =
  | { name: 'landing' }
  | { name: 'filter' }
  | { name: 'result' }
  | { name: 'about' }
  | { name: 'contribute' }
  | { name: 'school'; id: string }

function parseRoute(): Route {
  // 去掉 # 和可能的查詢串（供 ContributePage 自行解析）
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  if (!raw) return { name: 'landing' }
  const [head, id] = raw.split('/')
  if (head === 'filter') return { name: 'filter' }
  if (head === 'result') return { name: 'result' }
  if (head === 'about') return { name: 'about' }
  if (head === 'contribute') return { name: 'contribute' }
  if (head === 'school' && id) return { name: 'school', id: decodeURIComponent(id) }
  return { name: 'landing' }
}

function navigate(route: Route) {
  let hash = '#/'
  if (route.name === 'filter') hash = '#/filter'
  else if (route.name === 'result') hash = '#/result'
  else if (route.name === 'about') hash = '#/about'
  else if (route.name === 'contribute') hash = '#/contribute'
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
  return (
    <main className="min-h-screen app-canvas text-fog-100 flex items-center justify-center px-5">
      <section className="w-full max-w-md border border-ink-800 bg-ink-900 rounded-xl p-6 flex flex-col gap-4">
        <p className="mono text-xs text-fog-500 uppercase tracking-[0.2em]">school catalog</p>
        <h1 className="serif text-2xl">{error ? '目錄載入失敗' : '正在載入官方目錄'}</h1>
        <p className="text-sm text-fog-500 leading-relaxed">
          {error ?? '第一次進入問卷時才載入 2919 所普通高校數據，首頁不預載完整名單。'}
        </p>
        <div className="flex flex-wrap gap-3">
          {error && (
            <button
              onClick={onRetry}
              className="px-5 py-3 rounded-full bg-accent-500 text-ink-950 text-sm font-semibold hover:bg-accent-400"
            >
              重試載入
            </button>
          )}
          <button
            onClick={onBack}
            className="px-5 py-3 rounded-full border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500"
          >
            返回首頁
          </button>
        </div>
      </section>
    </main>
  )
}

function PageLoading() {
  return (
    <main className="min-h-screen app-canvas text-fog-100 flex items-center justify-center px-5">
      <p className="mono text-xs uppercase tracking-[0.2em] text-fog-500">loading</p>
    </main>
  )
}

function EvidenceSyncNotice({ status }: { status: UnapplyAPlusSyncStatus }) {
  if (status.phase === 'idle') return null
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-1/2 z-50 w-[min(92vw,34rem)] -translate-x-1/2 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
        status.phase === 'verified'
          ? 'border-emerald-300/30 bg-emerald-950/90 text-emerald-100'
          : status.phase === 'error'
            ? 'border-rose-300/30 bg-rose-950/90 text-rose-100'
            : 'border-accent-500/30 bg-ink-900/95 text-accent-400'
      }`}
    >
      <span className="font-semibold">
        {status.phase === 'verified'
          ? '已核验'
          : status.phase === 'error'
            ? '核验未完成'
            : '同步核验中'}
      </span>
      <span className="ml-2 opacity-80">{status.message}</span>
    </div>
  )
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute())
  const [answers, setAnswers] = useState<AnswerMap>({})
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

  const result = useMemo(() => schools ? filterSchools(schools, answers) : null, [answers, schools])
  const retrySchoolLoad = useCallback(() => {
    setSchoolLoadError(null)
    setSchools(null)
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
    completeUnapplyAPlusSession(answers).then(() => undefined).catch(() => undefined)
    go({ name: 'result' })
  }, [answers, result, go])

  if (routeNeedsSchools(route) && (!schools || schoolLoadError)) {
    return (
      <>
        <CatalogLoading error={schoolLoadError} onBack={() => go({ name: 'landing' })} onRetry={retrySchoolLoad} />
        <EvidenceSyncNotice status={evidenceStatus} />
      </>
    )
  }

  let page: ReactNode = null

  if (route.name === 'landing') {
    page = <Landing onStart={() => {
      beginUnapplyAPlusSession().then(() => undefined).catch(() => undefined)
      go({ name: 'filter' })
    }} onAbout={() => go({ name: 'about' })} onContribute={() => go({ name: 'contribute' })} />
  } else if (route.name === 'filter') {
    if (schools) {
      page = (
        <QuestionRunner
          allSchools={schools}
          answers={answers}
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
          onRestart={() => {
            resetUnapplyAPlusSession()
            setAnswers({})
            go({ name: 'filter' })
          }}
          onRelax={() => go({ name: 'filter' })}
          onSchool={(id) => go({ name: 'school', id })}
          onAbout={() => go({ name: 'about' })}
          onContribute={() => go({ name: 'contribute' })}
        />
      )
    }
  } else if (route.name === 'about') {
    page = <AboutPage onBack={() => go({ name: 'landing' })} />
  } else if (route.name === 'contribute') {
    if (schools) page = <ContributePage schools={schools} onBack={() => go({ name: 'result' })} />
  } else if (route.name === 'school') {
    if (schools) {
      const school = schools.find(s => s.id === route.id)
      page = school
        ? <SchoolDetail school={school} onBack={() => history.length > 1 ? history.back() : go({ name: 'result' })} />
        : <Landing onStart={() => go({ name: 'filter' })} onAbout={() => go({ name: 'about' })} onContribute={() => go({ name: 'contribute' })} />
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
