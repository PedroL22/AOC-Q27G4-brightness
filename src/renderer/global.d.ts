import type { MonitorControlsApi } from '../shared/monitor'
import type { StartupControlsApi } from '../shared/startup'

declare global {
  interface Window {
    monitorControls: MonitorControlsApi
    startupControls: StartupControlsApi
    windowControls: {
      setExpanded(expanded: boolean): void
      hide(): void
      onCollapsed(listener: () => void): () => void
    }
  }
}
