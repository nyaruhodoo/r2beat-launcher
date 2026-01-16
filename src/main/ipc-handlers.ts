import { BrowserWindow, ipcMain, dialog, app } from 'electron'
import { join } from 'path'
import { homedir } from 'os'
import {
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  createReadStream,
  createWriteStream,
  unlinkSync,
  statSync
} from 'fs'
import { get as httpGet } from 'http'
import { copyFileSync, rmSync } from 'fs'
import { parseIniToJson, stringifyJsonToIni } from './ini-json-converter'
import { AnnouncementData, Announcementlist, PatchUpdateInfo, ProcessPriority } from '@types'
import { sendTcpLoginRequest } from './tcp-login'
import { spawnPromise, spawnDetached, spawnGameProcess } from './spawn'
import lzma from 'lzma-native'

// 该文件只处理业务逻辑
export const ipcHandlers = (mainWindow?: BrowserWindow) => {
  ipcMain.on('window-show', () => {
    mainWindow?.show()
  })

  ipcMain.on('window-minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.on('window-close', () => {
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
          const amountBox = document.querySelector("#DivAmountInfo")  
          if(amountBox) {
            amountBox.innerHTML = '<input type="number" id="pg_pay_amt" name="pg_pay_amt" placeholder="请输入充值金额（整数）" min="1" step="1" inputmode="numeric" title="请输入正整数，不能包含小数点、负数或0" required style="height:27px; border:1px solid #ddd; box-sizing:border-box;" />'
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
    const targetHeight = Math.round(baseHeight * 0.9)

    const detailWindow = new BrowserWindow({
      width: 800,
      height: targetHeight,
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
          return { success: false, error: '获取公告详情失败' }
        }

        const result = (await response.json()) as Announcementlist
        const list = result?.data?.data ?? []

        const target = list.find((item) => item.idx === idx)
        if (!target) {
          console.warn('[Main] 未找到匹配的公告详情，idx:', idx)
          return { success: false, error: '未找到公告详情' }
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
      const urls = [
        'https://external-api.xiyouxi.com/api/lounge/posts/r2beat/Event/latest/6',
        'https://external-api.xiyouxi.com/api/lounge/posts/r2beat/RuleAndRegulations/latest/6',
        'https://external-api.xiyouxi.com/api/lounge/posts/r2beat/Notice/latest/6'
      ]

      const responses = await Promise.all(
        urls.map(async (url, index) => {
          try {
            const response = await fetch(url)

            if (!response.ok) {
              console.error(
                `[Main] Failed to fetch ${url}: ${response.status} ${response.statusText}`
              )
              return []
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
        return { success: false, error: '远程版本请求失败' }
      }

      const text = await response.text()
      const lines = text.split(/\r?\n/).map((line) => line.trim())

      const userOpenIndex = lines.findIndex((line) => line.toLowerCase() === '[useropen]')
      if (userOpenIndex === -1) {
        return { success: false, error: '未找到 [useropen] 段落' }
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
        return { success: false, error: 'useropen 段中没有有效版本行' }
      }

      const latest = userOpenLines[userOpenLines.length - 1]
      return { success: true, version: latest }
    } catch (error) {
      console.error('[Main] 获取远程版本异常:', error)
      return { success: false, error: '获取远程版本时发生异常' }
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
   * @param gamePath 游戏安装目录
   * @param launchArgs 命令行参数（可选）
   * @param closeOnLaunch 启动后是否关闭启动器
   */
  ipcMain.handle(
    'launch-game',
    async (
      _,
      gamePath: string,
      launchArgs?: string,
      closeOnLaunch?: boolean,
      processPriority?: ProcessPriority,
      lowerNPPriority?: boolean
    ) => {
      try {
        if (!gamePath || gamePath.trim() === '') {
          return { success: false, error: '游戏路径未设置，请在设置中配置游戏安装目录' }
        }

        const gameExePath = join(gamePath, 'Game.exe')
        if (!existsSync(gameExePath)) {
          return {
            success: false,
            error: `找不到游戏文件: ${gameExePath}\n请检查游戏安装目录是否正确`
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

        /**
         * 等待优先级相关操作结果
         */
        try {
          await new Promise((res) => {
            if (process.platform !== 'win32' || !gameProcess.pid) {
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

        if (closeOnLaunch) {
          // 在 Windows 上，需要调用 unref() 来让父进程可以退出
          if (gameProcess.unref) {
            gameProcess.unref()
          }

          console.log('[Main] 关闭启动器（根据用户设置）')
          if (mainWindow) {
            mainWindow.close()
          }
        } else {
          // 不关闭启动器时，保持进程引用，防止主进程意外退出
          console.log('[Main] 保持启动器运行（根据用户设置）')
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
      const exists = existsSync(configIniPath)

      if (!exists) {
        return { success: true, exists: false }
      }

      // 读取文件内容
      const fileContent = readFileSync(configIniPath, 'utf-8')

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
          return { success: false, error: '游戏路径未设置' }
        }

        if (!configJson) {
          return { success: false, error: '配置数据为空' }
        }

        const configIniPath = join(gamePath, 'config.ini')

        // 使用 ini-json-converter 转换为 INI 字符串
        const iniContent = stringifyJsonToIni(configJson)

        // 写入文件
        writeFileSync(configIniPath, iniContent, 'utf-8')

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
        return { success: false, error: '游戏路径未设置' }
      }

      const patchIniPath = join(gamePath, 'PatchInfo', 'Patch.ini')

      // 检查文件是否存在
      if (!existsSync(patchIniPath)) {
        return { success: false, error: `找不到 Patch.ini 文件: ${patchIniPath}` }
      }

      // 读取文件内容
      const fileContent = readFileSync(patchIniPath, 'utf-8')
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
    async (_event, versions: string[], options?: { keepLatestOnly?: boolean }) => {
      try {
        if (!Array.isArray(versions) || versions.length === 0) {
          throw new Error('版本列表为空')
        }

        // 过滤非法版本号（只允许数字字符串）
        const validVersions = versions.filter((v) => typeof v === 'string' && /^\d+$/.test(v))
        if (validVersions.length === 0) {
          throw new Error('没有有效的版本号')
        }

        // 目标目录：项目根目录 /patch/lst
        const appRoot = app.getAppPath()
        const targetDir = join(appRoot, 'patch', 'lst')

        // 确保目录存在
        try {
          if (!existsSync(targetDir)) {
            // 使用 fs.mkdirSync 递归创建目录
            mkdirSync(targetDir, { recursive: true })
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
          if (existsSync(filePath)) {
            console.log(`[Main] 补丁列表已存在，跳过: ${fileName}`)
            localFiles.push({ version, filePath })
            continue
          }

          const url = `https://r2beat-cdn.xiyouxi.com/live/vpatch/${version}/${version}.lst`
          console.log('[Main] 开始下载补丁列表:', url)

          const response = await fetch(url)
          if (!response.ok) {
            const errorMsg = `下载补丁列表失败: ${url} (${response.status} ${response.statusText})`
            console.error('[Main]', errorMsg)
            throw new Error(errorMsg)
          }

          const arrayBuffer = await response.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          writeFileSync(filePath, buffer)
          localFiles.push({ version, filePath })
          console.log('[Main] 补丁列表下载完成:', filePath)
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
            const content = readFileSync(filePath, 'utf-8')
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
              const targetFileName = parts[1]
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

        // 根据配置选择是否只保留同名补丁中的最新版本（默认 true）
        const keepLatestOnly = options?.keepLatestOnly !== false

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

      // 在应用补丁前，检查 Game.exe 是否正在运行中
      if (process.platform === 'win32') {
        try {
          const result = await spawnPromise('tasklist', ['/FI', 'IMAGENAME eq Game.exe'], {
            collectStdout: true,
            collectStderr: false
          })

          const output = result.stdout.toLowerCase()
          // tasklist 在找到进程时会包含 "game.exe" 这一行
          if (output.includes('game.exe')) {
            throw new Error('游戏正在运行中，请关闭游戏后重试')
          }
        } catch (error) {
          // 如果检查进程本身失败，只在明确检测到进程存在时阻断，其他错误允许继续
          if (error instanceof Error && error.message.includes('游戏正在运行中')) {
            throw error
          }
          console.warn('[Main] 检查 Game.exe 进程状态失败（忽略）:', error)
        }
      }

      const appRoot = app.getAppPath()
      const patchRoot = join(appRoot, 'patch')
      const patchFileDir = join(patchRoot, 'file')

      if (!existsSync(patchFileDir)) {
        throw new Error('未找到补丁文件目录')
      }

      // 复制补丁文件覆盖到游戏目录
      const files = readdirSync(patchFileDir, { withFileTypes: true })
      for (const file of files) {
        if (!file.isFile()) continue
        const src = join(patchFileDir, file.name)
        const dest = join(gamePath, file.name)
        copyFileSync(src, dest)
      }

      // 更新 PatchInfo/Patch.ini 中的版本号
      try {
        const patchIniPath = join(gamePath, 'PatchInfo', 'Patch.ini')
        if (existsSync(patchIniPath)) {
          const iniContent = readFileSync(patchIniPath, 'utf-8')
          const json = parseIniToJson(iniContent)
          const versionNum = Number(latestVersion)
          if (!Number.isNaN(versionNum)) {
            // @ts-expect-error  忽略错误
            if (!json.patch) json.patch = {}
            // @ts-expect-error  忽略错误
            json.patch.version = latestVersion
            const newIni = stringifyJsonToIni(json)
            writeFileSync(patchIniPath, newIni, 'utf-8')
          }
        }
      } catch (error) {
        console.warn('[Main] 更新 Patch.ini 版本号失败（忽略）：', error)
        throw error
      }

      // 清空 patch 目录
      try {
        rmSync(patchRoot, { recursive: true, force: true })
      } catch (error) {
        console.warn('[Main] 清空 patch 目录失败（忽略）：', error)
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

      const appRoot = app.getAppPath()
      const targetDir = join(appRoot, 'patch', 'file')

      try {
        if (!existsSync(targetDir)) {
          mkdirSync(targetDir, { recursive: true })
        }
      } catch (error) {
        console.error('[Main] 创建 patch/file 目录失败:', error)
        throw new Error('创建补丁文件目录失败')
      }

      // 节流控制：默认 2 秒上报一次进度
      let lastProgressTime = 0

      const emitProgress = (
        stage: 'download' | 'decompress' | 'skip',
        downloadFraction: number,
        decompressFraction: number,
        targetFileName?: string,
        message?: string
      ) => {
        const overall = downloadFraction * 0.5 + decompressFraction * 0.5
        const percent = Number((overall * 100).toFixed(2))

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

        const outPath = join(targetDir, targetFileName)

        // 若目标文件已存在，则跳过
        if (existsSync(outPath)) {
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
          continue
        }

        const tmpPath = join(targetDir, patch.patchFileName || `${targetFileName}.lzma`)
        console.log('[Main] 开始下载补丁文件:', patch.downloadUrl)

        try {
          await new Promise<void>((resolve, reject) => {
            const fileStream = createWriteStream(tmpPath)
            const req = httpGet(patch.downloadUrl, (res) => {
              const { statusCode } = res
              if (!statusCode || statusCode < 200 || statusCode >= 300) {
                const errorMsg = `下载补丁文件失败: ${patch.downloadUrl} (${statusCode} ${res.statusMessage})`
                console.error('[Main]', errorMsg)
                res.resume() // 丢弃数据，避免内存泄漏
                fileStream.destroy()
                return reject(new Error(errorMsg))
              }

              const totalBytes = Number(res.headers['content-length'] || 0)
              let downloadedBytes = 0

              res.on('data', (chunk: Buffer) => {
                downloadedBytes += chunk.length
                fileStream.write(chunk)
                if (totalBytes > 0) {
                  downloadFraction = Math.min(1, downloadedBytes / totalBytes)
                  emitProgress(
                    'download',
                    downloadFraction,
                    decompressFraction,
                    targetFileName,
                    '补丁下载中'
                  )
                }
              })

              res.on('end', () => {
                fileStream.end()
                if (totalBytes === 0) {
                  downloadFraction = 1
                  emitProgress(
                    'download',
                    downloadFraction,
                    decompressFraction,
                    targetFileName,
                    '补丁下载完成'
                  )
                }
                resolve()
              })

              res.on('error', (err) => {
                fileStream.destroy()
                reject(err)
              })
            })

            req.on('error', (err) => {
              fileStream.destroy()
              reject(err)
            })

            fileStream.on('error', (err) => reject(err))
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
          await new Promise<void>((resolve, reject) => {
            const decoder = lzma.createDecompressor()
            const source = createReadStream(tmpPath)
            const dest = createWriteStream(outPath)

            let decompressedBytes = 0
            let totalDecompressBytes = 0
            try {
              const stat = statSync(tmpPath)
              totalDecompressBytes = stat.size
            } catch {
              totalDecompressBytes = 0
            }

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

          // 解压完成后删除临时压缩包
          try {
            unlinkSync(tmpPath)
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
        } catch (error) {
          const errorMsg = `处理补丁文件失败: ${patch.downloadUrl} - ${error instanceof Error ? error.message : String(error)}`
          console.error('[Main]', errorMsg)
          throw new Error(errorMsg)
        }
      }

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
}
