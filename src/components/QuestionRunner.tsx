import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { allQuestions } from '../data/questions'
import type { Question } from '../data/questions'
import type { School } from '../data/schools'
import type { AnswerMap, AnswerValue } from '../engine/filter'
import { filterSchools } from '../engine/filter'
import { analyzeQuestionCoverage, getVisibleOptions } from '../engine/coverage'

interface Props {
  allSchools: School[]
  answers: AnswerMap
  onAnswerChange: (a: AnswerMap) => void
  onFinish: () => void
  onBack: () => void
}

export function QuestionRunner({ allSchools, answers, onAnswerChange, onFinish, onBack }: Props) {
  const [idx, setIdx] = useState(0)

  const liveResult = useMemo(() => filterSchools(allSchools, answers), [allSchools, answers])
  const coverageByQuestion = useMemo(() => analyzeQuestionCoverage(allSchools), [allSchools])
  const visibleQuestions = useMemo(
    () => allQuestions.filter((question) => coverageByQuestion[question.id]?.active),
    [coverageByQuestion],
  )
  const total = visibleQuestions.length
  const activeIdx = total > 0 ? Math.min(idx, total - 1) : 0
  const q: Question | null = visibleQuestions[activeIdx] ?? null
  const visibleOptions = useMemo(
    () => (q ? getVisibleOptions(q, coverageByQuestion[q.id]) : []),
    [coverageByQuestion, q],
  )
  const shortlistReached = liveResult.stats.keptCount <= 10 && liveResult.stats.answeredCount > 0
  const showShortlistPanel = shortlistReached && liveResult.stats.keptCount > 0

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeIdx])

  if (!q) {
    return (
      <main className="min-h-screen app-canvas text-fog-100 flex items-center justify-center px-5">
        <section className="w-full max-w-md border border-ink-800 bg-ink-900 rounded-xl p-6 flex flex-col gap-4">
          <h1 className="serif text-2xl">暫時無法開始</h1>
          <p className="text-sm text-fog-500 leading-relaxed">
            請先返回首頁，稍後再試。
          </p>
          <button
            onClick={onBack}
            className="self-start px-5 py-3 rounded-full border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500"
          >
            返回首頁
          </button>
        </section>
      </main>
    )
  }

  const current = answers[q.id]

  const setAnswer = (val: AnswerValue) => {
    onAnswerChange({ ...answers, [q.id]: val })
  }

  const toggleMulti = (key: string) => {
    const prev = Array.isArray(current) ? current : []
    const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    setAnswer(next)
  }

  const next = () => {
    if (shortlistReached) {
      onFinish()
      return
    }
    if (activeIdx < total - 1) setIdx(activeIdx + 1)
    else onFinish()
  }

  const prev = () => {
    if (activeIdx > 0) setIdx(activeIdx - 1)
    else onBack()
  }

  const skip = () => {
    if (shortlistReached) {
      onFinish()
      return
    }
    setAnswer('skip')
    next()
  }

  const isCurrent = (key: string) => {
    if (q.type === 'single') return current === key
    if (Array.isArray(current)) return current.includes(key)
    return false
  }

  const canProceed = () => {
    if (!current || current === 'skip') return false
    if (Array.isArray(current)) return current.length > 0
    return true
  }

  const sectionLabel =
    q.section === 'A_redline' ? '紅線' :
    q.section === 'E_environment' ? '環境' :
    q.section === 'B_quality' ? '生活' : '特殊'

  return (
    <main className="min-h-screen app-canvas text-fog-100 flex flex-col">
      <header className="sticky top-0 z-10 backdrop-blur bg-ink-950/80 border-b border-ink-800">
        <div className="max-w-2xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <button
            onClick={prev}
            className="text-xs mono uppercase tracking-[0.2em] text-fog-500 hover:text-accent-500 min-h-[44px] -my-3 py-3 px-1"
          >
            ← {activeIdx === 0 ? '返回' : '上一題'}
          </button>
          <div className="text-xs mono text-fog-500 shrink-0">
            {sectionLabel} · {activeIdx + 1} / {total}
          </div>
          <button
            onClick={skip}
            className="text-xs mono uppercase tracking-[0.2em] text-fog-500 hover:text-accent-500 min-h-[44px] -my-3 py-3 px-1"
          >
            {shortlistReached ? '結果' : '跳過'}
          </button>
        </div>
        <div className="h-[2px] bg-ink-800">
          <div
            className="h-full bg-accent-500 transition-all duration-500"
            style={{ width: `${total > 0 ? ((activeIdx + 1) / total) * 100 : 0}%` }}
          />
        </div>
      </header>

      <section className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 pt-6 pb-32 sm:pt-10 sm:pb-10 flex flex-col gap-8 sm:gap-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-3 sm:gap-4"
          >
            <h2 className="serif text-2xl sm:text-3xl leading-snug">{q.title}</h2>
            {q.subtitle && (
              <p className="text-sm text-fog-500 leading-relaxed">{q.subtitle}</p>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex flex-col gap-3">
          {visibleOptions.map((opt) => {
            const active = isCurrent(opt.key)
            return (
              <button
                key={opt.key}
                onClick={() => (q.type === 'single' ? setAnswer(opt.key) : toggleMulti(opt.key))}
                className={[
                  'text-left px-4 sm:px-5 py-4 rounded-xl border transition-all min-h-[56px]',
                  active
                    ? 'border-accent-500 bg-accent-500/10 text-fog-100'
                    : 'border-ink-700 bg-ink-900 text-fog-300 hover:border-fog-500 hover:text-fog-100 active:border-fog-500',
                ].join(' ')}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={[
                      'inline-block w-4 h-4 rounded-full border shrink-0',
                      active ? 'border-accent-500 bg-accent-500' : 'border-fog-500',
                    ].join(' ')}
                  />
                  <span className="serif text-base leading-snug">{opt.label}</span>
                </div>
                {opt.hint && (
                  <p className="mt-2 ml-7 text-xs text-fog-500 leading-relaxed">{opt.hint}</p>
                )}
              </button>
            )
          })}
        </div>

        {showShortlistPanel && (
          <div className="rounded-2xl border border-accent-500/30 bg-ink-900/80 px-4 py-4 flex flex-col gap-2">
            <p className="serif text-lg text-fog-100">這一題後只剩 {liveResult.stats.keptCount} 所了。</p>
            <p className="text-sm text-fog-300 leading-relaxed">
              這一輪先收束到報告頁，不再往後連做。你可以先看結果；如果想繼續調條件，也可以直接改上一題或清空重來。
            </p>
          </div>
        )}

        <div className="hidden sm:flex items-center justify-between gap-3">
          <div className="mono text-xs text-fog-500">
            實時：已劃掉 <span className="text-accent-500 text-sm">{liveResult.stats.excludedCount}</span>
            {' / '}剩 <span className="text-fog-100 text-sm">{liveResult.stats.keptCount}</span>
          </div>
          <button
            onClick={next}
            disabled={!shortlistReached && !canProceed()}
            className={[
              'px-6 py-3 rounded-full font-semibold text-base transition-all min-h-[48px]',
              shortlistReached || canProceed()
                ? 'bg-accent-500 text-ink-950 hover:bg-accent-400'
                : 'bg-ink-800 text-fog-500 cursor-not-allowed',
            ].join(' ')}
          >
            {shortlistReached ? '生成報告' : activeIdx === total - 1 ? '看結果' : '下一題 →'}
          </button>
        </div>
      </section>

      <div className="sm:hidden sticky bottom-0 left-0 right-0 z-20 bg-ink-950/95 backdrop-blur border-t border-ink-800 px-4 py-3 flex items-center justify-between gap-3">
        <div className="mono text-[11px] text-fog-500 leading-tight">
          劃掉 <span className="text-accent-500 text-sm">{liveResult.stats.excludedCount}</span>
          {' / '}剩 <span className="text-fog-100 text-sm">{liveResult.stats.keptCount}</span>
        </div>
        <button
          onClick={next}
          disabled={!shortlistReached && !canProceed()}
          className={[
            'px-5 py-3 rounded-full font-semibold text-sm transition-all min-h-[44px] shrink-0',
            shortlistReached || canProceed()
              ? 'bg-accent-500 text-ink-950'
              : 'bg-ink-800 text-fog-500 cursor-not-allowed',
          ].join(' ')}
        >
          {shortlistReached ? '生成報告' : activeIdx === total - 1 ? '看結果' : '下一題 →'}
        </button>
      </div>
    </main>
  )
}
