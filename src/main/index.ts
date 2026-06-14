import { Menu, Tray, app, ipcMain, nativeImage, powerMonitor, screen } from 'electron'
import { join } from 'node:path'
import { MonitorService } from './ddc/monitor-service.js'
import { registerMonitorIpc } from './ipc.js'
import { WindowManager } from './window-manager.js'

let tray: Tray | null = null
let windowManager: WindowManager | null = null
let isQuitting = false

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) {
  app.quit()
}

const monitorService = new MonitorService()

function createTray(): Tray {
  const iconPath = join(process.resourcesPath, 'tray-icon.svg')
  const developmentIconPath = join(__dirname, '../../resources/tray-icon.svg')
  const icon = nativeImage.createFromPath(app.isPackaged ? iconPath : developmentIconPath)

  const nextTray = new Tray(icon.resize({ width: 20, height: 20 }))
  nextTray.setToolTip('AOC Q27G4 Brightness')
  nextTray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Abrir',
        click: () => {
          void monitorService.getState()
          windowManager?.show()
        },
      },
      {
        label: 'Reescanear monitor',
        click: () => {
          void monitorService.rescan()
        },
      },
      { type: 'separator' },
      {
        label: 'Sair',
        click: () => {
          isQuitting = true
          app.quit()
        },
      },
    ])
  )
  nextTray.on('click', () => {
    if (!windowManager) {
      return
    }
    void monitorService.getState()
    windowManager.toggle()
  })

  return nextTray
}

function enableAutoStart(): void {
  if (!app.isPackaged) {
    return
  }

  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
    args: ['--hidden'],
  })
}

if (singleInstance) {
  app.on('second-instance', () => {
    void monitorService.getState()
    windowManager?.show()
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.pedrol22.aoc-q27g4-brightness')

    if (process.argv.includes('--smoke-test')) {
      void monitorService.getState().then((state) => {
        console.info(JSON.stringify(state))
        app.quit()
      })
      return
    }

    enableAutoStart()
    registerMonitorIpc(monitorService)

    tray = createTray()
    windowManager = new WindowManager(tray)
    const window = windowManager.create()

    ipcMain.on('window:set-expanded', (_event, expanded: unknown) => {
      if (typeof expanded === 'boolean') {
        windowManager?.setExpanded(expanded)
      }
    })
    ipcMain.on('window:hide', () => windowManager?.hide())

    window.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault()
        window.hide()
      }
    })

    powerMonitor.on('resume', () => {
      void monitorService.rescan()
    })
    screen.on('display-added', () => {
      void monitorService.rescan()
    })
    screen.on('display-removed', () => {
      void monitorService.rescan()
    })
  })

  app.on('before-quit', () => {
    isQuitting = true
    windowManager?.destroy()
    tray?.destroy()
  })

  app.on('window-all-closed', () => {})
}
