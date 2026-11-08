import { EvidenceNotice } from './EvidenceNotice'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { useMemo, useState, useEffect, useRef } from 'react'
import { candidateProvinceOptions } from '../data/admissionAuthorities'
import type { CandidateProvince } from '../data/admissionAuthorities'
import { allQuestions } from '../data/questions'
import type { Question } from '../data/questions'
import type { School } from '../data/schools'
import type { AnswerMap, AnswerValue } from '../engine/filter'
import { filterSchools } from '../engine/filter'
import { analyzeQuestionCoverage, getVisibleOptions } from '../engine/coverage'
import type { ProgramIndexPayload } from '../data/programsTypes'
import { SUBJECT_OPTIONS, isSubjectCode, subjectsToCombo } from '../data/programPrefs'
import { programClasses, programDisciplines } from '../data/programClasses'
import type { OriginRegion } from '../data/origins'
import { useLocale } from '../i18n/react'
import { Rich } from '../i18n/rich'
import { optionHint, optionLabel, provinceLabel, questionSubtitle, questionTitle, sectionLabel, subjectLabel } from '../lib/i18nLabels'

interface Props {
  allSchools: School[]
  /** 起點（展示用：港澳臺起點在 A6 多一行官方管道提示；不進篩選）。 */
  origin: OriginRegion | null
  /** 這個流程自動略過的題號（planFlow：非大陸起點略過 S1 選考科目組合）；略過＝寫入與手動「跳過」相同的值 'skip'。 */
  autoSkip: readonly string[]
  answers: AnswerMap
  candidateProvince: CandidateProvince
  onCandidateProvinceChange: (province: CandidateProvince) => void
  /** 逐校招生專業摘要：S1／S2 的學校取值由它算；進問卷前已載入（App 把它當成目錄的一部分）。 */
  programs: ProgramIndexPayload | null
  onAnswerChange: (a: AnswerMap, changedQuestionId: string) => void
  onFinish: () => void
  onBack: () => void
}

export function QuestionRunner({
  allSchools,
  origin,
  autoSkip,
  answers,
  candidateProvince,
  onCandidateProvinceChange,
  programs,
  onAnswerChange,
  onFinish,
  onBack,
}: Props) {
  const { t } = useLocale()
  // S1 的三科在湊滿之前只存在本地，不進 AnswerMap（不送互動紀錄）；S2 的門類選擇同理。綁定題號，換題即視為空。
  const [pending, setPending] = useState<{ qid: string; subjects: string[]; discipline: string }>({ qid: '', subjects: [], discipline: '' })

  const filterContext = useMemo(() => ({ candidateProvince, programs: programs ?? undefined }), [candidateProvince, programs])
  const liveResult = useMemo(
    () => filterSchools(allSchools, answers, filterContext),
    [allSchools, answers, filterContext],
  )
  const coverageByQuestion = useMemo(
    () => analyzeQuestionCoverage(allSchools, filterContext),
    [allSchools, filterContext],
  )
  const autoSkipKey = autoSkip.join('|')
  const visibleQuestions = useMemo(
    () => allQuestions.filter((question) => coverageByQuestion[question.id]?.active && !autoSkipKey.split('|').includes(question.id)),
    [coverageByQuestion, autoSkipKey],
  )
  const total = visibleQuestions.length
  // 從第一題未答的題開始（重新載入後接著做）；只在掛載時取一次
  const [idx, setIdx] = useState(() => Math.max(0, visibleQuestions.findIndex((question) => answers[question.id] === undefined)))
  const activeIdx = total > 0 ? Math.min(idx, total - 1) : 0

  // 自動略過（批 G6）：與手動「跳過」同一條路徑、同一個值，學習證據形狀不變；只寫一次。
  const autoSkipped = useRef(false)
  useEffect(() => {
    if (autoSkipped.current || !autoSkipKey) return
    const pending = autoSkipKey.split('|').filter((id) => answers[id as keyof AnswerMap] !== 'skip')
    autoSkipped.current = true
    if (pending.length === 0) return
    let next = answers
    for (const id of pending) {
      next = { ...next, [id]: 'skip' }
      onAnswerChange(next, id)
    }
  }, [answers, autoSkipKey, onAnswerChange])
  const q: Question | null = visibleQuestions[activeIdx] ?? null
  const visibleOptions = useMemo(
    () => (q ? getVisibleOptions(q, coverageByQuestion[q.id]) : []),
    [coverageByQuestion, q],
  )
  const shortlistReached = liveResult.stats.keptCount <= 10 && liveResult.stats.answeredCount > 0
  const showShortlistPanel = shortlistReached && liveResult.stats.keptCount > 0

  // 換題：捲到頂部，焦點移到新題目的標題（鍵盤與讀屏使用者從題目開始）；第一次掛載由 App 處理
  const firstQuestion = useRef(true)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (firstQuestion.current) { firstQuestion.current = false; return }
    const heading = document.querySelector<HTMLElement>('[data-question-title]')
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }) }
  }, [activeIdx])

  if (!q) {
    return (
      <main className="min-h-screen app-canvas text-fog-100 flex items-center justify-center px-5">
        <section className="w-full max-w-md border border-ink-800 bg-ink-900 rounded-xl p-6 flex flex-col gap-4">
          <h1 className="serif text-2xl">{t('ui.runner.cannotStart')}</h1>
          <p className="text-sm text-fog-500 leading-relaxed">
            {t('ui.runner.cannotStartNote')}
          </p>
          <button
            onClick={onBack}
            className="self-start px-5 py-3 rounded-full border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500"
          >
            {t('ui.common.backHome')}
          </button>
        </section>
      </main>
    )
  }

  const current = answers[q.id]

  const setAnswer = (val: AnswerValue) => {
    onAnswerChange({ ...answers, [q.id]: val }, q.id)
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

  // S1：六科挑三科的挑選器；答案＝固定序組合鍵（'PCB'），與選項 key 一致。
  const pendingSubjects = pending.qid === q.id ? pending.subjects : []
  const pendingDiscipline = pending.qid === q.id ? pending.discipline : ''
  const currentCombo = q.id === 'S1' && typeof current === 'string' && current !== 'skip' ? current : null
  const chosenSubjects = currentCombo ? [...currentCombo] : pendingSubjects
  const visibleComboKeys = new Set(visibleOptions.map((opt) => opt.key))
  const currentExcluded = typeof current === 'string' && current !== 'skip' ? coverageByQuestion[q.id]?.optionCoverageByKey[current]?.excludedCount ?? null : null
  const toggleSubject = (code: string) => {
    const base = currentCombo ? [...currentCombo] : pendingSubjects
    const next = base.includes(code) ? base.filter((c) => c !== code) : [...base, code]
    if (next.length > 3) return
    const combo = subjectsToCombo(next)
    if (combo && visibleComboKeys.has(combo)) { setPending({ qid: q.id, subjects: [], discipline: '' }); setAnswer(combo); return }
    setPending({ qid: q.id, subjects: next.filter(isSubjectCode), discipline: '' })
    if (currentCombo) onAnswerChange({ ...answers, [q.id]: null }, q.id)
  }
  // S2：門類 → 專業類兩層選單；答案＝專業類代碼。
  const currentClass = q.id === 'S2' && typeof current === 'string' && current !== 'skip' ? current : null
  const disciplineOfCurrent = currentClass ? programClasses.find((c) => c.code === currentClass)?.discipline ?? '' : ''
  const activeDiscipline = pendingDiscipline || disciplineOfCurrent
  const classesInDiscipline = programClasses.filter((c) => c.discipline === activeDiscipline && visibleComboKeys.has(c.code))
  const subtitle = questionSubtitle(q.id)
  const nextLabel = shortlistReached ? t('ui.runner.generateReport') : activeIdx === total - 1 ? t('ui.runner.seeResults') : t('ui.runner.next')

  return (
    <main className="min-h-screen app-canvas text-fog-100 flex flex-col">
      <SiteHeader
        sticky
        width="max-w-2xl"
        brand={t('ui.landing.brand')}
        back={{ label: <>← {activeIdx === 0 ? t('ui.runner.back') : t('ui.runner.prev')}</>, onClick: prev }}
        center={<span className="mono text-fog-500">{t('ui.runner.progress', { section: sectionLabel(q.section), index: activeIdx + 1, total })}</span>}
        actions={[{ label: shortlistReached ? t('ui.runner.results') : t('ui.runner.skip'), onClick: skip }]}
        footer={
          <>
          <p className="sm:hidden px-3 pb-1.5 text-xs mono text-fog-500">{t('ui.runner.progress', { section: sectionLabel(q.section), index: activeIdx + 1, total })}</p>
          <div className="h-[2px] bg-ink-800">
            <div
              className="h-full bg-accent-500 transition-all duration-500"
              style={{ width: `${total > 0 ? ((activeIdx + 1) / total) * 100 : 0}%` }}
            />
          </div>
          </>
        }
      />

      {/* 頁頭在最上；生活回報說明在頁頭下方，手機收成一行（2026-11-08 批 G4） */}
      <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 pt-3 sm:pt-4 flex flex-col gap-2">
        <EvidenceNotice collapseOnMobile />
        {autoSkip.includes('S1') && <p className="text-xs text-fog-500 leading-relaxed" data-runner-autoskip="S1">{t('ui.runner.autoSkipS1')}</p>}
      </div>
      <section className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 pt-5 pb-32 sm:pt-8 sm:pb-10 flex flex-col gap-8 sm:gap-10">
        <div key={q.id} className="question-enter flex flex-col gap-3 sm:gap-4">
            <h2 className="serif text-2xl sm:text-3xl leading-snug" data-question-title>{questionTitle(q.id)}</h2>
            {subtitle && (
              <p className="text-sm text-fog-500 leading-relaxed">{subtitle}</p>
            )}
            {q.id === 'A6' && (
              <label className="flex flex-wrap items-center gap-2 text-xs mono text-fog-500 border border-ink-700 bg-ink-900 rounded-xl px-3 py-3">
                <span className="uppercase tracking-[0.2em] shrink-0">{t('ui.common.candidateProvince')}</span>
                <select
                  value={candidateProvince}
                  onChange={(event) => onCandidateProvinceChange(event.target.value as CandidateProvince)}
                  className="bg-ink-950 border border-ink-700 rounded-lg px-2 py-2 text-fog-200 min-h-[40px]"
                >
                  {candidateProvinceOptions.map((province) => (
                    <option key={province} value={province}>{provinceLabel(province)}</option>
                  ))}
                </select>
                <span className="text-fog-500">{t('ui.runner.a6.provinceNote')}</span>
              </label>
            )}
            {q.id === 'A6' && (origin === 'hk' || origin === 'mo' || origin === 'tw') && (
              <p className="text-xs text-fog-500 leading-relaxed">{t('ui.runner.a6.hkmotwNote')}</p>
            )}
        </div>

        {q.id === 'S1' && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2" role="group" aria-label={t('ui.runner.s1.groupAria')}>
              {SUBJECT_OPTIONS.map((subject) => {
                const pressed = chosenSubjects.includes(subject.code)
                const disabled = !pressed && chosenSubjects.length >= 3
                return (
                  <button
                    key={subject.code}
                    type="button"
                    onClick={() => toggleSubject(subject.code)}
                    aria-pressed={pressed}
                    disabled={disabled}
                    className={[
                      'rounded-xl border px-3 py-3 min-h-[56px] text-base serif',
                      pressed
                        ? 'border-accent-500 bg-accent-500/10 text-fog-100'
                        : disabled
                          ? 'border-ink-800 bg-ink-950 text-fog-500 cursor-not-allowed'
                          : 'border-ink-700 bg-ink-900 text-fog-300 hover:border-fog-500 hover:text-fog-100',
                    ].join(' ')}
                  >
                    {subjectLabel(subject.code)}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-fog-500 leading-relaxed">
              {currentCombo
                ? `${t('ui.runner.s1.chosen', { combo: optionLabel('S1', currentCombo) })}${currentExcluded === 0 ? t('ui.runner.s1.noExclusion') : t('ui.runner.s1.exclusion')}`
                : t('ui.runner.s1.pending', { n: chosenSubjects.length })}
            </p>
          </div>
        )}
        {q.id === 'S2' && (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-fog-500">
              {t('ui.runner.s2.discipline')}
              <select
                value={activeDiscipline}
                onChange={(event) => { setPending({ qid: q.id, subjects: [], discipline: event.target.value }); if (currentClass) onAnswerChange({ ...answers, [q.id]: null }, q.id) }}
                className="bg-ink-950 border border-ink-700 rounded-lg px-2 py-2 text-sm text-fog-200 min-h-[48px]"
              >
                <option value="">{t('ui.runner.s2.disciplinePlaceholder')}</option>
                {programDisciplines.filter((d) => programClasses.some((c) => c.discipline === d.code)).map((d) => <option key={d.code} value={d.code}>{d.code} {d.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-fog-500">
              {t('ui.runner.s2.class')}
              <select
                value={currentClass ?? ''}
                disabled={!activeDiscipline}
                onChange={(event) => { if (event.target.value) setAnswer(event.target.value) }}
                className="bg-ink-950 border border-ink-700 rounded-lg px-2 py-2 text-sm text-fog-200 min-h-[48px]"
              >
                <option value="">{t('ui.runner.s2.classPlaceholder')}</option>
                {classesInDiscipline.map((c) => <option key={c.code} value={c.code}>{c.code} {c.name}</option>)}
              </select>
            </label>
            {currentClass && (
              <p className="sm:col-span-2 text-xs text-fog-500 leading-relaxed">
                {t('ui.runner.s2.chosen', { label: optionLabel('S2', currentClass) })}{currentExcluded === 0 ? t('ui.runner.s2.noExclusion') : t('ui.runner.s2.exclusion')}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {(q.id === 'S1' || q.id === 'S2' ? [] : visibleOptions).map((opt) => {
            const active = isCurrent(opt.key)
            const hint = optionHint(q.id, opt.key)
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
                  <span className="serif text-base leading-snug">{optionLabel(q.id, opt.key)}</span>
                </div>
                {hint && (
                  <p className="mt-2 ml-7 text-xs text-fog-500 leading-relaxed">{hint}</p>
                )}
              </button>
            )
          })}
        </div>

        {showShortlistPanel && (
          <div className="rounded-2xl border border-accent-500/30 bg-ink-900/80 px-4 py-4 flex flex-col gap-2">
            <p className="serif text-lg text-fog-100">{t('ui.runner.shortlist.title', { n: liveResult.stats.keptCount })}</p>
            <p className="text-sm text-fog-300 leading-relaxed">
              {t('ui.runner.shortlist.note')}
            </p>
          </div>
        )}

        <div className="hidden sm:flex items-center justify-between gap-3">
          <div className="mono text-xs text-fog-500">
            <Rich k="ui.runner.live" params={{ excluded: <span className="text-sm">{liveResult.stats.excludedCount}</span>, kept: <span className="text-sm">{liveResult.stats.keptCount}</span> }} />
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
            {nextLabel}
          </button>
        </div>
      </section>

      {/* 手機：在固定底欄之上留出 BDFZ 導航圓標的高度（它在底欄上方 92px），最後的內容可捲出圓標範圍 */}
      <div className="sm:hidden h-24 shrink-0" aria-hidden="true" />
      <div className="sm:hidden sticky bottom-0 left-0 right-0 z-20 bg-ink-950/95 backdrop-blur border-t border-ink-800 px-4 py-3 flex items-center justify-between gap-3">
        <div className="mono text-xs text-fog-500 leading-tight">
          <Rich k="ui.runner.live.short" params={{ excluded: <span className="text-sm">{liveResult.stats.excludedCount}</span>, kept: <span className="text-sm">{liveResult.stats.keptCount}</span> }} />
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
          {nextLabel}
        </button>
      </div>
      <SiteFooter width="max-w-2xl" />
    </main>
  )
}
