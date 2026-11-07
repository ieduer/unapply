import { useEffect, useMemo, useState } from 'react'
import type { ProgramCatalogPayload } from '../data/programsTypes'
import {
  SUBJECT_OPTIONS,
  normalizeSubjects,
  programPrefsActive,
  subjectLabels,
  type ProgramPrefs,
} from '../data/programPrefs'
import { loadProgramCatalog } from '../lib/programsData'
import { programsManifest } from '../data/programsManifest'

interface Props {
  prefs: ProgramPrefs
  onChange: (prefs: ProgramPrefs) => void
}

const selectClass = 'bg-ink-950 border border-ink-700 rounded-lg px-2 py-2 text-sm text-fog-200 min-h-[44px] w-full'

export function StartConditions({ prefs, onChange }: Props) {
  const [intentOpen, setIntentOpen] = useState(prefs.intent !== null)
  const [catalog, setCatalog] = useState<ProgramCatalogPayload | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [pickedDiscipline, setPickedDiscipline] = useState<string>('')

  useEffect(() => {
    if (!intentOpen || catalog || catalogError) return
    let alive = true
    loadProgramCatalog()
      .then((loaded) => { if (alive) setCatalog(loaded) })
      .catch((error: unknown) => { if (alive) setCatalogError(error instanceof Error ? error.message : String(error)) })
    return () => { alive = false }
  }, [catalog, catalogError, intentOpen])

  // 門類選單：使用者點過就用點的；否則跟著已存的意向推回去
  const disciplineCode = pickedDiscipline || (catalog && prefs.intent ? catalog.classes.find((c) => c.code === prefs.intent?.classCode)?.discipline ?? '' : '')

  const classesInDiscipline = useMemo(
    () => (catalog ? catalog.classes.filter((c) => c.discipline === disciplineCode) : []),
    [catalog, disciplineCode],
  )
  const programsInClass = useMemo(
    () => (catalog && prefs.intent ? catalog.programs.filter((p) => p.class === prefs.intent?.classCode) : []),
    [catalog, prefs.intent],
  )

  const toggleSubject = (code: ProgramPrefs['subjects'][number]) => {
    const has = prefs.subjects.includes(code)
    const next = has ? prefs.subjects.filter((c) => c !== code) : [...prefs.subjects, code]
    if (next.length > 3) return
    onChange({ ...prefs, subjects: normalizeSubjects(next) })
  }

  const active = programPrefsActive(prefs)
  const subjectsReady = prefs.subjects.length === 3

  return (
    <div className="border border-ink-800 bg-ink-900/78 p-5 sm:p-6 flex flex-col gap-4 backdrop-blur-xl">
      <div className="flex flex-col gap-2">
        <p className="mono text-xs uppercase tracking-[0.24em] text-fog-500">起點條件 · 選填</p>
        <h2 className="serif text-2xl">選考科目與意向專業</h2>
        <p className="text-sm text-fog-400 leading-relaxed">
          這兩項不進 43 題，也不改你的作答紀錄：結果頁會在 43 題之後另標出「你的選科報不了」「沒開這個專業」的學校，分開計數。
          目前有 {programsManifest.admissionYear} 年招生專業與選考要求資料的是雙一流 {programsManifest.counts.schools} 所（{programsManifest.counts.offerings.toLocaleString()} 個招生專業（類）），其他學校不受這兩項影響。
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="mono text-xs uppercase tracking-[0.2em] text-fog-500">選考科目（選滿 3 科才生效）</span>
          <span className="text-xs text-fog-500">
            {subjectsReady
              ? `已選 ${subjectLabels(prefs.subjects).join('＋')}，按各校公布的 ${programsManifest.admissionYear} 年選考要求判定`
              : `已選 ${prefs.subjects.length}/3；3+1+2 省份請把首選科目一起算進來`}
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2" role="group" aria-label="選考科目">
          {SUBJECT_OPTIONS.map((subject) => {
            const pressed = prefs.subjects.includes(subject.code)
            const disabled = !pressed && prefs.subjects.length >= 3
            return (
              <button
                key={subject.code}
                type="button"
                onClick={() => toggleSubject(subject.code)}
                aria-pressed={pressed}
                disabled={disabled}
                className={[
                  'rounded-xl border px-3 py-3 min-h-[48px] text-sm',
                  pressed
                    ? 'border-accent-500 bg-accent-500/10 text-fog-100'
                    : disabled
                      ? 'border-ink-800 bg-ink-950 text-fog-500 cursor-not-allowed'
                      : 'border-ink-700 bg-ink-950 text-fog-300 hover:border-fog-500 hover:text-fog-100',
                ].join(' ')}
              >
                {subject.label}
              </button>
            )
          })}
        </div>
        {prefs.subjects.length > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...prefs, subjects: [] })}
            className="self-start text-xs mono text-fog-500 hover:text-accent-500 min-h-[44px] -my-2 py-2"
          >
            清除選科
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="mono text-xs uppercase tracking-[0.2em] text-fog-500">意向專業（類）</span>
          <span className="text-xs text-fog-500">按教育部《本科專業目錄（{programsManifest.catalogYear} 年）》的 {programsManifest.counts.classes} 個專業類與 {programsManifest.counts.catalogPrograms} 種專業</span>
        </div>
        {prefs.intent && (
          <p className="text-sm text-fog-200">
            已選：{prefs.intent.programName ? `${prefs.intent.programName}（${prefs.intent.className}）` : prefs.intent.className}
            <button
              type="button"
              onClick={() => { onChange({ ...prefs, intent: null }); setPickedDiscipline('') }}
              className="ml-3 text-xs mono text-fog-500 hover:text-accent-500 min-h-[44px] -my-2 py-2"
            >
              清除意向
            </button>
          </p>
        )}
        {!intentOpen ? (
          <button
            type="button"
            onClick={() => setIntentOpen(true)}
            className="self-start px-4 py-3 rounded-xl border border-ink-700 text-sm text-fog-100 hover:border-accent-500 min-h-[48px]"
          >
            {prefs.intent ? '改意向專業' : '選意向專業（類）'}
          </button>
        ) : catalogError ? (
          <p className="text-sm text-fog-300">專業目錄載入失敗：{catalogError}。可以先不設意向，直接開始減法。</p>
        ) : !catalog ? (
          <p className="text-sm text-fog-500">正在載入教育部本科專業目錄…</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-fog-500">
              門類
              <select
                value={disciplineCode}
                onChange={(event) => { setPickedDiscipline(event.target.value); if (prefs.intent) onChange({ ...prefs, intent: null }) }}
                className={selectClass}
              >
                <option value="">— 選門類 —</option>
                {catalog.disciplines.map((d) => <option key={d.code} value={d.code}>{d.code} {d.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-fog-500">
              專業類
              <select
                value={prefs.intent?.classCode ?? ''}
                disabled={!disciplineCode}
                onChange={(event) => {
                  const klass = catalog.classes.find((c) => c.code === event.target.value)
                  onChange({ ...prefs, intent: klass ? { classCode: klass.code, className: klass.name } : null })
                }}
                className={selectClass}
              >
                <option value="">— 選專業類 —</option>
                {classesInDiscipline.map((c) => <option key={c.code} value={c.code}>{c.code} {c.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-fog-500">
              具體專業（可不選）
              <select
                value={prefs.intent?.programCode ?? ''}
                disabled={!prefs.intent}
                onChange={(event) => {
                  if (!prefs.intent) return
                  const program = catalog.programs.find((p) => p.code === event.target.value)
                  onChange({ ...prefs, intent: program
                    ? { classCode: prefs.intent.classCode, className: prefs.intent.className, programCode: program.code, programName: program.name }
                    : { classCode: prefs.intent.classCode, className: prefs.intent.className } })
                }}
                className={selectClass}
              >
                <option value="">整個專業類都可以</option>
                {programsInClass.map((p) => <option key={p.code} value={p.code}>{p.code} {p.name}</option>)}
              </select>
            </label>
          </div>
        )}
        <p className="text-xs text-fog-500 leading-relaxed">
          專業名稱用教育部目錄與各省公布表的原文。按「專業類」招生的學校（例如「計算機類」）視為涵蓋該類全部專業；各校「試驗班」對不到專業類時不替你判定、照常保留。
        </p>
      </div>

      <p className="text-xs mono text-fog-500">
        {active ? '起點條件已設定，結果頁會分開列出它劃掉的學校。' : '不設也可以直接開始減法。'}
      </p>
    </div>
  )
}
