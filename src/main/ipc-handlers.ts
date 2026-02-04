import { app, BrowserWindow, ipcMain, dialog, Notification, shell } from 'electron'
import { join, relative, dirname, basename } from 'path'
import { homedir } from 'os'
import { createReadStream, createWriteStream } from 'fs'
import {
  access,
  readFile,
  writeFile,
  readdir,
  mkdir,
  unlink,
  stat,
  copyFile,
  rm
} from 'fs/promises'
import { parseIniToJson, stringifyJsonToIni } from './ini-json-converter'
import { AnnouncementData, Announcementlist, PatchUpdateInfo, ProcessPriority } from '@types'
import { sendTcpLoginRequest } from './tcp-login'
import { spawnPromise, spawnDetached, spawnGameProcess } from './spawn'
import lzma from 'lzma-native'
import { Utils } from './utils'
import { hookDll } from './hookDll'

// 该文件只处理业务逻辑
export const ipcHandlers = (mainWindow?: BrowserWindow) => {
  // 异步判断文件/目录是否存在，避免同步阻塞
  const exists = async (path: string) => {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  }

  ipcMain.on('window-show', () => {
    mainWindow?.show()
  })

  ipcMain.on('window-minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.on('window-close', async () => {
    // 主窗口关闭按钮：走与 Alt+F4 一致的逻辑，由主进程的 window.on('close') 统一处理
    mainWindow?.close()
  })

  // 仅作用于发送方所在的窗口，用于子窗口独立控制
  ipcMain.on('window-minimize-current', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })

  ipcMain.on('window-close-current', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })

  /**
   * 展示系统通知（Windows 原生通知）
   * 只有在窗口在托盘（不可见或最小化）时才显示通知
   */
  ipcMain.on(
    'show-notification',
    (_event, payload: { title?: string; body?: string } | undefined | null) => {
      try {
        // 检查窗口状态：如果窗口可见且未最小化，则不显示通知
        if (mainWindow) {
          const isVisible = mainWindow.isVisible()
          const isMinimized = mainWindow.isMinimized()

          // 窗口可见且未最小化，说明不在托盘，不显示通知
          if (isVisible && !isMinimized) {
            console.log('[Main] 窗口可见，跳过系统通知')
            return
          }
        }

        const title = payload?.title || '提示'
        const body = payload?.body || ''

        // 在部分平台上 Notification 可能不可用，做一次能力判断
        if (Notification.isSupported()) {
          const notification = new Notification({
            title,
            body,
            silent: false
          })

          // 点击通知时唤醒主窗口
          notification.on('click', () => {
            if (mainWindow) {
              // 让窗口重新出现在任务栏并聚焦
              mainWindow.setSkipTaskbar(false)
              if (!mainWindow.isVisible()) {
                mainWindow.show()
              }
              if (mainWindow.isMinimized()) {
                mainWindow.restore()
              }
              mainWindow.focus()
            }
          })

          notification.show()
        } else {
          console.log('[Main] 当前平台不支持系统通知:', { title, body })
        }
      } catch (error) {
        console.error('[Main] 展示系统通知失败:', error)
      }
    }
  )

  /**
   * 打开充值中心窗口
   * 使用独立 Electron 窗口而不是浏览器新标签页
   * @param _event IPC 事件对象
   * @param username 可选，当前登录的用户名
   */
  ipcMain.on('open-recharge-center', (_event, username?: string) => {
    const rechargeWindow = new BrowserWindow({
      width: 900,
      height: 590,
      minWidth: 900,
      minHeight: 590,
      autoHideMenuBar: true,
      parent: mainWindow,
      modal: false,
      show: false,
      webPreferences: {
        sandbox: false
      }
    })

    rechargeWindow
      .loadURL('http://pay.xiyouxi.com/USER/CASH_Wechat/User_Refill_Cash_Wechat2.asp')
      .catch((error) => {
        console.error('[Main] 打开充值中心失败:', error)
        rechargeWindow.close()
      })

    // 页面完全加载完成后在目标页面内执行脚本
    rechargeWindow.webContents.on('did-finish-load', () => {
      const stringUserName = JSON.stringify(username ?? '')

      rechargeWindow.webContents
        .executeJavaScript(
          `
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
        `
        )
        .catch((error) => console.error('[Main] 注入充值中心脚本失败:', error))
    })

    rechargeWindow.once('ready-to-show', () => {
      rechargeWindow.show()
    })
  })

  /**
   * 打开系统公告详情窗口
   */
  ipcMain.on('open-announcement-detail', (_event, detail: AnnouncementData) => {
    const mainBounds = mainWindow?.getBounds()
    const baseHeight = mainBounds?.height ?? 720

    const detailWindow = new BrowserWindow({
      width: 800,
      height: baseHeight,
      minWidth: 800,
      minHeight: 540,
      autoHideMenuBar: true,
      frame: false,
      titleBarStyle: 'hidden',
      parent: mainWindow,
      modal: false,
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
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
      detailWindow.webContents.send('announcement-detail-data', detail)
      detailWindow.show()
    })
  })

  /**
   * 获取系统公告详情
   */
  ipcMain.handle(
    'get-announcement-detail',
    async (
      _event,
      {
        path,
        idx
      }: {
        path: string
        idx: number
      }
    ) => {
      const fetchUrl = `https://external-api.xiyouxi.com/api/vfunlounge/posts/r2beat/${path}?lang=cn&page=1&search=`

      try {
        const response = await fetch(fetchUrl)

        if (!response.ok) {
          console.error('[Main] 获取公告详情失败:', response.status, response.statusText)
          throw new Error('获取公告详情失败')
        }

        const result = (await response.json()) as Announcementlist
        const list = result?.data?.data ?? []

        const target = list.find((item) => item.idx === idx)
        if (!target) {
          console.warn('[Main] 未找到匹配的公告详情，idx:', idx)
          throw new Error('未找到公告详情')
        }

        return { success: true, data: target }
      } catch (error) {
        console.error('[Main] 获取公告详情异常:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '获取公告详情时发生异常'
        }
      }
    }
  )

  /**
   * 获取系统公告
   */
  ipcMain.handle('get-announcements', async () => {
    try {
      const urls = ['https://external-api.xiyouxi.com/api/lounge/posts/r2beat/all/latest/7']

      const responses = await Promise.all(
        urls.map(async (url, index) => {
          try {
            const response = await fetch(url)

            if (!response.ok) {
              throw new Error(
                `[Main] Failed to fetch ${url}: ${response.status} ${response.statusText}`
              )
            }

            const result = (await response.json()) as {
              data: AnnouncementData[]
              result: number
            }

            if (result && result.data && Array.isArray(result.data)) {
              return result.data
            } else {
              console.warn(`[Main] Unexpected response format from URL ${index + 1}:`, result)
              throw new Error(`[Main] Unexpected response format from URL ${index + 1}:`)
            }
          } catch (error) {
            console.error(`[Main] Error fetching ${url}:`, error)
            return []
          }
        })
      )

      // 合并所有数据
      const allAnnouncements = responses.flat()

      // 按创建时间排序（最新的在前）
      allAnnouncements.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime()
        const dateB = new Date(b.created_at).getTime()
        return dateB - dateA // 降序排列
      })

      return allAnnouncements
    } catch (error) {
      console.error('[Main] 获取公告失败:', error)
      return []
    }
  })

  /**
   * 获取远程最新版本号
   * 数据来源: https://r2beat-cdn.xiyouxi.com/live/vpatch/patchVersionInfo.txt
   * 只取 [useropen] 段落中的最后一个非空行
   */
  ipcMain.handle('get-remote-version', async () => {
    const url = 'https://r2beat-cdn.xiyouxi.com/live/vpatch/patchVersionInfo.txt'
    try {
      const response = await fetch(url)
      if (!response.ok) {
        console.error('[Main] 获取远程版本失败:', response.status, response.statusText)
        throw new Error('远程版本请求失败')
      }

      const text = await response.text()
      const lines = text.split(/\r?\n/).map((line) => line.trim())

      const userOpenIndex = lines.findIndex((line) => line.toLowerCase() === '[useropen]')
      if (userOpenIndex === -1) {
        throw new Error('未找到 [useropen] 段落')
      }

      // 查找 useropen 段结束位置（masteropen 或 versionend）
      let endIndex = lines.length
      for (let i = userOpenIndex + 1; i < lines.length; i++) {
        const line = lines[i].toLowerCase()
        if (line.startsWith('[masteropen]') || line.startsWith('[versionend]')) {
          endIndex = i
          break
        }
      }

      const userOpenLines = lines
        .slice(userOpenIndex + 1, endIndex)
        .filter((line) => line && !line.startsWith('['))

      if (userOpenLines.length === 0) {
        throw new Error('[useropen] 段中没有有效版本行')
      }

      const latest = userOpenLines[userOpenLines.length - 1]

      console.log(`[Main] 当前最新版本号 ${latest}`)

      return { success: true, version: latest }
    } catch (error) {
      console.error('[Main] 获取远程版本异常:', error)
      return { success: false, error: '获取远程版本时发生异常' }
    }
  })

  /**
   * 获取 R2beat 游戏路径（通过读取快捷方式）
   * @param shortcutPath 快捷方式文件路径（可选，默认使用系统默认路径）
   * @returns 返回目标目录路径或错误信息
   */
  ipcMain.handle('get-r2beat-path', async (_, shortcutPath?: string) => {
    try {
      // 如果没有提供快捷方式路径，使用默认路径
      let finalShortcutPath = shortcutPath
      if (!finalShortcutPath) {
        const appData = process.env.APPDATA
        if (!appData) {
          throw new Error('无法获取 APPDATA 路径')
        }
        finalShortcutPath = join(
          appData,
          'Microsoft\\Windows\\Start Menu\\Programs\\R2beat\\音速觉醒.lnk'
        )
      }

      // 判断快捷方式文件是否存在
      if (!(await exists(finalShortcutPath))) {
        throw new Error(`找不到快捷方式文件: ${finalShortcutPath}`)
      }

      // 读取快捷方式的目标路径
      const shortcutDetails = shell.readShortcutLink(finalShortcutPath)
      if (!shortcutDetails.target) {
        throw new Error('快捷方式中没有目标路径')
      }

      // 获取目标目录（不带文件名）
      const targetDir = dirname(shortcutDetails.target)

      // 验证目录是否存在
      if (!(await exists(targetDir))) {
        throw new Error(`目标目录不存在: ${targetDir}`)
      }

      return {
        success: true,
        path: targetDir
      }
    } catch (error) {
      console.error('[Main] 获取 R2beat 路径失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取 R2beat 路径失败'
      }
    }
  })

  /**
   * 打开文件夹选择对话框
   * @param currentPath 当前已保存的路径（可选）
   */
  ipcMain.handle('select-folder', async (_, currentPath?: string) => {
    try {
      // 确定默认路径：优先使用当前路径，否则使用用户主目录
      let defaultPath = currentPath
      if (!defaultPath || defaultPath.trim() === '') {
        defaultPath = homedir()
      }

      if (!mainWindow) return

      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: '选择游戏安装目录',
        defaultPath: defaultPath,
        // 在 Windows 上，可以尝试使用更紧凑的对话框
        ...(process.platform === 'win32' &&
          {
            // Windows 特定的选项
          })
      })

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }

      return result.filePaths[0]
    } catch (error) {
      console.error('[Main] Error selecting folder:', error)
      return null
    }
  })

  /**
   * 启动游戏
   */
  ipcMain.handle(
    'launch-game',
    async (
      _,
      gamePath: string,
      launchArgs?: string,
      minimizeToTrayOnLaunch?: boolean,
      processPriority?: ProcessPriority,
      lowerNPPriority?: boolean,
      username?: string,
      password?: string
    ) => {
      try {
        if (!gamePath || gamePath.trim() === '') {
          throw new Error('游戏路径未设置，请在设置中配置游戏安装目录')
        }

        const gameExePath = join(gamePath, 'Game.exe')
        if (!(await exists(gameExePath))) {
          throw new Error(`找不到游戏文件: ${gameExePath}\n请检查游戏安装目录是否正确`)
        }

        // 打印密码到控制台
        if (password) {
          // console.log(`[Main] 接收到的密码参数: ${password}`)
        }

        // 使用传入的 username 参数写入 xyxID.txt
        if (username && username.trim()) {
          const xyxIdFilePath = join(gamePath, 'xyxID.txt')
          try {
            await writeFile(xyxIdFilePath, username.trim(), 'utf-8')
            console.log(`[Main] 已更新 xyxID.txt: ${username.trim()}`)
          } catch (error) {
            console.error('[Main] 写入 xyxID.txt 失败:', error)
            // 不抛出错误，继续启动游戏
          }
        }

        // 解析命令行参数（将字符串按空格分割）
        const args: string[] = []
        if (launchArgs && launchArgs.trim() !== '') {
          // 简单的参数解析：按空格分割，但保留引号内的内容
          const argParts = launchArgs.trim().match(/(?:[^\s"]+|"[^"]*")+/g) || []
          args.push(...argParts.map((arg: string) => arg.replace(/^"|"$/g, '')))
        }

        console.log(`[Main] 启动游戏: ${gameExePath}`)
        console.log(`[Main] 命令行参数:`, args)

        const gameProcess = await spawnGameProcess(
          gameExePath,
          args,
          {
            cwd: gamePath // 设置工作目录为游戏目录
          },
          (code, signal) => {
            // 监听进程退出（仅用于日志记录）
            console.log(`[Main] 游戏进程退出: code=${code}, signal=${signal}`)
          }
        )

        if (!gameProcess.pid) throw new Error('启动游戏进程失败，无法获取进程ID')

        if (launchArgs !== 'xyxOpen') {
          hookDll(gameProcess.pid)
        }

        /**
         * 等待优先级相关操作结果
         */
        try {
          await new Promise((res) => {
            if (process.platform !== 'win32') {
              return res(undefined)
            }

            // 在 Windows 上，根据用户设置调整游戏进程优先级
            const priorityKey: ProcessPriority = processPriority || 'normal'
            // 对应 Windows PriorityClass 数值
            const priorityMap: Record<ProcessPriority, number> = {
              realtime: 256, // REALTIME_PRIORITY_CLASS
              high: 128, // HIGH_PRIORITY_CLASS
              abovenormal: 32768, // ABOVE_NORMAL_PRIORITY_CLASS
              normal: 32, // NORMAL_PRIORITY_CLASS
              belownormal: 16384, // BELOW_NORMAL_PRIORITY_CLASS
              low: 64 // IDLE_PRIORITY_CLASS，近似“低”
            }

            const priorityValue = priorityMap[priorityKey] ?? priorityMap.normal

            console.log(
              `[Main] 开始设置游戏进程优先级: pid=${gameProcess.pid}, priority=${priorityKey}(${priorityValue})`
            )

            // 使用 spawnDetached 异步设置优先级（fire and forget）
            spawnDetached('wmic', [
              'process',
              'where',
              `processid=${gameProcess.pid}`,
              'CALL',
              'setpriority',
              String(priorityValue)
            ]).catch((error) => {
              console.error('[Main] 设置游戏进程优先级失败:', error)
            })

            // 如果启用了降低NP优先级功能，则检测并降低GameMon进程优先级
            if (lowerNPPriority) {
              // 启动后按 1 秒间隔检查系统进程，直到发现包含关键字 "GameMon" 的进程或超时
              let checkCount = 0
              const maxChecks = 15

              const intervalId = setInterval(() => {
                checkCount++
                if (checkCount > maxChecks) {
                  clearInterval(intervalId)
                  console.warn('[Main] 未发现 GameMon 相关进程（已超时）')
                  res(undefined)
                  return
                }

                // 使用 spawnPromise 获取进程列表
                spawnPromise('wmic', ['process', 'get', 'Name,ProcessId'], {
                  collectStdout: true,
                  collectStderr: false
                })
                  .then((result) => {
                    // 解析输出，查找包含 GameMon 的进程及其 PID
                    const lines = result.stdout
                      .split(/\r?\n/)
                      .map((line) => line.trim())
                      .filter(Boolean)

                    const matches: Array<{ name: string; pid: number }> = []
                    for (const line of lines) {
                      // wmic 输出格式：Name  ProcessId
                      const match = line.match(/^(.*\S)\s+(\d+)$/)
                      if (match) {
                        const name = match[1].trim()
                        const pid = Number(match[2])
                        if (name.includes('GameMon')) {
                          matches.push({ name, pid })
                        }
                      }
                    }

                    if (matches.length > 0) {
                      console.log('[Main] 已检测到包含关键字 "GameMon" 的进程：', matches)
                      clearInterval(intervalId)

                      // 将所有匹配的 GameMon 相关进程优先级调为最低（IDLE_PRIORITY_CLASS = 64）
                      // 并限制只使用一个 CPU 核心
                      const targetPriorityValue = 64
                      const processPromises = matches.map(async ({ name, pid }) => {
                        try {
                          // 设置进程优先级
                          console.log(
                            `[Main] 已将进程优先级设置为最低: ${name} (pid=${pid}, priority=${targetPriorityValue})`
                          )
                          await spawnDetached('wmic', [
                            'process',
                            'where',
                            `processid=${pid}`,
                            'CALL',
                            'setpriority',
                            String(targetPriorityValue)
                          ])
                        } catch (error) {
                          console.error(`[Main] 设置进程优先级失败: ${name} (pid=${pid})`, error)
                        }

                        try {
                          // 设置 CPU 亲和性：限制只使用第一个 CPU 核心（位掩码 1 = CPU 0）
                          const result = await spawnPromise(
                            'powershell',
                            [
                              '-Command',
                              `$proc = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($proc) { $proc.ProcessorAffinity = 1; Write-Host "Success" } else { Write-Host "Process not found" }`
                            ],
                            {
                              collectStdout: true,
                              collectStderr: false
                            }
                          )

                          if (result.code === 0 && result.stdout.includes('Success')) {
                            console.log(
                              `[Main] 已限制进程只使用一个 CPU 核心: ${name} (pid=${pid})`
                            )
                          } else {
                            console.warn(
                              `[Main] 设置 CPU 亲和性可能失败: ${name} (pid=${pid}), code=${result.code}, output=${result.stdout}`
                            )
                          }
                        } catch (error) {
                          console.error(`[Main] 设置 CPU 亲和性失败: ${name} (pid=${pid})`, error)
                        }
                      })

                      // 等待所有进程的优先级和 CPU 亲和性设置完成
                      Promise.all(processPromises)
                        .then(() => {
                          res(undefined)
                        })
                        .catch((error) => {
                          console.error('[Main] 处理 GameMon 进程时发生错误:', error)
                          res(undefined) // 即使出错也 resolve，避免阻塞
                        })
                    }
                  })
                  .catch((error) => {
                    console.error('[Main] 检测 GameMon 进程时发生错误:', error)
                  })
              }, 1000)
            } else {
              // 如果未启用降低NP优先级功能，直接resolve
              res(undefined)
            }
          })
        } catch (error) {
          console.error('[Main] 调整进程优先级时发生错误:', error)
        }

        if (minimizeToTrayOnLaunch) {
          console.log('[Main] 启动游戏后最小化到托盘（根据用户设置）')
          // 与主进程 hideToTray 保持一致：只做「最小化 + 隐藏任务栏图标」，避免调用 hide() 导致窗口状态异常
          if (mainWindow) {
            mainWindow.setSkipTaskbar(true)
            if (!mainWindow.isMinimized()) {
              mainWindow.minimize()
            }
          }
        } else {
          console.log('[Main] 启动游戏后保持启动器窗口可见（根据用户设置）')
        }

        return { success: true }
      } catch (error) {
        console.error('[Main] 启动游戏时发生错误:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '启动游戏时发生未知错误'
        }
      }
    }
  )

  /**
   * 读取并转换游戏目录下的 config.ini 文件为 JSON
   * @param gamePath 游戏安装目录
   */
  ipcMain.handle('read-config-ini', async (_, gamePath: string) => {
    try {
      if (!gamePath || gamePath.trim() === '') {
        return { success: false, exists: false, error: '游戏路径未设置' }
      }

      const configIniPath = join(gamePath, 'config.ini')
      const iniExists = await exists(configIniPath)

      if (!iniExists) {
        return { success: true, exists: false }
      }

      // 读取文件内容
      const fileContent = await readFile(configIniPath, 'utf-8')

      // 使用 ini-json-converter 转换为 JSON
      const jsonData = parseIniToJson(fileContent)

      return { success: true, exists: true, data: jsonData }
    } catch (error) {
      console.error('[Main] 读取 config.ini 失败:', error)
      return {
        success: false,
        exists: false,
        error: error instanceof Error ? error.message : '读取 config.ini 文件时发生未知错误'
      }
    }
  })

  /**
   * 将 JSON 对象转换为 INI 格式并写入 config.ini 文件
   * @param gamePath 游戏安装目录
   * @param configJson JSON 配置对象
   */
  ipcMain.handle(
    'write-config-ini',
    async (_, gamePath: string, configJson: Record<string, Record<string, unknown>>) => {
      try {
        if (!gamePath || gamePath.trim() === '') {
          throw new Error('游戏路径未设置')
        }

        if (!configJson) {
          throw new Error('配置数据为空')
        }

        const configIniPath = join(gamePath, 'config.ini')

        // 使用 ini-json-converter 转换为 INI 字符串
        const iniContent = stringifyJsonToIni(configJson)

        // 写入文件（异步）
        await writeFile(configIniPath, iniContent, 'utf-8')

        console.log('[Main] config.ini 保存成功:', configIniPath)
        return { success: true }
      } catch (error) {
        console.error('[Main] 保存 config.ini 失败:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '保存 config.ini 文件时发生未知错误'
        }
      }
    }
  )

  /**
   * 读取游戏 Patch.ini 文件
   * @param gamePath 游戏安装目录
   */
  ipcMain.handle('read-patch-info', async (_, gamePath: string) => {
    try {
      if (!gamePath || gamePath.trim() === '') {
        throw new Error('游戏路径未设置')
      }

      const patchIniPath = join(gamePath, 'PatchInfo', 'Patch.ini')
      // 检查文件是否存在
      if (!(await exists(patchIniPath))) {
        throw new Error(`找不到 Patch.ini 文件: ${patchIniPath}`)
      }

      // 读取文件内容
      const fileContent = await readFile(patchIniPath, 'utf-8')
      const patchInfo = parseIniToJson(fileContent)

      return { success: true, data: patchInfo }
    } catch (error) {
      console.error('[Main] 读取 Patch.ini 失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '读取 Patch.ini 文件时发生未知错误'
      }
    }
  })

  /**
   * 获取补丁列表：
   * - gamePaks: 游戏安装目录下，名称包含中文的 .pak
   * - modsPaks: 启动器根目录下 mods 目录中的 .pak（若目录不存在返回空数组）
   * @param gamePath 游戏安装目录
   */
  ipcMain.handle('get-paks', async (_, gamePath: string) => {
    try {
      if (!gamePath || gamePath.trim() === '') {
        throw new Error('目录路径未设置')
      }

      const gameDirExists = await exists(gamePath)
      if (!gameDirExists) {
        throw new Error(`目录不存在: ${gamePath}`)
      }

      // 匹配常见 CJK 中文字符范围
      const chineseReg = /[\u3400-\u9FFF\uF900-\uFAFF]/

      // 1. 游戏安装目录下的 pak（名称包含中文）
      const gameEntries = await readdir(gamePath, { withFileTypes: true })
      const gamePaks = gameEntries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((name) => name.toLowerCase().endsWith('.pak') && chineseReg.test(name))
        .map((name) => ({
          name,
          path: join(gamePath, name)
        }))

      // 2. 启动器根目录 mods 目录下的 pak（无需必须包含中文）
      const appRoot = Utils.getTargetDir()
      const modsRoot = join(appRoot, 'mods')

      let modsPaks: { name: string; path: string }[] = []
      if (await exists(modsRoot)) {
        const modsEntries = await readdir(modsRoot, { withFileTypes: true })
        modsPaks = modsEntries
          .filter((entry) => entry.isFile())
          .map((entry) => entry.name)
          .filter((name) => name.toLowerCase().endsWith('.pak'))
          .map((name) => ({
            name,
            path: join(modsRoot, name)
          }))
      }

      return {
        success: true,
        gamePaks,
        modsPaks
      }
    } catch (error) {
      console.error('[Main] 获取 pak 文件列表失败:', error)
      return {
        success: false,
        gamePaks: [],
        modsPaks: [],
        error: error instanceof Error ? error.message : '获取 pak 文件列表时发生未知错误'
      }
    }
  })

  /**
   * 通过文件数据保存补丁到游戏目录
   * 如果目标文件已存在，会自动覆盖
   * fileData 可以是 Buffer 或 Uint8Array
   */
  ipcMain.handle(
    'save-pak-to-game',
    async (_, fileName: string, fileData: Buffer | Uint8Array, gamePath: string) => {
      try {
        if (!fileName || !fileData || !gamePath) {
          throw new Error('文件名、文件数据或游戏路径为空')
        }

        if (!(await exists(gamePath))) {
          throw new Error(`游戏目录不存在: ${gamePath}`)
        }

        const destPath = join(gamePath, fileName)
        // 如果 fileData 是 Uint8Array，转换为 Buffer
        const buffer = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData)
        await writeFile(destPath, buffer)

        return { success: true, destPath }
      } catch (error) {
        console.error('[Main] save-pak-to-game 失败:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '保存补丁到游戏目录时发生未知错误'
        }
      }
    }
  )

  /**
   * 将本地补丁（mods 下）复制到游戏目录（保留源文件）
   * 如果目标文件已存在，会自动覆盖（以源文件为准）
   */
  ipcMain.handle('copy-pak-to-game', async (_, srcPath: string, gamePath: string) => {
    try {
      if (!srcPath || !gamePath) {
        throw new Error('源路径或游戏路径为空')
      }

      if (!(await exists(srcPath))) {
        throw new Error(`源文件不存在: ${srcPath}`)
      }

      if (!(await exists(gamePath))) {
        throw new Error(`游戏目录不存在: ${gamePath}`)
      }

      const fileName = basename(srcPath)
      const destPath = join(gamePath, fileName)

      // copyFile 默认会覆盖已存在的文件
      await copyFile(srcPath, destPath)

      return { success: true, destPath }
    } catch (error) {
      console.error('[Main] copy-pak-to-game 失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '复制补丁到游戏目录时发生未知错误'
      }
    }
  })

  /**
   * 将游戏内补丁移动到本地 mods 目录（剪切）
   * 如果 mods 目录下已存在同名文件，会自动覆盖（以游戏目录中的文件为准）
   */
  ipcMain.handle('move-pak-to-mods', async (_, srcPath: string) => {
    try {
      if (!srcPath) {
        throw new Error('源路径为空')
      }

      if (!(await exists(srcPath))) {
        throw new Error(`源文件不存在: ${srcPath}`)
      }

      const appRoot = Utils.getTargetDir()
      const modsRoot = join(appRoot, 'mods')

      if (!(await exists(modsRoot))) {
        await mkdir(modsRoot, { recursive: true })
      }

      const fileName = basename(srcPath)
      const destPath = join(modsRoot, fileName)

      // copyFile 默认会覆盖已存在的文件，然后删除源文件
      await copyFile(srcPath, destPath)
      await unlink(srcPath)

      return { success: true, destPath }
    } catch (error) {
      console.error('[Main] move-pak-to-mods 失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '移动补丁到 mods 目录时发生未知错误'
      }
    }
  })

  /**
   * 删除指定补丁文件
   */
  ipcMain.handle('delete-pak', async (_, srcPath: string) => {
    try {
      if (!srcPath) {
        throw new Error('删除路径为空')
      }

      if (await exists(srcPath)) {
        const info = await stat(srcPath)
        if (info.isFile()) {
          await unlink(srcPath)
        }
      }

      return { success: true }
    } catch (error) {
      console.error('[Main] delete-pak 失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '删除补丁文件时发生未知错误'
      }
    }
  })

  /**
   * TCP 登录请求
   * @param username 用户名
   * @param password 密码
   */
  ipcMain.handle('tcp-login', async (_, username: string, password: string) => {
    try {
      if (!username || !password) {
        throw new Error('用户名和密码不能为空')
      }

      console.log(`[Main] 收到 TCP 登录请求: ${username}`)
      const result = await sendTcpLoginRequest(username, password)

      return {
        success: result.status === 'SUCCESS',
        status: result.status,
        message: result.message,
        data: result.data
      }
    } catch (error) {
      console.error('[Main] TCP 登录失败:', error)
      return {
        success: false,
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'TCP 登录时发生未知错误'
      }
    }
  })

  /**
   * 下载补丁列表文件 (.lst) 到项目根目录下的 patch/lst 目录
   * URL 模板: https://r2beat-cdn.xiyouxi.com/live/vpatch/{version}/{version}.lst
   * 1. 仅当本地不存在同名文件时才下载
   * 2. version 为字符串，例如: "00026"
   */
  ipcMain.handle(
    'download-patch-lists',
    async (_event, versions: string[], keepLatestOnly: boolean = true) => {
      try {
        if (!Array.isArray(versions) || versions.length === 0) {
          throw new Error('版本列表为空')
        }

        // 过滤非法版本号（只允许数字字符串）
        const validVersions = versions.filter((v) => typeof v === 'string' && /^\d+$/.test(v))
        if (validVersions.length === 0) {
          throw new Error('没有有效的版本号')
        }

        const appRoot = Utils.getTargetDir()
        const targetDir = join(appRoot, 'patch', 'lst')

        // 确保目录存在
        try {
          if (!(await exists(targetDir))) {
            // 使用 fs.promises.mkdir 递归创建目录
            await mkdir(targetDir, { recursive: true })
          }
        } catch (error) {
          console.error('[Main] 创建 patch/lst 目录失败:', error)
          throw new Error('创建本地目录失败')
        }

        // 用于后续解析的本地文件信息
        const localFiles: { version: string; filePath: string }[] = []

        for (const version of validVersions) {
          const fileName = `${version}.lst.txt`
          const filePath = join(targetDir, fileName)

          // 如果已经存在同名文件，则跳过下载
          if (await exists(filePath)) {
            console.log(`[Main] 补丁列表已存在，跳过: ${fileName}`)
            localFiles.push({ version, filePath })
            continue
          }

          const url = `https://r2beat-cdn.xiyouxi.com/live/vpatch/${version}/${version}.lst`
          console.log('[Main] 开始下载补丁列表:', url)

          try {
            await Utils.downloadFile(url, filePath)
            localFiles.push({ version, filePath })
            console.log('[Main] 补丁列表下载完成:', filePath)
          } catch (error) {
            const errorMsg = `下载补丁列表失败: ${url} - ${error instanceof Error ? error.message : String(error)}`
            console.error('[Main]', errorMsg)
            throw new Error(errorMsg)
          }
        }
        // 解析所有 lst 文件，计算补丁详情与总大小
        let patches: {
          version: string
          filePath: string
          patchFileName: string
          targetFileName: string
          originalSize: number
          compressedSize: number
          checksum?: string
          downloadUrl: string
        }[] = []

        let totalSize = 0

        for (const { version, filePath } of localFiles) {
          try {
            const content = await readFile(filePath, 'utf-8')
            const lines = content
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter((line) => line && !line.startsWith('#') && !line.startsWith(';'))

            for (const line of lines) {
              const parts = line.split(/\s+/)
              if (parts.length < 4) {
                continue
              }

              const patchFileName = parts[0]
              let targetFileName = parts[1]

              // 如果 targetFileName 是 VLauncher_New.exe，修改为 VLauncher.exe
              if (targetFileName === 'VLauncher_New.exe') {
                targetFileName = 'VLauncher.exe'
              }

              const originalSize = Number(parts[2]) || 0
              const compressedSize = Number(parts[3]) || 0
              const checksum = parts[4]

              const downloadUrl = `http://r2beat-cdn.xiyouxi.com/live/vpatch/${version}/${patchFileName}`

              patches.push({
                version,
                filePath,
                patchFileName,
                targetFileName,
                originalSize,
                compressedSize,
                checksum,
                downloadUrl
              })

              // 按原始大小统计总下载体积
              totalSize += originalSize
            }
          } catch (error) {
            const errorMsg = `解析补丁列表失败: ${filePath} - ${error instanceof Error ? error.message : String(error)}`
            console.error('[Main]', errorMsg)
            throw new Error(errorMsg)
          }
        }

        if (keepLatestOnly && patches.length > 0) {
          // 以目标文件名（例如 Game.exe）作为“同名文件”的判断依据
          const latestMap = new Map<string, (typeof patches)[number]>()

          for (const patch of patches) {
            const key = patch.targetFileName
            const existing = latestMap.get(key)

            if (!existing) {
              latestMap.set(key, patch)
              continue
            }

            const vNew = parseInt(patch.version, 10)
            const vOld = parseInt(existing.version, 10)

            if (!Number.isNaN(vNew) && !Number.isNaN(vOld)) {
              if (vNew > vOld) {
                latestMap.set(key, patch)
              }
            } else if (patch.version > existing.version) {
              latestMap.set(key, patch)
            }
          }

          patches = Array.from(latestMap.values())
          // 重新按原始大小计算总下载体积
          totalSize = patches.reduce((sum, p) => sum + (p.originalSize || 0), 0)
        }

        return {
          success: true,
          totalSize,
          patches
        }
      } catch (error) {
        console.error('[Main] download-patch-lists 处理失败:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '下载补丁列表时发生未知错误'
        }
      }
    }
  )

  /**
   * 根据补丁列表信息下载并解压补丁文件到项目根目录 patch/file 目录中
   * - 下载前检查目标文件是否已存在（根据 targetFileName 判断），存在则跳过
   * - 下载完成后使用 lzma-native 解压，解压后的文件命名为 targetFileName
   * - 解压完成后删除压缩包本身
   */
  ipcMain.handle('download-patch-files', async (event, info: PatchUpdateInfo) => {
    try {
      const patches = info?.patches ?? []
      if (!Array.isArray(patches) || patches.length === 0) {
        throw new Error('没有可下载的补丁文件')
      }

      const appRoot = Utils.getTargetDir()
      const targetDir = join(appRoot, 'patch', 'file')

      try {
        if (!(await exists(targetDir))) {
          await mkdir(targetDir, { recursive: true })
        }
      } catch (error) {
        console.error('[Main] 创建 patch/file 目录失败:', error)
        throw new Error('创建补丁文件目录失败')
      }

      // 节流控制：默认 2 秒上报一次进度
      let lastProgressTime = 0
      const totalFiles = patches.length
      let completedFiles = 0

      const emitProgress = (
        stage: 'download' | 'decompress' | 'skip',
        currentFileDownloadFraction: number,
        currentFileDecompressFraction: number,
        targetFileName?: string,
        message?: string
      ) => {
        // 计算当前文件的进度（下载占50%，解压占50%）
        const currentFileProgress =
          currentFileDownloadFraction * 0.5 + currentFileDecompressFraction * 0.5

        // 计算总体进度：
        // - 已完成文件占 (completedFiles / totalFiles)
        // - 当前文件占 (currentFileProgress / totalFiles)
        const overallProgress = (completedFiles + currentFileProgress) / totalFiles
        const percent = Math.min(100, Number((overallProgress * 100).toFixed(2)))

        const now = Date.now()
        // 始终允许 100% 上报；其余情况 2 秒节流一次
        if (percent < 100 && now - lastProgressTime < 2000) {
          return
        }
        lastProgressTime = now

        event.sender.send('patch-progress', {
          percent,
          stage,
          targetFileName,
          message
        })
      }

      emitProgress('download', 0, 0, undefined, '开始更新补丁')

      for (const patch of patches) {
        let downloadFraction = 0
        let decompressFraction = 0
        const targetFileName = patch.targetFileName
        if (!targetFileName || !patch.downloadUrl) {
          continue
        }

        // 处理文件名可能包含路径的情况，如 "PatchInfo\DeleteFileList.dat"
        let outDir = targetDir
        let outFileName = targetFileName

        // 检查文件名是否包含路径分隔符
        if (targetFileName.includes('\\') || targetFileName.includes('/')) {
          // 解析路径
          const pathParts = targetFileName.split(/[\\/]/)
          outFileName = pathParts[pathParts.length - 1] // 最后一部分是文件名

          // 前面的部分是目录路径
          if (pathParts.length > 1) {
            const dirParts = pathParts.slice(0, -1) // 除了最后一部分，都是目录
            outDir = join(targetDir, ...dirParts)

            // 确保目标目录存在
            if (!(await exists(outDir))) {
              await mkdir(outDir, { recursive: true })
              console.log(`[Main] 已创建目录: ${outDir}`)
            }
          }
        }

        const outPath = join(outDir, outFileName)

        // 若目标文件已存在，则跳过
        if (await exists(outPath)) {
          console.log('[Main] 目标文件已存在，跳过下载与解压:', outPath)
          downloadFraction = 1
          decompressFraction = 1
          emitProgress(
            'skip',
            downloadFraction,
            decompressFraction,
            targetFileName,
            '目标文件已存在，跳过'
          )
          completedFiles++
          continue
        }

        // 临时文件保存在相同的目录结构中
        const tmpPath = join(outDir, patch.patchFileName || `${outFileName}.lzma`)
        console.log('[Main] 开始下载补丁文件:', patch.downloadUrl)

        try {
          await Utils.downloadFile(patch.downloadUrl, tmpPath, (_downloaded, _total, progress) => {
            downloadFraction = progress
            emitProgress(
              'download',
              downloadFraction,
              decompressFraction,
              targetFileName,
              '补丁下载中'
            )
          })

          console.log('[Main] 补丁文件下载完成，开始解压:', tmpPath)

          downloadFraction = 1
          emitProgress(
            'download',
            downloadFraction,
            decompressFraction,
            targetFileName,
            '补丁下载完成'
          )

          // 使用流的方式解压 .lzma 到目标文件
          let totalDecompressBytes = 0
          try {
            const statResult = await stat(tmpPath)
            totalDecompressBytes = statResult.size
          } catch {
            totalDecompressBytes = 0
          }

          await new Promise<void>((resolve, reject) => {
            const decoder = lzma.createDecompressor()
            const source = createReadStream(tmpPath)
            const dest = createWriteStream(outPath)

            let decompressedBytes = 0

            source.on('data', (chunk) => {
              decompressedBytes += chunk.length
              if (totalDecompressBytes > 0) {
                decompressFraction = Math.min(1, decompressedBytes / totalDecompressBytes)
                emitProgress(
                  'decompress',
                  downloadFraction,
                  decompressFraction,
                  targetFileName,
                  '补丁解压中'
                )
              }
            })

            source.on('error', (err) => reject(err))
            dest.on('error', (err) => reject(err))
            dest.on('finish', () => resolve())

            source.pipe(decoder).pipe(dest)
          })

          // 解压完成后删除临时压缩包（异步）
          try {
            await unlink(tmpPath)
          } catch (error) {
            console.warn('[Main] 删除临时补丁文件失败（可忽略）:', tmpPath, error)
          }

          console.log('[Main] 补丁解压完成:', outPath)
          decompressFraction = 1
          emitProgress(
            'decompress',
            downloadFraction,
            decompressFraction,
            targetFileName,
            '补丁解压完成'
          )
          completedFiles++
        } catch (error) {
          const errorMsg = `处理补丁文件失败: ${patch.downloadUrl} - ${error instanceof Error ? error.message : String(error)}`
          console.error('[Main]', errorMsg)
          throw new Error(errorMsg)
        }
      }

      // 确保所有文件处理完成后，进度为 100%
      if (completedFiles < totalFiles) {
        completedFiles = totalFiles
      }
      emitProgress('decompress', 1, 1, undefined, '所有补丁文件处理完成')

      return {
        success: true
      }
    } catch (error) {
      console.error('[Main] download-patch-files 处理失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '下载并解压补丁文件时发生未知错误'
      }
    }
  })

  /**
   * 应用补丁文件到游戏目录：
   * 1. 将 patch/file 下的文件复制并覆盖到 gamePath
   * 2. 更新 PatchInfo/Patch.ini 中的 patch.version 为最新版本
   * 3. 清空项目根目录的 patch 目录
   */
  ipcMain.handle('apply-patch-files', async (_event, gamePath: string, latestVersion: string) => {
    try {
      if (!gamePath || !latestVersion) {
        throw new Error('游戏路径或版本号为空')
      }

      // 在应用补丁前，检查 Game.exe 和 VLauncher.exe 是否正在运行中
      if (process.platform === 'win32') {
        const processesToCheck = ['Game.exe', 'VLauncher.exe']
        const runningProcesses: string[] = []

        for (const processName of processesToCheck) {
          try {
            const result = await spawnPromise('tasklist', ['/FI', `IMAGENAME eq ${processName}`], {
              collectStdout: true,
              collectStderr: false
            })

            const output = result.stdout.toLowerCase()
            const processNameLower = processName.toLowerCase()
            // tasklist 在找到进程时会包含进程名这一行
            if (output.includes(processNameLower)) {
              runningProcesses.push(processName)
            }
          } catch (error) {
            // 如果检查进程本身失败，记录警告但继续检查其他进程
            console.warn(`[Main] 检查 ${processName} 进程状态失败（忽略）:`, error)
          }
        }

        // 如果有进程正在运行，抛出错误
        if (runningProcesses.length > 0) {
          const processList = runningProcesses.join(' 和 ')
          throw new Error(`${processList} 正在运行中，请关闭后重试`)
        }
      }

      const appRoot = Utils.getTargetDir()
      const patchRoot = join(appRoot, 'patch')
      const patchFileDir = join(patchRoot, 'file')

      if (!(await exists(patchFileDir))) {
        throw new Error('未找到补丁文件目录')
      }

      // 递归读取所有补丁文件
      const getAllFiles = async (
        dir: string,
        baseDir: string = dir
      ): Promise<Array<{ path: string; relativePath: string }>> => {
        const files: Array<{ path: string; relativePath: string }> = []
        const entries = await readdir(dir, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = join(dir, entry.name)
          const relativePath = relative(baseDir, fullPath)

          if (entry.isDirectory()) {
            // 递归读取子目录
            const subFiles = await getAllFiles(fullPath, baseDir)
            files.push(...subFiles)
          } else if (entry.isFile()) {
            files.push({ path: fullPath, relativePath })
          }
        }

        return files
      }

      const allFiles = await getAllFiles(patchFileDir)
      let hasDeleteFileList = false
      let deleteFileList: string[] = []

      // 第一步：先查找并读取 DeleteFileList.dat（如果存在）
      for (const file of allFiles) {
        const relativePath = file.relativePath
        const normalizedPath = relativePath.replace(/\\/g, '/').toLowerCase()

        if (normalizedPath.endsWith('deletefilelist.dat')) {
          hasDeleteFileList = true
          console.log(`[Main] 检测到 DeleteFileList.dat: ${relativePath}`)

          // 读取 DeleteFileList.dat 内容（从补丁目录中读取，还未复制到游戏目录）
          try {
            const deleteFileListContent = await readFile(file.path, 'utf-8')
            deleteFileList = deleteFileListContent
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter((line) => line && !line.startsWith('#') && !line.startsWith(';'))

            console.log(
              `[Main] 预读取 DeleteFileList.dat，包含 ${deleteFileList.length} 个待删除文件`
            )
            console.log('[Main] 待删除文件列表:', deleteFileList)
          } catch (error) {
            console.warn('[Main] 预读取 DeleteFileList.dat 失败:', error)
          }
          break
        }
      }

      // 第二步：复制所有补丁文件，在复制前先删除目标文件（如果在删除列表中或已存在且被锁定）
      for (const file of allFiles) {
        const src = file.path
        const relativePath = file.relativePath

        // 处理相对路径，如 "PatchInfo\DeleteFileList.dat" 或 "PatchInfo/DeleteFileList.dat"
        let destDir = gamePath
        let destFileName = relativePath

        // 检查相对路径是否包含路径分隔符
        if (relativePath.includes('\\') || relativePath.includes('/')) {
          // 使用 path 模块解析路径
          const pathParts = relativePath.split(/[\\/]/)
          destFileName = pathParts[pathParts.length - 1] // 最后一部分是文件名

          // 前面的部分是目录路径
          if (pathParts.length > 1) {
            const dirParts = pathParts.slice(0, -1) // 除了最后一部分，都是目录
            destDir = join(gamePath, ...dirParts)

            // 确保目标目录存在
            if (!(await exists(destDir))) {
              await mkdir(destDir, { recursive: true })
              console.log(`[Main] 已创建目录: ${destDir}`)
            }
          }
        }

        const dest = join(destDir, destFileName)

        // 在复制前，检查目标文件是否需要删除
        // 1. 如果文件在 DeleteFileList.dat 中，先删除
        // 2. 如果目标文件已存在且可能被锁定，尝试先删除再复制
        const normalizedRelativePath = relativePath.replace(/[\\/]/g, '/')
        const shouldDelete = deleteFileList.some((deletePath) => {
          const normalizedDeletePath = deletePath.replace(/[\\/]/g, '/')
          return (
            normalizedRelativePath === normalizedDeletePath ||
            normalizedRelativePath.endsWith('/' + normalizedDeletePath) ||
            normalizedDeletePath === normalizedRelativePath
          )
        })

        if (shouldDelete || (await exists(dest))) {
          // 检查目标文件是否在删除列表中（精确匹配）
          const isInDeleteList = deleteFileList.some((deletePath) => {
            const normalizedDeletePath = deletePath.replace(/[\\/]/g, '/')
            const normalizedDestPath = relativePath.replace(/[\\/]/g, '/')
            return normalizedDestPath === normalizedDeletePath
          })

          if (isInDeleteList || (await exists(dest))) {
            try {
              if (await exists(dest)) {
                const statResult = await stat(dest)
                if (statResult.isFile()) {
                  console.log(`[Main] 复制前删除目标文件: ${dest}`)
                  await unlink(dest)
                  // 等待一小段时间，确保文件句柄释放
                  await new Promise((resolve) => setTimeout(resolve, 100))
                }
              }
            } catch (deleteError) {
              // 如果删除失败（文件被锁定），记录警告但继续尝试复制
              console.warn(`[Main] 无法删除目标文件（可能正在使用）: ${dest}`, deleteError)
              // 对于 EBUSY 错误，尝试重试几次
              if ((deleteError as NodeJS.ErrnoException).code === 'EBUSY') {
                console.log(`[Main] 文件被锁定，尝试等待后重试删除: ${dest}`)
                let retryCount = 0
                const maxRetries = 5
                while (retryCount < maxRetries) {
                  await new Promise((resolve) => setTimeout(resolve, 500))
                  try {
                    await unlink(dest)
                    console.log(`[Main] 重试删除成功: ${dest}`)
                    break
                  } catch {
                    retryCount++
                    if (retryCount >= maxRetries) {
                      console.error(`[Main] 重试 ${maxRetries} 次后仍无法删除文件: ${dest}`)
                      throw new Error(`无法删除被锁定的文件: ${dest}`)
                    }
                  }
                }
              } else {
                throw deleteError
              }
            }
          }
        }

        // 复制文件（带重试机制处理 EBUSY）
        let copySuccess = false
        let copyRetryCount = 0
        const maxCopyRetries = 3

        while (!copySuccess && copyRetryCount < maxCopyRetries) {
          try {
            await copyFile(src, dest)
            console.log(`[Main] 已复制补丁文件: ${relativePath} -> ${dest}`)
            copySuccess = true
          } catch (copyError) {
            const err = copyError as NodeJS.ErrnoException
            if (err.code === 'EBUSY' && copyRetryCount < maxCopyRetries - 1) {
              copyRetryCount++
              console.warn(
                `[Main] 复制文件被锁定，等待后重试 (${copyRetryCount}/${maxCopyRetries}): ${dest}`
              )
              // 尝试再次删除并等待
              try {
                if (await exists(dest)) {
                  await unlink(dest)
                }
              } catch {
                // 忽略删除错误
              }
              await new Promise((resolve) => setTimeout(resolve, 500))
            } else {
              throw copyError
            }
          }
        }
      }

      // 更新 PatchInfo/Patch.ini 中的版本号
      try {
        const patchIniPath = join(gamePath, 'PatchInfo', 'Patch.ini')
        if (await exists(patchIniPath)) {
          const iniContent = await readFile(patchIniPath, 'utf-8')
          const json = parseIniToJson(iniContent)
          const versionNum = Number(latestVersion)
          if (!Number.isNaN(versionNum)) {
            // @ts-expect-error  忽略错误
            if (!json.patch) json.patch = {}
            // @ts-expect-error  忽略错误
            json.patch.version = latestVersion
            const newIni = stringifyJsonToIni(json)
            await writeFile(patchIniPath, newIni, 'utf-8')
          }
        }
      } catch (error) {
        console.warn('[Main] 更新 Patch.ini 版本号失败（忽略）：', error)
        throw error
      }

      // 根据 DeleteFileList.dat 清空不再需要的文件
      // 注意：已经在复制阶段处理了在补丁文件中的文件，这里只处理不在补丁文件中的其他文件
      if (hasDeleteFileList && deleteFileList.length > 0) {
        try {
          console.log('[Main] 开始处理 DeleteFileList.dat 中剩余的待删除文件')

          // 获取所有已复制的补丁文件的相对路径（用于排除）
          const copiedFiles = new Set<string>()
          for (const file of allFiles) {
            const normalizedPath = file.relativePath.replace(/[\\/]/g, '/')
            copiedFiles.add(normalizedPath)
          }

          // 在 gamePath 根目录中查找并删除这些文件
          for (const filePath of deleteFileList) {
            try {
              // 规范化路径分隔符（统一使用系统分隔符）
              const normalizedFilePath = filePath.replace(/[\\/]/g, '/')

              // 跳过已经在复制阶段处理过的文件
              if (copiedFiles.has(normalizedFilePath)) {
                console.log(`[Main] 跳过已处理的文件: ${filePath}`)
                continue
              }

              const pathParts = normalizedFilePath.split('/').filter((p) => p) // 过滤空字符串

              // 从 gamePath 根目录查找
              const targetPath = join(gamePath, ...pathParts)

              console.log(`[Main] 尝试删除文件: ${filePath} -> ${targetPath}`)

              if (await exists(targetPath)) {
                // 检查是否是文件（不是目录）
                const statResult = await stat(targetPath)
                if (statResult.isFile()) {
                  // 对于可能被锁定的文件，添加重试机制
                  let deleteSuccess = false
                  let deleteRetryCount = 0
                  const maxDeleteRetries = 5

                  while (!deleteSuccess && deleteRetryCount < maxDeleteRetries) {
                    try {
                      await unlink(targetPath)
                      console.log(`[Main] ✓ 已删除文件: ${targetPath}`)
                      deleteSuccess = true
                    } catch (deleteError) {
                      const err = deleteError as NodeJS.ErrnoException
                      if (err.code === 'EBUSY' && deleteRetryCount < maxDeleteRetries - 1) {
                        deleteRetryCount++
                        console.warn(
                          `[Main] 文件被锁定，等待后重试删除 (${deleteRetryCount}/${maxDeleteRetries}): ${targetPath}`
                        )
                        await new Promise((resolve) => setTimeout(resolve, 500))
                      } else {
                        throw deleteError
                      }
                    }
                  }
                } else {
                  console.warn(`[Main] 跳过删除（是目录而非文件）: ${targetPath}`)
                }
              } else {
                console.warn(`[Main] 文件不存在，跳过删除: ${targetPath}`)
              }
            } catch (error) {
              console.error(`[Main] 删除文件失败: ${filePath}`, error)
              // 继续处理其他文件，不中断整个流程
            }
          }
          console.log('[Main] DeleteFileList.dat 处理完成')
        } catch (error) {
          console.error('[Main] 处理 DeleteFileList.dat 失败:', error)
          // 不抛出错误，允许继续执行
        }
      } else {
        console.log('[Main] 本次更新不包含 DeleteFileList.dat，跳过文件删除')
      }

      // 清空 patch 目录
      try {
        await rm(patchRoot, { recursive: true, force: true })
      } catch (error) {
        console.warn('[Main] 清空 patch 目录失败（忽略）：', error)
        throw new Error('[Main] 清空 patch 目录失败')
      }

      return { success: true }
    } catch (error) {
      console.error('[Main] apply-patch-files 失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '应用补丁文件时发生未知错误'
      }
    }
  })

  /**
   * 检查应用更新
   * 检查 GitHub releases 版本是否和当前一致
   * 如果有更新返回更新信息，否则返回 undefined
   */
  ipcMain.handle('check-app-update', async () => {
    try {
      const repoOwner = 'nyaruhodoo'
      const repoName = 'r2beat-launcher'
      const currentVersion = app.getVersion()
      console.log(`[Main] 当前应用版本: ${currentVersion}`)

      const result = await Utils.checkLatestVersion(repoOwner, repoName)

      if (!result.success || !result.latestVersion || !result.downloadUrl) {
        console.warn(`[Main] 检查更新失败: ${result.error || '未知错误'}`)
        return undefined
      }

      const latestVersion = result.latestVersion
      const downloadUrl = result.downloadUrl
      console.log(`[Main] GitHub 最新版本: ${latestVersion}`)

      const comparison = Utils.compareVersions(currentVersion, latestVersion)

      if (comparison > 0) {
        console.log(`[Main] ✨ 发现新版本！当前版本: ${currentVersion}, 最新版本: ${latestVersion}`)
        return {
          currentVersion,
          latestVersion,
          downloadUrl
        }
      } else {
        if (comparison < 0) {
          console.log(
            `[Main] ⚠️ 当前版本 (${currentVersion}) 比 GitHub 最新版本 (${latestVersion}) 更新（可能是开发版本）`
          )
        } else {
          console.log(`[Main] ✓ 当前版本 (${currentVersion}) 已是最新版本`)
        }
        return undefined
      }
    } catch (error) {
      console.error('[Main] 检查更新时发生异常:', error)
      return undefined
    }
  })
}
