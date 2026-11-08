// 色系一鍵切換（2026-11-08 批 G5）：只在 shared-ui 的 themePresets 之間依序循環（目前紙色⇄墨色；日後新增預設就照陣列順序輪下去）。
// 不改 src/shared-ui/（path.bdfz.net 共用、逐位元組相同）。
import { themePresets, type ThemePreset, type ThemeState } from '../shared-ui/theme'

/** 目前色系之後的下一套；找不到目前色系時從第一套開始。 */
export function nextThemePreset(current: ThemeState): ThemePreset {
  const index = themePresets.findIndex((preset) => preset.id === current.presetId)
  return themePresets[(index + 1) % themePresets.length]
}
