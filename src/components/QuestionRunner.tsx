import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { allQuestions } from '../data/questions'
import type { Question } from '../data/questions'
import type { School } from '../data/schools'
import type { AnswerMap, AnswerValue } from '../engine/filter'
import { filterSchools } from '../engine/filter'

interface Props {
  allSchools: School[]
  answers: AnswerMap
  onAnswerChange: (a: AnswerMap) => void
  onFinish: () => void
  onBack: () => void
}

export function QuestionRunner({ allSchools, answers, onAnswerChange, onFinish, onBack }: Props) {
  const [idx, setIdx] = useState(0)
  const q: Question = allQuestions[idx]
  const total = allQuestions.length

  const liveResult = useMemo(() => filterSchools(allSchools, answers), [allSchools, answers])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [idx])

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
    if (idx < total - 1) setIdx(idx + 1)
    else onFinish()
  }
  const prev = () => {
    if (idx > 0) setIdx(idx - 1)
    else onBack()
  }
  const skip = () => {
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

  const sectionLabel = q.section === 'A_redline' ? '紅線' : q.section === 'B_quality' ? '生活' : '特殊'

  return (
    <main className="min-h-screen bg-ink-950 text-fog-100 flex flex-col">
      <header className="sticky top-0 z-10 backdrop-blur bg-ink-950/80 border-b border-ink-800">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={prev}
            className="text-xs mono uppercase tracking-[0.2em] text-fog-500 hover:text-accent-500"
          >
            ← {idx === 0 ? '返回' : '上一題'}
          </button>
          <div className="text-xs mono text-fog-500">
            {sectionLabel} · {idx + 1} / {total}
          </div>
          <button
            onClick={skip}
            className="text-xs mono uppercase tracking-[0.2em] text-fog-500 hover:text-accent-500"
          >
            跳過
          </button>
        </div>
        <div className="h-[2px] bg-ink-800">
          <div
            className="h-full bg-accent-500 transition-all duration-500"
            style={{ width: `${((idx + 1) / total) * 100}%` }}
          />
        </div>
      </header>

      <section className="flex-1 max-w-2xl w-full mx-auto px-6 py-10 flex flex-col gap-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-4"
          >
            <h2 className="serif text-2xl sm:text-3xl leading-snug">{q.title}</h2>
            {q.subtitle && (
              <p className="text-sm text-fog-500 leading-relaxed">{q.subtitle}</p>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex flex-col gap-3">
          {q.options.map((opt) => {
            const active = isCurrent(opt.key)
            return (
              <button
                key={opt.key}
                onClick={() => (q.type === 'single' ? setAnswer(opt.key) : toggleMulti(opt.key))}
                className={[
                  'text-left px-5 py-4 rounded-xl border transition-all',
                  active
                    ? 'border-accent-500 bg-accent-500/10 text-fog-100'
                    : 'border-ink-700 bg-ink-900 text-fog-300 hover:border-fog-500 hover:text-fog-100',
                ].join(' ')}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={[
                      'inline-block w-4 h-4 rounded-full border',
                      active ? 'border-accent-500 bg-accent-500' : 'border-fog-500',
                    ].join(' ')}
                  />
                  <span className="serif text-base">{opt.label}</span>
                </div>
                {opt.hint && (
                  <p className="mt-2 ml-7 text-xs text-fog-500 leading-relaxed">{opt.hint}</p>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="mono text-xs text-fog-500">
            實時：已劃掉 <span className="text-accent-500 text-sm">{liveResult.stats.excludedCount}</span>
            {' / '}剩 <span className="text-fog-100 text-sm">{liveResult.stats.keptCount}</span>
          </div>
          <button
            onClick={next}
            disabled={!canProceed()}
            className={[
              'px-6 py-3 rounded-full font-semibold text-base transition-all',
              canProceed()
                ? 'bg-accent-500 text-ink-950 hover:bg-accent-400'
                : 'bg-ink-800 text-fog-500 cursor-not-allowed',
            ].join(' ')}
          >
            {idx === total - 1 ? '看結果' : '下一題 →'}
          </button>
        </div>
      </section>
    </main>
  )
}
