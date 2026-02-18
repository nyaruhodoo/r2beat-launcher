/**
 * IPC 通信契约定义
 * 使用 @electron-toolkit/typed-ipc 实现类型安全的 IPC 通信
 *
 * 格式说明：
 * - { channel: [arg1, arg2] } 表示 listener 事件（send/on）
 * - { channel: () => returnType } 表示 handler 事件（handle/invoke）
 */

import type {
  AnnouncementData,
  R2BeatNoticeData,
  PatchUpdateInfo,
  ProcessPriority,
  PatchInfo,
  AppConfig,
  PatchProgressPayload,
  PatchUpdateFile,
  PakFileInfo,
  ScreenshotFileInfo
} from '@types'

/**
 * 主进程 IPC 事件类型
 * 使用联合类型定义 listener 事件和 handler 事件
 */
export type IpcMainEvents =
  | {
      // ========== 窗口控制 (send/on) ==========
      'window-show': []
      'window-minimize': []
      'window-close': []
      'window-minimize-current': []
      'window-close-current': []
      // ========== 通知和窗口操作 (send/on) ==========
      'show-notification': [{ title?: string; body?: string } | undefined | null]
      'open-recharge-center': [string | undefined]
      'open-announcement-detail': [AnnouncementData]
    }
  | {
      // ========== 请求-响应 (handle/invoke) ==========
      'get-announcements': () => AnnouncementData[]
      'get-announcement-detail': (args: { path: string; idx: number }) => {
        success: boolean
        data?: R2BeatNoticeData['data']
        error?: string
      }
      'get-remote-version': () => { success: boolean; version?: string; error?: string }
      'get-r2beat-path': (shortcutPath?: string) => {
        success: boolean
        path?: string
        error?: string
      }
      'select-folder': (currentPath?: string) => string | null
      'reset-gg': (gamePath: string) => { success: boolean; error?: string }
      'get-screenshots': (gamePath: string) => {
        success: boolean
        files: ScreenshotFileInfo[]
        error?: string
      }
      'get-local-image-library': (libraryPath: string) => {
        success: boolean
        files: ScreenshotFileInfo[]
        error?: string
      }
      'clear-screenshots': (gamePath: string) => { success: boolean; error?: string }
      'open-screenshot': (filePath: string) => { success: boolean; error?: string }
      'delete-screenshot': (filePath: string) => { success: boolean; error?: string }
      'launch-game': (args: {
        gamePath: string
        launchArgs?: string
        minimizeToTrayOnLaunch?: boolean
        processPriority?: ProcessPriority
        lowerNPPriority?: boolean
        username?: string
        password?: string
        isShieldWordDisabled?: boolean
      }) => { success: boolean; error?: string }
      'read-config-ini': (gamePath: string) => {
        success: boolean
        exists: boolean
        data?: AppConfig
        error?: string
      }
      'write-config-ini': (
        gamePath: string,
        configJson: Record<string, Record<string, unknown>>
      ) => { success: boolean; error?: string }
      'read-patch-info': (gamePath: string) => {
        success: boolean
        data?: PatchInfo
        error?: string
      }
      'get-paks': (gamePath: string) => {
        success: boolean
        gamePaks: PakFileInfo[]
        modsPaks: PakFileInfo[]
        error?: string
      }
      'save-pak-to-game': (
        fileName: string,
        fileData: Buffer | Uint8Array,
        gamePath: string
      ) => { success: boolean; destPath?: string; error?: string }
      'copy-pak-to-game': (srcPath: string, gamePath: string) => {
        success: boolean
        destPath?: string
        error?: string
      }
      'move-pak-to-mods': (srcPath: string) => {
        success: boolean
        destPath?: string
        error?: string
      }
      'delete-pak': (srcPath: string) => { success: boolean; error?: string }
      'tcp-login': (username: string, password: string) => {
        success: boolean
        status?: 'SUCCESS' | 'FAILURE' | 'ERROR' | 'UNKNOWN'
        message?: string
        data?: {
          MagicHeader?: string
          PayloadLength?: number
          CommandID?: number
          SessionID?: number
          Username?: string
          LoginTicket?: string
          EncryptionKey?: number
          UserID?: number
        }
        error?: string
      }
      'download-patch-lists': (
        versions: string[],
        keepLatestOnly?: boolean
      ) => {
        success: boolean
        totalSize?: number
        patches?: PatchUpdateFile[]
        error?: string
      }
      'download-patch-files': (info: PatchUpdateInfo) => {
        success: boolean
        error?: string
      }
      'apply-patch-files': (gamePath: string, latestVersion: string) => {
        success: boolean
        error?: string
      }
      'check-app-update': () =>
        | {
            currentVersion: string
            latestVersion: string
            downloadUrl: string
          }
        | undefined
      'open-game-recovery': (gamePath: string) => {
        success: boolean
        error?: string
      }
      'get-qq': () => {
        success: boolean
        error?: string
        data?: {
          imgSrc?: string
          qqNumber?: string
        }
      }
    }

/**
 * 渲染进程 IPC 事件类型（主进程发送到渲染进程）
 */
export type IpcRendererEvents = {
  'announcement-detail-data': [AnnouncementData]
  'patch-progress': [PatchProgressPayload]
}

