import { contextBridge, ipcRenderer } from 'electron'
import type { ColorTemperature, MonitorControlsApi, MonitorState, NumericSetting } from '../shared/monitor.js'
import type { StartupControlsApi } from '../shared/startup.js'

const monitorApi: MonitorControlsApi = {
  getState: () => ipcRenderer.invoke('monitor:get-state'),
  setNumeric: (setting: NumericSetting, value: number) => ipcRenderer.invoke('monitor:set-numeric', setting, value),
  setColorTemperature: (value: ColorTemperature) => ipcRenderer.invoke('monitor:set-color-temperature', value),
  rescan: () => ipcRenderer.invoke('monitor:rescan'),
  onStateChanged: (listener: (state: MonitorState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: MonitorState): void => {
      listener(state)
    }
    ipcRenderer.on('monitor:state-changed', handler)
    return () => ipcRenderer.removeListener('monitor:state-changed', handler)
  },
}

const windowApi = {
  setExpanded: (expanded: boolean) => ipcRenderer.send('window:set-expanded', expanded),
  hide: () => ipcRenderer.send('window:hide'),
  onCollapsed: (listener: () => void) => {
    const handler = (): void => listener()
    ipcRenderer.on('window:collapsed', handler)
    return () => ipcRenderer.removeListener('window:collapsed', handler)
  },
}

const startupApi: StartupControlsApi = {
  getOpenAtLogin: () => ipcRenderer.invoke('startup:get-open-at-login'),
  setOpenAtLogin: (enabled: boolean) => ipcRenderer.invoke('startup:set-open-at-login', enabled),
}

contextBridge.exposeInMainWorld('monitorControls', monitorApi)
contextBridge.exposeInMainWorld('windowControls', windowApi)
contextBridge.exposeInMainWorld('startupControls', startupApi)
