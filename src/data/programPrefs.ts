// 選考科目與意向專業的共用定義：題目 S1／S2 的取值、標籤與判定用的小工具。
// 2026-11-07 批 C 起，這兩項是正式題目（AnswerMap 的 S1／S2），不再存 localStorage 起點條件。
import type { SubjectCode } from './programsTypes'

export interface ProgramIntent {
  classCode: string
  className: string
  programCode?: string
  programName?: string
}

export interface ProgramPrefs {
  /** 選滿 3 科才生效；空陣列＝未設定。 */
  subjects: SubjectCode[]
  intent: ProgramIntent | null
}

export const SUBJECT_OPTIONS: readonly { code: SubjectCode; label: string }[] = [
  { code: 'P', label: '物理' },
  { code: 'C', label: '化學' },
  { code: 'B', label: '生物' },
  { code: 'Z', label: '思想政治' },
  { code: 'H', label: '歷史' },
  { code: 'G', label: '地理' },
]
const SUBJECT_ORDER = 'PCBZHG'
const subjectLabelByCode = Object.fromEntries(SUBJECT_OPTIONS.map((s) => [s.code, s.label])) as Record<SubjectCode, string>

/** 六科任選三科的 20 種組合（固定序 PCBZHG），同時涵蓋 3+1+2 的 12 種。 */
export const SUBJECT_COMBOS: readonly string[] = (() => {
  const out: string[] = []
  for (let a = 0; a < 6; a += 1) for (let b = a + 1; b < 6; b += 1) for (let c = b + 1; c < 6; c += 1) out.push(SUBJECT_ORDER[a] + SUBJECT_ORDER[b] + SUBJECT_ORDER[c])
  return out
})()

export const emptyProgramPrefs: ProgramPrefs = { subjects: [], intent: null }

export function isSubjectCode(value: unknown): value is SubjectCode {
  return typeof value === 'string' && value.length === 1 && SUBJECT_ORDER.includes(value)
}

export function normalizeSubjects(codes: readonly string[]): SubjectCode[] {
  const set = new Set(codes.filter(isSubjectCode))
  return [...SUBJECT_ORDER].filter((c): c is SubjectCode => set.has(c as SubjectCode)).slice(0, 3)
}

/** 三科 → 固定序組合鍵（'PCB'）；不足三科回 null。 */
export function subjectsToCombo(codes: readonly string[]): string | null {
  const normalized = normalizeSubjects(codes)
  return normalized.length === 3 ? normalized.join('') : null
}

export function programPrefsActive(prefs: ProgramPrefs): boolean {
  return prefs.subjects.length === 3 || prefs.intent !== null
}

export function subjectLabels(codes: readonly SubjectCode[]): string[] {
  return normalizeSubjects(codes).map((c) => subjectLabelByCode[c])
}

/** 'PCB' → 物理＋化學＋生物 */
export function comboLabel(combo: string): string {
  return subjectLabels([...combo].filter(isSubjectCode)).join('＋')
}

/** 'none' → 不提科目要求；'PC' → 物理＋化學。 */
export function requirementLabel(pattern: string): string {
  if (!pattern || pattern === 'none') return '不提科目要求'
  if (pattern === 'conflict') return '各省表寫法不一致（不作排除依據）'
  return [...pattern].filter(isSubjectCode).map((c) => subjectLabelByCode[c]).join('＋')
}
