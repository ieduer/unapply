#!/usr/bin/env node
// S2 前半（批 D2）：教育部中外合作辦學監管工作信息平台（www.crs.jsj.edu.cn）名單與詳情頁抓取（可重跑、可續抓、禮貌限速）。
//
//   node scripts/fetch_joint_programs.mjs --cache-dir DIR [--delay-ms 2500] [--lists-only]
//
// 抓什麼：/aproval/orglists/1（本科層次名單）、/aproval/orglists/2（碩士及以上）、/aproval/getbyarea/1..31（各省名單，含「機構／項目」與「中外／內地與港澳台」分類），
// 以及名單裡每個 /aproval/detail/<id> 詳情頁。全部存成 HTML 原檔（list_*.html、<id>.html），由 build_joint_programs.mjs 解析。
// 站方對同一出口約每 500 次請求重置連線（2026-11-07 實測），所以預設 2.5 秒一請求、失敗退避 30/90/300/600 秒，連續 6 次失敗停止；再跑會從缺的補起。
// 只抓官方網域、不用 AI、不付費、不繞任何驗證。

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const argv = process.argv.slice(2)
const argValue = (flag, fallback) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : fallback }
const cacheDir = resolve(argValue('--cache-dir', '.tmp/crs'))
const delayMs = Number(argValue('--delay-ms', '2500'))
const listsOnly = argv.includes('--lists-only')
const UA = 'Mozilla/5.0 (compatible; nope.bdfz.net data pipeline; contact nope@bdfz.net)'
const BASE = 'https://www.crs.jsj.edu.cn'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(cacheDir, { recursive: true })

function get(url) {
  return execFileSync('curl', ['-sS', '-L', '--max-time', '40', '-A', UA, url], { maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
}
async function fetchTo(file, url, expect) {
  const path = join(cacheDir, file)
  if (existsSync(path) && readFileSync(path).length > 3000) return 'cached'
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const buf = get(url)
      if (buf.length > 3000 && expect.test(buf.toString('utf8'))) { writeFileSync(path, buf); return 'fetched' }
      console.log('unexpected body', file, buf.length); return 'unexpected'
    } catch { const wait = [30000, 90000, 300000, 600000][attempt]; console.log('fail', file, 'attempt', attempt, 'wait', wait / 1000, 's'); await sleep(wait) }
  }
  return 'failed'
}

const lists = [['list_orglists_1.html', `${BASE}/aproval/orglists/1`], ['list_orglists_2.html', `${BASE}/aproval/orglists/2`], ...Array.from({ length: 31 }, (_, i) => [`list_getbyarea_${i + 1}.html`, `${BASE}/aproval/getbyarea/${i + 1}`])]
for (const [file, url] of lists) { const r = await fetchTo(file, url, /aproval\/detail\//); if (r === 'fetched') await sleep(delayMs) }
if (listsOnly) process.exit(0)
const ids = new Set()
for (const f of readdirSync(cacheDir).filter((f) => f.startsWith('list_'))) for (const m of readFileSync(join(cacheDir, f), 'utf8').matchAll(/aproval\/detail\/(\d+)/g)) ids.add(Number(m[1]))
const todo = [...ids].sort((a, b) => a - b)
console.log('detail ids', todo.length, 'cached', todo.filter((id) => existsSync(join(cacheDir, `${id}.html`))).length)
let fail = 0, consecutive = 0, n = 0
for (const id of todo) {
  const r = await fetchTo(`${id}.html`, `${BASE}/aproval/detail/${id}`, /批准书编号|许可证编号/)
  if (r === 'cached') continue
  n += 1
  if (r === 'fetched') consecutive = 0; else { fail += 1; consecutive += 1; if (consecutive >= 6) { console.log('giving up after 6 consecutive failures; rerun later'); break } }
  if (n % 100 === 0) console.log('fetched', n, 'fail', fail, new Date().toISOString())
  await sleep(delayMs)
}
console.log('done', { fetched: n, fail, total: todo.length, cached: todo.filter((id) => existsSync(join(cacheDir, `${id}.html`))).length })
