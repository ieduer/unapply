// 正體→簡體字形轉換（建置期專用；不進執行期包）。
// 字典：scripts/vendor/opencc/TSPhrases.txt（277 條一繁對多簡歧義詞組）＋ TSCharacters.txt（4,113 條字級），Apache-2.0。
// 站規（docs/MAINTENANCE_MANUAL.md §5.3）：只轉字形，不換用詞；官方名稱原文保留由呼叫端決定（不經此函數）。
// 站內例外表 SITE_PHRASES 處理 OpenCC 字級字典會出錯的助詞／多音字（研究 zh-hans.policy.md §3），以 tests/fixtures/zh-hans.fixtures.json 140 條為閘門。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'opencc')

/** 站內詞組校正：優先於 OpenCC 詞組與字級字典。左欄正體原文，右欄期望簡體。 */
export const SITE_PHRASES = [
  // 覆／復／複 → 复（覆蓋、顛覆仍為覆，由字級字典保留）
  ['覆核', '复核'], ['答覆', '答复'], ['回覆', '回复'], ['反覆', '反复'],
  // 助詞「著」→ 着（著名、著作、顯著由字級字典保留為「著」）
  ['帶著', '带着'], ['跟著', '跟着'], ['隨著', '随着'], ['接著', '接着'], ['有著', '有着'], ['沿著', '沿着'],
  ['看著', '看着'], ['朝著', '朝着'], ['向著', '向着'], ['為著', '为着'], ['對著', '对着'], ['照著', '照着'],
  ['順著', '顺着'], ['靠著', '靠着'], ['留著', '留着'], ['守著', '守着'], ['等著', '等着'], ['拿著', '拿着'],
  // 保留（不轉）：乾隆／乾坤／瞭望／狼藉／慰藉
  ['乾隆', '乾隆'], ['乾坤', '乾坤'], ['瞭望', '瞭望'], ['狼藉', '狼藉'], ['慰藉', '慰藉'],
  // 姓氏「於」保留；人名「鍾書」→ 锺（政策 §3）
  ['姓於', '姓於'], ['鍾書', '锺书'],
]

function parseDict(file) {
  const map = new Map()
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue
    const [from, to] = line.replace(/^﻿/, '').split('\t')
    if (!from || !to) continue
    // 多個候選以空白分隔，取第一個（與 OpenCC 一致）
    map.set(from, to.split(/\s+/)[0])
  }
  return map
}

let converter = null

export function loadConverter() {
  if (converter) return converter
  const chars = parseDict(join(VENDOR, 'TSCharacters.txt'))
  const phrases = parseDict(join(VENDOR, 'TSPhrases.txt'))
  for (const [from, to] of SITE_PHRASES) phrases.set(from, to)
  const maxPhrase = Math.max(...[...phrases.keys()].map((k) => [...k].length))
  converter = { chars, phrases, maxPhrase }
  return converter
}

/** 正體文字 → 簡體字形。非 CJK（ASCII、數字、網址、{佔位符}）原樣保留。 */
export function t2s(text) {
  const { chars, phrases, maxPhrase } = loadConverter()
  const cps = [...String(text)]
  let out = ''
  for (let i = 0; i < cps.length;) {
    let matched = false
    for (let len = Math.min(maxPhrase, cps.length - i); len >= 2; len -= 1) {
      const slice = cps.slice(i, i + len).join('')
      const hit = phrases.get(slice)
      if (hit !== undefined) { out += hit; i += len; matched = true; break }
    }
    if (matched) continue
    const ch = cps[i]
    out += chars.get(ch) ?? ch
    i += 1
  }
  return out
}

/** 檢查 fixtures：回傳不一致的條目（空陣列＝全過）。 */
export function checkFixtures(fixturesFile) {
  const fx = JSON.parse(readFileSync(fixturesFile, 'utf8'))
  const rows = Array.isArray(fx) ? fx : fx.fixtures
  return rows.filter((row) => t2s(row.zhHant) !== row.zhHans).map((row) => ({ id: row.id, key: row.key, zhHant: row.zhHant, expected: row.zhHans, got: t2s(row.zhHant) }))
}
