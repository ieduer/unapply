import { useMemo, useState, type ReactNode } from 'react'
import type { School } from '../data/schools'
import { DIMENSIONS } from '../data/dimensions'
import type { DimensionId } from '../data/dimensions'
import { recordUnapplyEvent } from '../lib/bdfzIdentity'

interface Props {
  schools: School[]
  onBack: () => void
}

type ContributionDimension = DimensionId | 'custom'
type SourceType = 'official' | 'school' | 'student' | 'news' | 'map' | 'github' | 'other'
type Confidence = 'high' | 'medium' | 'low'
type CustomCategory =
  | 'campus_location'
  | 'tuition_fee'
  | 'dormitory'
  | 'management_rules'
  | 'academic_major'
  | 'employment'
  | 'mobility_transfer'
  | 'accessibility'
  | 'food_safety'
  | 'student_life'
  | 'other'

const REPO = 'ieduer/unapply'
const ISSUE_URL = `https://github.com/${REPO}/issues/new`
const CUSTOM_DIM: ContributionDimension = 'custom'
const FREE_VALUE = '__free_value__'

const CONTRIBUTABLE_DIMS = (Object.keys(DIMENSIONS) as DimensionId[])
  .filter((dim) => DIMENSIONS[dim].coverage !== 'authoritative')

const SOURCE_LABELS: Record<SourceType, string> = {
  official: '教育部/政府公告',
  school: '學校官網/招生章程',
  student: '在讀學生/校友',
  news: '媒體/公開新聞',
  map: '地圖/交通資料',
  github: 'GitHub/開放數據',
  other: '其他',
}

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: '高：可公開核驗',
  medium: '中：有來源但需覆核',
  low: '低：個人體驗/待佐證',
}

const CATEGORY_LABELS: Record<CustomCategory, string> = {
  campus_location: '校區/地理/交通',
  tuition_fee: '學費/住宿費/合作辦學',
  dormitory: '宿舍/浴室/空調/洗衣',
  management_rules: '門禁/查寢/跑步/早晚自習',
  academic_major: '專業/學科/培養方案',
  employment: '就業/升學/保研/出國',
  mobility_transfer: '轉專業/輔修/跨校區流動',
  accessibility: '無障礙/特殊需求支持',
  food_safety: '食堂/食品安全',
  student_life: '學生生活/社團/校園服務',
  other: '其他重要數據',
}

function normalizeInitialDim(dim: string | null): ContributionDimension {
  if (dim && dim in DIMENSIONS && CONTRIBUTABLE_DIMS.includes(dim as DimensionId)) return dim as DimensionId
  return 'B1'
}

function buildGithubBody(params: {
  contribution: unknown
  schoolName: string
  schoolId: string
  dimensionLabel: string
  value: string
  sourceLabel: string
  evidence: string
  contributor: string
}) {
  return [
    `**學校**: ${params.schoolName}（id=${params.schoolId}）`,
    `**數據項**: ${params.dimensionLabel}`,
    `**取值**: ${params.value}`,
    `**來源類型**: ${params.sourceLabel}`,
    `**證據/補充**:`,
    params.evidence || '（未填）',
    '',
    `**貢獻者**: ${params.contributor || '（匿名）'}`,
    '',
    '```json',
    JSON.stringify(params.contribution, null, 2),
    '```',
    '',
    '---',
    'schema: unapply.dataContribution.v1',
    '入庫原則：可核驗來源優先；眾包項至少交叉覆核；敏感/負面項必須有公開證據。',
  ].join('\n')
}

export function ContributePage({ schools, onBack }: Props) {
  const params = useMemo(() => {
    const qs = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
    return {
      schoolId: qs.get('school') ?? schools[0]?.id ?? '',
      dim: normalizeInitialDim(qs.get('dim')),
    }
  }, [schools])

  const [schoolId, setSchoolId] = useState<string>(params.schoolId)
  const [dim, setDim] = useState<ContributionDimension>(params.dim)
  const [value, setValue] = useState('')
  const [customValue, setCustomValue] = useState('')
  const [customCategory, setCustomCategory] = useState<CustomCategory>('campus_location')
  const [customMetric, setCustomMetric] = useState('')
  const [sourceType, setSourceType] = useState<SourceType>('school')
  const [sourceTitle, setSourceTitle] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceDate, setSourceDate] = useState('')
  const [confidence, setConfidence] = useState<Confidence>('medium')
  const [campus, setCampus] = useState('')
  const [major, setMajor] = useState('')
  const [grade, setGrade] = useState('')
  const [sampleSize, setSampleSize] = useState('')
  const [evidence, setEvidence] = useState('')
  const [contributor, setContributor] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const school = schools.find(s => s.id === schoolId)
  const isCustom = dim === CUSTOM_DIM
  const knownDim = isCustom ? null : (dim as DimensionId)
  const meta = knownDim ? DIMENSIONS[knownDim] : null
  const selectedValue = isCustom || value === FREE_VALUE ? customValue.trim() : value
  const dimensionLabel = isCustom
    ? `${CATEGORY_LABELS[customCategory]} · ${customMetric.trim() || '自定義項'}`
    : `${knownDim} · ${meta?.label ?? knownDim}`

  const submit = () => {
    setErr(null)
    if (!schoolId) {
      setErr('請選擇學校')
      return
    }
    if (isCustom && !customMetric.trim()) {
      setErr('請填寫自定義數據項名稱')
      return
    }
    if (!selectedValue) {
      setErr('請填寫或選擇取值')
      return
    }
    if (!sourceTitle.trim() && !sourceUrl.trim() && !evidence.trim()) {
      setErr('請至少提供來源標題、來源鏈接或證據補充中的一項')
      return
    }
    if (['official', 'school', 'news', 'map', 'github'].includes(sourceType) && !sourceUrl.trim()) {
      setErr('此來源類型需要可打開的鏈接，否則請改選「在讀學生/校友」或「其他」')
      return
    }

    const contribution = {
      schema: 'unapply.dataContribution.v1',
      school: {
        id: schoolId,
        name: school?.name ?? schoolId,
        province: school?.province ?? '',
        city: school?.city ?? '',
      },
      dimension: isCustom
        ? {
            type: 'custom',
            category: customCategory,
            categoryLabel: CATEGORY_LABELS[customCategory],
            metric: customMetric.trim(),
          }
        : {
            type: 'known',
            id: knownDim,
            label: meta?.label ?? knownDim,
            coverage: meta?.coverage ?? '',
          },
      value: selectedValue,
      source: {
        type: sourceType,
        typeLabel: SOURCE_LABELS[sourceType],
        title: sourceTitle.trim(),
        url: sourceUrl.trim(),
        date: sourceDate.trim(),
        confidence,
      },
      scope: {
        campus: campus.trim(),
        major: major.trim(),
        grade: grade.trim(),
        sampleSize: sampleSize.trim(),
      },
      evidence: evidence.trim(),
      contributor: contributor.trim() || 'anonymous',
      submittedAt: new Date().toISOString(),
    }

    const body = buildGithubBody({
      contribution,
      schoolName: school?.name ?? schoolId,
      schoolId,
      dimensionLabel,
      value: selectedValue,
      sourceLabel: SOURCE_LABELS[sourceType],
      evidence,
      contributor,
    })
    const title = `數據貢獻：${school?.name ?? schoolId} · ${dimensionLabel} = ${selectedValue}`
    const url = new URL(ISSUE_URL)
    url.searchParams.set('title', title)
    url.searchParams.set('body', body)
    url.searchParams.set('labels', 'data-contribution,needs-triage')

    void recordUnapplyEvent({
      recordKind: 'event',
      recordKey: `contrib-${schoolId}-${Date.now().toString(36)}`,
      title: `發起貢獻：${school?.name ?? schoolId} · ${dimensionLabel}`,
      summary: `值=${selectedValue}${sourceTitle ? ` · 源=${sourceTitle.slice(0, 30)}` : ''}`,
      payload: contribution,
    })

    window.open(url.toString(), '_blank', 'noopener,noreferrer')
  }

  return (
    <main className="min-h-screen app-canvas text-fog-100">
      <header className="sticky top-0 z-10 backdrop-blur bg-ink-950/80 border-b border-ink-800">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button onClick={onBack} className="text-xs mono uppercase tracking-[0.2em] text-fog-500 hover:text-accent-500 min-h-[44px] -my-3 py-3">
            ← 返回
          </button>
          <span className="mono text-xs text-fog-500">contribute</span>
        </div>
      </header>

      <section className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-24 flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h1 className="serif text-2xl sm:text-3xl">貢獻高校數據</h1>
          <p className="text-sm text-fog-500 leading-relaxed">
            支持補充既有維度，也支持提交你認為重要的新數據。提交後會打開 <code className="mono text-fog-300">{REPO}</code> 的 issue 創建頁，內含可機器讀取的 JSON。
          </p>
          <p className="text-xs text-fog-500 leading-relaxed">
            權威維度只接受官方或可公開核驗來源；生活體驗類允許在讀學生/校友補充，但入庫前仍需覆核。
          </p>
          <p className="text-xs text-fog-500 leading-relaxed">
            如果你是從題目頁直接跳過來，先選擇你熟悉的一所學校，再提交這一維的資料。
          </p>
        </div>

        <Field label="學校">
          <select
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-3 text-sm min-h-[44px]"
          >
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>

        <Field label="數據項">
          <select
            value={dim}
            onChange={(e) => {
              setDim(e.target.value as ContributionDimension)
              setValue('')
              setCustomValue('')
            }}
            className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-3 text-sm min-h-[44px]"
          >
            <option value={CUSTOM_DIM}>自定義重要數據</option>
            {CONTRIBUTABLE_DIMS.map(d => {
              const m = DIMENSIONS[d]
              return <option key={d} value={d}>{d} · {m.label}</option>
            })}
          </select>
          {meta?.notes && <p className="text-xs text-fog-500 mt-2">{meta.notes}</p>}
        </Field>

        {isCustom && (
          <>
            <Field label="自定義類別">
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value as CustomCategory)}
                className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-3 text-sm min-h-[44px]"
              >
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="自定義數據項名稱">
              <input
                type="text"
                value={customMetric}
                onChange={(e) => setCustomMetric(e.target.value)}
                placeholder="例：2024 本科保研率 / 大一所在校區 / 轉專業限制"
                className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-3 text-sm min-h-[44px]"
              />
            </Field>
          </>
        )}

        <Field label="取值">
          {!isCustom && meta ? (
            <select
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                if (e.target.value !== FREE_VALUE) setCustomValue('')
              }}
              className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-3 text-sm min-h-[44px]"
            >
              <option value="">— 選擇 —</option>
              {meta.values.map((v) => <option key={v} value={v}>{v}</option>)}
              <option value={FREE_VALUE}>其他/更精確取值</option>
            </select>
          ) : null}
          {(isCustom || value === FREE_VALUE) && (
            <input
              type="text"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder="例：主校區距地鐵 1.1km / 2024 年保研率 18.7% / 不限績點可申請"
              className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-3 text-sm min-h-[44px]"
            />
          )}
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="來源類型">
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as SourceType)}
              className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-3 text-sm min-h-[44px]"
            >
              {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="可信度">
            <select
              value={confidence}
              onChange={(e) => setConfidence(e.target.value as Confidence)}
              className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-3 text-sm min-h-[44px]"
            >
              {Object.entries(CONFIDENCE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="來源標題">
          <input
            type="text"
            value={sourceTitle}
            onChange={(e) => setSourceTitle(e.target.value)}
            placeholder="例：北京大學 2024 本科招生章程 / 學校後勤通知 / 本人 2023 級在讀"
            className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-3 text-sm min-h-[44px]"
          />
        </Field>

        <Field label="來源鏈接">
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-3 text-sm min-h-[44px]"
          />
        </Field>

        <Field label="來源日期">
          <input
            type="text"
            value={sourceDate}
            onChange={(e) => setSourceDate(e.target.value)}
            placeholder="例：2024-06-15 / 2024 學年 / 2023 級"
            className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-3 text-sm min-h-[44px]"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="校區/範圍">
            <input
              type="text"
              value={campus}
              onChange={(e) => setCampus(e.target.value)}
              placeholder="例：沙河校區 / 本部 / 全校"
              className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-3 text-sm min-h-[44px]"
            />
          </Field>
          <Field label="專業/年級">
            <input
              type="text"
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              placeholder="例：計算機類 / 全專業"
              className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-3 text-sm min-h-[44px]"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="入學年份/年級">
            <input
              type="text"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="例：2023 級 / 2024 本科新生"
              className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-3 text-sm min-h-[44px]"
            />
          </Field>
          <Field label="樣本量">
            <input
              type="text"
              value={sampleSize}
              onChange={(e) => setSampleSize(e.target.value)}
              placeholder="例：1 人親歷 / 3 人一致 / 官方全量"
              className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-3 text-sm min-h-[44px]"
            />
          </Field>
        </div>

        <Field label="證據/補充">
          <textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            maxLength={1000}
            rows={5}
            placeholder="寫清楚數據如何得出、適用範圍、是否只適用某校區/某專業/某年份。負面或敏感項請提供公開鏈接。"
            className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-3 text-sm"
          />
        </Field>

        <Field label="貢獻者">
          <input
            type="text"
            value={contributor}
            onChange={(e) => setContributor(e.target.value)}
            placeholder="匿名即可；也可以寫 GitHub 用戶名或暱稱"
            className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-3 text-sm min-h-[44px]"
          />
        </Field>

        {err && <p className="text-sm text-accent-500">{err}</p>}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={submit}
            className="px-6 py-3 bg-accent-500 text-ink-950 rounded-full font-semibold text-sm hover:bg-accent-400 min-h-[48px]"
          >
            提交到 GitHub →
          </button>
          <a
            href={`https://github.com/${REPO}/issues?q=is%3Aissue+label%3Adata-contribution`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 border border-ink-700 text-fog-300 rounded-full text-sm hover:text-fog-100 hover:border-fog-500 text-center min-h-[48px] flex items-center justify-center"
          >
            查看所有貢獻
          </a>
        </div>

        <p className="text-xs text-fog-500 mt-4 leading-relaxed">
          CC BY-NC-SA 4.0 · 非商業公益用途 · 公開審核後入庫 · JSON schema 見 issue 正文。
        </p>
      </section>
    </main>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs mono uppercase tracking-[0.2em] text-fog-500">{label}</span>
      {children}
    </label>
  )
}
