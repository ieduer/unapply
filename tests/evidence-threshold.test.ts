import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import { schools } from '../src/data/schools.ts'
import { allQuestions } from '../src/data/questions.ts'
import { filterSchools, getSchoolDimensionValue, isHardFilterableQuality } from '../src/engine/filter.ts'
import { chooseCrowdValue } from '../scripts/build_research_data.mjs'
import { analyzeQuestionCoverage } from '../src/engine/coverage.ts'
import { researchPipelineMeta } from '../src/data/researchData.ts'
import type { School } from '../src/data/schools.ts'
import type { DimensionId } from '../src/data/dimensions.ts'

const runtime = JSON.parse(fs.readFileSync(new URL('../public/data/runtime/schools.json', import.meta.url), 'utf8')) as School[]
const sysu = runtime.find(s => s.moeCode === '4144010558')!
const jlu = runtime.find(s => s.moeCode === '4122010183')!

test('中山大學：實際選項與發布資料不再因校區混票誤排', () => {
  const q = allQuestions.find(q => q.id === 'B9')!
  const choice = q.options.find(o => o.label === '步行 15 分鐘內')!
  assert.equal(sysu.nameSimplified, '中山大学')
  assert.equal(choice.key, 'walkable')
  assert.equal(filterSchools([sysu], { [q.id]: choice.key }).stats.excludedCount, 0)
  const m = sysu.qualityEvidence!.B9!
  assert.equal(m.sampleSize, 131)
  assert.equal(m.classifiedSampleSize, 24)
  assert.equal(m.winningVotes, 13)
  assert.equal(m.unclassifiedResponses, 107)
  assert.deepEqual(m.valueCounts, { '無地鐵': 13, '地鐵＞3公里': 8, '步行15分鐘內': 3 })
  assert.equal(m.confidence, 'low')
  assert.equal(m.scope, 'unverified')
  assert.ok(sysu.researchEvidence?.B9?.some(e => e.url === 'https://fls.sysu.edu.cn/article/4448' && e.note?.includes('南校园')))
})

test('刪去33條不支持的分類不能縮小131條總分母或提升置信度', () => {
  const before = chooseCrowdValue(new Map([['步行15分鐘內',36], ['無地鐵',13], ['地鐵＞3公里',8]]),131)!
  const after = chooseCrowdValue(new Map([['步行15分鐘內',3], ['無地鐵',13], ['地鐵＞3公里',8]]),131)!
  assert.equal(before.sampleSize,131)
  assert.equal(after.sampleSize,131)
  assert.equal(after.confidence,'low')
  assert.equal(after.winningVotes/after.sampleSize,13/131)
  assert.equal(after.unclassifiedResponses-before.unclassifiedResponses,33)
  assert.throws(()=>chooseCrowdValue(new Map([['x',3]]),2))
})

test('平票與全部未知保留分布，但沒有勝出值', () => {
  const tie=chooseCrowdValue(new Map([['有',2],['無',2]]),7)!
  assert.equal(tie.value,null)
  assert.deepEqual(tie.valueCounts,{'有':2,'無':2})
  assert.equal(tie.unclassifiedResponses,3)
  const unknown=chooseCrowdValue(new Map(),8)!
  assert.equal(unknown.value,null)
  assert.equal(unknown.unclassifiedResponses,8)
  assert.equal(unknown.classifiedSampleSize,0)
})

test('票數再高也不能將匿名回報變成整校事實', () => {
  const s: School={...sysu, quality:{B9:'無地鐵'},qualityEvidence:{B9:{source:'crowd',confidence:'high',sampleSize:10000,winningVotes:10000,scope:'school',year:new Date().getUTCFullYear()}}}
  assert.equal(isHardFilterableQuality(s,'B9'),false)
  assert.equal(getSchoolDimensionValue(s,'B9'),null)
})

test('官方資料必須同時滿足整校範圍、當年與逐校HTTPS來源', () => {
  const year=new Date().getUTCFullYear()
  const s: School={...sysu,quality:{B9:'無地鐵'},qualityEvidence:{B9:{source:'official',confidence:'high',sampleSize:1,winningVotes:1,scope:'school',year}},researchEvidence:{B9:[{title:'fixture',url:'https://www.sysu.edu.cn/'}]}}
  assert.equal(isHardFilterableQuality(s,'B9'),true)
  for(const change of [{scope:'campus' as const},{scope:'unverified' as const},{year:year-1},{year:year+1}]) {
    assert.equal(isHardFilterableQuality({...s,qualityEvidence:{B9:{...s.qualityEvidence!.B9!,...change}}},'B9'),false)
  }
  assert.equal(isHardFilterableQuality({...s,researchEvidence:undefined},'B9'),false)
  assert.equal(isHardFilterableQuality({...s,researchEvidence:{B9:[{title:'fixture',url:'http://www.sysu.edu.cn/'}]}},'B9'),false)
})

test('四校官方交通資料僅證明校區；三份無分鐘數資料不得推定15分鐘', () => {
  for(const code of ['4111010017','4111010032','4111010037','4111010038']) {
    const school=runtime.find(s=>s.moeCode===code)!
    assert.equal(isHardFilterableQuality(school,'B9'),false)
    assert.ok(school.researchEvidence?.B9?.length)
    if(code==='4111010017') assert.equal(school.qualityEvidence?.B9?.scope,'campus')
    else assert.notEqual(school.qualityEvidence?.B9?.source,'official')
  }
})

test('吉大全校宿舍空調補證保留到瀏覽器；不得擴張成宿舍與教室都有', () => {
  const evidence=jlu.researchEvidence?.B2?.find(e=>e.url==='https://news.jlu.edu.cn/info/1211/61426.htm')
  assert.ok(evidence)
  assert.equal(evidence.date,'2026-06-16')
  assert.match(evidence.note!,/教室空调未获/)
  assert.notEqual(jlu.qualityEvidence?.B2?.source,'official')
  const q=allQuestions.find(q=>q.id==='B2')!
  for(const label of ['宿舍必須有','宿舍 + 教室都必須有']) {
    const choice=q.options.find(o=>o.label===label)!
    assert.equal(filterSchools([jlu],{B2:choice.key}).stats.excludedCount,0)
  }
})

test('全池匿名回報分母與分布守恆，所有B皆不能由眾包排除', () => {
  let count=0,withoutValue=0,hard=0,display=0
  for(const s of runtime) for(const [dimension,meta] of Object.entries(s.qualityEvidence??{})) {
    const dim=dimension as DimensionId
    if(s.quality?.[dim]!=null) {if(isHardFilterableQuality(s,dim)) hard++; else display++}
    if(meta.source!=='crowd') continue
    assert.ok(meta.sampleSize>=1)
    const classified=Object.values(meta.valueCounts??{}).reduce((a,b)=>a+b,0)
    assert.equal(classified,meta.classifiedSampleSize)
    assert.equal(classified+meta.unclassifiedResponses!,meta.sampleSize)
    assert.ok(meta.winningVotes<=classified)
    assert.equal(isHardFilterableQuality(s,dim),false)
    if(s.quality?.[dim]==null) withoutValue++
    count++
  }
  assert.ok(count>50000)
  assert.ok(withoutValue>1000)
  assert.equal(hard,researchPipelineMeta.counts.hardFilterableValues)
  assert.equal(display,researchPipelineMeta.counts.displayOnlyValues)
  assert.deepEqual(runtime.map(s=>s.moeCode),schools.map(s=>s.moeCode))
})

test('目前生活題24項均暫緩，舊B答案不能產生整校排除', () => {
  const coverage=analyzeQuestionCoverage(runtime)
  assert.equal(Object.values(coverage).filter(c=>c.active).length,15)
  for(const q of allQuestions.filter(q=>q.id.startsWith('B'))) {
    assert.equal(coverage[q.id].active,false)
    for(const o of q.options) assert.equal(filterSchools(runtime,{[q.id]:q.type==='multi'?[o.key]:o.key}).stats.excludedCount,0)
  }
})
