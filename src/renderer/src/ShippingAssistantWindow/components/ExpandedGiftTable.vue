<template>
  <div class="expanded-gift-table">
    <div class="expanded-gift-table__inner">
      <div class="expanded-gift-table__v2">
        <el-auto-resizer>
          <template #default="{ width }">
            <el-table-v2
              v-if="width > 0 && tableHeight > 0"
              class="expanded-gift-table__grid"
              :columns="columnsFor(width)"
              :data="sortItems"
              :width="width"
              :height="tableHeight"
              :row-height="ROW_HEIGHT"
              row-key="idx"
              :h-scrollbar-size="0"
              :header-height="HEADER_HEIGHT"
              :row-class-name="rowClassName"
              fixed
            />
          </template>
        </el-auto-resizer>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, h } from 'vue'
import type { GiftItem, WebUserInfo } from '@types'
import { Utils } from '../utils'

const props = defineProps<{
  items: GiftItem[]
  accounts: WebUserInfo[]
}>()

const sortItems = computed(() => {
  return [...props.items].sort((a, b) => {
    return Utils.compareByFirstCodePointAsc(a.item_name, b.item_name)
  })
})

const HEADER_HEIGHT = 32
const MAX_HEIGHT = 315
const ROW_HEIGHT = 20

const accountRemarkMap = computed(() => {
  const m = new Map<string, string>()
  for (const acc of props.accounts) {
    const key = (acc.username ?? '').trim()
    const remark = (acc.remark ?? '').trim()
    if (key && remark) m.set(key, remark)
  }
  return m
})

const tableHeight = computed(() => {
  const itemCount = props.items.length
  if (!itemCount) return 0
  return Math.min(MAX_HEIGHT, itemCount * ROW_HEIGHT + HEADER_HEIGHT)
})

const rowClassName = ({ rowIndex }: { rowIndex: number }) =>
  rowIndex % 2 === 1 ? 'expand-row--striped' : ''

function columnsFor(w: number) {
  const baseCellStyle = {
    fontSize: '13px',
  } as const

  return [
    {
      key: 'item_name',
      dataKey: 'item_name',
      title: '名称',
      align: 'center' as const,
      width: w / 3,
      cellRenderer: ({ rowData }: { rowData: GiftItem }) =>
        h(
          'span',
          {
            title: rowData.item_name,
            style: baseCellStyle,
          },
          rowData.item_name,
        ),
    },
    {
      key: 'user_id',
      dataKey: 'user_id',
      title: '所属账号',
      align: 'center' as const,
      width: w / 3,
      cellRenderer: ({ rowData }: { rowData: GiftItem }) => {
        const label = accountRemarkMap.value.get(rowData.user_id) || rowData.user_id
        return h(
          'span',
          {
            title: label,
            style: baseCellStyle,
          },
          label,
        )
      },
    },
    {
      key: 'created_at',
      dataKey: 'created_at',
      title: '获得时间',
      align: 'center' as const,
      width: w / 3,
      cellRenderer: ({ rowData }: { rowData: GiftItem }) =>
        h(
          'span',
          {
            title: rowData.created_at,
            style: baseCellStyle,
          },
          rowData.created_at,
        ),
    },
  ]
}
</script>

<style scoped>
.expanded-gift-table {
  padding: 10px 40px;
  padding-left: 100px;
  background: var(--el-fill-color-lighter);
}

.expanded-gift-table__inner {
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  overflow: hidden;
  background: var(--el-bg-color);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.expanded-gift-table__v2 {
  max-height: 320px;
}
</style>
