import { join } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { stringify, parse } from 'ini'
import type { IpcListener } from '@electron-toolkit/typed-ipc/main'
import type { IpcMainEvents } from '../../../ipc/contracts'
import type { GameConfig, PatchInfo } from '@src/types'
import { MainUtils } from '../../main-utils'
import iconv from 'iconv-lite'

/** 游戏 config.ini 与 Patch.ini */
export function registerGameConfigHandlers(ipc: IpcListener<IpcMainEvents>): void {
  ipc.handle('read-config-ini', async (_, gamePath) => {
    try {
      if (!gamePath || gamePath.trim() === '') {
        throw new Error('游戏路径未设置')
      }

      const configIniPath = join(gamePath, 'config.ini')
      const iniExists = await MainUtils.exists(configIniPath)

      if (!iniExists) {
        throw new Error('未在指定路径中找到配置文件')
      }

      const buffer = await readFile(configIniPath)
      const fileContent = iconv.decode(buffer, 'win1252')

      return { success: true, exists: true, data: parse(fileContent) as GameConfig }
    } catch (error) {
      console.error('[Main] 读取 config.ini 失败:', error)
      return {
        success: false,
        exists: false,
        error: error instanceof Error ? error.message : '读取 config.ini 文件时发生未知错误',
      }
    }
  })

  ipc.handle('write-config-ini', async (_, gamePath, configJson) => {
    try {
      if (!gamePath || gamePath.trim() === '') {
        throw new Error('游戏路径未设置')
      }

      if (!configJson) {
        throw new Error('配置数据为空')
      }

      const configIniPath = join(gamePath, 'config.ini')

      await writeFile(
        configIniPath,
        iconv.encode(
          stringify(configJson, {
            whitespace: true,
          }),
          'win1252',
        ),
        'utf-8',
      )

      console.log('[Main] config.ini 保存成功:', configIniPath)
      return { success: true }
    } catch (error) {
      console.error('[Main] 保存 config.ini 失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存 config.ini 文件时发生未知错误',
      }
    }
  })

  ipc.handle('read-patch-info', async (_, gamePath) => {
    try {
      if (!gamePath || gamePath.trim() === '') {
        throw new Error('游戏路径未设置')
      }

      const patchIniPath = join(gamePath, 'PatchInfo', 'Patch.ini')
      if (!(await MainUtils.exists(patchIniPath))) {
        throw new Error(`找不到 Patch.ini 文件: ${patchIniPath}`)
      }

      const fileContent = await readFile(patchIniPath, 'utf-8')
      const patchInfo = parse(fileContent) as PatchInfo

      return { success: true, data: patchInfo }
    } catch (error) {
      console.error('[Main] 读取 Patch.ini 失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '读取 Patch.ini 文件时发生未知错误',
      }
    }
  })
}
