// 查詢層（2026-11-08 批 G7，路線圖目標第 4 條「可檢索招生等情況」）：產生 src/data/searchLayer.ts。
// 不複製任何院校資料——院校名稱與層級在執行期讀 /db/v1 的 institutions＋crosswalk；這裡只產生：
//   1 簡繁折疊表：與 data:i18n 同一套 OpenCC TSCharacters（scripts/lib/t2s.mjs），只留查詢語料用得到的字（正體→簡體）。
//   2 別名：站方整理的常見簡稱與英文縮寫（data/research/search/school_aliases.<日期>.csv），每條必須唯一對到一筆院校。
//   3 舊名：教育部 2025／2026 名單同一學校標識碼比對（data/research/moe_former_names.<日期>.csv，官方）。
//   4 國標專業類 → GRAS 學科對照：站方對照、不是官方對照（data/research/search/major_class_gras_map.<日期>.csv），92 類一類一列。
// fail-closed：對照表的類與目錄不一致、GRAS 代碼不存在、別名對不到或對到多筆、舊名的學校不在名單，都 exit 1。
//   node scripts/build_search_layer.mjs
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConverter } from './lib/t2s.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const json = (p) => JSON.parse(read(p))
const fail = (message) => { console.error(`build_search_layer: ${message}`); process.exit(1) }

const MAP_FILE = 'data/research/search/major_class_gras_map.2026-11-08.csv'
const ALIAS_FILE = 'data/research/search/school_aliases.2026-11-08.csv'
const FORMER_FILE = 'data/research/moe_former_names.2026-06-17.csv'

function csv(path) {
  const [head, ...rows] = read(path).trim().split('\n')
  const cols = head.split(',')
  return rows.map((line) => {
    const cells = line.split(',')
    // 最後一欄（備註）可能含逗號：多出來的併回最後一欄
    const fixed = [...cells.slice(0, cols.length - 1), cells.slice(cols.length - 1).join(',')]
    return Object.fromEntries(cols.map((c, i) => [c, (fixed[i] ?? '').trim()]))
  })
}

const latest = json('public/db/v1/latest.json')
const base = latest.base.replace(/^\//, 'public/')
const institutions = json(`${base}institutions.json`).records
const catalog = json('public/data/programs/catalog.json')
const atlas = json('public/data/atlas/world-atlas.json')

// ---- 2 國標專業類 → GRAS
const subjectCodes = new Set(atlas.subjects.map((s) => s.code))
const mapRows = csv(MAP_FILE)
if (mapRows.length !== catalog.classes.length) fail(`map has ${mapRows.length} classes, catalog ${catalog.classes.length}`)
const classGras = {}
const classGrasNote = {}
for (const klass of catalog.classes) {
  const row = mapRows.find((r) => r.classCode === klass.code)
  if (!row) fail(`class ${klass.code} ${klass.name} missing from the map`)
  if (row.className !== klass.name) fail(`class ${klass.code}: map name ${row.className} ≠ catalog ${klass.name}`)
  const codes = row.grasCodes ? row.grasCodes.split('|') : []
  for (const code of codes) if (!subjectCodes.has(code)) fail(`class ${klass.code}: GRAS code ${code} not in the atlas`)
  if (!codes.length && !row.note) fail(`class ${klass.code}: no GRAS subject needs a note`)
  classGras[klass.code] = codes
  if (row.note) classGrasNote[klass.code] = row.note
}

// ---- 3 別名
const byId = new Map(institutions.map((r) => [r.id, r]))
const moeByName = new Map()
for (const r of institutions) if (r.scheme === 'moe') {
  const name = r.name.zhHans
  if (moeByName.has(name)) moeByName.set(name, null) // 同名：不許作別名目標
  else moeByName.set(name, r.id)
}
const aliasRows = csv(ALIAS_FILE)
const aliases = []
const seenAlias = new Set()
for (const row of aliasRows) {
  if (!row.alias) fail('empty alias')
  const key = row.alias.toLowerCase()
  if (seenAlias.has(key)) fail(`duplicate alias ${row.alias}`)
  seenAlias.add(key)
  const [scheme, ...rest] = row.target.split(':')
  const ref = rest.join(':')
  let id = null
  if (scheme === 'moe') id = moeByName.get(ref)
  else if (scheme === 'hkmotw' || scheme === 'gras') id = byId.has(`${scheme}:${ref}`) ? `${scheme}:${ref}` : null
  if (!id) fail(`alias ${row.alias}: target ${row.target} does not resolve to exactly one institution`)
  aliases.push([row.alias, id])
}

// ---- 4 舊名
const formerRows = csv(FORMER_FILE)
const formerNames = []
for (const row of formerRows) {
  const id = `moe:${row.moeCode}`
  const rec = byId.get(id)
  if (!rec) fail(`former name ${row.formerName}: ${id} not in the institutions list`)
  if (moeByName.get(row.formerName)) fail(`former name ${row.formerName} is another listed school's current name`)
  formerNames.push([row.formerName, id])
}

// ---- 1 簡繁折疊表（正體 → 簡體），只留語料用得到的字
const { chars } = loadConverter()
const corpus = new Set()
const add = (text) => { for (const ch of String(text ?? '')) if (/\p{Script=Han}/u.test(ch)) corpus.add(ch) }
for (const r of institutions) for (const v of Object.values(r.name)) add(v)
for (const c of catalog.classes) add(c.name)
for (const p of catalog.programs) add(p.name)
for (const s of atlas.subjects) { add(s.nameZh); add(s.nameZhHans) }
for (const [alias] of aliases) add(alias)
for (const [name] of formerNames) add(name)
const simplified = new Set([...corpus].map((ch) => chars.get(ch) ?? ch))
const pairs = []
for (const [from, to] of [...chars.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
  if ([...from].length !== 1 || [...to].length !== 1 || from === to) continue
  if (corpus.has(from) || simplified.has(to)) pairs.push(from + to)
}

const layer = {
  sources: {
    fold: 'scripts/vendor/opencc/TSCharacters.txt（Apache-2.0，與 data:i18n 同一份）',
    aliases: ALIAS_FILE,
    formerNames: FORMER_FILE,
    classGras: MAP_FILE,
    db: latest.base,
  },
  dbVersion: latest.version,
  foldPairs: pairs.join(''),
  aliases,
  formerNames,
  classGras,
  classGrasNote,
}
const version = createHash('sha256').update(JSON.stringify(layer)).digest('hex').slice(0, 12)
const out = `// Generated by scripts/build_search_layer.mjs. Do not edit by hand.\n// 查詢層（批 G7）：簡繁折疊表、別名（站方整理）、舊名（教育部）、國標專業類 → GRAS 學科（站方對照，非官方）。院校資料本身在 /db/v1。\nexport const searchLayer = ${JSON.stringify({ version, ...layer }, null, 1)} as const\n`
writeFileSync(join(root, 'src/data/searchLayer.ts'), out)
const mapped = Object.values(classGras).filter((c) => c.length).length
console.log(JSON.stringify({ version, foldPairs: pairs.length, aliases: aliases.length, formerNames: formerNames.length, classes: catalog.classes.length, mappedClasses: mapped, unmappedClasses: catalog.classes.length - mapped, bytes: out.length }))
