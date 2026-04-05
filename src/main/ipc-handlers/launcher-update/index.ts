import { app } from 'electron'
import { join } from 'path'
import { execFile } from 'child_process'
import type { IpcListener } from '@electron-toolkit/typed-ipc/main'
import type { IpcMainEvents } from '../../../ipc/contracts'
import { MainUtils } from '../../main-utils'

/** 启动器自身更新（GitHub）、游戏修复工具 */
export function registerLauncherUpdateHandlers(ipc: IpcListener<IpcMainEvents>): void {
  ipc.handle('check-app-update', async () => {
    try {
      const repoOwner = 'nyaruhodoo'
      const repoName = 'r2beat-launcher'
      const currentVersion = app.getVersion()
      console.log(`[Main] 当前应用版本: ${currentVersion}`)

      const result = await MainUtils.checkLatestVersion(repoOwner, repoName)

      if (!result.success || !result.latestVersion || !result.downloadUrl) {
        console.warn(`[Main] 检查更新失败: ${result.error || '未知错误'}`)
        return undefined
      }

      const latestVersion = result.latestVersion
      const downloadUrl = result.downloadUrl
      console.log(`[Main] GitHub 最新版本: ${latestVersion}`)

      const comparison = MainUtils.compareVersions(currentVersion, latestVersion)

      if (comparison > 0) {
        console.log(`[Main] ✨ 发现新版本！当前版本: ${currentVersion}, 最新版本: ${latestVersion}`)
        return {
          currentVersion,
          latestVersion,
          downloadUrl,
        }
      } else {
        if (comparison < 0) {
          console.log(
            `[Main] ⚠️ 当前版本 (${currentVersion}) 比 GitHub 最新版本 (${latestVersion}) 更新（可能是开发版本）`,
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

  ipc.handle('open-game-recovery', async (_, gamePath) => {
    try {
      if (!gamePath || gamePath.trim() === '') {
        throw new Error('游戏路径未设置，请在设置中配置游戏安装目录')
      }

      const gameRecoveryPath = join(gamePath, 'GameRecovery.exe')
      if (!(await MainUtils.exists(gameRecoveryPath))) {
        throw new Error(`找不到修复文件: ${gameRecoveryPath} 请检查游戏安装目录是否正确`)
      }

      await MainUtils.checkGameRunning()

      const { promise, resolve } = Promise.withResolvers<
        { success: true } | { success: false; error: string }
      >()

      execFile(gameRecoveryPath, (error) => {
        if (error) {
          resolve({
            success: false,
            error: error.message,
          })
          return
        }

        resolve({
          success: true,
        })
      })

      return promise
    } catch (error) {
      console.error('[Main] 运行修复工具失败:', error)

      return {
        success: false,
        error: error instanceof Error ? error.message : '运行修复工具失败',
      }
    }
  })
}
