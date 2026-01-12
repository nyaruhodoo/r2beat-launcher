import { BrowserWindow, ipcMain, dialog, app } from 'electron'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import { parseIniToJson, stringifyJsonToIni } from './ini-json-converter'
import { AnnouncementData, Announcementlist, AppConfig, ProcessPriority } from '@types'
import { is } from '@electron-toolkit/utils'
import { sendTcpLoginRequest } from './tcp-login'
import { spawnPromise, spawnDetached, spawnGameProcess } from './spawn'

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
   */
  ipcMain.on('open-recharge-center', () => {
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
      rechargeWindow.webContents
        .executeJavaScript(
          `
          const amountBox = document.querySelector("#DivAmountInfo")  
          if(amountBox) {
            amountBox.innerHTML = '<input type="number" id="pg_pay_amt" name="pg_pay_amt" placeholder="请输入充值金额（整数）" min="1" step="1" inputmode="numeric" title="请输入正整数，不能包含小数点、负数或0" required style="height:27px; border:1px solid #ddd; box-sizing:border-box;" />'
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
  ipcMain.handle('write-config-ini', async (_, gamePath: string, configJson: AppConfig) => {
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
  })

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
   * 获取随机游戏封面图片路径
   * 从 resources/images 目录中随机选择一个图片文件
   */
  ipcMain.handle('get-random-game-image', async () => {
    try {
      // 获取 resources 目录路径
      // 开发环境：项目根目录/resources
      // 生产环境：应用资源目录/resources
      let resourcesPath: string
      if (is.dev) {
        // 开发环境：从主进程文件位置向上找到项目根目录
        resourcesPath = join(__dirname, '../../resources')
      } else {
        // 生产环境：使用应用资源目录
        resourcesPath = join(process.resourcesPath || app.getAppPath(), 'resources')
      }

      const imagesDir = join(resourcesPath, 'images')

      // 检查目录是否存在
      if (!existsSync(imagesDir)) {
        console.error('[Main] images 目录不存在:', imagesDir)
        return { success: false, error: '图片目录不存在' }
      }

      // 读取目录下的所有文件
      const files = readdirSync(imagesDir).filter((file) => {
        // 只返回图片文件（.avif, .png, .jpg, .jpeg 等）
        const ext = file.toLowerCase()
        return (
          ext.endsWith('.avif') ||
          ext.endsWith('.png') ||
          ext.endsWith('.jpg') ||
          ext.endsWith('.jpeg') ||
          ext.endsWith('.webp')
        )
      })

      if (files.length === 0) {
        console.error('[Main] images 目录中没有图片文件')
        return { success: false, error: '没有找到图片文件' }
      }

      // 随机选择一个文件
      const randomIndex = Math.floor(Math.random() * files.length)
      const selectedFile = files[randomIndex]

      // 对文件名进行 URL 编码（处理中文字符和特殊字符）
      // 使用 encodeURIComponent 编码文件名，但保留路径分隔符
      const encodedFileName = encodeURIComponent(selectedFile)

      // 使用自定义协议 app:// 返回图片路径
      // 路径格式：app://images/filename.ext（文件名已编码）
      const imageUrl = `app://images/${encodedFileName}`

      console.log('[Main] 随机选择图片:', selectedFile)
      return { success: true, imagePath: imageUrl, fileName: selectedFile }
    } catch (error) {
      console.error('[Main] 获取随机图片失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取随机图片时发生未知错误'
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
        return {
          success: false,
          error: '用户名和密码不能为空'
        }
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
}
