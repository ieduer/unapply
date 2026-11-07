// 專業／選考資料層的純函數：題目 S1（選考科目組合）、S2（意向專業類）的學校取值，以及學校詳情的逐校判定。
// 原則與 43 題相同——疑罪從無：沒有本科招生專業資料的學校（含只公布專科專業的）取值為 null，永不因這兩題被劃掉；
// 對不到專業類的試驗班以通配值表示「可能涵蓋任何專業類」，requires 判定遇到通配值一律保留。

import type { ProgramIndexEntry, ProgramIndexPayload, SubjectCode } from '../data/programsTypes'
import type { ProgramPrefs } from '../data/programPrefs'
import { SUBJECT_COMBOS, programPrefsActive, requirementLabel, subjectLabels } from '../data/programPrefs'

export type ProgramIndexLookup = Pick<ProgramIndexPayload, 'patterns' | 'catalogCodes'>

/** S2 的通配值：該校另有試驗班對不到專業類，不能說它沒開任何一類。 */
export const PROGRAM_CLASS_WILDCARD = '*'

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

/** S1 的學校取值：20 種三科組合中，至少有一個本科招生專業可報的那些。 */
export function admissibleCombos(entry: ProgramIndexEntry, lookup: ProgramIndexLookup): string[] {
  const patterns = [...new Set(allPatternIndexes(entry).map((index) => lookup.patterns[index]))]
  return SUBJECT_COMBOS.filter((combo) => {
    const chosen = new Set([...combo] as SubjectCode[])
    return patterns.some((pattern) => isAdmissible(pattern, chosen))
  })
}

/** S2 的學校取值：本科招生專業對到的專業類；另有試驗班時加通配值。 */
export function offeredClasses(entry: ProgramIndexEntry): string[] {
  const classes = Object.keys(entry.c).sort()
  return entry.x > 0 ? [...classes, PROGRAM_CLASS_WILDCARD] : classes
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

/** 排除理由用：全校本科專業的選考要求分佈（出現次數多的在前，最多 limit 種），例：物理＋化學 ×50 / 物理 ×6。 */
export function describeRequirements(entry: ProgramIndexEntry, lookup: ProgramIndexLookup, limit = 4): string {
  const counts = new Map<string, number>()
  for (const index of allPatternIndexes(entry)) {
    const pattern = lookup.patterns[index] ?? 'none'
    counts.set(pattern, (counts.get(pattern) ?? 0) + 1)
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const shown = sorted.slice(0, limit).map(([pattern, n]) => `${requirementLabel(pattern)} ×${n}`)
  return sorted.length > limit ? `${shown.join(' / ')} 等 ${sorted.length} 種` : shown.join(' / ')
}

export function countAdmissible(entry: ProgramIndexEntry, chosen: ReadonlySet<SubjectCode>, lookup: ProgramIndexLookup): number {
  return allPatternIndexes(entry).filter((index) => isAdmissible(lookup.patterns[index], chosen)).length
}

export type ProgramStrikeKind = 'program' | 'subjects'

export interface ProgramStrikeReason {
  kind: ProgramStrikeKind
  label: string
}

export interface ProgramVerdict {
  /** no-data＝沒有本科招生專業資料（保留）；unknown＝有試驗班對不到專業類（保留）；kept／struck＝可判定。 */
  state: 'no-data' | 'kept' | 'struck' | 'unknown'
  reasons: ProgramStrikeReason[]
  matchingCount: number
  admissibleCount: number
  experimental: number
}

/**
 * 學校詳情用的逐校判定，與引擎對 S1／S2 兩題的 requires 判定同義、文字更完整：
 * S1 看全校任一本科專業是否可報（admissibleCombos）；S2 看是否開設該專業類（offeredClasses），沒開但另有試驗班＝unknown（保留）。
 * 兩題各自獨立判定，所以「開了這一類但這一類的專業你的選科都報不了」不會劃掉學校，只在 admissibleCount 裡如實顯示 0。
 */
export function evaluateSchoolPrograms(entry: ProgramIndexEntry | undefined, prefs: ProgramPrefs, lookup: ProgramIndexLookup): ProgramVerdict {
  if (!entry || entry.u === 0) return { state: 'no-data', reasons: [], matchingCount: 0, admissibleCount: 0, experimental: 0 }
  if (!programPrefsActive(prefs)) return { state: 'kept', reasons: [], matchingCount: entry.u, admissibleCount: entry.u, experimental: entry.x }

  const reasons: ProgramStrikeReason[] = []
  const chosen = prefs.subjects.length === 3 ? new Set(prefs.subjects) : null
  const all = allPatternIndexes(entry)
  if (chosen && !all.some((index) => isAdmissible(lookup.patterns[index], chosen))) {
    const required = [...new Set(all.map((index) => requirementLabel(lookup.patterns[index])))].slice(0, 3).join('／')
    reasons.push({ kind: 'subjects', label: `選科 ${subjectLabels(prefs.subjects).join('＋')} 報不了本校 ${entry.u} 個本科招生專業（類）中的任何一個（要求：${required}）` })
  }

  const matching = matchingPatternIndexes(entry, prefs, lookup)
  if (prefs.intent && matching.length === 0) {
    if (entry.x > 0) {
      if (reasons.length === 0) return { state: 'unknown', reasons: [], matchingCount: 0, admissibleCount: 0, experimental: entry.x }
    } else {
      const wanted = prefs.intent.programName ?? prefs.intent.className
      reasons.push({ kind: 'program', label: `沒有開設「${wanted}」（${entry.u} 個本科招生專業（類）裡都沒有）` })
    }
  }
  if (reasons.length > 0) return { state: 'struck', reasons, matchingCount: matching.length, admissibleCount: 0, experimental: entry.x }

  const admissible = chosen ? matching.filter((index) => isAdmissible(lookup.patterns[index], chosen)) : matching
  return { state: 'kept', reasons, matchingCount: matching.length, admissibleCount: admissible.length, experimental: entry.x }
}
