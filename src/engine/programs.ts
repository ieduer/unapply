// 起點條件引擎：意向專業（類）與選考科目組合。
// 原則與 43 題相同——疑罪從無：沒有入庫資料的學校一律保留；對不到專業類的試驗班視為「未能判定」而不是「沒開」。
// 這一層在 filterSchools 之後另算，結果與計數和 43 題分開（stats.byQuestion 不混入，A+ 證據仍取 43 題的結果）。

import type { School } from '../data/schools'
import type { ProgramOffering, ProgramOfferingsPayload, SchoolPrograms, SubjectCode } from '../data/programsTypes'
import type { ProgramPrefs } from '../data/programPrefs'
import { programPrefsActive, requirementLabel, subjectLabels } from '../data/programPrefs'

export type ProgramStrikeKind = 'program' | 'subjects'

export interface ProgramStrikeReason {
  kind: ProgramStrikeKind
  label: string
}

export interface ProgramVerdict {
  /** no-data＝未入庫（保留）；unknown＝有試驗班對不到專業類（保留）；kept／struck＝可判定。 */
  state: 'no-data' | 'kept' | 'struck' | 'unknown'
  reasons: ProgramStrikeReason[]
  /** 符合意向專業（類）的招生專業；未設意向時＝全部。 */
  matching: ProgramOffering[]
  /** matching 之中，選科可報的；未設選科時＝matching。 */
  admissible: ProgramOffering[]
  experimental: number
}

export interface ProgramFilterOutcome {
  kept: School[]
  struck: { school: School; verdict: ProgramVerdict }[]
  stats: {
    evaluated: number
    noData: number
    unknown: number
    struckByProgram: number
    struckBySubjects: number
  }
}

/** 一個專業的選考要求圖樣能不能被這組選科滿足：要求的每一科都在選科裡。'none' 恆可報。 */
export function isAdmissible(pattern: string, chosen: ReadonlySet<SubjectCode>): boolean {
  if (!pattern || pattern === 'none') return true
  for (const code of pattern) if (!chosen.has(code as SubjectCode)) return false
  return true
}

export function indexSchoolPrograms(payload: ProgramOfferingsPayload): Map<string, SchoolPrograms> {
  return new Map(payload.schools.map((entry) => [entry.moeCode, entry]))
}

function matchesIntent(program: ProgramOffering, prefs: ProgramPrefs): boolean {
  const intent = prefs.intent
  if (!intent) return true
  if (program.cl !== intent.classCode) return false
  // 指定到具體專業時：同代碼，或該校按整個專業類招生（大類招生本來就涵蓋它）。
  if (intent.programCode) return program.k === intent.programCode || program.m === 'class'
  return true
}

export function evaluateSchoolPrograms(entry: SchoolPrograms | undefined, prefs: ProgramPrefs): ProgramVerdict {
  const empty: ProgramVerdict = { state: 'no-data', reasons: [], matching: [], admissible: [], experimental: 0 }
  if (!entry) return empty
  if (!programPrefsActive(prefs)) return { ...empty, state: 'kept', matching: entry.programs, admissible: entry.programs, experimental: entry.programs.filter((p) => p.m === 'none').length }

  const experimental = entry.programs.filter((p) => p.m === 'none').length
  const matching = entry.programs.filter((p) => matchesIntent(p, prefs))
  const reasons: ProgramStrikeReason[] = []

  if (prefs.intent && matching.length === 0) {
    if (experimental > 0) {
      return { state: 'unknown', reasons: [], matching, admissible: [], experimental }
    }
    const wanted = prefs.intent.programName ?? prefs.intent.className
    reasons.push({ kind: 'program', label: `沒有開設「${wanted}」（${entry.programs.length} 個招生專業（類）裡都沒有）` })
    return { state: 'struck', reasons, matching, admissible: [], experimental }
  }

  const chosen = prefs.subjects.length === 3 ? new Set(prefs.subjects) : null
  const admissible = chosen ? matching.filter((p) => isAdmissible(p.r, chosen)) : matching
  if (chosen && matching.length > 0 && admissible.length === 0) {
    const scope = prefs.intent ? `「${prefs.intent.programName ?? prefs.intent.className}」的 ${matching.length} 個招生專業` : `這 ${matching.length} 個招生專業（類）`
    const patterns = [...new Set(matching.map((p) => requirementLabel(p.r)))].slice(0, 3).join('／')
    reasons.push({ kind: 'subjects', label: `選科 ${subjectLabels(prefs.subjects).join('＋')} 報不了${scope}（要求：${patterns}）` })
    return { state: 'struck', reasons, matching, admissible, experimental }
  }
  return { state: 'kept', reasons, matching, admissible, experimental }
}

/** 對 43 題之後仍在場的學校再套起點條件。沒有資料的學校原樣保留。 */
export function applyProgramPrefs(kept: School[], payload: ProgramOfferingsPayload, prefs: ProgramPrefs): ProgramFilterOutcome {
  const index = indexSchoolPrograms(payload)
  const outcome: ProgramFilterOutcome = { kept: [], struck: [], stats: { evaluated: 0, noData: 0, unknown: 0, struckByProgram: 0, struckBySubjects: 0 } }
  if (!programPrefsActive(prefs)) return { ...outcome, kept }
  for (const school of kept) {
    const verdict = evaluateSchoolPrograms(school.moeCode ? index.get(school.moeCode) : undefined, prefs)
    if (verdict.state === 'no-data') { outcome.stats.noData += 1; outcome.kept.push(school); continue }
    outcome.stats.evaluated += 1
    if (verdict.state === 'unknown') { outcome.stats.unknown += 1; outcome.kept.push(school); continue }
    if (verdict.state === 'struck') {
      if (verdict.reasons[0]?.kind === 'program') outcome.stats.struckByProgram += 1
      else outcome.stats.struckBySubjects += 1
      outcome.struck.push({ school, verdict })
      continue
    }
    outcome.kept.push(school)
  }
  return outcome
}

export function describeProgramPrefs(prefs: ProgramPrefs): string[] {
  const parts: string[] = []
  if (prefs.intent) parts.push(`意向：${prefs.intent.programName ? `${prefs.intent.programName}（${prefs.intent.className}）` : prefs.intent.className}`)
  if (prefs.subjects.length === 3) parts.push(`選科：${subjectLabels(prefs.subjects).join('＋')}`)
  return parts
}
