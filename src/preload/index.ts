import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    console.log('[Preload] electronAPI exposed via contextBridge (contextIsolated: true)')
  } catch (error) {
    console.error('[Preload] Error exposing API:', error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  console.log('[Preload] electronAPI exposed directly (contextIsolated: false)')
}
