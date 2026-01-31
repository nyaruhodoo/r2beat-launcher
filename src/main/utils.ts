import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { dirname } from 'path'
import { createWriteStream } from 'fs'
import { get as httpGet } from 'http'
import { get as httpsGet } from 'https'
import { URL } from 'url'

export class Utils {
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
}
