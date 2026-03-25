<template>
  <el-splitter>
    <el-splitter-panel size="65%">
      <div class="item-table-wrap">
        <div class="item-table-toolbar">
          <div class="item-table-toolbar-sync">
            <el-button type="primary" :disabled="!canFetch" @click="syncData"> 数据同步 </el-button>
            <span class="item-table-last-sync">
              {{ lastSyncDisplay }}
              <span v-if="shouldSuggestSync" class="item-table-sync-suggest-text"
                >，建议同步（启用账号有变更）</span
              >
            </span>

            <el-button :disabled="displayData.length === 0" @click="exportGroupedSummaryTxt">
              导出
            </el-button>
          </div>
          <div class="item-table-filters">
            <el-autocomplete
              v-model="keyword"
              class="item-table-filter"
              clearable
              :trigger-on-focus="true"
              :fetch-suggestions="querySearchItemName"
              placeholder="按道具名称筛选（支持拼音）"
              autocorrect="off"
              :debounce="510"
              @select="onKeywordSelect"
            />
            <el-select
              v-model="selectedKeywordGroups"
              class="item-table-filter-select"
              multiple
              collapse-tags
              collapse-tags-tooltip
              clearable
              placeholder="按分类筛选"
            >
              <el-option
                v-for="group in keywordGroupOptions"
                :key="group.value"
                :label="group.label"
                :value="group.value"
              />
            </el-select>
          </div>
        </div>
        <el-table
          ref="tableRef"
          v-loading="loading"
          :data="displayData"
          stripe
          border
          class="item-table"
          empty-text="暂无数据"
          row-key="code"
          :default-sort="defaultSort"
          @sort-change="onSortChange"
          @selection-change="selectedRows = $event"
        >
          <el-table-column type="selection" align="center" width="50" :reserve-selection="false" />
          <el-table-column type="expand">
            <template #default="{ row }">
              <ExpandedGiftTable :items="row.list" :accounts="props.accounts" />
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isCompact"
            align="center"
            width="100"
            :label="`总类(${displayData.length})`"
          >
            <template #default="{ row }">
              <el-image
                :src="Utils.createItemImgUrl(row)"
                fit="contain"
                lazy
                class="gift-item-thumb"
              >
              </el-image>
            </template>
          </el-table-column>
          <el-table-column
            prop="name"
            :label="`道具名称${!isCompact ? '' : `(${displayData.length})`}`"
            align="center"
            show-overflow-tooltip
            sortable="custom"
          />
          <el-table-column
            prop="latestCreatedAt"
            label="获得时间"
            align="center"
            header-align="center"
            width="170"
            sortable="custom"
          />
          <el-table-column prop="total" align="center" width="100" label="总计" sortable="custom" />
          <el-table-column
            prop="itemCount"
            align="center"
            width="130"
            :label="`总数`"
            sortable="custom"
          >
            <template #default="{ row }">{{ row.list.length }}</template>
          </el-table-column>
        </el-table>
      </div>
    </el-splitter-panel>
    <el-splitter-panel size="35%" :resizable="false">
      <div class="log-wrap">
        <el-splitter layout="vertical">
          <el-splitter-panel>
            <el-switch
              v-model="switchModel"
              size="large"
              inline-prompt
              active-text="紧凑"
              inactive-text="普通"
            />
          </el-splitter-panel>
          <el-splitter-panel :resizable="false">
            <MainLogPanel />
          </el-splitter-panel>
        </el-splitter>
      </div>
    </el-splitter-panel>
  </el-splitter>
</template>

<script lang="ts" setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import type { GiftGroupedData, GiftItem, WebUserInfo } from '@types'
import { processGiftData } from '../gift-process'
import { ipcEmitter, ipcArg } from '@renderer/ipc'
import { useToast } from '@renderer/composables/useToast'
import { useInterval, useLocalStorageState } from 'vue-hooks-plus'
import type { ElTable } from 'element-plus'
import { Utils } from '../utils'
import { pinyin } from 'pinyin-pro'
import MainLogPanel from './MainLogPanel.vue'
import ExpandedGiftTable from './ExpandedGiftTable.vue'
import { keywordGroupOptions } from '../config'
type GroupedRow = GiftGroupedData & {
  latestCreatedAt: string
  latestCreatedAtTs: number
}

type SortOrder = 'ascending' | 'descending' | null
type SortProp = 'latestCreatedAt' | 'itemCount' | 'total' | 'name' | null

const props = defineProps<{
  accounts: WebUserInfo[]
  verifyLoginBeforeSync: () => Promise<boolean>
}>()

const { error: toastError, success: toastSuccess } = useToast()

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

/**
 * 上次同步时参与同步的账号列表（username）
 */
const [lastSyncedAccountUsernames, setLastSyncedAccountUsernames] = useLocalStorageState<string[]>(
  'r2beat_shipping_last_synced_account_usernames_v1',
  { defaultValue: [] },
)

/**
 * 预览模式(是否紧凑)
 */
const [isCompact, setIsCompact] = useLocalStorageState<boolean>('is-compact', {
  defaultValue: false,
})
const switchModel = computed({
  get() {
    return isCompact.value
  },
  set(newVal) {
    setIsCompact(newVal)
  },
})

const loading = ref(false)
const keyword = ref('')
const debouncedKeyword = ref('')
// 当前选中的道具分类组
const selectedKeywordGroups = ref<string[]>([])
// 当前选中道具
const selectedRows = ref<GroupedRow[]>([])
const tableRef = ref<InstanceType<typeof ElTable>>()
const canFetch = computed(() => props.accounts.length > 0)
const defaultSort = {
  prop: 'latestCreatedAt',
  order: 'descending',
} as const
const sortState = ref<{ prop: SortProp; order: SortOrder }>(defaultSort)

/**
 * 动态计算上次数据同步时间
 */
const lastSyncDisplay = ref(`上次同步：${Utils.formatRelativePastZh(lastSyncAt.value)}`)
useInterval(() => {
  lastSyncDisplay.value = `上次同步：${Utils.formatRelativePastZh(lastSyncAt.value)}`
}, 60_000)

/**
 *  对所有道具进行一次同类型合并
 */
const groupedRows = computed<GroupedRow[]>(() => {
  const items = storedGiftItems.value ?? []
  if (!items.length) return []

  // 需要检查当前账户是否已启用
  const enabledIds = new Set(props.accounts.map((a) => a.username))
  const filtered = items.filter((item) => enabledIds.has(item.user_id))

  if (!filtered.length) return []

  // 额外添加最新一次道具的获取时间，方便排序
  const grouped = processGiftData(filtered).map((g) => {
    let latestText = ''
    let latestTs = 0
    for (const item of g.list) {
      const ts = Utils.parseCreatedAtToTs(item.created_at)
      if (ts >= latestTs) {
        latestTs = ts
        latestText = item.created_at
      }
    }

    return {
      ...g,
      latestCreatedAt: latestText,
      latestCreatedAtTs: latestTs,
    }
  })

  return grouped
})

/**
 * 根据道具名称码点排序
 */
function sortByFirstCodePoint(rows: GroupedRow[], order: SortOrder): GroupedRow[] {
  const sorted = [...rows]
  sorted.sort((a, b) =>
    order === 'ascending'
      ? Utils.compareByFirstCodePointAsc(a.name, b.name)
      : Utils.compareByFirstCodePointAsc(b.name, a.name),
  )
  return sorted
}

// 缓存拼音组合
const pinyinSearchCache = new Map<string, { full: string; first: string }>()

/**
 * 辅助函数: 获取拼音组合
 */
function getPinyinSearchKeys(text: string): { full: string; first: string } {
  const raw = String(text ?? '')
  const hit = pinyinSearchCache.get(raw)
  if (hit) return hit
  let full = ''
  let first = ''
  try {
    full = pinyin(raw, {
      toneType: 'none',
      type: 'string',
      separator: '',
    })
      .replace(/\s+/g, '')
      .toLowerCase()
    first = pinyin(raw, {
      pattern: 'first',
      toneType: 'none',
      type: 'string',
      separator: '',
    })
      .replace(/\s+/g, '')
      .toLowerCase()
  } catch {
    /* ignore */
  }
  const v = { full, first }
  if (pinyinSearchCache.size > 2000) {
    pinyinSearchCache.clear()
  }
  pinyinSearchCache.set(raw, v)
  return v
}

/**
 * 辅助函数:
 * 文本是否匹配关键字：原文包含，或（拉丁关键字时）全拼 / 首字母包含
 */
function textMatchesKeyword(text: string, kwLower: string): boolean {
  const t = text.toLowerCase()
  // 1. 文本如果直接符合则直接返回
  if (t.includes(kwLower)) return true
  // 2. 检查是否是英文数字输入，其他乱七八糟的直接过滤
  if (!Utils.looksLikeLatinPinyinQuery(kwLower)) return false
  const q = kwLower.replace(/\s+/g, '')
  const { full, first } = getPinyinSearchKeys(text)

  if (full.includes(q) || first.includes(q)) return true

  return false
}

/**
 * 表格数据
 */
const displayData = computed(() => {
  const kw = debouncedKeyword.value.trim().toLowerCase()
  let rows = groupedRows.value
  const picked = new Set(selectedKeywordGroups.value)

  // 获取当前选择的所有分类内容
  const selectedGroupKeywords = (() => {
    return keywordGroupOptions
      .filter((group) => picked.has(group.value))
      .flatMap((group) => group.keywords)
  })()

  // 获取当前选择的所有分类内容(特例名单)
  const selectedGroupBlackListKeywords = (() => {
    return keywordGroupOptions
      .filter((group) => picked.has(group.value))
      .flatMap((group) => group.blacklist)
  })()

  /**
   * 1. 先根据主分类筛选一次道具
   */
  if (selectedGroupKeywords.length > 0) {
    const lowers = selectedGroupKeywords.map((k) => k.trim().toLowerCase())
    const blackListLowers = selectedGroupBlackListKeywords.map((k) => k.trim().toLowerCase())

    rows = rows.filter((row) => {
      const itemName = row.name.toLowerCase()

      return (
        lowers.some((kw) => itemName.includes(kw)) &&
        (blackListLowers.length ? blackListLowers.some((kw) => !itemName.includes(kw)) : true)
      )
    })
  }

  /**
   * 2. 再根据输入内容过滤一次
   */
  const filtered = !kw ? rows : rows.filter((row) => textMatchesKeyword(row.name, kw))

  /**
   * 最终根据自定义排序返回结果
   */
  const ss = sortState.value
  if (ss.prop === 'name') {
    if (ss.order) return sortByFirstCodePoint(filtered, ss.order)
  }
  if (!ss.order || !ss.prop) return filtered

  // 除了名称复杂，其他的都是简单的根据值排序
  const sorted = [...filtered]
  if (sortState.value.prop === 'latestCreatedAt') {
    sorted.sort((a, b) =>
      sortState.value.order === 'ascending'
        ? a.latestCreatedAtTs - b.latestCreatedAtTs
        : b.latestCreatedAtTs - a.latestCreatedAtTs,
    )
  } else if (sortState.value.prop === 'itemCount') {
    sorted.sort((a, b) =>
      sortState.value.order === 'ascending'
        ? a.list.length - b.list.length
        : b.list.length - a.list.length,
    )
  } else if (sortState.value.prop === 'total') {
    sorted.sort((a, b) =>
      sortState.value.order === 'ascending'
        ? a._countValue - b._countValue
        : b._countValue - a._countValue,
    )
  }

  return sorted
})

type NameOption = { value: string }

/**
 * 判断是否有新添加的账户未参与数据同步
 */
const shouldSuggestSync = computed(() => {
  const enabled = props.accounts.map((account) => account.username).filter(Boolean)
  if (enabled.length === 0) return false
  const lastSynced = new Set((lastSyncedAccountUsernames.value ?? []).filter(Boolean))
  if (lastSynced.size === 0) return false
  return enabled.some((username) => !lastSynced.has(username))
})

/**
 * 生成当前table数据列表对应的名称keys便于下拉框使用
 */
function querySearchItemName(queryString: string, cb: (results: NameOption[]) => void) {
  const q = queryString.trim().toLowerCase()

  /**
   * 根据当前表单数据得出所有道具名称
   */
  const source = (() => {
    let rows = displayData.value
    const set = new Set<string>()
    for (const row of rows) {
      // 下拉框中永久的和天数的算同一类，避免内容过多
      const name = row.name.trim().replaceAll('（永久）', '')
      set.add(name)
    }
    return Array.from(set).map((name) => ({ value: name }))
  })()

  cb(q ? source.filter((item) => textMatchesKeyword(item.value, q)) : source)
}

/**
 * 点击下拉框时补全搜索文本
 */
function onKeywordSelect(item: Record<string, string>) {
  keyword.value = item.value
}

/**
 * 导出道具种类汇总：
 * 【道具名称】  总数+单位
 */
function exportGroupedSummaryTxt() {
  const rows = displayData.value
  if (!rows.length) {
    toastError('暂无可导出的道具种类')
    return
  }

  const content = '\uFEFF' + rows.map((row) => `【${row.name}】  ${row.total}\r\n\r\n`).join('')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = Utils.formatExportFileName('道具列表')
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * 自定义排序功能(无具体排序逻辑)
 */
function onSortChange(payload: { prop: SortProp; order: SortOrder }) {
  /**
   * 每一个筛选都有3个参数
   * 当取消某一个排序时会保留最后一次筛选的类型值为null
   */
  const { prop, order } = payload

  // 强制回退按照最新获得时间排序
  if (!order || !prop) {
    sortState.value = defaultSort
    return
  }

  sortState.value = payload
}

/**
 * 获取已启用账户道具
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

/**
 * 获取数据
 */
async function syncData() {
  if (!canFetch.value || loading.value) return

  loading.value = true
  try {
    const ready = await props.verifyLoginBeforeSync()
    if (!ready) return

    const ok = await fetchAndStoreGifts()
    if (ok) {
      setLastSyncAt(Date.now())
      setLastSyncedAccountUsernames(
        props.accounts.map((account) => account.username).filter(Boolean),
      )
      toastSuccess('数据同步完成')
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    toastError(msg)
  } finally {
    loading.value = false
  }
}

let keywordDebounceTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 给输入框做个简易防抖
 */
watch(keyword, () => {
  if (keywordDebounceTimer) clearTimeout(keywordDebounceTimer)
  keywordDebounceTimer = setTimeout(() => {
    debouncedKeyword.value = keyword.value
    keywordDebounceTimer = null
  }, 500)
  tableRef.value?.clearSelection()
})
onUnmounted(() => {
  if (keywordDebounceTimer) {
    clearTimeout(keywordDebounceTimer)
    keywordDebounceTimer = null
  }
})

watch(selectedKeywordGroups, () => {
  tableRef.value?.clearSelection()
})
</script>

<style scoped>
.el-splitter {
  gap: 10px;
  height: 100%;
  min-height: 0;
}
.item-table-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;

  .item-table-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
}

.item-table-toolbar-sync {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
}

.item-table-last-sync {
  margin-right: auto;
  font-size: 12px;
  line-height: 1.3;
  color: var(--color-text-tertiary, #909399);
  white-space: nowrap;
}

.item-table-sync-suggest-text {
  color: var(--el-color-warning, #e6a23c);
}

.item-table-filters {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: nowrap;

  .item-table-filter {
    flex: 1 1 0;
    min-width: 160px;
  }

  .item-table-filter-select {
    flex: 1 1 0;
    min-width: 160px;
  }
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

.gift-item-thumb {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  background: var(--color-bg-card, var(--el-fill-color));
}

.log-wrap {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 6px;
  overflow: hidden;
}
</style>
