import { dialog } from 'electron'
import { writeFile } from 'fs/promises'
import type { GiftItem } from '@globalTypes'
import { http } from './http'

interface GroupedData {
  name: string
  total: string
  code: string
  _countValue: number
  _unit: string
  list: GiftItem[]
}

interface DetailInfo {
  count: number
  subTotal: number
  unit: string
}

interface GiftListApiResponse {
  list: GiftItem[]
  current_page: number
  end_page: number
  // 分页大小
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

const FETCH_GIFTS_PAGE_CONCURRENCY = 3

/**
 * 获取所有分页数据（第 2 页起并发至多 3 路；任一失败则置位 aborted，其余 worker 不再领取新任务）
 */
export async function fetchAllGifts(token: string): Promise<GiftItem[]> {
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

/**
 * 数据处理：分组与汇总
 */
function processGiftData(items: GiftItem[]): GroupedData[] {
  const groups: Record<string, GroupedData> = {}

  items.forEach((item) => {
    const code = item.item_code
    // 正则匹配：提取名称、数字、单位
    const match = item.item_name.match(/^(.+?)[（(](\d+)(.+?)[）)]$/)

    const currentCount = match ? parseInt(match[2], 10) : 1
    const currentUnit = match ? match[3] : '个'
    const baseName = match ? match[1] : item.item_name

    if (!groups[code]) {
      groups[code] = {
        name: baseName,
        _countValue: 0,
        _unit: currentUnit,
        list: [],
        total: '',
        code,
      }
    }

    groups[code]._countValue += currentCount
    groups[code].list.push(item)
  })

  return Object.values(groups).map((g) => ({
    ...g,
    total: `${g._countValue}${g._unit}`,
  }))
}

/**
 * 导出对齐后的 TXT 文件 (增加二次规格统计)
 * @param groupedData 分组后的源数据
 * @returns Promise<void> 异步导出操作
 */
async function exportToTxtLegacy(groupedData: GroupedData[]): Promise<void> {
  try {
    // 1. 排序：大类按中文排序
    const sortedData = [...groupedData].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'zh-CN'),
    )

    // 2. 构造文本内容
    const content = sortedData
      .map((group) => {
        // --- 第一层：大类汇总信息 ---
        const mainHeader = `【${group.name}】 总计：${group.total}`

        // --- 第二层：内部规格明细统计 ---
        const detailMap: Record<string, DetailInfo> = {}
        group.list.forEach((item) => {
          const fullName = item.item_name // 完整名，如：火热爱恋（女）（30天）
          if (!detailMap[fullName]) {
            detailMap[fullName] = { count: 0, subTotal: 0, unit: '' }
          }
          detailMap[fullName].count += 1 // 件数+1

          // 提取该项数值（兼容中英文括号）
          const match = fullName.match(/[（(](\d+)(.+?)[）)]$/)
          if (match) {
            detailMap[fullName].subTotal += parseInt(match[1], 10)
            detailMap[fullName].unit = match[2]
          }
        })

        // 将明细转为文字行
        const details = Object.keys(detailMap)
          .map((fullName) => {
            const info = detailMap[fullName]
            const namePart = `${fullName}`
            const countPart = `${info.count}件`
            const totalPart = `${info.subTotal}${info.unit}`
            return `${namePart}----${countPart}----共${totalPart}`
          })
          .join('\n')

        return `${mainHeader}\n${details}\n` // 每个大类换行隔开
      })
      .join('\n\n')

    // 3. 构造默认文件名
    const now = new Date()
    const YYYY = now.getFullYear()
    const MM = String(now.getMonth() + 1).padStart(2, '0')
    const DD = String(now.getDate()).padStart(2, '0')
    const HH = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const ss = String(now.getSeconds()).padStart(2, '0')
    const timeStr = `${YYYY}${MM}${DD}_${HH}${mm}${ss}`
    const defaultFileName = `${timeStr}_详细统计记录.txt`

    // 4. Electron文件保存对话框（让用户选择保存路径）
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: '导出统计记录',
      defaultPath: defaultFileName, // 默认文件名
      filters: [
        { name: '文本文档', extensions: ['txt'] }, // 仅显示txt文件
        { name: '所有文件', extensions: ['*'] },
      ],
    })

    // 如果用户取消保存，直接返回
    if (canceled || !filePath) {
      console.log('用户取消了文件导出')
      return
    }

    // 5. 写入文件（Node.js fs模块，确保utf-8编码支持中文）
    await writeFile(filePath, content, { encoding: 'utf-8' })
    console.log(`文件已成功导出至：${filePath}`)
  } catch (error) {
    // 错误捕获，避免程序崩溃
    console.error('导出TXT文件失败:', error)
    throw new Error(`导出失败：${(error as Error).message}`)
  }
}

/**
 * 导出数据为txt
 */
export const exportLotteryItemsTxt = async (token: string) => {
  const list = await fetchAllGifts(token)
  const processData = processGiftData(list)
  await exportToTxtLegacy(processData)
}
