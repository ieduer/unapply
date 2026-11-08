import { useMemo, useState, type ReactNode } from 'react'
import type { School } from '../data/schools'
import { DIMENSIONS } from '../data/dimensions'
import type { DimensionId } from '../data/dimensions'
import { recordUnapplyEvent } from '../lib/bdfzIdentity'
import { useLocale } from '../i18n/react'
import { Rich } from '../i18n/rich'
import { dimensionLabel, schoolDisplayName, valueLabel } from '../lib/i18nLabels'
import { SiteHeader } from './SiteHeader'

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

// 下列三張表是寫進 GitHub issue／用戶中心事件的紀錄文字（zh-Hant 契約，維護者讀）；介面顯示另以 ui.contribute.* 鍵翻譯。
const SOURCE_LABELS: Record<SourceType, string> = { // i18n-contract
  official: '教育部/政府公告', // i18n-contract
  school: '學校官網/招生章程', // i18n-contract
  student: '在讀學生/校友', // i18n-contract
  news: '媒體/公開新聞', // i18n-contract
  map: '地圖/交通資料', // i18n-contract
  github: 'GitHub/開放數據', // i18n-contract
  other: '其他', // i18n-contract
}

const CONFIDENCE_KEYS: Confidence[] = ['high', 'medium', 'low']

const CATEGORY_LABELS: Record<CustomCategory, string> = { // i18n-contract
  campus_location: '校區/地理/交通', // i18n-contract
  tuition_fee: '學費/住宿費/合作辦學', // i18n-contract
  dormitory: '宿舍/浴室/空調/洗衣', // i18n-contract
  management_rules: '門禁/查寢/跑步/早晚自習', // i18n-contract
  academic_major: '專業/學科/培養方案', // i18n-contract
  employment: '就業/升學/保研/出國', // i18n-contract
  mobility_transfer: '轉專業/輔修/跨校區流動', // i18n-contract
  accessibility: '無障礙/特殊需求支持', // i18n-contract
  food_safety: '食堂/食品安全', // i18n-contract
  student_life: '學生生活/社團/校園服務', // i18n-contract
  other: '其他重要數據', // i18n-contract
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
  // GitHub issue 正文：維護者讀的 zh-Hant 紀錄（schema unapply.dataContribution.v1），不隨介面語言變。 // i18n-contract
  return [
    `**學校**: ${params.schoolName}（id=${params.schoolId}）`, // i18n-contract
    `**數據項**: ${params.dimensionLabel}`, // i18n-contract
    `**取值**: ${params.value}`, // i18n-contract
    `**來源類型**: ${params.sourceLabel}`, // i18n-contract
    `**證據/補充**:`, // i18n-contract
    params.evidence || '（未填）', // i18n-contract
    '',
    `**貢獻者**: ${params.contributor || '（匿名）'}`, // i18n-contract
    '',
    '```json',
    JSON.stringify(params.contribution, null, 2),
    '```',
    '',
    '---',
    'schema: unapply.dataContribution.v1',
    '入庫原則：可核驗來源優先；眾包項至少交叉覆核；敏感/負面項必須有公開證據。', // i18n-contract
  ].join('\n')
}

export function ContributePage({ schools, onBack }: Props) {
  const { t } = useLocale()
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
  const [errKey, setErrKey] = useState<string | null>(null)

  const school = schools.find(s => s.id === schoolId)
  const isCustom = dim === CUSTOM_DIM
  const knownDim = isCustom ? null : (dim as DimensionId)
  const meta = knownDim ? DIMENSIONS[knownDim] : null
  const selectedValue = isCustom || value === FREE_VALUE ? customValue.trim() : value
  // 紀錄用的維度描述（zh-Hant 契約）。
  const dimensionRecordLabel = isCustom
    ? `${CATEGORY_LABELS[customCategory]} · ${customMetric.trim() || '自定義項'}` // i18n-contract
    : `${knownDim} · ${meta?.label ?? knownDim}`

  const submit = () => {
    setErrKey(null)
    if (!schoolId) {
      setErrKey('ui.contribute.err.school')
      return
    }
    if (isCustom && !customMetric.trim()) {
      setErrKey('ui.contribute.err.customMetric')
      return
    }
    if (!selectedValue) {
      setErrKey('ui.contribute.err.value')
      return
    }
    if (!sourceTitle.trim() && !sourceUrl.trim() && !evidence.trim()) {
      setErrKey('ui.contribute.err.source')
      return
    }
    if (['official', 'school', 'news', 'map', 'github'].includes(sourceType) && !sourceUrl.trim()) {
      setErrKey('ui.contribute.err.sourceUrl')
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
      dimensionLabel: dimensionRecordLabel,
      value: selectedValue,
      sourceLabel: SOURCE_LABELS[sourceType],
      evidence,
      contributor,
    })
    const title = `數據貢獻：${school?.name ?? schoolId} · ${dimensionRecordLabel} = ${selectedValue}` // i18n-contract
    const url = new URL(ISSUE_URL)
    url.searchParams.set('template', 'data-contribution.md')
    url.searchParams.set('title', title)
    url.searchParams.set('body', body)
    url.searchParams.set('labels', 'data-contribution,needs-triage')

    void recordUnapplyEvent({
      recordKind: 'event',
      recordKey: `contrib-${schoolId}-${Date.now().toString(36)}`,
      title: `發起貢獻：${school?.name ?? schoolId} · ${dimensionRecordLabel}`, // i18n-contract
      summary: `值=${selectedValue}${sourceTitle ? ` · 源=${sourceTitle.slice(0, 30)}` : ''}`, // i18n-contract
      payload: contribution,
    })

    window.open(url.toString(), '_blank', 'noopener,noreferrer')
  }

  const inputClass = 'w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-3 text-sm min-h-[44px]'

  return (
    <main className="min-h-screen app-canvas text-fog-100 page-end-space">
      <SiteHeader sticky width="max-w-2xl" brand={t('ui.contribute.kicker')} back={{ label: t('ui.common.back'), onClick: onBack }} />

      <section className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-24 flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h1 className="serif text-2xl sm:text-3xl">{t('ui.contribute.title')}</h1>
          <p className="text-sm text-fog-500 leading-relaxed">
            <Rich k="ui.contribute.lede" params={{ repo: REPO }} />
          </p>
          <p className="text-xs text-fog-500 leading-relaxed">{t('ui.contribute.rule1')}</p>
          <p className="text-xs text-fog-500 leading-relaxed">{t('ui.contribute.rule2')}</p>
        </div>

        <Field label={t('ui.contribute.field.school')}>
          <select
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            className={inputClass}
          >
            {schools.map(s => <option key={s.id} value={s.id}>{schoolDisplayName(s)}</option>)}
          </select>
        </Field>

        <Field label={t('ui.contribute.field.dimension')}>
          <select
            value={dim}
            onChange={(e) => {
              setDim(e.target.value as ContributionDimension)
              setValue('')
              setCustomValue('')
            }}
            className={inputClass}
          >
            <option value={CUSTOM_DIM}>{t('ui.contribute.customDim')}</option>
            {CONTRIBUTABLE_DIMS.map(d => (
              <option key={d} value={d}>{t('ui.contribute.dimOption', { id: d, label: dimensionLabel(d) })}</option>
            ))}
          </select>
          {meta?.notes && <p className="text-xs text-fog-500 mt-2">{meta.notes}</p>}
        </Field>

        {isCustom && (
          <>
            <Field label={t('ui.contribute.field.customCategory')}>
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value as CustomCategory)}
                className={inputClass}
              >
                {(Object.keys(CATEGORY_LABELS) as CustomCategory[]).map((key) => (
                  <option key={key} value={key}>{t(`ui.contribute.category.${key}`)}</option>
                ))}
              </select>
            </Field>
            <Field label={t('ui.contribute.field.customMetric')}>
              <input
                type="text"
                value={customMetric}
                onChange={(e) => setCustomMetric(e.target.value)}
                placeholder={t('ui.contribute.placeholder.customMetric')}
                className={inputClass}
              />
            </Field>
          </>
        )}

        <Field label={t('ui.contribute.field.value')}>
          {!isCustom && meta && knownDim ? (
            <select
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                if (e.target.value !== FREE_VALUE) setCustomValue('')
              }}
              className={inputClass}
            >
              <option value="">{t('ui.contribute.valuePlaceholder')}</option>
              {meta.values.map((v) => <option key={v} value={v}>{valueLabel(knownDim, v)}</option>)}
              <option value={FREE_VALUE}>{t('ui.contribute.valueOther')}</option>
            </select>
          ) : null}
          {(isCustom || value === FREE_VALUE) && (
            <input
              type="text"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder={t('ui.contribute.placeholder.customValue')}
              className={inputClass}
            />
          )}
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('ui.contribute.field.sourceType')}>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as SourceType)}
              className={inputClass}
            >
              {(Object.keys(SOURCE_LABELS) as SourceType[]).map((key) => (
                <option key={key} value={key}>{t(`ui.contribute.sourceType.${key}`)}</option>
              ))}
            </select>
          </Field>
          <Field label={t('ui.contribute.field.confidence')}>
            <select
              value={confidence}
              onChange={(e) => setConfidence(e.target.value as Confidence)}
              className={inputClass}
            >
              {CONFIDENCE_KEYS.map((key) => (
                <option key={key} value={key}>{t(`ui.contribute.confidence.${key}`)}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={t('ui.contribute.field.sourceTitle')}>
          <input type="text" value={sourceTitle} onChange={(e) => setSourceTitle(e.target.value)} placeholder={t('ui.contribute.placeholder.sourceTitle')} className={inputClass} />
        </Field>

        <Field label={t('ui.contribute.field.sourceUrl')}>
          <input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." className={inputClass} />
        </Field>

        <Field label={t('ui.contribute.field.sourceDate')}>
          <input type="text" value={sourceDate} onChange={(e) => setSourceDate(e.target.value)} placeholder={t('ui.contribute.placeholder.sourceDate')} className={inputClass} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('ui.contribute.field.campus')}>
            <input type="text" value={campus} onChange={(e) => setCampus(e.target.value)} placeholder={t('ui.contribute.placeholder.campus')} className={inputClass} />
          </Field>
          <Field label={t('ui.contribute.field.major')}>
            <input type="text" value={major} onChange={(e) => setMajor(e.target.value)} placeholder={t('ui.contribute.placeholder.major')} className={inputClass} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('ui.contribute.field.grade')}>
            <input type="text" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder={t('ui.contribute.placeholder.grade')} className={inputClass} />
          </Field>
          <Field label={t('ui.contribute.field.sampleSize')}>
            <input type="text" value={sampleSize} onChange={(e) => setSampleSize(e.target.value)} placeholder={t('ui.contribute.placeholder.sampleSize')} className={inputClass} />
          </Field>
        </div>

        <Field label={t('ui.contribute.field.evidence')}>
          <textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            maxLength={1000}
            rows={5}
            placeholder={t('ui.contribute.placeholder.evidence')}
            className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-3 text-sm"
          />
        </Field>

        <Field label={t('ui.contribute.field.contributor')}>
          <input type="text" value={contributor} onChange={(e) => setContributor(e.target.value)} placeholder={t('ui.contribute.placeholder.contributor')} className={inputClass} />
        </Field>

        {errKey && <p className="text-sm text-accent-500">{t(errKey)}</p>}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={submit}
            className="px-6 py-3 bg-accent-500 text-ink-950 rounded-full font-semibold text-sm hover:bg-accent-400 min-h-[48px]"
          >
            {t('ui.contribute.submit')}
          </button>
          <a
            href={`https://github.com/${REPO}/issues?q=is%3Aissue+label%3Adata-contribution`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 border border-ink-700 text-fog-300 rounded-full text-sm hover:text-fog-100 hover:border-fog-500 text-center min-h-[48px] flex items-center justify-center"
          >
            {t('ui.contribute.viewAll')}
          </a>
        </div>

        <p className="text-xs text-fog-500 mt-4 leading-relaxed">
          {t('ui.contribute.footer')}
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
