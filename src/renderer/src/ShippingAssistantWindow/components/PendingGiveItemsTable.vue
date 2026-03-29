<template>
  <div class="pending-give-table">
    <div class="pending-give-table__toolbar">
      <div class="pending-give-table__toolbar-left">
        <el-button
          v-if="items.length > 0 && !isExecuting"
          size="small"
          type="primary"
          link
          @click="emit('retry')"
        >
          重试
        </el-button>
      </div>
      <div class="pending-give-table__toolbar-right">
        <span
          class="pending-give-table__status-dot"
          :class="
            isExecuting
              ? 'pending-give-table__status-dot--busy'
              : 'pending-give-table__status-dot--idle'
          "
          aria-hidden="true"
        />
        <span class="pending-give-table__status-text"
          >{{ isExecuting ? '执行中' : '空闲'
          }}{{ items.length > 0 ? `(${items.length})` : '' }}</span
        >
      </div>
    </div>
    <div class="pending-give-table__inner">
      <div class="pending-give-table__v2">
        <el-auto-resizer>
          <template #default="{ width, height }">
            <el-table-v2
              v-if="width > 0 && height > 0 && items.length > 0"
              class="pending-give-table__grid"
              :columns="columnsFor(width)"
              :data="items"
              :width="width"
              :height="height"
              :row-height="ROW_HEIGHT"
              row-key="idx"
              :h-scrollbar-size="0"
              :header-height="HEADER_HEIGHT"
              :row-class-name="rowClassName"
              fixed
            />
            <div
              v-else-if="width > 0 && height > 0 && items.length === 0"
              class="pending-give-table__empty"
              :style="{ width: `${width}px`, height: `${height}px` }"
            >
              暂无待执行的任务
            </div>
          </template>
        </el-auto-resizer>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, h } from 'vue'
import type { GiftItemWithGiver, WebUserInfo } from '@src/types'

const props = defineProps<{
  items: GiftItemWithGiver[]
  accounts: WebUserInfo[]
  /** 是否正在执行赠送任务 */
  isExecuting: boolean
}>()

const emit = defineEmits<{
  retry: []
}>()

const HEADER_HEIGHT = 32
const ROW_HEIGHT = 28

const accountRemarkMap = computed(() => {
  const m = new Map<string, string>()
  for (const acc of props.accounts) {
    const key = (acc.username ?? '').trim()
    const remark = (acc.remark ?? '').trim()
    if (key && remark) m.set(key, remark)
  }
  return m
})

const rowClassName = ({ rowIndex }: { rowIndex: number }) =>
  rowIndex % 2 === 1 ? 'pending-give-row--striped' : ''

const baseCellStyle = {
  fontSize: '13px',
} as const

/** 单行省略：禁止换行，过长用省略号（table-v2 单元格内需 block + 100% 宽度） */
const cellEllipsisStyle = {
  ...baseCellStyle,
  display: 'block' as const,
  width: '100%',
  boxSizing: 'border-box' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

function columnsFor(w: number) {
  /** 所属账号 / 赠送人各占约 18%，其余给道具名称（更宽、单行省略） */
  const wAcc = Math.floor(w * 0.23)
  const wGiver = Math.floor(w * 0.25)
  // FIX: 简单修正一下出现的水平滚动条
  const wName = w - wAcc - wGiver - 10

  return [
    {
      key: 'item_name',
      dataKey: 'item_name',
      title: '道具名称',
      align: 'center' as const,
      width: wName,
      cellRenderer: ({ rowData }: { rowData: GiftItemWithGiver }) =>
        h(
          'span',
          {
            title: rowData.item_name,
            class: 'pending-give-table__cell-text',
            style: cellEllipsisStyle,
          },
          rowData.item_name,
        ),
    },
    {
      key: 'account',
      dataKey: 'user_id',
      title: '所属账号',
      align: 'center' as const,
      width: wAcc,
      cellRenderer: ({ rowData }: { rowData: GiftItemWithGiver }) => {
        const label = accountRemarkMap.value.get(rowData.user_id) || rowData.user_id
        return h(
          'span',
          {
            title: label,
            class: 'pending-give-table__cell-text',
            style: cellEllipsisStyle,
          },
          label,
        )
      },
    },
    {
      key: 'giverName',
      dataKey: 'giverName',
      title: '赠送人',
      align: 'center' as const,
      width: wGiver,
      cellRenderer: ({ rowData }: { rowData: GiftItemWithGiver }) =>
        h(
          'span',
          {
            title: rowData.giverName,
            class: 'pending-give-table__cell-text',
            style: cellEllipsisStyle,
          },
          rowData.giverName,
        ),
    },
  ]
}
</script>

<style scoped>
.pending-give-table {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 8px;
  box-sizing: border-box;
}

.pending-give-table__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 8px;
  padding-bottom: 8px;
}

.pending-give-table__toolbar-left {
  min-height: 24px;
  display: flex;
  align-items: center;
}

.pending-give-table__toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.pending-give-table__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.pending-give-table__status-dot--busy {
  background: var(--el-color-success);
}

.pending-give-table__status-dot--idle {
  background: var(--el-color-danger);
}

.pending-give-table__status-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.pending-give-table__inner {
  flex: 1;
  min-height: 0;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  overflow: hidden;
  background: var(--el-bg-color);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

/* 占满 inner，el-auto-resizer 才能量到高度 */
.pending-give-table__v2 {
  height: 100%;
  min-height: 0;
}

.pending-give-table__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>

<style>
.pending-give-table__grid .pending-give-row--striped > div {
  background: var(--el-fill-color-lighter);
}

/* 虚拟表格单元格多为 flex，min-width:0 才能让子元素单行省略生效 */
.pending-give-table__grid .pending-give-table__cell-text {
  min-width: 0;
}
</style>
