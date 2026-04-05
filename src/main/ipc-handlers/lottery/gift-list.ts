import { logInfo, logSuccess } from '../../log'
import type { GiftItem, WebUserInfo } from '@src/types'
import { http } from '../../http'
import { MainUtils } from '../../main-utils'

interface GiftListApiResponse {
  list: GiftItem[]
  current_page: number
  end_page: number
  per_page: number
  total: number
  result: number
}

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
  const pageSlots = Array.from({ length: extraPageCount }, (_, slot) => slot)

  const perPage = await MainUtils.runConcurrent(pageSlots, async (slot) => {
    const pageNum = slot + 2
    const res = await requestGiftList(token, { page: pageNum, per_page: 100, status: 1 })
    if (res.message) {
      throw new Error(res.message)
    }
    return res.list ?? []
  })

  return [...firstItems, ...perPage.flat()]
}

export async function fetchGiftItemsForEnabledAccounts(
  accounts: WebUserInfo[],
): Promise<GiftItem[]> {
  const enabled = accounts.filter((a) => a.disable !== true && Boolean(a.token?.trim()))
  let rows: GiftItem[] = []

  for (const acc of enabled) {
    logInfo(`开始统计 ${acc.remark || acc.username} 账户的抽奖道具，请稍等片刻`)

    const items = await fetchAllGifts(acc.token)
    rows = rows.concat(items)

    logSuccess(`${acc.remark || acc.username} 账户已统计完成，共计${items.length}个道具`)
  }

  return rows
}
