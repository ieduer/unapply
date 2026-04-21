import { useState } from 'react'
import { schools } from '../data/schools'
import { DIMENSIONS, DIMENSION_GROUPS } from '../data/dimensions'
import type { DimensionId } from '../data/dimensions'
import { recordUnapplyEvent } from '../lib/bdfzIdentity'

interface Props { onBack: () => void }

export function ContributePage({ onBack }: Props) {
  const [schoolId, setSchoolId] = useState<string>(schools[0]?.id ?? '')
  const [dim, setDim] = useState<DimensionId>('B1')
  const [value, setValue] = useState('')
  const [comment, setComment] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const qualityDims: DimensionId[] = [...DIMENSION_GROUPS.B, ...DIMENSION_GROUPS.C]
  const meta = DIMENSIONS[dim]
  const options = meta.values

  const submit = async () => {
    setErr(null)
    if (!schoolId || !dim || !value) {
      setErr('請選擇學校、維度、取值')
      return
    }
    try {
      await recordUnapplyEvent({
        recordKind: 'event',
        recordKey: `contrib-${dim}-${schoolId}-${Date.now().toString(36)}`,
        title: `貢獻：${schoolId} · ${meta.label}`,
        summary: `${value}${comment ? ` · ${comment.slice(0, 30)}` : ''}`,
        payload: { schoolId, dim, value, comment: comment.slice(0, 200) },
      })
      setSent(true)
    } catch (e) {
      setErr(String(e))
    }
  }

  if (sent) {
    return (
      <Shell onBack={onBack}>
        <div className="flex flex-col gap-4 py-12">
          <h1 className="serif text-3xl">已收到，謝謝。</h1>
          <p className="text-fog-300">你的貢獻進入人工審核隊列；通過後會出現在學校詳情頁。</p>
          <button onClick={onBack} className="self-start mt-4 px-5 py-2 bg-accent-500 text-ink-950 rounded-full text-sm font-semibold">
            返回
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell onBack={onBack}>
      <div className="flex flex-col gap-6">
        <h1 className="serif text-3xl">貢獻一條數據</h1>
        <p className="text-sm text-fog-500 leading-relaxed">
          一次只填一條。提交後會進入人工審核隊列，通過三人以上一致才會更新到學校詳情頁。<br />
          僅用於本站使用；不會用於商業目的；會標註來源時間戳。
        </p>

        <Field label="學校">
          <select
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2 text-sm"
          >
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>

        <Field label="維度">
          <select
            value={dim}
            onChange={(e) => { setDim(e.target.value as DimensionId); setValue('') }}
            className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2 text-sm"
          >
            {qualityDims.map(d => {
              const m = DIMENSIONS[d]
              return <option key={d} value={d}>{d} · {m.label}</option>
            })}
          </select>
        </Field>

        <Field label="取值">
          <select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">— 選擇 —</option>
            {options.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>

        <Field label="補充（可選，15 字以內推薦）">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="例：2024 年新建了樓層公共浴室"
            className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        {err && <p className="text-sm text-accent-500">{err}</p>}

        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            className="px-6 py-3 bg-accent-500 text-ink-950 rounded-full font-semibold text-sm hover:bg-accent-400"
          >
            提交
          </button>
          <span className="mono text-xs text-fog-500">登錄後可追蹤你貢獻的狀態</span>
        </div>
      </div>
    </Shell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs mono uppercase tracking-[0.2em] text-fog-500">{label}</span>
      {children}
    </label>
  )
}

function Shell({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <main className="min-h-screen bg-ink-950 text-fog-100">
      <header className="sticky top-0 z-10 backdrop-blur bg-ink-950/80 border-b border-ink-800">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={onBack} className="text-xs mono uppercase tracking-[0.2em] text-fog-500 hover:text-accent-500">
            ← 返回
          </button>
          <span className="mono text-xs text-fog-500">contribute</span>
        </div>
      </header>
      <section className="max-w-2xl mx-auto px-6 pt-10 pb-24">{children}</section>
    </main>
  )
}
