// S1 專業／選考科目資料層：payload 完整性與起點條件引擎。build 之前 data:programs 必須先生成 payload。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { programsManifest } from '../src/data/programsManifest.ts'
import type { ProgramCatalogPayload, ProgramOfferingsPayload, SubjectCode } from '../src/data/programsTypes.ts'
import type { School } from '../src/data/schools.ts'
import { applyProgramPrefs, evaluateSchoolPrograms, indexSchoolPrograms, isAdmissible } from '../src/engine/programs.ts'
import { emptyProgramPrefs, normalizeSubjects, programPrefsActive, requirementLabel } from '../src/data/programPrefs.ts'

const catalog = JSON.parse(readFileSync(new URL('../public/data/programs/catalog.json', import.meta.url), 'utf8')) as ProgramCatalogPayload
const offerings = JSON.parse(readFileSync(new URL('../public/data/programs/offerings.json', import.meta.url), 'utf8')) as ProgramOfferingsPayload
const schools = JSON.parse(readFileSync(new URL('../public/data/runtime/schools.json', import.meta.url), 'utf8')) as School[]
const schoolByCode = new Map(schools.map((school) => [school.moeCode, school]))
const byName = (name: string) => schools.find((school) => (school.nameSimplified ?? school.name) === name)!

test('manifest 與兩個 payload 一致（版本、各類數量）', () => {
  assert.equal(catalog.version, programsManifest.version)
  assert.equal(offerings.version, programsManifest.version)
  assert.equal(catalog.disciplines.length, programsManifest.counts.disciplines)
  assert.equal(catalog.classes.length, programsManifest.counts.classes)
  assert.equal(catalog.programs.length, programsManifest.counts.catalogPrograms)
  assert.equal(offerings.schools.length, programsManifest.counts.schools)
  assert.equal(offerings.schools.reduce((n, s) => n + s.programs.length, 0), programsManifest.counts.offerings)
  assert.equal(offerings.strongBase.length, programsManifest.counts.strongBase)
  assert.equal(Object.keys(offerings.sources).length, programsManifest.counts.sources)
})

test('教育部本科專業目錄 2026：13 門類／92 專業類／883 專業，代碼與歸屬齊全', () => {
  assert.equal(catalog.disciplines.length, 13)
  assert.equal(catalog.classes.length, 92)
  assert.equal(catalog.programs.length, 883)
  const disciplineCodes = new Set(catalog.disciplines.map((d) => d.code))
  const classCodes = new Set(catalog.classes.map((c) => c.code))
  for (const klass of catalog.classes) assert.ok(disciplineCodes.has(klass.discipline), klass.code)
  for (const program of catalog.programs) {
    assert.match(program.code, /^\d{6,7}[TK]{0,2}$/, program.name)
    assert.ok(program.name.length > 0)
    assert.ok(disciplineCodes.has(program.discipline), program.code)
    // 2026 年新增「交叉學科」門類下的專業直接掛門類，沒有專業類
    if (program.discipline !== '14') assert.ok(classCodes.has(program.class), `${program.code} class ${program.class}`)
  }
  assert.equal(new Set(catalog.programs.map((p) => p.code)).size, 883)
  assert.match(catalog.source.url, /^https?:\/\/www\.moe\.gov\.cn\//)
})

test('144 所雙一流都在教育部主表裡，每條專業都有合法的選考圖樣與來源省表', () => {
  assert.equal(offerings.schools.length, 144)
  const classCodes = new Set(catalog.classes.map((c) => c.code))
  const programCodes = new Set(catalog.programs.map((p) => p.code))
  const provinceTags = new Set(Object.keys(offerings.provinceSources))
  for (const entry of offerings.schools) {
    const school = schoolByCode.get(entry.moeCode)
    assert.ok(school, `${entry.moeCode} 不在 schools.json`)
    assert.ok(entry.programs.length >= 3, `${school?.name} programs`)
    assert.ok(entry.provinces.length >= 3 && entry.provinces.every((tag) => provinceTags.has(tag)), `${school?.name} provinces`)
    for (const program of entry.programs) {
      assert.match(program.r, /^(none|[PCBZHG]{1,3})$/, `${school?.name} ${program.n} ${program.r}`)
      assert.ok(program.n.length > 0)
      if (program.cl) assert.ok(classCodes.has(program.cl), `${school?.name} ${program.n} class ${program.cl}`)
      if (program.m === 'code' || program.m === 'name' || program.m === 'name_base') assert.ok(programCodes.has(program.k), `${school?.name} ${program.n} code ${program.k}`)
      if (program.m === 'class') assert.equal(program.k, '')
      assert.ok(program.p.split('|').every((tag) => provinceTags.has(tag)))
    }
  }
  for (const [tag, item] of Object.entries(offerings.provinceSources)) {
    assert.ok(offerings.sources[item.sourceId], `${tag} source`)
    assert.match(offerings.sources[item.sourceId].url, /^https?:\/\//)
    assert.match(offerings.sources[item.sourceId].date, /^\d{4}-\d{2}-\d{2}$/)
  }
  for (const row of offerings.strongBase) {
    assert.ok(schoolByCode.has(row.moeCode), `強基 ${row.moeCode}`)
    assert.ok(offerings.sources[row.sourceId], `強基來源 ${row.sourceId}`)
  }
  assert.equal(offerings.strongBase.length, 38)
})

test('選考圖樣判定：要求的每一科都要在選科裡；不提科目要求恆可報', () => {
  const chosen = new Set<SubjectCode>(['P', 'B', 'Z'])
  assert.equal(isAdmissible('none', chosen), true)
  assert.equal(isAdmissible('P', chosen), true)
  assert.equal(isAdmissible('PB', chosen), true)
  assert.equal(isAdmissible('PC', chosen), false)
  assert.equal(isAdmissible('H', chosen), false)
  assert.equal(requirementLabel('PC'), '物理＋化學')
  assert.equal(requirementLabel('none'), '不提科目要求')
  assert.deepEqual(normalizeSubjects(['Z', 'P', 'P', 'X', 'C']), ['P', 'C', 'Z'])
  assert.equal(programPrefsActive(emptyProgramPrefs), false)
  assert.equal(programPrefsActive({ subjects: ['P', 'C'], intent: null }), false)
  assert.equal(programPrefsActive({ subjects: ['P', 'C', 'B'], intent: null }), true)
})

test('疑罪從無：沒有資料的學校不判定；未設條件時全部保留', () => {
  const index = indexSchoolPrograms(offerings)
  assert.equal(evaluateSchoolPrograms(undefined, { subjects: ['P', 'B', 'Z'], intent: null }).state, 'no-data')
  const pku = index.get(byName('北京大学').moeCode!)
  assert.equal(evaluateSchoolPrograms(pku, emptyProgramPrefs).state, 'kept')
  const outcome = applyProgramPrefs(schools, offerings, emptyProgramPrefs)
  assert.equal(outcome.kept.length, schools.length)
  assert.equal(outcome.struck.length, 0)
})

test('選科組合：全部專業都要物＋化的學校在物生政下被劃掉；北大在物化生下保留', () => {
  const index = indexSchoolPrograms(offerings)
  const ustc = evaluateSchoolPrograms(index.get(byName('中国科学技术大学').moeCode!), { subjects: ['P', 'B', 'Z'], intent: null })
  assert.equal(ustc.state, 'struck')
  assert.equal(ustc.reasons[0]?.kind, 'subjects')
  const pku = evaluateSchoolPrograms(index.get(byName('北京大学').moeCode!), { subjects: ['P', 'C', 'B'], intent: null })
  assert.equal(pku.state, 'kept')
  assert.ok(pku.admissible.length > 0 && pku.admissible.length <= pku.matching.length)
})

test('意向專業：沒開的學校被劃掉；按專業類招生視為涵蓋；只有試驗班對不到時不判定', () => {
  const index = indexSchoolPrograms(offerings)
  const cs = catalog.classes.find((c) => c.name === '计算机类')!
  const csProgram = catalog.programs.find((p) => p.name === '计算机科学与技术')!
  const music = evaluateSchoolPrograms(index.get(byName('中央音乐学院').moeCode!), { subjects: [], intent: { classCode: cs.code, className: cs.name } })
  assert.equal(music.state, 'struck')
  assert.equal(music.reasons[0]?.kind, 'program')
  const pku = evaluateSchoolPrograms(index.get(byName('北京大学').moeCode!), { subjects: [], intent: { classCode: cs.code, className: cs.name, programCode: csProgram.code, programName: csProgram.name } })
  assert.equal(pku.state, 'kept', '北大按計算機類招生，涵蓋計算機科學與技術')
  // 找一所有試驗班、但沒有某專業類的學校：結論必須是 unknown，不是 struck
  const rareClass = catalog.classes.find((c) => c.name === '水利类')!
  const withExperimental = offerings.schools.find((entry) => entry.programs.some((p) => p.m === 'none') && !entry.programs.some((p) => p.cl === rareClass.code))!
  const verdict = evaluateSchoolPrograms(withExperimental, { subjects: [], intent: { classCode: rareClass.code, className: rareClass.name } })
  assert.equal(verdict.state, 'unknown')
  assert.ok(verdict.experimental > 0)
})

test('起點條件層與 43 題分開計：保留＋劃掉＝輸入，無資料與不判定都在保留裡', () => {
  const dfc = offerings.schools.map((entry) => schoolByCode.get(entry.moeCode)!)
  const others = schools.filter((school) => !offerings.schools.some((entry) => entry.moeCode === school.moeCode)).slice(0, 50)
  const input = [...dfc, ...others]
  const outcome = applyProgramPrefs(input, offerings, { subjects: ['P', 'B', 'Z'], intent: null })
  assert.equal(outcome.kept.length + outcome.struck.length, input.length)
  assert.equal(outcome.stats.noData, others.length)
  assert.equal(outcome.stats.evaluated, dfc.length)
  assert.equal(outcome.stats.struckBySubjects, outcome.struck.length)
  assert.equal(outcome.stats.struckByProgram, 0)
  assert.ok(outcome.struck.some(({ school }) => (school.nameSimplified ?? school.name) === '中国科学技术大学'))
  for (const { school } of outcome.struck) assert.ok(offerings.schools.some((entry) => entry.moeCode === school.moeCode), `${school.name} 沒資料卻被劃掉`)
})
