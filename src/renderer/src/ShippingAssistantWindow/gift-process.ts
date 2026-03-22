import type { GiftGroupedData, GiftItem } from '../../../types'

/**
 * 抽奖物品：按 item_code 分组并汇总数量（与导出 TXT 逻辑一致）
 */
export function processGiftData(items: GiftItem[]): GiftGroupedData[] {
  const groups: Record<string, GiftGroupedData> = {}

  items.forEach((item) => {
    const code = item.item_code
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
