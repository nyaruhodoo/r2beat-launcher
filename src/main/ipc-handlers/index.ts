import { IpcListener, IpcEmitter } from '@electron-toolkit/typed-ipc/main'
import type { IpcMainEvents, IpcRendererEvents } from '../../ipc/contracts'
import { registerWindowHandlers } from './window'
import { registerAnnouncementHandlers } from './announcements'
import { registerGamePatchHandlers } from './game-patch'
import { registerGamePathHandlers } from './game-path'
import { registerAlbumHandlers } from './album'
import { registerLaunchGameHandlers } from './launch-game'
import { registerGameConfigHandlers } from './game-config'
import { registerModsHandlers } from './mods'
import { registerLoginHandlers } from './login'
import { registerLotteryHandlers } from './lottery'
import { registerLauncherUpdateHandlers } from './launcher-update'

// 该目录按需拆分 IPC：窗口/公告/游戏补丁/路径与相册/启动与配置/MOD/登录/抽奖/启动器更新

export const ipcHandlers = () => {
  const ipc = new IpcListener<IpcMainEvents>()
  const emitter = new IpcEmitter<IpcRendererEvents>()

  registerWindowHandlers(ipc, emitter)
  registerAnnouncementHandlers(ipc)
  registerGamePatchHandlers(ipc, emitter)
  registerGamePathHandlers(ipc)
  registerAlbumHandlers(ipc)
  registerLaunchGameHandlers(ipc)
  registerGameConfigHandlers(ipc)
  registerModsHandlers(ipc)
  registerLoginHandlers(ipc)
  registerLotteryHandlers(ipc)
  registerLauncherUpdateHandlers(ipc)

  return () => {
    ipc.dispose()
  }
}
