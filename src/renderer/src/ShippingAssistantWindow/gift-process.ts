import type { GiftGroupedData, GiftItem } from '../../../types'

export function parseGiftItemName(item: GiftItem) {
  const match = item.item_name.match(/^(.+?)[（(](\d+)(.+?)[）)]$/)
  return {
    count: match ? parseInt(match[2], 10) : 1,
    unit: match ? match[3] : '个',
    baseName: match ? match[1] : item.item_name,
  }
}

/**
 * 与归并逻辑一致：单条 GiftItem 对应的数量（名称里括号天数/个数，否则为 1）
 */
export function giftItemNumericCount(item: GiftItem): number {
  return parseGiftItemName(item).count
}

/**
 * 与「数量」子集和一致：从 list 顺序上的 counts 凑 target；回溯时若可不选当前项则不选，和尽量落在更靠前的条目。
 */
export function pickGiftListSubsetIndices(counts: number[], target: number): Set<number> {
  const n = counts.length
  if (target === 0 || n === 0) return new Set()

  // 1. 统计频率并记录索引
  const valToIndices = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const c = counts[i]
    if (c > target) continue // 略过比目标还大的
    if (!valToIndices.has(c)) valToIndices.set(c, [])
    valToIndices.get(c)!.push(i)
  }

  const uniqueValues = Array.from(valToIndices.keys()).sort((a, b) => b - a)
  const resultIndices: number[] = []

  // 2. 使用回溯法寻找组合
  function findCombination(remaining: number, startIndex: number): boolean {
    if (remaining === 0) return true
    if (startIndex >= uniqueValues.length) return false

    const val = uniqueValues[startIndex]
    const availableIndices = valToIndices.get(val)!

    // 计算当前面值最多能用多少个
    const maxPossible = Math.min(Math.floor(remaining / val), availableIndices.length)

    // 尝试从多到少使用该面值 (优先尝试大的组合)
    for (let count = maxPossible; count >= 0; count--) {
      // 记录当前选中的索引
      for (let i = 0; i < count; i++) {
        resultIndices.push(availableIndices[i])
      }

      // 递归寻找剩余部分
      if (findCombination(remaining - val * count, startIndex + 1)) {
        return true
      }

      // 回溯：弹出刚才尝试的索引
      for (let i = 0; i < count; i++) {
        resultIndices.pop()
      }
    }

    return false
  }

  findCombination(target, 0)
  return new Set(resultIndices)
}

/**
 * 抽奖物品归并处理
 */
export function processGiftData(items: GiftItem[]): GiftGroupedData[] {
  const groups: Record<string, GiftGroupedData> = {}

  items.forEach((item) => {
    // FIX: 对于永久性物品单独使用item_id，不和天数类型统一计数
    const code = item.item_name.includes('（永久）') ? item.item_id : item.item_code
    const { count: currentCount, unit: currentUnit, baseName } = parseGiftItemName(item)

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
