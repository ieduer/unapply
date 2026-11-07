#!/usr/bin/env node
// S1 資料層首批建置：雙一流（教育部 2026 名單內民辦／公辦普通高校，不含軍校）的本科招生專業清單＋選考科目要求。
//
//   node scripts/build_s1_programs.mjs --cache-dir DIR [--scope dfc|all]
//   --scope dfc（預設）：雙一流 144 校、只收本科列，寫 program_offerings.2027.csv；
//   --scope all：教育部主池全部 2,952 校、本科與高職（專科）都收，寫 program_offerings.2027.all.csv.gz（gzip，約 10 萬條）。
//
// 輸入（全部官方，見 data/research/s1_sources.json；先跑 scripts/fetch_s1_sources.mjs 核對雜湊）：
//   教育部《普通高等学校本科专业目录（2026年）》PDF            → data/research/bk_catalog.2026.csv
//   湖北／江蘇（xlsx／xls）、上海／浙江（PDF）2027 年選考科目要求表 → data/research/program_offerings.2027.csv（逐校逐專業，四省聯集＋交叉核對）
//                                                             → data/research/program_offerings_summary.2027.csv（逐校彙總）
//   教育部 2020 強基試點名單 docx ＋ 三校 2026 強基簡章頁        → data/research/strong_base_schools.2026.csv
//   另寫 data/research/program_offerings.2027.meta.json（輸入雜湊、計數、對不上的名稱）供 audit 使用。
//
// 原則：
//   - 選考要求字串是封閉詞表，出現不認得的寫法直接 exit 1，不猜。
//   - 四省表對同一校同一專業給出的要求不一致時標 conflict，requirementPattern 留空，任何下游都不得拿去排除。
//   - 學校對齊用教育部 10 位代碼的末 5 位（＝省表的院校代碼）；PDF 表無代碼，用校名（含教育部同碼更名別名）對齊。
//   - 需要 poppler 的 pdftotext 與系統 unzip；缺少時報錯退出並說明安裝方式，不改用其他來源。

import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const XLSX = require('@e965/xlsx')

const argv = process.argv.slice(2)
const argValue = (flag, fallback) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : fallback }
const cacheDir = resolve(argValue('--cache-dir', join(root, '.tmp', 's1-sources')))
const scope = argValue('--scope', 'dfc')
if (!['dfc', 'all'].includes(scope)) die(`--scope 只接受 dfc 或 all`)
const includeVocational = scope === 'all'
// 省表的層次寫法：本科／高职(专科)／专科；上海表只有本科。
const normalizeLevel = (raw) => (raw === '本科' ? '本科' : /专科/.test(raw ?? '') ? '專科' : null)
const researchDir = join(root, 'data', 'research')
const committedDir = join(researchDir, 'raw', 's1')
const registry = JSON.parse(readFileSync(join(researchDir, 's1_sources.json'), 'utf8'))
const sourceById = Object.fromEntries(registry.sources.map((s) => [s.id, s]))
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const die = (message) => { console.error(`build_s1_programs: ${message}`); process.exit(1) }

function sourceFile(id) {
  const source = sourceById[id] || die(`registry 缺 ${id}`)
  const path = source.store === 'committed' ? join(committedDir, source.file) : join(cacheDir, source.file)
  if (!existsSync(path)) die(`缺少 ${path}；先跑 node scripts/fetch_s1_sources.mjs --cache-dir ${cacheDir}`)
  const buf = readFileSync(path)
  if (source.sha256 && sha256(buf) !== source.sha256) die(`${id} 雜湊不符，拒絕建置`)
  return { source, path, buf }
}

function tool(name, hint) {
  const probe = spawnSync(name, ['-v'], { encoding: 'utf8' })
  if (probe.error) die(`找不到 ${name}：${hint}`)
}
tool('pdftotext', 'brew install poppler（本層只用它把官方 PDF 轉成文字／座標，不做任何網路或付費調用）')
tool('unzip', 'macOS 內建；用於 unzip -p 串流取出浙江 zip 內的 PDF')

const csvCell = (v) => { const t = v === undefined || v === null ? '' : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }
const writeCsv = (path, header, rows) => writeFileSync(path, `${header.join(',')}\n${rows.map((r) => header.map((k) => csvCell(r[k])).join(',')).join('\n')}\n`)
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

// ---------- 教育部主表與雙一流集合 ----------
const { officialSchools } = await import(pathToFileURL(join(root, 'src', 'data', 'officialSchools.ts')).href)
const byMoeCode = new Map(officialSchools.map((s) => [s.moeCode, s]))
const byCode5 = new Map(officialSchools.map((s) => [s.moeCode.slice(-5), s]))
const normalizeName = (s) => s.replace(/\s+/g, '').replace(/（/g, '(').replace(/）/g, ')').replace(/，/g, ',').replace(/：/g, ':').replace(/－/g, '-')
const byName = new Map(officialSchools.map((s) => [normalizeName(s.nameSimplified ?? s.name), s]))
for (const row of parseCsv(readFileSync(join(researchDir, 'moe_former_names.2026-06-17.csv'), 'utf8'))) {
  const cur = normalizeName(row.currentName), former = normalizeName(row.formerName)
  if (former && byName.has(cur) && !byName.has(former)) byName.set(former, byName.get(cur))
}
// 省表會給校區／醫學院／分校單獨的招生代碼與名稱（哈尔滨工业大学(威海)、复旦大学医学院、北京大学医学部…）。
// 這些是母校的招生主體，不對回母校就會漏掉整個醫學院的臨床醫學。先試完整校名（含舊名），對不到再剝校區後綴；
// 母校必須真的在教育部主表裡才算對上（新乡医学院剝成「新乡」對不到，就保持未對應）。
const CAMPUS_SUFFIXES = [/\((?:[^()]*校区|威海|深圳|保定|北京|华东|武汉)\)$/, /克拉玛依校区$/, /(?:秦皇岛|威海)分校$/, /医学部$/, /医学院$/]
function resolveSchoolByName(rawName) {
  const name = normalizeName(rawName)
  if (byName.has(name)) return { school: byName.get(name), campusLabel: '' }
  for (const re of CAMPUS_SUFFIXES) {
    const m = re.exec(name)
    if (!m) continue
    const parent = name.slice(0, m.index)
    if (byName.has(parent)) return { school: byName.get(parent), campusLabel: m[0].replace(/^\(|\)$/g, '') }
  }
  return null
}
// 雙一流原始名單寫的是 2022 年校名；2023 年更名、而教育部 2025→2026 同碼比對表不含的，在這裡登記（只此一例）。
const DFC_ALIASES = { 上海体育学院: '上海体育大学' }
const dfcRaw = parseCsv(readFileSync(join(researchDir, 'double_first_class_round2_raw.2026-04-21.csv'), 'utf8'))
const dfc = new Map(); const dfcOutsidePool = []
for (const row of dfcRaw) {
  const name = normalizeName(DFC_ALIASES[row.schoolName] ?? row.schoolName)
  const school = byName.get(name)
  if (school) dfc.set(school.moeCode, school); else dfcOutsidePool.push(row.schoolName)
}
console.log(`雙一流第二輪 ${dfcRaw.length} 所：教育部 2026 普通高校主池內 ${dfc.size} 所；不在主池 ${dfcOutsidePool.length}（${dfcOutsidePool.join('、')}）`)
const inScope = (school) => scope === 'all' || dfc.has(school.moeCode)

// ---------- 教育部本科專業目錄 ----------
function parseCatalog() {
  const { source, path } = sourceFile('moe-bk-catalog-2026')
  const out = spawnSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (out.status !== 0) die(`pdftotext 失敗：${out.stderr}`)
  const lines = out.stdout.split('\n')
  const disciplines = [], classes = [], programs = []
  let discipline = null, klass = null, pending = null
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (pending) { // 「（注：…）」跨行
      pending.note += line
      if (line.includes('）')) { pending.note = pending.note.replace(/^（注：|）$/g, ''); pending = null }
      continue
    }
    let m = /^(\d{2})\s+学科门类：(\S+)$/.exec(line)
    if (m) { discipline = { code: m[1], name: m[2] }; disciplines.push(discipline); klass = null; continue }
    m = /^(\d{4})\s+(\S+类)$/.exec(line)
    if (m) { klass = { code: m[1], name: m[2], disciplineCode: m[1].slice(0, 2) }; classes.push(klass); continue }
    m = /^(\d{6,7})([TK]{0,2})\s+(\S.*)$/.exec(line)
    if (m) {
      if (!discipline || !m[1].startsWith(discipline.code)) die(`目錄專業 ${m[1]} 不在當前門類 ${discipline?.code} 下，版面解析可能走樣`)
      // 2026 年新增的「交叉学科」門類沒有專業類，專業直接掛在門類下；用一個不計入 92 類的門類直屬佔位。
      if (!klass || !m[1].startsWith(klass.code)) klass = { code: '', name: `${discipline.name}（門類直屬）`, disciplineCode: discipline.code, synthetic: true }
      let name = m[3].trim(), note = ''
      const noteIndex = name.indexOf('（注：')
      if (noteIndex >= 0) { note = name.slice(noteIndex); name = name.slice(0, noteIndex).trim() }
      const program = { code: m[1] + m[2], digits: m[1], special: m[2].includes('T') ? 'T' : '', controlled: m[2].includes('K') ? 'K' : '', name, classCode: klass.code, className: klass.name, disciplineCode: discipline.code, disciplineName: discipline.name, note }
      programs.push(program)
      if (note && !note.includes('）')) pending = program
      else if (note) program.note = note.replace(/^（注：|）$/g, '')
      continue
    }
  }
  const expected = source.expected
  if (disciplines.length !== expected.disciplines || classes.length !== expected.classes || programs.length !== expected.programs) {
    die(`目錄計數與教育部公告不符：門類 ${disciplines.length}/${expected.disciplines}、專業類 ${classes.length}/${expected.classes}、專業 ${programs.length}/${expected.programs}`)
  }
  return { disciplines, classes, programs, source }
}
const catalog = parseCatalog()
const catalogByDigits = new Map(catalog.programs.map((p) => [p.digits, p]))
const catalogByName = new Map(catalog.programs.map((p) => [p.name, p]))
const classByName = new Map(catalog.classes.map((c) => [c.name, c]))
const disciplineByCode = new Map(catalog.disciplines.map((d) => [d.code, d]))
console.log(`本科專業目錄 2026：門類 ${catalog.disciplines.length}、專業類 ${catalog.classes.length}、專業 ${catalog.programs.length}`)

// ---------- 選考要求詞表 ----------
// 技术（T）只有浙江 3+3 設有這一科；全國通用版沒有它，所以跨省比對時忽略 T，只在 requirementVariants 欄保留浙江版。
const SUBJECT_KEY = { 物理: 'P', 化学: 'C', 生物: 'B', 思想政治: 'Z', 历史: 'H', 地理: 'G', 技术: 'T', 物: 'P', 化: 'C', 生: 'B', 政: 'Z', 史: 'H', 地: 'G' }
const ORDER = 'PCBZHGT'
const nationalPattern = (p) => p.replace(/T/g, '')
const toPattern = (keys) => [...ORDER].filter((k) => keys.has(k)).join('')
function normalizeRequirement(text, sourceId) {
  const t = text.replace(/\s+/g, '')
  if (t === '' || t === '不提科目要求' || t === '不限') return ''
  let m = /^(.+?)[(（](\d)门科目考生(?:均须|必须)选考方可报考[)）]$/.exec(t)
  if (m) {
    const parts = m[1].split(/[,，、]/).filter(Boolean)
    if (parts.length !== Number(m[2])) die(`${sourceId}: 科目數與括號內不符：${text}`)
    const keys = new Set(parts.map((p) => SUBJECT_KEY[p] ?? die(`${sourceId}: 不認得的科目「${p}」在 ${text}`)))
    return toPattern(keys)
  }
  m = /^[物化生政史地](和[物化生政史地])*$/.exec(t)
  if (m) return toPattern(new Set(t.split('和').map((p) => SUBJECT_KEY[p])))
  die(`${sourceId}: 不認得的選考要求寫法：「${text}」——先補詞表，不要猜`)
}

// ---------- 專業名稱正規化與目錄對應 ----------
function baseName(name) { let b = name; for (let i = 0; i < 3; i += 1) b = b.replace(/\([^()]*\)$/, ''); return b }
function matchCatalog(name, codes) {
  for (const code of codes) {
    const m = /^(\d{6,7})/.exec(code)
    if (m && catalogByDigits.has(m[1])) return { match: 'code', program: catalogByDigits.get(m[1]) }
  }
  if (catalogByName.has(name)) return { match: 'name', program: catalogByName.get(name) }
  const base = baseName(name)
  if (catalogByName.has(base)) return { match: 'name_base', program: catalogByName.get(base) }
  if (classByName.has(base)) return { match: 'class', klass: classByName.get(base) }
  if (/试验班|实验班|试点班|基地班|拔尖/.test(name)) return { match: 'none', kind: 'experimental' }
  return { match: 'none', kind: 'other' }
}

// ---------- 各省表解析 → 統一記錄 {sourceId, province, school, programName, programCode, requirementRaw, pattern} ----------
const meta = { generatedAt: new Date().toISOString(), scope, inputs: {}, sources: {}, unmatchedSchoolNames: {}, campusMappings: {}, codeFallbackByName: {}, learnedAliases: {}, nameMismatches: [], wrappedRowsMerged: {}, droppedIncompleteRows: {}, droppedUndergraduateRows: {}, droppedWatermarkWords: {} }
function addInput(id) { const s = sourceById[id]; meta.inputs[id] = { title: s.title, fileUrl: s.fileUrl, sha256: s.sha256, publishedDate: s.publishedDate } }

function parseSpreadsheet(id, { sheetName, headerRowMatch, pick }) {
  const { source, path } = sourceFile(id); addInput(id)
  const wb = XLSX.readFile(path)
  const name = sheetName ? wb.SheetNames.find((n) => n === sheetName) : wb.SheetNames[0]
  if (!name) die(`${id}: 找不到工作表 ${sheetName}`)
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' }).map((r) => r.map((c) => String(c).trim()))
  const headerIndex = rows.findIndex((r) => headerRowMatch(r))
  if (headerIndex < 0) die(`${id}: 找不到表頭 ${source.expected.header.join('/')}`)
  const records = []; let undergraduateSchools = new Set()
  for (const r of rows.slice(headerIndex + 1)) {
    const rec = pick(r)
    if (!rec || !rec.schoolCode) continue
    const level = normalizeLevel(rec.level)
    if (!level || (level === '專科' && !includeVocational)) continue
    if (level === '本科') undergraduateSchools.add(rec.schoolCode)
    let school = byCode5.get(rec.schoolCode), campusLabel = ''
    if (school) {
      const tableName = normalizeName(rec.schoolName), moeName = normalizeName(school.nameSimplified ?? school.name)
      if (rec.schoolName && tableName !== moeName) {
        const campus = resolveSchoolByName(rec.schoolName)
        if (campus && campus.school === school && campus.campusLabel) campusLabel = campus.campusLabel // 华北电力大学(北京) 這類主代碼帶校區名
        else {
          // 省表（2025-02 口徑）用舊校名、教育部 2026 已更名：代碼是權威，順手把舊名登記成別名，PDF 表（無代碜）靠它對上。
          const key = `${rec.schoolCode} 表寫「${rec.schoolName}」，教育部 2026 為「${school.nameSimplified ?? school.name}」`
          if (!meta.nameMismatches.includes(key)) meta.nameMismatches.push(key)
          if (!byName.has(tableName)) { byName.set(tableName, school); meta.learnedAliases[tableName] = school.nameSimplified ?? school.name }
        }
      }
    } else {
      const resolved = resolveSchoolByName(rec.schoolName)
      if (!resolved) { const key = `${rec.schoolCode} ${rec.schoolName}`; if (!(meta.unmatchedSchoolNames[id] ??= []).includes(key)) meta.unmatchedSchoolNames[id].push(key); continue }
      school = resolved.school; campusLabel = resolved.campusLabel
      if (campusLabel) (meta.campusMappings[id] ??= {})[`${rec.schoolCode} ${rec.schoolName}`] = `${school.nameSimplified ?? school.name}｜${campusLabel}`
      else (meta.codeFallbackByName[id] ??= {})[`${rec.schoolCode} ${rec.schoolName}`] = `${school.moeCode} ${school.nameSimplified ?? school.name}` // 省表招生代碼≠教育部標識碼，按校名對上
    }
    records.push({ sourceId: id, province: source.province, school, campusLabel, level, programName: normalizeName(rec.programName), programCode: rec.programCode, requirementRaw: rec.requirementRaw, pattern: normalizeRequirement(rec.requirementRaw, id) })
  }
  const undergraduateRows = records.filter((r) => r.level === '本科').length
  const vocationalRows = records.length - undergraduateRows
  const exp = source.expected
  if (exp.undergraduateRows && undergraduateRows !== exp.undergraduateRows) console.warn(`  ${id}: 本科列 ${undergraduateRows}（表內 ${exp.undergraduateRows}；差額為對不到教育部主表的院校列，多為軍校與未入主池院校）`)
  meta.sources[id] = { undergraduateRows, vocationalRows, undergraduateSchools: undergraduateSchools.size, unmatchedSchools: (meta.unmatchedSchoolNames[id] ?? []).length }
  console.log(`${id}: 本科 ${undergraduateRows} 列（專科 ${vocationalRows}）、${undergraduateSchools.size} 校（對不到主表 ${(meta.unmatchedSchoolNames[id] ?? []).length} 校）`)
  return records
}

const REGION_NAMES = ['北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江', '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '广西', '海南', '重庆', '四川', '贵州', '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆']
// pdftotext -tsv → 依表頭中心 x 分欄、依 top 聚行；剔除散字水印；拼回被折行的專業名。
function pdfTable(id, pdfPath, { columns, watermark, headerKey, levelColumn }) {
  const tsvPath = join(cacheDir, `${sourceById[id].file}.tsv`)
  if (!existsSync(tsvPath)) {
    mkdirSync(cacheDir, { recursive: true })
    const out = spawnSync('pdftotext', ['-tsv', pdfPath, tsvPath], { encoding: 'utf8' })
    if (out.status !== 0) die(`pdftotext -tsv 失敗：${out.stderr}`)
  }
  const pages = new Map()
  for (const line of readFileSync(tsvPath, 'utf8').split('\n')) {
    const f = line.split('\t'); if (f[0] !== '5') continue
    const text = f[11]
    if (text.length === 1 && watermark.has(text)) { meta.droppedWatermarkWords[id] = (meta.droppedWatermarkWords[id] ?? 0) + 1; continue }
    const page = Number(f[1]); const left = Number(f[6]), top = Number(f[7]), width = Number(f[8])
    ;(pages.get(page) ?? pages.set(page, []).get(page)).push({ left, top, cx: left + width / 2, text })
  }
  const rowsOut = []; let merged = 0, dropped = 0; let centers = null
  const WRAP_COLUMNS = new Set(['schoolName', 'programName'])
  for (const [, words] of [...pages.entries()].sort((a, b) => a[0] - b[0])) {
    words.sort((a, b) => a.top - b.top || a.left - b.left)
    const lines = []
    // 聚行容差 2.0pt：上海表折行校名的第一行只比同列其他格高 1.65pt，要併進同一行；代碼格高 2.8pt 另由下方「欄位不重疊就合併」處理。
    for (const w of words) { const last = lines[lines.length - 1]; if (last && Math.abs(last.top - w.top) <= 2.0) last.words.push(w); else lines.push({ top: w.top, words: [w] }) }
    const parsed = []
    for (const line of lines) {
      const texts = line.words.map((w) => w.text)
      if (texts.includes(headerKey)) { // 表頭：記每欄中心
        const found = columns.map((col) => line.words.find((w) => col.header.some((h) => w.text === h || w.text.startsWith(h))))
        if (found.every(Boolean)) centers = found.map((w) => w.cx)
        continue
      }
      if (!centers) continue
      if (texts.every((t) => /^第(\d+)?(页)?[，,]?共?$|^\d+(页)?$|^页([，,]共)?$|^共(\d+)?(页)?$|^[，,]共?$/.test(t))) continue // 頁尾「第 N 页，共 914 页」（會被拆成「第7页，共」「914页」或「第」「10」「页」等）
      const cells = columns.map(() => [])
      for (const w of line.words.sort((a, b) => a.left - b.left)) {
        let best = 0; for (let i = 1; i < centers.length; i += 1) if (Math.abs(w.cx - centers[i]) < Math.abs(w.cx - centers[best])) best = i
        cells[best].push(w.text)
      }
      const rec = Object.fromEntries(columns.map((c, i) => [c.key, cells[i].join('')]))
      // 校名很長時會貼到地區欄、被 pdftotext 併成一個詞（「浙江浙江舟山群岛新区旅游与健康职业学院」）：地區欄空、校名以省名開頭就拆開。
      if ('region' in rec && !rec.region && rec.schoolName) {
        const region = REGION_NAMES.find((r) => rec.schoolName.startsWith(r) && rec.schoolName.length > r.length + 3)
        if (region) { rec.region = region; rec.schoolName = rec.schoolName.slice(region.length) }
      }
      // 「主線」＝至少有一個非折行欄（省份／代碼／層次／要求）有字；只有校名或專業名的是折行殘段。
      const isMain = columns.some((c, i) => !WRAP_COLUMNS.has(c.key) && cells[i].length > 0)
      parsed.push({ top: line.top, rec, isMain, texts })
    }
    // 同一列的單元格字高不同時（上海表的專業代碼字高 14.8 vs 其餘 11.3）top 會差 2–3pt 而被拆成兩線：
    // 相鄰主線 top 差 ≤ 4.5pt 且佔的欄不重疊，就是同一列，合併。表內列距約 17pt，不會誤併相鄰列。
    const mergedMains = []
    for (const line of parsed.filter((p) => p.isMain)) {
      const prev = mergedMains[mergedMains.length - 1]
      const disjoint = prev && columns.every((c) => !(prev.rec[c.key] && line.rec[c.key]))
      if (prev && Math.abs(prev.top - line.top) <= 4.5 && disjoint) { for (const c of columns) if (line.rec[c.key]) prev.rec[c.key] = line.rec[c.key]; continue }
      mergedMains.push(line)
    }
    // 折行殘段拼回最近（±14pt）的主線：單元格垂直置中時，殘段會落在主線上下兩側，按 top 順序拼接。
    const mains = mergedMains
    // 方向規則：殘段在主線下方＝續行，接到上一條該欄已有字的主線；殘段在主線上方＝前半，接到下一條該欄還空著的主線。
    // 單純取最近會錯：兩行的單元格若上對齊，第二行離下一列（17pt）比離自己的列更近。
    for (const frag of parsed.filter((p) => !p.isMain).sort((a, b) => a.top - b.top)) {
      const cols = columns.filter((c) => WRAP_COLUMNS.has(c.key) && frag.rec[c.key])
      if (cols.length === 0) continue
      // 窗口 17pt：主線的 top 可能是較高的代碼格（比同列文字高 2.8pt），續行離它可到 14.7pt；列距約 17–18pt。
      const above = mains.filter((m) => m.top <= frag.top && frag.top - m.top <= 17).sort((a, b) => b.top - a.top)[0]
      const below = mains.filter((m) => m.top > frag.top && m.top - frag.top <= 17).sort((a, b) => a.top - b.top)[0]
      // 一致性：接在上方主線＝續行，該欄應已有字；接在下方主線＝前半，該欄應還空著。先取最近的，最近的不一致而另一側一致就換。
      const consistent = (m, isAbove) => (isAbove ? cols.every((c) => m.rec[c.key]) : cols.every((c) => !m.rec[c.key]))
      const candidates = [above && { m: above, isAbove: true, d: frag.top - above.top }, below && { m: below, isAbove: false, d: below.top - frag.top }].filter(Boolean).sort((a, b) => a.d - b.d)
      let pick = candidates[0]
      if (pick && !consistent(pick.m, pick.isAbove) && candidates[1] && consistent(candidates[1].m, candidates[1].isAbove)) pick = candidates[1]
      const target = pick?.m ?? null, prepend = pick ? !pick.isAbove : false
      if (!target) { dropped += 1; if (process.env.S1_DEBUG_DROPPED && dropped <= 12) console.error(`  [${id}] orphan fragment top=${frag.top.toFixed(1)} ${JSON.stringify(frag.rec)}`); continue }
      for (const c of cols) target.rec[c.key] = prepend ? frag.rec[c.key] + target.rec[c.key] : target.rec[c.key] + frag.rec[c.key]
      merged += 1
    }
    for (const main of mains) {
      const complete = columns.every((c) => !c.required || main.rec[c.key])
      if (complete) rowsOut.push(main.rec)
      else { dropped += 1; if (!levelColumn || main.rec[levelColumn] === '本科') meta.droppedUndergraduateRows[id] = (meta.droppedUndergraduateRows[id] ?? 0) + 1; if (process.env.S1_DEBUG_DROPPED && dropped <= 12) console.error(`  [${id}] dropped line top=${main.top.toFixed(1)} words=${JSON.stringify(main.texts)} ${JSON.stringify(main.rec)}`) }
    }
  }
  meta.wrappedRowsMerged[id] = merged
  meta.droppedIncompleteRows[id] = dropped
  return rowsOut.map((r) => ({ ...r, level: levelColumn ? normalizeLevel(r[levelColumn]) : '本科' })).filter((r) => r.level && (r.level === '本科' || includeVocational))
}

function parsePdfSource(id, pdfPath, options) {
  const source = sourceById[id]; addInput(id)
  const rows = pdfTable(id, pdfPath, options)
  const records = []; const schools = new Set(); const unmatched = new Set()
  for (const r of rows) {
    schools.add(r.schoolName)
    const resolved = resolveSchoolByName(r.schoolName)
    if (!resolved) { unmatched.add(r.schoolName); continue }
    if (resolved.campusLabel) (meta.campusMappings[id] ??= {})[r.schoolName] = `${resolved.school.nameSimplified ?? resolved.school.name}｜${resolved.campusLabel}`
    records.push({ sourceId: id, province: source.province, school: resolved.school, campusLabel: resolved.campusLabel, level: r.level, programName: normalizeName(r.programName), programCode: r.programCode ?? '', requirementRaw: r.requirement, pattern: normalizeRequirement(r.requirement, id) })
  }
  meta.unmatchedSchoolNames[id] = [...unmatched]
  const undergraduateRows = records.filter((r) => r.level === '本科').length
  meta.sources[id] = { undergraduateRows, vocationalRows: records.length - undergraduateRows, undergraduateSchools: schools.size, unmatchedSchools: unmatched.size }
  console.log(`${id}: 本科 ${undergraduateRows} 列（專科 ${records.length - undergraduateRows}）、${schools.size} 校（對不到主表 ${unmatched.size} 校；折行拼回 ${meta.wrappedRowsMerged[id]}；不完整列丟棄 ${meta.droppedIncompleteRows[id]}，其中本科 ${meta.droppedUndergraduateRows[id] ?? 0}；剔除水印字 ${meta.droppedWatermarkWords[id] ?? 0}）`)
  return records
}

const all = []
all.push(...parseSpreadsheet('hubei-xkkm-2027', {
  headerRowMatch: (r) => r[0] === '院校代码' && r[5] === '考试科目要求',
  pick: (r) => ({ schoolCode: r[0], schoolName: r[1], programCode: r[2], programName: r[3], level: r[4], requirementRaw: r[5] }),
}))
all.push(...parseSpreadsheet('jiangsu-xkkm-2027', {
  sheetName: sourceById['jiangsu-xkkm-2027'].expected.sheet,
  headerRowMatch: (r) => r[0] === '层次' && r[5] === '选考科目要求',
  pick: (r) => ({ level: r[0], schoolCode: r[1], schoolName: r[2], programCode: r[3], programName: r[4], requirementRaw: r[5] }),
}))
{
  const { path } = sourceFile('shanghai-xkkm-2027')
  all.push(...parsePdfSource('shanghai-xkkm-2027', path, {
    headerKey: '院校名称', watermark: new Set('上海市教育考试院'),
    columns: [
      { key: 'province', header: ['省份'], required: true }, { key: 'schoolName', header: ['院校名称'], required: true },
      { key: 'programCode', header: ['专业代码'], required: false }, { key: 'programName', header: ['专业（类）名称', '专业(类)名称'], required: true },
      { key: 'requirement', header: ['科目要求'], required: true },
    ],
  }))
}
{
  const { source, path } = sourceFile('zhejiang-xkkm-2027')
  const innerPdf = join(cacheDir, source.file.replace(/\.zip$/, '.pdf'))
  if (!existsSync(innerPdf)) {
    const out = spawnSync('unzip', ['-p', path], { maxBuffer: 256 * 1024 * 1024 })
    if (out.status !== 0) die(`unzip -p 失敗：${out.stderr}`)
    writeFileSync(innerPdf, out.stdout)
  }
  if (sha256(readFileSync(innerPdf)) !== source.inner.sha256) die('浙江 zip 內 PDF 雜湊不符')
  all.push(...parsePdfSource('zhejiang-xkkm-2027', innerPdf, {
    headerKey: '院校名称', watermark: new Set('浙江省教育考试院'), levelColumn: 'level',
    columns: [
      { key: 'region', header: ['地区'], required: true }, { key: 'schoolName', header: ['院校名称'], required: true },
      { key: 'level', header: ['层次'], required: true }, { key: 'programName', header: ['专业（类）名称', '专业(类)名称'], required: true },
      { key: 'requirement', header: ['选考科目要求'], required: true },
    ],
  }))
}

// ---------- 聯集與交叉核對 ----------
const PROVINCE_TAG = { 湖北: 'HB', 江蘇: 'JS', 上海: 'SH', 浙江: 'ZJ' }
const bySchool = new Map()
for (const rec of all) {
  if (!inScope(rec.school)) continue
  const programs = bySchool.get(rec.school.moeCode) ?? bySchool.set(rec.school.moeCode, new Map()).get(rec.school.moeCode)
  const key = `${rec.level}|${rec.campusLabel}|${rec.programName}`
  const entry = programs.get(key) ?? programs.set(key, { name: rec.programName, level: rec.level, campusLabel: rec.campusLabel, codes: new Set(), patterns: new Map(), raws: new Map(), variants: new Map(), provinces: new Set(), sourceIds: new Set() }).get(key)
  if (rec.programCode) entry.codes.add(rec.programCode)
  const national = nationalPattern(rec.pattern)
  entry.patterns.set(national, (entry.patterns.get(national) ?? 0) + 1)
  if (!entry.raws.has(national)) entry.raws.set(national, rec.requirementRaw)
  if (rec.pattern !== national) entry.variants.set(PROVINCE_TAG[rec.province], rec.pattern)
  entry.provinces.add(PROVINCE_TAG[rec.province]); entry.sourceIds.add(rec.sourceId)
}
const latestDate = (ids) => [...ids].map((id) => sourceById[id].publishedDate).sort().pop()
const offerings = []; const summary = []
for (const [moeCode, programs] of [...bySchool.entries()].sort()) {
  const school = byMoeCode.get(moeCode)
  const patternCounts = new Map(); let conflicts = 0, matched = 0, classMatched = 0, unmatched = 0
  for (const entry of [...programs.values()].sort((a, b) => a.level.localeCompare(b.level) || a.campusLabel.localeCompare(b.campusLabel) || a.name.localeCompare(b.name, 'zh-Hans-CN'))) {
    const patterns = [...entry.patterns.keys()]
    const conflict = patterns.length > 1
    const pattern = conflict ? '' : patterns[0]
    const codes = [...entry.codes].sort()
    // 高職（專科）專業用的是《職業教育專業目錄》，不對本科目錄；只記錄，不做專業類對應。
    const cat = entry.level === '本科' ? matchCatalog(entry.name, codes) : { match: 'vocational', kind: 'vocational' }
    const program = cat.program; const klass = cat.klass ?? (program ? (catalog.classes.find((c) => c.code === program.classCode) ?? { code: '', name: program.className, disciplineCode: program.disciplineCode }) : null)
    const discipline = klass ? disciplineByCode.get(klass.disciplineCode) : null
    if (cat.match === 'class') classMatched += 1; else if (cat.match === 'none') unmatched += 1; else if (cat.match !== 'vocational') matched += 1
    if (conflict) conflicts += 1
    patternCounts.set(conflict ? 'conflict' : (pattern || 'none'), (patternCounts.get(conflict ? 'conflict' : (pattern || 'none')) ?? 0) + 1)
    offerings.push({
      moeCode, schoolName: school.nameSimplified ?? school.name, schoolCode: moeCode.slice(-5), campusLabel: entry.campusLabel, level: entry.level, admissionYear: 2027,
      programName: entry.name, programNameBase: baseName(entry.name), programCodes: codes.join('|'),
      programKind: cat.match === 'none' || cat.match === 'vocational' ? cat.kind : (cat.match === 'class' ? 'class' : 'program'),
      catalogMatch: cat.match, catalogCode: program?.code ?? '', catalogName: program?.name ?? '',
      catalogClassCode: klass?.code ?? '', catalogClassName: klass?.name ?? '', disciplineCode: discipline?.code ?? '', disciplineName: discipline?.name ?? '',
      requirementPattern: conflict ? '' : (pattern || 'none'), requirementRaw: conflict ? '' : entry.raws.get(pattern),
      requirementVariants: [...entry.variants.entries()].map(([prov, p]) => `${prov}:${p}`).join('|'),
      provinces: [...entry.provinces].sort().join('|'), sourceIds: [...entry.sourceIds].sort().join('|'),
      conflict: conflict ? patterns.map((p) => `${p || 'none'}=${entry.raws.get(p)}`).join(' / ') : '',
      confidence: conflict ? 'low' : (entry.provinces.size >= 2 ? 'high' : 'medium'), sourceDate: latestDate(entry.sourceIds),
    })
  }
  const provinces = new Set(); const campuses = new Set(); for (const e of programs.values()) { for (const p of e.provinces) provinces.add(p); if (e.campusLabel) campuses.add(e.campusLabel) }
  summary.push({
    moeCode, schoolName: school.nameSimplified ?? school.name, moeLevel: school.level, programCount: programs.size,
    undergraduateCount: [...programs.values()].filter((e) => e.level === '本科').length, vocationalCount: [...programs.values()].filter((e) => e.level === '專科').length,
    campusLabels: [...campuses].sort().join('|'),
    provinces: [...provinces].sort().join('|'), provinceCount: provinces.size,
    patternBreakdown: [...patternCounts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(';'),
    catalogProgramMatched: matched, catalogClassMatched: classMatched, catalogUnmatched: unmatched, conflicts,
  })
}

// ---------- 強基計劃 ----------
function strongBase() {
  const { source, path } = sourceFile('moe-qiangji-2020-schools'); addInput('moe-qiangji-2020-schools')
  const xml = spawnSync('unzip', ['-p', path, 'word/document.xml'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  if (xml.status !== 0) die('讀取強基 docx 失敗')
  const paragraphs = [...xml.stdout.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) => m[0].replace(/<[^>]+>/g, '').trim()).filter(Boolean)
  const listLine = paragraphs.find((p) => p.includes('、') && p.includes('大学'))
  const names = listLine.split(/[、，,]/).map((n) => n.trim()).filter(Boolean)
  if (names.length !== source.expected.schools) die(`強基名單解析到 ${names.length} 所，釘定 ${source.expected.schools}`)
  const rows = names.map((name) => {
    const school = byName.get(normalizeName(name))
    return { moeCode: school?.moeCode ?? '', schoolName: name, inMoePool: school ? 'yes' : 'no', evidenceYear: 2020, listedSince: 2020, sourceTitle: source.title, sourceUrl: source.pageUrl, sourceDate: source.publishedDate, confidence: 'high', notes: school ? '' : '軍隊院校，不在教育部普通高校主池' }
  })
  for (const id of ['qiangji-2026-neu', 'qiangji-2026-hnu', 'qiangji-2026-nwafu']) {
    const { source: s, buf } = sourceFile(id); addInput(id)
    const html = buf.toString('utf8')
    if (!/强基计划/.test(html)) die(`${id} 頁面內容不含「强基计划」`)
    const school = byMoeCode.get(s.moeCode) ?? die(`${id} moeCode 不在主表`)
    rows.push({ moeCode: school.moeCode, schoolName: school.nameSimplified ?? school.name, inMoePool: 'yes', evidenceYear: 2026, listedSince: 2022, sourceTitle: s.title, sourceUrl: s.pageUrl, sourceDate: s.publishedDate, confidence: 'high', notes: `2022 年增列（教育部網站無可抓取原文，以學校官方 2026 年簡章為證）；${s.notes}` })
  }
  return rows
}
const strongBaseRows = strongBase()

// ---------- 輸出 ----------
writeCsv(join(researchDir, 'bk_catalog.2026.csv'), ['code', 'name', 'special', 'controlled', 'classCode', 'className', 'disciplineCode', 'disciplineName', 'degreeNote', 'year', 'sourceTitle', 'sourceUrl', 'sourceDate'],
  catalog.programs.map((p) => ({ ...p, degreeNote: p.note, year: 2026, sourceTitle: catalog.source.title, sourceUrl: catalog.source.pageUrl, sourceDate: catalog.source.publishedDate })))
const OFFERING_COLUMNS = ['moeCode', 'schoolName', 'schoolCode', 'campusLabel', 'level', 'admissionYear', 'programName', 'programNameBase', 'programCodes', 'programKind', 'catalogMatch', 'catalogCode', 'catalogName', 'catalogClassCode', 'catalogClassName', 'disciplineCode', 'disciplineName', 'requirementPattern', 'requirementRaw', 'requirementVariants', 'provinces', 'sourceIds', 'conflict', 'confidence', 'sourceDate']
const offeringsName = scope === 'all' ? 'program_offerings.2027.all.csv.gz' : 'program_offerings.2027.csv'
if (scope === 'all') {
  // 全部 2,952 校約 10 萬條，純文字近 30 MB；以 gzip 入庫（zlib 可直接讀），diff 用 gzip -dc 比。
  const text = `${OFFERING_COLUMNS.join(',')}\n${offerings.map((r) => OFFERING_COLUMNS.map((k) => csvCell(r[k])).join(',')).join('\n')}\n`
  writeFileSync(join(researchDir, offeringsName), gzipSync(Buffer.from(text, 'utf8'), { level: 9 }))
} else {
  writeCsv(join(researchDir, offeringsName), OFFERING_COLUMNS, offerings)
}
writeCsv(join(researchDir, scope === 'all' ? 'program_offerings_summary.2027.all.csv' : 'program_offerings_summary.2027.csv'), ['moeCode', 'schoolName', 'moeLevel', 'programCount', 'undergraduateCount', 'vocationalCount', 'campusLabels', 'provinces', 'provinceCount', 'patternBreakdown', 'catalogProgramMatched', 'catalogClassMatched', 'catalogUnmatched', 'conflicts'], summary)
writeCsv(join(researchDir, 'strong_base_schools.2026.csv'), ['moeCode', 'schoolName', 'inMoePool', 'evidenceYear', 'listedSince', 'sourceTitle', 'sourceUrl', 'sourceDate', 'confidence', 'notes'], strongBaseRows)
meta.counts = { scopeSchools: scope === 'all' ? officialSchools.length : dfc.size, schoolsWithOfferings: bySchool.size, offerings: offerings.length, undergraduateOfferings: offerings.filter((o) => o.level === '本科').length, vocationalOfferings: offerings.filter((o) => o.level === '專科').length, conflicts: offerings.filter((o) => o.conflict).length, catalogPrograms: catalog.programs.length, strongBase: strongBaseRows.length }
meta.doubleFirstClass = { round2Total: dfcRaw.length, inPool: dfc.size, outsidePool: dfcOutsidePool, aliases: DFC_ALIASES }
writeFileSync(join(researchDir, scope === 'all' ? 'program_offerings.2027.all.meta.json' : 'program_offerings.2027.meta.json'), `${JSON.stringify(meta, null, 2)}\n`)
console.log(`\n${offeringsName}: ${offerings.length} 條（本科 ${meta.counts.undergraduateOfferings}／專科 ${meta.counts.vocationalOfferings}；${bySchool.size}/${meta.counts.scopeSchools} 校；衝突 ${meta.counts.conflicts}）；強基 ${strongBaseRows.length} 所；校名不一致 ${meta.nameMismatches.length}`)
