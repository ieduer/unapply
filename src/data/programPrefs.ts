// 起點條件：選考科目組合與意向專業。像考生地區與所在地一樣存 localStorage，不進 AnswerMap，
// 不改 43 題與 A+ 學習證據契約；它們在 43 題之後另算一層「起點條件劃掉」。
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

export const emptyProgramPrefs: ProgramPrefs = { subjects: [], intent: null }
export const PROGRAM_PREFS_STORAGE_KEY = 'unapply.programPrefs.v1'

export function isSubjectCode(value: unknown): value is SubjectCode {
  return typeof value === 'string' && value.length === 1 && SUBJECT_ORDER.includes(value)
}

export function normalizeSubjects(codes: readonly string[]): SubjectCode[] {
  const set = new Set(codes.filter(isSubjectCode))
  return [...SUBJECT_ORDER].filter((c): c is SubjectCode => set.has(c as SubjectCode)).slice(0, 3)
}

export function programPrefsActive(prefs: ProgramPrefs): boolean {
  return prefs.subjects.length === 3 || prefs.intent !== null
}

export function subjectLabels(codes: readonly SubjectCode[]): string[] {
  return normalizeSubjects(codes).map((c) => subjectLabelByCode[c])
}

/** 'none' → 不提科目要求；'PC' → 物理＋化學。 */
export function requirementLabel(pattern: string): string {
  if (!pattern || pattern === 'none') return '不提科目要求'
  return [...pattern].filter(isSubjectCode).map((c) => subjectLabelByCode[c]).join('＋')
}

export function readStoredProgramPrefs(): ProgramPrefs {
  try {
    const raw = window.localStorage.getItem(PROGRAM_PREFS_STORAGE_KEY)
    if (!raw) return emptyProgramPrefs
    const parsed = JSON.parse(raw) as Partial<ProgramPrefs>
    const subjects = Array.isArray(parsed.subjects) ? normalizeSubjects(parsed.subjects) : []
    const intent = parsed.intent && typeof parsed.intent === 'object'
      && /^\d{4}$/.test(String(parsed.intent.classCode)) && typeof parsed.intent.className === 'string'
      ? {
        classCode: String(parsed.intent.classCode),
        className: parsed.intent.className,
        ...(typeof parsed.intent.programCode === 'string' && /^\d{6,7}[TK]{0,2}$/.test(parsed.intent.programCode)
          ? { programCode: parsed.intent.programCode, programName: typeof parsed.intent.programName === 'string' ? parsed.intent.programName : undefined }
          : {}),
      }
      : null
    return { subjects: subjects.length === 3 ? subjects : subjects, intent }
  } catch {
    // 隱私模式／禁用儲存／壞掉的值：當成沒設過
    return emptyProgramPrefs
  }
}

export function saveProgramPrefs(prefs: ProgramPrefs) {
  try {
    if (!programPrefsActive(prefs) && prefs.subjects.length === 0) window.localStorage.removeItem(PROGRAM_PREFS_STORAGE_KEY)
    else window.localStorage.setItem(PROGRAM_PREFS_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // 存不下就算了，本次會話仍然生效
  }
}
