#!/usr/bin/env node
// S1 資料層：官方來源下載與雜湊核對（fail closed）。
//
//   node scripts/fetch_s1_sources.mjs                       # 核對 data/research/raw/s1/ 內已入庫原檔；external 大檔缺少時下載到 --cache-dir
//   node scripts/fetch_s1_sources.mjs --offline             # 只核對，不碰網路；缺檔直接失敗
//   node scripts/fetch_s1_sources.mjs --repin               # 補登缺少的 sha256／bytes／fetchedAt（只對尚未釘定的來源；已釘定的不符仍失敗）
//   node scripts/fetch_s1_sources.mjs --cache-dir DIR       # external 來源的存放目錄（預設 .tmp/s1-sources，已在 .gitignore）
//   node scripts/fetch_s1_sources.mjs --from-r2              # external 大檔改從既有 R2 桶取回（rclone 遠端 r2:，registry 的 r2 欄），不打原網站
//
// 來源清單：data/research/s1_sources.json。每條 store=committed 的原檔入庫在 data/research/raw/s1/，
// store=external 的只釘 SHA-256／大小／來源網址。任何已釘雜湊不符都 exit 1——這一層的失效模式是
// 上游悄悄換檔，而我們的 CSV 看起來一切正常。只抓官方／權威來源，不用 AI 生成資料，不付費。

import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2).filter((a) => a.startsWith('--') && !['--cache-dir'].includes(a)))
const cacheDirArg = process.argv.indexOf('--cache-dir')
const cacheDir = resolve(cacheDirArg >= 0 ? process.argv[cacheDirArg + 1] : join(root, '.tmp', 's1-sources'))
const offline = args.has('--offline')
const fromR2 = args.has('--from-r2')
const repin = args.has('--repin')
const registryPath = join(root, 'data', 'research', 's1_sources.json')
const committedDir = join(root, 'data', 'research', 'raw', 's1')

const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

function localPath(source) {
  return source.store === 'committed' ? join(committedDir, source.file) : join(cacheDir, source.file)
}

async function download(source) {
  const headers = { 'User-Agent': registry.userAgent, Accept: '*/*' }
  if (source.referer) headers.Referer = source.referer
  let lastError = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(source.fileUrl, { headers, redirect: 'follow', signal: AbortSignal.timeout(180000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const type = res.headers.get('content-type') || ''
      const buf = Buffer.from(await res.arrayBuffer())
      // 政府網站常把 404／驗證頁包成 200 text/html 回來；非 html 來源收到 html 就算失敗。
      if (source.format !== 'html' && /text\/html/i.test(type) && !/^%PDF|^PK|^\xD0\xCF/.test(buf.subarray(0, 4).toString('latin1'))) {
        throw new Error(`expected ${source.format}, got ${type} (${buf.length} bytes)`)
      }
      return buf
    } catch (error) {
      lastError = error
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)))
    }
  }
  throw lastError
}

const problems = []
const report = []
let changed = false

for (const source of registry.sources) {
  const target = localPath(source)
  let buf = null
  let origin = 'local'
  if (existsSync(target)) {
    buf = readFileSync(target)
  } else if (offline) {
    problems.push(`${source.id}: 缺少 ${target}（--offline 不下載）`)
    continue
  } else if (fromR2 && source.r2) {
    // 原檔已上既有私密桶；rclone 遠端 r2: 由工作站既有設定提供（不在倉庫）。
    mkdirSync(dirname(target), { recursive: true })
    const out = spawnSync('rclone', ['copyto', `r2:${source.r2.bucket}/${source.r2.key}`, target], { encoding: 'utf8' })
    if (out.status !== 0 || !existsSync(target)) { problems.push(`${source.id}: R2 取回失敗 r2:${source.r2.bucket}/${source.r2.key} — ${(out.stderr || out.error?.message || '').trim().slice(0, 160)}`); continue }
    buf = readFileSync(target)
    origin = 'r2'
  } else {
    try {
      buf = await download(source)
      origin = 'downloaded'
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, buf)
    } catch (error) {
      problems.push(`${source.id}: 下載失敗 ${source.fileUrl} — ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
  }
  const digest = sha256(buf)
  if (source.sha256) {
    if (digest !== source.sha256) {
      problems.push(`${source.id}: SHA-256 不符（檔案 ${digest.slice(0, 16)}…，釘定 ${source.sha256.slice(0, 16)}…）。上游換檔了：先人工比對，再用新檔重跑 build 並更新釘定。`)
      continue
    }
    if (source.bytes && source.bytes !== buf.length) {
      problems.push(`${source.id}: 大小不符（${buf.length} vs ${source.bytes}）`)
      continue
    }
  } else if (repin) {
    source.sha256 = digest
    source.bytes = buf.length
    source.fetchedAt = new Date().toISOString().slice(0, 10)
    changed = true
  } else {
    problems.push(`${source.id}: 尚未釘定 sha256；用 --repin 補登（先確認檔案就是來源頁上的那一份）`)
    continue
  }
  if (origin === 'downloaded' && !source.fetchedAt) { source.fetchedAt = new Date().toISOString().slice(0, 10); changed = true }
  report.push(`${origin === 'downloaded' ? 'GET ' : origin === 'r2' ? 'R2  ' : 'ok  '} ${source.id.padEnd(30)} ${String(buf.length).padStart(9)} B  ${source.store === 'committed' ? 'committed' : 'external '}  ${digest.slice(0, 12)}`)
}

for (const line of report) console.log(line)
if (changed) {
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`)
  console.log(`updated ${registryPath}`)
}
if (problems.length > 0) {
  console.error('\nS1 來源核對失敗：')
  for (const problem of problems) console.error(`- ${problem}`)
  process.exit(1)
}
const external = registry.sources.filter((s) => s.store === 'external').length
console.log(`\nS1 sources verified: ${registry.sources.length} (committed ${registry.sources.length - external}, external ${external} in ${cacheDir})`)
