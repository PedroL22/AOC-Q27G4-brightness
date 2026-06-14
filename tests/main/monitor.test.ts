import { describe, expect, it } from 'vitest'
import {
  colorTemperatureFromVcp,
  isColorTemperature,
  isNumericSetting,
  isTargetMonitor,
  normalizeStepValue,
  parseCapabilities,
} from '../../src/shared/monitor.js'

describe('monitor contracts', () => {
  it.each([
    [-20, 0],
    [0, 0],
    [2, 0],
    [3, 5],
    [47, 45],
    [48, 50],
    [99, 100],
    [140, 100],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeStepValue(input)).toBe(expected)
  })

  it('rejects non-finite values', () => {
    expect(() => normalizeStepValue(Number.NaN)).toThrow(TypeError)
    expect(() => normalizeStepValue(Number.POSITIVE_INFINITY)).toThrow(TypeError)
  })

  it('validates IPC enum values', () => {
    expect(isNumericSetting('brightness')).toBe(true)
    expect(isNumericSetting('volume')).toBe(false)
    expect(isColorTemperature('userRgb')).toBe(true)
    expect(isColorTemperature('adobeRgb')).toBe(false)
  })

  it('maps color preset values', () => {
    expect(colorTemperatureFromVcp(1)).toBe('srgb')
    expect(colorTemperatureFromVcp(5)).toBe('warm')
    expect(colorTemperatureFromVcp(6)).toBe('normal')
    expect(colorTemperatureFromVcp(8)).toBe('cool')
    expect(colorTemperatureFromVcp(11)).toBe('userRgb')
    expect(colorTemperatureFromVcp(14)).toBeNull()
  })

  it('parses the Q27G4 capabilities string', () => {
    const parsed = parseCapabilities(
      '(prot(monitor)type(LCD)model(AOC Q27G4N)cmds(01 02)vcp(02 10 12 14(01 05 06 08 0B) 87 D6(01 04 05))mswhql(1)mccs_ver(2.2))'
    )

    expect(parsed.model).toBe('AOC Q27G4N')
    expect([...parsed.vcpCodes]).toEqual([0x02, 0x10, 0x12, 0x14, 0x87, 0xd6])
    expect(isTargetMonitor(parsed.model)).toBe(true)
    expect(isTargetMonitor('AOC Q27G4')).toBe(true)
    expect(isTargetMonitor('Generic PnP Monitor')).toBe(false)
  })
})
