import { ElectronAPI } from '@electron-toolkit/preload'
import { ContextBridgeApi } from '@types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: ContextBridgeApi
  }
}
