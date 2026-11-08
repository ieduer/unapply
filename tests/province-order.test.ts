// 批 G8b 閘門：全站省份清單照行政區劃代碼排序（北京 11 … 新疆 65），三語相同；代碼逐校對教育部學校標識碼。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { PROVINCE_CODE, compareProvinces, sortProvinces } from '../src/data/provinceOrder.ts'
import { candidateProvinceOptions } from '../src/data/admissionAuthorities.ts'

const root = new URL('..', import.meta.url).pathname
const read = (p: string) => readFileSync(`${root}/${p}`, 'utf8')
const STANDARD = ['北京', '天津', '河北', '山西', '內蒙古', '遼寧', '吉林', '黑龍江', '上海', '江蘇', '浙江', '安徽', '福建', '江西', '山東', '河南', '湖北', '湖南', '廣東', '廣西', '海南', '重慶', '四川', '貴州', '雲南', '西藏', '陝西', '甘肅', '青海', '寧夏', '新疆']

test('考生省份下拉（題頁、結果頁、學校詳情共用）照行政區劃代碼：北京 … 新疆，31 個', () => {
  assert.deepEqual([...candidateProvinceOptions], STANDARD)
  assert.deepEqual(sortProvinces([...STANDARD].reverse()), STANDARD)
  assert.ok(compareProvinces('北京', '新疆') < 0 && compareProvinces('上海', '江蘇') < 0)
})

test('代碼逐校核對：教育部學校標識碼第 3–4 位＝學校所在省代碼（唯一例外：吉利學院 2023 年遷到四川、沿用北京代碼）', () => {
  const schools = JSON.parse(read('public/data/runtime/schools.json')) as { name: string; province: string; moeCode?: string }[]
  const mismatch = schools.filter((s) => s.moeCode && PROVINCE_CODE[s.province] !== Number(s.moeCode.slice(2, 4))).map((s) => s.moeCode)
  assert.deepEqual(mismatch, ['4111012802'])
  for (const s of schools) assert.ok(PROVINCE_CODE[s.province], s.province)
})

test('查詢頁省份過濾、選考來源省表（查詢頁與學校詳情）都用同一個排序；結果頁省份分佈同數時照代碼', () => {
  const search = read('src/components/SearchPage.tsx')
  assert.match(search, /const provinces = useMemo\(\(\) => \(schoolData \? sortProvinces\(/)
  assert.match(search, /provinceSources\)\.sort\(\(\[, a\], \[, b\]\) => compareProvinces\(a\.nameZh, b\.nameZh\)\)/)
  assert.match(search, /sortProvinces\(row\.provinces\.map/)
  const detail = read('src/components/SchoolDetail.tsx')
  assert.match(detail, /\.sort\(\(a, b\) => compareProvinces\(a\.nameZh, b\.nameZh\)\)/)
  assert.match(detail, /sortProvinces\(Object\.values\(programsPayload\.provinceSources\)/)
  assert.match(read('src/components/ResultPage.tsx'), /b\.count - a\.count \|\| compareProvinces\(a\.code, b\.code\)/)
  // 省表代碼（HB／JS…）對應的省名都有代碼
  const index = JSON.parse(read('public/data/programs/index.json')) as { provinceSources: Record<string, { nameZh: string }> }
  for (const s of Object.values(index.provinceSources)) assert.ok(PROVINCE_CODE[s.nameZh], s.nameZh)
})
