// 批 H1（2026-11-12）：瀏覽器載入的瘦身目錄 schools.core.json 與 canonical schools.json 的等價性閘門。
// 起因：使用者回報「加載慢、目錄載入失敗」——canonical 目錄 12.9 MB（傳輸約 1.1 MB），在慢網路下被 15 秒整體時限砍掉。
// 這裡鎖住四件事：
//   1. 瘦身目錄＝canonical 去掉生活維度證據的票數與分佈，其餘逐欄相同；票數可由 evidence 省桶完整還原。
//   2. 引擎對瘦身目錄與 canonical 的結果完全相同（Function 以 canonical 重算，前端以瘦身目錄計算，兩邊必須一致）。
//   3. 瘦身目錄的體積上限（有人把票數加回來就會超）。
//   4. 載入路徑的規則：資料下載不設整體時限、失敗自動重試、字型不阻塞首繪且不用整檔、快取標頭存在。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import { gzipSync } from 'node:zlib'
import { allQuestions } from '../src/data/questions.ts'
import { candidateProvinceOptions, defaultCandidateProvince } from '../src/data/admissionAuthorities.ts'
import type { DimensionId } from '../src/data/dimensions.ts'
import { evidenceBucketFileByProvince } from '../src/data/evidenceProvinceBuckets.ts'
import type { ProgramIndexPayload } from '../src/data/programsTypes.ts'
import { SCHOOLS_CORE_FORMAT, decodeSchoolsCore, encodeSchoolsCore, toEvidenceCore } from '../src/data/runtimeCore.ts'
import type { EvidenceBucket, SchoolsCorePayload } from '../src/data/runtimeCore.ts'
import { runtimeDataManifest } from '../src/data/runtimeManifest.ts'
import type { CanonicalSchool, School } from '../src/data/schools.ts'
import { filterSchools, isHardFilterableQuality } from '../src/engine/filter.ts'
import type { AnswerMap, FilterContext, FilterResult } from '../src/engine/filter.ts'
import { DataLoadError, describeLoadError, fetchJson } from '../src/lib/fetchJson.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => fs.readFileSync(new URL(path, root))
const readText = (path: string) => read(path).toString('utf8')

const canonical = JSON.parse(readText('public/data/runtime/schools.json')) as CanonicalSchool[]
const coreBytes = read('public/data/runtime/schools.core.json')
const corePayload = JSON.parse(coreBytes.toString('utf8')) as SchoolsCorePayload
const core = decodeSchoolsCore(corePayload)
const programs = JSON.parse(readText('public/data/programs/index.json')) as ProgramIndexPayload

test('瘦身目錄：版本、格式、數量與 manifest 一致；位元組數與 manifest 記的相同', () => {
  assert.equal(corePayload.version, runtimeDataManifest.version)
  assert.equal(corePayload.format, SCHOOLS_CORE_FORMAT)
  assert.equal(runtimeDataManifest.schoolsCoreFormat, SCHOOLS_CORE_FORMAT)
  assert.equal(core.length, runtimeDataManifest.counts.schools)
  assert.equal(canonical.length, runtimeDataManifest.counts.schools)
  assert.equal(coreBytes.byteLength, runtimeDataManifest.schoolsCoreBytes)
  assert.equal(runtimeDataManifest.schoolsCorePath, '/data/runtime/schools.core.json')
  // canonical 路徑不變：Function 重算（functions/api/learning/[action].ts loadCanonicalSchools）仍讀它
  assert.equal(runtimeDataManifest.schoolsPath, '/data/runtime/schools.json')
})

test('瘦身目錄＝canonical 去掉票數：其餘欄位逐欄相同，最小證據與 canonical 一致', () => {
  let metas = 0
  for (const [index, full] of canonical.entries()) {
    const slim = core[index]
    const { qualityEvidence: fullEvidence, ...fullRest } = full
    const { qualityEvidence: coreEvidence, ...slimRest } = slim
    assert.deepEqual(slimRest, fullRest, full.name)
    assert.deepEqual(Object.keys(coreEvidence ?? {}), Object.keys(fullEvidence ?? {}), full.name)
    for (const [dimension, meta] of Object.entries(fullEvidence ?? {})) {
      metas += 1
      const slimMeta = coreEvidence![dimension as DimensionId]!
      assert.deepEqual(slimMeta, toEvidenceCore(meta!), `${full.name} ${dimension}`)
      // 瘦身目錄不帶票數（帶了就不是瘦身，體積會回到原樣）
      for (const key of ['sampleSize', 'winningVotes', 'classifiedSampleSize', 'unclassifiedResponses', 'valueCounts']) assert.equal(key in slimMeta, false, `${full.name} ${dimension} ${key}`)
    }
  }
  assert.ok(metas > 50000, `metas ${metas}`)
  assert.ok(corePayload.evidenceShapes.length <= 12, `shapes ${corePayload.evidenceShapes.length}`)
})

test('evidence 省桶：每所有證據的學校都能從自己省份的桶完整還原 canonical 的票數', () => {
  const files = new Set(Object.values(evidenceBucketFileByProvince))
  assert.equal(files.size, runtimeDataManifest.counts.evidenceBuckets)
  assert.deepEqual(fs.readdirSync(new URL('public/data/runtime/evidence/', root)).sort(), [...files].sort())
  const buckets = new Map<string, EvidenceBucket>()
  let restored = 0
  for (const school of canonical) {
    if (!school.qualityEvidence) continue
    const file = evidenceBucketFileByProvince[school.province]
    assert.ok(file, `${school.name} 的省份 ${school.province} 沒有 evidence 桶`)
    if (!buckets.has(file)) buckets.set(file, JSON.parse(readText(`public/data/runtime/evidence/${file}`)) as EvidenceBucket)
    assert.deepEqual(buckets.get(file)![school.moeCode!], school.qualityEvidence, school.name)
    restored += 1
  }
  assert.equal(restored, runtimeDataManifest.counts.evidenceSchools)
  // 桶裡沒有多出來的學校
  assert.equal([...buckets.values()].reduce((n, bucket) => n + Object.keys(bucket).length, 0), restored)
})

test('編碼是決定性的：由 canonical 重新編碼得到同一份瘦身目錄', () => {
  assert.equal(JSON.stringify(encodeSchoolsCore(canonical, runtimeDataManifest.version)), coreBytes.toString('utf8'))
})

test('硬篩選權：每所學校每個維度，瘦身目錄與 canonical 的判定相同', () => {
  let checked = 0
  for (const [index, full] of canonical.entries()) {
    for (const dimension of Object.keys(full.quality ?? {}) as DimensionId[]) {
      assert.equal(isHardFilterableQuality(core[index], dimension), isHardFilterableQuality(full as School, dimension), `${full.name} ${dimension}`)
      checked += 1
    }
  }
  assert.ok(checked > 40000, `checked ${checked}`)
})

function summarize(result: FilterResult) {
  return {
    kept: result.kept.map((school) => school.moeCode),
    excluded: result.excluded.map((entry) => ({ moeCode: entry.school.moeCode, reasons: entry.reasons })),
    stats: result.stats,
  }
}

function assertSameResult(answers: AnswerMap, ctx: FilterContext, label: string) {
  const fromCore = summarize(filterSchools(core, answers, ctx))
  const fromCanonical = summarize(filterSchools(canonical as School[], answers, ctx))
  assert.deepEqual(fromCore, fromCanonical, label)
  return fromCore.stats.excludedCount
}

// 決定性亂數（mulberry32）：隨機答卷每次跑都相同
function rng(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

test('引擎等價：每題每個選項單獨作答，瘦身目錄與 canonical 的保留／排除／理由／統計完全相同', () => {
  const ctx: FilterContext = { candidateProvince: defaultCandidateProvince, programs }
  let runs = 0
  let excludedTotal = 0
  for (const question of allQuestions) {
    for (const option of question.options) {
      const answers: AnswerMap = { [question.id]: question.type === 'single' ? option.key : [option.key] }
      excludedTotal += assertSameResult(answers, ctx, `${question.id}/${option.key}`)
      runs += 1
    }
    if (question.type !== 'single' && question.options.length > 1) {
      excludedTotal += assertSameResult({ [question.id]: question.options.map((option) => option.key) }, ctx, `${question.id}/all`)
      runs += 1
    }
  }
  assert.ok(runs > 150, `runs ${runs}`)
  assert.ok(excludedTotal > 10000, `排除總數 ${excludedTotal}（不是空跑）`)
})

test('引擎等價：決定性隨機答卷（多題、多省份、有無招生專業摘要），結果完全相同', () => {
  const random = rng(20261112)
  const provinces = [defaultCandidateProvince, ...candidateProvinceOptions.filter((_, index) => index % 6 === 0)]
  let nonTrivial = 0
  for (let round = 0; round < 60; round += 1) {
    const answers: AnswerMap = {}
    for (const question of allQuestions) {
      const roll = random()
      if (roll < 0.45) continue
      if (roll < 0.5) { answers[question.id] = 'skip'; continue }
      if (question.type === 'single') {
        answers[question.id] = question.options[Math.floor(random() * question.options.length)].key
      } else {
        const picked = question.options.filter(() => random() < 0.3).map((option) => option.key)
        if (picked.length > 0) answers[question.id] = picked
      }
    }
    const ctx: FilterContext = { candidateProvince: provinces[round % provinces.length], programs: round % 5 === 4 ? undefined : programs }
    if (assertSameResult(answers, ctx, `round ${round}`) > 0) nonTrivial += 1
  }
  assert.ok(nonTrivial >= 50, `nonTrivial ${nonTrivial}`)
})

test('體積上限：瘦身目錄 gzip 後不超過 300 KiB，且不到 canonical 的三分之一', () => {
  const coreGzip = gzipSync(coreBytes, { level: 6 }).byteLength
  const canonicalGzip = gzipSync(read('public/data/runtime/schools.json'), { level: 6 }).byteLength
  assert.ok(coreGzip <= 300 * 1024, `core gzip ${coreGzip}`)
  assert.ok(coreGzip * 3 < canonicalGzip, `core ${coreGzip} canonical ${canonicalGzip}`)
})

function walk(dir: URL, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir)
    if (entry.isDirectory()) walk(child, out)
    else if (/\.(ts|tsx|css)$/.test(entry.name)) out.push(child.pathname)
  }
  return out
}

test('載入規則：資料下載不設整體時限（一律走 fetchJson）；前端不讀 canonical 目錄', () => {
  const offenders: string[] = []
  for (const file of walk(new URL('src/', root))) {
    const source = fs.readFileSync(file, 'utf8')
    // trustedAPlus 的 /api/learning 請求是另一回事（有自己的逾時與復原機制），不在此列
    // fetchJson.ts 只在說明規則的註解裡提到它
    if (/AbortSignal\.timeout\(/.test(source) && !file.endsWith('/lib/trustedAPlus.ts') && !file.endsWith('/lib/fetchJson.ts')) offenders.push(file)
  }
  assert.deepEqual(offenders, [], '資料下載不要再用 AbortSignal.timeout 當整體時限')
  const loader = readText('src/lib/runtimeData.ts')
  assert.match(loader, /runtimeDataManifest\.schoolsCorePath/)
  assert.equal(/runtimeDataManifest\.schoolsPath/.test(loader), false, '瀏覽器不載 canonical schools.json')
})

test('字型規則：不引用整檔湖文明朝體；index.html 的字型樣式表不阻塞首繪', () => {
  for (const file of walk(new URL('src/', root))) {
    const source = fs.readFileSync(file, 'utf8')
    assert.equal(/url\([^)]*HuWenMingChaoTi\.woff/.test(source), false, `${file} 引用了整檔字型`)
  }
  const html = readText('index.html')
  const head = html.slice(0, html.indexOf('</head>')).replace(/<noscript>[\s\S]*?<\/noscript>/g, '').replace(/<!--[\s\S]*?-->/g, '')
  const sheets = [...head.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map((match) => match[0])
  assert.equal(sheets.length, 2)
  for (const tag of sheets) {
    assert.match(tag, /media="print"/, tag)
    assert.match(tag, /onload="this\.media='all'"/, tag)
  }
  assert.ok(sheets.some((tag) => tag.includes('https://mx.bdfz.net/fonts/huwen/v1/HuWenMingChao.4eeeeaf657.css')))
})

test('fetchJson：5xx 自動重試後成功；4xx 不重試；斷流逾時歸類為 stalled；錯誤轉成翻譯鍵', async () => {
  const previous = globalThis.fetch
  try {
    let calls = 0
    globalThis.fetch = async () => { calls += 1; return calls < 3 ? new Response('busy', { status: 503 }) : new Response('{"ok":true}', { status: 200 }) }
    assert.deepEqual(await fetchJson<{ ok: boolean }>('/x.json'), { ok: true })
    assert.equal(calls, 3)

    calls = 0
    globalThis.fetch = async () => { calls += 1; return new Response('missing', { status: 404 }) }
    await assert.rejects(fetchJson('/x.json'), (error: unknown) => error instanceof DataLoadError && error.kind === 'http' && error.status === 404)
    assert.equal(calls, 1)

    calls = 0
    globalThis.fetch = async () => { calls += 1; return new Response('{"cut":', { status: 200 }) }
    await assert.rejects(fetchJson('/x.json', { retries: 1 }), (error: unknown) => error instanceof DataLoadError && error.kind === 'parse')
    assert.equal(calls, 2)

    // 伺服器回了標頭之後就不再送資料：只有「這段時間完全沒資料」才放棄
    calls = 0
    globalThis.fetch = (async (_input: unknown, init?: { signal?: AbortSignal }) => {
      calls += 1
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"partial":'))
          init?.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')))
        },
      })
      return new Response(stream, { status: 200 })
    }) as typeof fetch
    const progress: number[] = []
    await assert.rejects(
      fetchJson('/x.json', { stallMs: 120, retries: 0, onProgress: ({ loaded }) => progress.push(loaded) }),
      (error: unknown) => error instanceof DataLoadError && error.kind === 'stalled',
    )
    assert.equal(calls, 1)
    assert.ok(progress.includes(11), `progress ${progress.join(',')}`)

    // 慢但一直有資料：總時間超過斷流時限也不會被砍
    globalThis.fetch = (async () => {
      const parts = ['{"a":', '[1,', '2,', '3', ']}']
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          for (const part of parts) { await new Promise((resolve) => setTimeout(resolve, 70)); controller.enqueue(new TextEncoder().encode(part)) }
          controller.close()
        },
      })
      return new Response(stream, { status: 200 })
    }) as typeof fetch
    assert.deepEqual(await fetchJson<{ a: number[] }>('/x.json', { stallMs: 150, retries: 0 }), { a: [1, 2, 3] })

    assert.deepEqual(describeLoadError(new DataLoadError('stalled', 'x')), { key: 'ui.data.error.network' })
    assert.deepEqual(describeLoadError(new DataLoadError('http', 'x', 503)), { key: 'ui.data.error.server', params: { status: 503 } })
    assert.deepEqual(describeLoadError(new DataLoadError('offline', 'x')), { key: 'ui.data.error.offline' })
    assert.deepEqual(describeLoadError(new DataLoadError('parse', 'x')), { key: 'ui.data.error.incomplete' })
    assert.equal(describeLoadError(new Error('other')), null)
    const zhHant = JSON.parse(readText('src/i18n/locales/zh-Hant.json')) as Record<string, string>
    for (const key of ['ui.data.error.network', 'ui.data.error.server', 'ui.data.error.offline', 'ui.data.error.incomplete', 'ui.app.catalogProgress', 'ui.app.catalogRetrying']) assert.ok(zhHant[key], key)
  } finally {
    globalThis.fetch = previous
  }
})
