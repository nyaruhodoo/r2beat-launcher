import type { IpcListener } from '@electron-toolkit/typed-ipc/main'
import type { IpcMainEvents } from '../../../ipc/contracts'
import { logError, logInfo, logSuccess } from '../../log'
import { fetchGiftItemsForEnabledAccounts } from './gift-list'
import { destroyGiftItemRequest } from './destroy-item'
import { sendGiftItemRequest } from './send-item'

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

  ipc.handle('send-gift-item', async (_, args) => {
    const { character_name, itemName } = args
    const result = await sendGiftItemRequest({
      token: args.token,
      idx: args.idx,
      character_name,
    })
    if (result.success) {
      logSuccess(`向 ${character_name} 发送 ${itemName} 成功`)
      return { success: true }
    }
    logError(`向 ${character_name} 发送 ${itemName} 失败`)
    return { success: false, error: result.error }
  })

  ipc.handle('destroy-gift-item', async (_, args) => {
    const { accountLabel, itemName } = args
    const result = await destroyGiftItemRequest({ token: args.token, idx: args.idx })
    const logBase = `${accountLabel}的所属道具 ${itemName}`
    if (result.success) {
      logSuccess(`${logBase} 已转换为能量`)
      return { success: true }
    }
    logError(`${logBase} 转换为能量失败`)
    return { success: false, error: result.error }
  })
}
