import { ipcMain } from 'electron'
import { isColorTemperature, isNumericSetting, normalizeStepValue } from '../shared/monitor.js'
import type { MonitorService } from './ddc/monitor-service.js'

export const IPC_CHANNELS = {
  getState: 'monitor:get-state',
  setNumeric: 'monitor:set-numeric',
  setColorTemperature: 'monitor:set-color-temperature',
  rescan: 'monitor:rescan',
} as const

export function registerMonitorIpc(service: MonitorService): void {
  ipcMain.handle(IPC_CHANNELS.getState, () => service.getState())
  ipcMain.handle(IPC_CHANNELS.rescan, () => service.rescan())
  ipcMain.handle(IPC_CHANNELS.setNumeric, (_event, setting: unknown, value: unknown) => {
    if (!isNumericSetting(setting) || typeof value !== 'number') {
      throw new TypeError('Invalid numeric monitor setting')
    }
    return service.setNumeric(setting, normalizeStepValue(value))
  })
  ipcMain.handle(IPC_CHANNELS.setColorTemperature, (_event, value: unknown) => {
    if (!isColorTemperature(value)) {
      throw new TypeError('Invalid color temperature')
    }
    return service.setColorTemperature(value)
  })
}
