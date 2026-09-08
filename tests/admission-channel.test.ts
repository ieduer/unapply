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

test('全程須申請+校園日的院校，任何省份都不算「填志願就能錄取」', () => {
  for (const province of ['北京', '江苏', '安徽', '广东']) {
    const kept = keptNames({ A6: 'regular_only' }, province)
    for (const name of ['上海纽约大学', '昆山杜克大学']) {
      assert.equal(kept.has(name), false, `${province} 考生的 ${name} 應被排除`)
    }
  }
})

test('上海科技大学只對江蘇考生是綜評專屬', () => {
  // 2026 常見問答原文：除江蘇外其他綜合評價招生省份的考生均可以裸分填報。
  assert.equal(getRegularChannelState(bySimplifiedName('上海科技大学'), { candidateProvince: '江苏' }), 'comprehensive_only')
  assert.equal(keptNames({ A6: 'regular_only' }, '江苏').has('上海科技大学'), false)
  for (const province of ['北京', '安徽', '上海', '浙江']) {
    assert.equal(
      getRegularChannelState(bySimplifiedName('上海科技大学'), { candidateProvince: province }),
      'regular',
      `${province} 考生可裸分填報，不該被排除`,
    )
    assert.equal(keptNames({ A6: 'regular_only' }, province).has('上海科技大学'), true)
  }
})

test('深圳北理莫斯科大学逐省不同：上海只有綜評，北京有普通批', () => {
  const school = bySimplifiedName('深圳北理莫斯科大学')
  assert.equal(getRegularChannelState(school, { candidateProvince: '上海' }), 'comprehensive_only')
  assert.equal(keptNames({ A6: 'regular_only' }, '上海').has('深圳北理莫斯科大学'), false)
  for (const province of ['北京', '广东', '江苏']) {
    assert.equal(getRegularChannelState(school, { candidateProvince: province }), 'regular')
  }
})

test('南方科技大学只提示不排除：章程說有普通批試點但沒公布省份', () => {
  const school = bySimplifiedName('南方科技大学')
  assert.equal(getRegularChannelState(school, { candidateProvince: '北京' }), 'comprehensive_dominant')
  assert.deepEqual(getSpecialAdmissionTracks(school, { candidateProvince: '北京' }), ['comprehensive_dominant'])
  for (const province of ['北京', '广东', '江苏', '上海']) {
    assert.equal(
      keptNames({ A6: 'regular_only' }, province).has('南方科技大学'),
      true,
      `證據不足以排除 ${province} 考生的南方科技大學`,
    )
  }
})

test('雙軌制與純普通批院校任何省份都不排除', () => {
  const names = [
    '中国科学院大学', '香港中文大学（深圳）', '香港科技大学（广州）', '香港城市大学（东莞）',
    '广东以色列理工学院', '西交利物浦大学', '宁波诺丁汉大学', '温州肯恩大学',
    '北京师范大学-香港浸会大学联合国际学院',
  ]
  for (const province of ['北京', '广东', '浙江', '江苏']) {
    const kept = keptNames({ A6: 'regular_only' }, province)
    for (const name of names) {
      assert.equal(kept.has(name), true, `${province} 考生的 ${name} 不該被排除`)
    }
  }
})

test('未收錄招生管道的學校恆為 regular_gaokao', () => {
  for (const name of ['北京大学', '西湖大学', '宁波东方理工大学', '福建福耀科技大学', '大湾区大学', '深圳理工大学']) {
    const school = bySimplifiedName(name)
    assert.equal(school.admissionChannels, undefined, `${name} 目前不該有招生管道記錄`)
    assert.deepEqual(getSpecialAdmissionTracks(school, { candidateProvince: '北京' }), ['regular_gaokao'])
    assert.equal(keptNames({ A6: 'regular_only' }, '北京').has(name), true)
  }
})

test('沒有考生地區時只排除全國皆無常規批的院校', () => {
  const kept = keptNames({ A6: 'regular_only' })
  assert.equal(kept.has('上海科技大学'), true, '缺省份時不得替非江蘇考生做決定')
  assert.equal(kept.has('深圳北理莫斯科大学'), true)
  assert.equal(kept.has('南方科技大学'), true, 'comprehensive_dominant 永遠不排除')
  assert.equal(kept.has('上海纽约大学'), false, '全國皆無常規批仍應排除')
})

test('每一條招生管道記錄都帶官方來源', () => {
  const recorded = schools.filter((school) => school.admissionChannels)
  assert.ok(recorded.length >= 14, `目前只收錄 ${recorded.length} 所`)
  for (const school of recorded) {
    const source = school.admissionChannels!.source
    assert.match(source.url, /^https:\/\//, `${school.name} 的來源不是 https`)
    assert.ok(source.title.length > 0)
    assert.equal(school.admissionChannels!.year, 2026, `${school.name} 應以 2026 年度章程為準`)
  }
})

test('A6 選「都看」時不排除任何學校', () => {
  const result = filterSchools(schools, { A6: 'any' }, { candidateProvince: '北京' })
  assert.equal(result.stats.excludedCount, 0)
})
