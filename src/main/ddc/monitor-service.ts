import {
  COLOR_TEMPERATURE_VCP,
  DISCONNECTED_STATE,
  VCP_CODES,
  colorTemperatureFromVcp,
  normalizeStepValue,
  type ColorTemperature,
  type MonitorState,
  type NumericSetting,
} from '../../shared/monitor.js'
import { LatestWriteQueue } from './latest-write-queue.js'
import type { WindowsDdcAdapter } from './native-windows.js'

type WriteKey = NumericSetting | 'colorTemperature'
type WriteValue = number | ColorTemperature
type PhysicalMonitor = Parameters<Parameters<WindowsDdcAdapter['withTarget']>[0]>[0]

/** Delay before each automatic discovery attempt; the last value repeats forever. */
export const RETRY_DELAYS_MS: readonly number[] = [5_000, 10_000, 20_000, 30_000, 60_000]

export class MonitorService {
  private state: MonitorState = { ...DISCONNECTED_STATE }
  private ddc: WindowsDdcAdapter | null
  private readonly listeners = new Set<(state: MonitorState) => void>()
  private readonly writes: LatestWriteQueue<WriteKey, WriteValue, MonitorState>
  private readonly retryDelaysMs: readonly number[]
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private retryAttempt = 0

  constructor(ddc: WindowsDdcAdapter | null = null, retryDelaysMs: readonly number[] = RETRY_DELAYS_MS) {
    this.ddc = ddc
    this.retryDelaysMs = retryDelaysMs
    this.writes = new LatestWriteQueue((key, value) => this.performWrite(key, value))
  }

  getCachedState(): MonitorState {
    return { ...this.state }
  }

  async getState(): Promise<MonitorState> {
    return this.getCachedState()
  }

  async rescan(): Promise<MonitorState> {
    this.cancelRetry()
    this.retryAttempt = 0
    return this.refresh()
  }

  /** Stops the automatic discovery loop. */
  dispose(): void {
    this.cancelRetry()
  }

  subscribe(listener: (state: MonitorState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async setNumeric(setting: NumericSetting, value: number): Promise<MonitorState> {
    return this.writes.enqueue(setting, normalizeStepValue(value))
  }

  async setColorTemperature(value: ColorTemperature): Promise<MonitorState> {
    return this.writes.enqueue('colorTemperature', value)
  }

  private async performWrite(key: WriteKey, value: WriteValue): Promise<MonitorState> {
    try {
      const ddc = await this.getDdc()
      this.setState(
        this.withRetrySchedule(
          ddc.withTarget((monitor) => {
            if (key === 'colorTemperature') {
              ddc.setVcp(monitor, VCP_CODES.colorTemperature, COLOR_TEMPERATURE_VCP[value as ColorTemperature])
            } else {
              ddc.setVcp(monitor, VCP_CODES[key], normalizeStepValue(value as number))
            }

            return this.readState(ddc, monitor)
          })
        )
      )
      return this.getCachedState()
    } catch (error) {
      this.setState(this.withRetrySchedule(this.errorState(error)))
      throw error
    }
  }

  private async refresh(): Promise<MonitorState> {
    let nextState: MonitorState
    try {
      const ddc = await this.getDdc()
      nextState = ddc.withTarget((monitor) => this.readState(ddc, monitor))
    } catch (error) {
      nextState = this.errorState(error)
    }
    this.setState(this.withRetrySchedule(nextState))
    return this.getCachedState()
  }

  /** Keeps searching for the monitor while it stays unavailable, backing off between attempts. */
  private withRetrySchedule(state: MonitorState): MonitorState {
    this.cancelRetry()

    if (state.connected) {
      this.retryAttempt = 0
      return state
    }

    const delay = this.retryDelaysMs[Math.min(this.retryAttempt, this.retryDelaysMs.length - 1)] ?? 0
    this.retryAttempt += 1
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      void this.refresh()
    }, delay)
    this.retryTimer.unref?.()

    return { ...state, nextRetryAt: Date.now() + delay }
  }

  private cancelRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  private async getDdc(): Promise<WindowsDdcAdapter> {
    if (this.ddc) {
      return this.ddc
    }

    const { NativeWindowsDdcAdapter } = await import('./native-windows.js')
    this.ddc = new NativeWindowsDdcAdapter()
    return this.ddc
  }

  private setState(state: MonitorState): void {
    this.state = state
    const snapshot = this.getCachedState()
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }

  private readState(ddc: WindowsDdcAdapter, monitor: PhysicalMonitor): MonitorState {
    const brightness = ddc.getVcp(monitor, VCP_CODES.brightness)
    const contrast = ddc.getVcp(monitor, VCP_CODES.contrast)
    const sharpness = ddc.getVcp(monitor, VCP_CODES.sharpness)
    const colorTemperature = ddc.getVcp(monitor, VCP_CODES.colorTemperature)

    return {
      initialized: true,
      connected: true,
      model: monitor.model,
      brightness: normalizeStepValue(brightness.current),
      contrast: normalizeStepValue(contrast.current),
      sharpness: normalizeStepValue(sharpness.current),
      colorTemperature: colorTemperatureFromVcp(colorTemperature.current),
    }
  }

  private errorState(error: unknown): MonitorState {
    const message = error instanceof Error ? error.message : 'Unknown DDC/CI error'
    return {
      ...DISCONNECTED_STATE,
      initialized: true,
      error: message,
    }
  }
}
