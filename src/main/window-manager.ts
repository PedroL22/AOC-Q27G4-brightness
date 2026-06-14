import { BrowserWindow, screen, type Rectangle, type Tray } from 'electron'
import { join } from 'node:path'

const COMPACT_SIZE = { width: 380, height: 158 }
const EXPANDED_SIZE = { width: 760, height: 326 }
const TASKBAR_GAP = 10

export class WindowManager {
  private window: BrowserWindow | null = null

  constructor(private readonly tray: Tray) {}

  create(): BrowserWindow {
    const window = new BrowserWindow({
      ...COMPACT_SIZE,
      show: false,
      frame: false,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      backgroundColor: '#18191d',
      roundedCorners: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    this.window = window

    window.on('close', (event) => {
      if (!window.isDestroyed()) {
        event.preventDefault()
        window.hide()
      }
    })
    window.on('blur', () => {
      if (!this.window?.webContents.isDevToolsOpened()) {
        this.window?.hide()
      }
    })

    if (process.env.ELECTRON_RENDERER_URL) {
      void window.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
      void window.loadFile(join(__dirname, '../renderer/index.html'))
    }

    return window
  }

  show(): void {
    if (!this.window || this.window.isDestroyed()) {
      return
    }

    this.position()
    this.window.show()
    this.window.focus()
  }

  hide(): void {
    this.window?.hide()
  }

  toggle(): void {
    if (this.window?.isVisible()) {
      this.hide()
    } else {
      this.show()
    }
  }

  setExpanded(expanded: boolean): void {
    if (!this.window || this.window.isDestroyed()) {
      return
    }

    const size = expanded ? EXPANDED_SIZE : COMPACT_SIZE
    this.window.setSize(size.width, size.height, false)
    this.position()
  }

  destroy(): void {
    if (!this.window || this.window.isDestroyed()) {
      return
    }

    this.window.removeAllListeners('close')
    this.window.destroy()
    this.window = null
  }

  private position(): void {
    if (!this.window || this.window.isDestroyed()) {
      return
    }

    const trayBounds = this.tray.getBounds()
    const windowBounds = this.window.getBounds()
    const display = screen.getDisplayNearestPoint({
      x: Math.round(trayBounds.x + trayBounds.width / 2),
      y: Math.round(trayBounds.y + trayBounds.height / 2),
    })
    const workArea = display.workArea

    const x = this.clamp(
      Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2),
      workArea.x,
      workArea.x + workArea.width - windowBounds.width
    )
    const y = this.resolveVerticalPosition(trayBounds, workArea, windowBounds.height)

    this.window.setPosition(x, y, false)
  }

  private resolveVerticalPosition(trayBounds: Rectangle, workArea: Rectangle, windowHeight: number): number {
    const taskbarBelow = trayBounds.y >= workArea.y + Math.floor(workArea.height / 2)

    if (taskbarBelow) {
      return Math.max(workArea.y, trayBounds.y - windowHeight - TASKBAR_GAP)
    }

    return Math.min(workArea.y + workArea.height - windowHeight, trayBounds.y + trayBounds.height + TASKBAR_GAP)
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value))
  }
}
