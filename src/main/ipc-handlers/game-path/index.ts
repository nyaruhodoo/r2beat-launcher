import { BrowserWindow, dialog, shell } from 'electron'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { stat, rm } from 'fs/promises'
import type { IpcListener } from '@electron-toolkit/typed-ipc/main'
import type { IpcMainEvents } from '../../../ipc/contracts'
import { Utils } from '../../utils'

/** 游戏安装路径、目录选择、GameGuard 重置 */
export function registerGamePathHandlers(ipc: IpcListener<IpcMainEvents>): void {
  ipc.handle('get-r2beat-path', async (_, shortcutPath) => {
    try {
      let finalShortcutPath = shortcutPath
      if (!finalShortcutPath) {
        const appData = process.env.APPDATA
        if (!appData) {
          throw new Error('无法获取 APPDATA 路径')
        }
        finalShortcutPath = join(
          appData,
          'Microsoft\\Windows\\Start Menu\\Programs\\R2beat\\音速觉醒.lnk',
        )
      }

      if (!(await Utils.exists(finalShortcutPath))) {
        throw new Error(`找不到快捷方式文件: ${finalShortcutPath}`)
      }

      const shortcutDetails = shell.readShortcutLink(finalShortcutPath)
      if (!shortcutDetails.target) {
        throw new Error('快捷方式中没有目标路径')
      }

      const targetDir = dirname(shortcutDetails.target)

      if (!(await Utils.exists(targetDir))) {
        throw new Error(`目标目录不存在: ${targetDir}`)
      }

      return {
        success: true,
        path: targetDir,
      }
    } catch (error) {
      console.error('[Main] 获取 R2beat 路径失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取 R2beat 路径失败',
      }
    }
  })

  ipc.handle('select-folder', async (event, currentPath) => {
    const win = BrowserWindow.fromWebContents(event.sender)

    try {
      let defaultPath = currentPath
      if (!defaultPath || defaultPath.trim() === '') {
        defaultPath = homedir()
      }

      if (!win) return null

      const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory'],
        title: '选择游戏安装目录',
        defaultPath: defaultPath,
        ...(process.platform === 'win32' &&
          {
            // Windows 特定的选项
          }),
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

  ipc.handle('reset-gg', async (_event, gamePath) => {
    try {
      if (!gamePath || typeof gamePath !== 'string' || gamePath.trim() === '') {
        throw new Error('游戏路径未设置，请在设置中配置游戏安装目录')
      }

      await Utils.checkGameRunning()

      const ggDir = join(gamePath, 'GameGuard')

      if (!(await Utils.exists(ggDir))) {
        return { success: true }
      }

      const ggStat = await stat(ggDir)
      if (!ggStat.isDirectory()) {
        return { success: true }
      }

      await rm(ggDir, { recursive: true, force: true })

      return { success: true }
    } catch (error) {
      console.error('[Main] reset-gg 失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '重置 GameGuard 时发生未知错误',
      }
    }
  })
}
