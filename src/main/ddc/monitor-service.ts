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
import { NativeWindowsDdcAdapter, type WindowsDdcAdapter } from './native-windows.js'

type WriteKey = NumericSetting | 'colorTemperature'
type WriteValue = number | ColorTemperature

export class MonitorService {
  private state: MonitorState = { ...DISCONNECTED_STATE }
  private readonly writes: LatestWriteQueue<WriteKey, WriteValue, MonitorState>

  constructor(private readonly ddc: WindowsDdcAdapter = new NativeWindowsDdcAdapter()) {
    this.writes = new LatestWriteQueue((key, value) => this.performWrite(key, value))
  }

  getCachedState(): MonitorState {
    return { ...this.state }
  }

  async getState(): Promise<MonitorState> {
    return this.refresh()
  }

  async rescan(): Promise<MonitorState> {
    return this.refresh()
  }

  async setNumeric(setting: NumericSetting, value: number): Promise<MonitorState> {
    return this.writes.enqueue(setting, normalizeStepValue(value))
  }

  async setColorTemperature(value: ColorTemperature): Promise<MonitorState> {
    return this.writes.enqueue('colorTemperature', value)
  }

  private async performWrite(key: WriteKey, value: WriteValue): Promise<MonitorState> {
    try {
      this.state = this.ddc.withTarget((monitor) => {
        if (key === 'colorTemperature') {
          this.ddc.setVcp(monitor, VCP_CODES.colorTemperature, COLOR_TEMPERATURE_VCP[value as ColorTemperature])
        } else {
          this.ddc.setVcp(monitor, VCP_CODES[key], normalizeStepValue(value as number))
        }

        return this.readState(monitor)
      })
      return this.getCachedState()
    } catch (error) {
      this.state = this.errorState(error)
      throw error
    }
  }

  private async refresh(): Promise<MonitorState> {
    try {
      this.state = this.ddc.withTarget((monitor) => this.readState(monitor))
    } catch (error) {
      this.state = this.errorState(error)
    }
    return this.getCachedState()
  }

  private readState(monitor: Parameters<Parameters<WindowsDdcAdapter['withTarget']>[0]>[0]): MonitorState {
    const brightness = this.ddc.getVcp(monitor, VCP_CODES.brightness)
    const contrast = this.ddc.getVcp(monitor, VCP_CODES.contrast)
    const sharpness = this.ddc.getVcp(monitor, VCP_CODES.sharpness)
    const colorTemperature = this.ddc.getVcp(monitor, VCP_CODES.colorTemperature)

    return {
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
      error: message,
    }
  }
}
