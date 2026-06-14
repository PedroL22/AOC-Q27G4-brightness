import type { MonitorControlsApi } from '../shared/monitor'

declare global {
  interface Window {
    monitorControls: MonitorControlsApi
    windowControls: {
      setExpanded(expanded: boolean): void
      hide(): void
    }
  }
}
