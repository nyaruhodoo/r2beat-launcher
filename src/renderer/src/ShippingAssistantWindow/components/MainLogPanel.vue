<template>
  <div class="main-log-panel">
    <div class="main-log-toolbar">
      <div class="main-log-toolbar-actions">
        <el-button size="small" :disabled="logsList.length === 0" @click="clearLogs"
          >清空</el-button
        >
        <el-button size="small" :disabled="logsList.length === 0" @click="exportLogsTxt"
          >导出</el-button
        >
      </div>
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
            :data="logsList"
            :width="width"
            :height="height"
            :header-height="0"
            row-key="id"
            :estimated-row-height="22"
            :h-scrollbar-size="0"
            fixed
          >
            <template #empty>
              <div class="main-log-empty" aria-hidden="true">暂无日志</div>
            </template>
          </el-table-v2>
        </template>
      </el-auto-resizer>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { TableV2Instance } from 'element-plus'
import { computed, h, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ipcListener } from '@renderer/ipc'
import type { MainLogKind, MainLogPayload } from '../../../../ipc/contracts'
import { confirm } from '@renderer/composables/useConfirm'
import { Utils } from '../utils'
import { useLocalStorageStateShallow } from '../composables/useLocalStorageStateShallow'

const MAX_LOGS = 500

const autoScroll = ref(true)

interface LogRow {
  id: string
  kind: MainLogKind
  time: string
  text: string
}

const [logs, setLogs] = useLocalStorageStateShallow<LogRow[]>('r2beat_shipping_main_log_v1', {
  defaultValue: [],
})

const logsList = computed(() => logs.value ?? [])

let seq = 0

function syncSeqFromStoredLogs() {
  let max = 0
  for (const r of logs.value ?? []) {
    const n = parseInt(r.id, 10)
    if (!Number.isNaN(n) && n > max) max = n
  }
  seq = max
}

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
  const list = logs.value ?? []
  const next = list.concat(row)
  setLogs(next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next)
}

async function clearLogs() {
  await confirm({
    message: '请确认是否需要清空日志',
  })

  setLogs([])
  seq = 0
}

function exportLogsTxt() {
  const rows = logsList.value
  if (!rows.length) return

  const lines = rows.map((r) => {
    const textOneLine = r.text.replace(/\r?\n/g, ' ')
    return `${r.time}\t${textOneLine}`
  })
  const content = `\uFEFF${lines.join('\r\n')}`
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = Utils.formatExportFileName('统计日志')
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
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
  syncSeqFromStoredLogs()
  offMainLog = ipcListener.on('main-log', (_e, payload: MainLogPayload) => {
    append(payload)
  })
})

onUnmounted(() => {
  offMainLog?.()
})

watch(
  () => logsList.value.length,
  () => {
    if (autoScroll.value && tableRef.value) {
      nextTick(() => {
        const lastIndex = logsList.value.length - 1
        if (lastIndex >= 0) {
          tableRef.value?.scrollToRow(lastIndex)
        }
      })
    }
  },
)

function scrollToLast() {
  const lastIndex = logsList.value.length - 1
  if (lastIndex >= 0) {
    tableRef.value?.scrollToRow(lastIndex)
  }
}

// 组件初次渲染时如果本地已存在日志，tableRef 往往在 v-if(height/width) 条件后才会就绪。
// 监听 tableRef 的变化，确保首次也能滚到底部。
watch(
  tableRef,
  () => {
    if (!autoScroll.value) return
    nextTick(() => {
      scrollToLast()
    })
  },
  { immediate: true },
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
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  padding: 0 2px;
}

.main-log-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
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
  font-size: 13px;
  color: var(--el-text-color-secondary);

  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  min-height: 0;
}
</style>
