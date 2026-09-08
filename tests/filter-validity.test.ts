import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import { schools } from '../src/data/schools.ts'
import { allQuestions } from '../src/data/questions.ts'
import { candidateProvinceOptions } from '../src/data/admissionAuthorities.ts'
import { filterSchools, getSchoolDimensionValue } from '../src/engine/filter.ts'
import { getRegularChannelState } from '../src/lib/schoolProfile.ts'
import { crowdNormalizers, normalizeCurfew } from '../scripts/build_research_data.mjs'
import { loadSchools, loadCampusesByProvince } from '../src/lib/runtimeData.ts'
const cases: [string, string, string | null][] = [
  ['B1', '三人间', null], ['B1', '三层床', '三層上下鋪'],
  ['B3', '没有独立卫浴', null],
  ['B7', '没有小学期', '標準'], ['B7', '有小学期', '有小學期'],
  ['B7', '没有小学期，暑假21天', '暑假＜4週'],
  ['B9', '地铁在建', null], ['B9', '有地铁', null], ['B9', '地铁站步行15分钟', '步行15分鐘內'],
  ['B11', '不计费', '不計費'], ['B11', '按流量收费', '按流量計費'],
  ['B12', '周末不断电', '週末不斷'],
  ['B13', '不贵', '好評'], ['B13', '贵', '貴'],
  ['B20', '不强制开户', '不強制'], ['B20', '强制开户', '強制開戶'],
]
for (const [dim, text, expected] of cases) test(`自然語義：${dim}/${text}`, () => {
  const n = crowdNormalizers.find((item: { dimensionId: string }) => item.dimensionId === dim)
  assert.ok(n)
  assert.equal(n.normalize(text), expected)
})
test('不查寢不能判成查寢', () => assert.equal(normalizeCurfew('', '不查寝'), '寬鬆'))
test('界面選項與發布payload：沒有來源的晨跑樣本不得混入高票結果', () => {
  const runtime = JSON.parse(fs.readFileSync(new URL('../public/data/runtime/schools.json', import.meta.url), 'utf8')) as typeof schools
  const q = allQuestions.find(q => q.id === 'B5')!
  const opt = q.options.find(o => o.label === '不能有')!
  assert.ok(opt)
  const pku = runtime.find(s => s.nameSimplified === '北京大学')!
  assert.equal(pku.quality?.B5, '無')
  assert.equal(filterSchools([pku], { [q.id]: opt.key }).stats.excludedCount, 0)
})
test('校名不能證明整校沒有常規錄取管道；跨年度未知不排除', () => {
  const dm = schools.find(s => s.nameSimplified === '大连海事大学')!
  assert.ok(dm)
  const q = allQuestions.find(q => q.id === 'A6')!
  const choice = q.options.find(o => o.label === '只看填志願就能錄取的（不另報名、不校測）')!
  assert.equal(filterSchools([dm], { A6: choice.key }, { candidateProvince: candidateProvinceOptions[0] }).stats.excludedCount, 0)
  const ny = schools.find(s => s.nameSimplified === '上海纽约大学')!
  assert.equal(getRegularChannelState(ny, { admissionYear: 2027 }), 'regular')
})
test('所有runtime排除字段與生成端相同，省份取界面選單', () => {
  const runtime = JSON.parse(fs.readFileSync(new URL('../public/data/runtime/schools.json', import.meta.url), 'utf8')) as typeof schools
  assert.equal(runtime.length, 2919)
  for (const r of runtime) {
    assert.ok(candidateProvinceOptions.includes(r.province))
    const s = schools.find(s => s.moeCode === r.moeCode)!
    for (const q of allQuestions) assert.deepEqual(getSchoolDimensionValue(r, q.id), getSchoolDimensionValue(s, q.id))
  }
})
test('結果理由不用內部學科token', () => {
  for (const q of allQuestions) for (const o of q.options) {
    for (const x of filterSchools(schools, { [q.id]: q.type === 'multi' ? [o.key] : o.key }).excluded) {
      for (const r of x.reasons) assert.doesNotMatch(r.schoolValue, /(?:CS|EE|Math|Med|Econ|Law|Chn|Hist):|regular_gaokao|tier1|main_city/)
    }
  }
})
test('runtime請求失敗可重試；已知省份404不能冒充空校區', async () => {
  const previous = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls++; return new Response(calls === 1 ? 'error' : JSON.stringify(schools), { status: calls === 1 ? 503 : 200 }) }
  try {
    await assert.rejects(loadSchools())
    assert.equal((await loadSchools()).length, 2919)
    assert.equal(calls, 2)
    globalThis.fetch = async () => new Response('missing', { status: 404 })
    await assert.rejects(loadCampusesByProvince(candidateProvinceOptions.find(p => p === '北京')!))
    globalThis.fetch = async () => new Response('{}', { status: 200 })
    assert.deepEqual(await loadCampusesByProvince(candidateProvinceOptions.find(p => p === '北京')!), {})
  } finally { globalThis.fetch = previous }
})

test("大一分校政策必須被A5實際讀取", () => {
  const school = { ...schools[0], mainCampusType: undefined, campusFreshmanPolicy: "yes" as const }
  assert.equal(getSchoolDimensionValue(school, "A5"), "separate_freshman")
})

test("河北工業大學的211身份不得被人工樣本覆蓋", () => {
  assert.equal(schools.find(s => s.nameSimplified === "河北工业大学")?.level, "211非985")
})

test("主題儲存被禁用不阻止頁面", async () => {
  const { saveThemeState, defaultThemeState } = await import("../src/lib/theme.ts")
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", { configurable: true, value: { get localStorage() { throw new Error("blocked") } } })
  try { assert.doesNotThrow(() => saveThemeState(defaultThemeState)) } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous)
    else Reflect.deleteProperty(globalThis, "window")
  }
})

test("保守歸一：B4/不强制早晚自习", () => {
  const n = crowdNormalizers.find((item: { dimensionId: string }) => item.dimensionId === "B4")
  assert.equal(n.normalize("不强制早晚自习"), null)
})

test("保守歸一：B5/没有晨跑要求", () => {
  const n = crowdNormalizers.find((item: { dimensionId: string }) => item.dimensionId === "B5")
  assert.equal(n.normalize("没有晨跑要求"), null)
})

test("保守歸一：B6/每次1000米", () => {
  const n = crowdNormalizers.find((item: { dimensionId: string }) => item.dimensionId === "B6")
  assert.equal(n.normalize("每次1000米"), null)
})

test("保守歸一：B8/不禁止外卖", () => {
  const n = crowdNormalizers.find((item: { dimensionId: string }) => item.dimensionId === "B8")
  assert.equal(n.normalize("不禁止外卖"), null)
})

test("保守歸一：B10/没有洗衣机使用限制", () => {
  const n = crowdNormalizers.find((item: { dimensionId: string }) => item.dimensionId === "B10")
  assert.equal(n.normalize("没有洗衣机使用限制"), null)
})

test("保守歸一：B14/没有热水限制", () => {
  const n = crowdNormalizers.find((item: { dimensionId: string }) => item.dimensionId === "B14")
  assert.equal(n.normalize("没有热水限制"), null)
})

test("保守歸一：B15/不禁止电动车", () => {
  const n = crowdNormalizers.find((item: { dimensionId: string }) => item.dimensionId === "B15")
  assert.equal(n.normalize("不禁止电动车"), null)
})

test("保守歸一：B16/500W", () => {
  const n = crowdNormalizers.find((item: { dimensionId: string }) => item.dimensionId === "B16")
  assert.equal(n.normalize("500W"), "800W內")
})

test("保守歸一：B16/1000W", () => {
  const n = crowdNormalizers.find((item: { dimensionId: string }) => item.dimensionId === "B16")
  assert.equal(n.normalize("1000W"), null)
})

test("保守歸一：B17/没有限制，可以通宵自习", () => {
  const n = crowdNormalizers.find((item: { dimensionId: string }) => item.dimensionId === "B17")
  assert.equal(n.normalize("没有限制，可以通宵自习"), null)
})

test("保守歸一：B18/不禁止带电脑", () => {
  const n = crowdNormalizers.find((item: { dimensionId: string }) => item.dimensionId === "B18")
  assert.equal(n.normalize("不禁止带电脑"), null)
})

test("保守歸一：B19/不强制校园卡，支付宝即可", () => {
  const n = crowdNormalizers.find((item: { dimensionId: string }) => item.dimensionId === "B19")
  assert.equal(n.normalize("不强制校园卡，支付宝即可"), null)
})

test("保守歸一：B21/没有大型超市，但有小卖部", () => {
  const n = crowdNormalizers.find((item: { dimensionId: string }) => item.dimensionId === "B21")
  assert.equal(n.normalize("没有大型超市，但有小卖部"), null)
})

test("保守歸一：B22/不送到宿舍，在校门取", () => {
  const n = crowdNormalizers.find((item: { dimensionId: string }) => item.dimensionId === "B22")
  assert.equal(n.normalize("不送到宿舍，在校门取"), null)
})

test("保守歸一：B23/没有限制，有共享单车", () => {
  const n = crowdNormalizers.find((item: { dimensionId: string }) => item.dimensionId === "B23")
  assert.equal(n.normalize("没有限制，有共享单车"), null)
})
