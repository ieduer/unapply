// 兩個姊妹站共用（逐位元組相同）。每個色系底下的文字都要看得清楚：
// 低於門檻就讓測試失敗，而不是靠目測。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { contrastRatio, themePresets } from '../src/shared-ui/theme.ts'

const TEXT = ['fog100', 'fog200', 'fog300', 'fog400', 'fog500', 'accent600', 'accent500', 'accent400'] as const
const AA = 4.5

test('色系只保留兩套：一淺一深', () => {
  assert.deepEqual(themePresets.map((preset) => preset.scheme).sort(), ['dark', 'light'])
})

for (const preset of themePresets) {
  const p = preset.palette

  test(`${preset.label}：所有文字色在畫布與卡片底上都達 4.5:1`, () => {
    for (const key of TEXT) {
      for (const background of [p.ink950, p.ink900]) {
        const ratio = contrastRatio(p[key], background)
        assert.ok(ratio >= AA, `${preset.id} ${key} on ${background}: ${ratio.toFixed(2)}`)
      }
    }
    assert.ok(contrastRatio(p.fog100, p.ink950) >= 12, '正文對比度')
  })

  test(`${preset.label}：強調色按鈕與停用按鈕上的字看得清`, () => {
    for (const background of [p.accent500, p.accent400]) {
      const ratio = contrastRatio(p.ink950, background)
      assert.ok(ratio >= AA, `${preset.id} button text on ${background}: ${ratio.toFixed(2)}`)
    }
    assert.ok(contrastRatio(p.fog500, p.ink800) >= AA, '停用按鈕')
  })

  test(`${preset.label}：選項與輸入框的邊框分得出來`, () => {
    for (const background of [p.ink950, p.ink900]) {
      const ratio = contrastRatio(p.ink700, background)
      assert.ok(ratio >= 3, `${preset.id} border on ${background}: ${ratio.toFixed(2)}`)
    }
  })
}

test('樣式表的預設值就是紙色，JS 沒跑起來時也可讀', () => {
  const css = readFileSync(new URL('../src/shared-ui/theme.css', import.meta.url), 'utf8')
  const paper = themePresets.find((preset) => preset.id === 'paper')!.palette
  const variable = (name: string) => css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`))?.[1]
  for (const [key, value] of Object.entries(paper)) {
    const name = key.replace(/([a-z]+)(\d+)/, '$1-$2')
    assert.equal(variable(name), value, name)
  }
})
