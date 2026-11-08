// 查詢（2026-11-08 批 G7，路線圖目標第 4 條）：純函式、語言中立。
// 查學校：跨大陸普通高校（moe）、中外合作辦學機構（crs）、港澳臺院校池（hkmotw）、GRAS 院校（gras，含海外）；
//   /db/v1 crosswalk 的 same_institution 合併成一條結果；正體、簡體互查（同一套 OpenCC 字級折疊）、英文、別名、舊名。
// 查專業：國標 92 專業類、883 專業與 GRAS 學科名（英文查專業走這條）；列開設的大陸學校與選考要求、海外 GRAS 前 50。
// 結果按「比對程度」再按代碼排序，不是推薦，不暗示錄取可能；不進 AnswerMap、不進 A+ 學習證據。

import type { ProgramIndexEntry, SubjectCode } from '../data/programsTypes'
import { isAdmissible, type ProgramIndexLookup } from './programs'

export type SearchScheme = 'moe' | 'crs' | 'hkmotw' | 'gras'
/** 合併後代表的優先序：大陸普通高校 → 港澳臺院校池 → GRAS → 合作辦學。 */
export const SCHEME_ORDER: readonly SearchScheme[] = ['moe', 'hkmotw', 'gras', 'crs']

export interface SearchRecord {
  id: string
  scheme: SearchScheme
  name: { zhHant?: string | null; zhHans?: string | null; en?: string | null; original?: string | null }
  region: string
  province?: string | null
  siteRoute?: string | null
}
export interface CrosswalkPair { a: string; b: string; relation: string }

/** 簡繁折疊：每兩個字一組（正體、簡體）。英文轉小寫、去掉空白與常見標點，讓「清華大學」「清华」「Tsinghua」都能比。 */
export function makeFold(pairs: string): (text: string) => string {
  const map = new Map<string, string>()
  const cps = [...pairs]
  for (let i = 0; i + 1 < cps.length; i += 2) map.set(cps[i], cps[i + 1])
  return (text: string) => {
    let out = ''
    for (const ch of text.normalize('NFKC').toLowerCase()) {
      if (/[\s·・.,，、'’"“”()（）[\]【】\-—–_/／&＆:：;；]/u.test(ch)) continue
      out += map.get(ch) ?? ch
    }
    return out
  }
}

export type MatchVia = 'name' | 'alias' | 'former'
export interface SchoolKey { text: string; raw: string; via: MatchVia; latin: boolean }
export interface SchoolGroup {
  key: string
  primary: SearchRecord
  members: SearchRecord[]
  /** part_of（合作辦學機構隸屬的中方院校等）：id 列表，展示層用來加「中方院校」鏈接。 */
  partOf: string[]
  keys: SchoolKey[]
}

const isLatin = (text: string) => /^[\p{Script=Latin}\d\s.,'’&()\-/]+$/u.test(text)

/** 建索引：same_institution 合併成一組；名稱（四種寫法）、別名、舊名都折疊成比對鍵。 */
export function buildSchoolIndex(
  records: readonly SearchRecord[],
  crosswalk: readonly CrosswalkPair[],
  extras: { aliases: readonly (readonly [string, string])[]; formerNames: readonly (readonly [string, string])[] },
  fold: (text: string) => string,
): SchoolGroup[] {
  const byId = new Map(records.map((r) => [r.id, r]))
  const parent = new Map<string, string>()
  const find = (id: string): string => { let x = id; while (parent.has(x) && parent.get(x) !== x) x = parent.get(x)!; return x }
  for (const r of records) parent.set(r.id, r.id)
  for (const p of crosswalk) if (p.relation === 'same_institution' && byId.has(p.a) && byId.has(p.b)) parent.set(find(p.a), find(p.b))
  const groups = new Map<string, SearchRecord[]>()
  for (const r of records) { const k = find(r.id); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(r) }
  const aliasesById = new Map<string, string[]>(); for (const [a, id] of extras.aliases) { if (!aliasesById.has(id)) aliasesById.set(id, []); aliasesById.get(id)!.push(a) }
  const formerById = new Map<string, string[]>(); for (const [n, id] of extras.formerNames) { if (!formerById.has(id)) formerById.set(id, []); formerById.get(id)!.push(n) }
  const partOf = new Map<string, string[]>()
  for (const p of crosswalk) if (p.relation === 'part_of') { if (!partOf.has(p.a)) partOf.set(p.a, []); partOf.get(p.a)!.push(p.b) }
  const out: SchoolGroup[] = []
  for (const members of groups.values()) {
    members.sort((x, y) => SCHEME_ORDER.indexOf(x.scheme) - SCHEME_ORDER.indexOf(y.scheme) || x.id.localeCompare(y.id))
    const keys: SchoolKey[] = []
    const push = (raw: string | null | undefined, via: MatchVia) => {
      if (!raw) return
      const text = fold(raw)
      if (text && !keys.some((k) => k.text === text && k.via === via)) keys.push({ text, raw, via, latin: isLatin(raw) })
      // 合作辦學機構原名常寫成「中文名（English）」：拆開各比一次
      const m = /^(.+?)[（(](.+)[）)]$/.exec(raw)
      if (m) { push(m[1], via); push(m[2], via) }
    }
    for (const r of members) {
      push(r.name.zhHant, 'name'); push(r.name.zhHans, 'name'); push(r.name.en, 'name'); push(r.name.original, 'name')
      for (const a of aliasesById.get(r.id) ?? []) push(a, 'alias')
      for (const n of formerById.get(r.id) ?? []) push(n, 'former')
    }
    out.push({ key: members[0].id, primary: members[0], members, partOf: [...new Set(members.flatMap((m) => partOf.get(m.id) ?? []))], keys })
  }
  return out.sort((a, b) => a.key.localeCompare(b.key))
}

/** 英文：查詢的每個詞依序對到名稱裡連續的詞開頭（「university of hong」對到「The University of Hong Kong」）。 */
function wordStartMatch(words: readonly string[], qWords: readonly string[]): boolean {
  for (let i = 0; i < words.length; i += 1) if (qWords.every((qw, j) => (words[i + j] ?? '').startsWith(qw))) return true
  return false
}

export interface SchoolHit { group: SchoolGroup; rank: number; via: MatchVia; matched: string }

/**
 * 比對程度：0 完全相同、1 開頭相同、2 英文某個詞開頭相同、3 包含。只比到查詢至少 1 個漢字或 2 個拉丁字母。
 * 排序：程度 → 代表的層級序 → id（穩定、不是推薦）。
 */
export function searchSchools(groups: readonly SchoolGroup[], query: string, fold: (text: string) => string, limit = 60): { hits: SchoolHit[]; total: number } {
  const q = fold(query)
  if (!q || (!/\p{Script=Han}/u.test(q) && q.length < 2)) return { hits: [], total: 0 }
  const qWords = query.normalize('NFKC').toLowerCase().split(/[\s\-/]+/).filter(Boolean)
  const hits: SchoolHit[] = []
  for (const group of groups) {
    let best: SchoolHit | null = null
    for (const key of group.keys) {
      let rank = -1
      if (key.text === q) rank = 0
      else if (key.text.startsWith(q)) rank = 1
      else if (key.latin && qWords.length && wordStartMatch(key.raw.toLowerCase().split(/[\s\-/]+/), qWords)) rank = 2
      // 拉丁字母查詢少於 4 個字母時不做「包含」（「MIT」不該因 Committee 命中）
      else if (key.text.includes(q) && (/\p{Script=Han}/u.test(q) || q.length >= 4)) rank = 3
      if (rank === -1) continue
      // 別名、舊名只在完全相同或開頭相同時採用（「大工」不該因包含而命中一堆學校）
      if (key.via !== 'name' && rank > 1) continue
      if (!best || rank < best.rank || (rank === best.rank && key.via === 'name' && best.via !== 'name')) best = { group, rank, via: key.via, matched: key.raw }
    }
    if (best) hits.push(best)
  }
  hits.sort((a, b) => a.rank - b.rank || SCHEME_ORDER.indexOf(a.group.primary.scheme) - SCHEME_ORDER.indexOf(b.group.primary.scheme) || a.group.key.localeCompare(b.group.key))
  return { hits: hits.slice(0, limit), total: hits.length }
}

// ---------------- 專業 ----------------

export interface MajorCatalog {
  classes: readonly { code: string; name: string; discipline: string }[]
  programs: readonly { code: string; name: string; class: string }[]
}
export interface GrasSubject { code: string; nameEn: string; nameZh: string; nameZhHans?: string }
export type MajorTarget = { kind: 'class'; classCode: string; name: string } | { kind: 'program'; classCode: string; programCode: string; name: string }
export interface MajorHit { target: MajorTarget; rank: number; via: 'class' | 'program' | 'gras'; matched: string }

/** 查專業：專業類名、專業名（含代碼）、GRAS 學科名（英文查詢走對照表回到專業類）。 */
export function searchMajors(catalog: MajorCatalog, subjects: readonly GrasSubject[], classGras: Readonly<Record<string, readonly string[]>>, query: string, fold: (text: string) => string, limit = 40): MajorHit[] {
  const q = fold(query)
  if (!q || (!/\p{Script=Han}/u.test(q) && !/^\d{4,}/.test(q) && q.length < 2)) return []
  const rankOf = (text: string) => { const t = fold(text); return t === q ? 0 : t.startsWith(q) ? 1 : t.includes(q) ? 3 : -1 }
  const hits = new Map<string, MajorHit>()
  const keep = (key: string, hit: MajorHit) => { const old = hits.get(key); if (!old || hit.rank < old.rank) hits.set(key, hit) }
  for (const c of catalog.classes) {
    const r = Math.min(...[rankOf(c.name), c.code === q ? 0 : -1].filter((x) => x >= 0), 99)
    if (r < 99) keep(`c:${c.code}`, { target: { kind: 'class', classCode: c.code, name: c.name }, rank: r, via: 'class', matched: c.name })
  }
  for (const p of catalog.programs) {
    const r = Math.min(...[rankOf(p.name), p.code.toLowerCase() === q ? 0 : -1].filter((x) => x >= 0), 99)
    if (r < 99) keep(`p:${p.code}`, { target: { kind: 'program', classCode: p.class, programCode: p.code, name: p.name }, rank: r, via: 'program', matched: p.name })
  }
  for (const s of subjects) {
    const r = Math.min(...[s.nameEn, s.nameZh, s.nameZhHans ?? ''].filter(Boolean).map(rankOf).filter((x) => x >= 0), 99)
    if (r === 99) continue
    for (const [classCode, codes] of Object.entries(classGras)) {
      if (!codes.includes(s.code)) continue
      const klass = catalog.classes.find((c) => c.code === classCode)
      if (klass) keep(`c:${classCode}`, { target: { kind: 'class', classCode, name: klass.name }, rank: r + 0.5, via: 'gras', matched: s.nameEn })
    }
  }
  return [...hits.values()].sort((a, b) => a.rank - b.rank || (a.target.kind === b.target.kind ? 0 : a.target.kind === 'class' ? -1 : 1) || (a.target.kind === 'program' ? a.target.programCode : a.target.classCode).localeCompare(b.target.kind === 'program' ? b.target.programCode : b.target.classCode)).slice(0, limit)
}

/** 某校在某專業（類）的選考要求圖樣下標：專業類＝該類全部；具體專業＝同代碼，或該校按整個專業類招生（大類招生涵蓋它）。 */
export function majorPatternIndexes(entry: ProgramIndexEntry, target: MajorTarget, lookup: ProgramIndexLookup): number[] {
  const inClass = entry.c[target.classCode] ?? []
  if (target.kind === 'class') return inClass
  const codeIndex = lookup.catalogCodes.indexOf(target.programCode)
  const exact = (entry.k ?? []).filter(([index]) => index === codeIndex).map(([, pattern]) => pattern)
  return entry.g?.includes(target.classCode) ? [...exact, ...inClass] : exact
}

export interface MajorSchoolRow {
  moeCode: string
  /** [選考要求圖樣, 該校在此專業（類）的招生專業數]，多的在前。 */
  patterns: [string, number][]
  /** 選了組合時：至少一個可報；沒選：null。 */
  admissible: boolean | null
  /** 該校出現的省表代碼（HB|JS|…）。 */
  provinces: string[]
}

/** 開設某專業（類）的大陸學校；可按學校所在省份、選考組合過濾（只留至少一個可報的）。按學校代碼排序（不是推薦）。 */
export function schoolsForMajor(
  schools: Readonly<Record<string, ProgramIndexEntry>>,
  lookup: ProgramIndexLookup,
  target: MajorTarget,
  opts: { provinceOf?: (moeCode: string) => string | null | undefined; province?: string | null; combo?: ReadonlySet<SubjectCode> | null } = {},
): { rows: MajorSchoolRow[]; offering: number } {
  const rows: MajorSchoolRow[] = []
  let offering = 0
  for (const [moeCode, entry] of Object.entries(schools)) {
    const indexes = majorPatternIndexes(entry, target, lookup)
    if (!indexes.length) continue
    if (opts.province && opts.provinceOf?.(moeCode) !== opts.province) continue
    offering += 1
    const counts = new Map<string, number>()
    for (const i of indexes) { const p = lookup.patterns[i] ?? 'none'; counts.set(p, (counts.get(p) ?? 0) + 1) }
    const admissible = opts.combo ? indexes.some((i) => isAdmissible(lookup.patterns[i], opts.combo!)) : null
    if (opts.combo && !admissible) continue
    rows.push({ moeCode, patterns: [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])), admissible, provinces: entry.p ? entry.p.split('|') : [] })
  }
  rows.sort((a, b) => a.moeCode.localeCompare(b.moeCode))
  return { rows, offering }
}

export interface AtlasRanked { id: string; region: string; ranks: Readonly<Record<string, number>> }

/** 海外（非中國大陸）在對應 GRAS 學科有前 50 席位的機構：按地區、id 排序；名次只作事實顯示。 */
export function grasTop50ForClass(classCode: string, classGras: Readonly<Record<string, readonly string[]>>, institutions: readonly AtlasRanked[]): { subjects: string[]; rows: { id: string; region: string; ranks: [string, number][] }[] } {
  const subjects = [...(classGras[classCode] ?? [])]
  const rows = institutions
    .filter((i) => i.region !== 'China')
    .map((i) => ({ id: i.id, region: i.region, ranks: subjects.filter((s) => i.ranks[s] !== undefined && i.ranks[s] <= 50).map((s) => [s, i.ranks[s]] as [string, number]) }))
    .filter((r) => r.ranks.length)
    .sort((a, b) => a.region.localeCompare(b.region) || a.id.localeCompare(b.id))
  return { subjects, rows }
}

// ---------------- 結果頁彙總 ----------------

export interface ClassSummaryRow { classCode: string; schools: string[]; admissible: string[] | null }

/** 大陸結果頁「剩下學校的專業」：按專業類彙總剩下學校中開設該類的學校與「你的選科可報」的學校（目錄序）。只是彙總，不改剩餘集合。 */
export function summarizeClasses(moeCodes: readonly string[], schools: Readonly<Record<string, ProgramIndexEntry>>, lookup: ProgramIndexLookup, classOrder: readonly string[], combo: ReadonlySet<SubjectCode> | null): ClassSummaryRow[] {
  const by = new Map<string, ClassSummaryRow>()
  for (const code of moeCodes) {
    const entry = schools[code]
    if (!entry || entry.u === 0) continue
    for (const [classCode, indexes] of Object.entries(entry.c)) {
      if (!indexes.length) continue
      if (!by.has(classCode)) by.set(classCode, { classCode, schools: [], admissible: combo ? [] : null })
      const row = by.get(classCode)!
      row.schools.push(code)
      if (combo && indexes.some((i) => isAdmissible(lookup.patterns[i], combo))) row.admissible!.push(code)
    }
  }
  return classOrder.filter((c) => by.has(c)).map((c) => by.get(c)!)
}

/** `#/global` 結果頁：按 GRAS 學科彙總剩下機構（GRAS 學科序）。 */
export function summarizeGrasSubjects<T extends { key: string; subjects: readonly string[] | null }>(items: readonly T[], subjectOrder: readonly string[]): { code: string; items: T[] }[] {
  const by = new Map<string, T[]>()
  for (const item of items) for (const s of item.subjects ?? []) { if (!by.has(s)) by.set(s, []); by.get(s)!.push(item) }
  return subjectOrder.filter((s) => by.has(s)).map((code) => ({ code, items: by.get(code)! }))
}
