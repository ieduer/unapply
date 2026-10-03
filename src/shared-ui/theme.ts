// 「減法人生」兩個姊妹站（nope.bdfz.net、path.bdfz.net）共用的色系定義。
// 本目錄的檔案在兩個倉庫裡逐位元組相同；改這裡就要兩站一起改（npm run check:shared-ui）。
//
// 每個色系的文字都必須看得清楚：tests/theme-contrast.test.ts 會逐一計算對比度，
// 低於 WCAG AA（4.5:1）就不讓發布。所以這裡只留兩套、也不提供自選強調色——
// 任意顏色無法保證對比度。

export interface ThemePalette {
  /** 畫布底色，也是強調色按鈕上的文字顏色。 */
  ink950: string
  /** 卡片與面板底色。 */
  ink900: string
  /** 淺邊框、分隔線、停用按鈕底色。 */
  ink800: string
  /** 深邊框（輸入框、選項）。 */
  ink700: string
  /** 輔助說明文字。 */
  fog500: string
  fog400: string
  /** 次要正文。 */
  fog300: string
  fog200: string
  /** 主要正文與標題。 */
  fog100: string
  /** 強調色：600 用於淺底上的小字，500 用於按鈕底與重點字，400 用於懸停。 */
  accent600: string
  accent500: string
  accent400: string
}

export interface ThemePreset {
  id: 'paper' | 'ink'
  label: string
  description: string
  scheme: 'light' | 'dark'
  palette: ThemePalette
}

export interface ThemeState {
  presetId: ThemePreset['id']
}

const STORAGE_KEY = 'bdfz.subtraction.theme.v1'

export const themePresets: ThemePreset[] = [
  {
    id: 'paper',
    label: '紙色',
    description: '淺色紙面，深色文字',
    scheme: 'light',
    palette: {
      ink950: '#fbfaf5',
      ink900: '#f3eee5',
      ink800: '#d6ccbf',
      ink700: '#938372',
      fog500: '#5f554e',
      fog400: '#574d46',
      fog300: '#463e38',
      fog200: '#38312c',
      fog100: '#231f1c',
      accent600: '#234848',
      accent500: '#2f5c5c',
      accent400: '#3d6e6e',
    },
  },
  {
    id: 'ink',
    label: '墨色',
    description: '深色底，淺色文字',
    scheme: 'dark',
    palette: {
      ink950: '#12171e',
      ink900: '#1a212b',
      ink800: '#313c4b',
      ink700: '#5d6e85',
      fog500: '#a3adbb',
      fog400: '#b4bdc9',
      fog300: '#c9d0da',
      fog200: '#dde2e9',
      fog100: '#f2f4f7',
      accent600: '#63c9b3',
      accent500: '#7cd9c4',
      accent400: '#9be4d3',
    },
  },
]

export const defaultThemeState: ThemeState = { presetId: 'paper' }

export function getThemePreset(id: ThemePreset['id']): ThemePreset {
  return themePresets.find((preset) => preset.id === id) ?? themePresets[0]
}

export function loadThemeState(): ThemeState {
  if (typeof window === 'undefined') return defaultThemeState
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultThemeState
    const parsed = JSON.parse(raw) as Partial<ThemeState>
    if (!parsed.presetId || !themePresets.some((preset) => preset.id === parsed.presetId)) return defaultThemeState
    return { presetId: parsed.presetId }
  } catch {
    return defaultThemeState
  }
}

export function saveThemeState(state: ThemeState) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 存不下就算了：本次會話的色系照常生效，內容不受影響。
  }
}

const CSS_VARIABLES: Record<keyof ThemePalette, string> = {
  ink950: '--color-ink-950',
  ink900: '--color-ink-900',
  ink800: '--color-ink-800',
  ink700: '--color-ink-700',
  fog500: '--color-fog-500',
  fog400: '--color-fog-400',
  fog300: '--color-fog-300',
  fog200: '--color-fog-200',
  fog100: '--color-fog-100',
  accent600: '--color-accent-600',
  accent500: '--color-accent-500',
  accent400: '--color-accent-400',
}

export function applyThemeState(state: ThemeState) {
  if (typeof document === 'undefined') return
  const preset = getThemePreset(state.presetId)
  const root = document.documentElement
  for (const [key, variable] of Object.entries(CSS_VARIABLES)) {
    root.style.setProperty(variable, preset.palette[key as keyof ThemePalette])
  }
  root.style.colorScheme = preset.scheme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', preset.palette.ink950)
}

/** WCAG 2 相對亮度對比度，供對比度閘門使用。 */
export function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const channel = (offset: number) => {
      const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
  }
  const a = luminance(foreground)
  const b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
