import type { GiftItem, WebUserInfo } from '@src/types'
import { fetchAllGifts } from './export-lottery-items-txt'
import { logInfo, logSuccess } from './log'

/**
 * 按账号顺序拉取抽奖仓库物品；跳过禁用账号；任一账号拉取失败则中断抛错。
 */
export async function fetchGiftItemsForEnabledAccounts(
  accounts: WebUserInfo[],
): Promise<GiftItem[]> {
  const enabled = accounts.filter((a) => a.disable !== true && Boolean(a.token?.trim()))
  let rows: GiftItem[] = []

  for (const acc of enabled) {
    logInfo(`开始统计 ${acc.remark ?? acc.username} 账户的抽奖道具，请稍等片刻`)

    const items = await fetchAllGifts(acc.token)
    rows = rows.concat(items)

    logSuccess(`${acc.remark ?? acc.username} 账户已统计完成，共计${items.length}个道具`)
  }

  return rows
}
