import { describe, expect, it, vi } from 'vitest'
import { MonitorService } from '../../src/main/ddc/monitor-service.js'
import type { WindowsDdcAdapter } from '../../src/main/ddc/native-windows.js'
import { VCP_CODES } from '../../src/shared/monitor.js'

function createAdapter() {
  const values = new Map<number, number>([
    [VCP_CODES.brightness, 13],
    [VCP_CODES.contrast, 50],
    [VCP_CODES.sharpness, 0],
    [VCP_CODES.colorTemperature, 5],
  ])
  const monitor = {
    handle: 1n,
    description: 'Generic PnP Monitor',
    model: 'AOC Q27G4N',
    capabilities: 'model(AOC Q27G4N)',
  }

  return {
    values,
    adapter: {
      withTarget: vi.fn((operation: (target: typeof monitor) => unknown) => operation(monitor)),
      getVcp: vi.fn((_target: typeof monitor, code: number) => ({
        current: values.get(code) ?? 0,
        maximum: 100,
      })),
      setVcp: vi.fn((_target: typeof monitor, code: number, value: number) => {
        values.set(code, value)
      }),
    },
  }
}

describe('MonitorService', () => {
  it('reads and normalizes the current monitor state', async () => {
    const { adapter } = createAdapter()
    const service = new MonitorService(adapter as unknown as WindowsDdcAdapter)

    await expect(service.rescan()).resolves.toEqual({
      initialized: true,
      connected: true,
      model: 'AOC Q27G4N',
      brightness: 15,
      contrast: 50,
      sharpness: 0,
      colorTemperature: 'warm',
    })
  })

  it('writes numeric values as multiples of five', async () => {
    vi.useFakeTimers()
    const { adapter } = createAdapter()
    const service = new MonitorService(adapter as unknown as WindowsDdcAdapter)

    const result = service.setNumeric('brightness', 23)
    await vi.advanceTimersByTimeAsync(60)
    await result

    expect(adapter.setVcp).toHaveBeenCalledWith(expect.anything(), VCP_CODES.brightness, 25)
    vi.useRealTimers()
  })

  it('returns a disconnected state after discovery failure', async () => {
    const { adapter } = createAdapter()
    adapter.withTarget.mockImplementation(() => {
      throw new Error('AOC Q27G4 not found')
    })
    const service = new MonitorService(adapter as unknown as WindowsDdcAdapter)

    await expect(service.rescan()).resolves.toMatchObject({
      initialized: true,
      connected: false,
      model: null,
      error: 'AOC Q27G4 not found',
    })
  })
})
