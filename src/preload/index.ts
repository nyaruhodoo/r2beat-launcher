import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { DownloadPatchFilesResult, PatchProgressPayload, PatchUpdateInfo } from '@types'

// Custom APIs for renderer
const api = {
  windowShow: () => {
    ipcRenderer.send('window-show')
  },
  windowMinimize: () => {
    ipcRenderer.send('window-minimize')
  },
  windowClose: () => {
    ipcRenderer.send('window-close')
  },
  showNotification: (title: string, body: string) => {
    ipcRenderer.send('show-notification', { title, body })
  },
  getAnnouncements: () => {
    const result = ipcRenderer.invoke('get-announcements')
    return result
  },
  getAnnouncementDetail: async (path: string, idx: number) => {
    const result = await ipcRenderer.invoke('get-announcement-detail', { path, idx })
    return result
  },
  selectFolder: async (currentPath?: string) => {
    const result = await ipcRenderer.invoke('select-folder', currentPath)
    return result
  },
  launchGame: async (
    gamePath: string,
    launchArgs?: string,
    minimizeToTrayOnLaunch?: boolean,
    processPriority?: string,
    lowerNPPriority?: boolean,
    username?: string,
    password?: string
  ) => {
    const result = await ipcRenderer.invoke(
      'launch-game',
      gamePath,
      launchArgs,
      minimizeToTrayOnLaunch,
      processPriority,
      lowerNPPriority,
      username,
      password
    )
    return result
  },
  readPatchInfo: async (gamePath: string) => {
    const result = await ipcRenderer.invoke('read-patch-info', gamePath)
    return result
  },
  readConfigIni: async (gamePath: string) => {
    const result = await ipcRenderer.invoke('read-config-ini', gamePath)
    return result
  },
  writeConfigIni: async (gamePath: string, configJson: Record<string, unknown>) => {
    const result = await ipcRenderer.invoke('write-config-ini', gamePath, configJson)
    return result
  },
  getRemoteVersion: async () => {
    const result = await ipcRenderer.invoke('get-remote-version')
    return result
  },
  openAnnouncementDetail: (detail: unknown) => {
    ipcRenderer.send('open-announcement-detail', detail)
  },
  onAnnouncementDetail: (callback: (detail: unknown) => void) => {
    ipcRenderer.on('announcement-detail-data', (_event, payload) => {
      callback(payload)
    })
  },
  windowMinimizeCurrent: () => {
    ipcRenderer.send('window-minimize-current')
  },
  windowCloseCurrent: () => {
    ipcRenderer.send('window-close-current')
  },
  openRechargeCenter: (username?: string) => {
    ipcRenderer.send('open-recharge-center', username)
  },
  getRandomGameImage: async () => {
    const result = await ipcRenderer.invoke('get-random-game-image')
    return result
  },
  tcpLogin: async (username: string, password: string) => {
    const result = await ipcRenderer.invoke('tcp-login', username, password)
    return result
  },
  downloadPatchLists: async (versions: string[], keepLatestOnly?: boolean) => {
    const result = await ipcRenderer.invoke('download-patch-lists', versions, keepLatestOnly)
    return result
  },
  downloadPatchFiles: async (info: PatchUpdateInfo): Promise<DownloadPatchFilesResult> => {
    const result = await ipcRenderer.invoke('download-patch-files', info)
    return result
  },
  applyPatchFiles: async (gamePath: string, latestVersion: string) => {
    const result = await ipcRenderer.invoke('apply-patch-files', gamePath, latestVersion)
    return result
  },
  onPatchProgress: (callback: (payload: PatchProgressPayload) => void) => {
    ipcRenderer.on('patch-progress', (_event, payload: PatchProgressPayload) => {
      callback(payload)
    })
  },
  getR2beatPath: async (shortcutPath?: string) => {
    const result = await ipcRenderer.invoke('get-r2beat-path', shortcutPath)
    return result
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    console.log('[Preload] API exposed via contextBridge (contextIsolated: true)')
  } catch (error) {
    console.error('[Preload] Error exposing API:', error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  console.log('[Preload] API exposed directly (contextIsolated: false)')
}
