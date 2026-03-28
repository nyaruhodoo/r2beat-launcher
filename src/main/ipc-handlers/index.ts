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

// IPC 按领域分子目录；各目录 index 注册处理器，就近存放该领域专用实现（如 launch-game 下的 patch/hook、login 下的 TCP/Web 登录、lottery 下的 gift-list）。

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
