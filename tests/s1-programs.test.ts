// S1 專業／選考科目資料層：payload 完整性與起點條件引擎。build 之前 data:programs 必須先生成 payload。
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { programsManifest } from '../src/data/programsManifest.ts'
import type { ProgramBucket, ProgramCatalogPayload, ProgramIndexPayload, SubjectCode } from '../src/data/programsTypes.ts'
import type { School } from '../src/data/schools.ts'
import { applyProgramPrefs, countAdmissible, evaluateSchoolPrograms, isAdmissible } from '../src/engine/programs.ts'
import { emptyProgramPrefs, normalizeSubjects, programPrefsActive, requirementLabel } from '../src/data/programPrefs.ts'

const catalog = JSON.parse(readFileSync(new URL('../public/data/programs/catalog.json', import.meta.url), 'utf8')) as ProgramCatalogPayload
const index = JSON.parse(readFileSync(new URL('../public/data/programs/index.json', import.meta.url), 'utf8')) as ProgramIndexPayload
const bucketDir = new URL('../public/data/programs/schools/', import.meta.url)
const buckets = readdirSync(bucketDir).filter((f) => f.endsWith('.json')).map((f) => [f, JSON.parse(readFileSync(new URL(f, bucketDir), 'utf8')) as ProgramBucket] as const)
const schools = JSON.parse(readFileSync(new URL('../public/data/runtime/schools.json', import.meta.url), 'utf8')) as School[]
const schoolByCode = new Map(schools.map((school) => [school.moeCode, school]))
const byName = (name: string) => schools.find((school) => (school.nameSimplified ?? school.name) === name)!
const entryOf = (name: string) => index.schools[byName(name).moeCode!]

test('manifest 與 payload 一致（版本、各類數量、分桶）', () => {
  assert.equal(catalog.version, programsManifest.version)
  assert.equal(index.version, programsManifest.version)
  assert.equal(catalog.disciplines.length, programsManifest.counts.disciplines)
  assert.equal(catalog.classes.length, programsManifest.counts.classes)
  assert.equal(catalog.programs.length, programsManifest.counts.catalogPrograms)
  assert.equal(index.catalogCodes.length, programsManifest.counts.catalogPrograms)
  assert.deepEqual(index.catalogCodes, catalog.programs.map((p) => p.code))
  assert.equal(index.patterns.length, programsManifest.counts.patterns)
  const entries = Object.values(index.schools)
  assert.equal(entries.length, programsManifest.counts.schools)
  assert.equal(entries.filter((s) => s.u > 0).length, programsManifest.counts.undergraduateSchools)
  assert.equal(entries.reduce((n, s) => n + s.u, 0), programsManifest.counts.undergraduateOfferings)
  assert.equal(entries.reduce((n, s) => n + s.v, 0), programsManifest.counts.vocationalOfferings)
  assert.equal(index.strongBase.length, programsManifest.counts.strongBase)
  assert.equal(Object.keys(index.sources).length, programsManifest.counts.sources)
  assert.equal(buckets.length, programsManifest.counts.buckets)
  assert.equal(new Set(Object.values(programsManifest.bucketFileByProvince)).size, 31)
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
    if (program.discipline !== '14') assert.ok(classCodes.has(program.class), `${program.code} class ${program.class}`)
  }
  assert.equal(new Set(catalog.programs.map((p) => p.code)).size, 883)
  assert.match(catalog.source.url, /^https?:\/\/www\.moe\.gov\.cn\//)
})

test('每校摘要：全在教育部主表，圖樣／專業類／專業下標合法，雙一流 144 校都有本科清單', () => {
  const classCodes = new Set(catalog.classes.map((c) => c.code))
  const provinceTags = new Set(Object.keys(index.provinceSources))
  for (const pattern of index.patterns) assert.match(pattern, /^(none|[PCBZHG]{1,3})$/)
  for (const [moeCode, entry] of Object.entries(index.schools)) {
    const school = schoolByCode.get(moeCode)
    assert.ok(school, `${moeCode} 不在 schools.json`)
    assert.ok(entry.u + entry.v > 0, school?.name)
    assert.ok(entry.p.split('|').every((tag) => provinceTags.has(tag)), `${school?.name} provinces ${entry.p}`)
    let inClasses = 0
    for (const [classCode, patterns] of Object.entries(entry.c)) {
      assert.ok(classCodes.has(classCode), `${school?.name} class ${classCode}`)
      for (const i of patterns) assert.ok(i >= 0 && i < index.patterns.length)
      inClasses += patterns.length
    }
    assert.equal(inClasses + (entry.e?.length ?? 0), entry.u, `${school?.name} 本科數＝各類＋試驗班`)
    assert.equal(entry.e?.length ?? 0, entry.x, `${school?.name} 試驗班數`)
    for (const g of entry.g ?? []) assert.ok(entry.c[g], `${school?.name} 大類招生 ${g} 要有圖樣`)
    for (const [codeIndex, pattern] of entry.k ?? []) { assert.ok(codeIndex >= 0 && codeIndex < index.catalogCodes.length); assert.ok(pattern >= 0 && pattern < index.patterns.length) }
  }
  const dfc = schools.filter((s) => ['C9', '985非C9', '211非985', '雙一流非211'].includes(s.level ?? ''))
  assert.equal(dfc.length, 144)
  for (const school of dfc) assert.ok((index.schools[school.moeCode!]?.u ?? 0) > 0, `${school.name} 應有本科清單`)
  for (const [tag, item] of Object.entries(index.provinceSources)) {
    assert.ok(index.sources[item.sourceId], `${tag} source`)
    assert.match(index.sources[item.sourceId].url, /^https?:\/\//)
    assert.match(index.sources[item.sourceId].date, /^\d{4}-\d{2}-\d{2}$/)
  }
  for (const row of index.strongBase) { assert.ok(schoolByCode.has(row.moeCode), `強基 ${row.moeCode}`); assert.ok(index.sources[row.sourceId]) }
  assert.equal(index.strongBase.length, 38)
})

test('分桶清單：每校在對的省桶裡，條數與摘要一致，專科條目不對本科目錄', () => {
  const seen = new Map<string, number>()
  const codeToFile = new Map<string, string>()
  for (const [file, bucket] of buckets) {
    for (const [moeCode, programs] of Object.entries(bucket)) {
      const school = schoolByCode.get(moeCode)
      assert.ok(school, `${file} ${moeCode}`)
      assert.equal((programsManifest.bucketFileByProvince as Record<string, string>)[school!.province], file, `${school!.name} 省桶`)
      codeToFile.set(moeCode, file)
      const entry = index.schools[moeCode]
      assert.ok(entry, `${school!.name} 摘要`)
      assert.equal(programs.filter((p) => p.l === 'u').length, entry.u)
      assert.equal(programs.filter((p) => p.l === 'v').length, entry.v)
      for (const program of programs) {
        assert.match(program.r, /^(none|[PCBZHG]{1,3})$/)
        if (program.l === 'v') assert.equal(program.m, 'vocational')
        else assert.notEqual(program.m, 'vocational')
      }
      seen.set(moeCode, programs.length)
    }
  }
  assert.equal(seen.size, programsManifest.counts.schools)
  assert.equal([...seen.values()].reduce((a, b) => a + b, 0), programsManifest.counts.undergraduateOfferings + programsManifest.counts.vocationalOfferings)
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

test('疑罪從無：沒有本科資料的學校（含只有專科的）不判定；未設條件時全部保留', () => {
  assert.equal(evaluateSchoolPrograms(undefined, { subjects: ['P', 'B', 'Z'], intent: null }, index).state, 'no-data')
  const vocationalOnly = Object.entries(index.schools).find(([, s]) => s.u === 0 && s.v > 0)!
  assert.equal(evaluateSchoolPrograms(vocationalOnly[1], { subjects: ['P', 'B', 'Z'], intent: null }, index).state, 'no-data')
  assert.equal(evaluateSchoolPrograms(entryOf('北京大学'), emptyProgramPrefs, index).state, 'kept')
  const outcome = applyProgramPrefs(schools, index, emptyProgramPrefs)
  assert.equal(outcome.kept.length, schools.length)
  assert.equal(outcome.struck.length, 0)
})

test('選科組合：全部專業都要物＋化的學校在物生政下被劃掉；北大在物化生下保留', () => {
  const ustc = evaluateSchoolPrograms(entryOf('中国科学技术大学'), { subjects: ['P', 'B', 'Z'], intent: null }, index)
  assert.equal(ustc.state, 'struck')
  assert.equal(ustc.reasons[0]?.kind, 'subjects')
  const pku = evaluateSchoolPrograms(entryOf('北京大学'), { subjects: ['P', 'C', 'B'], intent: null }, index)
  assert.equal(pku.state, 'kept')
  assert.ok(pku.admissibleCount > 0 && pku.admissibleCount <= pku.matchingCount)
  assert.equal(countAdmissible(entryOf('北京大学'), new Set(['P', 'C', 'B']), index), pku.admissibleCount)
})

test('意向專業：沒開的學校被劃掉；按專業類招生視為涵蓋；只有試驗班對不到時不判定', () => {
  const cs = catalog.classes.find((c) => c.name === '计算机类')!
  const csProgram = catalog.programs.find((p) => p.name === '计算机科学与技术')!
  const music = evaluateSchoolPrograms(entryOf('中央音乐学院'), { subjects: [], intent: { classCode: cs.code, className: cs.name } }, index)
  assert.equal(music.state, 'struck')
  assert.equal(music.reasons[0]?.kind, 'program')
  const pku = evaluateSchoolPrograms(entryOf('北京大学'), { subjects: [], intent: { classCode: cs.code, className: cs.name, programCode: csProgram.code, programName: csProgram.name } }, index)
  assert.equal(pku.state, 'kept', '北大按計算機類招生，涵蓋計算機科學與技術')
  const rareClass = catalog.classes.find((c) => c.name === '水利类')!
  const withExperimental = Object.values(index.schools).find((entry) => entry.x > 0 && !entry.c[rareClass.code])!
  const verdict = evaluateSchoolPrograms(withExperimental, { subjects: [], intent: { classCode: rareClass.code, className: rareClass.name } }, index)
  assert.equal(verdict.state, 'unknown')
  assert.ok(verdict.experimental > 0)
})

test('起點條件層與 43 題分開計：保留＋劃掉＝輸入，無資料與不判定都在保留裡', () => {
  const outcome = applyProgramPrefs(schools, index, { subjects: ['P', 'B', 'Z'], intent: null })
  assert.equal(outcome.kept.length + outcome.struck.length, schools.length)
  assert.equal(outcome.stats.evaluated, programsManifest.counts.undergraduateSchools)
  assert.equal(outcome.stats.noData, schools.length - programsManifest.counts.undergraduateSchools)
  assert.equal(outcome.stats.struckBySubjects, outcome.struck.length)
  assert.equal(outcome.stats.struckByProgram, 0)
  assert.ok(outcome.struck.some(({ school }) => (school.nameSimplified ?? school.name) === '中国科学技术大学'))
  for (const { school } of outcome.struck) assert.ok((index.schools[school.moeCode!]?.u ?? 0) > 0, `${school.name} 沒本科資料卻被劃掉`)
})
