import type { GiftGroupedData, GiftItem } from '../../../types'

/**
 * 抽奖物品归并处理
 */
export function processGiftData(items: GiftItem[]): GiftGroupedData[] {
  const groups: Record<string, GiftGroupedData> = {}

  items.forEach((item) => {
    // FIX: 对于永久性物品单独使用item_id，不和天数类型统一计数
    const code = item.item_name.includes('（永久）') ? item.item_id : item.item_code
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
        imgCode: item.item_code,
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
