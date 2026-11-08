// 開發期工具（批 G6）：把教育局「2026/27 學年內地高校招收香港中學文憑考試學生計劃 參與院校名單」PDF 轉成可審核的 CSV。
// 需要本機 poppler 的 pdftotext（只在更新名單時跑；建置不跑本檔，只讀它產出的 CSV）。
//   node scripts/extract_hk_dse_participation.mjs
// 原檔：data/research/participation/edb_hk_dse_scheme_2026_27_list.pdf（SHA-256 釘在 build_participation_lists.mjs）
// 產出：data/research/participation/hk_dse_scheme_2026_27.csv（省、繁體校名、英文名、是否新增、教育部名單 id、對應方式）
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { t2s } from './lib/t2s.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pdf = join(root, 'data/research/participation/edb_hk_dse_scheme_2026_27_list.pdf')
const out = join(root, 'data/research/participation/hk_dse_scheme_2026_27.csv')
const schools = JSON.parse(readFileSync(join(root, 'public/data/runtime/schools.json'), 'utf8'))
const byName = new Map()
for (const s of schools) for (const name of [s.name, s.nameSimplified]) if (name) byName.set(name, s)

// 名單寫法與教育部 2026 名單不同的兩所（同一學校標識碼，人工核對）：
const ALIASES = {
  '紹興文理學院': { name: '绍兴大学', reason: '教育部 2026 名單更名（data/research/moe_former_names.2026-06-17.csv：4133010349 绍兴文理学院→绍兴大学）' },
  '廈門華夏學院': { name: '厦门华厦学院', reason: '教育局名單寫作「華夏」，教育部名單為「华厦」（厦门，4135012709；英文名 Xiamen Huaxia University 相同）' },
}

const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' })
const rows = []
let province = ''
for (const raw of text.split('\n')) {
  const line = raw.replace(/\f/g, '').trim()
  const m = /^(\S+?)(\*)?\s{2,}(.+?)(\*)?$/.exec(line)
  if (!m) continue
  const zh = m[1]
  if (/(市|省|自治區)$/.test(zh) && /(Municipality|Province|Region)$/.test(m[3])) { province = zh; continue }
  if (!/(大學|學院|學校)(（[^）]+）)?$/.test(zh)) continue
  const alias = ALIASES[zh]
  const school = alias ? byName.get(alias.name) : byName.get(zh) ?? byName.get(t2s(zh))
  if (!school) throw new Error(`unmatched: ${zh}`)
  const match = alias ? `alias: ${alias.reason}` : byName.get(zh) ? 'exact' : 'zh-Hans'
  rows.push([province, zh, m[3].trim(), m[2] || m[4] ? '1' : '0', school.id, match])
}
const csv = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
writeFileSync(out, ['province,nameZhHant,nameEn,isNew,schoolId,match', ...rows.map((r) => r.map(csv).join(','))].join('\n') + '\n')
console.log(JSON.stringify({ rows: rows.length, newlyJoined: rows.filter((r) => r[3] === '1').length, aliases: rows.filter((r) => r[5].startsWith('alias')).length, out }))
