import { useEffect, useMemo, useState } from 'react'
import type { ProgramIndexPayload, SubjectCode } from '../data/programsTypes'
import type { AtlasProgram, AtlasSubject } from '../data/worldAtlasTypes'
import { programClasses, programDisciplineNameByCode } from '../data/programClasses'
import { summarizeClasses, summarizeGrasSubjects } from '../engine/search'
import { PATH_ANSWERS, normalizePathAnswer, planDirectHire, visibleDirectHire, type PathAnswer, type PathDestination } from '../engine/directHire'
import { loadWorldAtlas } from '../lib/atlasData'
import { useLocale } from '../i18n/react'
import { DirectHireCard } from './DirectHireCard'

/**
 * 結果頁的兩種「只是彙總」（2026-11-08 批 G7，路線圖目標第 2、5 條）：不改剩餘集合、不進 AnswerMap、不進 A+ 學習證據。
 *  - MajorSummary：大陸結果頁按國標專業類彙總剩下學校開設該類的校數與「你的選科可報」校數，點一類看學校。
 *  - GrasSummary：`#/global` 結果頁按 GRAS 學科彙總剩下機構。
 *  - NonUniversityPaths：依目的地列已核企業直招（「你考不考慮不讀大學、直接進企業的路徑？」答「不考慮」就不列）。
 */

const CLASS_ORDER = programClasses.map((c) => c.code)

export function MajorSummary<S extends { id: string; moeCode?: string | null }>({ kept, programsIndex, combo, schoolName, onSchool }: {
  kept: readonly S[]; programsIndex: ProgramIndexPayload | null; combo: ReadonlySet<SubjectCode> | null; schoolName: (school: S) => string; onSchool: (id: string) => void
}) {
  const { t, n } = useLocale()
  const [open, setOpen] = useState<string | null>(null)
  const [limit, setLimit] = useState(40)
  const byCode = useMemo(() => new Map(kept.filter((s) => s.moeCode).map((s) => [s.moeCode!, s])), [kept])
  const rows = useMemo(() => (programsIndex ? summarizeClasses([...byCode.keys()], programsIndex.schools, programsIndex, CLASS_ORDER, combo) : []), [programsIndex, byCode, combo])
  if (!programsIndex || rows.length === 0) return null
  const withData = new Set(rows.flatMap((r) => r.schools)).size
  return (
    <details className="border border-ink-800 bg-ink-900 rounded-panel px-5 py-4" data-major-summary={rows.length}>
      <summary className="cursor-pointer min-h-[44px] flex items-center serif text-xl">{t('ui.majors.title')}</summary>
      <p className="text-sm text-fog-500 leading-relaxed mt-2">{t('ui.majors.lede', { schools: n(withData), classes: n(rows.length), kept: n(kept.length) })}{combo ? '' : ` ${t('ui.majors.noCombo')}`}</p>
      <ul className="mt-3 flex flex-col">
        {rows.map((row, i) => {
          const klass = programClasses.find((c) => c.code === row.classCode)!
          const previous = i > 0 ? programClasses.find((c) => c.code === rows[i - 1].classCode)?.discipline : null
          const header = klass.discipline !== previous ? programDisciplineNameByCode[klass.discipline] : null
          const expanded = open === row.classCode
          const admissible = new Set(row.admissible ?? [])
          return (
            <li key={row.classCode} className="flex flex-col" data-major-class={row.classCode}>
              {header && <p className="mono text-xs uppercase tracking-[0.2em] text-fog-500 mt-3 mb-1">{header}</p>}
              <button type="button" aria-expanded={expanded} onClick={() => { setOpen(expanded ? null : row.classCode); setLimit(40) }}
                className="flex flex-wrap items-baseline justify-between gap-x-3 min-h-[44px] text-left border-t border-ink-800 py-2 hover:text-accent-500">
                <span className="text-sm text-fog-100">{klass.name}</span>
                <span className="text-xs mono text-fog-500" data-major-class-count={`${row.schools.length}/${row.admissible?.length ?? '-'}`}>
                  {row.admissible ? t('ui.majors.countCombo', { n: n(row.schools.length), m: n(row.admissible.length) }) : t('ui.majors.count', { n: n(row.schools.length) })}
                </span>
              </button>
              {expanded && (
                <ul className="flex flex-wrap gap-x-3 gap-y-1 pb-3 text-sm">
                  {row.schools.slice(0, limit).map((code) => {
                    const school = byCode.get(code)!
                    return (
                      <li key={code}>
                        <button type="button" onClick={() => onSchool(school.id)} className="underline decoration-ink-700 hover:text-accent-500 min-h-[44px] sm:min-h-[40px]" data-major-class-school={code}>
                          {schoolName(school)}{combo && !admissible.has(code) ? <span className="text-fog-500 text-xs"> {t('ui.majors.notAdmissible')}</span> : null}
                        </button>
                      </li>
                    )
                  })}
                  {row.schools.length > limit && <li><button type="button" onClick={() => setLimit((x) => x + 80)} className="text-fog-300 underline min-h-[44px] sm:min-h-[40px]">{t('ui.majors.more', { n: n(row.schools.length - limit) })}</button></li>}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-fog-500 leading-relaxed mt-3">{t('ui.majors.note', { year: programsIndex.admissionYear })}</p>
    </details>
  )
}

export function GrasSummary<I extends { key: string; subjects: readonly string[] | null }>({ items, subjects, itemName }: { items: readonly I[]; subjects: readonly AtlasSubject[]; itemName: (item: I) => string }) {
  const { t, n, locale } = useLocale()
  const [open, setOpen] = useState<string | null>(null)
  const rows = useMemo(() => summarizeGrasSubjects(items, subjects.map((s) => s.code)), [items, subjects])
  if (!rows.length) return null
  const label = (code: string) => { const s = subjects.find((x) => x.code === code); return s ? (locale === 'en' ? s.nameEn : locale === 'zh-Hans' ? s.nameZhHans || s.nameZh : s.nameZh) : code }
  return (
    <details className="border border-ink-800 bg-ink-900 rounded-panel px-5 py-4" data-gras-summary={rows.length}>
      <summary className="cursor-pointer min-h-[44px] flex items-center serif text-xl">{t('ui.majors.gras.title')}</summary>
      <p className="text-sm text-fog-500 leading-relaxed mt-2">{t('ui.majors.gras.lede', { n: n(new Set(rows.flatMap((r) => r.items.map((i) => i.key))).size), subjects: n(rows.length) })}</p>
      <ul className="mt-3 flex flex-col">
        {rows.map((row) => {
          const expanded = open === row.code
          return (
            <li key={row.code} className="flex flex-col" data-gras-subject={row.code}>
              <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : row.code)} className="flex flex-wrap items-baseline justify-between gap-x-3 min-h-[44px] text-left border-t border-ink-800 py-2 hover:text-accent-500">
                <span className="text-sm text-fog-100">{label(row.code)}</span>
                <span className="text-xs mono text-fog-500">{t('ui.majors.gras.count', { n: n(row.items.length) })}</span>
              </button>
              {expanded && <p className="pb-3 text-sm text-fog-300 leading-relaxed">{row.items.map(itemName).join(t('ui.common.listJoiner'))}</p>}
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-fog-500 leading-relaxed mt-3">{t('ui.majors.gras.note')}</p>
    </details>
  )
}

const PATH_STORAGE_KEY = 'unapply.directHire.v1'
function readPathAnswer(destination: PathDestination): PathAnswer | null {
  try { return normalizePathAnswer((JSON.parse(window.localStorage.getItem(PATH_STORAGE_KEY) ?? '{}') as Record<string, unknown>)[destination]) } catch { return null }
}
function savePathAnswer(destination: PathDestination, answer: PathAnswer | null) {
  try {
    const all = JSON.parse(window.localStorage.getItem(PATH_STORAGE_KEY) ?? '{}') as Record<string, unknown>
    if (answer) all[destination] = answer; else delete all[destination]
    window.localStorage.setItem(PATH_STORAGE_KEY, JSON.stringify(all))
  } catch { /* 存不下就算了 */ }
}

/**
 * 非大學路徑。`inlineQuestion` 為真（大陸結果頁）時在區內問「考不考慮」並存在本機；
 * 否則（`#/global`）答案由逐題流程傳入（answers[dest]），這裡只列。
 */
export function NonUniversityPaths({ destinations, answers, struckCountries, inlineQuestion = false, onAnswer }: {
  destinations: readonly PathDestination[]; answers?: Partial<Record<PathDestination, PathAnswer | null>>; struckCountries?: ReadonlySet<string>; inlineQuestion?: boolean; onAnswer?: (destination: PathDestination, answer: PathAnswer | null) => void
}) {
  const { t, n } = useLocale()
  const [programs, setPrograms] = useState<AtlasProgram[] | null>(null)
  const [paidOnly, setPaidOnly] = useState(false)
  const [degreeOnly, setDegreeOnly] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [local, setLocal] = useState<Partial<Record<PathDestination, PathAnswer | null>>>(() => Object.fromEntries(destinations.map((d) => [d, readPathAnswer(d)])))
  useEffect(() => { let alive = true; loadWorldAtlas().then((a) => { if (alive) setPrograms(a.programs) }).catch(() => { if (alive) setPrograms([]) }); return () => { alive = false } }, [])
  if (!programs) return null
  const plans = destinations.map((d) => planDirectHire(d, programs)).filter((p) => p.verified.length > 0)
  if (!plans.length) return null
  const answerOf = (d: PathDestination) => (inlineQuestion ? local[d] ?? null : answers?.[d] ?? null)
  const setAnswer = (d: PathDestination, a: PathAnswer | null) => { if (inlineQuestion) { setLocal((x) => ({ ...x, [d]: a })); savePathAnswer(d, a) } onAnswer?.(d, a) }
  const chip = (active: boolean) => ['px-3 min-h-[44px] rounded-ctl border text-sm', active ? 'border-accent-500 bg-accent-500/10 text-fog-100' : 'border-ink-700 bg-ink-950 text-fog-300 hover:border-fog-500 hover:text-fog-100'].join(' ')
  return (
    <section className="flex flex-col gap-4" data-paths={plans.map((p) => p.destination).join('|')}>
      <div className="flex flex-col gap-1">
        <h2 className="serif text-2xl">{t('ui.paths.title')}</h2>
        <p className="text-sm text-fog-500 leading-relaxed">{t('ui.paths.lede')}</p>
      </div>
      {plans.some((plan) => { const a = answerOf(plan.destination); return a === 'consider' || (!plan.question && a !== 'no') }) && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('ui.paths.filter')}>
          <button type="button" aria-pressed={paidOnly} onClick={() => setPaidOnly((v) => !v)} className={chip(paidOnly)} data-paths-filter="paid">{t('ui.paths.paidOnly')}</button>
          <button type="button" aria-pressed={degreeOnly} onClick={() => setDegreeOnly((v) => !v)} className={chip(degreeOnly)} data-paths-filter="degree">{t('ui.paths.degreeOnly')}</button>
        </div>
      )}
      {plans.map((plan) => {
        const answer = answerOf(plan.destination)
        const list = visibleDirectHire(plan, answer, { struckCountries: plan.destination === 'overseas' ? struckCountries : undefined, paidOnly, degreeOnly })
        const all = visibleDirectHire(plan, answer, { struckCountries: plan.destination === 'overseas' ? struckCountries : undefined })
        const show = answer === 'consider' || (!plan.question && answer !== 'no')
        return (
          <div key={plan.destination} className="flex flex-col gap-3" data-paths-destination={plan.destination} data-paths-answer={answer ?? ''} data-paths-shown={show ? all.length : 0}>
            <p className="mono text-xs uppercase tracking-[0.2em] text-accent-500">{t(`ui.dest.${plan.destination}`)}</p>
            {plan.question && inlineQuestion && (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-base text-fog-100 mb-2">{t('ui.paths.question')}</legend>
                <div className="flex flex-wrap gap-2">
                  {PATH_ANSWERS.map((value) => <button key={value} type="button" aria-pressed={answer === value} onClick={() => setAnswer(plan.destination, answer === value ? null : value)} className={chip(answer === value)} data-paths-option={value}>{t(`ui.paths.answer.${value}`, { n: n(plan.verified.length) })}</button>)}
                </div>
              </fieldset>
            )}
            {answer === 'no' && <p className="text-sm text-fog-500" data-paths-hidden>{t('ui.paths.hidden')}</p>}
            {plan.question && answer === null && <p className="text-sm text-fog-500" data-paths-unanswered>{t('ui.paths.unanswered', { n: n(plan.verified.length) })}</p>}
            {show && (
              <>
                <p className="text-sm text-fog-300" data-paths-count={`${list.length}/${all.length}`}>{t('ui.paths.count', { n: n(list.length), total: n(all.length) })}</p>
                <ul className="grid gap-3 sm:grid-cols-2">{list.map((program) => <li key={program.id}><DirectHireCard program={program} expanded={openId === program.id} onOpen={() => setOpenId(program.id)} onClose={() => setOpenId(null)} /></li>)}</ul>
              </>
            )}
          </div>
        )
      })}
      <p className="text-xs text-fog-500 leading-relaxed">{t('ui.paths.note')}</p>
    </section>
  )
}
