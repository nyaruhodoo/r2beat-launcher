import { app, shell, BrowserWindow, Tray, Menu, protocol } from 'electron'
import { join, extname } from 'path'
import { readFile } from 'fs/promises'
import { electronApp, is } from '@electron-toolkit/utils'
import icon from '../../build/game.ico?asset'
import { ipcHandlers } from './ipc-handlers'

// 必须在 app ready 之前调用
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-gpu-sandbox')
}

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
        // exec(`taskkill /F /T /PID ${process.pid}`, () => {
        //   // 这行通常不会执行，因为进程已经被系统抹除了
        //   process.exit(0)
        // })

        // 1. 销毁所有窗口
        BrowserWindow.getAllWindows().forEach((w) => w.destroy())

        // 2. 释放托盘（防止图标残留）
        if (tray) tray.destroy()

        // 先走一次正常关闭逻辑
        app.quit()

        // 3. 释放单实例锁（非常关键，这能解决第二次启动没缓存的问题）
        app.releaseSingleInstanceLock()

        // 4. 仅杀掉当前进程本身，不触碰子进程
        // 在 Windows 上，process.kill(process.pid) 相当于只针对该 PID 执行 taskkill /F
        process.kill(process.pid)
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
  app.exit(0)
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
    electronApp.setAppUserModelId('R2Beat-Launcher')

    app.on('browser-window-created', (_, window) => {
      // 仍然保留 electron-toolkit 提供的快捷键（如 Ctrl+Shift+I 等）
      // optimizer.watchWindowShortcuts(window)

      // 额外强制支持 F12 打开/关闭开发者工具（无论开发/生产环境）
      window.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && input.key === 'F12') {
          if (window.webContents.isDevToolsOpened()) {
            window.webContents.closeDevTools()
          } else {
            window.webContents.openDevTools({ mode: 'detach' })
          }
          event.preventDefault()
        }
      })
    })

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })

    // 注册本地截图文件协议，用于在渲染进程中安全加载本地图片
    protocol.handle('r2shot', async (request) => {
      try {
        const url = new URL(request.url)
        const filePath = decodeURIComponent(url.searchParams.get('path') ?? '')

        if (!filePath) {
          return new Response('Bad Request', { status: 400 })
        }

        const data = await readFile(filePath)
        const ext = extname(filePath).toLowerCase()

        let contentType = 'application/octet-stream'
        if (ext === '.png') contentType = 'image/png'
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg'
        else if (ext === '.gif') contentType = 'image/gif'
        else if (ext === '.webp') contentType = 'image/webp'
        else if (ext === '.bmp') contentType = 'image/bmp'
        else if (ext === '.avif') contentType = 'image/avif'
        else if (ext === '.tif' || ext === '.tiff') contentType = 'image/tiff'

        return new Response(data, {
          status: 200,
          headers: {
            'Content-Type': contentType
          }
        })
      } catch (error) {
        console.error('[Protocol] r2shot 处理失败:', error)
        return new Response('Not Found', { status: 404 })
      }
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
