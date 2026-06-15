import { Menu, Tray, app, ipcMain, nativeImage, powerMonitor, screen } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MonitorService } from './ddc/monitor-service.js'
import { IPC_CHANNELS, registerMonitorIpc } from './ipc.js'
import { WindowManager } from './window-manager.js'

let tray: Tray | null = null
let windowManager: WindowManager | null = null

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) {
  app.quit()
}

const monitorService = new MonitorService()

function createTray(): Tray {
  const icon = loadTrayIcon('loading')

  const nextTray = new Tray(icon)
  nextTray.setToolTip('AOC Q27G4 Brightness - Initializing')
  nextTray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Open',
        click: () => windowManager?.show(),
      },
      {
        label: 'Rescan monitor',
        click: () => {
          void monitorService.rescan()
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit()
        },
      },
    ])
  )
  nextTray.on('click', () => {
    if (!windowManager) {
      return
    }
    windowManager.toggle()
  })

  return nextTray
}

function loadTrayIcon(name: 'loading' | 'ready'): Electron.NativeImage {
  const fileName = `tray-${name}.png`
  const iconPath = app.isPackaged ? join(process.resourcesPath, fileName) : join(__dirname, '../../resources', fileName)
  return nativeImage.createFromPath(iconPath).resize({ width: 20, height: 20 })
}

interface AppPreferences {
  openAtLogin: boolean
}

function readPreferences(): AppPreferences {
  try {
    const contents = readFileSync(join(app.getPath('userData'), 'preferences.json'), 'utf8')
    const preferences = JSON.parse(contents) as Partial<AppPreferences>
    return {
      openAtLogin: typeof preferences.openAtLogin === 'boolean' ? preferences.openAtLogin : true,
    }
  } catch {
    return { openAtLogin: true }
  }
}

function setOpenAtLogin(enabled: boolean): boolean {
  writeFileSync(join(app.getPath('userData'), 'preferences.json'), JSON.stringify({ openAtLogin: enabled }, null, 2))

  if (!app.isPackaged) {
    return enabled
  }

  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true,
    args: ['--hidden'],
  })

  return app.getLoginItemSettings().openAtLogin
}

function registerStartupIpc(): void {
  ipcMain.handle('startup:get-open-at-login', () => readPreferences().openAtLogin)
  ipcMain.handle('startup:set-open-at-login', (_event, enabled: unknown) => {
    if (typeof enabled !== 'boolean') {
      throw new TypeError('Invalid startup setting')
    }
    return setOpenAtLogin(enabled)
  })
}

if (singleInstance) {
  app.on('second-instance', () => {
    windowManager?.show()
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.pedrol22.aoc-q27g4-brightness')

    if (process.argv.includes('--smoke-test')) {
      void monitorService.rescan().then((state) => {
        console.info(JSON.stringify(state))
        app.quit()
      })
      return
    }

    setOpenAtLogin(readPreferences().openAtLogin)
    registerMonitorIpc(monitorService)
    registerStartupIpc()

    tray = createTray()
    windowManager = new WindowManager(tray)
    const window = windowManager.create()
    let initializationAnnounced = false

    monitorService.subscribe((state) => {
      window.webContents.send(IPC_CHANNELS.stateChanged, state)

      if (!state.initialized || !tray) {
        return
      }

      tray.setImage(loadTrayIcon(state.connected ? 'ready' : 'loading'))
      tray.setToolTip(
        state.connected
          ? `AOC Q27G4 Brightness - ${state.model ?? 'Monitor ready'}`
          : 'AOC Q27G4 Brightness - Monitor not found'
      )

      if (!initializationAnnounced) {
        initializationAnnounced = true
        tray.displayBalloon({
          title: 'AOC Q27G4 Brightness',
          content: state.connected
            ? `${state.model ?? 'Monitor'} is ready.`
            : 'Application started. No compatible monitor was found.',
          noSound: true,
        })
      }
    })

    ipcMain.on('window:set-expanded', (_event, expanded: unknown) => {
      if (typeof expanded === 'boolean') {
        windowManager?.setExpanded(expanded)
      }
    })
    ipcMain.on('window:hide', () => windowManager?.hide())

    powerMonitor.on('resume', () => {
      void monitorService.rescan()
    })
    screen.on('display-added', () => {
      void monitorService.rescan()
    })
    screen.on('display-removed', () => {
      void monitorService.rescan()
    })

    void monitorService.rescan()
  })

  app.on('before-quit', () => {
    windowManager?.destroy()
    tray?.destroy()
  })

  app.on('window-all-closed', () => {})
}
