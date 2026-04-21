import { useMemo, useState, useCallback, useEffect } from 'react'
import { Landing } from './components/Landing'
import { QuestionRunner } from './components/QuestionRunner'
import { ResultPage } from './components/ResultPage'
import { AboutPage } from './components/AboutPage'
import { SchoolDetail } from './components/SchoolDetail'
import { ContributePage } from './components/ContributePage'
import { schools } from './data/schools'
import { filterSchools } from './engine/filter'
import type { AnswerMap } from './engine/filter'
import { recordUnapplyEvent } from './lib/bdfzIdentity'

type Route =
  | { name: 'landing' }
  | { name: 'filter' }
  | { name: 'result' }
  | { name: 'about' }
  | { name: 'contribute' }
  | { name: 'school'; id: string }

function parseRoute(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '')
  if (!hash) return { name: 'landing' }
  const [head, id] = hash.split('/')
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

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute())
  const [answers, setAnswers] = useState<AnswerMap>({})

  useEffect(() => {
    const onHash = () => setRoute(parseRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((r: Route) => {
    navigate(r)
    setRoute(r)
  }, [])

  const result = useMemo(() => filterSchools(schools, answers), [answers])

  const handleFinish = useCallback(() => {
    void recordUnapplyEvent({
      recordKind: 'event',
      recordKey: `filter-${Date.now().toString(36)}`,
      title: '不考大學指南 · 一輪減法完成',
      summary: `從 ${result.stats.totalInput} 所中劃掉 ${result.stats.excludedCount} 所，剩 ${result.stats.keptCount} 所`,
      payload: {
        answers,
        stats: result.stats,
      },
    })
    go({ name: 'result' })
  }, [answers, result, go])

  if (route.name === 'landing') {
    return <Landing onStart={() => go({ name: 'filter' })} onAbout={() => go({ name: 'about' })} />
  }
  if (route.name === 'filter') {
    return (
      <QuestionRunner
        allSchools={schools}
        answers={answers}
        onAnswerChange={setAnswers}
        onFinish={handleFinish}
        onBack={() => go({ name: 'landing' })}
      />
    )
  }
  if (route.name === 'result') {
    return (
      <ResultPage
        result={result}
        answers={answers}
        onRestart={() => {
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
  if (route.name === 'about') {
    return <AboutPage onBack={() => go({ name: 'landing' })} />
  }
  if (route.name === 'contribute') {
    return <ContributePage onBack={() => go({ name: 'result' })} />
  }
  if (route.name === 'school') {
    const school = schools.find(s => s.id === route.id)
    if (!school) return <Landing onStart={() => go({ name: 'filter' })} onAbout={() => go({ name: 'about' })} />
    return <SchoolDetail school={school} onBack={() => history.length > 1 ? history.back() : go({ name: 'result' })} />
  }

  return null
}
