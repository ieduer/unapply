// 起點條件引擎：意向專業（類）與選考科目組合，算在 index.json 的每校摘要上。
// 原則與 43 題相同——疑罪從無：沒有本科招生專業資料的學校一律保留（含只公布專科專業的學校）；
// 對不到專業類的試驗班視為「未能判定」而不是「沒開」。
// 這一層在 filterSchools 之後另算，結果與計數和 43 題分開（stats.byQuestion 不混入，A+ 證據仍取 43 題的結果）。

import type { School } from '../data/schools'
import type { ProgramIndexEntry, ProgramIndexPayload, SubjectCode } from '../data/programsTypes'
import type { ProgramPrefs } from '../data/programPrefs'
import { programPrefsActive, requirementLabel, subjectLabels } from '../data/programPrefs'

export type ProgramStrikeKind = 'program' | 'subjects'

export interface ProgramStrikeReason {
  kind: ProgramStrikeKind
  label: string
}

export interface ProgramVerdict {
  /** no-data＝沒有本科招生專業資料（保留）；unknown＝有試驗班對不到專業類（保留）；kept／struck＝可判定。 */
  state: 'no-data' | 'kept' | 'struck' | 'unknown'
  reasons: ProgramStrikeReason[]
  /** 符合意向專業（類）的本科招生專業數；未設意向時＝全部本科專業數。 */
  matchingCount: number
  /** matchingCount 之中，選科可報的；未設選科時＝matchingCount。 */
  admissibleCount: number
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

export type ProgramIndexLookup = Pick<ProgramIndexPayload, 'patterns' | 'catalogCodes'>

/** 一個專業的選考要求圖樣能不能被這組選科滿足：要求的每一科都在選科裡。'none' 恆可報。 */
export function isAdmissible(pattern: string, chosen: ReadonlySet<SubjectCode>): boolean {
  if (!pattern || pattern === 'none') return true
  for (const code of pattern) if (!chosen.has(code as SubjectCode)) return false
  return true
}

/** 全校本科專業的圖樣下標（含試驗班）。 */
export function allPatternIndexes(entry: ProgramIndexEntry): number[] {
  return [...Object.values(entry.c).flat(), ...(entry.e ?? [])]
}

/** 符合意向的本科專業圖樣下標；未設意向＝全部。 */
export function matchingPatternIndexes(entry: ProgramIndexEntry, prefs: ProgramPrefs, lookup: ProgramIndexLookup): number[] {
  const intent = prefs.intent
  if (!intent) return allPatternIndexes(entry)
  const inClass = entry.c[intent.classCode] ?? []
  if (!intent.programCode) return inClass
  // 指定到具體專業時：對到同代碼的專業，或該校按整個專業類招生（大類招生本來就涵蓋它）。
  const codeIndex = lookup.catalogCodes.indexOf(intent.programCode)
  const exact = (entry.k ?? []).filter(([index]) => index === codeIndex).map(([, pattern]) => pattern)
  return entry.g?.includes(intent.classCode) ? [...exact, ...inClass] : exact
}

export function countAdmissible(entry: ProgramIndexEntry, chosen: ReadonlySet<SubjectCode>, lookup: ProgramIndexLookup): number {
  return allPatternIndexes(entry).filter((index) => isAdmissible(lookup.patterns[index], chosen)).length
}

export function evaluateSchoolPrograms(entry: ProgramIndexEntry | undefined, prefs: ProgramPrefs, lookup: ProgramIndexLookup): ProgramVerdict {
  if (!entry || entry.u === 0) return { state: 'no-data', reasons: [], matchingCount: 0, admissibleCount: 0, experimental: 0 }
  if (!programPrefsActive(prefs)) return { state: 'kept', reasons: [], matchingCount: entry.u, admissibleCount: entry.u, experimental: entry.x }

  const matching = matchingPatternIndexes(entry, prefs, lookup)
  const reasons: ProgramStrikeReason[] = []
  if (prefs.intent && matching.length === 0) {
    if (entry.x > 0) return { state: 'unknown', reasons: [], matchingCount: 0, admissibleCount: 0, experimental: entry.x }
    const wanted = prefs.intent.programName ?? prefs.intent.className
    reasons.push({ kind: 'program', label: `沒有開設「${wanted}」（${entry.u} 個本科招生專業（類）裡都沒有）` })
    return { state: 'struck', reasons, matchingCount: 0, admissibleCount: 0, experimental: entry.x }
  }

  const chosen = prefs.subjects.length === 3 ? new Set(prefs.subjects) : null
  const admissible = chosen ? matching.filter((index) => isAdmissible(lookup.patterns[index], chosen)) : matching
  if (chosen && matching.length > 0 && admissible.length === 0) {
    const scope = prefs.intent ? `「${prefs.intent.programName ?? prefs.intent.className}」的 ${matching.length} 個招生專業` : `這 ${matching.length} 個本科招生專業（類）`
    const required = [...new Set(matching.map((index) => requirementLabel(lookup.patterns[index])))].slice(0, 3).join('／')
    reasons.push({ kind: 'subjects', label: `選科 ${subjectLabels(prefs.subjects).join('＋')} 報不了${scope}（要求：${required}）` })
    return { state: 'struck', reasons, matchingCount: matching.length, admissibleCount: 0, experimental: entry.x }
  }
  return { state: 'kept', reasons, matchingCount: matching.length, admissibleCount: admissible.length, experimental: entry.x }
}

/** 對 43 題之後仍在場的學校再套起點條件。沒有本科資料的學校原樣保留。 */
export function applyProgramPrefs(kept: School[], index: ProgramIndexPayload, prefs: ProgramPrefs): ProgramFilterOutcome {
  const outcome: ProgramFilterOutcome = { kept: [], struck: [], stats: { evaluated: 0, noData: 0, unknown: 0, struckByProgram: 0, struckBySubjects: 0 } }
  if (!programPrefsActive(prefs)) return { ...outcome, kept }
  for (const school of kept) {
    const verdict = evaluateSchoolPrograms(school.moeCode ? index.schools[school.moeCode] : undefined, prefs, index)
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
