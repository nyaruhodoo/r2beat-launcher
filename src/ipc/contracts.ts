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
 * 通用 IPC 返回类型：
 * - success/error 为通用字段
 * - 失败分支允许携带部分数据（例如 files: []），避免实现端返回“附带字段”时类型不匹配
 */
export type IpcResult<T extends object | void = void, E extends string = string> =
  | (T extends void
      ? { success: true; error?: undefined }
      : { success: true; error?: undefined } & T)
  | ({ success: false; error: E } & (T extends void ? unknown : Partial<T>))

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
      'get-announcement-detail': (args: { path: string; idx: number }) => IpcResult<{
        data: R2BeatNoticeData['data']
      }>
      'get-remote-version': () => IpcResult<{ version: string }>
      'get-r2beat-path': (shortcutPath?: string) => IpcResult<{ path: string }>
      'select-folder': (currentPath?: string) => string | null
      'reset-gg': (gamePath: string) => IpcResult
      'get-screenshots': (gamePath: string) => IpcResult<{ files: ScreenshotFileInfo[] }>
      'get-local-image-library': (libraryPath: string) => IpcResult<{ files: ScreenshotFileInfo[] }>
      'clear-screenshots': (gamePath: string) => IpcResult
      'open-screenshot': (filePath: string) => IpcResult
      'delete-screenshot': (filePath: string) => IpcResult
      'launch-game': (args: {
        gamePath: string
        launchArgs?: string
        minimizeToTrayOnLaunch?: boolean
        processPriority?: ProcessPriority
        lowerNPPriority?: boolean
        username?: string
        password?: string
        isShieldWordDisabled?: boolean
      }) => IpcResult
      'read-config-ini': (gamePath: string) => IpcResult<{
        exists: boolean
        data?: AppConfig
      }>
      'write-config-ini': (
        gamePath: string,
        configJson: Record<string, Record<string, unknown>>
      ) => IpcResult
      'read-patch-info': (gamePath: string) => IpcResult<{ data: PatchInfo }>
      'get-paks': (gamePath: string) => IpcResult<{
        gamePaks: PakFileInfo[]
        modsPaks: PakFileInfo[]
      }>
      'save-pak-to-game': (
        fileName: string,
        fileData: Buffer | Uint8Array,
        gamePath: string
      ) => IpcResult<{ destPath: string }>
      'copy-pak-to-game': (srcPath: string, gamePath: string) => IpcResult<{ destPath: string }>
      'move-pak-to-mods': (srcPath: string) => IpcResult<{ destPath: string }>
      'delete-pak': (srcPath: string) => IpcResult
      'tcp-login': (
        username: string,
        password: string
      ) => IpcResult<{
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
      }>
      'download-patch-lists': (
        versions: string[],
        keepLatestOnly?: boolean
      ) => IpcResult<{
        totalSize?: number
        patches?: PatchUpdateFile[]
      }>
      'download-patch-files': (info: PatchUpdateInfo) => IpcResult
      'apply-patch-files': (gamePath: string, latestVersion: string) => IpcResult
      'check-app-update': () =>
        | {
            currentVersion: string
            latestVersion: string
            downloadUrl: string
          }
        | undefined
      'open-game-recovery': (gamePath: string) => IpcResult
      'get-qq': () => IpcResult<{
        data?: {
          imgSrc?: string
          qqNumber?: string
        }
      }>
    }

/**
 * 渲染进程 IPC 事件类型（主进程发送到渲染进程）
 */
export type IpcRendererEvents = {
  'announcement-detail-data': [AnnouncementData]
  'patch-progress': [PatchProgressPayload]
}
