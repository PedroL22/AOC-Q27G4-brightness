import { contextBridge, ipcRenderer } from 'electron'
import type { ColorTemperature, MonitorControlsApi, NumericSetting } from '../shared/monitor.js'

const monitorApi: MonitorControlsApi = {
  getState: () => ipcRenderer.invoke('monitor:get-state'),
  setNumeric: (setting: NumericSetting, value: number) => ipcRenderer.invoke('monitor:set-numeric', setting, value),
  setColorTemperature: (value: ColorTemperature) => ipcRenderer.invoke('monitor:set-color-temperature', value),
  rescan: () => ipcRenderer.invoke('monitor:rescan'),
}

const windowApi = {
  setExpanded: (expanded: boolean) => ipcRenderer.send('window:set-expanded', expanded),
  hide: () => ipcRenderer.send('window:hide'),
}

contextBridge.exposeInMainWorld('monitorControls', monitorApi)
contextBridge.exposeInMainWorld('windowControls', windowApi)
