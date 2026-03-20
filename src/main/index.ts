import { app, shell, BrowserWindow, Tray, Menu, protocol } from 'electron'
import { join, extname } from 'path'
import { readFile } from 'fs/promises'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../build/game.ico?asset' // 引入应用图标
import { ipcHandlers } from './ipc-handlers' // 引入 IPC 通信处理器

/**
 * =============================================================================
 * 基础配置与环境修复
 * =============================================================================
 */

// 必须在 app ready 之前调用：修复 Windows 平台下透明窗口或 GPU 相关的沙盒问题
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-gpu-sandbox')
}

// 全局变量持有，防止被垃圾回收
let mainWindow: BrowserWindow | null = null // 主窗口实例
let tray: Tray | null = null // 系统托盘实例
let isQuitting = false // 标记：是否真正执行退出程序

/**
 * =============================================================================
 * 窗口显示与隐藏逻辑 (托盘交互)
 * =============================================================================
 */

/**
 * 从托盘恢复窗口显示
 */
function showFromTray(window: BrowserWindow) {
  window.setSkipTaskbar(false) // 在任务栏重新显示图标

  if (window.isMinimized()) {
    window.restore() // 如果是最小化状态，执行恢复
  }

  window.show() // 确保窗口可见
  window.focus() // 聚焦窗口
}

/**
 * 隐藏窗口到托盘
 */
function hideToTray(window: BrowserWindow) {
  // 采用「隐藏任务栏图标 + 窗口最小化」的方案，避免直接 hide() 导致的状态丢失
  window.setSkipTaskbar(true)
  if (!window.isMinimized()) {
    window.minimize()
  }
}

/**
 * 创建系统托盘
 */
function createTray(window: BrowserWindow) {
  if (tray) return tray

  tray = new Tray(icon) // 使用游戏图标

  // 右键托盘菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示启动器',
      click: () => showFromTray(window),
    },
    { type: 'separator' }, // 分割线
    {
      label: '退出',
      click: () => {
        isQuitting = true // 设置退出标记，绕过窗口关闭拦截
        app.quit()
      },
    },
  ])

  tray.setToolTip('R2Beat Launcher')
  tray.setContextMenu(contextMenu)

  // 点击托盘图标直接恢复窗口
  tray.on('click', () => {
    showFromTray(window)
  })

  return tray
}

/**
 * =============================================================================
 * 主窗口创建
 * =============================================================================
 */

function createWindow() {
  const window = new BrowserWindow({
    width: 1152, // 1280 * 0.9
    height: 648, // 720 * 0.9
    minWidth: 1024,
    minHeight: 768,
    show: false, // 初始不显示，等待 ready-to-show
    transparent: true, // 开启窗口透明
    backgroundColor: '#00000000', // 背景完全透明
    autoHideMenuBar: true, // 隐藏顶部菜单栏
    frame: false, // 无边框窗口
    titleBarStyle: 'hidden',
    fullscreenable: false, // 禁用全屏
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon,
  })

  // 当窗口准备好时再显示，避免白屏闪烁
  window.on('ready-to-show', () => {
    window.show()
  })

  // 拦截所有的 <a> 标签跳转，强制使用系统默认浏览器打开
  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 加载页面：开发环境使用 HMR 地址，生产环境使用本地文件
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 窗口关闭事件拦截
  window.on('close', (event) => {
    if (!isQuitting) {
      // 如果不是点击了“退出”菜单，则点击关闭按钮只是隐藏到托盘
      event.preventDefault()
      hideToTray(window)
    }
  })

  window.on('closed', () => {
    mainWindow = null
  })

  return window
}

/**
 * =============================================================================
 * 应用生命周期与单实例保护
 * =============================================================================
 */

// 请求单实例锁，防止同时运行两个启动器
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.exit(0) // 如果已有实例在运行，直接退出当前尝试启动的实例
} else {
  // 当第二个实例尝试启动时，唤醒当前正在运行的窗口
  app.on('second-instance', () => {
    if (mainWindow) {
      showFromTray(mainWindow)
    }
  })

  app.whenReady().then(() => {
    // 设置 Windows 任务栏 AppUserModelId
    electronApp.setAppUserModelId('R2Beat-Launcher')

    // 默认快捷键监听（如 F12）
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    /**
     * 自定义协议注册：r2shot://?path=xxx
     * 用于绕过 Chrome 的安全限制，加载本地磁盘上的图片（如游戏截图）
     */
    protocol.handle('r2shot', async (request) => {
      try {
        const url = new URL(request.url)
        const filePath = decodeURIComponent(url.searchParams.get('path') ?? '')

        if (!filePath) return new Response('Bad Request', { status: 400 })

        const data = await readFile(filePath)
        const ext = extname(filePath).toLowerCase()

        // 简单的 MIME 类型映射
        const mimeMap: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.bmp': 'image/bmp',
        }

        return new Response(data, {
          status: 200,
          headers: { 'Content-Type': mimeMap[ext] || 'application/octet-stream' },
        })
      } catch (error) {
        console.error('[Protocol] r2shot 协议加载失败:', error)
        return new Response('Not Found', { status: 404 })
      }
    })

    // 初始化窗口和托盘
    mainWindow = createWindow()
    createTray(mainWindow)

    // 初始化 IPC 业务逻辑
    ipcHandlers(mainWindow)
  })
}

/**
 * =============================================================================
 * 退出处理
 * =============================================================================
 */

// 非 macOS 平台，窗口全部关闭后退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    isQuitting = true // 设置退出标记，绕过窗口关闭拦截
    app.quit()
  }
})

/**
 * 应用即将退出时的清理工作
 * 主要是用来修正 hook dll 的后遗症
 */
app.on('will-quit', () => {
  if (tray) tray.destroy() // 销毁托盘图标，防止退出后图标残留在任务栏

  app.releaseSingleInstanceLock() // 显式释放单实例锁

  // 物理性强制终结进程，确保没有后台残留
  process.nextTick(() => {
    process.kill(process.pid)
  })
})
