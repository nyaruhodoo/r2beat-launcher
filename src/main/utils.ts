import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { dirname } from 'path'
import { createWriteStream } from 'fs'
import { get as httpGet } from 'http'
import { get as httpsGet } from 'https'
import { URL } from 'url'
import { spawnPromise } from './spawn'
import { access } from 'fs/promises'

export class Utils {
  /**
   * 获取当前环境根目录
   */
  static getTargetDir() {
    if (is.dev) {
      return app.getAppPath()
    } else {
      // 生产环境：获取应用可执行文件所在目录
      return dirname(app.getPath('exe'))
    }
  }

  /**
   * 下载文件到指定路径
   * @param url 下载地址（支持 http 和 https）
   * @param filePath 保存文件的完整路径
   * @param onProgress 可选的进度回调函数，参数为 (downloaded: number, total: number, progress: number)
   * @returns Promise<void> 下载成功时 resolve
   * @throws Error 下载失败时抛出错误
   */
  static async downloadFile(
    url: string,
    filePath: string,
    onProgress?: (downloaded: number, total: number, progress: number) => void
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        const urlObj = new URL(url)
        const isHttps = urlObj.protocol === 'https:'
        const getRequest = isHttps ? httpsGet : httpGet

        const fileStream = createWriteStream(filePath)

        const req = getRequest(url, (res) => {
          const { statusCode } = res

          // 检查状态码
          if (!statusCode || statusCode < 200 || statusCode >= 300) {
            res.resume() // 丢弃数据，避免内存泄漏
            fileStream.destroy()
            return reject(
              new Error(`下载文件失败: ${url} (${statusCode} ${res.statusMessage || 'Unknown'})`)
            )
          }

          const totalBytes = Number(res.headers['content-length'] || 0)
          let downloadedBytes = 0

          // 监听数据流
          res.on('data', (chunk: Buffer) => {
            downloadedBytes += chunk.length
            fileStream.write(chunk)

            // 如果有进度回调且知道总大小，则调用回调
            if (onProgress && totalBytes > 0) {
              const progress = Math.min(1, downloadedBytes / totalBytes)
              onProgress(downloadedBytes, totalBytes, progress)
            }
          })

          // 响应结束
          res.on('end', () => {
            fileStream.end()

            // 如果不知道总大小，在结束时调用一次进度回调（100%）
            if (onProgress && totalBytes === 0) {
              onProgress(downloadedBytes, downloadedBytes, 1)
            }

            resolve()
          })

          // 响应错误
          res.on('error', (err) => {
            fileStream.destroy()
            reject(err)
          })
        })

        // 请求错误
        req.on('error', (err) => {
          fileStream.destroy()
          reject(err)
        })

        // 文件流错误
        fileStream.on('error', (err) => {
          req.destroy()
          reject(err)
        })
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  /**
   * 检查 GitHub releases 最新版本
   * @param repoOwner 仓库所有者，例如 "nyaruhodoo"
   * @param repoName 仓库名称，例如 "r2beat-launcher"
   * @returns Promise<{ success: boolean; latestVersion?: string; downloadUrl?: string; error?: string }>
   */
  static async checkLatestVersion(
    repoOwner: string,
    repoName: string
  ): Promise<{
    success: boolean
    latestVersion?: string
    downloadUrl?: string
    error?: string
  }> {
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`

    try {
      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'r2beat-launcher',
          Accept: 'application/vnd.github.v3+json'
        }
      })

      if (!response.ok) {
        const errorMsg = `GitHub API 请求失败: ${response.status} ${response.statusText}`
        console.error('[Utils]', errorMsg)
        return { success: false, error: errorMsg }
      }

      const data = (await response.json()) as {
        tag_name?: string
        name?: string
        html_url?: string
        assets?: Array<{ browser_download_url?: string }>
      }
      const latestVersion = data.tag_name || data.name

      if (!latestVersion) {
        const errorMsg = 'GitHub API 响应中未找到版本号'
        console.error('[Utils]', errorMsg)
        return { success: false, error: errorMsg }
      }

      // 移除版本号前缀的 'v'（如果有）
      const cleanVersion = latestVersion.startsWith('v') ? latestVersion.slice(1) : latestVersion

      // 获取下载地址：优先使用 html_url（releases 页面），如果没有则使用第一个 asset 的下载地址
      let downloadUrl = data.html_url || undefined
      if (!downloadUrl && data.assets && data.assets.length > 0) {
        downloadUrl = data.assets[0].browser_download_url || undefined
      }
      // 如果都没有，使用 releases/latest 页面地址
      if (!downloadUrl) {
        downloadUrl = `https://github.com/${repoOwner}/${repoName}/releases/latest`
      }

      return { success: true, latestVersion: cleanVersion, downloadUrl }
    } catch (error) {
      const errorMsg = `检查更新失败: ${error instanceof Error ? error.message : String(error)}`
      console.error('[Utils]', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * 比较两个版本号
   * @param currentVersion 当前版本号，例如 "1.1.3"
   * @param latestVersion 最新版本号，例如 "1.1.4"
   * @returns 如果 latestVersion > currentVersion 返回 1，相等返回 0，小于返回 -1
   */
  static compareVersions(currentVersion: string, latestVersion: string): number {
    const currentParts = currentVersion.split('.').map(Number)
    const latestParts = latestVersion.split('.').map(Number)

    const maxLength = Math.max(currentParts.length, latestParts.length)

    for (let i = 0; i < maxLength; i++) {
      const current = currentParts[i] || 0
      const latest = latestParts[i] || 0

      if (latest > current) return 1
      if (latest < current) return -1
    }

    return 0
  }

  /**
   * 检查游戏是否正在运行中
   */
  static async checkGameRunning() {
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
  }

  /**
   * 检测文件是否存在
   */
  static async exists(path: string) {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  }

  /**
   * 安全执行 Promise 函数
   * 即使内部抛出异常，也会被捕获并打印，Promise 最终会 resolve
   */
  static async safeExecute(promiseFn: () => Promise<unknown>, taskName = 'Anonymous Task') {
    try {
      // 执行传入的异步函数
      const result = await promiseFn()
      return result
    } catch (error) {
      // 仅打印错误，不向上抛出
      console.error(`[Utils.safeExecute] Task "${taskName}" failed:`, error)

      // 返回 null 或自定义的默认值，确保外部 await 不会崩溃
      return null
    }
  }
}
