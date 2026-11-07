#!/usr/bin/env node
// S1 首批資料覆蓋率與缺口稽核（只讀，不改資料）。
//
//   node scripts/audit_s1_programs.mjs [--out DIR] [--scope dfc|all]   # 印出摘要；--out 時另寫 s1-audit[-all].md 與 .json
//   --scope all 讀 program_offerings.2027.all.csv.gz（全部 2,952 校、本科＋專科），另按教育部層次算本科校／專科校覆蓋。
//
// 看什麼：
//   1. 雙一流集合（教育部 2026 主池內 144 所）每所是否都有本科招生專業清單，幾個省表列到它，專業數分佈。
//   2. 選考要求覆蓋：每條專業都有要求（含「不提科目要求」）；跨省不一致的條數（必須為 0 才能進任何篩選）。
//   3. 專業→國標目錄對應率：code／name／class／none；none 的名稱清單供人工覆核。
//   4. 「選科組合 → 全校無一可報專業」的模擬：3+1+2 的 12 種與 3+3 的 20 種組合各會讓多少所雙一流校一個專業都報不了。
//      這是判斷「選科題有沒有減法能力」的直接證據；數字小不代表做錯，代表這一題在雙一流層幾乎不排除學校。
//   5. 來源層缺口：各省表對不到教育部主表的院校、校名不一致（多為更名）、校區／醫學院映射。

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const outIndex = argv.indexOf('--out')
const outDir = outIndex >= 0 ? resolve(argv[outIndex + 1]) : null
const scopeIndex = argv.indexOf('--scope')
const scope = scopeIndex >= 0 ? argv[scopeIndex + 1] : 'dfc'
const suffix = scope === 'all' ? '.all' : ''
const researchDir = join(root, 'data', 'research')

function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1 } else if (ch === '"') quoted = false; else cell += ch }
    else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [header, ...body] = rows
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])))
}
const count = (items, key) => { const m = new Map(); for (const it of items) { const k = key(it); m.set(k, (m.get(k) ?? 0) + 1) } return [...m.entries()].sort((a, b) => b[1] - a[1]) }
const pct = (a, b) => (b === 0 ? '—' : `${((a / b) * 100).toFixed(1)}%`)

const offerings = parseCsv(scope === 'all' ? gunzipSync(readFileSync(join(researchDir, 'program_offerings.2027.all.csv.gz'))).toString('utf8') : readFileSync(join(researchDir, 'program_offerings.2027.csv'), 'utf8'))
const summary = parseCsv(readFileSync(join(researchDir, `program_offerings_summary.2027${suffix}.csv`), 'utf8'))
const strongBase = parseCsv(readFileSync(join(researchDir, 'strong_base_schools.2026.csv'), 'utf8'))
const catalog = parseCsv(readFileSync(join(researchDir, 'bk_catalog.2026.csv'), 'utf8'))
const meta = JSON.parse(readFileSync(join(researchDir, `program_offerings.2027${suffix}.meta.json`), 'utf8'))
const undergradOfferings = offerings.filter((r) => (r.level || '本科') === '本科')
const registry = JSON.parse(readFileSync(join(researchDir, 's1_sources.json'), 'utf8'))
const { officialSchools } = await import(pathToFileURL(join(root, 'src', 'data', 'officialSchools.ts')).href)
const byMoeCode = new Map(officialSchools.map((s) => [s.moeCode, s]))

const problems = []
const lines = []
const out = (s = '') => lines.push(s)

// 1. 雙一流覆蓋
const scopeTotal = meta.doubleFirstClass.inPool
const dfcSummary = scope === 'all' ? summary.filter((r) => ['C9', '985非C9', '211非985', '雙一流非211'].includes(r.moeLevel)) : summary
const covered = dfcSummary.filter((r) => Number(r.undergraduateCount ?? r.programCount) > 0).length
out(`# S1 資料稽核（${meta.generatedAt.slice(0, 10)}，scope=${scope}）`)
out()
if (scope === 'all') {
  const undergrad = officialSchools.filter((s) => s.moeLevel === '本科')
  const vocational = officialSchools.filter((s) => s.moeLevel !== '本科')
  const summaryByCode = new Map(summary.map((r) => [r.moeCode, r]))
  const uCovered = undergrad.filter((s) => Number(summaryByCode.get(s.moeCode)?.undergraduateCount ?? 0) > 0)
  const vCovered = vocational.filter((s) => Number(summaryByCode.get(s.moeCode)?.vocationalCount ?? 0) > 0)
  out(`## 0. 全部主池覆蓋（按教育部層次）`)
  out()
  out(`- 本科校 ${undergrad.length}：有本科招生專業清單 ${uCovered.length}（${pct(uCovered.length, undergrad.length)}）；缺 ${undergrad.length - uCovered.length} 校（分類與全名單見下）。`)
  out(`- 專科校 ${vocational.length}：有高職（專科）專業清單 ${vCovered.length}（${pct(vCovered.length, vocational.length)}）；缺 ${vocational.length - vCovered.length} 校（多為只在湖北／江蘇／浙江表外招生或當年未在三省安排計劃；保持未知）。`)
  out(`- 本科校另有專科專業列 ${undergrad.filter((s) => Number(summaryByCode.get(s.moeCode)?.vocationalCount ?? 0) > 0).length} 校；專科列全部不對本科目錄（programKind=vocational），只展示不判定。`)
  out(`- 條數：本科 ${meta.counts.undergraduateOfferings}、專科 ${meta.counts.vocationalOfferings}；跨省衝突 ${meta.counts.conflicts}。`)
  // 缺清單不是阻塞：疑罪從無，缺的保持未知。這裡把缺口分類，給人工查核清單用。
  const missing = undergrad.filter((s) => !uCovered.includes(s))
  const kind = (s) => {
    const n = s.nameSimplified ?? s.name
    if (/职业/.test(n)) return '職業大學／職業技術大學（本科層次職業學校，專業多以高職目錄公布）'
    if (/警察|公安|刑事|司法警官/.test(n)) return '警察／公安類（提前批、不在省表）'
    if (/学院$/.test(n) && /大学.+学院|学院.+学院/.test(n)) return '獨立學院（多已轉設或更名，省表用舊名／舊代碼）'
    if (/军|武警|海军|空军|火箭|国防/.test(n)) return '軍事類'
    return '其他（當年未在四省安排計劃、更名未對上或合作辦學）'
  }
  const byKind = count(missing, kind)
  out(`- 缺口分類（供人工查核，不猜填）：${byKind.map(([k, v]) => `${k} ${v}`).join('；')}。`)
  out(`- 缺口全名單：${missing.map((s) => s.nameSimplified ?? s.name).join('、')}。`)
  out()
}
out(`## 1. 雙一流覆蓋`)
out()
out(`- 第二輪雙一流 ${meta.doubleFirstClass.round2Total} 所；教育部 2026 普通高校主池內 ${meta.doubleFirstClass.inPool} 所（主池外：${meta.doubleFirstClass.outsidePool.join('、')}；別名：${Object.entries(meta.doubleFirstClass.aliases).map(([a, b]) => `${a}→${b}`).join('、')}）。`)
out(`- 有本科招生專業清單的：${covered}/${scopeTotal}（${pct(covered, scopeTotal)}）。`)
if (covered !== scopeTotal) problems.push(`雙一流只覆蓋 ${covered}/${scopeTotal}`)
const provinceCountDist = count(dfcSummary, (r) => r.provinceCount).sort((a, b) => Number(b[0]) - Number(a[0]))
out(`- 被幾個省表列到：${provinceCountDist.map(([k, v]) => `${k} 省 ${v} 校`).join('；')}。`)
const programCounts = dfcSummary.map((r) => Number(r.undergraduateCount ?? r.programCount)).sort((a, b) => a - b)
out(`- 每校本科專業（類）數：最少 ${programCounts[0]}、中位 ${programCounts[Math.floor(programCounts.length / 2)]}、最多 ${programCounts[programCounts.length - 1]}；本層合計 ${offerings.length} 條。`)
const thin = dfcSummary.filter((r) => Number(r.undergraduateCount ?? r.programCount) < 15)
out(`- 專業數少於 15 的學校（通常是專科性院校或只在少數省招生）：${thin.map((r) => `${r.schoolName} ${r.programCount}`).join('、') || '無'}。`)
const withCampus = dfcSummary.filter((r) => r.campusLabels)
out(`- 含校區／醫學院獨立招生代碼映射的學校：${withCampus.length} 所（${withCampus.map((r) => `${r.schoolName}[${r.campusLabels}]`).join('、')}）。`)
out()

// 2. 選考要求
out(`## 2. 選考科目要求`)
out()
const conflicts = offerings.filter((r) => r.conflict)
out(`- 有要求（含「不提科目要求」）的條數：${offerings.filter((r) => r.requirementPattern).length}/${offerings.length}；跨省不一致：${conflicts.length} 條。`)
if (conflicts.length > 0) problems.push(`${conflicts.length} 條跨省要求不一致`)
out(`- 要求分佈：${count(offerings, (r) => r.requirementPattern || 'conflict').map(([k, v]) => `${k} ${v}`).join('；')}。`)
out(`- 可信度：${count(offerings, (r) => r.confidence).map(([k, v]) => `${k} ${v}`).join('；')}（high＝兩個以上省表一致）。`)
const variants = offerings.filter((r) => r.requirementVariants)
out(`- 浙江版另含「技术」科目的條數：${variants.length}（${[...new Set(variants.map((r) => r.schoolName))].join('、')}）。`)
out()

// 3. 目錄對應
out(`## 3. 國標本科專業目錄對應`)
out()
const matchDist = count(undergradOfferings, (r) => r.catalogMatch)
out(`- 目錄 2026：${catalog.length} 種專業。本科條目對應方式：${matchDist.map(([k, v]) => `${k} ${v}（${pct(v, undergradOfferings.length)}）`).join('；')}。`)
const unmatched = count(undergradOfferings.filter((r) => r.catalogMatch === 'none'), (r) => `${r.programKind}:${r.programNameBase}`)
out(`- 對不到目錄的名稱（前 40，按出現校數）：${unmatched.slice(0, 40).map(([k, v]) => `${k.split(':')[1]}×${v}`).join('、')}。`)
out(`- 其中試驗班／實驗班類 ${undergradOfferings.filter((r) => r.programKind === 'experimental').length} 條、其他 ${undergradOfferings.filter((r) => r.programKind === 'other').length} 條。`)
out()

// 4. 選科組合模擬
out(`## 4. 選科組合模擬（學校層）`)
out()
const SUBJ = 'PCBZHG'
const combos312 = []
for (const first of ['P', 'H']) for (let i = 0; i < 4; i += 1) for (let j = i + 1; j < 4; j += 1) combos312.push(first + 'CBZG'[i] + 'CBZG'[j])
const combos33 = []
for (let a = 0; a < 6; a += 1) for (let b = a + 1; b < 6; b += 1) for (let c = b + 1; c < 6; c += 1) combos33.push(SUBJ[a] + SUBJ[b] + SUBJ[c])
const bySchool = new Map()
for (const r of undergradOfferings) (bySchool.get(r.moeCode) ?? bySchool.set(r.moeCode, []).get(r.moeCode)).push(r)
const ZH = { P: '物', C: '化', B: '生', Z: '政', H: '史', G: '地' }
function simulate(combos) {
  return combos.map((combo) => {
    const chosen = new Set(combo)
    let zero = 0; const zeroNames = []
    for (const [code, rows] of bySchool) {
      const ok = rows.some((r) => r.requirementPattern && r.requirementPattern !== '' && [...(r.requirementPattern === 'none' ? '' : r.requirementPattern)].every((s) => chosen.has(s)))
      if (!ok) { zero += 1; zeroNames.push(byMoeCode.get(code)?.nameSimplified ?? code) }
    }
    const share = bySchool.size ? offerings.filter((r) => r.requirementPattern && [...(r.requirementPattern === 'none' ? '' : r.requirementPattern)].every((s) => chosen.has(s))).length : 0
    return { combo: [...combo].map((s) => ZH[s]).join(''), schoolsWithNoProgram: zero, zeroNames, programsOpen: share }
  })
}
const sim312 = simulate(combos312), sim33 = simulate(combos33)
out(`- 3+1+2（${combos312.length} 種）：各組合「全校沒有一個可報本科專業」的校數（本層 ${bySchool.size} 校）——${sim312.map((s) => `${s.combo} ${s.schoolsWithNoProgram}`).join('；')}。`)
out(`- 3+3（${combos33.length} 種）：${sim33.map((s) => `${s.combo} ${s.schoolsWithNoProgram}`).join('；')}。`)
out(`- 可報本科專業條數（${undergradOfferings.length} 條基數）：${sim312.map((s) => `${s.combo} ${s.programsOpen}`).join('；')}。`)
const everZero = new Set(sim312.flatMap((s) => s.zeroNames))
out(`- 在任一 3+1+2 組合下會被整校劃掉的學校：${everZero.size}（${[...everZero].slice(0, 40).join('、')}${everZero.size > 40 ? '…' : ''}）。`)
out()

// 5. 來源層缺口
out(`## 5. 來源層缺口與需人工覆核`)
out()
for (const [id, info] of Object.entries(meta.sources)) {
  const src = registry.sources.find((s) => s.id === id)
  const un = meta.unmatchedSchoolNames[id] ?? []
  const civilian = un.filter((n) => !/^9\d{4}|陆军|海军|空军|火箭军|武警|军事|国防/.test(n))
  out(`- ${src.province} ${src.admissionYear}（${src.publisher}，${src.publishedDate}）：本科 ${info.undergraduateRows} 列、${info.undergraduateSchools} 校；對不到教育部主表 ${un.length} 校，其中非軍校 ${civilian.length}：${civilian.join('、') || '無'}。`)
}
out(`- 校名與教育部 2026 不一致（省表為 2025 年 2 月口徑，多為其後更名）：${meta.nameMismatches.length} 條；前 12：${meta.nameMismatches.slice(0, 12).map((s) => s.replace(/^[^:]+: /, '')).join('；')}。`)
const campusTotal = Object.values(meta.campusMappings).reduce((a, m) => a + Object.keys(m).length, 0)
out(`- 校區／醫學院／分校招生代碼映射回母校：${campusTotal} 條（各省表合計）。`)
out()

// 6. 強基
out(`## 6. 強基計劃名單`)
out()
out(`- ${strongBase.length} 所：教育部 2020 名單 ${strongBase.filter((r) => r.evidenceYear === '2020').length}、2022 增列 ${strongBase.filter((r) => r.listedSince === '2022').length}；主池外 ${strongBase.filter((r) => r.inMoePool === 'no').map((r) => r.schoolName).join('、')}。`)
out()

out(`## 7. 結論`)
out()
out(problems.length ? `- 阻塞：${problems.join('；')}` : `- 無阻塞：雙一流 ${covered}/${scopeTotal} 校皆有專業清單與選考要求；跨省要求 0 衝突。`)
out(`- 本層以「起點條件」（AnswerMap 之外）接入；成為正式題目（S1.b）前要走 docs/DESIGN_S1_PROGRAMS_ADMISSION.md §6 的閘門與共享契約 fan-out。`)

const text = `${lines.join('\n')}\n`
process.stdout.write(text)
if (outDir) {
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, `s1-audit${scope === 'all' ? '-all' : ''}.md`), text)
  writeFileSync(join(outDir, `s1-audit${scope === 'all' ? '-all' : ''}.json`), `${JSON.stringify({ generatedAt: new Date().toISOString(), meta: meta.counts, coverage: { scopeTotal, covered, provinceCountDist, programCounts: { min: programCounts[0], median: programCounts[Math.floor(programCounts.length / 2)], max: programCounts[programCounts.length - 1] } }, requirement: { conflicts: conflicts.length, patterns: count(offerings, (r) => r.requirementPattern || 'conflict'), confidence: count(offerings, (r) => r.confidence), variants: variants.length }, catalog: { match: matchDist, unmatchedTop: unmatched.slice(0, 100) }, simulation: { combos312: sim312, combos33: sim33 }, sources: meta.sources, nameMismatches: meta.nameMismatches, campusMappings: meta.campusMappings, unmatchedSchoolNames: meta.unmatchedSchoolNames, strongBase: strongBase.length, problems }, null, 2)}\n`)
  console.log(`\nwrote ${join(outDir, `s1-audit${scope === 'all' ? '-all' : ''}.md`)} and .json`)
}
if (problems.length) process.exit(1)
