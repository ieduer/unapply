import assert from 'node:assert/strict'
import { test } from 'node:test'
import { schools } from '../src/data/schools.ts'
import { getSchoolDimensionValue, isHardFilterableQuality } from '../src/engine/filter.ts'

const crowdDims = ['B1', 'B2', 'B3', 'B13', 'B24'] as const

test('單票眾包值仍然展示，但不參與硬篩選', () => {
  const singleVote = schools.find((school) =>
    crowdDims.some((dim) => school.qualityEvidence?.[dim]?.confidence === 'low'),
  )
  assert.ok(singleVote, '主池里應該還有低置信度樣本')
  const dim = crowdDims.find((item) => singleVote.qualityEvidence?.[item]?.confidence === 'low')!
  assert.equal(singleVote.qualityEvidence?.[dim]?.winningVotes, 1)
  assert.notEqual(singleVote.quality?.[dim], undefined, '值仍應保留供展示')
  assert.equal(isHardFilterableQuality(singleVote, dim), false)
  assert.equal(getSchoolDimensionValue(singleVote, dim), null, '引擎應把它當未知處理')
})

test('多票一致的眾包值照常參與硬篩選', () => {
  const multiVote = schools.find((school) =>
    crowdDims.some((dim) => {
      const meta = school.qualityEvidence?.[dim]
      return meta?.source === 'crowd' && meta.winningVotes >= 3
    }),
  )
  assert.ok(multiVote)
  const dim = crowdDims.find((item) => (multiVote.qualityEvidence?.[item]?.winningVotes ?? 0) >= 3)!
  assert.equal(isHardFilterableQuality(multiVote, dim), true)
  assert.notEqual(getSchoolDimensionValue(multiVote, dim), null)
})

test('官方來源的值不受票數門檻限制', () => {
  const official = schools.filter((school) => school.qualityEvidence?.B9?.source === 'official')
  assert.ok(official.length > 0, '應該有官方地鐵依據的學校')
  for (const school of official) {
    assert.equal(isHardFilterableQuality(school, 'B9'), true)
    assert.equal(school.quality?.B9, '步行15分鐘內', '眾包不得覆蓋官方結論')
  }
})

test('每個眾包值都帶得出樣本量', () => {
  let checked = 0
  for (const school of schools) {
    for (const [dim, meta] of Object.entries(school.qualityEvidence ?? {})) {
      if (meta.source !== 'crowd') continue
      assert.ok(meta.sampleSize >= 1, `${school.name}/${dim} 樣本量異常`)
      assert.ok(meta.winningVotes >= 1 && meta.winningVotes <= meta.sampleSize, `${school.name}/${dim} 票數異常`)
      checked += 1
    }
  }
  assert.ok(checked > 10000, `檢查到的眾包值只有 ${checked} 條，明顯偏少`)
})
