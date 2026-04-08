<template>
  <el-splitter>
    <!-- Table -->
    <el-splitter-panel size="65%">
      <div class="item-table-wrap">
        <div class="item-table-toolbar">
          <div class="item-table-toolbar-sync">
            <el-button type="primary" :disabled="!canFetch" @click="syncData"> 数据同步 </el-button>
            <span class="item-table-last-sync">
              上次更新：{{ relativeTime }}
              <span v-if="shouldSuggestSync" class="item-table-sync-suggest-text"
                >，建议同步（启用账号有变更）</span
              >
            </span>

            <el-button :disabled="storedGiftItems.length === 0" @click="exportGroupedSummaryTxt">
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
          <div class="item-table-give">
            <el-button
              type="primary"
              :disabled="selectedRows.length === 0 || pendingGiveItemsList.length > 0"
              @click="giveModalVisible = true"
            >
              赠送
            </el-button>
            <el-button
              type="primary"
              :disabled="selectedRows.length === 0 || pendingGiveItemsList.length > 0"
              @click="energyConvertModalVisible = true"
            >
              转化能量
            </el-button>

            <el-switch
              v-model="switchModel"
              size="large"
              inline-prompt
              active-text="紧凑"
              inactive-text="普通"
            />
          </div>
        </div>
        <el-table
          ref="tableRef"
          v-loading="loading"
          :data="displayData"
          stripe
          :border="true"
          :resizable="false"
          class="item-table"
          empty-text="暂无数据"
          row-key="code"
          :default-sort="defaultSort"
          @sort-change="onSortChange"
          @selection-change="handleSelectionChange"
        >
          <el-table-column
            type="selection"
            align="center"
            width="50"
            :reserve-selection="false"
            :resizable="false"
          />
          <el-table-column type="expand" :resizable="false">
            <template #default="{ row }">
              <ExpandedGiftTable :items="row.list" :accounts="props.accounts" />
            </template>
          </el-table-column>
          <el-table-column align="center" width="100" :resizable="false">
            <template #default="{ row }">
              <el-image
                v-show="!isCompact"
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
            :label="`道具名称(${displayData.length})`"
            align="center"
            show-overflow-tooltip
            sortable="custom"
            :resizable="false"
          >
            <template #default="{ row }">
              <span
                class="item-table-name-copy"
                title="点击复制道具名称"
                @click.stop="RendererUtils.copy(row.name)"
              >
                {{ row.name }}
              </span>
            </template>
          </el-table-column>
          <el-table-column
            prop="latestCreatedAt"
            label="获得时间"
            align="center"
            header-align="center"
            width="170"
            sortable="custom"
            :resizable="false"
          />
          <el-table-column
            prop="total"
            align="center"
            width="100"
            label="总计"
            sortable="custom"
            :resizable="false"
          />
          <el-table-column
            prop="itemCount"
            align="center"
            width="130"
            :label="`总数(${displayDataAllCount})`"
            sortable="custom"
            :resizable="false"
          >
            <template #default="{ row }">{{ row.list.length }}</template>
          </el-table-column>
        </el-table>
      </div>
    </el-splitter-panel>

    <!-- 任务单/日志 -->
    <el-splitter-panel size="35%" :resizable="false">
      <div class="log-wrap">
        <el-splitter layout="vertical">
          <el-splitter-panel :min="120">
            <PendingGiveItemsTable
              :items="pendingGiveItemsList"
              :accounts="props.accounts"
              :is-executing="giveTaskRunning"
              @retry="processPendingGiveItems"
              @clear="clearPendingGiveItems"
            />
          </el-splitter-panel>
          <el-splitter-panel :resizable="false">
            <MainLogPanel />
          </el-splitter-panel>
        </el-splitter>
      </div>
    </el-splitter-panel>
  </el-splitter>

  <GiftGiveModal
    :visible="giveModalVisible"
    :rows="selectedRows"
    :is-compact="Boolean(isCompact)"
    :accounts="props.accounts"
    :on-give-confirm-submit="onGiveConfirmSubmitFromModal"
    @close="giveModalVisible = false"
  />

  <EnergyConvertModal
    :visible="energyConvertModalVisible"
    :rows="selectedRows"
    :is-compact="Boolean(isCompact)"
    :accounts="props.accounts"
    :on-energy-convert-confirm-submit="onGiveConfirmSubmitFromModal"
    @close="energyConvertModalVisible = false"
  />
</template>

<script lang="ts" setup>
import { computed, markRaw, ref, shallowRef, watch } from 'vue'
import type { GiftGroupedData, GiftItem, GiftItemWithGiver, WebUserInfo } from '@src/types'
import { parseGiftItemName, processGiftData } from '../gift-process'
import { ipcEmitter, ipcArg } from '@renderer/ipc'
import { useToast } from '@renderer/composables/useToast'
import { useDebounce, useLocalStorageState } from 'vue-hooks-plus'
import type { ElTable } from 'element-plus'
import { Utils } from '../utils'
import { RendererUtils } from '@renderer/renderer-utils'
import { pinyin } from 'pinyin-pro'
import MainLogPanel from './MainLogPanel.vue'
import ExpandedGiftTable from './ExpandedGiftTable.vue'
import EnergyConvertModal from './EnergyConvertModal.vue'
import GiftGiveModal from './GiftGiveModal.vue'
import PendingGiveItemsTable from './PendingGiveItemsTable.vue'
import { keywordGroupOptions } from '../config'
import { runConcurrent } from '../runConcurrent'
import { useRelativeTime } from '../composables/useRelativeTime'
import { useLocalStorageStateShallow } from '../composables/useLocalStorageStateShallow'

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
const [storedGiftItems, setStoredGiftItems] = useLocalStorageStateShallow<GiftItem[]>(
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
const { relativeTime } = useRelativeTime(lastSyncAt)

/**
 * 上次同步时参与同步的账号列表（username）
 */
const [lastSyncedAccountUsernames, setLastSyncedAccountUsernames] = useLocalStorageState<string[]>(
  'r2beat_shipping_last_synced_account_usernames_v1',
  { defaultValue: [] },
)

/**
 * 是否紧凑模式(无图)
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

/**
 * 待处理赠送/转化队列
 */
const [_pendingGiveItems, setPendingGiveItems] = useLocalStorageStateShallow<GiftItemWithGiver[]>(
  'r2beat_shipping_pending_give_items_v1',
  { defaultValue: [] },
)
const pendingGiveItemsList = computed(() => _pendingGiveItems.value ?? [])

const loading = ref(false)
const keyword = ref('')
const debouncedKeyword = useDebounce(keyword, { wait: 500 })
// 当前选中的道具分类组
const selectedKeywordGroups = shallowRef<string[]>([])
// 当前选中道具
const selectedRows = shallowRef<GroupedRow[]>([])
// 赠送物品modal
const giveModalVisible = ref(false)
// 能量转化modal
const energyConvertModalVisible = ref(false)
// 待赠送任务是否正在执行
const giveTaskRunning = ref(false)

const tableRef = ref<InstanceType<typeof ElTable>>()
const canFetch = computed(() => props.accounts.length > 0)
const defaultSort = {
  prop: 'latestCreatedAt',
  order: 'descending',
} as const
const sortState = ref<{ prop: SortProp; order: SortOrder }>(defaultSort)

/**
 * 根据道具获取对应的账户数据
 */
function resolveGiftOwnerUserInfo(item: GiftItem) {
  const acc = props.accounts.find(
    (a) => a.username === item.user_id && a.disable !== true && Boolean(a.token?.trim()),
  )
  return acc
}

/**
 * 从待赠送列表中按 idx 移除一条
 */
function removeGiftItemByIdx(idx: number) {
  setPendingGiveItems((prev) => (prev ?? []).filter((it) => it.idx !== idx))
}

/** 清空待赠送队列（不删本地已同步的仓库数据，仅取消排队） */
function clearPendingGiveItems() {
  if (giveTaskRunning.value) return
  setPendingGiveItems([])
}

/**
 * 并发执行赠送/转化任务，任务完成后更新本地数据
 */
async function processPendingGiveItems() {
  // 只允许有一个执行器
  if (giveTaskRunning.value) return
  if (!pendingGiveItemsList.value.length) return

  giveTaskRunning.value = true

  const loginReady = await props.verifyLoginBeforeSync()
  if (!loginReady) {
    giveTaskRunning.value = false
    return
  }

  // 存储处理完成的道具，用于更新本地数据(为了性能优化才这样写的)
  const successIdxs = new Set<number>()

  try {
    await runConcurrent(
      pendingGiveItemsList.value,
      async (item) => {
        const userInfo = resolveGiftOwnerUserInfo(item)
        const token = userInfo?.token
        if (!token) {
          throw new Error(`账号 ${item.user_id} 无有效登录态，无法赠送`)
        }
        // 赠送
        if (item.giverName) {
          const result = await ipcEmitter.invoke(
            'send-gift-item',
            ipcArg({
              token,
              idx: item.idx,
              character_name: item.giverName,
              itemName: item.item_name,
            }),
          )
          if (!result.success) {
            throw new Error(result.error ?? '赠送失败')
          }
        }
        // 能量转化
        else {
          const result = await ipcEmitter.invoke(
            'destroy-gift-item',
            ipcArg({
              token,
              idx: item.idx,
              itemName: item.item_name,
              accountLabel: userInfo.remark || userInfo.username,
            }),
          )
          if (!result.success) {
            throw new Error(result.error ?? '转化失败')
          }
        }

        removeGiftItemByIdx(item.idx)
        successIdxs.add(item.idx)
      },
      { abortOnError: false },
    )
  } catch (e) {
    toastError(e instanceof Error ? e.message : String(e))
  } finally {
    if (successIdxs.size > 0) {
      setStoredGiftItems((storedGiftItems.value ?? []).filter((it) => !successIdxs.has(it.idx)))
    }
    giveTaskRunning.value = false
  }
}

/**
 * 保存子组件传递的道具列表，开启执行器
 */
function onGiveConfirmSubmitFromModal(items: GiftItemWithGiver[]) {
  const byIdx = new Map<number, GiftItemWithGiver>()
  for (const it of pendingGiveItemsList.value) {
    byIdx.set(it.idx, it)
  }
  for (const it of items) {
    byIdx.set(it.idx, it)
  }
  setPendingGiveItems([...byIdx.values()])
  void processPendingGiveItems()
}

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

/**
 * 辅助函数: 获取拼音组合
 */
function getPinyinSearchKeys(text: string): { full: string; first: string } {
  const raw = String(text ?? '')
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
 *  对所有道具进行一次同类型合并
 */
const groupedRows = computed<GroupedRow[]>(() => {
  const items = storedGiftItems.value ?? []

  if (!items.length) return []

  // 需要检查当前账户是否已启用
  const enabledIds = new Set(props.accounts.map((a) => a.username))
  let filtered = items.filter((item) => enabledIds.has(item.user_id))

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
      // FIX: 一定要加，不然无法处理百万级数据
      list: markRaw(g.list),
      latestCreatedAt: latestText,
      latestCreatedAtTs: latestTs,
    }
  })

  return grouped
})

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

const displayDataAllCount = computed(() => {
  return displayData.value.reduce((total, group) => {
    // 累加当前分组下所有礼物的数量
    const groupTotal = group.list.length
    return total + groupTotal
  }, 0)
})

const handleSelectionChange = (rows: GroupedRow[]) => {
  // 只提取 ID，避开对大对象的 Proxy 追踪
  selectedRows.value = rows
}
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
function querySearchItemName(queryString: string, cb: (results: { value: string }[]) => void) {
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
 * 导出道具种类汇总
 */
function exportGroupedSummaryTxt() {
  const rows = storedGiftItems.value ?? []

  if (!rows.length) {
    toastError('暂无可导出的道具种类')
    return
  }

  const sorted = [...rows].sort((a, b) => {
    return Utils.compareByFirstCodePointAsc(a.item_name, b.item_name)
  })

  // 1. 按 item_code 进行归类统计
  const summaryMap = new Map<
    string,
    { name: string; totalCount: number; totalDays: number; unit: string }
  >()

  sorted.forEach((item) => {
    const code = item.item_id
    const { count, unit } = parseGiftItemName(item)

    if (!summaryMap.has(code)) {
      summaryMap.set(code, {
        name: item.item_name,
        totalCount: 0,
        totalDays: 0,
        unit,
      })
    }

    const group = summaryMap.get(code)!
    group.totalCount += 1 // 累计件数（item_code 出现的次数）
    group.totalDays += count // 累计天数（从名字解析出来的数值）
  })

  const contentLines = Array.from(summaryMap.values()).map((group) => {
    return `${group.name}----${group.totalCount}件----共${group.totalDays}${group.unit}`
  })

  const content = '\uFEFF' + contentLines.join('\r\n')

  // 3. 执行下载
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = Utils.formatExportFileName('道具汇总列表')
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()

  // 清理
  document.body.removeChild(a)
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

watch([keyword, selectedKeywordGroups], () => {
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

    .item-table-give {
      display: flex;
      width: 100%;
      align-items: center;

      .el-switch {
        margin-left: auto;
      }
    }
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

.item-table-name-copy {
  cursor: pointer;
  border-radius: 2px;
}

.item-table-name-copy:hover {
  color: var(--el-color-primary, #409eff);
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
