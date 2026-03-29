import { join, basename } from 'path'
import { readdir, mkdir, unlink, stat, copyFile, writeFile } from 'fs/promises'
import type { IpcListener } from '@electron-toolkit/typed-ipc/main'
import type { IpcMainEvents } from '../../../ipc/contracts'
import { Utils } from '../../utils'

/** MOD / .pak 管理 */
export function registerModsHandlers(ipc: IpcListener<IpcMainEvents>): void {
  ipc.handle('get-paks', async (_, gamePath) => {
    try {
      if (!gamePath || gamePath.trim() === '') {
        throw new Error('目录路径未设置')
      }

      const gameDirExists = await Utils.exists(gamePath)
      if (!gameDirExists) {
        throw new Error(`目录不存在: ${gamePath}`)
      }

      const chineseReg = /[\u3400-\u9FFF\uF900-\uFAFF]/

      const gameEntries = await readdir(gamePath, { withFileTypes: true })
      const gamePaks = gameEntries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((name) => name.toLowerCase().endsWith('.pak') && chineseReg.test(name))
        .map((name) => ({
          name,
          path: join(gamePath, name),
        }))

      const appRoot = Utils.getTargetDir()
      const modsRoot = join(appRoot, 'mods')

      let modsPaks: { name: string; path: string }[] = []
      if (await Utils.exists(modsRoot)) {
        const modsEntries = await readdir(modsRoot, { withFileTypes: true })
        modsPaks = modsEntries
          .filter((entry) => entry.isFile())
          .map((entry) => entry.name)
          .filter((name) => name.toLowerCase().endsWith('.pak'))
          .map((name) => ({
            name,
            path: join(modsRoot, name),
          }))
      }

      return {
        success: true,
        gamePaks,
        modsPaks,
      }
    } catch (error) {
      console.error('[Main] 获取 pak 文件列表失败:', error)
      return {
        success: false,
        gamePaks: [],
        modsPaks: [],
        error: error instanceof Error ? error.message : '获取 pak 文件列表时发生未知错误',
      }
    }
  })

  ipc.handle('save-pak-to-game', async (_, fileName, fileData, gamePath) => {
    try {
      if (!fileName || !fileData || !gamePath) {
        throw new Error('文件名、文件数据或游戏路径为空')
      }

      if (!(await Utils.exists(gamePath))) {
        throw new Error(`游戏目录不存在: ${gamePath}`)
      }

      const destPath = join(gamePath, fileName)
      const buffer = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData)
      await writeFile(destPath, buffer)

      return { success: true, destPath }
    } catch (error) {
      console.error('[Main] save-pak-to-game 失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存补丁到游戏目录时发生未知错误',
      }
    }
  })

  ipc.handle('copy-pak-to-game', async (_, srcPath, gamePath) => {
    try {
      if (!srcPath || !gamePath) {
        throw new Error('源路径或游戏路径为空')
      }

      if (!(await Utils.exists(srcPath))) {
        throw new Error(`源文件不存在: ${srcPath}`)
      }

      if (!(await Utils.exists(gamePath))) {
        throw new Error(`游戏目录不存在: ${gamePath}`)
      }

      const fileName = basename(srcPath)
      const destPath = join(gamePath, fileName)

      await copyFile(srcPath, destPath)

      return { success: true, destPath }
    } catch (error) {
      console.error('[Main] copy-pak-to-game 失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '复制补丁到游戏目录时发生未知错误',
      }
    }
  })

  ipc.handle('move-pak-to-mods', async (_, srcPath) => {
    try {
      if (!srcPath) {
        throw new Error('源路径为空')
      }

      if (!(await Utils.exists(srcPath))) {
        throw new Error(`源文件不存在: ${srcPath}`)
      }

      const appRoot = Utils.getTargetDir()
      const modsRoot = join(appRoot, 'mods')

      if (!(await Utils.exists(modsRoot))) {
        await mkdir(modsRoot, { recursive: true })
      }

      const fileName = basename(srcPath)
      const destPath = join(modsRoot, fileName)

      await copyFile(srcPath, destPath)
      await unlink(srcPath)

      return { success: true, destPath }
    } catch (error) {
      console.error('[Main] move-pak-to-mods 失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '移动补丁到 mods 目录时发生未知错误',
      }
    }
  })

  ipc.handle('delete-pak', async (_, srcPath) => {
    try {
      if (!srcPath) {
        throw new Error('删除路径为空')
      }

      if (await Utils.exists(srcPath)) {
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
        error: error instanceof Error ? error.message : '删除补丁文件时发生未知错误',
      }
    }
  })
}
