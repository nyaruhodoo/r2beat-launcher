import { shell } from 'electron'
import { join } from 'path'
import { stat, unlink } from 'fs/promises'
import type { IpcListener } from '@electron-toolkit/typed-ipc/main'
import type { IpcMainEvents } from '../../../ipc/contracts'
import { Utils } from '../../utils'

/** 游戏截图目录、本地图库、打开与删除图片 */
export function registerAlbumHandlers(ipc: IpcListener<IpcMainEvents>): void {
  ipc.handle('get-screenshots', async (_event, gamePath) => {
    try {
      if (!gamePath || typeof gamePath !== 'string' || gamePath.trim() === '') {
        throw new Error('游戏路径未设置，请在设置中配置游戏安装目录')
      }

      const screenshotDir = join(gamePath, 'SCREENSHOT')
      if (!(await Utils.exists(screenshotDir))) {
        return { success: true, files: [] as Array<{ name: string; path: string }> }
      }

      const dirStat = await stat(screenshotDir)
      if (!dirStat.isDirectory()) {
        return { success: true, files: [] as Array<{ name: string; path: string }> }
      }

      const imageExts = new Set([
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.webp',
        '.bmp',
        '.tif',
        '.tiff',
        '.avif',
      ])

      const files = await Utils.getAllFilesInDir(screenshotDir, {
        recursive: true,
        filter: (f) => imageExts.has(f.ext),
      })

      files.sort((a, b) => b.name.localeCompare(a.name))

      return { success: true, files }
    } catch (error) {
      console.error('[Main] get-screenshots 失败:', error)
      return {
        success: false,
        files: [],
        error: error instanceof Error ? error.message : '获取截图列表时发生未知错误',
      }
    }
  })

  ipc.handle('get-local-image-library', async (_event, libraryPath) => {
    try {
      if (!libraryPath || typeof libraryPath !== 'string' || libraryPath.trim() === '') {
        return { success: true, files: [] as Array<{ name: string; path: string }> }
      }

      if (!(await Utils.exists(libraryPath))) {
        return { success: true, files: [] as Array<{ name: string; path: string }> }
      }

      const dirStat = await stat(libraryPath)
      if (!dirStat.isDirectory()) {
        return { success: true, files: [] as Array<{ name: string; path: string }> }
      }

      const imageExts = new Set([
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.webp',
        '.bmp',
        '.tif',
        '.tiff',
        '.avif',
      ])

      const files = await Utils.getAllFilesInDir(libraryPath, {
        recursive: true,
        filter: (f) => imageExts.has(f.ext),
      })

      files.sort((a, b) => a.name.localeCompare(b.name))

      return { success: true, files }
    } catch (error) {
      console.error('[Main] get-local-image-library 失败:', error)
      return {
        success: false,
        files: [],
        error: error instanceof Error ? error.message : '获取本地图库列表时发生未知错误',
      }
    }
  })

  ipc.handle('clear-screenshots', async (_event, gamePath) => {
    try {
      if (!gamePath || typeof gamePath !== 'string' || gamePath.trim() === '') {
        throw new Error('游戏路径未设置，请在设置中配置游戏安装目录')
      }

      const screenshotDir = join(gamePath, 'SCREENSHOT')
      if (!(await Utils.exists(screenshotDir))) {
        return { success: true }
      }

      const dirStat = await stat(screenshotDir)
      if (!dirStat.isDirectory()) {
        throw new Error('SCREENSHOT 不是目录')
      }

      await Utils.clearDirFiles(screenshotDir, { recursive: true })

      return { success: true }
    } catch (error) {
      console.error('[Main] clear-screenshots 失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '清空截图目录时发生未知错误',
      }
    }
  })

  ipc.handle('open-screenshot', async (_event, filePath) => {
    try {
      if (!filePath) {
        throw new Error('文件路径为空')
      }

      if (!(await Utils.exists(filePath))) {
        throw new Error('文件不存在')
      }

      const err = await shell.openPath(filePath)
      if (err) {
        throw new Error(err)
      }

      return { success: true }
    } catch (error) {
      console.error('[Main] open-screenshot 失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '打开图片失败',
      }
    }
  })

  ipc.handle('delete-screenshot', async (_event, filePath) => {
    try {
      if (!filePath) {
        throw new Error('删除路径为空')
      }

      if (await Utils.exists(filePath)) {
        const info = await stat(filePath)
        if (info.isFile()) {
          await unlink(filePath)
        } else {
          throw new Error('目标不是文件')
        }
      } else {
        return { success: true }
      }

      return { success: true }
    } catch (error) {
      console.error('[Main] delete-screenshot 失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '删除截图时发生未知错误',
      }
    }
  })
}
