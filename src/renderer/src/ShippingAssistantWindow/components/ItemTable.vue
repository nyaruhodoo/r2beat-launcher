<template>
  <el-splitter>
    <el-splitter-panel size="60%">
      <div class="item-table-wrap">
        <div class="item-table-toolbar">
          <div class="item-table-toolbar-sync">
            <el-button type="primary" :disabled="!canFetch" @click="syncData"> 数据同步 </el-button>
            <span class="item-table-last-sync">{{ lastSyncDisplay }}</span>
          </div>
          <el-input
            v-model="keyword"
            class="item-table-filter"
            clearable
            placeholder="按道具名称筛选"
          />
          <div>
            <span v-if="!canFetch" class="item-table-hint">暂无已启用且已登录的账号</span>
          </div>
        </div>
        <el-table
          ref="tableRef"
          v-loading="loading"
          :data="displayData"
          stripe
          border
          class="item-table"
          empty-text="暂无数据，请点击「数据同步」拉取"
          row-key="code"
          @selection-change="onSelectionChange"
        >
          <el-table-column type="selection" width="48" :reserve-selection="false" />
          <el-table-column type="expand">
            <template #default="{ row }">
              <div class="item-table-expand">
                <el-table :data="row.list" size="small" border>
                  <el-table-column
                    prop="item_name"
                    label="物品全名"
                    min-width="200"
                    show-overflow-tooltip
                  />
                  <el-table-column
                    prop="character_name"
                    label="所属账号"
                    width="100"
                    show-overflow-tooltip
                  />
                  <el-table-column prop="created_at" label="获得时间" width="170" />
                </el-table>
              </div>
            </template>
          </el-table-column>
          <el-table-column align="center" :label="`道具种类(${groupCount})`">
            <template #default="{ row }">
              <el-image :src="giftItemImageUrl(row)" fit="contain" lazy class="gift-item-thumb">
              </el-image>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="道具名称" show-overflow-tooltip />
          <el-table-column prop="total" label="总计" />
          <el-table-column :label="`总物品数量(${totalItemCount})`">
            <template #default="{ row }">{{ row.list.length }}</template>
          </el-table-column>
        </el-table>
      </div>
    </el-splitter-panel>
    <el-splitter-panel size="40%" :resizable="false">
      <div class="logs">123</div>
    </el-splitter-panel>
  </el-splitter>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { GiftGroupedData, GiftItem, WebUserInfo } from '@types'
import { processGiftData } from '../gift-process'
import { ipcEmitter, ipcArg } from '@renderer/ipc'
import { useToast } from '@renderer/composables/useToast'
import { useLocalStorageState } from 'vue-hooks-plus'
import type { ElTable } from 'element-plus'
import { Utils } from '../utils'

const props = defineProps<{
  accounts: WebUserInfo[]
  verifyLoginBeforeSync: () => Promise<boolean>
}>()

const { error: toastError, success: toastSuccess } = useToast()

const GIFT_ITEM_IMAGE_BASE = 'https://r2beat-web-cdn.xiyouxi.com/images/sub/gift/item'

/**
 * 原始道具数据
 */
const [storedGiftItems, setStoredGiftItems] = useLocalStorageState<GiftItem[]>(
  'r2beat_shipping_gift_raw_items_v1',
  { defaultValue: [] },
)

/**
 * 上次同步数据时间
 */
const [lastSyncAt, setLastSyncAt] = useLocalStorageState<number | null>(
  'r2beat_shipping_last_sync_at',
  { defaultValue: null },
)

const loading = ref(false)
const keyword = ref('')
const selectedRows = ref<GiftGroupedData[]>([])
const tableRef = ref<InstanceType<typeof ElTable>>()

const canFetch = computed(() => props.accounts.length > 0)

/**
 * 道具分组
 */
const groupedRows = computed(() => {
  const items = storedGiftItems.value ?? []
  if (!items.length) return []
  const grouped = processGiftData(items)
  grouped.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-CN'))
  return grouped
})

/**
 * 表格数据，根据关键字做二次筛选
 */
const displayData = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const rows = groupedRows.value
  if (!kw) return rows
  return rows.filter((row) => rowMatches(row, kw))
})

const groupCount = computed(() => groupedRows.value.length)

const totalItemCount = computed(() => groupedRows.value.reduce((n, g) => n + g.list.length, 0))

/** 每分钟刷新相对时间文案 */
const relativeTimeTick = ref(0)
let relativeTimeTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  relativeTimeTimer = setInterval(() => {
    relativeTimeTick.value++
  }, 60_000)
})

onUnmounted(() => {
  if (relativeTimeTimer) {
    clearInterval(relativeTimeTimer)
    relativeTimeTimer = null
  }
})

const lastSyncDisplay = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  relativeTimeTick.value
  const t = lastSyncAt.value
  if (t == null || !Number.isFinite(t)) return '上次同步：—'
  return `上次同步：${Utils.formatRelativePastZh(t)}`
})

function rowMatches(row: GiftGroupedData, kw: string): boolean {
  if (
    row.name.toLowerCase().includes(kw) ||
    row.code.toLowerCase().includes(kw) ||
    row.total.toLowerCase().includes(kw)
  ) {
    return true
  }
  return row.list.some((item) => {
    const text = [
      item.item_name,
      item.item_code,
      item.character_name,
      item.created_at,
      item.server_name,
      (item as { accountUsername?: string }).accountUsername,
      (item as { accountRemark?: string }).accountRemark,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return text.includes(kw)
  })
}

function giftItemImageUrl(item: GiftGroupedData) {
  const code = String(item.code ?? '').trim()
  if (!code) return ''
  return `${GIFT_ITEM_IMAGE_BASE}/${encodeURIComponent(code)}.png`
}

function onSelectionChange(rows: GiftGroupedData[]) {
  selectedRows.value = rows
}

/**
 * 获取已启用账户道具（仅持久化原始 items；分组与筛选由计算属性完成）
 */
async function fetchAndStoreGifts() {
  const result = await ipcEmitter.invoke('get-gift-list', ipcArg(props.accounts))
  if (!result.success) {
    toastError(result.error ?? '获取道具数据失败')
    return false
  }
  const raw = result.items ?? []
  setStoredGiftItems(raw)
  return true
}

async function syncData() {
  if (!canFetch.value || loading.value) return

  loading.value = true
  try {
    const ready = await props.verifyLoginBeforeSync()
    if (!ready) return

    const ok = await fetchAndStoreGifts()
    if (ok) {
      setLastSyncAt(Date.now())
      toastSuccess('数据同步完成')
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    toastError(msg)
  } finally {
    loading.value = false
  }
}

watch(keyword, () => {
  tableRef.value?.clearSelection()
})
</script>

<style scoped>
.el-splitter {
  gap: 10px;
}
.item-table-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;

  .item-table-toolbar {
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
}

.item-table-toolbar-sync {
  display: flex;
  align-items: center;
  gap: 10px;
}

.item-table-last-sync {
  font-size: 12px;
  line-height: 1.3;
  color: var(--color-text-tertiary, #909399);
  white-space: nowrap;
}

.item-table-filter {
  width: min(360px, 100%);
  flex: 1;
  min-width: 200px;
}

.item-table-hint {
  font-size: 13px;
  color: var(--color-text-tertiary, #909399);
}

.item-table-error {
  font-size: 13px;
  color: var(--el-color-danger, #f56c6c);
}

.item-table-meta {
  font-size: 13px;
  color: var(--color-text-secondary, #606266);
}

.item-table {
  flex: 1;
  min-height: 0;
}

.item-table-expand {
  padding: 8px 12px 12px 48px;
  background: var(--color-bg-card, var(--el-fill-color-lighter));
}

.gift-item-thumb {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  background: var(--color-bg-card, var(--el-fill-color));
}

.gift-item-thumb--fail {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  font-size: 12px;
  color: var(--color-text-tertiary, var(--el-text-color-placeholder));
  background: var(--color-bg-card, var(--el-fill-color));
  border-radius: 6px;
}
</style>
