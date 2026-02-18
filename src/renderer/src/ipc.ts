/**
 * Renderer-side typed IPC singletons.
 *
 * - preload 只需要暴露 `window.electron`（@electron-toolkit/preload 的 electronAPI）
 * - 渲染进程直接通过这两个单例进行 send / invoke / on，实现类型安全 IPC
 */

import { IpcEmitter, IpcListener } from '@electron-toolkit/typed-ipc/renderer'
import { isProxy, toRaw } from 'vue'
import type { IpcMainEvents, IpcRendererEvents } from '../../ipc/contracts'

export const ipcEmitter = new IpcEmitter<IpcMainEvents>()
export const ipcListener = new IpcListener<IpcRendererEvents>()

/**
 * IPC 参数安全化：
 * - Electron IPC 使用 structured clone；Vue 的 Proxy/ref/reactive 可能触发 “An object could not be cloned.”
 * - 对于 Proxy：先 toRaw，然后优先 structuredClone；失败再降级到 JSON 深拷贝，得到 plain object
 *
 * 注意：JSON 降级会丢失 undefined / Date / Map / Set 等特殊类型；本项目 IPC payload 以纯数据为主，适用。
 */
export function ipcArg<T>(value: T): T {
  const raw = isProxy(value) ? toRaw(value) : value

  // 优先使用 structuredClone（能保留 Uint8Array 等二进制类型）
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sc = (globalThis as any).structuredClone as undefined | ((v: unknown) => unknown)
    if (typeof sc === 'function') {
      return sc(raw) as T
    }
  } catch {
    // ignore
  }

  // 降级：强制转成可 clone 的 plain object
  try {
    return JSON.parse(JSON.stringify(raw)) as T
  } catch {
    // 最后兜底：直接返回（可能仍会在 IPC 报错，但不吞异常）
    return raw as T
  }
}


