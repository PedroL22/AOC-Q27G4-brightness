export const NUMERIC_SETTINGS = ['brightness', 'contrast', 'sharpness'] as const

export const COLOR_TEMPERATURES = ['srgb', 'warm', 'normal', 'cool', 'userRgb'] as const

export type NumericSetting = (typeof NUMERIC_SETTINGS)[number]
export type ColorTemperature = (typeof COLOR_TEMPERATURES)[number]

export interface MonitorState {
  connected: boolean
  model: string | null
  brightness: number | null
  contrast: number | null
  sharpness: number | null
  colorTemperature: ColorTemperature | null
  error?: string
}

export interface MonitorControlsApi {
  getState(): Promise<MonitorState>
  setNumeric(setting: NumericSetting, value: number): Promise<MonitorState>
  setColorTemperature(value: ColorTemperature): Promise<MonitorState>
  rescan(): Promise<MonitorState>
}

export const VCP_CODES: Record<NumericSetting | 'colorTemperature', number> = {
  brightness: 0x10,
  contrast: 0x12,
  colorTemperature: 0x14,
  sharpness: 0x87,
}

export const COLOR_TEMPERATURE_VCP: Record<ColorTemperature, number> = {
  srgb: 1,
  warm: 5,
  normal: 6,
  cool: 8,
  userRgb: 11,
}

const VCP_COLOR_TEMPERATURE = new Map(
  Object.entries(COLOR_TEMPERATURE_VCP).map(([name, value]) => [value, name as ColorTemperature])
)

export const DISCONNECTED_STATE: MonitorState = {
  connected: false,
  model: null,
  brightness: null,
  contrast: null,
  sharpness: null,
  colorTemperature: null,
}

export function normalizeStepValue(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError('Value must be a finite number')
  }

  return Math.min(100, Math.max(0, Math.round(value / 5) * 5))
}

export function isNumericSetting(value: unknown): value is NumericSetting {
  return typeof value === 'string' && (NUMERIC_SETTINGS as readonly string[]).includes(value)
}

export function isColorTemperature(value: unknown): value is ColorTemperature {
  return typeof value === 'string' && (COLOR_TEMPERATURES as readonly string[]).includes(value)
}

export function colorTemperatureFromVcp(value: number): ColorTemperature | null {
  return VCP_COLOR_TEMPERATURE.get(value) ?? null
}

export function parseCapabilities(capabilities: string): {
  model: string | null
  vcpCodes: Set<number>
} {
  const model = capabilities.match(/\bmodel\(([^)]+)\)/i)?.[1]?.trim() ?? null
  const vcpBody = capabilities.match(/\bvcp\((.*)\)mswhql/i)?.[1] ?? ''
  const vcpCodes = new Set<number>()
  let depth = 0
  let token = ''

  const commitToken = (): void => {
    if (depth === 0 && /^[0-9A-F]{2}$/i.test(token)) {
      vcpCodes.add(Number.parseInt(token, 16))
    }
    token = ''
  }

  for (const character of `${vcpBody} `) {
    if (character === '(') {
      commitToken()
      depth += 1
    } else if (character === ')') {
      commitToken()
      depth = Math.max(0, depth - 1)
    } else if (/\s/.test(character)) {
      commitToken()
    } else {
      token += character
    }
  }

  return { model, vcpCodes }
}

export function isTargetMonitor(model: string | null): boolean {
  return model !== null && /^AOC Q27G4N?$/i.test(model.trim())
}
