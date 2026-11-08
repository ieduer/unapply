// 色系一鍵切換（2026-11-08 批 G5，nope 專用；tests/theme-contrast.test.ts 與 path 逐位元組共用，不改它）：
// ThemeToggle 只在 shared-ui 的 themePresets 之間依序循環，並且循環到的每一套都通過對比度門檻。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { contrastRatio, themePresets, type ThemeState } from '../src/shared-ui/theme.ts'
import { nextThemePreset } from '../src/lib/themeCycle.ts'

test('切換只在 themePresets 之間依序循環，回到起點', () => {
  let state: ThemeState = { presetId: themePresets[0].id }
  const seen: string[] = [state.presetId]
  for (let i = 0; i < themePresets.length; i += 1) {
    const next = nextThemePreset(state)
    assert.ok(themePresets.includes(next))
    state = { presetId: next.id }
    seen.push(state.presetId)
  }
  assert.deepEqual(seen.slice(0, themePresets.length), themePresets.map((p) => p.id))
  assert.equal(seen.at(-1), themePresets[0].id)
  // 未知的目前色系從第一套開始
  assert.equal(nextThemePreset({ presetId: 'unknown' as ThemeState['presetId'] }).id, themePresets[0].id)
})

test('循環到的每一套色系：文字對畫布／卡片 ≥4.5、按鈕文字 ≥4.5、邊框 ≥3', () => {
  let state: ThemeState = { presetId: themePresets[0].id }
  for (let i = 0; i < themePresets.length; i += 1) {
    const p = themePresets.find((x) => x.id === state.presetId)!.palette
    for (const key of ['fog100', 'fog200', 'fog300', 'fog400', 'fog500', 'accent600', 'accent500', 'accent400'] as const) {
      for (const bg of [p.ink950, p.ink900]) assert.ok(contrastRatio(p[key], bg) >= 4.5, `${state.presetId} ${key}`)
    }
    for (const bg of [p.accent500, p.accent400]) assert.ok(contrastRatio(p.ink950, bg) >= 4.5, `${state.presetId} button`)
    assert.ok(contrastRatio(p.fog500, p.ink800) >= 4.5, `${state.presetId} disabled`)
    assert.ok(contrastRatio(p.fog100, p.ink800) >= 4.5, `${state.presetId} skip chip`)
    for (const bg of [p.ink950, p.ink900]) assert.ok(contrastRatio(p.ink700, bg) >= 3, `${state.presetId} border`)
    state = { presetId: nextThemePreset(state).id }
  }
})

test('頁頭用 ThemeToggle、不再匯入 ThemeCustomizer；切換時關掉 transition', () => {
  const header = readFileSync(new URL('../src/components/SiteHeader.tsx', import.meta.url), 'utf8')
  assert.match(header, /<ThemeToggle \/>/)
  assert.doesNotMatch(header, /ThemeCustomizer/)
  const toggle = readFileSync(new URL('../src/components/ThemeToggle.tsx', import.meta.url), 'utf8')
  assert.match(toggle, /theme-switching/)
  assert.match(toggle, /min-h-\[44px\]/)
  assert.match(readFileSync(new URL('../src/index.css', import.meta.url), 'utf8'), /\.theme-switching \*[\s\S]*transition: none !important/)
})
