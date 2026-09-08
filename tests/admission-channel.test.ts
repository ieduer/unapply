import assert from 'node:assert/strict'
import { test } from 'node:test'
import { schools } from '../src/data/schools.ts'
import { filterSchools } from '../src/engine/filter.ts'
import { getRegularChannelState, getSpecialAdmissionTracks } from '../src/lib/schoolProfile.ts'

function bySimplifiedName(name: string) {
  const school = schools.find((item) => (item.nameSimplified ?? item.name) === name)
  assert.ok(school, `${name} 不在主池里`)
  return school
}

function keptNames(answers: Parameters<typeof filterSchools>[1], province?: string) {
  const result = filterSchools(schools, answers, province ? { candidateProvince: province } : undefined)
  return new Set(result.kept.map((school) => school.nameSimplified ?? school.name))
}

test('綜評專屬院校對北京考生不算「填志願就能錄取」', () => {
  const kept = keptNames({ A6: 'regular_only' }, '北京')
  for (const name of ['南方科技大学', '上海科技大学', '上海纽约大学', '昆山杜克大学']) {
    assert.equal(kept.has(name), false, `${name} 應被 A6 排除`)
  }
})

test('上海科技大学對安徽考生保留：該省走普通本科批', () => {
  assert.equal(getRegularChannelState(bySimplifiedName('上海科技大学'), { candidateProvince: '安徽' }), 'regular')
  assert.equal(keptNames({ A6: 'regular_only' }, '安徽').has('上海科技大学'), true)
})

test('中国科学院大学對北京考生保留：綜評與普通一批並行', () => {
  assert.equal(getRegularChannelState(bySimplifiedName('中国科学院大学'), { candidateProvince: '北京' }), 'regular')
  assert.equal(keptNames({ A6: 'regular_only' }, '北京').has('中国科学院大学'), true)
})

test('2025 年起新設的普通批院校不得被誤殺', () => {
  const kept = keptNames({ A6: 'regular_only' }, '北京')
  for (const name of ['宁波东方理工大学', '福建福耀科技大学', '大湾区大学', '深圳理工大学', '西湖大学']) {
    assert.equal(kept.has(name), true, `${name} 走普通批，不該被排除`)
  }
})

test('未收錄招生管道的學校恆為 regular_gaokao', () => {
  const beida = bySimplifiedName('北京大学')
  assert.equal(beida.admissionChannels, undefined)
  assert.deepEqual(getSpecialAdmissionTracks(beida, { candidateProvince: '北京' }), ['regular_gaokao'])
  assert.equal(keptNames({ A6: 'regular_only' }, '北京').has('北京大学'), true)
})

test('沒有考生地區時只排除全國皆無常規批的院校', () => {
  const kept = keptNames({ A6: 'regular_only' })
  assert.equal(kept.has('上海科技大学'), true, '缺省份時不得替安徽考生做決定')
  assert.equal(kept.has('南方科技大学'), false, '全國皆無常規批仍應排除')
})

test('A6 選「都看」時不排除任何學校', () => {
  const result = filterSchools(schools, { A6: 'any' }, { candidateProvince: '北京' })
  assert.equal(result.stats.excludedCount, 0)
})
