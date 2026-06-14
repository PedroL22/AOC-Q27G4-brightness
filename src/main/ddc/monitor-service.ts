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

export class MonitorService {
  private state: MonitorState = { ...DISCONNECTED_STATE }
  private ddc: WindowsDdcAdapter | null
  private readonly listeners = new Set<(state: MonitorState) => void>()
  private readonly writes: LatestWriteQueue<WriteKey, WriteValue, MonitorState>

  constructor(ddc: WindowsDdcAdapter | null = null) {
    this.ddc = ddc
    this.writes = new LatestWriteQueue((key, value) => this.performWrite(key, value))
  }

  getCachedState(): MonitorState {
    return { ...this.state }
  }

  async getState(): Promise<MonitorState> {
    return this.getCachedState()
  }

  async rescan(): Promise<MonitorState> {
    return this.refresh()
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
        ddc.withTarget((monitor) => {
          if (key === 'colorTemperature') {
            ddc.setVcp(monitor, VCP_CODES.colorTemperature, COLOR_TEMPERATURE_VCP[value as ColorTemperature])
          } else {
            ddc.setVcp(monitor, VCP_CODES[key], normalizeStepValue(value as number))
          }

          return this.readState(ddc, monitor)
        })
      )
      return this.getCachedState()
    } catch (error) {
      this.setState(this.errorState(error))
      throw error
    }
  }

  private async refresh(): Promise<MonitorState> {
    try {
      const ddc = await this.getDdc()
      this.setState(ddc.withTarget((monitor) => this.readState(ddc, monitor)))
    } catch (error) {
      this.setState(this.errorState(error))
    }
    return this.getCachedState()
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
