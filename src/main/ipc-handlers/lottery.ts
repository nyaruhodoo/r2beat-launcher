import type { IpcListener } from '@electron-toolkit/typed-ipc/main'
import type { IpcMainEvents } from '../../ipc/contracts'
import { fetchGiftItemsForEnabledAccounts } from '../gift-list-all-accounts'
import { logError, logInfo, logSuccess } from '../log'

/** 抽奖仓库 / 发货助手物品统计 */
export function registerLotteryHandlers(ipc: IpcListener<IpcMainEvents>): void {
  ipc.handle('get-gift-list', async (_, userInfoList) => {
    try {
      logInfo(`开始统计抽奖物品，当前已启用${userInfoList.length}个账号`)
      const items = await fetchGiftItemsForEnabledAccounts(userInfoList)
      logSuccess(`${userInfoList.length}个账号，物品已统计完成，共${items.length}个道具`)

      return { success: true, items }
    } catch (error) {
      const message = error instanceof Error ? error.message : `统计抽奖物品失败`
      logError(message)
      return { success: false, error: message, items: [] }
    }
  })
}
