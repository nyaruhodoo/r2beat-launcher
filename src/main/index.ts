import { app, shell, BrowserWindow, Tray, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../build/game.ico?asset'
import { ipcHandlers } from './ipc-handlers'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function showFromTray(window: BrowserWindow) {
  // 从托盘恢复时，仅通过 restore() 恢复窗口，避免 hide/show 带来的闪烁和状态异常
  window.setSkipTaskbar(false)

  if (window.isMinimized()) {
    window.restore()
  } else if (!window.isVisible()) {
    window.restore()
  }

  window.focus()
}

function hideToTray(window: BrowserWindow) {
  // 通过「最小化 + 隐藏任务栏图标」的方式驻留托盘，不调用 hide()，避免状态错乱
  window.setSkipTaskbar(true)
  if (!window.isMinimized()) {
    window.minimize()
  }
}

function createTray(window: BrowserWindow) {
  if (tray) {
    return tray
  }

  // 使用与窗口相同的图标
  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示启动器',
      click: () => {
        showFromTray(window)
      }
    },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        // 先关闭主窗口，再退出应用，确保触发正常的清理逻辑
        if (mainWindow) {
          mainWindow.close()
        } else {
          app.quit()
        }
      }
    }
  ])

  tray.setToolTip('r2beat-launcher')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    showFromTray(window)
  })

  return tray
}

function createWindow() {
  // Create the browser window.
  const window = new BrowserWindow({
    width: 1280 * 0.9,
    height: 720 * 0.9,
    minWidth: 1024,
    minHeight: 768,
    show: false,
    // 透明窗口避免闪屏
    transparent: true,
    backgroundColor: '#00000000',
    // resizable: true, // 必须为 true
    //thickFrame: true, // 尝试强制开启原生窗口阴影和缩放
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    icon
  })

  mainWindow = window

  // 统一用默认浏览器打开a链接
  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null
    }
  })

  // 拦截主窗口的关闭事件（包括 Alt+F4、任务栏关闭按钮等）
  window.on('close', (event) => {
    if (!isQuitting) {
      // 非真正退出场景时，阻止默认关闭行为，改为隐藏到托盘
      event.preventDefault()
      hideToTray(window)
    }
  })

  return window
}

// 单实例锁，确保只有一个应用实例
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // 当运行第二个实例时，唤醒现有窗口
    if (mainWindow) {
      showFromTray(mainWindow)
    } else {
      // 理论上不常发生，但作为兜底处理
      mainWindow = createWindow()
    }
  })

  app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })

    mainWindow = createWindow()

    // 创建系统托盘图标，便于最小化到托盘后恢复
    if (mainWindow) {
      createTray(mainWindow)
    }

    ipcHandlers(mainWindow)
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
