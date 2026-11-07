// S1 專業／選考科目資料層：payload 完整性、S1／S2 兩題的學校取值與引擎判定、學校詳情的逐校判定。build 之前 data:programs 必須先生成 payload。
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { programsManifest } from '../src/data/programsManifest.ts'
import type { ProgramBucket, ProgramCatalogPayload, ProgramIndexPayload, SubjectCode } from '../src/data/programsTypes.ts'
import type { School } from '../src/data/schools.ts'
import { PROGRAM_CLASS_WILDCARD, admissibleCombos, countAdmissible, evaluateSchoolPrograms, isAdmissible, offeredClasses } from '../src/engine/programs.ts'
import { SUBJECT_COMBOS, comboLabel, emptyProgramPrefs, normalizeSubjects, programPrefsActive, requirementLabel, subjectsToCombo } from '../src/data/programPrefs.ts'
import { filterSchools, getSchoolDimensionValue } from '../src/engine/filter.ts'
import { analyzeQuestionCoverage, getVisibleOptions } from '../src/engine/coverage.ts'
import { DIMENSIONS } from '../src/data/dimensions.ts'
import { allQuestions } from '../src/data/questions.ts'
import { programClasses } from '../src/data/programClasses.ts'

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

test('S1 取值：20 種組合固定序，組合鍵與選項一致；S2 取值：開設的專業類＋試驗班通配', () => {
  assert.equal(SUBJECT_COMBOS.length, 20)
  assert.equal(new Set(SUBJECT_COMBOS).size, 20)
  assert.equal(subjectsToCombo(['B', 'P', 'C']), 'PCB')
  assert.equal(subjectsToCombo(['P', 'C']), null)
  assert.equal(comboLabel('PCB'), '物理＋化學＋生物')
  const pku = entryOf('北京大学')
  const combos = admissibleCombos(pku, index)
  assert.ok(combos.length > 0 && combos.every((combo) => SUBJECT_COMBOS.includes(combo)))
  assert.ok(combos.includes('PCB'))
  const classes = offeredClasses(pku)
  assert.ok(classes.every((code) => code === PROGRAM_CLASS_WILDCARD || programClasses.some((c) => c.code === code)))
  assert.equal(classes.includes(PROGRAM_CLASS_WILDCARD), pku.x > 0)
  const noExperimental = Object.values(index.schools).find((entry) => entry.u > 0 && entry.x === 0)!
  assert.equal(offeredClasses(noExperimental).includes(PROGRAM_CLASS_WILDCARD), false)
})

test('引擎取值與題目：S1／S2 有資料才取值，疑罪從無；選項鍵＝維度取值；選項按真實覆蓋出題', () => {
  const ctx = { programs: index }
  const s1 = allQuestions.find((q) => q.id === 'S1')!
  const s2 = allQuestions.find((q) => q.id === 'S2')!
  assert.equal(s1.section, 'S_programs')
  assert.equal(s2.section, 'S_programs')
  assert.deepEqual(s1.options.map((o) => o.key), [...SUBJECT_COMBOS])
  assert.deepEqual(s2.options.map((o) => o.key), programClasses.map((c) => c.code))
  assert.deepEqual([...DIMENSIONS.S1.values], [...SUBJECT_COMBOS])
  assert.deepEqual([...DIMENSIONS.S2.values], [...programClasses.map((c) => c.code), PROGRAM_CLASS_WILDCARD])
  const pku = byName('北京大学')
  assert.deepEqual(getSchoolDimensionValue(pku, 'S1', ctx), admissibleCombos(entryOf('北京大学'), index))
  assert.deepEqual(getSchoolDimensionValue(pku, 'S2', ctx), offeredClasses(entryOf('北京大学')))
  const vocationalOnly = schools.find((school) => (index.schools[school.moeCode!]?.u ?? 0) === 0 && (index.schools[school.moeCode!]?.v ?? 0) > 0)!
  assert.equal(getSchoolDimensionValue(vocationalOnly, 'S1', ctx), null)
  assert.equal(getSchoolDimensionValue(vocationalOnly, 'S2', ctx), null)
  const missing = schools.find((school) => !index.schools[school.moeCode!])!
  assert.equal(getSchoolDimensionValue(missing, 'S1', ctx), null)
  // 沒有上下文（舊呼叫端）：兩題一律不取值，不會誤劃。
  assert.equal(getSchoolDimensionValue(pku, 'S1'), null)
  const coverage = analyzeQuestionCoverage(schools, ctx)
  assert.ok(coverage.S1.active && coverage.S2.active)
  // 考生自身事實的選項不因排除 0 所被隱藏：物化生報得了每所有資料的學校，仍要能作答。
  assert.ok(s1.options.every((o) => o.alwaysVisible) && s2.options.every((o) => o.alwaysVisible))
  assert.equal(getVisibleOptions(s1, coverage.S1).length, 20)
  assert.equal(getVisibleOptions(s2, coverage.S2).length, 92)
  assert.equal(coverage.S1.optionCoverageByKey.PCB.excludedCount, 0, '物化生在每所有資料的學校至少可報一個專業')
  assert.ok(coverage.S1.impactfulOptionCount >= 19)
})

test('S1 題：物生政劃掉全部專業都要物＋化的學校；沒本科資料的學校都在場；在場＋排除＝全部', () => {
  const ctx = { programs: index }
  const result = filterSchools(schools, { S1: 'PBZ' }, ctx)
  assert.equal(result.kept.length + result.excluded.length, schools.length)
  assert.ok(result.excluded.some(({ school }) => (school.nameSimplified ?? school.name) === '中国科学技术大学'))
  for (const { school } of result.excluded) assert.ok((index.schools[school.moeCode!]?.u ?? 0) > 0, `${school.name} 沒本科資料卻被劃掉`)
  assert.ok(result.kept.some((school) => (school.nameSimplified ?? school.name) === '北京大学'))
  const noData = schools.filter((school) => (index.schools[school.moeCode!]?.u ?? 0) === 0)
  assert.equal(result.kept.filter((school) => (index.schools[school.moeCode!]?.u ?? 0) === 0).length, noData.length)
  assert.equal(result.stats.answeredCount, 1)
  assert.equal(result.stats.keptCount + result.stats.excludedCount, schools.length)
  const skipped = filterSchools(schools, { S1: 'skip' }, ctx)
  assert.equal(skipped.excluded.length, 0)
})

test('S2 題：沒開該專業類的學校被劃掉；開了或另有試驗班（通配）的保留；沒資料的保留', () => {
  const ctx = { programs: index }
  const cs = catalog.classes.find((c) => c.name === '计算机类')!
  const result = filterSchools(schools, { S2: cs.code }, ctx)
  assert.equal(result.kept.length + result.excluded.length, schools.length)
  assert.ok(result.excluded.some(({ school }) => (school.nameSimplified ?? school.name) === '中央音乐学院'))
  assert.ok(result.kept.some((school) => (school.nameSimplified ?? school.name) === '北京大学'))
  const rareClass = catalog.classes.find((c) => c.name === '水利类')!
  const rare = filterSchools(schools, { S2: rareClass.code }, ctx)
  for (const school of rare.kept) {
    const entry = index.schools[school.moeCode!]
    if (!entry || entry.u === 0) continue
    assert.ok(entry.c[rareClass.code] || entry.x > 0, `${school.name} 沒開 ${rareClass.name} 也沒試驗班卻保留`)
  }
  for (const { school } of rare.excluded) {
    const entry = index.schools[school.moeCode!]
    assert.ok(entry && entry.u > 0 && !entry.c[rareClass.code] && entry.x === 0, `${school.name} 不該被劃掉`)
  }
})

test('學校詳情逐校判定與引擎同義：no-data／kept／struck／unknown', () => {
  assert.equal(evaluateSchoolPrograms(undefined, { subjects: ['P', 'B', 'Z'], intent: null }, index).state, 'no-data')
  const vocationalOnly = Object.entries(index.schools).find(([, s]) => s.u === 0 && s.v > 0)!
  assert.equal(evaluateSchoolPrograms(vocationalOnly[1], { subjects: ['P', 'B', 'Z'], intent: null }, index).state, 'no-data')
  assert.equal(evaluateSchoolPrograms(entryOf('北京大学'), emptyProgramPrefs, index).state, 'kept')

  const ustc = evaluateSchoolPrograms(entryOf('中国科学技术大学'), { subjects: ['P', 'B', 'Z'], intent: null }, index)
  assert.equal(ustc.state, 'struck')
  assert.equal(ustc.reasons[0]?.kind, 'subjects')
  const pku = evaluateSchoolPrograms(entryOf('北京大学'), { subjects: ['P', 'C', 'B'], intent: null }, index)
  assert.equal(pku.state, 'kept')
  assert.ok(pku.admissibleCount > 0 && pku.admissibleCount <= pku.matchingCount)
  assert.equal(countAdmissible(entryOf('北京大学'), new Set(['P', 'C', 'B']), index), pku.admissibleCount)

  const cs = catalog.classes.find((c) => c.name === '计算机类')!
  const csProgram = catalog.programs.find((p) => p.name === '计算机科学与技术')!
  const music = evaluateSchoolPrograms(entryOf('中央音乐学院'), { subjects: [], intent: { classCode: cs.code, className: cs.name } }, index)
  assert.equal(music.state, 'struck')
  assert.equal(music.reasons[0]?.kind, 'program')
  const pkuCs = evaluateSchoolPrograms(entryOf('北京大学'), { subjects: [], intent: { classCode: cs.code, className: cs.name, programCode: csProgram.code, programName: csProgram.name } }, index)
  assert.equal(pkuCs.state, 'kept', '北大按計算機類招生，涵蓋計算機科學與技術')
  const rareClass = catalog.classes.find((c) => c.name === '水利类')!
  const withExperimental = Object.values(index.schools).find((entry) => entry.x > 0 && !entry.c[rareClass.code])!
  const verdict = evaluateSchoolPrograms(withExperimental, { subjects: [], intent: { classCode: rareClass.code, className: rareClass.name } }, index)
  assert.equal(verdict.state, 'unknown')
  assert.ok(verdict.experimental > 0)

  // 與引擎一致：每所有本科資料的學校，詳情判定 struck ⇔ 引擎排除（S1＋S2 同時作答）。
  const ctx = { programs: index }
  const engine = filterSchools(schools, { S1: 'PBZ', S2: cs.code }, ctx)
  const excluded = new Set(engine.excluded.map(({ school }) => school.moeCode))
  for (const school of schools) {
    const entry = index.schools[school.moeCode!]
    const detail = evaluateSchoolPrograms(entry, { subjects: ['P', 'B', 'Z'], intent: { classCode: cs.code, className: cs.name } }, index)
    assert.equal(detail.state === 'struck', excluded.has(school.moeCode), `${school.name} 詳情 ${detail.state} vs 引擎 ${excluded.has(school.moeCode) ? '排除' : '在場'}`)
  }
})
