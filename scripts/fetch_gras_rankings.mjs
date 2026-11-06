#!/usr/bin/env node
// 抓取軟科世界一流學科排名（GRAS）公開頁面的靜態資料，寫成倉庫內的 CSV。
//
//   node scripts/fetch_gras_rankings.mjs --year 2026                 # 直接從 shanghairanking.com 抓
//   node scripts/fetch_gras_rankings.mjs --year 2026 --cache-dir DIR  # 先用 DIR 裡已下載的 <code>.js，缺的才抓
//
// 產出：
//   data/research/gras_<year>_subjects.csv   57 個學科：代碼、門類、英文名、軟科中文站簡體名、本站正體名
//   data/research/gras_<year>_top50.csv      每科前 50：名次、機構代碼、英文名、地區、總分、來源頁
//
// 來源形態：Nuxt 全靜態 payload（__NUXT_JSONP__("/rankings/gras/<year>/<code>", (function(a,b,...){...})(...)))。
// 它是外部送來的 JavaScript，所以一律在沒有 require／process 的 vm 沙箱裡執行，只取回傳物件。
// 靜態 build id 會變：先讀年度索引頁找 /_nuxt/static/<id>/，再組 payload 網址。
//
// 學科中文名：簡體名抄自軟科中文站同年索引頁（www.shanghairanking.cn/rankings/gras/<year>），
// 正體名由本站只轉字形不換用詞（見 feedback：繁簡只轉字形）。新增學科時兩欄都要補，否則 fail closed。

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter(Boolean))
const year = Number(args.year || 2026)
const cacheDir = args['cache-dir'] ? String(args['cache-dir']) : null
const TOP_N = 50
const HOST = 'https://www.shanghairanking.com'
const UA = 'nope.bdfz.net data pipeline (non-commercial; contact nope@bdfz.net)'

// 門類與學科名：簡體 = 軟科中文站原文；正體 = 本站字形轉換。
const FAMILY_ZH = {
  AS01: { hans: '理学', hant: '理學', en: 'Natural Sciences' },
  AS02: { hans: '工学', hant: '工學', en: 'Engineering' },
  AS03: { hans: '生命科学', hant: '生命科學', en: 'Life Sciences' },
  AS04: { hans: '医学', hant: '醫學', en: 'Medical Sciences' },
  AS05: { hans: '社会科学', hant: '社會科學', en: 'Social Sciences' },
}
const SUBJECT_ZH = {
  AS0101: ['数学', '數學'], AS0102: ['物理学', '物理學'], AS0103: ['化学', '化學'], AS0104: ['地球科学', '地球科學'],
  AS0105: ['地理学', '地理學'], AS0106: ['生态学', '生態學'], AS0107: ['海洋科学', '海洋科學'], AS0108: ['大气科学', '大氣科學'],
  AS0201: ['机械工程', '機械工程'], AS0202: ['电力电子工程', '電力電子工程'], AS0205: ['控制科学与工程', '控制科學與工程'],
  AS0206: ['通信工程', '通信工程'], AS0207: ['仪器科学', '儀器科學'], AS0208: ['生物医学工程', '生物醫學工程'],
  AS0210: ['计算机科学与工程', '計算機科學與工程'], AS0211: ['土木工程', '土木工程'], AS0212: ['化学工程', '化學工程'],
  AS0213: ['材料科学与工程', '材料科學與工程'], AS0214: ['纳米科学与技术', '納米科學與技術'], AS0215: ['能源科学与工程', '能源科學與工程'],
  AS0216: ['环境科学与工程', '環境科學與工程'], AS0217: ['水资源工程', '水資源工程'], AS0219: ['食品科学与工程', '食品科學與工程'],
  AS0220: ['生物工程', '生物工程'], AS0221: ['航空航天工程', '航空航天工程'], AS0222: ['船舶与海洋工程', '船舶與海洋工程'],
  AS0223: ['交通运输工程', '交通運輸工程'], AS0224: ['遥感技术', '遙感技術'], AS0226: ['矿业工程', '礦業工程'],
  AS0227: ['冶金工程', '冶金工程'], AS0228: ['纺织科学与工程', '紡織科學與工程'], AS0229: ['人工智能', '人工智能'],
  AS0230: ['机器人科学与工程', '機器人科學與工程'],
  AS0301: ['生物学', '生物學'], AS0302: ['基础医学', '基礎醫學'], AS0303: ['农学', '農學'], AS0304: ['兽医学', '獸醫學'],
  AS0401: ['临床医学', '臨床醫學'], AS0402: ['公共卫生', '公共衛生'], AS0403: ['口腔医学', '口腔醫學'], AS0404: ['护理学', '護理學'],
  AS0405: ['医学技术', '醫學技術'], AS0406: ['药学', '藥學'],
  AS0501: ['经济学', '經濟學'], AS0502: ['统计学', '統計學'], AS0503: ['法学', '法學'], AS0504: ['政治学', '政治學'],
  AS0505: ['社会学', '社會學'], AS0506: ['教育学', '教育學'], AS0507: ['新闻传播学', '新聞傳播學'], AS0508: ['心理学', '心理學'],
  AS0509: ['工商管理', '工商管理'], AS0510: ['金融学', '金融學'], AS0511: ['管理学', '管理學'], AS0512: ['公共管理', '公共管理'],
  AS0513: ['旅游休闲管理', '旅遊休閒管理'], AS0515: ['图书情报科学', '圖書情報科學'],
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(45000) })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.text()
}

function parseNuxtPayload(source, file) {
  let captured = null
  const context = vm.createContext({ __NUXT_JSONP__: (route, data) => { captured = { route, data } } })
  vm.runInContext(source, context, { timeout: 5000, filename: file })
  if (!captured?.data?.data?.[0]) throw new Error(`payload shape unexpected: ${file}`)
  return captured.data.data[0]
}

async function loadPayload(buildId, pathname, cacheName) {
  const cached = cacheDir ? join(cacheDir, cacheName) : null
  if (cached && existsSync(cached)) return parseNuxtPayload(readFileSync(cached, 'utf8'), cached)
  const url = `${HOST}/_nuxt/static/${buildId}/rankings/gras/${year}${pathname}/payload.js`
  const text = await fetchText(url)
  if (cached) { mkdirSync(dirname(cached), { recursive: true }); writeFileSync(cached, text) }
  await new Promise((r) => setTimeout(r, 400))
  return parseNuxtPayload(text, url)
}

function csvCell(value) {
  const text = value === undefined || value === null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
function csv(rows, header) {
  return [header.join(','), ...rows.map((row) => header.map((key) => csvCell(row[key])).join(','))].join('\n') + '\n'
}

async function main() {
  const indexHtml = await fetchText(`${HOST}/rankings/gras/${year}`)
  const buildId = /\/_nuxt\/static\/(\d+)\//.exec(indexHtml)?.[1]
  if (!buildId) throw new Error('cannot find nuxt static build id on the GRAS index page')
  const index = await loadPayload(buildId, '', `index-${year}.js`)
  if (Number(index.year) !== year) throw new Error(`index payload year ${index.year} != ${year}`)

  const subjects = []
  for (const family of index.subjData) {
    const fz = FAMILY_ZH[family.code]
    if (!fz) throw new Error(`unknown family ${family.code} ${family.nameEn}: add it to FAMILY_ZH first`)
    for (const subject of family.detail) {
      const zh = SUBJECT_ZH[subject.code]
      if (!zh) throw new Error(`unknown subject ${subject.code} ${subject.nameEn}: add both Chinese names to SUBJECT_ZH first`)
      subjects.push({
        subjectCode: subject.code, familyCode: family.code, familyNameEn: family.nameEn, familyNameZhHant: fz.hant,
        subjectNameEn: subject.nameEn, subjectNameZhHans: zh[0], subjectNameZhHant: zh[1],
        sourceUrl: `${HOST}/rankings/gras/${year}/${subject.code}`,
      })
    }
  }

  const rows = []
  for (const subject of subjects) {
    const payload = await loadPayload(buildId, `/${subject.subjectCode}`, `${subject.subjectCode}.js`)
    if (payload.code !== subject.subjectCode || Number(payload.year) !== year) {
      throw new Error(`payload mismatch for ${subject.subjectCode}: ${payload.code} ${payload.year}`)
    }
    const list = payload.univList
    if (!Array.isArray(list) || list.length < TOP_N) throw new Error(`${subject.subjectCode}: univList too short (${list?.length})`)
    for (const entry of list.slice(0, TOP_N)) {
      const rank = Number(entry.ranking)
      if (!Number.isInteger(rank) || rank < 1 || rank > TOP_N) throw new Error(`${subject.subjectCode}: unexpected rank ${entry.ranking}`)
      if (!entry.univCode || !entry.univNameEn || !entry.region) throw new Error(`${subject.subjectCode}: incomplete row ${JSON.stringify(entry)}`)
      rows.push({
        subjectCode: subject.subjectCode, rank, univCode: entry.univCode, univNameEn: entry.univNameEn.trim(), univUp: entry.univUp || '',
        region: entry.region, score: entry.score ?? '', sourceUrl: subject.sourceUrl,
      })
    }
    process.stdout.write(`${subject.subjectCode} ${subject.subjectNameEn}: ${TOP_N} rows\n`)
  }

  const fetchedAt = new Date().toISOString().slice(0, 10)
  const outDir = join(root, 'data', 'research')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, `gras_${year}_subjects.csv`), csv(
    subjects.map((s) => ({ ...s, rankingYear: year, fetchedAt })),
    ['subjectCode', 'familyCode', 'familyNameEn', 'familyNameZhHant', 'subjectNameEn', 'subjectNameZhHans', 'subjectNameZhHant', 'rankingYear', 'sourceUrl', 'fetchedAt'],
  ))
  writeFileSync(join(outDir, `gras_${year}_top50.csv`), csv(
    rows.map((r) => ({ ...r, rankingYear: year, fetchedAt })),
    ['subjectCode', 'rank', 'univCode', 'univNameEn', 'univUp', 'region', 'score', 'rankingYear', 'sourceUrl', 'fetchedAt'],
  ))
  const institutions = new Set(rows.map((r) => r.univCode))
  console.log(`wrote ${subjects.length} subjects, ${rows.length} rows, ${institutions.size} institutions (build ${buildId})`)
}

await main()
