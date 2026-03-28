import { BrowserWindow } from 'electron'
import { IpcEmitter } from '@electron-toolkit/typed-ipc/main'
import type { IpcRendererEvents, MainLogKind, MainLogPayload } from '@src/ipc/contracts'

const emitter = new IpcEmitter<IpcRendererEvents>()

function broadcast(payload: MainLogPayload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      emitter.send(win.webContents, 'main-log', payload)
    }
  }
}

/** 主进程日志 → 渲染层 `main-log`（带时间戳、类型、文本） */
export function mainLog(kind: MainLogKind, text: string) {
  broadcast({ at: Date.now(), kind, text })
}

export const logInfo = (text: string) => mainLog('info', text)
export const logError = (text: string) => mainLog('error', text)
export const logSuccess = (text: string) => mainLog('success', text)
