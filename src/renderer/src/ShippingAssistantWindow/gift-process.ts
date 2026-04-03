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

  const dp: boolean[][] = Array.from({ length: n + 1 }, () =>
    Array<boolean>(target + 1).fill(false),
  )
  dp[0][0] = true
  for (let i = 0; i < n; i++) {
    const c = counts[i]
    for (let s = 0; s <= target; s++) {
      if (!dp[i][s]) continue
      dp[i + 1][s] = true
      const ns = s + c
      if (ns <= target) dp[i + 1][ns] = true
    }
  }

  if (!dp[n][target]) return new Set()

  const picked = new Set<number>()
  let s = target
  for (let i = n; i >= 1; i--) {
    const c = counts[i - 1]
    const canSkip = dp[i - 1][s]
    const canTake = s >= c && dp[i - 1][s - c]
    if (canSkip && canTake) {
      continue
    }
    if (canTake) {
      picked.add(i - 1)
      s -= c
    }
  }
  return picked
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
