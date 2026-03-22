<template>
  <div class="main-log-panel">
    <div class="main-log-toolbar">
      <el-button size="small" @click="autoScroll = !autoScroll">
        {{ autoScroll ? '自动滚动中' : '已暂停滚动' }}
      </el-button>
    </div>
    <div class="main-log-body">
      <el-auto-resizer>
        <template #default="{ height, width }">
          <el-table-v2
            v-if="height > 0 && width > 0"
            ref="tableRef"
            :columns="columnsFor(width)"
            :data="logs"
            :width="width"
            :height="height"
            row-key="id"
            :estimated-row-height="22"
            :h-scrollbar-size="0"
            fixed
          >
            <template #empty>
              <div class="main-log-empty" aria-hidden="true" />
            </template>
          </el-table-v2>
        </template>
      </el-auto-resizer>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { TableV2Instance } from 'element-plus'
import { h, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ipcListener } from '@renderer/ipc'
import type { MainLogKind, MainLogPayload } from '../../../../ipc/contracts'

const MAX_LOGS = 500

const autoScroll = ref(true)

interface LogRow {
  id: string
  kind: MainLogKind
  time: string
  text: string
}

const logs = ref<LogRow[]>([])
let seq = 0

const tableRef = ref<TableV2Instance>()

function kindColor(kind: MainLogKind): string {
  switch (kind) {
    case 'error':
      return 'var(--el-color-danger)'
    case 'success':
      return 'var(--el-color-success)'
    default:
      return 'var(--el-text-color-regular)'
  }
}

function append(payload: MainLogPayload) {
  const time = new Date(payload.at).toLocaleString()
  const row: LogRow = {
    id: `${++seq}`,
    kind: payload.kind,
    time,
    text: payload.text,
  }
  const next = logs.value.concat(row)
  logs.value = next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next
}

function columnsFor(w: number) {
  const timeW = Math.min(190, Math.max(140, Math.floor(w * 0.28)))
  const textW = Math.max(80, w - timeW)
  return [
    {
      key: 'time',
      dataKey: 'time',
      title: '',
      width: timeW,
      cellRenderer: ({ rowData }: { rowData: LogRow }) =>
        h(
          'span',
          {
            style: {
              fontSize: '12px',
              lineHeight: '1.4',
              color: 'var(--el-text-color-secondary)',
              whiteSpace: 'nowrap',
            },
          },
          rowData.time,
        ),
    },
    {
      key: 'text',
      dataKey: 'text',
      title: '',
      width: textW,
      cellRenderer: ({ rowData }: { rowData: LogRow }) =>
        h(
          'span',
          {
            style: {
              color: kindColor(rowData.kind),
              fontSize: '12px',
              lineHeight: '1.4',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            },
          },
          rowData.text,
        ),
    },
  ]
}

let offMainLog: (() => void) | undefined

onMounted(() => {
  offMainLog = ipcListener.on('main-log', (_e, payload: MainLogPayload) => {
    append(payload)
  })
})

onUnmounted(() => {
  offMainLog?.()
})

watch(
  () => logs.value.length,
  () => {
    if (autoScroll.value && tableRef.value) {
      nextTick(() => {
        const lastIndex = logs.value.length - 1
        if (lastIndex >= 0) {
          tableRef.value?.scrollToRow(lastIndex)
        }
      })
    }
  },
)
</script>

<style scoped>
.main-log-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.main-log-toolbar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 2px;
}

.main-log-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}
</style>

<style>
.main-log-panel .el-table-v2__row-depth-0 {
  align-items: flex-start;
}

/* 禁止水平滚动（兜底，与 h-scrollbar-size=0 配合） */
.main-log-panel .el-vl__horizontal {
  display: none;
}

/* 无数据时不展示默认 No Data，仅占位空白 */
.main-log-panel .main-log-empty {
  min-height: 0;
}
</style>
