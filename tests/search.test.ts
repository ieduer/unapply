// 查詢（批 G7）閘門：簡繁互查、別名與舊名、跨層去重、專業 → 學校與選考要求一致、GRAS 對照表完整、
// 結果排序穩定（不是推薦）、結果頁彙總與剩下的一致、引擎語言中立、三語鍵齊、入口與路由。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  SCHEME_ORDER, buildSchoolIndex, grasTop50ForClass, majorPatternIndexes, makeFold, schoolsForMajor, searchMajors, searchSchools,
  summarizeClasses, summarizeGrasSubjects, type CrosswalkPair, type SearchRecord,
} from '../src/engine/search.ts'
import { isAdmissible } from '../src/engine/programs.ts'
import { searchLayer } from '../src/data/searchLayer.ts'
import type { ProgramIndexPayload, SubjectCode } from '../src/data/programsTypes.ts'
// @ts-expect-error 建置期 .mjs 模組沒有型別宣告
import { t2s } from '../scripts/lib/t2s.mjs'

const root = new URL('..', import.meta.url).pathname
const read = (p: string) => readFileSync(`${root}/${p}`, 'utf8')
const latest = JSON.parse(read('public/db/v1/latest.json')) as { base: string }
const dbBase = latest.base.replace(/^\//, 'public/')
const records = (JSON.parse(read(`${dbBase}institutions.json`)) as { records: SearchRecord[] }).records
const pairs = (JSON.parse(read(`${dbBase}crosswalk.json`)) as { pairs: CrosswalkPair[] }).pairs
const catalog = JSON.parse(read('public/data/programs/catalog.json')) as { classes: { code: string; name: string; discipline: string }[]; programs: { code: string; name: string; class: string }[] }
const pindex = JSON.parse(read('public/data/programs/index.json')) as ProgramIndexPayload
const atlas = JSON.parse(read('public/data/atlas/world-atlas.json')) as { subjects: { code: string; nameEn: string; nameZh: string; nameZhHans: string }[]; institutions: { id: string; region: string; ranks: Record<string, number> }[] }
const fold = makeFold(searchLayer.foldPairs)
const groups = buildSchoolIndex(records, pairs, searchLayer, fold)
const groupOf = (q: string) => searchSchools(groups, q, fold, 5).hits.map((h) => h.group.members.map((m) => m.id).sort().join('+'))

test('簡繁互查與英文：「清华」「清華」「清華大學」「Tsinghua」第一筆都是同一校（大陸名單＋GRAS 合併為一條）', () => {
  const expected = 'gras:RC00001+moe:4111010003'
  for (const q of ['清华', '清華', '清華大學', '清华大学', 'Tsinghua', 'tsinghua university']) assert.equal(groupOf(q)[0], expected, q)
  // 折疊與 data:i18n 同一套 t2s：正體校名折疊後等於它的簡體字形折疊
  for (const r of records.filter((x) => x.name.zhHant && /\p{Script=Han}/u.test(x.name.zhHant)).slice(0, 600)) assert.equal(fold(r.name.zhHant!), fold(t2s(r.name.zhHant!)), r.id)
})

test('別名（站方整理）與舊名（教育部名單比對）：唯一對到一校，且只在完全或開頭相同時採用', () => {
  assert.equal(groupOf('北大')[0], 'gras:RC00002+moe:4111010001')
  assert.equal(groupOf('PKU')[0], 'gras:RC00002+moe:4111010001')
  assert.match(groupOf('HKU')[0], /hkmotw:hk-hku/)
  assert.match(groupOf('港大')[0], /hkmotw:hk-hku/)
  assert.equal(groupOf('华北科技学院')[0], 'moe:4113011104')
  assert.equal(searchSchools(groups, '华北科技学院', fold).hits[0].via, 'former')
  assert.equal(searchLayer.aliases.length, new Set(searchLayer.aliases.map(([a]) => a.toLowerCase())).size)
  for (const [, id] of searchLayer.aliases) assert.ok(records.some((r) => r.id === id), id)
  for (const [, id] of searchLayer.formerNames) assert.ok(records.some((r) => r.id === id), id)
  // 短拉丁查詢不做「包含」：MIT 只命中別名本身
  assert.deepEqual(groupOf('MIT'), ['gras:RI02779'])
})

test('跨層去重：同一機構（same_institution）只出一條；每筆記錄恰在一組；合作辦學機構帶中方院校', () => {
  const seen = new Map<string, string>()
  for (const g of groups) for (const m of g.members) { assert.equal(seen.has(m.id), false, m.id); seen.set(m.id, g.key) }
  assert.equal(seen.size, records.length)
  for (const p of pairs.filter((x) => x.relation === 'same_institution')) assert.equal(seen.get(p.a), seen.get(p.b), `${p.a} ${p.b}`)
  assert.equal(groupOf('昆山杜克')[0], 'crs:1004+moe:4132016406')
  for (const g of groups) assert.equal(g.primary.scheme, [...g.members].sort((a, b) => SCHEME_ORDER.indexOf(a.scheme) - SCHEME_ORDER.indexOf(b.scheme))[0].scheme)
  const partOf = groups.find((g) => g.members.every((m) => m.scheme === 'crs') && g.partOf.length)
  assert.ok(partOf && partOf.partOf.every((id) => id.startsWith('moe:')))
})

test('排序穩定、不是推薦：比對程度 → 層級序 → id；同一查詢兩次結果相同', () => {
  const a = searchSchools(groups, '師範大學', fold, 200).hits
  const b = searchSchools(groups, '师范大学', fold, 200).hits
  assert.deepEqual(a.map((h) => h.group.key), b.map((h) => h.group.key))
  for (let i = 1; i < a.length; i += 1) {
    const [x, y] = [a[i - 1], a[i]]
    assert.ok(x.rank < y.rank || (x.rank === y.rank && (SCHEME_ORDER.indexOf(x.group.primary.scheme) < SCHEME_ORDER.indexOf(y.group.primary.scheme) || (x.group.primary.scheme === y.group.primary.scheme && x.group.key < y.group.key))))
  }
})

test('查專業：計算機類／Computer Science 都到 0809；學校清單與選考要求和專業層索引逐校一致；選科過濾與 isAdmissible 一致', () => {
  const hits = searchMajors(catalog, atlas.subjects, searchLayer.classGras, '計算機類', fold)
  assert.deepEqual(hits[0].target, { kind: 'class', classCode: '0809', name: '计算机类' })
  assert.equal(searchMajors(catalog, atlas.subjects, searchLayer.classGras, 'Computer Science', fold)[0].target.classCode, '0809')
  assert.equal(searchMajors(catalog, atlas.subjects, searchLayer.classGras, '080901', fold)[0].target.kind, 'program')
  const target = hits[0].target
  const all = schoolsForMajor(pindex.schools, pindex, target)
  const expected = Object.entries(pindex.schools).filter(([, e]) => (e.c['0809'] ?? []).length)
  assert.equal(all.rows.length, expected.length)
  assert.equal(all.offering, expected.length)
  for (const row of all.rows.slice(0, 200)) {
    const idx = pindex.schools[row.moeCode].c['0809']
    assert.equal(row.patterns.reduce((s, [, n]) => s + n, 0), idx.length, row.moeCode)
    for (const [p, n] of row.patterns) assert.equal(idx.filter((i) => pindex.patterns[i] === p).length, n)
  }
  const combo = new Set(['H', 'Z', 'G'] as SubjectCode[])
  const filtered = schoolsForMajor(pindex.schools, pindex, target, { combo })
  for (const row of filtered.rows) assert.ok(majorPatternIndexes(pindex.schools[row.moeCode], target, pindex).some((i) => isAdmissible(pindex.patterns[i], combo)))
  assert.equal(filtered.rows.length, expected.filter(([, e]) => e.c['0809'].some((i) => isAdmissible(pindex.patterns[i], combo))).length)
})

test('GRAS 對照表完整：92 類一類一列、代碼都在 GRAS 2026、沒對照的寫明原因；海外前 50 只列非大陸且名次 ≤50', () => {
  assert.deepEqual(Object.keys(searchLayer.classGras).sort(), catalog.classes.map((c) => c.code).sort())
  const codes = new Set(atlas.subjects.map((s) => s.code))
  for (const [klass, list] of Object.entries(searchLayer.classGras)) {
    for (const c of list) assert.ok(codes.has(c), `${klass} ${c}`)
    if (!list.length) assert.ok((searchLayer.classGrasNote as Record<string, string>)[klass], klass)
  }
  const top = grasTop50ForClass('0809', searchLayer.classGras, atlas.institutions)
  assert.deepEqual(top.subjects, ['AS0210'])
  assert.ok(top.rows.length > 20)
  for (const r of top.rows) { assert.notEqual(r.region, 'China'); for (const [, rank] of r.ranks) assert.ok(rank <= 50) }
  assert.equal(grasTop50ForClass('0101', searchLayer.classGras, atlas.institutions).rows.length, 0)
})

test('結果頁彙總只是彙總：每類校數等於開設該類的剩下學校、可報數不超過校數；GRAS 彙總只數有席位者', () => {
  const kept = Object.keys(pindex.schools).slice(0, 400)
  const rows = summarizeClasses(kept, pindex.schools, pindex, catalog.classes.map((c) => c.code), new Set(['P', 'C', 'B'] as SubjectCode[]))
  for (const row of rows) {
    assert.deepEqual(row.schools, kept.filter((k) => (pindex.schools[k].c[row.classCode] ?? []).length && pindex.schools[k].u > 0))
    assert.ok(row.admissible!.length <= row.schools.length)
  }
  assert.ok(summarizeClasses(kept, pindex.schools, pindex, catalog.classes.map((c) => c.code), null).every((r) => r.admissible === null))
  const items = [{ key: 'a', subjects: ['AS0101', 'AS0210'] }, { key: 'b', subjects: null }, { key: 'c', subjects: ['AS0210'] }]
  assert.deepEqual(summarizeGrasSubjects(items, ['AS0101', 'AS0210']).map((r) => [r.code, r.items.map((i) => i.key)]), [['AS0101', ['a']], ['AS0210', ['a', 'c']]])
})

test('引擎語言中立、不碰 AnswerMap／學習證據；三語鍵齊；首頁「只瀏覽」有查詢入口、路由 #/search', () => {
  for (const f of ['src/engine/search.ts', 'src/engine/directHire.ts']) {
    const src = read(f).replace(/^\s*\/\/.*$/gm, '')
    assert.equal(/from '\.\.\/(i18n|lib\/(bdfzIdentity|trustedAPlus|learningEvidence))|AnswerMap|DimensionId/.test(src), false, f)
  }
  const zhHant = JSON.parse(read('src/i18n/locales/zh-Hant.json')) as Record<string, string>
  const en = JSON.parse(read('src/i18n/locales/en.json')) as Record<string, string>
  const zhHans = JSON.parse(read('public/i18n/zh-Hans.json')) as Record<string, string>
  const keys = Object.keys(zhHant).filter((k) => /^ui\.(search|majors|paths)\./.test(k) || k === 'ui.landing.tile.search.title' || k === 'ui.header.search' || k.startsWith('ui.global.q.directHire'))
  assert.ok(keys.length >= 70)
  for (const k of keys) for (const d of [en, zhHans]) assert.ok(d[k]?.trim(), k)
  for (const scheme of SCHEME_ORDER) assert.ok(zhHant[`ui.search.layer.${scheme}`] && en[`ui.search.layer.${scheme}`], scheme)
  assert.match(read('src/components/Landing.tsx'), /data-landing-search/)
  assert.match(read('src/App.tsx'), /if \(head === 'search'\) return \{ name: 'search' \}/)
  // 不暗示錄取可能：查詢說明寫明（「不代表錄取可能」全站只准出現在 About 與結果頁，test:db 管）
  assert.match(zhHant['ui.search.lede'], /不是推薦.*錄取/)
  assert.match(en['ui.search.lede'], /not recommended.*admission/)
})
