// 中外合作辦學資料層（批 D2）：payload 完整性、來源唯一且官方、對回教育部主表、不進題目。build 之前 data:joint 必須先生成 payload。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { jointProgramsManifest } from '../src/data/jointProgramsManifest.ts'
import type { JointIndexPayload, JointItemsPayload } from '../src/data/jointTypes.ts'
import type { School } from '../src/data/schools.ts'
import { DIMENSIONS } from '../src/data/dimensions.ts'
import { allQuestions } from '../src/data/questions.ts'

const index = JSON.parse(readFileSync(new URL('../public/data/joint/index.json', import.meta.url), 'utf8')) as JointIndexPayload
const items = JSON.parse(readFileSync(new URL('../public/data/joint/items.json', import.meta.url), 'utf8')) as JointItemsPayload
const schools = JSON.parse(readFileSync(new URL('../public/data/runtime/schools.json', import.meta.url), 'utf8')) as School[]
const byCode = new Map(schools.map((s) => [s.moeCode, s]))
const byName = (name: string) => schools.find((s) => (s.nameSimplified ?? s.name) === name)!

test('manifest 與兩層 payload 一致（版本、計數）', () => {
  assert.equal(index.version, jointProgramsManifest.version)
  assert.equal(items.version, jointProgramsManifest.version)
  const entries = Object.values(index.schools)
  assert.equal(entries.length, jointProgramsManifest.counts.schools)
  assert.equal(entries.reduce((n, e) => n + e.i + e.p, 0), jointProgramsManifest.counts.matched)
  assert.equal(Object.values(items.items).reduce((n, list) => n + list.length, 0), jointProgramsManifest.counts.matched)
  assert.equal(items.unmatched.length, jointProgramsManifest.counts.unmatched)
  assert.equal(jointProgramsManifest.counts.matched + jointProgramsManifest.counts.unmatched, jointProgramsManifest.counts.withDetail)
  for (const [code, e] of Object.entries(index.schools)) {
    const list = items.items[code]
    assert.ok(list, code)
    assert.equal(list.filter((x) => x.kind === 'institution').length, e.i, code)
    assert.equal(list.filter((x) => x.kind === 'project').length, e.p, code)
    assert.equal(list.filter((x) => x.coop === 'mainland_hkmotw').length, e.hk, code)
    assert.equal(list.filter((x) => x.coop === 'foreign_independent').length, e.fi, code)
    assert.equal(list.filter((x) => x.status === 'listed').length, e.live, code)
  }
})

test('名單全數有詳情；每條帶平台詳情網址、批准書／許可證編號、層次、讀取日；對回的學校都在教育部主表', () => {
  assert.equal(jointProgramsManifest.counts.withDetail, jointProgramsManifest.counts.listed, '名單上的每一條都要有詳情頁')
  for (const [code, list] of Object.entries(items.items)) {
    assert.ok(byCode.has(code), `${code} 不在 schools.json`)
    for (const item of list) {
      assert.match(item.url, /^https:\/\/www\.crs\.jsj\.edu\.cn\/aproval\/detail\/\d+$/, String(item.id))
      assert.ok(item.licenseNo.length >= 10, `${item.id} ${item.name} 編號 ${item.licenseNo}`)
      assert.ok(item.level.length > 0, `${item.id} 層次`)
      assert.match(item.fetchedAt, /^\d{4}-\d{2}-\d{2}$/)
      assert.ok(['institution', 'project'].includes(item.kind) && ['sino_foreign', 'mainland_hkmotw', 'foreign_independent'].includes(item.coop))
      assert.ok(item.name.length > 0 && (item.foreign.length > 0 || item.kind === 'institution'), `${item.id} 外方`)
    }
  }
  for (const item of items.unmatched) assert.ok(item.name && item.url)
})

test('獨立法人機構以機構本身對回主表；校內項目掛到母校', () => {
  const nottingham = byName('宁波诺丁汉大学')
  assert.ok((index.schools[nottingham.moeCode!]?.i ?? 0) >= 1, '寧波諾丁漢大學應以機構對回')
  const pku = byName('北京大学')
  assert.ok((index.schools[pku.moeCode!]?.p ?? 0) >= 1, '北京大學應有合作辦學項目')
  for (const list of Object.values(items.items)) for (const item of list) if (item.kind === 'institution' && /具有法人资格/.test(item.legalPerson) && !/不具有/.test(item.legalPerson)) assert.ok(item.chinese === '' || item.chinese.length > 0)
})

test('這一層不進題目：維度與題目數不變（45）', () => {
  assert.equal(Object.keys(DIMENSIONS).length, 45)
  assert.equal(allQuestions.length, 45)
  assert.ok(!Object.keys(DIMENSIONS).some((k) => /joint|coop/i.test(k)))
})

test('狀態與層次口徑：狀態只有四種；本科／碩士及以上名單標籤齊；內地與港澳臺合作條目有港澳臺方', () => {
  const statuses = new Set<string>(); const lists = new Set<string>()
  for (const list of Object.values(items.items)) for (const item of list) {
    statuses.add(item.status); lists.add(item.levelLists)
    if (item.coop === 'mainland_hkmotw') assert.ok(item.foreign.length > 0, `${item.id} 港澳臺方`)
    if (item.annotation) assert.notEqual(item.status, 'listed', `${item.id} 有括註卻仍 listed`)
  }
  for (const s of statuses) assert.ok(['listed', 'suspended', 'merged', 'terminated'].includes(s), s)
  assert.ok(lists.has('本科') && lists.has('硕士及以上'))
  assert.ok(jointProgramsManifest.counts.mainlandHkMoTw >= 10)
})
