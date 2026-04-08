/**
 * 高性能持久化存储 GiftItems
 */

import { GiftItem } from '@src/types'
import { onMounted, shallowRef, triggerRef } from 'vue'
import { db } from '../db'

export const useStoredGiftItems = () => {
  const storedGiftItems = shallowRef<GiftItem[]>([])

  const initGiftItems = async () => {
    const data = await db.storedGiftItems.toArray()
    storedGiftItems.value = data
  }

  const saveGiftItems = async (items: GiftItem[]) => {
    await db.transaction('rw', db.storedGiftItems, async () => {
      await db.storedGiftItems.clear()
      await db.storedGiftItems.bulkAdd(items)
    })

    storedGiftItems.value = items
  }

  const delGiftItems = async (idxs: number[]) => {
    await db.storedGiftItems.bulkDelete(idxs)

    const idSet = new Set(idxs)

    // 找出所有需要删除的索引，从后往前删可以避免索引偏移问题
    for (let i = storedGiftItems.value.length - 1; i >= 0; i--) {
      if (idSet.has(storedGiftItems.value[i].idx)) {
        storedGiftItems.value.splice(i, 1)
      }
    }

    // 强制触发 shallowRef 的 UI 更新
    triggerRef(storedGiftItems)
  }

  onMounted(() => {
    initGiftItems()
  })

  return {
    storedGiftItems,
    initGiftItems,
    saveGiftItems,
    delGiftItems,
  }
}
