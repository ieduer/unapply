// 展示層的翻譯小工具：把引擎／資料層的機器欄（取值代碼、題號、選項 key、標籤 spec、排除理由）翻成目前語言的人話。
// 引擎（engine/*、lib/schoolProfile.ts、data/*）保持語言中立，只有這裡與元件匯入 i18n。
// 資料驅動名稱（學校名、城市名、專業目錄名、來源標題、機構名）不翻譯：zh-Hans 介面只對手工增強層的正體校名用 nameSimplified，官方簡體原文照舊；en 介面有 nameEn 才並列。
import type { DimensionId } from '../data/dimensions'
import { allQuestions } from '../data/questions'
import type { School } from '../data/schools'
import { programClassByCode, programDisciplineNameByCode } from '../data/programClasses'
import { SUBJECT_COMBOS, isSubjectCode } from '../data/programPrefs'
import type { SubjectCode } from '../data/programsTypes'
import type { AdmissionResourceLink } from '../data/admissionAuthorities'
import type { ExcludeReason, KeptDistribution } from '../engine/filter'
import { labelForValue, keptHighlightCodes } from '../engine/filter'
import type { ProgramStrikeReason } from '../engine/programs'
import type { SchoolTagSpec } from '../lib/schoolProfile'
import { getLocale, t, tOr } from '../i18n/core'

const questionById = new Map(allQuestions.map((question) => [question.id, question]))

/** 省級行政區名（A1 取值原文）→ 目前語言；缺鍵回原文。 */
export function provinceLabel(province: string): string {
  return tOr(`geo.province.${province}`, province)
}

/** 校名：zh-Hant＝原文（官方簡體名照舊）；zh-Hans＝手工層的 nameSimplified，其餘原文；en＝原文，有 nameEn 時並列。 */
export function schoolDisplayName(school: Pick<School, 'name' | 'nameSimplified' | 'nameEn'>): string {
  const locale = getLocale()
  if (locale === 'zh-Hans') return school.nameSimplified ?? school.name
  if (locale === 'en' && school.nameEn) return `${school.name} · ${school.nameEn}`
  return school.name
}

/** 選考科目代碼 → 目前語言。 */
export function subjectLabel(code: string): string {
  return tOr(`subject.${code}`, code)
}

/** 'PCB' → 物理＋化學＋生物 / Physics + Chemistry + Biology。 */
export function comboLabel(combo: string): string {
  return [...combo].filter(isSubjectCode).map(subjectLabel).join(t('q.S1.opt.joiner'))
}

/** 選考要求圖樣 → 目前語言：'none'／'conflict'／'PC'。 */
export function requirementLabel(pattern: string): string {
  if (!pattern || pattern === 'none') return t('subject.requirement.none')
  if (pattern === 'conflict') return t('subject.requirement.conflict')
  return [...pattern].filter(isSubjectCode).map(subjectLabel).join(t('program.subjectJoiner'))
}

/** 專業類代碼 → 目錄原文（資料，不翻譯）。 */
export function programClassLabel(code: string): string {
  const klass = programClassByCode[code]
  if (!klass) return code
  return t('q.S2.opt.template', { className: klass.name, disciplineName: programDisciplineNameByCode[klass.discipline] ?? klass.discipline })
}

/** 維度取值原文 → 目前語言（C5 以學科＋等級組合；S1 組合、S2 專業類另算；其餘查 val.<dim>.<value>，缺鍵回 zh-Hant 後備）。 */
export function valueLabel(dim: DimensionId | string, value: string): string {
  const c5 = /^(CS|EE|Math|Med|Econ|Law|Chn|Hist):(A[+-]?)$/.exec(value)
  if (c5) return t('val.C5.template', { subject: t(`val.C5.subject.${c5[1]}`), grade: c5[2] })
  if (dim === 'S1' || SUBJECT_COMBOS.includes(value)) return comboLabel(value)
  if (dim === 'S2' && /^\d{4}$/.test(value) && programClassByCode[value]) return programClassByCode[value].name
  if (dim === 'A1') return provinceLabel(value)
  return tOr(`val.${dim}.${value}`, labelForValue(value))
}

export function dimensionLabel(dim: DimensionId | string): string {
  return t(`dim.${dim}.label`)
}

export function questionTitle(id: DimensionId | string): string {
  return tOr(`q.${id}.title`, questionById.get(id as DimensionId)?.title ?? id)
}

export function questionSubtitle(id: DimensionId | string): string | undefined {
  const subtitle = questionById.get(id as DimensionId)?.subtitle
  return subtitle ? tOr(`q.${id}.subtitle`, subtitle) : undefined
}

/** 選項 key → 目前語言的選項文字（S1 以科目組合、S2 以目錄原文＋模板）。 */
export function optionLabel(questionId: DimensionId | string, key: string): string {
  if (questionId === 'S1') return comboLabel(key)
  if (questionId === 'S2') return programClassLabel(key)
  const fallback = questionById.get(questionId as DimensionId)?.options.find((option) => option.key === key)?.label ?? key
  return tOr(`q.${questionId}.opt.${key}.label`, fallback)
}

export function optionHint(questionId: DimensionId | string, key: string): string | undefined {
  const hint = questionById.get(questionId as DimensionId)?.options.find((option) => option.key === key)?.hint
  return hint ? tOr(`q.${questionId}.opt.${key}.hint`, hint) : undefined
}

export function sectionLabel(section: string): string {
  const code = section === 'A_redline' ? 'A' : section === 'E_environment' ? 'E' : section === 'B_quality' ? 'B' : section === 'S_programs' ? 'S' : 'C'
  return t(`section.${code}`)
}

/** 排除理由的三段（題目／你選了／該校是）→ 目前語言。 */
export function describeReason(reason: ExcludeReason): { questionTitle: string; answer: string; schoolValue: string } {
  const title = questionTitle(reason.questionId)
  const answer = reason.answerKeys.map((key) => optionLabel(reason.questionId, key)).join(t('reason.answerJoiner'))
  const joiner = t('reason.valueJoiner')
  let schoolValue: string
  if (reason.rule === 'excludes') {
    schoolValue = reason.schoolValues.map((value) => valueLabel(reason.dim, value)).join(joiner)
  } else {
    const wanted = (reason.wantedValues ?? []).map((value) => valueLabel(reason.dim, value)).join('/')
    if (reason.dim === 'S1' && reason.programs?.requirements) {
      const sorted = reason.programs.requirements
      const shown = sorted.slice(0, 4).map(({ pattern, count }) => t('program.requirements.count', { label: requirementLabel(pattern), n: count })).join(joiner)
      const requirements = sorted.length > 4 ? t('program.requirements.etc', { shown, n: sorted.length }) : shown
      schoolValue = t('reason.s1.schoolValue', { u: reason.programs.u, requirements, wanted })
    } else if (reason.dim === 'S2' && reason.programs?.classes) {
      const classes = reason.programs.classes
      schoolValue = t('reason.s2.schoolValue', { n: classes.length, shown: classes.slice(0, 8).map((code) => valueLabel('S2', code)).join(joiner), etc: classes.length > 8 ? t('reason.s2.etc') : '', wanted })
    } else {
      schoolValue = t('reason.requires.schoolValue', { value: reason.schoolValues.map((value) => valueLabel(reason.dim, value)).join(joiner), wanted })
    }
  }
  return { questionTitle: title, answer, schoolValue }
}

export function formatReason(reason: ExcludeReason): string {
  return t('ui.result.reason', describeReason(reason))
}

/** 「你為什麼沒劃掉它」一句話 → 目前語言。 */
export function explainKeptLocalized(school: School): string {
  const codes = keptHighlightCodes(school)
  const bits: string[] = []
  if (codes.level) bits.push(codes.level === 'C9' ? 'C9' : t(`reason.kept.${codes.level}`))
  if (codes.tier) bits.push(t(`reason.kept.${codes.tier}`))
  if (codes.type) bits.push(tOr(`tag.type.${codes.type}`, codes.type))
  if (bits.length === 0) return t('reason.kept.none')
  return bits.slice(0, 3).join(t('reason.kept.joiner'))
}

/** 結果分佈卡：機器欄 → 目前語言。 */
export function distributionLabel(kind: keyof KeptDistribution, row: { label: string; code: string }): string {
  if (kind === 'byProvince') return provinceLabel(row.code)
  if (kind === 'byLevel') return tOr(`dist.level.${row.code}`, row.label)
  return tOr(`dist.cityTier.${row.code}`, row.label)
}

/** 卡片標籤 spec → 目前語言。 */
export function tagLabel(spec: SchoolTagSpec): string {
  if (spec.key === 'tag.provinceCity' && spec.params) return t('tag.provinceCity', { province: provinceLabel(spec.params.province), city: spec.params.city })
  return tOr(spec.key, spec.fallback, spec.params)
}

/** 官方／權威鏈接標籤 → 目前語言。 */
export function linkLabel(link: AdmissionResourceLink): string {
  return tOr(link.labelKey, link.label, link.labelParams ? { province: provinceLabel(link.labelParams.province) } : undefined)
}

export function linkNote(link: AdmissionResourceLink): string | undefined {
  if (!link.note) return undefined
  return link.noteKey ? tOr(link.noteKey, link.note) : link.note
}

/** 學校詳情的 S1／S2 劃掉理由 → 目前語言。 */
export function programStrikeLabel(reason: ProgramStrikeReason): string {
  if (reason.kind === 'subjects') {
    return t('program.strike.subjects', {
      subjects: (reason.params.subjects ?? []).map(subjectLabel).join(t('program.subjectJoiner')),
      u: reason.params.u,
      required: (reason.params.required ?? []).map(requirementLabel).join('／'),
    })
  }
  return t('program.strike.program', { wanted: reason.params.wanted ?? '', u: reason.params.u })
}

export function subjectsLabel(codes: readonly SubjectCode[]): string {
  return codes.map(subjectLabel).join(t('program.subjectJoiner'))
}
