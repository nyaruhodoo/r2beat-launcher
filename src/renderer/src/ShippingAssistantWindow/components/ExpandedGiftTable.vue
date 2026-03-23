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
              :data="items"
              :width="width"
              :height="tableHeight"
              row-key="idx"
              :estimated-row-height="34"
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

const props = defineProps<{
  items: GiftItem[]
  accounts: WebUserInfo[]
}>()

const HEADER_HEIGHT = 32
const MAX_HEIGHT = 320
const ROW_HEIGHT = 34
const MIN_HEIGHT = HEADER_HEIGHT + ROW_HEIGHT

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
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, HEADER_HEIGHT + itemCount * ROW_HEIGHT))
})

const rowClassName = ({ rowIndex }: { rowIndex: number }) =>
  rowIndex % 2 === 1 ? 'expand-row--striped' : ''

function columnsFor(w: number) {
  const userW = 108
  const createdW = 172
  const nameW = Math.max(160, w - userW - createdW)

  const baseCellStyle = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    lineHeight: '1.4',
    boxSizing: 'border-box',
    padding: '0 12px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as const

  return [
    {
      key: 'item_name',
      dataKey: 'item_name',
      title: '物品全名',
      align: 'center' as const,
      width: nameW,
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
      width: userW,
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
      width: createdW,
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

<style>
.expanded-gift-table .expanded-gift-table__grid {
  --el-table-border-color: var(--el-border-color-extra-light);
}

.expanded-gift-table .expanded-gift-table__grid .el-table__inner-wrapper::before {
  display: none;
}

.expanded-gift-table .expanded-gift-table__grid .el-table__header-wrapper th.el-table__cell {
  background: var(--el-fill-color-light) !important;
  color: var(--el-text-color-secondary);
  font-weight: 600;
  font-size: 12px;
}

.expanded-gift-table .expanded-gift-table__grid .el-table__body .el-table__cell {
  padding: 8px 12px;
  font-size: 13px;
}

.expanded-gift-table .expanded-gift-table__grid .el-table__cell .cell {
  text-align: center;
}

.expanded-gift-table .expand-row--striped {
  background: var(--el-fill-color-lighter) !important;
}

.expanded-gift-table .expanded-gift-table__grid .el-table__row {
  background: var(--el-bg-color);
}
</style>
