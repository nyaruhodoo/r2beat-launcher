import { BrowserWindow, Notification, shell } from 'electron'
import { join } from 'path'
import type { IpcListener, IpcEmitter } from '@electron-toolkit/typed-ipc/main'
import type { IpcMainEvents, IpcRendererEvents } from '../../../ipc/contracts'
import icon from '../../../../build/game.ico?asset'
import { Utils } from '../../utils'

/**
 * 窗口控制、系统通知、充值中心、公告详情子窗口、发货助手子窗口
 */
export function registerWindowHandlers(
  ipc: IpcListener<IpcMainEvents>,
  emitter: IpcEmitter<IpcRendererEvents>,
): void {
  ipc.on('window-show', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.show()
  })

  ipc.on('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })

  ipc.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })

  ipc.on('window-minimize-current', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })

  ipc.on('window-close-current', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })

  ipc.on('show-notification', (event, payload) => {
    const win = BrowserWindow.fromWebContents(event.sender)

    try {
      if (win) {
        const isVisible = win.isVisible()
        const isMinimized = win.isMinimized()

        if (isVisible && !isMinimized) {
          console.log('[Main] 窗口可见，跳过系统通知')
          return
        }
      }

      const title = payload?.title || '提示'
      const body = payload?.body || ''

      if (Notification.isSupported()) {
        const notification = new Notification({
          title,
          body,
          silent: false,
          icon,
        })

        notification.on('click', () => {
          if (win) {
            win.setSkipTaskbar(false)
            if (!win.isVisible()) {
              win.show()
            }
            if (win.isMinimized()) {
              win.restore()
            }
            win.focus()
          }
        })

        notification.show()
      } else {
        console.log('[Main] 当前平台不支持系统通知:', { title, body })
      }
    } catch (error) {
      console.error('[Main] 展示系统通知失败:', error)
    }
  })

  ipc.on('open-recharge-center', (event, username) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender)

    const rechargeWindow = new BrowserWindow({
      width: 900,
      height: 590,
      minWidth: 900,
      minHeight: 590,
      autoHideMenuBar: true,
      parent: senderWindow!,
      modal: false,
      show: false,
      webPreferences: {
        sandbox: false,
      },
    })

    rechargeWindow
      .loadURL('http://pay.xiyouxi.com/USER/CASH_Wechat/User_Refill_Cash_Wechat2.asp')
      .catch((error) => {
        console.error('[Main] 打开充值中心失败:', error)
        rechargeWindow.close()
      })

    rechargeWindow.webContents.on('did-finish-load', () => {
      const stringUserName = JSON.stringify(username ?? '')

      Utils.safeExecute(
        () =>
          rechargeWindow.webContents.executeJavaScript(`
            const pgPayAmt = document.querySelector("#pg_pay_amt")  
            if(pgPayAmt) {
              const newOption = document.createElement('option');
              newOption.value = 1;
              newOption.textContent = '1元';
              pgPayAmt.insertBefore(newOption, pgPayAmt.firstChild);
            }
            
            const noContent = document.querySelector('#no_content')
            if (noContent) {
              const timerId = setInterval(() => {
                const noContent = document.querySelector('#no_content')
                if (noContent && noContent.children.length > 1) {
                    clearInterval(timerId)

                    noContent.value = 'RB'
                    const changeEvent = new Event('change', {
                      bubbles: true,
                      cancelable: true,
                    })
                    noContent.dispatchEvent(changeEvent)
                }
              }, 500)
            }

            const timerId = setInterval(() => {
              const gameServer = document.querySelector('#game_server')
              if(!gameServer) return
              gameServer.value = '01'
              const changeEvent = new Event('change', {
                bubbles: true,
                cancelable: true,
              })
              gameServer.dispatchEvent(changeEvent)

              if (gameServer && gameServer.children.length > 1) {
                clearInterval(timerId)
              }
            }, 500)

            const gameUserId = document.querySelector("#game_user_id") 
            const gameUserIdC = document.querySelector("#game_user_id_c")
            if(gameUserId && gameUserIdC){
              gameUserId.value = gameUserIdC.value = ${stringUserName}
            }
          `),
        '充值中心注入JS脚本失败',
      )
    })

    rechargeWindow.once('ready-to-show', () => {
      rechargeWindow.show()
    })
  })

  ipc.on('open-announcement-detail', (_event, detail) => {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    const mainBounds = mainWindow?.getBounds()
    const baseHeight = mainBounds?.height ?? 720

    const x = Math.floor(mainBounds!.x + (mainBounds!.width - baseHeight) / 2)
    const y = Math.floor(mainBounds!.y + (mainBounds!.height - baseHeight) / 2)

    const detailWindow = new BrowserWindow({
      width: 800,
      height: baseHeight,
      minWidth: 800,
      minHeight: 540,
      autoHideMenuBar: true,
      frame: false,
      titleBarStyle: 'hidden',
      modal: false,
      show: false,
      x,
      y,
      fullscreenable: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    detailWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    const isDevUrl = process.env['ELECTRON_RENDERER_URL']
    const url = isDevUrl
      ? `${isDevUrl}?windowType=announcementDetail`
      : `file://${join(__dirname, '../renderer/index.html')}?windowType=announcementDetail`

    detailWindow.loadURL(url).catch((error) => {
      console.error('[Main] 打开公告详情窗口失败:', error)
      detailWindow.close()
    })

    detailWindow.webContents.once('did-finish-load', () => {
      emitter.send(detailWindow.webContents, 'announcement-detail-data', detail)
      detailWindow.show()
    })
  })

  ipc.on('open-shipping-assistant', () => {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    const mainBounds = mainWindow?.getBounds()

    const scaleFactor = 1.2
    const newWidth = Math.floor(mainBounds!.width * scaleFactor)
    const newHeight = Math.floor(mainBounds!.height * scaleFactor)

    const x = Math.max(0, Math.floor(mainBounds!.x + (mainBounds!.width - newWidth) / 2))
    const y = Math.max(0, Math.floor(mainBounds!.y + (mainBounds!.height - newHeight) / 2))

    const window = new BrowserWindow({
      width: newWidth,
      height: newHeight,
      minWidth: newWidth,
      minHeight: newHeight,
      x,
      y,
      autoHideMenuBar: true,
      frame: false,
      titleBarStyle: 'hidden',
      modal: false,
      show: false,
      fullscreenable: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    const isDevUrl = process.env['ELECTRON_RENDERER_URL']
    const url = isDevUrl
      ? `${isDevUrl}?windowType=shippingAssistant`
      : `file://${join(__dirname, '../renderer/index.html')}?windowType=shippingAssistant`

    window.loadURL(url).catch((error) => {
      console.error('[Main] 打开发货助手窗口失败:', error)
      window.close()
    })

    window.on('ready-to-show', window.show)
  })
}
