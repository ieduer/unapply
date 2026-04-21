export interface ThemePalette {
  canvasTop: string
  canvasBottom: string
  canvasGlow: string
  ink950: string
  ink900: string
  ink800: string
  ink700: string
  fog500: string
  fog300: string
  fog100: string
  accent500: string
}

export interface ThemePreset {
  id: 'graphite' | 'ember' | 'tide' | 'orchard'
  label: string
  description: string
  palette: ThemePalette
}

export interface ThemeState {
  presetId: ThemePreset['id']
  customAccent?: string
}

const STORAGE_KEY = 'unapply.theme.v1'

export const themePresets: ThemePreset[] = [
  {
    id: 'graphite',
    label: 'Graphite',
    description: '冷灰畫布 + 青綠點綴',
    palette: {
      canvasTop: '#1b2533',
      canvasBottom: '#0d1118',
      canvasGlow: '#25485b',
      ink950: '#101722',
      ink900: '#182231',
      ink800: '#233043',
      ink700: '#314259',
      fog500: '#7d8797',
      fog300: '#b7c0d0',
      fog100: '#eef2f7',
      accent500: '#53d1b6',
    },
  },
  {
    id: 'ember',
    label: 'Ember',
    description: '暖褐畫布 + 琥珀橘',
    palette: {
      canvasTop: '#2c1d17',
      canvasBottom: '#130d0b',
      canvasGlow: '#6f432a',
      ink950: '#1a120f',
      ink900: '#241915',
      ink800: '#34231d',
      ink700: '#463128',
      fog500: '#93857a',
      fog300: '#d2c5bb',
      fog100: '#f8f0ea',
      accent500: '#ff8a4c',
    },
  },
  {
    id: 'tide',
    label: 'Tide',
    description: '深海畫布 + 冷青藍',
    palette: {
      canvasTop: '#123147',
      canvasBottom: '#0a151d',
      canvasGlow: '#1b6284',
      ink950: '#0f1d29',
      ink900: '#152737',
      ink800: '#1d3246',
      ink700: '#28455e',
      fog500: '#7891a1',
      fog300: '#adc5d3',
      fog100: '#edf6fb',
      accent500: '#5bbdf0',
    },
  },
  {
    id: 'orchard',
    label: 'Orchard',
    description: '林地畫布 + 青蘋綠',
    palette: {
      canvasTop: '#18281c',
      canvasBottom: '#0d140e',
      canvasGlow: '#2e5c3d',
      ink950: '#111a13',
      ink900: '#18251c',
      ink800: '#233125',
      ink700: '#314337',
      fog500: '#7f8f79',
      fog300: '#c1d0bb',
      fog100: '#f1f7ee',
      accent500: '#7bc96f',
    },
  },
]

export const defaultThemeState: ThemeState = {
  presetId: 'graphite',
}

function normalizeHex(input: string): string {
  const value = input.trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) return '#53d1b6'
  return value.toLowerCase()
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex)
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0'))
    .join('')}`
}

function mixColors(left: string, right: string, weight: number): string {
  const a = hexToRgb(left)
  const b = hexToRgb(right)
  return rgbToHex(
    a.r + (b.r - a.r) * weight,
    a.g + (b.g - a.g) * weight,
    a.b + (b.b - a.b) * weight,
  )
}

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
    return {
      presetId: parsed.presetId,
      ...(parsed.customAccent ? { customAccent: normalizeHex(parsed.customAccent) } : {}),
    }
  } catch {
    return defaultThemeState
  }
}

export function saveThemeState(state: ThemeState) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function applyThemeState(state: ThemeState) {
  if (typeof document === 'undefined') return
  const preset = getThemePreset(state.presetId)
  const accent500 = state.customAccent ? normalizeHex(state.customAccent) : preset.palette.accent500
  const accent400 = mixColors(accent500, '#ffffff', 0.18)
  const accent600 = mixColors(accent500, '#000000', 0.18)
  const root = document.documentElement

  root.style.setProperty('--color-ink-950', preset.palette.ink950)
  root.style.setProperty('--color-ink-900', preset.palette.ink900)
  root.style.setProperty('--color-ink-800', preset.palette.ink800)
  root.style.setProperty('--color-ink-700', preset.palette.ink700)
  root.style.setProperty('--color-canvas-top', preset.palette.canvasTop)
  root.style.setProperty('--color-canvas-bottom', preset.palette.canvasBottom)
  root.style.setProperty('--color-canvas-glow', mixColors(preset.palette.canvasGlow, accent500, 0.16))
  root.style.setProperty('--color-fog-500', preset.palette.fog500)
  root.style.setProperty('--color-fog-300', preset.palette.fog300)
  root.style.setProperty('--color-fog-100', preset.palette.fog100)
  root.style.setProperty('--color-accent-500', accent500)
  root.style.setProperty('--color-accent-400', accent400)
  root.style.setProperty('--color-accent-600', accent600)

  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', preset.palette.canvasTop)
}
