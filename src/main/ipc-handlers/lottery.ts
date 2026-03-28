import type { IpcListener } from '@electron-toolkit/typed-ipc/main'
import type { IpcMainEvents } from '../../ipc/contracts'
import { logError, logInfo, logSuccess } from './log'
import { GiftItem, WebUserInfo } from '@src/types'
import { http } from '../http'

interface GiftListApiResponse {
  list: GiftItem[]
  current_page: number
  end_page: number
  // 分页大小
  per_page: number
  total: number
  result: number
}

const FETCH_GIFTS_PAGE_CONCURRENCY = 3

async function requestGiftList(token: string, params: Record<string, unknown>) {
  const API_URL = 'http://external-api.xiyouxi.com/api/gift/getGiftList'

  const { data } = await http.post<
    GiftListApiResponse & {
      code: number
      status: number
      message: string
    }
  >(API_URL, params, {
    headers: {
      Authorization: token,
    },
  })

  return data
}

async function fetchAllGifts(token: string): Promise<GiftItem[]> {
  const firstPage = await requestGiftList(token, { page: 1, status: 1 })

  if (firstPage.message) {
    throw new Error(firstPage.message)
  }

  const firstItems: GiftItem[] = [...(firstPage.list || [])]
  const totalPages = firstPage.end_page
  if (totalPages <= 1) return firstItems

  const extraPageCount = totalPages - 1
  const perPage: GiftItem[][] = new Array(extraPageCount)
  let cursor = 0
  let aborted = false

  const pickNext = (): number | undefined => {
    if (aborted) return undefined
    const i = cursor++
    if (i >= extraPageCount) return undefined
    return i
  }

  async function worker(): Promise<void> {
    while (!aborted) {
      const slot = pickNext()
      if (slot === undefined) return
      const pageNum = slot + 2
      try {
        const res = await requestGiftList(token, { page: pageNum, per_page: 100, status: 1 })
        if (res.message) {
          throw new Error(res.message)
        }
        perPage[slot] = res.list ?? []
      } catch (e) {
        aborted = true
        throw e
      }
    }
  }

  const poolSize = Math.min(FETCH_GIFTS_PAGE_CONCURRENCY, extraPageCount)
  await Promise.all(Array.from({ length: poolSize }, () => worker()))

  return [...firstItems, ...perPage.flat()]
}

async function fetchGiftItemsForEnabledAccounts(accounts: WebUserInfo[]): Promise<GiftItem[]> {
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
